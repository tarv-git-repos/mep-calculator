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
    doc.text("Cooling Coil Condensate Calculation", 14, 15);

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
      totalCondDisplay,
    ]);

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        [
          "Sr. No.",
          "Unit",
          `Air Flow\n(${uFlow})`,
          `On-Coil DB/WB\n(${uTemp})`,
          `Off-Coil DB/WB\n(${uTemp})`,
          "ΔW\n(kg/kg)",
          `Condensate\n(${uCond})`,
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
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 36, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 34, halign: "center" },
        4: { cellWidth: 34, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [218, 233, 248]; // #DAE9F8
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY + 5 || currentY + 45;

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
