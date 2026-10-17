import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { cToF } from "@/utils/conversions";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

export interface PsychrometricPDFData {
  dbt: number; // deg C
  wbt: number; // deg C
  dp: number; // deg C
  rh: number; // %
  w: number; // kg/kg
  h: number; // kJ/kg
  v: number; // m3/kg
  pw: number; // Pa
}

export interface PsychrometricPDFMeta {
  calcNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  unitSystem?: "ip" | "si";
  secondParam?: "rh" | "wb" | "dp" | "w";
  paramValue?: number | "";
  atmPressure?: number | "";
  dbtInput?: number | "";
}

export const exportPsychrometricPDF = async (
  data: PsychrometricPDFData,
  meta: PsychrometricPDFMeta = {}
) => {
  try {
    const activeProj: any = workspaceStore.getState()?.project || {};
    const activeProjectId = activeProj?.id || "default";

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    const doc = new JsPDFClass("portrait", "mm", "a4");

    const callAutoTable = (pdfDoc: any, options: any) => {
      if (typeof autoTable === "function") {
        autoTable(pdfDoc, options);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(pdfDoc, options);
      } else if (typeof pdfDoc.autoTable === "function") {
        pdfDoc.autoTable(options);
      } else {
        console.error("autoTable function not available");
      }
    };

    const calcNo = meta.calcNo || activeProj?.calcNo || `TRV-CAL-PSY-${(activeProjectId || "0000").slice(-4).toUpperCase()}`;
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Psychrometric State Calculation Report", {
      calcNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

    let currentY = startY + 2;

    // 3. Input Ambient State Parameters
    const pAtmKpa = meta.atmPressure !== "" && meta.atmPressure !== undefined ? Number(meta.atmPressure) : 101.325;
    const pAtmPsi = (pAtmKpa * 0.145038).toFixed(3);

    const isIP = meta.unitSystem === "ip";
    const dbtValDisplay = isIP
      ? `${cToF(data.dbt).toFixed(1)} °F (${data.dbt.toFixed(1)} °C)`
      : `${data.dbt.toFixed(1)} °C (${cToF(data.dbt).toFixed(1)} °F)`;

    const paramNameMap: Record<string, string> = {
      rh: "Relative Humidity (RH)",
      wb: "Wet Bulb Temperature (T_wb)",
      dp: "Dew Point Temperature (T_dp)",
      w: "Humidity Ratio (W)",
    };

    const secondParamKey = meta.secondParam || "rh";
    const paramName = paramNameMap[secondParamKey] || "Relative Humidity (RH)";

    let paramValDisplay = `${data.rh.toFixed(1)} %`;
    if (secondParamKey === "wb") {
      paramValDisplay = `${data.wbt.toFixed(1)} °C (${cToF(data.wbt).toFixed(1)} °F)`;
    } else if (secondParamKey === "dp") {
      paramValDisplay = `${data.dp.toFixed(1)} °C (${cToF(data.dp).toFixed(1)} °F)`;
    } else if (secondParamKey === "w") {
      paramValDisplay = `${(data.w * 1000).toFixed(2)} g/kg (${(data.w * 7000).toFixed(2)} gr/lb)`;
    }

    const inputTableBody = [
      ["1", "Atmospheric Pressure (P_atm)", "Standard Barometric Level", `${pAtmKpa.toFixed(3)} kPa (${pAtmPsi} psi / 29.92 inHg)`, "Sea-level standard atmosphere"],
      ["2", "Dry Bulb Temperature (T_db)", "Primary Known Air Temperature", dbtValDisplay, "Sensible boundary condition"],
      ["3", `Known 2nd Parameter (${paramName})`, "Independent Thermodynamic Input", paramValDisplay, "Governing moisture state condition"],
      ["4", "Thermodynamic Formulation", "ASHRAE Handbook Fundamentals", "Hyland-Wexler Formulation", "Standard high-precision psychrometric model"],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        ["Sr.", "Design Input Parameter", "Governing Rule / Basis", "Specified Value", "Engineering Notes"],
      ],
      body: inputTableBody,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.1,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        valign: "middle",
        minCellHeight: 4.2,
      },
      headStyles: {
        fillColor: [217, 217, 217], // Standard #D9D9D9
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 50, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 42, halign: "left" },
        3: { cellWidth: 42, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 40, halign: "left", fontSize: 6.5 },
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 3 || currentY + 30;

    // 4. Solved Psychrometric Properties Table
    const dbtC = data.dbt;
    const dbtF = cToF(dbtC);
    const wbtC = data.wbt;
    const wbtF = cToF(wbtC);
    const dpC = data.dp;
    const dpF = cToF(dpC);
    const rhVal = data.rh;
    const wGPerKg = data.w * 1000;
    const wGrPerLb = data.w * 7000;
    const hKjKg = data.h;
    const hBtuLb = data.h / 2.326;
    const vM3Kg = data.v;
    const vFt3Lb = data.v * 16.0185; // Correct specific volume conversion: 1 m3/kg = 16.0185 ft3/lb
    const pwKpa = data.pw / 1000;
    const pwPsi = data.pw / 6894.76;
    const densitySi = 1 / vM3Kg; // kg/m3
    const densityIp = 1 / vFt3Lb; // lb/ft3 (e.g. ~0.075 lb/ft3)

    const solvedPropertiesBody = [
      ["1", "Dry Bulb Temperature", "T_db", `${dbtC.toFixed(1)} °C`, `${dbtF.toFixed(1)} °F`, "Sensible thermal state of moist air"],
      ["2", "Wet Bulb Temperature", "T_wb", `${wbtC.toFixed(1)} °C`, `${wbtF.toFixed(1)} °F`, "Adiabatic saturation limit & evaporative threshold"],
      ["3", "Dew Point Temperature", "T_dp", `${dpC.toFixed(1)} °C`, `${dpF.toFixed(1)} °F`, "Surface condensation risk boundary"],
      ["4", "Relative Humidity", "RH", `${rhVal.toFixed(1)} %`, `${rhVal.toFixed(1)} %`, "Degree of moisture saturation (Pw / Pws)"],
      ["5", "Humidity Ratio (Specific Moisture)", "W", `${wGPerKg.toFixed(2)} g/kg`, `${wGrPerLb.toFixed(2)} gr/lb`, "Mass ratio of water vapor to dry air"],
      ["6", "Specific Enthalpy (Total Energy)", "h", `${hKjKg.toFixed(2)} kJ/kg`, `${hBtuLb.toFixed(2)} BTU/lb`, "Total energy content (Sensible + Latent)"],
      ["7", "Specific Volume", "v", `${vM3Kg.toFixed(4)} m³/kg`, `${vFt3Lb.toFixed(4)} ft³/lb`, "Volume per unit mass of dry air"],
      ["8", "Moist Air Density", "rho", `${densitySi.toFixed(3)} kg/m³`, `${densityIp.toFixed(4)} lb/ft³`, "Reciprocal of moist air specific volume"],
      ["9", "Water Vapor Partial Pressure", "P_w", `${pwKpa.toFixed(3)} kPa`, `${pwPsi.toFixed(4)} psi`, "Partial pressure exerted by water vapor"],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        ["Sr.", "Psychrometric Property", "Symbol", "SI Metric", "IP Imperial", "Engineering Definition & Application"],
      ],
      body: solvedPropertiesBody,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.0,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        valign: "middle",
        minCellHeight: 4.1,
      },
      headStyles: {
        fillColor: [217, 217, 217], // Standard #D9D9D9
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 48, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 60, halign: "left", fontSize: 6.5 },
      },
      didParseCell: (dataCell: any) => {
        // Highlight Enthalpy (row 5) and Density (row 7) in #DAE9F8
        if (dataCell.section === "body" && (dataCell.row.index === 3 || dataCell.row.index === 5)) {
          dataCell.cell.styles.fillColor = [218, 233, 248]; // #DAE9F8
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 3 || currentY + 45;

    // 5. Engineering Assessment (ASHRAE 55 / Energy Audit) Table
    const isSummerComfort = dbtC >= 23 && dbtC <= 26 && rhVal >= 30 && rhVal <= 60;
    const isWinterComfort = dbtC >= 20 && dbtC <= 24 && rhVal >= 30 && rhVal <= 60;
    let comfortStatusText = "Standard Conditioned Boundary";
    if (isSummerComfort) comfortStatusText = "Compliant (ASHRAE 55 Summer Comfort Envelope)";
    else if (isWinterComfort) comfortStatusText = "Compliant (ASHRAE 55 Winter Comfort Envelope)";
    else if (rhVal > 80) comfortStatusText = "Caution: High Humidity / Surface Mold & Condensation Risk";
    else if (rhVal < 20) comfortStatusText = "Caution: Low Humidity / Static Discharge & Mucous Dryness";

    const sensEnthalpy = 1.006 * dbtC;
    const latEnthalpy = data.w * (2501 + 1.805 * dbtC);
    const sensPercent = ((sensEnthalpy / hKjKg) * 100).toFixed(1);
    const latPercent = ((latEnthalpy / hKjKg) * 100).toFixed(1);
    const wbDepression = (dbtC - wbtC).toFixed(1);

    const assessmentBody = [
      ["1", "Thermal Comfort Compliance (ASHRAE 55)", "ASHRAE 55 Standard", comfortStatusText, "Evaluates human thermal comfort criteria"],
      ["2", "Sensible vs. Latent Enthalpy Ratio", "Energy Breakdown", `Sensible: ${sensPercent}% | Latent: ${latPercent}%`, `Sensible: ${sensEnthalpy.toFixed(1)} kJ/kg, Latent: ${latEnthalpy.toFixed(1)} kJ/kg`],
      ["3", "Condensation Protection Boundary", "Dew Point Envelope", `Surface Temp >= ${dpC.toFixed(1)} °C (${dpF.toFixed(1)} °F)`, "Pipe and duct insulation surface threshold"],
      ["4", "Evaporative Cooling Potential", "Wet Bulb Depression", `${wbDepression} °C / K depression`, "Direct adiabatic evaporative cooling limit"],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        ["Sr.", "Engineering Assessment Item", "Governing Rule / Basis", "Result / Evaluated Value", "Design Compliance Note"],
      ],
      body: assessmentBody,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.0,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        valign: "middle",
        minCellHeight: 4.1,
      },
      headStyles: {
        fillColor: [217, 217, 217], // Standard #D9D9D9
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 50, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 36, halign: "left" },
        3: { cellWidth: 48, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 40, halign: "left", fontSize: 6.5 },
      },
      didParseCell: (dataCell: any) => {
        if (dataCell.section === "body" && dataCell.row.index === 0) {
          dataCell.cell.styles.fillColor = [218, 233, 248]; // #DAE9F8
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 3 || currentY + 28;

    // 6. Table 4: Professional Review & Sign-Off Block & Branding
    const sigDetails = getSignatureBlockDetails(activeProjectId, "/psychrometric");
    addPdfSignatureBlock(doc, currentY, sigDetails, activeProjectId, "/psychrometric");

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    // 7. Download PDF with standardized filename
    const pdfBlob = doc.output("blob");
    const projCode = projectNo || activeProj?.code || "P000";
    const fileName = `Psychrometric_Report_${projCode}.pdf`;
    downloadFile(pdfBlob, fileName, "application/pdf");
    toast.success("Psychrometric calculation PDF report exported successfully!");
  } catch (error) {
    console.error("Failed to export Psychrometric PDF:", error);
    toast.error("Failed to generate calculation PDF report.");
  }
};
