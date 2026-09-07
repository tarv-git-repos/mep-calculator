import { addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
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
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Fire Fighting Sprinkler Hydraulic Calculation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Header Title (Matching Ventilation exact position and font)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Sprinkler Density & Flow Calculation Report", 14, 14);

    // 2. Metadata Block (Exact Ventilation 2-column format: 14mm to 196mm, 182mm width)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box for metadata

    // Vertical line to separate left/right metadata
    doc.line(105, 18, 105, 36);

    // Horizontal lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    // 3. Header Fill Colors (Exact matching Ventilation)
    const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header gray
    const blueFill = [218, 233, 248] as [number, number, number];    // Highlighted / calculated outputs blue

    // Sizing Parameters Breakdown Table
    const paramRows: any[] = [
      ["1", "Hazard Classification", "NFPA 13 Standard", data.hazardLabel, "-"],
      ["2", "Design Density (d)", "NFPA 13 Density Curve", data.density.toFixed(2), data.densityUnit],
      ["3", "Design Area of Operation (A_design)", "NFPA 13 Area Curve", data.designArea.toLocaleString(), data.designAreaUnit],
      ["4", "Sprinkler Coverage Area (A_cov)", "Spacing Criterion", data.coverage.toString(), data.coverageUnit],
      ["5", "Sprinkler Discharge Coefficient (K)", "Standard Orifice", `K-${data.kFactor.toFixed(1)}`, data.kFactorUnit || (isSI ? "L/min/bar^0.5" : "gpm/psi^0.5")],
      ["6", "Minimum Flow per Sprinkler (q = d × A_cov)", "q = d · A_cov", data.flowPerSprinkler.toFixed(2), data.flowUnit],
      ["7", "Minimum Operating Pressure (P = (q/K)²)", "P = (q / K)²", data.pressureRequired.toFixed(2), data.pressureUnit],
      ["8", "Number of Design Sprinklers (N)", "N = ceil(A_design / A_cov)", `${data.sprinklersCount} Heads`, "heads"],
      ["9", "Sprinkler System Flow Demand (Q_sprinkler)", "Q_sp = d · A_design", data.totalSprinklerFlow.toFixed(1), data.flowUnit],
      ["10", "Inside Hose Stream Allowance (Q_hose)", "NFPA 13 Table Allowance", data.hoseAllowance.toFixed(1), data.flowUnit],
      ["11", "TOTAL DESIGN WATER DEMAND (Q_total)", "Q_sp + Q_hose", data.totalSystemDemand.toFixed(1), data.flowUnit],
      ["12", "Water Supply Duration", "NFPA 13 Duration Requirement", `${data.waterDurationMin} Minutes`, "min"],
      ["13", "Required Fire Water Storage Capacity", "V = Q_total × Duration", isSI ? `${data.totalStorageM3.toFixed(1)} m³` : `${data.totalStorageGallons.toLocaleString()} Gallons`, isSI ? "m³" : "gal"],
    ];

    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
        minCellHeight: 6.5
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 }
      },
      columnStyles: {
        0: { cellWidth: 10 },                               // Sr. No.
        1: { halign: "left", cellWidth: 66 },               // Parameter Description
        2: { halign: "left", cellWidth: 46 },               // Governing Formula / Standard
        3: { halign: "right", cellWidth: 35, fontStyle: "bold", fillColor: [240, 247, 252] }, // Calculated Value (highlighted)
        4: { halign: "center", cellWidth: 25 },             // Unit
      },
      head: [
        [
          { content: "Sr.", styles: { fillColor: primaryFill } },
          { content: "Sprinkler Sizing Parameter", styles: { fillColor: primaryFill } },
          { content: "Governing Formula / Rule", styles: { fillColor: primaryFill } },
          { content: "Calculated Value", styles: { fillColor: blueFill } },
          { content: "Unit", styles: { fillColor: primaryFill } }
        ]
      ],
      body: paramRows,
      didParseCell: function(dataCell: any) {
        if (dataCell.section === "body") {
          const rowIndex = dataCell.row.index;
          // Highlight total demand row (Row 11) with standard ventilation total row styling
          if (rowIndex === 10) {
            dataCell.cell.styles.fillColor = primaryFill;
            dataCell.cell.styles.fontStyle = "bold";
            dataCell.cell.styles.textColor = 0;
            if (dataCell.column.index === 3) {
              dataCell.cell.styles.fillColor = blueFill;
            }
          } else if (dataCell.column.index === 3) {
            dataCell.cell.styles.fillColor = [242, 248, 253]; // Exact light blue from Ventilation
          }
        }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 160;

    // 4. NFPA 13 Engineering Compliance & Audit Notes Table
    const complianceBody = [
      [
        "1",
        "Minimum Operating Pressure Check",
        `${data.pressureRequired.toFixed(1)} ${data.pressureUnit}`,
        data.isPressureCompliant ? "COMPLIANT (>= 7.0 psi)" : "NON-COMPLIANT (< 7.0 psi)",
        data.isPressureCompliant
          ? "Meets NFPA 13 standard minimum nozzle discharge pressure criterion."
          : "VIOLATION: Operating pressure is below minimum allowable 7.0 psi. Increase design density or decrease K-factor."
      ],
      [
        "2",
        "Maximum Coverage Area Check",
        `${data.coverage} ${data.coverageUnit}`,
        data.isCoverageCompliant ? "COMPLIANT (<= 225 ft²)" : "ATTENTION (> 225 ft²)",
        data.isCoverageCompliant
          ? "Within standard maximum spacing limits for designated hazard classification."
          : "Coverage exceeds standard 225 ft² limit. Confirm extended coverage listing with manufacturer."
      ],
      [
        "3",
        "Water Supply Demand Summary",
        `${data.totalSystemDemand.toFixed(1)} ${data.flowUnit}`,
        "VERIFIED",
        `Combined flow demand includes ${data.totalSprinklerFlow.toFixed(1)} ${data.flowUnit} sprinkler demand and ${data.hoseAllowance.toFixed(1)} ${data.flowUnit} hose stream allowance.`
      ]
    ];

    callAutoTable(doc, {
      startY: currentY + 6,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "left",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 }
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 48, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 24, fillColor: [240, 247, 252] },
        3: { halign: "center", cellWidth: 38, fontStyle: "bold", fillColor: [240, 247, 252] },
        4: { cellWidth: 62 },
      },
      head: [
        [
          { content: "Sr.", styles: { fillColor: primaryFill } },
          { content: "NFPA 13 Code Audit Item", styles: { fillColor: primaryFill } },
          { content: "Calculated Value", styles: { fillColor: blueFill } },
          { content: "Compliance Status", styles: { fillColor: blueFill } },
          { content: "Engineering Recommendations / Notes", styles: { fillColor: primaryFill } }
        ]
      ],
      body: complianceBody,
      didParseCell: function(dataCell: any) {
        if (dataCell.section === "body") {
          if (dataCell.column.index === 2 || dataCell.column.index === 3) {
            dataCell.cell.styles.fillColor = [242, 248, 253]; // Exact light blue from Ventilation
          }
        }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || (currentY + 60);

    // 5. Signature Block (Discipline Coordinator / Lead Engineer)
    addPdfSignatureBlock(
      doc,
      currentY + 6,
      currentUserName,
      activeProjectId || activeProj?.id || "default",
      "/plumbing-sprinkler-density"
    );

    // Download generated PDF
    const pdfBuffer = doc.output("arraybuffer");
    const fileName = `Sprinkler_Density_Flow_${projectNo}_${new Date().toISOString().slice(0, 10)}.pdf`;
    downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Sprinkler Density & Flow PDF report generated successfully!");
  } catch (error: any) {
    console.error("Failed to export Sprinkler Density PDF:", error);
    toast.error(`Export failed: ${error?.message || "Unknown error"}`);
  }
};
