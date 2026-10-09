import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { lpsToGpm, cfmToLps } from "@/utils/conversions";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

export interface CondensatePDFExportRow {
  id: string;
  name: string;
  dbIn: number | string;
  wbIn: number | string;
  dbOut: number | string;
  wbOut: number | string;
  flow: number | string;
  wIn?: number;
  wOut?: number;
  dw?: number;
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
  reviewState?: any;
}

export const exportCondensatePDF = async (
  rows: CondensatePDFExportRow[],
  meta: CondensatePDFMetaData = {}
) => {
  if (!rows || rows.length === 0) {
    toast.error("No coils available to export.");
    return;
  }

  let currentUserName = meta.userName || "Design Engineer";
  let activeProjectId = "default";
  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem("mep_user") || "{}");
      currentUserName = user.name || currentUserName;
      const ws = JSON.parse(localStorage.getItem("workspace-storage") || "{}");
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  try {
    const activeProj: any = workspaceStore.getState()?.project || {};
    const isIP = meta.unitSystem === "ip";
    const projId = activeProj?.id || activeProjectId || "default";

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    // A4 Portrait Mode (210mm x 297mm)
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

    const calcNo = meta.calcNo || activeProj?.calcNo || `TRV-CAL-CCD-${(projId || "0000").slice(-4).toUpperCase()}`;
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || (projId !== "default" ? projId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Coil Condensate Calculation";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    const uTemp = isIP ? "°C" : "°C"; // or °F for IP
    const uTempStr = isIP ? "°F" : "°C";
    const uFlow = isIP ? "CFM" : "L/s";
    const uCond = isIP ? "GPM" : "L/s";

    // 1. Header Title (Matching Preliminary & Ventilation Format - "Coil Condensate Calculation")
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("Coil Condensate Calculation", 14, 14);

    // 2. Metadata Block (Exact Preliminary & Ventilation 2-column x 3-row enclosed format: 182mm width)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 100, 100);
    doc.rect(14, 18, 182, 18); // Outer box (182mm width: 14 to 196mm)

    // Vertical line
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

    // Sizing and totals calculation
    let totalFlow = 0;
    let totalCondLps = 0;

    // Table 1: Coil Condensate Schedule & Psychrometric Data Body
    const tableBody: any[] = rows.map((r, idx) => {
      const numFlow = typeof r.flow === "number" ? r.flow : parseFloat(String(r.flow)) || 0;
      const numDbIn = typeof r.dbIn === "number" ? r.dbIn : parseFloat(String(r.dbIn));
      const numWbIn = typeof r.wbIn === "number" ? r.wbIn : parseFloat(String(r.wbIn));
      const numDbOut = typeof r.dbOut === "number" ? r.dbOut : parseFloat(String(r.dbOut));
      const numWbOut = typeof r.wbOut === "number" ? r.wbOut : parseFloat(String(r.wbOut));
      const numWIn = typeof r.wIn === "number" ? r.wIn : parseFloat(String(r.wIn));
      const numWOut = typeof r.wOut === "number" ? r.wOut : parseFloat(String(r.wOut));
      const numDw = typeof r.dw === "number" ? r.dw : (!isNaN(numWIn) && !isNaN(numWOut) ? Math.max(0, numWIn - numWOut) : 0);
      const numCond = typeof r.condFlow === "number" ? r.condFlow : parseFloat(String(r.condFlow)) || 0;

      totalFlow += numFlow;
      totalCondLps += numCond;

      const dbInStr = !isNaN(numDbIn) ? numDbIn.toFixed(1) : "-";
      const wbInStr = !isNaN(numWbIn) ? numWbIn.toFixed(1) : "-";
      const dbOutStr = !isNaN(numDbOut) ? numDbOut.toFixed(1) : "-";
      const wbOutStr = !isNaN(numWbOut) ? numWbOut.toFixed(1) : "-";
      const wInStr = !isNaN(numWIn) ? numWIn.toFixed(5) : "-";
      const wOutStr = !isNaN(numWOut) ? numWOut.toFixed(5) : "-";
      const dwStr = !isNaN(numDw) ? numDw.toFixed(5) : "-";
      const condValStr = isIP ? (!isNaN(numCond) ? lpsToGpm(numCond).toFixed(4) : "-") : (!isNaN(numCond) ? numCond.toFixed(4) : "-");

      return [
        (idx + 1).toString(),
        r.name || `Coil-${idx + 1}`,
        numFlow.toLocaleString(),
        `${dbInStr} / ${wbInStr}`,
        `${dbOutStr} / ${wbOutStr}`,
        wInStr,
        wOutStr,
        dwStr,
        condValStr,
      ];
    });

    const totalCondGpm = lpsToGpm(totalCondLps);
    const totalCondDisplay = isIP ? totalCondGpm.toFixed(4) : totalCondLps.toFixed(4);

    const totalRow = [
      "TOTAL",
      `${rows.length} Units`,
      totalFlow.toLocaleString(),
      "-",
      "-",
      "-",
      "-",
      "-",
      totalCondDisplay,
    ];
    (totalRow as any)._isTotal = true;
    tableBody.push(totalRow);

    // Standard Clean Gray Header Color #D9D9D9 [217, 217, 217]
    const primaryFill = [217, 217, 217] as [number, number, number];
    const blueFill = [218, 233, 248] as [number, number, number]; // Soft light blue #DAE9F8

    // Table 1: Render 2-tier header table (Exact 182mm width: 10 + 30 + 20 + 26 + 26 + 17 + 17 + 16 + 20 = 182)
    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        minCellHeight: 5.5,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 1.8, bottom: 1.8, left: 0.5, right: 0.5 },
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Equipment Parameters", colSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Psychrometric Design Conditions", colSpan: 4, styles: { fillColor: primaryFill } },
          { content: "Condensation Load Metrics", colSpan: 2, styles: { fillColor: primaryFill } },
        ],
        [
          { content: "Unit Ref / Tag" },
          { content: `Air Flow\n(${uFlow})` },
          { content: `Entering DB/WB\n(${uTempStr})` },
          { content: `Leaving DB/WB\n(${uTempStr})` },
          { content: "W_in\n(kg/kg)" },
          { content: "W_out\n(kg/kg)" },
          { content: "dW\n(kg/kg)" },
          { content: `Condensate Rate\n(${uCond})` },
        ],
      ],
      body: tableBody,
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 30, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 20, halign: "right" },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 26, halign: "center" },
        5: { cellWidth: 17, halign: "right" },
        6: { cellWidth: 17, halign: "right" },
        7: { cellWidth: 16, halign: "right" },
        8: { cellWidth: 20, halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = blueFill; // #DAE9F8 for Summary Total row
        }
      },
    });

    let currentY = (doc as any).lastAutoTable?.finalY + 5 || 120;

    // Recommended Pipe Sizing Calculation
    const getPipeRecommendation = (gpm: number) => {
      if (gpm <= 0.05) return { sizeMm: "20 mm", sizeInch: '3/4"', metricDn: "DN20", capacityGpm: "0.05 GPM" };
      if (gpm <= 0.20) return { sizeMm: "25 mm", sizeInch: '1"', metricDn: "DN25", capacityGpm: "0.20 GPM" };
      if (gpm <= 0.50) return { sizeMm: "32 mm", sizeInch: '1-1/4"', metricDn: "DN32", capacityGpm: "0.50 GPM" };
      if (gpm <= 1.20) return { sizeMm: "40 mm", sizeInch: '1-1/2"', metricDn: "DN40", capacityGpm: "1.20 GPM" };
      if (gpm <= 3.00) return { sizeMm: "50 mm", sizeInch: '2"', metricDn: "DN50", capacityGpm: "3.00 GPM" };
      if (gpm <= 6.00) return { sizeMm: "65 mm", sizeInch: '2-1/2"', metricDn: "DN65", capacityGpm: "6.00 GPM" };
      return { sizeMm: "80 mm", sizeInch: '3"', metricDn: "DN80", capacityGpm: ">6.00 GPM" };
    };

    const pipeRec = getPipeRecommendation(totalCondGpm);
    const totalLhr = totalCondLps * 3600;

    // Table 2: Aggregate Condensate Drainage Summary & Sizing Guidance (Exact 182mm width: 8 + 50 + 32 + 38 + 12 + 42 = 182)
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
        "Sum(m_air x dW)",
        isIP ? `${totalCondGpm.toFixed(4)} GPM (${totalCondLps.toFixed(4)} L/s)` : `${totalCondLps.toFixed(4)} L/s (${totalCondGpm.toFixed(4)} GPM)`,
        isIP ? "GPM" : "L/s",
        `Equivalent to ${totalLhr.toFixed(2)} L/hr moisture removal rate`,
      ],
      [
        "4",
        "Recommended Drain Header Pipe Size",
        "IPC 307.2.2 / ASHRAE",
        isIP ? `${pipeRec.sizeInch} (${pipeRec.metricDn})` : `${pipeRec.metricDn} (${pipeRec.sizeInch})`,
        isIP ? "inch" : "mm",
        "Gravity drainage sloped at min 1% (1/8 in/ft) to floor drain",
      ],
      [
        "5",
        "Recommended Min P-Trap Seal Depth",
        "H = 1 in + Fan ESP",
        isIP ? "3.0 in" : "75 mm",
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
        halign: "left",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
        minCellHeight: 5,
      },
      headStyles: {
        fillColor: primaryFill, // Standard clean gray #D9D9D9 - No heading highlighted in blue
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 50, fontStyle: "bold" },
        2: { cellWidth: 32 },
        3: { cellWidth: 38, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 42, fontSize: 6.5 },
      },
      didParseCell: (data: any) => {
        // Highlight logic following Ventilation & Preliminary rules:
        // No heading or description cell is highlighted.
        // Only the specific key output values (Column 3 for rows 3 & 4) receive the soft accent background.
        if (data.section === "body") {
          if ((data.row.index === 2 || data.row.index === 3) && data.column.index === 3) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill; // Highlight ONLY the calculated result value cell
          }
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 6 || currentY + 45;

    // Table 3: 4-Column Signature Block (Exact warm peach #FFE6CC header from Ventilation & Preliminary)
    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(projId, "/condensate-drain-calc", currentUserName, meta.reviewState);

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: [255, 230, 204], // Standard #FFE6CC peach
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
          { content: originatedName || currentUserName || "-", styles: { halign: "center" } },
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
    const projCode = projectNo || activeProj?.code || "P000";
    const fileName = `Coil_Condensate_Calculation_${projCode}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Coil Condensate calculation PDF exported successfully!");
  } catch (error: any) {
    console.error("exportCondensatePDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
