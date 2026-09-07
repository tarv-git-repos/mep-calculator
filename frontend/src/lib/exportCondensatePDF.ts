import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { lpsToGpm } from "@/utils/conversions";

export interface CondensatePDFExportRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
  wIn?: number;
  wOut?: number;
  condFlow?: number;
}

export interface CondensatePDFMetaData {
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

export const exportCondensatePDF = async (
  rows: CondensatePDFExportRow[],
  meta: CondensatePDFMetaData = {}
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
    const isIP = meta.unitSystem === "ip";

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    const doc = new JsPDFClass("landscape", "mm", "a4");

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

    const calcNo = meta.calcNo || activeProj?.calcNo || "CEC-MED-PXXX-114";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    const uTemp = isIP ? "°F" : "°C";
    const uFlow = isIP ? "CFM" : "L/s";
    const uCond = isIP ? "GPM" : "L/s";

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Coil Condensate Drainage Calculation Sheet", 14, 14);

    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 269, 18);

    doc.line(100, 18, 100, 36);
    doc.line(190, 18, 190, 36);

    doc.line(14, 24, 283, 24);
    doc.line(14, 30, 283, 30);

    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 46, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 102, 22);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 126, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 192, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 206, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 46, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 102, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 126, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Unit System:", 192, 28);
    doc.setFont("helvetica", "normal");
    doc.text(isIP ? "Imperial (IP)" : "Metric (SI)", 216, 28);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 46, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Revision:", 102, 34);
    doc.setFont("helvetica", "normal");
    doc.text(meta.revNo || "Rev.0", 126, 34);

    doc.setFont("helvetica", "bold");
    doc.text("Standard:", 192, 34);
    doc.setFont("helvetica", "normal");
    doc.text("ASHRAE / IPC Chapter 307", 212, 34);

    const tableBody = rows.map((r, idx) => {
      const condVal = isIP ? lpsToGpm(r.condFlow || 0).toFixed(4) : (r.condFlow || 0).toFixed(4);
      return [
        (idx + 1).toString(),
        r.name || `Coil-${idx + 1}`,
        `${r.dbIn.toFixed(1)} / ${r.wbIn.toFixed(1)} ${uTemp}`,
        `${r.dbOut.toFixed(1)} / ${r.wbOut.toFixed(1)} ${uTemp}`,
        r.flow.toLocaleString(),
        (r.wIn || 0).toFixed(6),
        (r.wOut || 0).toFixed(6),
        Math.max(0, (r.wIn || 0) - (r.wOut || 0)).toFixed(6),
        condVal,
      ];
    });

    const totalFlow = rows.reduce((a, b) => a + (b.flow || 0), 0);
    const totalCondLps = rows.reduce((a, b) => a + (b.condFlow || 0), 0);
    const totalCondDisplay = isIP ? lpsToGpm(totalCondLps).toFixed(4) : totalCondLps.toFixed(4);

    tableBody.push([
      "TOTAL",
      `${rows.length} Units`,
      "-",
      "-",
      totalFlow.toLocaleString(),
      "-",
      "-",
      "-",
      `${totalCondDisplay} ${uCond}`,
    ]);

    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      head: [
        [
          "S.No",
          "Unit Ref",
          `On Coil DB/WB (${uTemp})`,
          `Off Coil DB/WB (${uTemp})`,
          `Air Flow (${uFlow})`,
          "W_in (kg/kg)",
          "W_out (kg/kg)",
          "ΔW (kg/kg)",
          `Condensate Flow (${uCond})`,
        ]
      ],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: "linebreak",
        halign: "center",
      },
      headStyles: {
        fillColor: [10, 123, 199],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 38, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 26, halign: "right" },
        5: { cellWidth: 30, halign: "right" },
        6: { cellWidth: 30, halign: "right" },
        7: { cellWidth: 28, halign: "right" },
        8: { cellWidth: 33, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 245, 250];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    addPdfSignatureBlock(doc, finalY + 8, activeProjectId, "/condensate-drain-calc");

    const pdfBlob = doc.output("blob");
    const safeName = projectName ? projectName.replace(/[^a-zA-Z0-9_-]/g, "_") : "Condensate_Calculation";
    downloadFile(pdfBlob, `${safeName}_Condensate_Schedule.pdf`, "application/pdf");
    toast.success("Condensate calculation PDF exported successfully!");
  } catch (error) {
    console.error("Failed to export PDF:", error);
    toast.error("Failed to generate calculation PDF report.");
  }
};
