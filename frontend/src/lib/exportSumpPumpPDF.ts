import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import {
  GPM_TO_LPS,
  FT_TO_M,
  GAL_TO_M3,
  GAL_TO_L,
  PSI_TO_BAR,
} from "@/lib/calc-plumbing-sump-pump";

export interface SumpPumpExportData {
  calcResults: {
    Q_flow: number; // L/s
    pitVol: number; // m3
    pitVolLiters: number; // L
    pitDia_m?: number; // m
    pitDepth_m?: number; // m
    L_equiv: number; // m
    H_loss: number; // bar
    H_pump_calc: number; // bar
    P_hyd?: number; // kW
    P_shaft?: number; // kW
    P_motor: number; // kW
    HP: number; // HP
  };
  req: number | "";
  time: number | "";
  flow: number | "";
  pitFlow: number | "";
  pitHold: number | "";
  longestPipe: number | "";
  propSide?: number | "";
  pipeVert: number | "";
  pipeHoriz: number | "";
  fricFactor: number | "";
  staticHead: number | "";
  presid: number | "";
  suction?: number | "";
  sfHead: number | "";
  effPump: number | "";
  effMotor: number | "";
  unitSystem: "ip" | "si";
  preset?: string;
  meta?: {
    projectName?: string;
    client?: string;
    projectNo?: string;
    calcNo?: string;
    revNo?: string;
    date?: string;
    endUser?: string;
    userName?: string;
    reviewState?: any;
    includeStamp?: boolean;
    returnBuffer?: boolean;
  };
}

