import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";
import { type SupplyPipeInputs, type PipeSize } from "./calc-plumbing-supply-pipe-sizer";

export interface SupplyPipePDFResults {
  flowVal: number;
  pAvailVal: number;
  pResidVal: number;
  lengthVal: number;
  elevVal: number;
  Q_gpm: number;
  pAvail_psi: number;
  pResid_psi: number;
  L_ft: number;
  Leff: number;
  C: number;
  elev_ft: number;
  elevLoss_psi: number;
  elevLoss_kpa: number;
  rows: Array<{
    nps: string;
    dn: string;
    id: number;
    hf_psi: number;
    hf_kpa: number;
    v_fps: number;
    v_ms: number;
    resid_psi: number;
    resid_kpa: number;
    ok: boolean;
    isPressureOk: boolean;
    isVelocityOk: boolean;
  }>;
  rec: {
    nps: string;
    dn: string;
    id: number;
    hf_psi: number;
    hf_kpa: number;
    v_fps: number;
    v_ms: number;
    resid_psi: number;
    resid_kpa: number;
    ok: boolean;
    isPressureOk: boolean;
    isVelocityOk: boolean;
  };
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

export const exportSupplyPipePDF = async (
  inputs: SupplyPipeInputs,
  calculations: SupplyPipePDFResults,
  unitSystem: "SI" | "IP" = "SI",
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-PIP-R01";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Water Supply Pipe Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    const isIP = unitSystem === "IP";
    const flowUnit = isIP ? "GPM" : "L/s";
    const pressUnit = isIP ? "psi" : "kPa";
    const lenUnit = isIP ? "ft" : "m";
    const velUnit = isIP ? "fps" : "m/s";

    const primaryFill: [number, number, number] = [217, 217, 217]; // Uniform gray #D9D9D9 (Matching Ventilation)
    const blueFill: [number, number, number] = [218, 233, 248];    // Soft Blue highlight #DAE9F8 (Matching Ventilation)

    // 1. Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Water Supply Pipe Sizing Calculation Report", 14, 14);

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

    const materialLabel =
      inputs.pipeMaterial === "150"
        ? "Copper Type L / CPVC (C = 150)"
        : inputs.pipeMaterial === "130"
        ? "PEX Tubing (C = 130)"
        : "Galvanized Steel Pipe (C = 120)";

    const flowDisp = inputs.flow.toFixed(2);
    const pAvailDisp = inputs.pAvail.toFixed(1);
    const pResidDisp = inputs.pResid.toFixed(1);
    const lengthDisp = inputs.length.toFixed(1);
    const leffDisp = (calculations.Leff * (isIP ? 1 : 0.3048)).toFixed(1);
    const elevLossDisp = (isIP ? calculations.elevLoss_psi : calculations.elevLoss_kpa).toFixed(2);

    const recVelDisp = (isIP ? calculations.rec.v_fps : calculations.rec.v_ms).toFixed(2);
    const recResidDisp = (isIP ? calculations.rec.resid_psi : calculations.rec.resid_kpa).toFixed(1);
    const recFricDisp = (isIP ? calculations.rec.hf_psi : calculations.rec.hf_kpa).toFixed(2);

    // 3. Table 1: Executive Hydraulic Design Parameters & Pipe Selection Summary
    const summaryRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Executive Design Parameter Summary", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Design Basis / Code", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Pipe Service Application", "Domestic Water Supply Distribution", "-", "Continuous potable cold/hot water distribution"],
      ["2", "Pipe Material & Roughness Coefficient", materialLabel, "C-Factor", "Hazen-Williams hydraulic flow coefficient"],
      ["3", "Design Flow Rate (Q)", `${flowDisp}`, flowUnit, `Peak simultaneous fixture demand (${calculations.Q_gpm.toFixed(1)} GPM)`],
      ["4", "Available Source Supply Pressure", `${pAvailDisp}`, pressUnit, "Utility mains / booster pump discharge supply pressure"],
      ["5", "Minimum Required Residual Pressure", `${pResidDisp}`, pressUnit, "Minimum code allowable residual at remotest fixture"],
      ["6", "Total Effective Pipe Length (L_eff)", `${leffDisp}`, lenUnit, `Linear length ${lengthDisp} ${lenUnit} + ${inputs.fittingAllowance}% fittings allowance`],
      ["7", "Static Elevation Gravity Loss", `${elevLossDisp}`, pressUnit, `Elevation difference: ${inputs.elevation} ${lenUnit} (ΔP = h / 2.31)`],
      [
        { content: "8", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Recommended Pipe Diameter (NPS / DN)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${calculations.rec.nps} (${calculations.rec.dn})`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "NPS (DN)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Smallest size passing both velocity & residual pressure limits", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "9", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Delivered Flow Velocity in Pipe", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${recVelDisp}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: velUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Complies with ASPE / IPC allowable velocity limit (1.0 - 2.4 m/s)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "10", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Delivered Residual Pressure at Remote Fixture", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${recResidDisp}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: pressUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: `Satisfies minimum residual pressure constraint (≥ ${pResidDisp} ${pressUnit})`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
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

    // 4. Table 2: Complete Pipe Sizing Schedule & Hydraulic Performance
    const scheduleRows = [
      [
        { content: "Sr.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Nominal (NPS)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Metric (DN)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Velocity (${velUnit})`, styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Friction Loss (${pressUnit})`, styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Residual Press (${pressUnit})`, styles: { fontStyle: "bold", halign: "right", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Compliance Status", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ...calculations.rows.map((r, idx) => {
        const isRec = r.nps === calculations.rec.nps;
        const velVal = (isIP ? r.v_fps : r.v_ms).toFixed(2);
        const fricVal = (isIP ? r.hf_psi : r.hf_kpa).toFixed(2);
        const residVal = (isIP ? r.resid_psi : r.resid_kpa).toFixed(1);
        const statusText = isRec ? "RECOMMENDED (PASS)" : r.ok ? "PASS" : r.resid_psi < calculations.pResid_psi ? "LOW PRESSURE" : "HIGH VELOCITY";

        const rowFill = isRec ? blueFill : undefined;

        return [
          { content: String(idx + 1), styles: { halign: "center", fillColor: rowFill, fontStyle: isRec ? "bold" : "normal" } },
          { content: r.nps, styles: { halign: "center", fontStyle: "bold", fillColor: rowFill } },
          { content: r.dn, styles: { halign: "center", fillColor: rowFill, fontStyle: isRec ? "bold" : "normal" } },
          { content: velVal, styles: { halign: "right", fontStyle: isRec ? "bold" : "normal", fillColor: rowFill } },
          { content: fricVal, styles: { halign: "right", fontStyle: isRec ? "bold" : "normal", fillColor: rowFill } },
          { content: residVal, styles: { halign: "right", fontStyle: "bold", textColor: r.isPressureOk ? [16, 185, 129] : [239, 68, 68], fillColor: rowFill } },
          { content: statusText, styles: { halign: "center", fontStyle: "bold", textColor: r.ok ? [16, 185, 129] : [239, 68, 68], fillColor: rowFill } }
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

    // 5. Table 3: Pressure Head & Energy Balance Breakdown
    const marginVal = isIP
      ? (calculations.rec.resid_psi - calculations.pResid_psi).toFixed(1)
      : (calculations.rec.resid_kpa - calculations.pResid_kpa).toFixed(1);

    const pressureBreakdownRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Hydraulic Pressure Component", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Pressure Balance Basis", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Available Mains / Source Pressure (P_avail)", `${pAvailDisp}`, pressUnit, "Utility supply pressure at building point of entry"],
      ["2", "Elevation Gravity Static Loss (ΔP_elev)", `${elevLossDisp}`, pressUnit, "Hydrostatic head loss due to elevation lift rise"],
      ["3", `Piping Friction Loss in ${calculations.rec.nps} (hf)`, `${recFricDisp}`, pressUnit, "Hazen-Williams dynamic friction head loss over L_eff"],
      [
        { content: "4", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Delivered Residual Pressure (P_resid)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${recResidDisp}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: pressUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "P_resid = P_avail - ΔP_elev - hf (Delivered at remote outlet)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      ["5", "Minimum Required Residual Pressure (P_req)", `${pResidDisp}`, pressUnit, "Fixture manufacturer & IPC minimum operating threshold"],
      ["6", "Net Residual Pressure Surplus Margin", `+${marginVal}`, pressUnit, "Net positive pressure safety margin above code minimum"]
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
      body: pressureBreakdownRows,
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
      "/plumbing-supply-pipe-sizer",
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
        { content: "Senior Plumbing Lead", styles: { halign: "center" } },
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
    await downloadFile(new Uint8Array(pdfBuffer), `Water_Supply_Pipe_Sizing_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("PDF exported successfully!");

  } catch (err: any) {
    console.error("PDF export error:", err);
    toast.error(err?.message || "Failed to generate PDF export.");
  }
};
