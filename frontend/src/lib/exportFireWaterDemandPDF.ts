import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
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

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Fire Water Demand Calculation Report", {
      calcNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

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
      startY: startY + 2,
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

    // Engineering 3-Tier Signature Block & Branding
    addPdfSignatureBlock(doc, finalY1 + 6, sigDetails, activeProj?.id || "default", "/plumbing-fire-water-demand");

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

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
