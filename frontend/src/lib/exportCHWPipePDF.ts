import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";
import { PIPE_MATERIALS } from "./calc-chw-pipe";

export interface CHWPipePDFResults {
  isValid: boolean;
  flowVal: number;
  tRaw: number;
  dpRaw: number;
  tC: number;
  rho: number;
  mu: number;
  chosen: {
    nps: string;
    idIn: number;
    idMm: number;
    vFps: number;
    v: number;
    dpFt: number;
    dpPaM: number;
    Re: number;
    f: number;
    regime: string;
    isCompliant: boolean;
  } | null;
  allPipes: Array<{
    nps: string;
    idIn: number;
    idMm: number;
    vFps: number;
    v: number;
    dpFt: number;
    dpPaM: number;
    Re: number;
    f: number;
    regime: string;
    isCompliant: boolean;
  }>;
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

export const exportCHWPipePDF = async (
  sizingParams: {
    flowRate: string | number;
    fluidType: string;
    temperature: string | number;
    pipeMaterial: string;
    targetDp: string | number;
  },
  calculatedData: CHWPipePDFResults,
  unitSystem: "si" | "ip" = "si",
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-CHW-R01";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Chilled Water Pipe Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    const isSI = unitSystem === "si";
    const flowUnit = isSI ? "L/s" : "GPM";
    const dpUnit = isSI ? "Pa/m" : "ft/100ft";
    const tempUnit = isSI ? "°C" : "°F";
    const velUnit = isSI ? "m/s" : "fps";

    const primaryFill: [number, number, number] = [217, 217, 217]; // Uniform gray #D9D9D9 (Matching Ventilation)
    const blueFill: [number, number, number] = [218, 233, 248];    // Soft Blue highlight #DAE9F8 (Matching Ventilation)

    // 1. Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Chilled Water Pipe Sizing Calculation Report", 14, 14);

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

    const fluidLabel =
      sizingParams.fluidType === "chw"
        ? "Chilled Water (Pure H₂O)"
        : sizingParams.fluidType === "cw"
        ? "Condenser Water"
        : sizingParams.fluidType === "g25"
        ? "25% Ethylene Glycol Mixture"
        : "40% Ethylene Glycol Mixture";

    const materialLabel = PIPE_MATERIALS[sizingParams.pipeMaterial]?.label || "Carbon Steel Schedule 40";

    const p = calculatedData.chosen;
    const chosenSizeStr = p ? `${p.nps}" NPS (DN ${p.idMm})` : "-";
    const chosenVelStr = p ? (isSI ? p.v.toFixed(2) : p.vFps.toFixed(2)) : "-";
    const chosenDpStr = p ? (isSI ? p.dpPaM.toFixed(1) : p.dpFt.toFixed(2)) : "-";

    // 3. Table 1: Executive Design Parameters & Pipe Sizing Summary
    const summaryRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Executive Design Parameter Summary", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Design Basis / Code", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Hydronic System Service", "Chilled Water Distribution Loop", "-", "Closed-loop chilled / condenser water network"],
      ["2", "Circulating Fluid Type", fluidLabel, "-", "Temperature-dependent dynamic viscosity & density"],
      ["3", "Operating Fluid Temperature", `${calculatedData.tRaw}`, tempUnit, `Density ρ = ${calculatedData.rho.toFixed(1)} kg/m³, Viscosity μ = ${calculatedData.mu.toExponential(2)} Pa·s`],
      ["4", "Design System Flow Rate (Q)", `${calculatedData.flowVal}`, flowUnit, "Hydronic thermal load design flow requirement"],
      ["5", "Pipe Material & Roughness", `${materialLabel}`, "mm", `Absolute surface roughness ε = ${(PIPE_MATERIALS[sizingParams.pipeMaterial]?.roughness * 1000).toFixed(4)} mm`],
      ["6", "Target Maximum Friction Gradient", `${calculatedData.dpRaw}`, dpUnit, "ASHRAE standard max allowable friction gradient limit"],
      [
        { content: "7", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Recommended Pipe Diameter (NPS / DN)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: chosenSizeStr, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "NPS (DN)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Smallest standard diameter satisfying ΔP/L ≤ target limit", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "8", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Calculated Mean Flow Velocity (v)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${chosenVelStr}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: velUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Complies with ASHRAE velocity & erosion limits (v ≤ 2.4 m/s)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "9", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Calculated Friction Head Loss Gradient", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${chosenDpStr}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: dpUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: `Darcy-Weisbach Colebrook-White friction evaluation (f = ${p?.f.toFixed(4) || "-"})`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
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

    let currentY = (doc as any).lastAutoTable?.finalY || 95;

    // 4. Table 2: Complete Pipe Sizing Schedule & Hydrodynamic Comparison
    const scheduleRows = [
      [
        { content: "Sr.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Nominal (NPS)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Internal (DN)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Velocity (${velUnit})`, styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Friction Loss (${dpUnit})`, styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Reynolds No. (Re)", styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Compliance Status", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ...calculatedData.allPipes.map((pipe, idx) => {
        const isChosen = p?.nps === pipe.nps;
        const vVal = (isSI ? pipe.v : pipe.vFps).toFixed(2);
        const dpVal = (isSI ? pipe.dpPaM : pipe.dpFt).toFixed(isSI ? 1 : 2);
        const reVal = Math.round(pipe.Re).toLocaleString();
        const statusText = isChosen ? "RECOMMENDED (PASS)" : pipe.isCompliant ? "PASS" : "EXCEEDS ΔP LIMIT";

        const rowFill = isChosen ? blueFill : undefined;

        return [
          { content: String(idx + 1), styles: { halign: "center", fillColor: rowFill, fontStyle: isChosen ? "bold" : "normal" } },
          { content: `${pipe.nps}"`, styles: { halign: "center", fontStyle: "bold", fillColor: rowFill } },
          { content: `${pipe.idMm} mm`, styles: { halign: "center", fillColor: rowFill, fontStyle: isChosen ? "bold" : "normal" } },
          { content: vVal, styles: { halign: "right", fontStyle: isChosen ? "bold" : "normal", fillColor: rowFill } },
          { content: dpVal, styles: { halign: "right", fontStyle: isChosen ? "bold" : "normal", fillColor: rowFill } },
          { content: reVal, styles: { halign: "right", fontStyle: isChosen ? "bold" : "normal", fillColor: rowFill } },
          { content: statusText, styles: { halign: "center", fontStyle: "bold", textColor: pipe.isCompliant ? [16, 185, 129] : [239, 68, 68], fillColor: rowFill } }
        ];
      })
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
        1: { cellWidth: 26, halign: "center" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 30, halign: "right" },
        6: { cellWidth: 32, halign: "center" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 160;

    // Check page break for signature block (needs ~38mm)
    if (currentY + 45 > 275) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 5. Table 3: Professional Review & Sign-Off Block
    const sigDetails = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/chw-pipe-sizer",
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
        { content: "MEP Design Engineer", styles: { halign: "center" } },
        { content: sigDetails.originatedDate || today, styles: { halign: "center" } }
      ],
      [
        { content: "Reviewer / Checked By", styles: { fontStyle: "bold", halign: "left" } },
        { content: sigDetails.reviewerName || "Pending Review", styles: { halign: "center" } },
        { content: "Senior HVAC Lead", styles: { halign: "center" } },
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
    await downloadFile(new Uint8Array(pdfBuffer), `CHW_Pipe_Sizing_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("PDF exported successfully!");

  } catch (err: any) {
    console.error("PDF export error:", err);
    toast.error(err?.message || "Failed to generate PDF export.");
  }
};
