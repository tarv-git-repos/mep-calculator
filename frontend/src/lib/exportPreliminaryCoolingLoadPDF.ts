import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr, getExporterUserName } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface PclExportRow {
  id: string;
  name: string;
  area: number | "";
  type: string;
  density: number; // W/m²
  dissipation: number; // Watts
  kw: number;
  tr: number;
  floor: string;
  occupancy?: number | string;
  flagged?: boolean;
}

export interface PclProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  archDrawingRef?: string;
  dbrRef?: string;
  reviewState?: any;
}

export const exportPreliminaryCoolingLoadPDF = async (
  rows: PclExportRow[],
  meta: PclProjectMetaData = {}
) => {
  if (!rows || rows.length === 0) {
    toast.error("No spaces available to export.");
    return;
  }

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

    const today = meta.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Preliminary Cooling Load Estimation";
    const clientName = meta.client || activeProj?.client || "Prestige Group developers";

    const leftMargin = 14;
    const contentWidth = 182; // 210 - 28

    // 1. Calculate Summary Stats
    let totalArea = 0;
    let totalKw = 0;
    let totalTr = 0;

    rows.forEach((r) => {
      const a = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
      const d = r.density || 120;
      const k = typeof r.kw === "number" ? r.kw : (a * d) / 1000;
      const t = typeof r.tr === "number" ? r.tr : k / 3.517;

      totalArea += a;
      totalKw += k;
      totalTr += t;
    });

    const avgDensity = totalArea > 0 ? (totalKw * 1000) / totalArea : 0;

    // 2. Title Banner: PRELIMINARY COOLING LOAD REPORT
    doc.setFillColor(10, 123, 199); // Primary Blue #0A7BC7
    doc.rect(leftMargin, 12, contentWidth, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("times", "bold");
    doc.text("PRELIMINARY COOLING LOAD REPORT", 105, 18.5, { align: "center" });

    // 3. Company & Date Line
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(9.5);
    doc.setFont("times", "bold");
    doc.text(clientName, leftMargin, 27);
    doc.setFont("times", "normal");
    doc.text("Date: " + today, leftMargin + contentWidth, 27, { align: "right" });

    // 4. PROJECT SUMMARY STATS Table
    callAutoTable(doc, {
      startY: 30,
      margin: { left: leftMargin, right: leftMargin },
      theme: "plain",
      head: [
        [
          {
            content: "PROJECT SUMMARY STATS",
            colSpan: 4,
            styles: {
              fillColor: [6, 69, 111], // Deep Navy #06456F
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9,
              font: "times",
              halign: "left",
              cellPadding: 2,
            },
          },
        ],
      ],
      body: [
        [
          { content: "Project Name:", styles: { font: "times", fontStyle: "bold", cellWidth: 35 } },
          { content: projectName, styles: { font: "times", cellWidth: 55 } },
          { content: "Total Estimated Load (TR):", styles: { font: "times", fontStyle: "bold", cellWidth: 45 } },
          { content: `${totalTr.toFixed(2)} TR`, styles: { font: "times", fontStyle: "bold", textColor: [10, 123, 199], halign: "right", cellWidth: 47 } },
        ],
        [
          { content: "Client Name:", styles: { font: "times", fontStyle: "bold" } },
          { content: clientName, styles: { font: "times" } },
          { content: "Total Estimated Load (kW):", styles: { font: "times", fontStyle: "bold" } },
          { content: `${totalKw.toFixed(2)} kW`, styles: { font: "times", fontStyle: "bold", textColor: [10, 123, 199], halign: "right" } },
        ],
        [
          { content: "Calculation No:", styles: { font: "times", fontStyle: "bold" } },
          { content: meta.calcNo || "CALC-HVAC-PCL01", styles: { font: "times" } },
          { content: "Total Area (m²):", styles: { font: "times", fontStyle: "bold" } },
          { content: `${totalArea.toFixed(1)} m²`, styles: { font: "times", halign: "right" } },
        ],
        [
          { content: "Project Code:", styles: { font: "times", fontStyle: "bold" } },
          { content: meta.projectNo || activeProj?.code || "MEP-2026-001", styles: { font: "times" } },
          { content: "Avg Heat Load Density:", styles: { font: "times", fontStyle: "bold" } },
          { content: `${avgDensity.toFixed(1)} W/m²`, styles: { font: "times", halign: "right" } },
        ],
      ],
      styles: {
        font: "times",
        fontSize: 8,
        cellPadding: 1.8,
        textColor: [30, 30, 30],
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
    });

    const statsEndY = (doc as any).lastAutoTable.finalY;

    // 5. Build Room by Room Schedule Body Grouped by Floor
    const floorsMap = new Map<string, PclExportRow[]>();
    rows.forEach((r) => {
      const f = r.floor || "GF";
      if (!floorsMap.has(f)) floorsMap.set(f, []);
      floorsMap.get(f)!.push(r);
    });

    const scheduleBody: any[] = [];
    let sNo = 1;

    const floorHeaderFill = [240, 244, 248]; // Light Blue-Gray
    const totalRowFill = [225, 238, 248]; // Accent Highlight

    floorsMap.forEach((floorRows, floorName) => {
      // Floor Subheader
      scheduleBody.push([
        {
          content: `${floorName} (${floorRows.length} spaces)`,
          colSpan: 7,
          styles: {
            font: "times",
            fontStyle: "bold",
            fontSize: 8,
            fillColor: floorHeaderFill,
            textColor: [6, 69, 111],
            halign: "left",
            cellPadding: 2,
          },
        },
      ]);

      floorRows.forEach((r) => {
        const numArea = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const density = r.density || 120;
        const kw = typeof r.kw === "number" ? r.kw : (numArea * density) / 1000;
        const tr = typeof r.tr === "number" ? r.tr : kw / 3.517;

        scheduleBody.push([
          { content: String(sNo++), styles: { font: "times", halign: "center" } },
          { content: r.name || "Space", styles: { font: "times", halign: "left" } },
          { content: numArea > 0 ? numArea.toFixed(1) : "—", styles: { font: "times", halign: "right" } },
          { content: r.type || "Unassigned", styles: { font: "times", halign: "left" } },
          { content: density > 0 ? density.toFixed(1) : "—", styles: { font: "times", halign: "right" } },
          { content: kw > 0 ? kw.toFixed(2) : "—", styles: { font: "times", halign: "right" } },
          { content: tr > 0 ? tr.toFixed(2) : "—", styles: { font: "times", halign: "right" } },
        ]);
      });
    });

    // TOTAL Summary Row
    scheduleBody.push([
      { content: "TOTAL", colSpan: 2, styles: { font: "times", fontStyle: "bold", halign: "left", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalArea.toFixed(1), styles: { font: "times", fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: "", styles: { fillColor: totalRowFill } },
      { content: avgDensity.toFixed(1), styles: { font: "times", fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalKw.toFixed(2), styles: { font: "times", fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalTr.toFixed(2), styles: { font: "times", fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
    ]);

    // 6. COOLING LOAD SCHEDULE Banner (Draws on Page 1 above the table)
    const scheduleBannerY = statsEndY + 3;
    doc.setFillColor(6, 69, 111); // Deep Navy #06456F
    doc.rect(leftMargin, scheduleBannerY, contentWidth, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont("times", "bold");
    doc.text("COOLING LOAD SCHEDULE", leftMargin + 3, scheduleBannerY + 4.2);

    // 7. Schedule Table (Only Column Headers repeat on page breaks)
    callAutoTable(doc, {
      startY: scheduleBannerY + 6,
      margin: { top: 14, left: leftMargin, right: leftMargin },
      head: [
        [
          { content: "S.No", styles: { halign: "center", cellWidth: 10 } },
          { content: "Name of Space", styles: { halign: "left", cellWidth: 40 } },
          { content: "Area (m²)", styles: { halign: "right", cellWidth: 18 } },
          { content: "Type of Space", styles: { halign: "left", cellWidth: 42 } },
          { content: "Cooling load Density (W/m²)", styles: { halign: "right", cellWidth: 28 } },
          { content: "Cooling Load (kW)", styles: { halign: "right", cellWidth: 22 } },
          { content: "Cooling Load (TR)", styles: { halign: "right", cellWidth: 22 } },
        ],
      ],
      body: scheduleBody,
      theme: "grid",
      headStyles: {
        fillColor: [10, 123, 199], // Primary Blue #0A7BC7
        textColor: [255, 255, 255],
        font: "times",
        fontStyle: "bold",
        fontSize: 7.5,
        valign: "middle",
      },
      styles: {
        font: "times",
        fontSize: 7.5,
        textColor: [20, 20, 20],
        cellPadding: 1.5,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      didDrawPage: (data: any) => {
        // Footer: Page Numbers
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setFont("times", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          105,
          290,
          { align: "center" }
        );
      },
    });

    const tableEndY = (doc as any).lastAutoTable.finalY;

    // 8. Signature Block
    const sigDetails = getSignatureBlockDetails(
      activeProjectId,
      "/preliminary-cooling-load",
      getExporterUserName(currentUserName),
      meta.reviewState
    );

    addPdfSignatureBlock(doc, tableEndY + 6, sigDetails, activeProjectId, "/preliminary-cooling-load");

    // Save and download
    const fileName = `${(projectName || "Preliminary_Cooling_Load").replace(/\s+/g, "_")}_report.pdf`;
    downloadFile(doc.output("blob"), fileName);
    toast.success("Preliminary Cooling Load PDF report exported successfully!");
  } catch (error: any) {
    console.error("PDF Export error:", error);
    toast.error(`Failed to export PDF: ${error.message || "Unknown error"}`);
  }
};
