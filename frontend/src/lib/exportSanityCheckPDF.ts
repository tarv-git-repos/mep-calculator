import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "./pdfHelpers";
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
    reviewState?: any;
    includeStamp?: boolean;
    returnBuffer?: boolean;
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
    const revNo = meta.revNo || activeProj?.revNo || "0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    // 1. Standard Header & Metadata Block
    const startY = addPdfHeader(doc, "Engineering Sanity Check Report", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    // 2. Structured Summary & Audit Bar
    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.length - passCount;
    const unitLabel = unitSystem === "ip" ? "Imperial (IP)" : "Metric (SI)";

    callAutoTable(doc, {
      startY: startY + 2,
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

    let currentY = (doc as any).lastAutoTable?.finalY ?? 150;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 280) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 5. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProjectId,
        "/sanity-check-tool",
        meta.userName || "System Admin",
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProjectId,
        "/sanity-check-tool"
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

    const safeProjectCode = activeProj?.code || projectNo || "P000";
    const fileName = `Sanity_Check_Report_${safeProjectCode}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "application/pdf", ["pdf"]);
    toast.success("Engineering Sanity Check PDF report exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportSanityCheckPDF error:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};
