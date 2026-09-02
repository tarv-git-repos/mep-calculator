import { addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr, getExporterUserName } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface SprinklerExportRow {
  id: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number; // PSI or bar
  flow: number;     // GPM or LPM
  coverage: number; // sq ft or m²
  hazard: string;
  notes?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface SprinklerProjectMetaData {
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

export const exportSprinklerKFactorPDF = async (
  rows: SprinklerExportRow[],
  meta: SprinklerProjectMetaData = {},
  liveReviewState?: any
) => {
  if (!rows || rows.length === 0) {
    toast.error("No sprinkler rows available to export.");
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

    const isSI = meta.unitSystem === "si";
    const pressureUnit = isSI ? "bar" : "PSI";
    const flowUnit = isSI ? "LPM" : "GPM";
    const areaUnit = isSI ? "m²" : "ft²";

    const today = meta.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Sprinkler Hydraulic Calculation";
    const clientName = meta.client || activeProj?.client || "Consistent Engineering Consultants";

    const leftMargin = 14;
    const contentWidth = 182; // 210 - 28

    // 1. Calculate Summary Stats
    let totalFlow = 0;
    let maxPressure = 0;
    let minPressure = Infinity;
    let totalCoverage = 0;

    rows.forEach((r) => {
      totalFlow += (r.flow || 0);
      totalCoverage += (r.coverage || 0);
      if (r.pressure > maxPressure) maxPressure = r.pressure;
      if (r.pressure < minPressure && r.pressure > 0) minPressure = r.pressure;
    });

    if (minPressure === Infinity) minPressure = 0;
    const avgPressure = rows.length > 0 ? (rows.reduce((sum, r) => sum + (r.pressure || 0), 0) / rows.length) : 0;

    // 2. Title Banner: SPRINKLER K-FACTOR & FLOW REPORT
    doc.setFillColor(10, 123, 199); // Primary Blue #0A7BC7
    doc.rect(leftMargin, 12, contentWidth, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("SPRINKLER K-FACTOR & FLOW REPORT", 105, 18.5, { align: "center" });

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
            content: "FIRE FIGHTING DESIGN SUMMARY STATS",
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
          { content: "Total Sprinklers:", styles: { fontStyle: "bold", halign: "left", cellWidth: 45 } },
          { content: String(rows.length), styles: { fontStyle: "bold", halign: "right", cellWidth: 45 } },
          { content: "Total Demand Flow:", styles: { fontStyle: "bold", halign: "left", cellWidth: 46 } },
          { content: `${totalFlow.toFixed(2)} ${flowUnit}`, styles: { fontStyle: "bold", halign: "right", cellWidth: 46 } },
        ],
        [
          { content: "Total Coverage Area:", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${totalCoverage.toFixed(1)} ${areaUnit}`, styles: { fontStyle: "bold", halign: "right" } },
          { content: "Max Operating Pressure:", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${maxPressure.toFixed(2)} ${pressureUnit}`, styles: { fontStyle: "bold", halign: "right" } },
        ],
        [
          { content: "Average Operating Pressure:", styles: { fontStyle: "bold", halign: "left" } },
          { content: `${avgPressure.toFixed(2)} ${pressureUnit}`, styles: { fontStyle: "bold", halign: "right" } },
          { content: "Design Standard:", styles: { fontStyle: "bold", halign: "left" } },
          { content: "NFPA 13 Standard", styles: { fontStyle: "bold", halign: "right" } },
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

    // 5. Build Schedule Body
    const scheduleBody: any[] = [];
    let sNo = 1;

    const totalRowFill = [220, 239, 251] as [number, number, number];

    rows.forEach((r) => {
      scheduleBody.push([
        { content: String(sNo++), styles: { halign: "center" } },
        { content: r.label || "Sprinkler Head", styles: { halign: "left" } },
        { content: Number(r.kFactor || 5.6).toFixed(1), styles: { halign: "center" } },
        { content: r.hazard || "Ordinary Hazard", styles: { halign: "left" } },
        { content: Number(r.coverage || 0).toFixed(1), styles: { halign: "right" } },
        { content: Number(r.pressure || 0).toFixed(2), styles: { halign: "right" } },
        { content: Number(r.flow || 0).toFixed(2), styles: { halign: "right" } },
      ]);
    });

    // TOTAL Summary Row
    scheduleBody.push([
      { content: "TOTAL", colSpan: 4, styles: { fontStyle: "bold", halign: "left", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalCoverage.toFixed(1), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: "—", styles: { fontStyle: "bold", halign: "center", fillColor: totalRowFill, textColor: [6, 69, 111] } },
      { content: totalFlow.toFixed(2), styles: { fontStyle: "bold", halign: "right", fillColor: totalRowFill, textColor: [6, 69, 111] } },
    ]);

    // 6. SPRINKLER DESIGN SCHEDULE Banner (Draws on Page 1 above table)
    const scheduleBannerY = statsEndY + 3;
    doc.setFillColor(6, 69, 111); // Deep Navy #06456F
    doc.rect(leftMargin, scheduleBannerY, contentWidth, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("SPRINKLER DESIGN SCHEDULE", leftMargin + 3, scheduleBannerY + 4.2);

    // 7. Schedule Table (Only Column Headers repeat on page breaks)
    callAutoTable(doc, {
      startY: scheduleBannerY + 6,
      margin: { top: 14, left: leftMargin, right: leftMargin },
      head: [
        [
          { content: "S.No", styles: { halign: "center", cellWidth: 12 } },
          { content: "Sprinkler Label / Location", styles: { halign: "left", cellWidth: 50 } },
          { content: "K-Factor", styles: { halign: "center", cellWidth: 18 } },
          { content: "Hazard Class", styles: { halign: "left", cellWidth: 38 } },
          { content: `Coverage (${areaUnit})`, styles: { halign: "right", cellWidth: 22 } },
          { content: `Pressure (${pressureUnit})`, styles: { halign: "right", cellWidth: 21 } },
          { content: `Flow (${flowUnit})`, styles: { halign: "right", cellWidth: 21 } },
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

    // 8. 3-Tier Signature Block
    const sigDetails = getSignatureBlockDetails(
      activeProjectId,
      "/plumbing-sprinkler-kfactor",
      getExporterUserName(currentUserName),
      liveReviewState
    );

    addPdfSignatureBlock(doc, tableEndY + 6, sigDetails);

    // Save and download
    const fileName = `${(projectName || "Sprinkler_K_Factor_Calculation").replace(/\s+/g, "_")}_report.pdf`;
    downloadFile(doc.output("blob"), fileName);
    toast.success("Sprinkler K-Factor PDF report exported successfully!");
  } catch (error: any) {
    console.error("PDF Export error:", error);
    toast.error(`Failed to export PDF: ${error.message || "Unknown error"}`);
  }
};
