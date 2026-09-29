import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

export interface CatchmentExportRow {
  id: string;
  name: string;
  area: number;
  surface: string;
  coef: number;
  intensity: number;
  flow: number;
}

export interface StormWaterProjectMetaData {
  projectName?: string;
  client?: string;
  projectNo?: string;
  calcNo?: string;
  date?: string;
  endUser?: string;
  userName?: string;
  reviewState?: any;
}

export interface StormWaterSummaryMetrics {
  totalArea: number;
  avgC: number;
  totalFlow: number;
  totalFlowM3h: number;
  retentionVol15m: number;
  retentionVol30m: number;
  imperviousPercentage: number;
  recommendedPipe: { dn: number; nps: string; idMm: number };
  actualVelMps: number;
}

const SURFACE_LABELS: Record<string, string> = {
  "asphalt": "Asphalt (0.95)",
  "brick": "Brick (0.85)",
  "concrete": "Concrete (0.95)",
  "sandy_soil": "Sandy Soil (0.20)",
  "clay_soil": "Clay Soil (0.85)",
  "agricultural": "Agricultural (0.30)"
};

export const exportStormWaterPDF = async (
  rows: CatchmentExportRow[],
  metrics: StormWaterSummaryMetrics,
  unitSystem: "si" | "ip",
  meta: StormWaterProjectMetaData = {}
) => {
  if (!rows || rows.length === 0) {
    toast.error("No catchment areas available to export.");
    return;
  }

  const isSI = unitSystem === "si";

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
    // A4 Portrait Mode (210mm x 297mm) matching Preliminary Cooling Load & Ventilation
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-STRM-001";
    const today = meta.date || formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Storm Water Runoff Drainage";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    // 1. Header Title (Matching Preliminary & Ventilation)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Storm Water Runoff Calculation Report", 14, 14);

    // 2. Metadata Block (Exact 2-column format)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box (182mm width)

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

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean gray from Preliminary/Ventilation

    // 3. Table 1: Design Parameters & Overall Summary
    const summaryData = [
      [1, "Total Catchment Zones", `${rows.length}`, "zones", "Architectural Site Catchment Inventory"],
      [2, "Total Catchment Area", `${metrics.totalArea.toFixed(1)}`, isSI ? "m²" : "ft²", "Cumulative Catchment Surface Area"],
      [3, "Composite Runoff Coef (C_avg)", `${metrics.avgC.toFixed(2)}`, "-", "Area-Weighted Impervious/Pervious Benchmark"],
      [4, "Total Peak Runoff Flow (Q)", `${metrics.totalFlow.toFixed(2)}`, isSI ? "L/s" : "GPM", "Rational Method Peak Discharge Q = (C × i × A) / 3600"],
      [5, "Hourly Flow Equivalent", `${metrics.totalFlowM3h.toFixed(1)}`, "m³/h", "Volumetric Hourly Drainage Rate"],
      [6, "15-Min Peak Retention Vol", isSI ? `${metrics.retentionVol15m.toFixed(1)}` : `${(metrics.retentionVol15m / 0.00378541).toFixed(0)}`, isSI ? "m³" : "Gal", "Short-duration Storm Attenuation Volume"],
      [7, "30-Min Peak Retention Vol", isSI ? `${metrics.retentionVol30m.toFixed(1)}` : `${(metrics.retentionVol30m / 0.00378541).toFixed(0)}`, isSI ? "m³" : "Gal", "Extended Storm Attenuation Volume"],
      [8, "Impervious Surface Ratio", `${metrics.imperviousPercentage}`, "%", "Areas with Runoff Coefficient C ≥ 0.80"],
      [9, "Recommended Storm Drain Pipe", isSI ? `DN ${metrics.recommendedPipe.dn} mm` : `${metrics.recommendedPipe.nps} NPS`, `~${metrics.actualVelMps.toFixed(2)} m/s`, "Gravity Flow Drainage Pipe Sizing Criteria"]
    ];

    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "left",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 62 },
        2: { halign: "center", cellWidth: 28, fontStyle: "bold" },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "left", cellWidth: 60 }
      },
      head: [
        [
          { content: "No.", halign: "center" },
          { content: "Design Parameter Description" },
          { content: "Value", halign: "center" },
          { content: "Unit", halign: "center" },
          { content: "Standard / Code Reference" }
        ]
      ],
      body: summaryData
    });

    let currentY = (doc as any).lastAutoTable?.finalY ?? 95;

    // 4. Table 2: Comprehensive Catchment Runoff Schedule
    const scheduleBody: any[] = [];
    rows.forEach((r, idx) => {
      scheduleBody.push([
        idx + 1,
        r.name || `Catchment ${idx + 1}`,
        SURFACE_LABELS[r.surface] || r.surface,
        r.area.toFixed(1),
        r.coef.toFixed(2),
        r.intensity.toFixed(1),
        r.flow.toFixed(2)
      ]);
    });

    // Schedule Total Row
    const scheduleTotalRow = [
      "",
      "TOTAL / COMPOSITE",
      "-",
      metrics.totalArea.toFixed(1),
      metrics.avgC.toFixed(2),
      "-",
      metrics.totalFlow.toFixed(2)
    ];
    (scheduleTotalRow as any)._isTotal = true;
    scheduleBody.push(scheduleTotalRow);

    callAutoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "center"
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 46 },
        2: { halign: "left", cellWidth: 38 },
        3: { halign: "right", cellWidth: 24 },
        4: { halign: "center", cellWidth: 20 },
        5: { halign: "right", cellWidth: 22 },
        6: { halign: "right", cellWidth: 22 }
      },
      head: [
        [
          { content: "No." },
          { content: "Catchment Area Name", halign: "left" },
          { content: "Surface Classification", halign: "left" },
          { content: `Area (${isSI ? "m²" : "ft²"})` },
          { content: "Runoff (C)" },
          { content: `Intensity (${isSI ? "mm/hr" : "in/hr"})` },
          { content: `Flow (${isSI ? "L/s" : "GPM"})` }
        ]
      ],
      body: scheduleBody,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body" && rawRow && rawRow._isTotal) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [218, 233, 248]; // Soft light blue total accent matching Preliminary
        }
      }
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? 150;

    // 5. Table 3: Engineering Design Standards & Compliance Guidelines
    const standardsData = [
      [1, "ASCE / WEF Manual of Practice No. FD-28", "Rational Method peak runoff rate computation Q = C × i × A for small urban catchments."],
      [2, "BS EN 752 / BS EN 12056-3", "Drainage systems outside buildings and roof drainage design with self-cleansing velocity criteria."],
      [3, "Storm Pipe Gravity Sizing", "Recommended minimum self-cleansing velocity of 1.0 m/s and maximum velocity limit of 2.5 m/s to prevent scouring."],
      [4, "Retention & Attenuation Capacity", "15-minute and 30-minute peak storage volumes calculated for civil soakaways, detention tanks, and municipal discharge control."]
    ];

    callAutoTable(doc, {
      startY: currentY + 7,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "left"
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", cellWidth: 60, fontStyle: "bold" },
        2: { halign: "left", cellWidth: 112 }
      },
      head: [
        [
          { content: "No.", halign: "center" },
          { content: "Standard / Authority Reference" },
          { content: "Mandatory Engineering Compliance & Criteria" }
        ]
      ],
      body: standardsData
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? 200;

    // 6. 3-Tier Signature Block (Exact warm peach header from Preliminary Cooling Load & Ventilation)
    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate
    } = getSignatureBlockDetails(activeProj?.id || activeProjectId || "default", "/plumbing-storm-water", meta.userName || currentUserName, meta.reviewState);

    // If remaining space on page is too small, add a new page
    if (currentY > 235) {
      doc.addPage();
      currentY = 20;
    }

    callAutoTable(doc, {
      startY: currentY + 8,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.5, bottom: 2.5, left: 1, right: 1 }
      },
      headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
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

    const pdfBuffer = doc.output("arraybuffer");
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Storm_Water_Runoff_Report_${projectNo || "P000"}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Storm Water Runoff PDF exported successfully!");
  } catch (error: any) {
    console.error("exportStormWaterPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
