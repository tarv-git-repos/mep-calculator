import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { lpsToGpm, cfmToLps, lpsToCfm, fToC } from "@/utils/conversions";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

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
  try {
    const activeProj: any = workspaceStore.getState()?.project || {};
    const isIP = meta.unitSystem === "ip";
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

    const calcNo = meta.calcNo || activeProj?.calcNo || `TRV-CAL-CCD-${(activeProjectId || "0000").slice(-4).toUpperCase()}`;
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    const uTemp = isIP ? "deg F" : "deg C";
    const uFlow = isIP ? "CFM" : "L/s";
    const uCond = isIP ? "GPM" : "L/s";

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Cooling Coil Condensate Calculation Report", 14, 15);

    // Title underline
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.line(14, 18, 196, 18);

    // Metadata Table (2 columns x 3 rows)
    const metaBody = [
      [
        { content: "Calculation No.:", styles: { fontStyle: "bold" as const, cellWidth: 32 } },
        { content: calcNo, styles: { cellWidth: 60 } },
        { content: "Date:", styles: { fontStyle: "bold" as const, cellWidth: 24 } },
        { content: today, styles: { cellWidth: 66 } },
      ],
      [
        { content: "Project No.:", styles: { fontStyle: "bold" as const } },
        { content: projectNo },
        { content: "Client:", styles: { fontStyle: "bold" as const } },
        { content: clientName },
      ],
      [
        { content: "Project Name:", styles: { fontStyle: "bold" as const } },
        { content: projectName },
        { content: "End User:", styles: { fontStyle: "bold" as const } },
        { content: endUser },
      ],
    ];

    callAutoTable(doc, {
      startY: 21,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        textColor: [30, 30, 30],
        cellPadding: 1.4,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
      },
      body: metaBody,
    });

    let currentY = (doc as any).lastAutoTable?.finalY + 4 || 44;

    // Sizing and totals
    const totalFlow = rows.reduce((a, b) => a + (b.flow || 0), 0);
    const totalCondLps = rows.reduce((a, b) => a + (b.condFlow || 0), 0);
    const totalCondGpm = lpsToGpm(totalCondLps);
    const totalCondLhr = totalCondLps * 3600;

    // Recommended pipe diameter per IPC Table 307.2.2
    let recPipeMm = "20 mm";
    let recPipeInch = '3/4"';
    let recPipeDn = "DN20";
    if (totalCondGpm > 6.00) {
      recPipeMm = "80 mm"; recPipeInch = '3"'; recPipeDn = "DN80";
    } else if (totalCondGpm > 3.00) {
      recPipeMm = "65 mm"; recPipeInch = '2-1/2"'; recPipeDn = "DN65";
    } else if (totalCondGpm > 1.20) {
      recPipeMm = "50 mm"; recPipeInch = '2"'; recPipeDn = "DN50";
    } else if (totalCondGpm > 0.50) {
      recPipeMm = "40 mm"; recPipeInch = '1-1/2"'; recPipeDn = "DN40";
    } else if (totalCondGpm > 0.20) {
      recPipeMm = "32 mm"; recPipeInch = '1-1/4"'; recPipeDn = "DN32";
    } else if (totalCondGpm > 0.05) {
      recPipeMm = "25 mm"; recPipeInch = '1"'; recPipeDn = "DN25";
    }

    // Recommended trap depth: min 50 mm (2 in) + ESP allowance (typ 25-50 mm)
    const trapDepthMm = "75 mm";
    const trapDepthIn = "3.0 in";

    // Table 1: Coil Condensate Schedule
    const tableBody = rows.map((r, idx) => {
      const condVal = isIP ? lpsToGpm(r.condFlow || 0).toFixed(4) : (r.condFlow || 0).toFixed(4);
      const dw = Math.max(0, (r.wIn || 0) - (r.wOut || 0));
      return [
        (idx + 1).toString(),
        r.name || `Coil-${idx + 1}`,
        r.flow.toLocaleString(),
        `${r.dbIn.toFixed(1)} / ${r.wbIn.toFixed(1)}`,
        `${r.dbOut.toFixed(1)} / ${r.wbOut.toFixed(1)}`,
        (r.wIn || 0).toFixed(5),
        (r.wOut || 0).toFixed(5),
        dw.toFixed(5),
        condVal,
      ];
    });

    const totalCondDisplay = isIP ? totalCondGpm.toFixed(4) : totalCondLps.toFixed(4);

    tableBody.push([
      "TOTAL",
      `${rows.length} Units`,
      totalFlow.toLocaleString(),
      "-",
      "-",
      "-",
      "-",
      "-",
      totalCondDisplay,
    ]);

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        [
          "Sr.",
          "Unit Ref",
          `Air Flow (${uFlow})`,
          `On-Coil DB/WB (${uTemp})`,
          `Off-Coil DB/WB (${uTemp})`,
          "W_in (kg/kg)",
          "W_out (kg/kg)",
          "dW (kg/kg)",
          `Condensate (${uCond})`,
        ],
      ],
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.1,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        valign: "middle",
        minCellHeight: 4.3,
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 28, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 22, halign: "right" },
        3: { cellWidth: 28, halign: "center" },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 16, halign: "right" },
        8: { cellWidth: 18, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [218, 233, 248]; // #DAE9F8
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 3.5 || currentY + 45;

    // Table 2: Aggregate Condensate Drainage Summary & Sizing Guidance
    const summaryBody = [
      [
        "1",
        "Total Active Cooling Coils",
        "Quantity",
        `${rows.length} Units`,
        "units",
        "Total scheduled cooling units contributing to drain header",
      ],
      [
        "2",
        "Aggregate Airflow Volume",
        "Sum(Airflow)",
        totalFlow.toLocaleString(),
        uFlow,
        "Total processed supply air across all cooling coils",
      ],
      [
        "3",
        "TOTAL AGGREGATE CONDENSATE FLOW",
        "Sum(m_dot_air * dW)",
        isIP ? `${totalCondGpm.toFixed(4)} GPM (${totalCondLps.toFixed(4)} L/s)` : `${totalCondLps.toFixed(4)} L/s (${totalCondGpm.toFixed(4)} GPM)`,
        isIP ? "GPM" : "L/s",
        `Equivalent to ${totalCondLhr.toFixed(2)} L/hr moisture removal rate`,
      ],
      [
        "4",
        "Recommended Drain Header Pipe Size",
        "IPC 307.2.2 / ASHRAE",
        isIP ? `${recPipeInch} (${recPipeDn})` : `${recPipeDn} (${recPipeInch})`,
        isIP ? "inch" : "mm",
        `Gravity drainage sloped at min 1% (1/8 in/ft) to floor drain`,
      ],
      [
        "5",
        "Recommended Min P-Trap Seal Depth",
        "H = 1 in + Fan ESP",
        isIP ? trapDepthIn : trapDepthMm,
        isIP ? "in" : "mm",
        "Prevents air ingress/blowout and allows unhindered condensate drain",
      ],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        [
          "Sr.",
          "Drainage Sizing Parameter",
          "Governing Rule / Standard",
          "Calculated Value",
          "Unit",
          "Engineering Design Notes",
        ],
      ],
      body: summaryBody,
      theme: "grid",
      styles: {
        fontSize: 7,
        cellPadding: 1.1,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        valign: "middle",
        minCellHeight: 4.3,
      },
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 46, halign: "left" },
        2: { cellWidth: 32, halign: "left" },
        3: { cellWidth: 34, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 50, halign: "left" },
      },
      didParseCell: (data: any) => {
        // Highlight rows 3 & 4 in #DAE9F8
        if (data.section === "body" && (data.row.index === 2 || data.row.index === 3)) {
          data.cell.styles.fillColor = [218, 233, 248]; // #DAE9F8
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 3.5 || currentY + 35;

    // Table 3: 4-Column Signature Block (Designation, Originator, Reviewer, Approver)
    const sigDetails = getSignatureBlockDetails(activeProjectId, "/condensate-drain-calc");

    const sigBody = [
      [
        { content: "Name:", styles: { fontStyle: "bold" as const } },
        { content: sigDetails?.originator?.name || sigDetails?.originatedName || "-" },
        { content: sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-" },
        { content: sigDetails?.approver?.name || sigDetails?.approverName || "-" },
      ],
      [
        { content: "Date:", styles: { fontStyle: "bold" as const } },
        { content: sigDetails?.originator?.date || sigDetails?.originatedDate || "-" },
        { content: sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-" },
        { content: sigDetails?.approver?.date || sigDetails?.approverDate || "-" },
      ],
      [
        { content: "Signature:", styles: { fontStyle: "bold" as const } },
        { content: sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-") },
        { content: sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-") },
        { content: sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-") },
      ],
    ];

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        [
          { content: "Designation", styles: { halign: "center" as const } },
          { content: "Originator", styles: { halign: "center" as const } },
          { content: "Reviewer", styles: { halign: "center" as const } },
          { content: "Approver", styles: { halign: "center" as const } },
        ],
      ],
      body: sigBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        textColor: [30, 30, 30],
        cellPadding: 1.3,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        halign: "center",
        minCellHeight: 4.4,
      },
      headStyles: {
        fillColor: [255, 230, 204], // Standard #FFE6CC
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold", halign: "left" },
        1: { cellWidth: 51 },
        2: { cellWidth: 51 },
        3: { cellWidth: 52 },
      },
    });

    const pdfBlob = doc.output("blob");
    const projCode = projectNo || activeProj?.code || "P000";
    const fileName = `Coil_Condensate_Report_${projCode}.pdf`;
    downloadFile(pdfBlob, fileName, "application/pdf");
    toast.success("Condensate calculation PDF exported successfully!");
  } catch (error) {
    console.error("Failed to export PDF:", error);
    toast.error("Failed to generate calculation PDF report.");
  }
};
