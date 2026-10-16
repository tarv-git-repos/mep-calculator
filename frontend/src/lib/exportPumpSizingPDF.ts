import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";

export interface PumpSizingPDFInputs {
  pumpType: "booster" | "transfer" | "transfer-booster";
  wsfuVal: string;
  manualFlow: string;
  reqVolume: string;
  fillTime: string;
  workingPumps: string;
  standbyPumps: string;
  fricFactor: string;
  pipeVert: string;
  pipeHoriz: string;
  filtCarbon: boolean;
  filtMM: boolean;
  filtCuAg: boolean;
  filtSoftener: boolean;
  staticHead: string;
  presidHead: string;
  suctionHead: string;
  sfHead: string;
  effPump: string;
  effMotor: string;
}

export interface PumpSizingPDFResults {
  elbows: number;
  valves: number;
  totalLen: number;
  equivLen: number;
  frictionLoss: number;
  filterLoss: number;
  calcHead: number;
  selectedHead: number;
  flowLps: number;
  liftKpa: number;
  shaftPower: number;
  motorPower: number;
  hp: number;
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
  includeStamp?: boolean;
  returnBuffer?: boolean;
  reviewState?: any;
}

export const exportPumpSizingPDF = async (
  inputs: PumpSizingPDFInputs,
  results: PumpSizingPDFResults,
  unitSystem: "si" | "ip" = "si",
  meta: ProjectMetaData = {}
): Promise<Uint8Array | boolean | void> => {
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-PMP-R01";
    const revNo = meta.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Domestic Water Pump Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    const isSI = unitSystem === "si";
    const primaryFill: [number, number, number] = [217, 217, 217]; // Uniform gray #D9D9D9 (Matching Ventilation)
    const blueFill: [number, number, number] = [218, 233, 248];    // Soft Blue highlight #DAE9F8 (Matching Ventilation)

    // 1. Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Pump Sizing Calculation Report", 14, 14);

    // 2. Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
    doc.setFontSize(8.5);
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 100, 100);
    doc.rect(14, 18, 182, 18); // Outer box for metadata

    // Vertical lines
    doc.line(105, 18, 105, 36);
    doc.line(155, 18, 155, 24);

    // Horizontal lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Rev No.:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(revNo, 122, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 157, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 167, 22);

    // Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    // Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    const pumpTypeLabel =
      inputs.pumpType === "booster"
        ? "Domestic Booster Pump Station"
        : inputs.pumpType === "transfer"
        ? "Roof Tank Transfer Pump"
        : "Dual Booster / Transfer System";

    const flowDisp = isSI
      ? `${results.flowLps.toFixed(2)}`
      : `${(results.flowLps * 15.8503).toFixed(2)}`;
    const flowUnit = isSI ? "L/s" : "GPM";

    const headDisp = isSI
      ? `${results.calcHead.toFixed(2)}`
      : `${(results.calcHead * 14.5038).toFixed(2)}`;
    const headUnit = isSI ? "bar" : "psi";

    // 3. Table 1: Executive Design Parameters & Pump Duty Summary
    const summaryRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Executive Design Parameter Summary", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Design Basis / Code", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Pump Application Type", pumpTypeLabel, "-", "Domestic Water Distribution System"],
      ["2", "Pump Station Configuration", `${inputs.workingPumps}W + ${inputs.standbyPumps}S`, "units", "Standard N+1 duty and standby arrangement"],
      inputs.pumpType === "transfer"
        ? ["3", "Storage Tank Volume & Fill Time", `${inputs.reqVolume} L in ${inputs.fillTime} hrs`, "L / hr", "Storage refill duty cycle"]
        : ["3", "Water Supply Fixture Units (WSFU)", `${inputs.wsfuVal || "-"}`, "WSFU", "IPC Table 604.3 / Hunter's Curve demand"],
      [
        { content: "4", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Design Flow Rate per Pump (Q)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: flowDisp, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: flowUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Peak simultaneous demand flow requirement", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "5", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Calculated Total Dynamic Head (TDH)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: headDisp, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: headUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: `Static head + friction + residual pressure + ${inputs.sfHead}% margin`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ],
      [
        { content: "6", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Estimated Motor Rating Demand", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.motorPower.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "kW", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: `Equivalent: ${results.hp.toFixed(2)} HP (Pump η: ${inputs.effPump}%, Motor η: ${inputs.effMotor}%)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
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
        cellPadding: { top: 2.0, bottom: 2.0, left: 2.0, right: 2.0 },
        minCellHeight: 5.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 80;

    // 4. Table 2: Detailed Hydraulic Piping & Friction Loss Schedule
    const pipeVertDisp = isSI ? `${inputs.pipeVert}` : `${inputs.pipeVert}`;
    const pipeHorizDisp = isSI ? `${inputs.pipeHoriz}` : `${inputs.pipeHoriz}`;
    const lenUnit = isSI ? "m" : "ft";

    const pipingRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Piping & Hydraulic Loss Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Calculation Basis", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Vertical Pipe Height (Riser Lift)", pipeVertDisp, lenUnit, "Geometric vertical lift to highest fixture / roof tank"],
      ["2", "Horizontal Pipe Distribution Run", pipeHorizDisp, lenUnit, "Horizontal distribution header and branch length"],
      ["3", "Fittings & Valves Equivalent Allowance", `${(results.elbows + results.valves).toFixed(1)}`, lenUnit, "30% elbows + 30% valves standard empirical allowance"],
      ["4", "Total Equivalent Pipe Length (L_equiv)", `${results.equivLen.toFixed(1)}`, lenUnit, "Developed length with 5% safety margin rounded to 10m"],
      ["5", "Unit Friction Factor (Loss / 100m)", `${inputs.fricFactor}`, isSI ? "bar/100m" : "psi/100ft", "Hazen-Williams / Darcy-Weisbach standard friction loss rate"],
      ["6", "Calculated Pipe Friction Loss", isSI ? `${results.frictionLoss.toFixed(3)}` : `${(results.frictionLoss * 14.5038).toFixed(3)}`, isSI ? "bar" : "psi", "L_equiv * (Friction Factor / 100)"],
      ["7", "Water Filtration & Treatment Loss", isSI ? `${results.filterLoss.toFixed(2)}` : `${(results.filterLoss * 14.5038).toFixed(2)}`, isSI ? "bar" : "psi", "Active carbon / sand / softener / Cu-Ag ionization filter head loss"]
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: pipingRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 2.0, right: 2.0 },
        minCellHeight: 5.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 135;

    // 5. Table 3: Pressure Head Components & Total Dynamic Head (TDH)
    const headRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Head & Pressure Component", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "System Pressure Basis", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Static Elevation Head (H_static)", `${inputs.staticHead}`, isSI ? "bar" : "psi", "Building elevation height differential"],
      ["2", "Residual Terminal Pressure (P_res)", `${inputs.presidHead}`, isSI ? "bar" : "psi", "Minimum required pressure at remotest outlet fixture"],
      ["3", "Suction Tank Inflow / Head Credit (H_suct)", `${inputs.suctionHead}`, isSI ? "bar" : "psi", "Positive suction head from elevated supply reservoir"],
      ["4", "Aging & Fouling Safety Margin", `${inputs.sfHead}`, "%", "Engineering contingency margin"],
      [
        { content: "5", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Total Dynamic Calculation Head (TDH)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: headDisp, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: headUnit, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "((H_fric + H_static + P_res) - H_suct + H_filt) * (1 + Safety Margin)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: headRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 2.0, right: 2.0 },
        minCellHeight: 5.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 62, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 68, halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 180;

    // Check page break for Motor Power & Signature Block
    if (currentY + 65 > 275) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 6. Table 4: Motor & Energy Power Analysis
    const motorRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Power & Efficiency Parameter", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Efficiency & Mechanical Rating", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Hydraulic Lift Pressure Differential", `${results.liftKpa.toFixed(1)}`, "kPa", "Calculated pressure differential = TDH * 100"],
      ["2", "Pump Hydraulic Efficiency (η_pump)", `${inputs.effPump}`, "%", "Centrifugal pump hydraulic efficiency curve"],
      ["3", "Calculated Shaft Power (P_shaft)", `${results.shaftPower.toFixed(2)}`, "kW", "P_shaft = (Q * ΔP) / (1000 * η_pump)"],
      ["4", "Electric Motor Efficiency (η_motor)", `${inputs.effMotor}`, "%", "IEC Premium Efficiency (IE3 / IE4) induction motor"],
      [
        { content: "5", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Required Motor Power (P_motor)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${results.motorPower.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "kW", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: `P_motor = P_shaft / η_motor (${results.hp.toFixed(2)} HP duty)`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      body: motorRows,
      pageBreak: "avoid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 2.0, right: 2.0 },
        minCellHeight: 5.5
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

    // 7. Professional Review & Sign-Off Block
    const sigDetails = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/plumbing-pump-sizing",
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

    if (meta.includeStamp !== false) {
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
    }

    const pdfBuffer = doc.output("arraybuffer");
    if (meta.returnBuffer) {
      return new Uint8Array(pdfBuffer);
    }

    await downloadFile(new Uint8Array(pdfBuffer), `Pump_Sizing_Calculation_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("PDF exported successfully!");
    return true;

  } catch (err: any) {
    console.error("PDF export error:", err);
    if (!meta.returnBuffer) {
      toast.error(err?.message || "Failed to generate PDF export.");
    }
    return false;
  }
};
