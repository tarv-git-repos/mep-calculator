import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface DuctSizerExportData {
  unitSystem: "ip" | "si";
  preset: string;
  customProfileName: string;
  airflow: number; // CFM
  targetFr: number; // in.wg/100ft
  ductShape: "round" | "rect";
  aspectRatio: number;
  calcResults: {
    qCfm: number;
    qLps: number;
    targetFrInWg: number;
    targetFrPaM: number;
    ductShape: "round" | "rect";
    aspectRatio: number;
    exactDiameterIn: number;
    exactDiameterMm: number;
    selectedWidthIn: number;
    selectedHeightIn: number;
    selectedWidthMm: number;
    selectedHeightMm: number;
    sizeDisplay: string;
    sizeFullText: string;
    deqIn: number;
    deqMm: number;
    hydraulicDiaIn: number;
    hydraulicDiaMm: number;
    areaM2: number;
    areaSqFt: number;
    velocityMs: number;
    velocityFpm: number;
    actualFrPaM: number;
    actualFrInWg: number;
    velPressPa: number;
    velPressInWg: number;
    reynolds: number;
    frictionFactor: number;
    perimeterM: number;
    perimeterIn: number;
    flowRegime: string;
  };
}

export interface DuctSizerProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
}

export const exportDuctSizerPDF = async (
  data: DuctSizerExportData,
  meta: DuctSizerProjectMetaData = {}
) => {
  let currentUserName = "System Admin";
  let activeProjectId = "default";
  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem("mep_user") || "{}");
      currentUserName = user.name || "System Admin";
      const ws = JSON.parse(localStorage.getItem("workspace-storage") || "{}");
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  try {
    const activeProj: any = workspaceStore.getState()?.project || {};

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    // A4 Portrait Mode (210mm x 297mm) - Exact Ventilation standard
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-DUCT-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "HVAC Duct Sizing Study";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Header Title (Exact Ventilation standard: 14pt bold helvetica at X=14, Y=14)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Duct Sizer Calculation Report", 14, 14);

    // 2. Metadata Block (Exact Ventilation standard: 182mm width outer box, lines at 24 & 30, vertical divider at 105)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box for metadata

    // Vertical line to separate left/right metadata
    doc.line(105, 18, 105, 36);

    // Horizontal dividing lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Left Column
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.text("Date:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    // Standard Ventilation palette
    const primaryFill = [217, 217, 217] as [number, number, number]; // Gray #D9D9D9 for headers
    const blueFill = [218, 233, 248] as [number, number, number];    // Blue #DAE9F8 for recommended sizing header

    const { calcResults, isSI, customProfileName, ductShape, aspectRatio } = {
      calcResults: data.calcResults,
      isSI: data.unitSystem === "si",
      customProfileName: data.customProfileName || "Commercial Office Main",
      ductShape: data.ductShape,
      aspectRatio: data.aspectRatio,
    };

    // 3. Table 1: Design Parameters & Sizing Basis
    const inputTableBody = [
      [
        "Application / Service",
        customProfileName,
        customProfileName,
        "SMACNA / ASHRAE Application Criteria",
      ],
      [
        "Design Airflow (Q)",
        `${calcResults.qCfm.toLocaleString()} CFM`,
        `${Math.round(calcResults.qLps).toLocaleString()} L/s`,
        "Primary Design Duty",
      ],
      [
        "Target Friction Rate (fr)",
        `${calcResults.targetFrInWg.toFixed(3)} in.wg/100ft`,
        `${calcResults.targetFrPaM.toFixed(2)} Pa/m`,
        "Equal Friction Method Basis",
      ],
      [
        "Cross-Section Configuration",
        ductShape === "round" ? "Round Spiral Duct" : "Rectangular Duct",
        ductShape === "round" ? "Round Spiral Duct" : "Rectangular Duct",
        "Sheet Metal Fabrication Standard",
      ],
      [
        "Duct Aspect Ratio (W : H)",
        ductShape === "rect" ? `${aspectRatio.toFixed(1)} : 1` : "1.0 : 1 (Circular)",
        ductShape === "rect" ? `${aspectRatio.toFixed(1)} : 1` : "1.0 : 1 (Circular)",
        ductShape === "rect" ? "SMACNA Aspect Limit ≤ 4.0:1" : "Circular Symmetrical",
      ],
      [
        "Material / Absolute Roughness",
        "Galvanized Steel Sheet (ε = 0.0035 in.)",
        "Galvanized Steel Sheet (ε = 0.09 mm)",
        "SMACNA Standard Sheet Roughness",
      ],
    ];

    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 46, fontStyle: "bold" },
        1: { cellWidth: 42, fontStyle: "bold" },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { halign: "left", cellWidth: 52 },
      },
      head: [
        [
          { content: "Design Input Parameter", styles: { fillColor: primaryFill } },
          { content: "Value (IP Units)", styles: { fillColor: primaryFill } },
          { content: "Value (SI Units)", styles: { fillColor: primaryFill } },
          { content: "Engineering Design Basis", styles: { fillColor: primaryFill } },
        ],
      ],
      body: inputTableBody,
    });

    const table1FinalY = (doc as any).lastAutoTable?.finalY ?? 95;

    // 4. Table 2: Recommended Sizing & Aerodynamic Performance Results
    const sizeDisplayIP = ductShape === "round"
      ? `Ø ${calcResults.selectedWidthIn}" NPS`
      : `${calcResults.selectedWidthIn}" W × ${calcResults.selectedHeightIn}" H`;

    const sizeDisplaySI = ductShape === "round"
      ? `Ø ${calcResults.selectedWidthMm} mm`
      : `${calcResults.selectedWidthMm} mm W × ${calcResults.selectedHeightMm} mm H`;

    const velocityCompliance = calcResults.velocityFpm <= 2000
      ? "Compliant (Low-Noise Main Trunk < 2000 FPM)"
      : calcResults.velocityFpm <= 2500
      ? "Acceptable (High-Velocity / Industrial Trunk)"
      : "Caution: High Velocity (Exceeds 2500 FPM)";

    const resultsTableBody = [
      [
        "RECOMMENDED DUCT SIZE",
        sizeDisplayIP,
        sizeDisplaySI,
        "Selected Standard Fabrication Dimension",
      ],
      [
        "Air Velocity (V)",
        `${Math.round(calcResults.velocityFpm).toLocaleString()} FPM`,
        `${calcResults.velocityMs.toFixed(2)} m/s`,
        velocityCompliance,
      ],
      [
        "Actual Friction Loss",
        `${calcResults.actualFrInWg.toFixed(4)} in.wg/100ft`,
        `${calcResults.actualFrPaM.toFixed(3)} Pa/m`,
        `Colebrook-White Solution (f = ${calcResults.frictionFactor.toFixed(5)})`,
      ],
      [
        "Velocity Pressure (Pv)",
        `${calcResults.velPressInWg.toFixed(4)} in.wg`,
        `${calcResults.velPressPa.toFixed(1)} Pa`,
        "Dynamic Velocity Pressure Component",
      ],
      [
        "Equivalent Circular Dia (Deq)",
        `${calcResults.deqIn.toFixed(1)}" NPS`,
        `${Math.round(calcResults.deqMm)} mm`,
        "Huebscher Equivalent Circular Diameter",
      ],
      [
        "Hydraulic Diameter (Dh)",
        `${calcResults.hydraulicDiaIn.toFixed(1)}" NPS`,
        `${Math.round(calcResults.hydraulicDiaMm)} mm`,
        "Dh = 4A / P (Fluid Dynamics Formulation)",
      ],
      [
        "Cross-Section Area (A)",
        `${calcResults.areaSqFt.toFixed(2)} sq.ft`,
        `${calcResults.areaM2.toFixed(3)} m²`,
        "Clear Net Internal Flow Area",
      ],
      [
        "Reynolds Number (Re)",
        Math.round(calcResults.reynolds).toLocaleString(),
        Math.round(calcResults.reynolds).toLocaleString(),
        `Flow Regime: ${calcResults.flowRegime}`,
      ],
      [
        "Duct Girth / Perimeter (P)",
        `${calcResults.perimeterIn.toFixed(1)} in.`,
        `${calcResults.perimeterM.toFixed(2)} m`,
        "Sheet Metal Fabrication & Insulation Basis",
      ],
    ];

    callAutoTable(doc, {
      startY: table1FinalY + 6,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 46, fontStyle: "bold" },
        1: { cellWidth: 42, fontStyle: "bold" },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { halign: "left", cellWidth: 52 },
      },
      head: [
        [
          { content: "Sizing & Performance Output", styles: { fillColor: primaryFill } },
          { content: "Result (IP Units)", styles: { fillColor: isSI ? primaryFill : blueFill } },
          { content: "Result (SI Units)", styles: { fillColor: isSI ? blueFill : primaryFill } },
          { content: "Aerodynamic & Acoustic Notes", styles: { fillColor: primaryFill } },
        ],
      ],
      body: resultsTableBody,
      didParseCell: function (cellData: any) {
        // Highlight Recommended Duct Size row in light blue (exact Ventilation standard)
        if (cellData.section === "body" && cellData.row.index === 0) {
          cellData.cell.styles.fillColor = [242, 248, 253];
          cellData.cell.styles.fontStyle = "bold";
        }
      },
    });

    const table2FinalY = (doc as any).lastAutoTable?.finalY ?? 175;

    // 5. 3-Tier Signature Block (Exact Ventilation standard: Start at finalY + 8, apricot fill [255, 230, 204])
    let userName = meta.userName || (typeof window !== "undefined" ? (window as any).currentMepUserName : undefined) || currentUserName || "System Admin";
    if (!meta.userName) {
      try {
        const profileStr = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile") || localStorage.getItem("mep_user_data");
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (profile.name) userName = profile.name;
          else if (profile.user?.name) userName = profile.user.name;
          else if (profile.userData?.name) userName = profile.userData.name;
        }
      } catch (e) {}
    }

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(activeProj?.id || "default", "/duct-sizer", userName, meta.reviewState);

    callAutoTable(doc, {
      startY: table2FinalY + 8,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: [255, 230, 204],
        textColor: 0,
        fontStyle: "bold",
      },
      head: [
        [
          { content: "" },
          { content: "Originator" },
          { content: "Reviewer" },
          { content: "Approver" },
        ],
      ],
      body: [
        [
          { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedName || userName || "Design Engineer", styles: { halign: "center" } },
          { content: reviewerName || "-", styles: { halign: "center" } },
          { content: approverName || "-", styles: { halign: "center" } },
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedDate || today, styles: { halign: "center" } },
          { content: reviewerDate || "-", styles: { halign: "center" } },
          { content: approverDate || "-", styles: { halign: "center" } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
      },
    });

    const pdfBuffer = doc.output("arraybuffer");
    const fileName = `Duct_Sizer_Report_${activeProj?.code || "P000"}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Duct Sizer PDF report generated successfully!");
  } catch (error: any) {
    console.error("exportDuctSizerPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
