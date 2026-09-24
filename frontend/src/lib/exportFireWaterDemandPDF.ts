import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { toast } from "sonner";
import {
  type CivilDefenseBuilding,
  type CivilDefenseEvaluation,
} from "./civilDefenseFireDemandCalc";

export interface FireWaterDemandPDFMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
}

export interface EvaluatedBuildingItem {
  building: CivilDefenseBuilding;
  evaluation: CivilDefenseEvaluation;
}

export interface ProjectSummaryStats {
  buildingCount: number;
  maxPumpFlowGpm: number;
  maxPumpFlowLpm: number;
  maxPumpPressureBar: number;
  maxPumpPressurePsi: number;
  totalNetStorageM3: number;
  totalNetStorageGal: number;
  totalGrossStorageM3: number;
  totalGrossStorageGal: number;
  superHighriseCount: number;
  yardHydrantRequiredCount: number;
  governingHeaderNps: number;
  governingHeaderDn: number;
  governingHeaderVelocity: number;
}

export const exportFireWaterDemandPDF = async (
  evaluatedBuildings: EvaluatedBuildingItem[],
  projectSummary: ProjectSummaryStats,
  unitSystem: "si" | "ip" = "si",
  meta: FireWaterDemandPDFMetaData = {}
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

    const calcNo =
      meta.calcNo ||
      activeProj?.calcNo ||
      `TRV-CAL-FWD-${(activeProjectId || "0000").slice(-4).toUpperCase()}`;
    const today = meta.date || formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
    const projectNo =
      meta.projectNo ||
      activeProj?.code ||
      activeProj?.projectNo ||
      (activeProjectId !== "default" ? activeProjectId.slice(0, 8) : "P000");
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "MEP Project";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";

    // Header Title matching Ventilation standard
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Fire Water Demand Calculation Report", 14, 14);

    // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
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

    const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header grey #D9D9D9
    const blueFill = [218, 233, 248] as [number, number, number]; // Soft blue highlight #DAE9F8
    const lightBlueFill = [242, 248, 253] as [number, number, number];

    const isSI = unitSystem === "si";

    // Build Table 1: Multi-Building Fire Water Demand Schedule
    const tableBody: any[] = [];

    evaluatedBuildings.forEach((item, idx) => {
      const b = item.building;
      const ev = item.evaluation;

      const flowStr = isSI
        ? `${ev.lowestFirePumpFlowLpm} LPM\n(${ev.lowestFirePumpFlowGpm} GPM)`
        : `${ev.lowestFirePumpFlowGpm} GPM\n(${ev.lowestFirePumpFlowLpm} LPM)`;

      const pressStr = isSI
        ? `${ev.lowestFirePumpPressureBar} bar\n(${ev.lowestFirePumpPressurePsi} psi)`
        : `${ev.lowestFirePumpPressurePsi} psi\n(${ev.lowestFirePumpPressureBar} bar)`;

      const volStr = isSI
        ? `${ev.mainTankNetVolumeM3} m³\n(${ev.mainTankNetVolumeGal.toLocaleString()} gal)`
        : `${ev.mainTankNetVolumeGal.toLocaleString()} gal\n(${ev.mainTankNetVolumeM3} m³)`;

      const stagingStr = ev.requiresStagingPumps
        ? `Yes\n(+${ev.stagingIntervalMeters}m)`
        : "Single Stage";

      tableBody.push([
        (idx + 1).toString(),
        b.name,
        b.occupancy.replace(/_/g, " "),
        `${b.height}m / G+${b.floors}`,
        `${b.groundFloorArea.toLocaleString()} m²`,
        ev.tableRef.replace(/^Table\s+/i, ""),
        b.standpipeCount.toString(),
        flowStr,
        pressStr,
        `${ev.mainTankDurationMin} min`,
        volStr,
        stagingStr,
      ]);
    });

    // Summary Grand Total / Governing Row
    const totalFlowDisplay = isSI
      ? `${projectSummary.maxPumpFlowLpm} LPM\n(${projectSummary.maxPumpFlowGpm} GPM)`
      : `${projectSummary.maxPumpFlowGpm} GPM\n(${projectSummary.maxPumpFlowLpm} LPM)`;

    const totalPressDisplay = isSI
      ? `${projectSummary.maxPumpPressureBar} bar\n(${projectSummary.maxPumpPressurePsi} psi)`
      : `${projectSummary.maxPumpPressurePsi} psi\n(${projectSummary.maxPumpPressureBar} bar)`;

    const totalVolDisplay = isSI
      ? `${projectSummary.totalNetStorageM3} m³\n(${projectSummary.totalNetStorageGal.toLocaleString()} gal)`
      : `${projectSummary.totalNetStorageGal.toLocaleString()} gal\n(${projectSummary.totalNetStorageM3} m³)`;

    const summaryRow = [
      "",
      "GOVERNING / TOTAL",
      `${evaluatedBuildings.length} Blocks`,
      "-",
      "-",
      "UAE Civil Defense",
      "-",
      totalFlowDisplay,
      totalPressDisplay,
      "-",
      totalVolDisplay,
      projectSummary.superHighriseCount > 0 ? `${projectSummary.superHighriseCount} Tower(s)` : "Single",
    ];
    (summaryRow as any)._isGrandTotal = true;
    tableBody.push(summaryRow);

    // Call AutoTable for Multi-Building Schedule
    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 6.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 0.8, right: 0.8 },
        minCellHeight: 6,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 },
      },
      columnStyles: {
        0: { cellWidth: 7 }, // Sr No
        1: { halign: "left", cellWidth: 26, fontStyle: "bold" }, // Building Name
        2: { halign: "left", cellWidth: 18 }, // Occupancy
        3: { cellWidth: 15 }, // Height/Floors
        4: { cellWidth: 14 }, // GFA
        5: { cellWidth: 14 }, // Code Ref
        6: { cellWidth: 10 }, // Standpipes
        7: { cellWidth: 19, fontStyle: "bold", fillColor: lightBlueFill }, // Pump Flow
        8: { cellWidth: 16, fontStyle: "bold", fillColor: lightBlueFill }, // Pump Pressure
        9: { cellWidth: 13 }, // Duration
        10: { cellWidth: 18, fontStyle: "bold", fillColor: lightBlueFill }, // Net Storage
        11: { cellWidth: 12 }, // Staging
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2 },
          { content: "Building Parameters", colSpan: 4 },
          { content: "Civil Defense Code", colSpan: 2 },
          { content: "Fire Pump Duty", colSpan: 2 },
          { content: "Water Storage", colSpan: 2 },
          { content: "Staging", rowSpan: 2 },
        ],
        [
          { content: "Building / Block" },
          { content: "Occupancy" },
          { content: "Height / Flr" },
          { content: "GFA (m²)" },
          { content: "Table Ref" },
          { content: "Risers" },
          { content: "Flow Rate" },
          { content: "Pressure" },
          { content: "Duration" },
          { content: "Net Storage" },
        ],
      ],
      body: tableBody,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotalRow = rawRow && rawRow._isGrandTotal;
          if (isTotalRow) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
          } else if (
            data.column.index === 7 ||
            data.column.index === 8 ||
            data.column.index === 10
          ) {
            data.cell.styles.fillColor = lightBlueFill;
          }
        }
      },
    });

    const finalY1 = (doc as any).lastAutoTable?.finalY ?? 130;

    // 4-Column Signature Block (Designation, Originator, Reviewer, Approver) matching Ventilation PDF standard
    let userName =
      meta.userName ||
      (typeof window !== "undefined" ? (window as any).currentMepUserName : undefined) ||
      currentUserName;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(
      activeProj?.id || "default",
      "/plumbing-fire-water-demand",
      userName,
      meta.reviewState
    );

    callAutoTable(doc, {
      startY: finalY1 + 6,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: [255, 230, 204], // Standard #FFE6CC peach signature header
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
          { content: originatedName, styles: { halign: "center" } },
          { content: reviewerName, styles: { halign: "center" } },
          { content: approverName, styles: { halign: "center" } },
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedDate, styles: { halign: "center" } },
          { content: reviewerDate, styles: { halign: "center" } },
          { content: approverDate, styles: { halign: "center" } },
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
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Fire_Water_Demand_Report_${projectNo}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Fire Water Demand PDF exported successfully!");
  } catch (error: any) {
    console.error("exportFireWaterDemandPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
