import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";

export interface StormWaterPDFExportRow {
  id: string;
  name: string;
  area: number;
  surface: string;
  coef: number;
  intensity: number;
  flow: number;
}

export interface StormWaterPDFMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  unitSystem?: "ip" | "si";
  totalArea?: number;
  avgC?: number;
  totalFlow?: number;
  reviewState?: any;
}

export const exportStormWaterPDF = async (
  rows: StormWaterPDFExportRow[],
  meta: StormWaterPDFMetaData = {}
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-STW-R01";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    const uArea = isIP ? "ft²" : "m²";
    const uIntensity = isIP ? "in/hr" : "mm/hr";
    const uFlow = isIP ? "GPM" : "L/s";

    // 1. Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Storm Water Runoff Calculation Report", 14, 14);

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
    doc.text(clientName.substring(0, 32), 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName.substring(0, 32), 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser.substring(0, 32), 125, 34);

    const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header grey
    const blueFill = [218, 233, 248] as [number, number, number]; // Soft blue for flow rate results

    // 3. Calculation Totals
    const totalAreaVal = meta.totalArea || rows.reduce((s, r) => s + r.area, 0);
    const avgCVal =
      meta.avgC || (totalAreaVal > 0 ? rows.reduce((s, r) => s + r.coef * r.area, 0) / totalAreaVal : 0);
    const totalFlowVal = meta.totalFlow || rows.reduce((s, r) => s + r.flow, 0);

    // 4. Main Catchment Schedule Table (Starts at Y: 42 directly after metadata block)
    const tableBody: any[] = rows.map((r, idx) => [
      (idx + 1).toString(),
      r.name,
      r.area.toFixed(1),
      r.surface.replace(/_/g, " "),
      r.coef.toFixed(2),
      r.intensity.toFixed(1),
      r.flow.toFixed(2),
    ]);

    // Total Row matching Ventilation total row pattern
    const totalRow = [
      "",
      "TOTAL",
      totalAreaVal.toFixed(1),
      "-",
      avgCVal.toFixed(2),
      "-",
      totalFlowVal.toFixed(2),
    ];
    (totalRow as any)._isTotal = true;
    tableBody.push(totalRow);

    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
        minCellHeight: 6.5,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 },
      },
      columnStyles: {
        0: { cellWidth: 10 },                                // Sr. No.
        1: { cellWidth: 58, halign: "left" },                // Catchment Name / Location
        2: { cellWidth: 24, halign: "right" },               // Area
        3: { cellWidth: 32, halign: "left" },                // Surface Type
        4: { cellWidth: 18, halign: "center" },              // Runoff Coef (C)
        5: { cellWidth: 20, halign: "right" },               // Rainfall Intensity
        6: { cellWidth: 20, halign: "right", fontStyle: "bold", fillColor: [242, 248, 253] }, // Peak Flow
      },
      head: [
        [
          { content: "Sr. No." },
          { content: "Catchment Name / Location" },
          { content: `Area\n(${uArea})` },
          { content: "Surface Type" },
          { content: "Runoff\nCoef (C)" },
          { content: `Rainfall\n(${uIntensity})` },
          { content: `Peak Flow\n(${uFlow})` },
        ],
      ],
      body: tableBody,
      didParseCell: (data: any) => {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotal = rawRow && (rawRow._isTotal || rawRow[1] === "TOTAL");
          if (isTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = primaryFill;
          } else if (data.column.index === 6) {
            data.cell.styles.fillColor = [242, 248, 253]; // Light blue for flow result cells
          }
        }
      },
    });

    let currentY = ((doc as any).lastAutoTable?.finalY ?? 150) + 8;

    // Check page space for signature block
    if (currentY + 30 > 280) {
      doc.addPage();
      currentY = 15;
    }

    // 5. 3-Tier Signature Block with exact [255, 230, 204] peach header fill from Ventilation
    const sig = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/plumbing-storm-water",
      meta.userName || ""
    );

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
      headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
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
          { content: sig.originatedName || "Abubakar Chanda", styles: { halign: "center" } },
          { content: sig.reviewerName || "-", styles: { halign: "center" } },
          { content: sig.approverName || "-", styles: { halign: "center" } },
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
          { content: sig.originatedDate || today, styles: { halign: "center" } },
          { content: sig.reviewerDate || "-", styles: { halign: "center" } },
          { content: sig.approverDate || "-", styles: { halign: "center" } },
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
    const safeProjectCode = activeProj?.code || "P000";
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Storm_Water_Report_${safeProjectCode}.pdf`,
      "PDF Document",
      ["pdf"]
    );

    toast.success("Storm water PDF exported successfully!");
  } catch (error: any) {
    console.error("exportStormWaterPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
