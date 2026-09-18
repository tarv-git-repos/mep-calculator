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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-SNT-101-R01";
    const today = meta.date || formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "Client Representative";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Engineering Facility";

    // 1. Header Title (Exact Ventilation Format)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Engineering Sanity Check Report", 14, 14);

    // 2. Metadata Box (182mm width: left 14mm to right 196mm, height 18mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.setDrawColor(100, 100, 100);
    doc.rect(14, 18, 182, 18);

    // Vertical line to separate left/right metadata at x=105
    doc.line(105, 18, 105, 36);

    // Horizontal grid lines inside metadata box
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Metadata Left Column
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(String(calcNo), 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectNo), 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    const truncatedProjectName = projectName.length > 32 ? projectName.substring(0, 30) + "..." : projectName;
    doc.text(truncatedProjectName, 42, 34);

    // Metadata Right Column
    doc.setFont("helvetica", "bold");
    doc.text("Date:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(String(today), 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    const truncatedClient = clientName.length > 32 ? clientName.substring(0, 30) + "..." : clientName;
    doc.text(truncatedClient, 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    const truncatedEndUser = endUser.length > 30 ? endUser.substring(0, 28) + "..." : endUser;
    doc.text(truncatedEndUser, 125, 34);

    // 3. Structured Summary & Audit Bar (Exact 182mm width matching margins)
    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.length - passCount;
    const unitLabel = unitSystem === "ip" ? "Imperial (IP)" : "Metric (SI)";

    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8.5,
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
        valign: "middle"
      },
      head: [
        [
          {
            content: "Standards: ASHRAE / SMACNA / Carrier",
            styles: { halign: "left", fontStyle: "bold", cellWidth: 72 }
          },
          {
            content: `Units: ${unitLabel}`,
            styles: { halign: "center", fontStyle: "bold", cellWidth: 38 }
          },
          {
            content: warnCount === 0
              ? `Audit: ${passCount}/${checks.length} Passed (All In-Range)`
              : `Audit: ${passCount} Passed | ${warnCount} Requires Review`,
            styles: {
              halign: "right",
              fontStyle: "bold",
              cellWidth: 72,
              textColor: warnCount === 0 ? [16, 120, 80] : [180, 83, 9]
            }
          }
        ]
      ],
      headStyles: {
        fillColor: [245, 247, 250],
        textColor: [30, 41, 59]
      }
    });

    const summaryFinalY = (doc as any).lastAutoTable?.finalY ?? 48;

    // 4. Main Table Data (Clean, uniform styling without excess background colors)
    const primaryFill: [number, number, number] = [217, 217, 217]; // Standard Grey matching Ventilation

    const tableBody = checks.map((c, idx) => {
      const isPass = c.status === "pass";
      return [
        (idx + 1).toString(),
        c.label,
        c.value,
        c.range,
        isPass ? "IN RANGE" : "CHECK VALUE",
        c.desc
      ];
    });

    callAutoTable(doc, {
      startY: summaryFinalY + 3,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 }
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 3, bottom: 3, left: 1, right: 1 }
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 38, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 30, halign: "center" },
        4: { cellWidth: 26, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 50, halign: "left" }
      },
      head: [
        [
          { content: "Sr. No." },
          { content: "Design Parameter" },
          { content: "Design Value" },
          { content: "Standard Range" },
          { content: "Compliance" },
          { content: "Engineering Guideline / Reference" }
        ]
      ],
      body: tableBody,
      didParseCell: (data: any) => {
        if (data.section === "body") {
          // Status column (Col 4): subtle text color only, clean white background
          if (data.column.index === 4) {
            const val = data.cell.raw;
            if (val === "IN RANGE") {
              data.cell.styles.textColor = [16, 120, 80];
            } else {
              data.cell.styles.textColor = [180, 83, 9];
            }
          }
        }
      }
    });

    // 5. 3-Column Engineering Sign-off Block (Exact Ventilation Format)
    const finalY = (doc as any).lastAutoTable?.finalY ?? 180;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate
    } = getSignatureBlockDetails(activeProj?.id || "default", "/sanity-check-tool", meta.userName || "");

    callAutoTable(doc, {
      startY: finalY + 8,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }
      },
      headStyles: {
        fillColor: [255, 230, 204], // Standard peach/orange matching Ventilation
        textColor: 0,
        fontStyle: "bold"
      },
      head: [
        [
          { content: "" },
          { content: "Originator" },
          { content: "Reviewer" },
          { content: "Approver" }
        ]
      ],
      body: [
        [
          { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedName, styles: { halign: "center" } },
          { content: reviewerName, styles: { halign: "center" } },
          { content: approverName, styles: { halign: "center" } }
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedDate, styles: { halign: "center" } },
          { content: reviewerDate, styles: { halign: "center" } },
          { content: approverDate, styles: { halign: "center" } }
        ]
      ],
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 }
      }
    });

    // 6. Professional Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text(
        "TARV MEP Calculation Platform  |  Engineering Sanity Check  |  Confidential",
        14,
        290
      );
      doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: "right" });
    }

    // 7. Download PDF
    const pdfBuffer = doc.output("arraybuffer");
    const safeProjectCode = activeProj?.code || "P000";
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Engineering_Sanity_Check_${safeProjectCode}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Sanity Check PDF exported successfully!");
  } catch (error: any) {
    console.error("exportSanityCheckPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