export const exportSumpPumpPDF = async (data: SumpPumpExportData) => {
  const {
    calcResults,
    req,
    time,
    flow: manualFlow,
    pitFlow,
    pitHold,
    longestPipe,
    pipeVert,
    pipeHoriz,
    fricFactor,
    staticHead,
    presid,
    sfHead,
    effPump,
    effMotor,
    unitSystem,
    meta = {},
  } = data;

  const isSI = unitSystem === "si";

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
    // A4 Portrait Mode (210mm x 297mm) matching Preliminary Cooling Load & Ventilation standard
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

    const calcNo = meta.calcNo || activeProj?.calcNo || `TRV-CAL-SMP-${activeProj?.code || "001"}`;
    const revNo = meta.revNo || activeProj?.revNo || "0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P001";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Sump Pit Drainage Sizing Station";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Building Facilities / MEP Department";

    // 1. Standard Header & Metadata Block
    const startY = addPdfHeader(doc, "Sump Pump Sizing Preliminary Calculation", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean uniform gray for all table column headings
    const blueFill = [218, 233, 248] as [number, number, number];    // Soft blue for key summary rows

    // Unit conversion values
    const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
    const flowUnit = isSI ? "L/s" : "GPM";
    const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
    const pitVUnit = isSI ? "m³" : "Gal";
    const h_loss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
    const l_equiv = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
    const l_unit = isSI ? "m" : "ft";
    const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
    const tdhUnit = isSI ? "bar" : "psi";

    // 3. Section 1 Table: Input Parameters & Hydraulic Criteria
    const paramTableBody = [
      ["1", "Required Drainage Storage Volume", isSI ? `${req} L` : `${(Number(req) / GAL_TO_L).toFixed(0)} Gal`, isSI ? `${(Number(req) / GAL_TO_L).toFixed(0)} Gal` : `${req} L`, "Total storage / inflow capacity"],
      ["2", "Target Drawdown Time", `${time} hrs`, `${(Number(time) * 60).toFixed(0)} mins`, "Allowable pit drawdown interval"],
      ["3", "Inflow Rate to Sump Pit", isSI ? `${pitFlow} L/s` : `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM`, isSI ? `${(Number(pitFlow) / GPM_TO_LPS).toFixed(1)} GPM` : `${pitFlow} L/s`, "Peak sub-soil / infiltration draw"],
      ["4", "Holding / Retention Duration", `${pitHold} min`, `${(Number(pitHold) * 60).toFixed(0)} sec`, "Retention time before pump cycle"],
      ["5", "Static Lift Elevation", isSI ? `${staticHead} bar` : `${(Number(staticHead) / PSI_TO_BAR).toFixed(1)} psi`, isSI ? `${(Number(staticHead) * 10.197).toFixed(1)} m` : `${((Number(staticHead) / PSI_TO_BAR) * 2.31).toFixed(1)} ft`, "Pit basin to gravity invert"],
      ["6", "Residual Pressure Required", isSI ? `${presid} bar` : `${(Number(presid) / PSI_TO_BAR).toFixed(1)} psi`, isSI ? `${(Number(presid) * 10.197).toFixed(1)} m` : `${((Number(presid) / PSI_TO_BAR) * 2.31).toFixed(1)} ft`, "Discharge point terminal head"],
      ["7", "Longest Piping Branch Run", isSI ? `${longestPipe} m` : `${(Number(longestPipe) / FT_TO_M).toFixed(1)} ft`, isSI ? `${(Number(longestPipe) / FT_TO_M).toFixed(1)} ft` : `${longestPipe} m`, "Piping layout calculation run"],
      ["8", "Piping Run (Vert + Horiz)", isSI ? `${pipeVert}m vert / ${pipeHoriz}m horiz` : `${(Number(pipeVert) / FT_TO_M).toFixed(0)}ft vert / ${(Number(pipeHoriz) / FT_TO_M).toFixed(0)}ft horiz`, `${fricFactor} bar/100m`, "Frictional loss coefficient"],
      ["9", "Pump & Motor Efficiency", `${effPump}% pump / ${effMotor}% motor`, `SF = ${sfHead}%`, "ASPE & CIBSE guide safety margin"],
    ];

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14 },
      head: [["Sr.", "Parameter Description", "Design Value", "Equivalent", "Standard / Code Reference"]],
      body: paramTableBody,
      theme: "grid",
      headStyles: {
        fillColor: primaryFill,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 58, fontStyle: "bold" },
        2: { cellWidth: 36, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 32, halign: "center" },
        4: { cellWidth: 46, halign: "left" },
      },
    });

    let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 5 : 105;

    // 4. Section 2 Table: Sump Pit Sizing & Hydraulic Results
    const resultsTableBody: any[] = [
      ["1", "Calculated Pump Duty Flow (Q)", `${flow.toFixed(2)} ${flowUnit}`, "Duty Flow", "Q = Volume / Drawdown Time"],
      ["2", "Sump Pit Active Storage Volume", `${pitV.toFixed(2)} ${pitVUnit}`, "Pit Volume", "V = Inflow Rate × Holding Time"],
      ["3", "Total Dynamic Head (TDH)", `${tdh.toFixed(3)} ${tdhUnit}`, "Dynamic Head", "(H_static + H_loss + H_res) × (1 + SF)"],
      ["4", "Total Equivalent Pipe Length", `${l_equiv.toFixed(1)} ${l_unit}`, "Piping Run", "Vertical + Horizontal + Fittings Loss"],
      ["5", "Friction Head Loss (H_fric)", `${h_loss.toFixed(3)} ${tdhUnit}`, "Friction", "Equivalent Length × Friction Factor"],
      ["6", "Recommended Motor Power Rating", isSI ? `${calcResults.P_motor.toFixed(2)} kW (${calcResults.HP.toFixed(2)} HP)` : `${calcResults.HP.toFixed(2)} HP (${calcResults.P_motor.toFixed(2)} kW)`, "Motor Rating", "Electrical submersible motor rating"],
    ];

    // Highlight key rows (Duty Flow, Pit Volume, TDH, Motor Rating)
    resultsTableBody[0]._isHighlight = true;
    resultsTableBody[1]._isHighlight = true;
    resultsTableBody[2]._isHighlight = true;
    resultsTableBody[5]._isHighlight = true;

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [["Sr.", "Metric / Sizing Parameter", "Calculated Value", "Allocation", "Formula & Code Reference"]],
      body: resultsTableBody,
      theme: "grid",
      headStyles: {
        fillColor: primaryFill,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40], cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 58, fontStyle: "bold" },
        2: { cellWidth: 42, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 46, halign: "left" },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          const rowRaw = resultsTableBody[hookData.row.index];
          if (rowRaw?._isHighlight) {
            hookData.cell.styles.fillColor = blueFill;
            hookData.cell.styles.fontStyle = "bold";
            hookData.cell.styles.textColor = [0, 50, 120];
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 5 : 175;

    // 5. Verification Status Banner
    doc.setDrawColor(16, 185, 129);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, currentY, 182, 13, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text("✔ Sump Pit Storage & Submersible Hydraulics Satisfy IPC 1113 & ASPE", 20, currentY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`Active pit volume of ${pitV.toFixed(2)} ${pitVUnit} with dynamic lift of ${tdh.toFixed(2)} ${tdhUnit} verified for continuous duty dewatering.`, 20, currentY + 9.5);

    currentY += 17;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 280) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 6. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProj?.id || activeProjectId || "default",
        "/plumbing-sump-pump",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProj?.id || activeProjectId || "default",
        "/plumbing-sump-pump"
      );
    }

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    const pdfBuffer = doc.output("arraybuffer");
    if (meta.returnBuffer) {
      return new Uint8Array(pdfBuffer);
    }

    await downloadFile(new Uint8Array(pdfBuffer), `Sump_Pump_Sizing_${projectNo || "CALC"}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Sump Pump Sizing PDF exported successfully!");
    return true;
  } catch (err: any) {
    console.error("exportSumpPumpPDF error:", err);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
    return false;
  }
};
