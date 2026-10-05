import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";
import { type PresetOption } from "./calc-plumbing-fm200";

export interface FM200PDFInputs {
  area: number | "";
  height: number | "";
  preset: PresetOption;
  customConc: number | "";
  temp: number | "";
  useStandardS: boolean;
  safetyFactor: number | "";
  unitSystem: "si" | "ip";
}

export interface FM200PDFResults {
  volume: number;
  C: number;
  S: number;
  weight: number;
  warnings: string[];
}

export interface ProjectMetaData {
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

export const exportFM200PDF = async (
  inputs: FM200PDFInputs,
  results: FM200PDFResults,
  meta: ProjectMetaData = {}
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
    // A4 Portrait Mode matching Ventilation PDF
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-FM200-R01";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "FM-200 Clean Agent Fire Suppression Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    const isSI = inputs.unitSystem === "si";
    const areaUnit = isSI ? "m²" : "ft²";
    const lenUnit = isSI ? "m" : "ft";
    const volUnit = isSI ? "m³" : "ft³";
    const weightUnit = isSI ? "kg" : "lb";
    const tempUnit = isSI ? "°C" : "°F";
    const sUnit = isSI ? "m³/kg" : "ft³/lb";

    const primaryFill: [number, number, number] = [217, 217, 217]; // Uniform gray #D9D9D9 (Matching Ventilation)
    const blueFill: [number, number, number] = [218, 233, 248];    // Soft Blue highlight #DAE9F8 (Matching Ventilation)

    // 1. Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("FM-200 Clean Agent Fire Suppression Sizing Report", 14, 14);

    // 2. Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 100, 100);
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

    const hazardLabelMap: Record<string, string> = {
      class_a: "Class A - Surface Fire (6.857%)",
      class_c: "Class C - Electrical Hazards (7.00%)",
      class_b: "Class B - Flammable Liquid (8.70%)",
      custom: `Custom Concentration (${results.C.toFixed(2)}%)`
    };
    const hazardLabel = hazardLabelMap[inputs.preset] || inputs.preset.replace("_", " ").toUpperCase();

    const areaVal = typeof inputs.area === "number" ? inputs.area : 0;
    const heightVal = typeof inputs.height === "number" ? inputs.height : 0;
    const safetyFactorVal = typeof inputs.safetyFactor === "number" ? inputs.safetyFactor : 1.0;

    // 3. Table 1: Executive Design Parameters & Enclosure Layout
    const summaryRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Executive Design Parameter Summary", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Design Basis / Code", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Protected Enclosure Floor Area", `${areaVal.toFixed(2)}`, areaUnit, "Architectural room plan dimensions"],
      ["2", "Protected Enclosure Clear Ceiling Height", `${heightVal.toFixed(2)}`, lenUnit, "True slab-to-slab or ceiling barrier height"],
      ["3", "Flooded Gross Enclosure Volume (V)", `${results.volume.toFixed(2)}`, volUnit, "V = Floor Area × Clear Height"],
      ["4", "Fire Hazard Classification", hazardLabel, "-", "NFPA 2001 Chapter 5 Hazard Category"],
      ["5", "Minimum Enclosure Design Temperature (T)", `${typeof inputs.temp === "number" ? inputs.temp.toFixed(1) : "20.0"}`, tempUnit, "Lowest anticipated ambient room temperature"],
      ["6", "Specific Vapor Volume of HFC-227ea (S)", `${results.S.toFixed(4)}`, sUnit, inputs.useStandardS ? "Standard reference baseline (0.1473 m³/kg)" : "S = k1 + k2 × T (NFPA 2001 formula)"],
      ["7", "Engineering Safety Factor", `${safetyFactorVal.toFixed(2)}x`, "-", safetyFactorVal > 1.0 ? "Contingency for room leakage / uncloseable openings" : "Standard base code sizing"],
      [
        { content: "8", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Design Agent Concentration (C)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.C.toFixed(3)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "%", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "NFPA 2001 Table 5.4.2 minimum design concentration", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "9", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Required FM-200 Net Agent Weight (W)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.weight.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: weightUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "W = (V / S) × [ C / (100 - C) ] × Safety Factor", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "10", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Target Maximum Discharge Duration", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: "10.0", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Seconds", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "NFPA 2001 Clause 5.7.1.2 rapid total flooding extinction", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: summaryRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.0, right: 2.0 },
        minCellHeight: 5.2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 100;

    // 4. Table 2: NFPA 2001 Volumetric Flooding & Hydraulic Sizing Schedule
    const expansionTerm = (results.C / (100 - results.C)).toFixed(5);
    const densityTerm = (results.weight / (results.volume || 1)).toFixed(3);

    const scheduleRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Clean Agent Flooding Calculation Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "NFPA 2001 Engineering Requirement", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Gross Enclosure Flooding Volume (V)", `${results.volume.toFixed(2)}`, volUnit, "Geometric room volume (V = Area × Height)"],
      ["2", "Superheated Specific Vapor Volume (S)", `${results.S.toFixed(4)}`, sUnit, isSI ? "k1 = 0.1269, k2 = 0.000513" : "k1 = 1.885, k2 = 0.0046"],
      ["3", "Volumetric Expansion Factor [C / (100 - C)]", `${expansionTerm}`, "-", "NFPA 2001 Equation 5.5.1 concentration ratio"],
      ["4", "Average Agent Flooding Density (W / V)", `${densityTerm}`, isSI ? "kg/m³" : "lb/ft³", "Total mass of agent per unit protected volume"],
      [
        { content: "5", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Total Net Extinguishing Agent Weight (W)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.weight.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: weightUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Total liquid HFC-227ea stored in pressurized cylinders", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      ["6", "Minimum Hold / Retention Time Target", "10.0", "Minutes", "Door fan room integrity test holding period"],
      ["7", "Maximum Targeted Discharge Duration", "10.0", "Seconds", "Prevents thermal decomposition into Hydrogen Fluoride (HF)"]
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: scheduleRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.0, right: 2.0 },
        minCellHeight: 5.2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 160;

    // 5. Table 3: Occupational Safety & Toxicological Exposure Analysis
    const noaelStatus = results.C <= 9.0
      ? "COMPLIANT (Safe for normally occupied enclosures)"
      : results.C <= 10.5
      ? "CAUTION (Evacuation within 5 min required)"
      : "RESTRICTED (Unoccupied enclosures only)";

    const safetyRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Toxicological Safety Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Evaluated Level", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Threshold", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Safety Status & Egress Constraint", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "No Observed Adverse Effect Level (NOAEL)", "9.00%", "≤ 9.00%", "Safe for human exposure up to 5 minutes without health risks"],
      ["2", "Lowest Observed Adverse Effect Level (LOAEL)", "10.50%", "≤ 10.50%", "Evacuation must occur before discharge commences"],
      ["3", "UL / FM Minimum Listing Concentration", "5.80%", "≥ 5.80%", "Certified minimum concentration for flame extinguishment"],
      [
        { content: "4", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Evaluated Enclosure Design Concentration", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.C.toFixed(3)}%`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "NOAEL OK", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: noaelStatus, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    // Check page break for Table 3 & Sign-off Block
    if (currentY + 65 > 275) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: safetyRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.0, right: 2.0 },
        minCellHeight: 5.2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || currentY + 45;

    // Check page break for signature block (needs ~38mm)
    if (currentY + 38 > 275) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 6. Table 4: Professional Review & Sign-Off Block
    const sigDetails = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/plumbing-fm200",
      currentUserName,
      meta.reviewState
    );

    const sigTableRows = [
      [
        { content: "Approval Role", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineer Name", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Status / Role Title", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Signature / Date", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      [
        { content: "Originator / Prepared By", styles: { fontStyle: "bold", halign: "left" } },
        { content: sigDetails.originatedName, styles: { halign: "center" } },
        { content: "Fire Protection Design Engineer", styles: { halign: "center" } },
        { content: sigDetails.originatedDate || today, styles: { halign: "center" } }
      ],
      [
        { content: "Reviewer / Checked By", styles: { fontStyle: "bold", halign: "left" } },
        { content: sigDetails.reviewerName || "Pending Review", styles: { halign: "center" } },
        { content: "Senior Fire Protection Lead", styles: { halign: "center" } },
        { content: sigDetails.reviewerDate || "—", styles: { halign: "center" } }
      ],
      [
        { content: "Approver / Verified By", styles: { fontStyle: "bold", halign: "left" } },
        { content: sigDetails.approverName || "Pending Approval", styles: { halign: "center" } },
        { content: "Principal / MEP Director", styles: { halign: "center" } },
        { content: sigDetails.approverDate || "—", styles: { halign: "center" } }
      ]
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: sigTableRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2.0, right: 2.0 },
        minCellHeight: 6.0
      },
      columnStyles: {
        0: { cellWidth: 46, halign: "left" },
        1: { cellWidth: 46, halign: "center" },
        2: { cellWidth: 46, halign: "center" },
        3: { cellWidth: 44, halign: "center" }
      }
    });

    const pdfBuffer = doc.output("arraybuffer");
    await downloadFile(new Uint8Array(pdfBuffer), `FM200_Sizing_Report_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("PDF exported successfully!");

  } catch (err: any) {
    console.error("PDF export error:", err);
    toast.error(err?.message || "Failed to generate PDF export.");
  }
};
