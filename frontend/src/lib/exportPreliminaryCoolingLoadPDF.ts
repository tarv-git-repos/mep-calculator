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
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Preliminary HVAC Project";
    const clientName = meta.client || activeProj?.client || "Consistent Engineering Consultants";

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
    doc.setFont("helvetica", "bold");
    doc.text("PRELIMINARY COOLING LOAD REPORT", 105, 18.5, { align: "center" });

    // 3. Company & Date Line
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.text(clientName, leftMargin, 27);
    doc.setFont("helvetica", "normal");
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
              halign: "left",
              cellPadding: 2,
            },
          },
        ],
      ],
      body: [
        [
          { content: "Total Spaces:", styles: { fontStyle: "bold", halign: "left", cellWidth: 45 } },
          { content: String(rows.length), styles: { fontStyle: "bold", halign: "right", cellWidth: 45 } },
          { content: "Total Load (TR):", styles: { fontStyle: "bold", halign: "left", cellWidth: 46 } },
          { content: `${totalTr.toFixed(2)} TR`, styles: { fontStyle: "bold", halign: "right", cellWidth: 46 } },
        ],
        [
          { content: "Total Floor Area (m²):", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${totalArea.toFixed(1)} m²`, styles: { fontStyle: "bold", halign: "right" } },
          { content: "Total Load (TR):", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${totalTr.toFixed(2)} TR`, styles: { fontStyle: "bold", halign: "right" } },
        ],
        [
          { content: "Total Cooling Load (kW):", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${totalKw.toFixed(2)} kW`, styles: { fontStyle: "bold", halign: "right" } },
          { content: "Average Load Density (W/m²):", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${avgDensity.toFixed(1)} W/m²`, styles: { fontStyle: "bold", halign: "right" } },
        ],
      ],
      styles: {
        fontSize: 8,
        textColor: [30, 30, 30],
        cellPadding: 1.5,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
    });

    const statsEndY = (doc as any).lastAutoTable.finalY;

    // 5. Build Grouped Table Body
    const groupedFloors: Record<string, PclExportRow[]> = {};
    const floorOrderList: string[] = [];

    rows.forEach((r) => {
      const fl = (r.floor || "General").trim();
      if (!groupedFloors[fl]) {
        groupedFloors[fl] = [];
        floorOrderList.push(fl);
      }
      groupedFloors[fl].push(r);
    });

    const scheduleBody: any[] = [];
    let sNo = 1;

    const floorHeaderFill = [220, 239, 251] as [number, number, number]; // Soft Blue #DCEFFB
    const totalRowFill = [220, 239, 251] as [number, number, number];

    floorOrderList.forEach((floorName) => {
      const floorRows = groupedFloors[floorName];

      // Floor Section Header Row
      scheduleBody.push([
        {
          content: `Floor: ${floorName}`,
          colSpan: 7,
          styles: {
            fillColor: floorHeaderFill,
            fontStyle: "bold",
            halign: "left",
            textColor: [6, 69, 111],
            fontSize: 8.5,
          },
        },
      ]);

      floorRows.forEach((r) => {
        const numArea = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const density = r.density || 120;
        const kw = typeof r.kw === "number" ? r.kw : (numArea * density) / 1000;
        const tr = typeof r.tr === "number" ? r.tr : kw / 3.517;

        scheduleBody.push([
          { content: String(sNo++), styles: { halign: "center" } },
          { content: r.name || "Space", styles: { halign: "left" } },
          { content: numArea.toFixed(1), styles: { halign: "right" } },
          { content: r.type || "Unassigned", styles: { halign: "left" } },
          { content: density.toFixed(1), styles: { halign: "right" } },
          { content: kw.toFixed(2), styles: { halign: "right" } },
          { content: tr.toFixed(2), styles: { halign: "right" } },
        ]);
      });
    });

    // TOTAL Summary Row
    scheduleBody.push([
      { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "left", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalArea.toFixed(1), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: "", styles: { fillColor: totalRowFill } },
      { content: avgDensity.toFixed(1), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalKw.toFixed(2), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalTr.toFixed(2), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
    ]);

    // 6. COOLING LOAD SCHEDULE Table
    callAutoTable(doc, {
      startY: statsEndY + 3,
      margin: { left: leftMargin, right: leftMargin },
      head: [
        [
          {
            content: "COOLING LOAD SCHEDULE",
            colSpan: 7,
            styles: {
              fillColor: [6, 69, 111], // Deep Navy #06456F
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9,
              halign: "left",
              cellPadding: 2,
            },
          },
        ],
        [
          { content: "S.No", styles: { halign: "center", cellWidth: 12 } },
          { content: "Name of Space", styles: { halign: "left", cellWidth: 42 } },
          { content: "Area (m²)", styles: { halign: "right", cellWidth: 20 } },
          { content: "Type of Space", styles: { halign: "left", cellWidth: 42 } },
          { content: "Cooling load Density (W/m²)", styles: { halign: "right", cellWidth: 26 } },
          { content: "Cooling Load (kW)", styles: { halign: "right", cellWidth: 20 } },
          { content: "Cooling Load (TR)", styles: { halign: "right", cellWidth: 20 } },
        ],
      ],
      body: scheduleBody,
      theme: "grid",
      headStyles: {
        fillColor: [10, 123, 199], // Primary Blue #0A7BC7
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        valign: "middle",
      },
      styles: {
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
        doc.setFont("helvetica", "normal");
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

    // 7. Signature Block
    const sigDetails = getSignatureBlockDetails(
      activeProjectId,
      "preliminary-cooling-load",
      getExporterUserName(currentUserName),
      new Date().toISOString()
    );

    addPdfSignatureBlock(doc, tableEndY + 6, sigDetails);

    // Save and download
    const fileName = `${(projectName || "Preliminary_Cooling_Load").replace(/\s+/g, "_")}_report.pdf`;
    downloadFile(doc.output("blob"), fileName);
    toast.success("Preliminary Cooling Load PDF report exported successfully!");
  } catch (error: any) {
    console.error("PDF Export error:", error);
    toast.error(`Failed to export PDF: ${error.message || "Unknown error"}`);
  }
};
