import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "./pdfHelpers";
import { toast } from "sonner";

export interface SanityCheckItem {
  label: string;
  value: string;
  status: "pass" | "warn";
  range: string;
  desc: string;
}

export interface SanityCheckPdfOptions {
  checks: SanityCheckItem[];
  unitSystem: "si" | "ip";
  meta?: {
    calcNo?: string;
    revNo?: string;
    projectNo?: string;
    projectName?: string;
    client?: string;
    endUser?: string;
    date?: string;
    userName?: string;
  };
}

export const exportSanityCheckPDF = async ({
  checks,
  unitSystem,
  meta = {}
}: SanityCheckPdfOptions) => {
  try {
    const activeProj: any = workspaceStore.getState()?.project || {};
    const activeProjectId = activeProj?.id || "default";

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

    const calcNo = meta.calcNo || activeProj?.calcNo || `TRV-CAL-SNT-${(activeProjectId || "0000").slice(-4).toUpperCase()}`;
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    // 1. Header Title (Matching Ventilation Standard)
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Engineering Sanity Check Report", 14, 13);

    // Title underline
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, 15.5, 196, 15.5);

    // 2. Metadata Table (Enclosed 3 rows x 2 cols grid)
    const metaBody = [
      [
        { content: "Calculation No.:", styles: { fontStyle: "bold" as const, cellWidth: 30 } },
        { content: calcNo, styles: { cellWidth: 62 } },
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
      startY: 18,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.2,
        textColor: [30, 30, 30],
        cellPadding: 1.1,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
      },
      body: metaBody,
    });

    const metaFinalY = (doc as any).lastAutoTable?.finalY ?? 36;

    // 3. Structured Summary & Audit Bar
    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.length - passCount;
    const unitLabel = unitSystem === "ip" ? "Imperial (IP)" : "Metric (SI)";

    callAutoTable(doc, {
      startY: metaFinalY + 3,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
        valign: "middle",
      },
      head: [
        [
          {
            content: "Standards: ASHRAE / SMACNA / Carrier",
            styles: { halign: "left", fontStyle: "bold", cellWidth: 72 },
          },
          {
            content: `Units: ${unitLabel}`,
            styles: { halign: "center", fontStyle: "bold", cellWidth: 38 },
          },
          {
            content: warnCount === 0
              ? `Audit: ${passCount}/${checks.length} Passed (All In-Range)`
              : `Audit: ${passCount} Passed | ${warnCount} Requires Review`,
            styles: {
              halign: "right",
              fontStyle: "bold",
              cellWidth: 72,
              textColor: warnCount === 0 ? [16, 120, 80] : [180, 83, 9],
            },
          },
        ],
      ],
      headStyles: {
        fillColor: [245, 247, 250],
        textColor: [30, 41, 59],
      },
    });

    const summaryFinalY = (doc as any).lastAutoTable?.finalY ?? 45;

    // 4. Main Table Data
    const tableBody = checks.map((c, idx) => {
      const isPass = c.status === "pass";
      return [
        (idx + 1).toString(),
        c.label,
        c.value,
        c.range,
        isPass ? "IN RANGE" : "CHECK VALUE",
        c.desc,
      ];
    });

    callAutoTable(doc, {
      startY: summaryFinalY + 3,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        cellPadding: 1.1,
        minCellHeight: 4.2,
      },
      headStyles: {
        fillColor: [217, 217, 217], // Standard #D9D9D9 grey
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 38, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 30, halign: "center" },
        4: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 52, halign: "left", fontSize: 6.5 },
      },
      head: [
        [
          { content: "Sr. No." },
          { content: "Design Parameter" },
          { content: "Design Value" },
          { content: "Standard Range" },
          { content: "Compliance" },
          { content: "Engineering Guideline / Reference" },
        ],
      ],
      body: tableBody,
      didParseCell: (dataCell: any) => {
        if (dataCell.section === "body") {
          // Status column (Col 4): subtle text color
          if (dataCell.column.index === 4) {
            const val = dataCell.cell.raw;
            if (val === "IN RANGE") {
              dataCell.cell.styles.textColor = [16, 120, 80];
            } else {
              dataCell.cell.styles.textColor = [180, 83, 9];
            }
          }
        }
      },
    });

    // 5. 4-Column Engineering Sign-off Block (Exact Ventilation Standard)
    const finalY = (doc as any).lastAutoTable?.finalY ?? 150;
    const sigDetails = getSignatureBlockDetails(activeProjectId, "/sanity-check-tool", meta.userName || "");

    callAutoTable(doc, {
      startY: finalY + 5,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.2,
        halign: "center",
        valign: "middle",
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
        cellPadding: 1.1,
        minCellHeight: 4.2,
      },
      headStyles: {
        fillColor: [255, 230, 204], // Standard #FFE6CC peach/orange
        textColor: [0, 0, 0],
        fontStyle: "bold",
      },
      head: [
        [
          { content: "Designation", styles: { halign: "left" } },
          { content: "Originator" },
          { content: "Reviewer" },
          { content: "Approver" },
        ],
      ],
      body: [
        [
          { content: "Name:", styles: { fontStyle: "bold", halign: "left" } },
          { content: sigDetails?.originator?.name || sigDetails?.originatedName || "-" },
          { content: sigDetails?.reviewer?.name || sigDetails?.reviewerName || "-" },
          { content: sigDetails?.approver?.name || sigDetails?.approverName || "-" },
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "left" } },
          { content: sigDetails?.originator?.date || sigDetails?.originatedDate || "-" },
          { content: sigDetails?.reviewer?.date || sigDetails?.reviewerDate || "-" },
          { content: sigDetails?.approver?.date || sigDetails?.approverDate || "-" },
        ],
        [
          { content: "Signature:", styles: { fontStyle: "bold", halign: "left" } },
          { content: sigDetails?.originator?.status || (sigDetails?.originatedName ? "Signed" : "-") },
          { content: sigDetails?.reviewer?.status || (sigDetails?.reviewerName ? "Reviewed" : "-") },
          { content: sigDetails?.approver?.status || (sigDetails?.approverName ? "Approved" : "-") },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold", halign: "left" },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
      },
    });

    // 6. Download PDF with standardized filename
    const pdfBlob = doc.output("blob");
    const safeProjectCode = activeProj?.code || projectNo || "P000";
    const fileName = `Sanity_Check_Report_${safeProjectCode}.pdf`;
    await downloadFile(pdfBlob, fileName, "application/pdf");
    toast.success("Engineering Sanity Check PDF report exported successfully!");
  } catch (error: any) {
    console.error("exportSanityCheckPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
