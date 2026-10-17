import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface SprinklerDensityExportData {
  hazard: string;
  hazardLabel: string;
  density: number;
  densityUnit: string;
  designArea: number;
  designAreaUnit: string;
  coverage: number;
  coverageUnit: string;
  kFactor: number;
  kFactorUnit: string;
  unitSystem: "ip" | "si";
  flowPerSprinkler: number;
  pressureRequired: number;
  pressureUnit: string;
  sprinklersCount: number;
  totalSprinklerFlow: number;
  flowUnit: string;
  hoseAllowance: number;
  totalSystemDemand: number;
  totalSystemDemandM3hr?: number;
  waterDurationMin: number;
  totalStorageGallons: number;
  totalStorageM3: number;
  isPressureCompliant: boolean;
  isCoverageCompliant: boolean;
  complianceNotes?: string[];
}

export interface SprinklerDensityProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  unitSystem?: "ip" | "si";
  includeStamp?: boolean;
  reviewState?: any;
  returnBuffer?: boolean;
}

export const exportSprinklerDensityPDF = async (
  data: SprinklerDensityExportData,
  meta: SprinklerDensityProjectMetaData = {}
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
    // A4 Portrait Mode (210mm x 297mm) matching Ventilation exactly
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

    const isSI = data.unitSystem === "si";
    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-SDF-001";
    const revNo = meta.revNo || activeProj?.revNo || "0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Sprinkler Hydraulic Calculation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Standard Header & Metadata Block
    const startY = addPdfHeader(doc, "Sprinkler Density & Flow Calculation Report", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    // 2. Color Hierarchy
    const primaryFill: [number, number, number] = [217, 217, 217]; // #D9D9D9 standard header
    const blueFill: [number, number, number] = [218, 233, 248];    // #DAE9F8 key output highlight
    const signatureFill: [number, number, number] = [255, 230, 204]; // #FFE6CC signature header

    // Clean units for PDF ASCII safety
    const densUnit = isSI ? "mm/min" : "gpm/ft2";
    const areaUnit = isSI ? "m2" : "ft2";
    const pressUnit = isSI ? "bar" : "psi";
    const kUnit = isSI ? "L/min/bar^0.5" : "gpm/psi^0.5";
    const flowUnit = isSI ? "L/min" : "GPM";

    // Table 1: Sizing Parameters Breakdown Table
    const paramRows: any[] = [
      ["1", "Hazard Classification", "NFPA 13 Standard", data.hazardLabel, "-"],
      ["2", "Design Density (d)", "NFPA 13 Density Curve", data.density.toFixed(2), densUnit],
      ["3", "Design Area of Operation (A_design)", "NFPA 13 Area Curve", data.designArea.toLocaleString(), areaUnit],
      ["4", "Sprinkler Coverage Area (A_cov)", "Spacing Criterion", data.coverage.toString(), areaUnit],
      ["5", "Sprinkler Discharge Coefficient (K)", "Standard Orifice", `K-${data.kFactor.toFixed(1)}`, kUnit],
      ["6", "Minimum Flow per Sprinkler (q = d × A_cov)", "q = d · A_cov", data.flowPerSprinkler.toFixed(2), flowUnit],
      ["7", "Minimum Operating Pressure (P = (q/K)2)", "P = (q / K)2", data.pressureRequired.toFixed(2), pressUnit],
      ["8", "Number of Design Sprinklers (N)", "N = ceil(A_design / A_cov)", `${data.sprinklersCount} Heads`, "heads"],
      ["9", "Sprinkler System Flow Demand (Q_sprinkler)", "Q_sp = d · A_design", data.totalSprinklerFlow.toFixed(1), flowUnit],
      ["10", "Inside Hose Stream Allowance (Q_hose)", "NFPA 13 Table Allowance", data.hoseAllowance.toFixed(1), flowUnit],
      ["11", "TOTAL DESIGN WATER DEMAND (Q_total)", "Q_sp + Q_hose", data.totalSystemDemand.toFixed(1), flowUnit],
      ["12", "Water Supply Duration", "NFPA 13 Duration Requirement", `${data.waterDurationMin} Minutes`, "min"],
      ["13", "Required Fire Water Storage Capacity", "V = Q_total × Duration", isSI ? `${data.totalStorageM3.toFixed(1)} m3` : `${data.totalStorageGallons.toLocaleString()} Gallons`, isSI ? "m3" : "gal"],
    ];

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14 },
      theme: "grid",
      pageBreak: "avoid",
      styles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.1, bottom: 1.1, left: 1, right: 1 },
        minCellHeight: 4.4,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 1.4, bottom: 1.4, left: 1, right: 1 },
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { halign: "left", cellWidth: 64, fontStyle: "bold" },
        2: { halign: "left", cellWidth: 48 },
        3: { halign: "center", cellWidth: 38, fontStyle: "bold" },
        4: { cellWidth: 24 },
      },
      head: [
        [
          { content: "Sr.", styles: { fillColor: primaryFill } },
          { content: "Sprinkler Sizing Parameter", styles: { fillColor: primaryFill } },
          { content: "Governing Formula / Rule", styles: { fillColor: primaryFill } },
          { content: "Calculated Value", styles: { fillColor: primaryFill } },
          { content: "Unit", styles: { fillColor: primaryFill } },
        ],
      ],
      body: paramRows,
      didParseCell: function(dataCell: any) {
        if (dataCell.section === "body") {
          const rowIndex = dataCell.row.index;
          // Highlight Row 11 (Total Design Water Demand) and Row 13 (Required Storage Capacity) in blueFill
          if (rowIndex === 10 || rowIndex === 12) {
            dataCell.cell.styles.fillColor = blueFill;
            dataCell.cell.styles.fontStyle = "bold";
            if (dataCell.column.index === 3) {
              dataCell.cell.styles.fontSize = 7.6;
            }
          }
        }
      },
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 110;

    // 4. Table 2: NFPA 13 Code Audit Items
    const complianceBody = [
      [
        "1",
        "Minimum Operating Pressure Check",
        `${data.pressureRequired.toFixed(1)} ${pressUnit}`,
        data.isPressureCompliant
          ? (isSI ? "COMPLIANT (>= 0.48 bar)" : "COMPLIANT (>= 7.0 psi)")
          : (isSI ? "NON-COMPLIANT (< 0.48 bar)" : "NON-COMPLIANT (< 7.0 psi)"),
        data.isPressureCompliant
          ? "Meets NFPA 13 standard minimum nozzle discharge pressure criterion."
          : `VIOLATION: Operating pressure is below minimum allowable ${isSI ? "0.48 bar (7.0 psi)" : "7.0 psi"}. Increase design density or decrease K-factor.`,
      ],
      [
        "2",
        "Maximum Coverage Area Check",
        `${data.coverage} ${areaUnit}`,
        data.isCoverageCompliant
          ? (isSI ? "COMPLIANT (<= 20.9 m2)" : "COMPLIANT (<= 225 ft2)")
          : (isSI ? "ATTENTION (> 20.9 m2)" : "ATTENTION (> 225 ft2)"),
        data.isCoverageCompliant
          ? "Within standard maximum spacing limits for designated hazard classification."
          : `Coverage exceeds standard ${isSI ? "20.9 m2 (225 ft2)" : "225 ft2"} limit. Confirm extended coverage listing with manufacturer.`,
      ],
      [
        "3",
        "Water Supply Demand Summary",
        `${data.totalSystemDemand.toFixed(1)} ${flowUnit}`,
        "VERIFIED",
        `Combined flow demand includes ${data.totalSprinklerFlow.toFixed(1)} ${flowUnit} sprinkler demand and ${data.hoseAllowance.toFixed(1)} ${flowUnit} hose stream allowance.`,
      ],
    ];

    callAutoTable(doc, {
      startY: currentY + 3,
      margin: { left: 14, right: 14 },
      theme: "grid",
      pageBreak: "avoid",
      styles: {
        fontSize: 6.8,
        halign: "left",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 },
        minCellHeight: 4.2,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
        cellPadding: { top: 1.3, bottom: 1.3, left: 1, right: 1 },
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { cellWidth: 44, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 26, fontStyle: "bold" },
        3: { halign: "center", cellWidth: 38, fontStyle: "bold" },
        4: { cellWidth: 66 },
      },
      head: [
        [
          { content: "Sr.", styles: { fillColor: primaryFill, halign: "center" } },
          { content: "NFPA 13 Code Audit Item", styles: { fillColor: primaryFill } },
          { content: "Calculated Value", styles: { fillColor: primaryFill, halign: "center" } },
          { content: "Compliance Status", styles: { fillColor: primaryFill, halign: "center" } },
          { content: "Engineering Recommendations / Notes", styles: { fillColor: primaryFill } },
        ],
      ],
      body: complianceBody,
    });

    currentY = (doc as any).lastAutoTable?.finalY || 140;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 280) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 5. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProjectId || activeProj?.id || "default",
        "/plumbing-sprinkler-density",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProjectId || activeProj?.id || "default",
        "/plumbing-sprinkler-density"
      );
    }

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    // Output / Download generated PDF
    const pdfBuffer = doc.output("arraybuffer");
    if (meta.returnBuffer) {
      return new Uint8Array(pdfBuffer);
    }

    const fileName = `Sprinkler_Density_Flow_${projectNo}_${new Date().toISOString().slice(0, 10)}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Sprinkler Density & Flow PDF report generated successfully!");
    return true;
  } catch (error: any) {
    console.error("Failed to export Sprinkler Density PDF:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export failed: ${error?.message || "Unknown error"}`);
    }
    return false;
  }
};
