import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";

export interface WaterDemandExportData {
  calculations: any;
  wdRows: Array<{
    id: number;
    name: string;
    ppl: number;
    cat: string;
    lpd: number;
    multiplier?: number;
    flagged?: boolean;
    comments?: any[];
  }>;
  irrRows: Array<{
    id: number;
    vegType: string;
    area: number;
    lpd: number;
    flagged?: boolean;
    comments?: any[];
  }>;
  poolArea?: number | "";
  poolDepth?: number | "";
  poolEvap?: number;
  fireFlow?: number | "";
  storageDays: number;
  groundTankPct: number;
  overheadTanks?: Array<{
    id: string;
    name: string;
    sharePct: number;
  }>;
  fillWindowHours: number;
  peakFactor: number;
  unitSystem: "si" | "ip";
  presetStandard: string;
  meta?: {
    projectName?: string;
    client?: string;
    projectNo?: string;
    calcNo?: string;
    date?: string;
    endUser?: string;
    userName?: string;
    revNo?: string;
    includeStamp?: boolean;
    returnBuffer?: boolean;
    reviewState?: any;
  };
}

export const exportWaterDemandPDF = async (data: WaterDemandExportData): Promise<Uint8Array | boolean | void> => {
  const {
    calculations,
    wdRows,
    irrRows,
    poolArea,
    poolDepth,
    poolEvap = 1.5,
    fireFlow,
    storageDays,
    fillWindowHours,
    peakFactor,
    unitSystem,
    meta = {},
  } = data;

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
    // A4 Portrait Mode (210mm x 297mm) matching Preliminary Cooling Load & Ventilation standard
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-WTR-001";
    const revNo = meta.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = meta.date || formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Water Demand & Storage Tank Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Water Demand & Storage Tank Sizing Calculation", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean uniform gray for all table column headings
    const blueFill = [218, 233, 248] as [number, number, number];    // Soft blue for total & summary rows

    // 3. Table 1: Executive Design Parameters & Overall Summary
    const domLoadVal = isSI
      ? Math.round(calculations.totalWaterL || 0).toLocaleString()
      : Math.round((calculations.totalWaterL || 0) / 3.78541).toLocaleString();

    const domPeakVal = isSI
      ? (calculations.peakLPS || 0).toFixed(2)
      : Math.round(calculations.peakGPM || 0).toLocaleString();

    const irrLoadVal = isSI
      ? Math.round(calculations.totalIrrL || 0).toLocaleString()
      : Math.round((calculations.totalIrrL || 0) / 3.78541).toLocaleString();

    const poolLoadVal = isSI
      ? Math.round(calculations.poolDemandL || 0).toLocaleString()
      : Math.round((calculations.poolDemandL || 0) / 3.78541).toLocaleString();

    const fireReserveVal = isSI
      ? Math.round(calculations.fireCapL || 0).toLocaleString()
      : Math.round((calculations.fireCapL || 0) / 3.78541).toLocaleString();

    const grandTotalVal = isSI
      ? Math.round(calculations.grandTotalL || 0).toLocaleString()
      : Math.round((calculations.grandTotalL || 0) / 3.78541).toLocaleString();

    const totalStorageVal = isSI
      ? (calculations.reqStorageM3 || 0).toFixed(2)
      : Math.round(calculations.reqStorageGal || 0).toLocaleString();

    const groundTankVal = isSI
      ? Math.round(calculations.groundTankL || 0).toLocaleString()
      : Math.round((calculations.groundTankL || 0) / 3.78541).toLocaleString();

    const pumpFlowVal = isSI
      ? (calculations.transferPumpLPS || 0).toFixed(2)
      : (calculations.transferPumpGPM || 0).toFixed(1);

    const summaryData: any[] = [
      [1, "Total Occupied Spaces", `${wdRows.length}`, "spaces", "Architectural Space Inventory"],
      [2, "Total Occupancy Headcount", `${(calculations.totalPeople || 0).toLocaleString()}`, "people", "Scheduled Design Occupancy"],
      [3, "Domestic Daily Water Demand", domLoadVal, isSI ? "L/day" : "gal/day", "Governing Standard Allowance"],
      [4, "Domestic Peak Flow Rate", domPeakVal, isSI ? "L/s" : "GPM", `Peak Multiplier K = ${peakFactor}`],
      [5, "Irrigation Daily Water Load", irrLoadVal, isSI ? "L/day" : "gal/day", "Landscaping Vegetation Schedule"],
    ];

    let rowCounter = 6;

    if (poolArea && poolDepth) {
      summaryData.push([
        rowCounter++,
        "Swimming Pool Makeup Water",
        poolLoadVal,
        isSI ? "L/day" : "gal/day",
        `Evaporation Loss ${poolEvap}%/day + Backwash`,
      ]);
    }

    if (fireFlow) {
      summaryData.push([
        rowCounter++,
        "Fire Fighting Dedicated Reserve",
        fireReserveVal,
        isSI ? "L" : "gal",
        "60-Min Standard Duration (NFPA 13/14)",
      ]);
    }

    // Grand Total Daily Demand Row (Highlighted in Blue)
    const grandTotalRow = [
      "—",
      "TOTAL DAILY WATER DEMAND",
      grandTotalVal,
      isSI ? "L/day" : "gal/day",
      "Combined Site Daily Service Load",
    ];
    (grandTotalRow as any)._isHighlight = true;
    summaryData.push(grandTotalRow);

    summaryData.push(
      [rowCounter++, "Total Storage Autonomy Retention", totalStorageVal, isSI ? "m³" : "gal", `${storageDays} Day(s) Mandatory Storage Duration`],
      [rowCounter++, "Ground Water Break Tank", groundTankVal, isSI ? "L" : "gal", `${calculations.groundPct}% Ground Split (${calculations.groundDim.l}m × ${calculations.groundDim.w}m × ${calculations.groundDim.h}m)`],
      [rowCounter++, "Transfer Pumping Duty Flow Rate", pumpFlowVal, isSI ? "L/s" : "GPM", `Designed for ${fillWindowHours}-Hour Roof Tank Filling Window`]
    );

    callAutoTable(doc, {
      startY: startY + 2,
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
        4: { halign: "left", cellWidth: 60 },
      },
      head: [
        [
          { content: "No.", halign: "center" },
          { content: "1. Executive Design Parameter Summary" },
          { content: "Value", halign: "center" },
          { content: "Unit", halign: "center" },
          { content: "Standard / Code Reference" },
        ],
      ],
      body: summaryData,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body" && rawRow && rawRow._isHighlight) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = blueFill;
        }
      },
    });

    let currentY = (doc as any).lastAutoTable?.finalY ?? 110;

    // 4. Table 2: Water Storage Tanks & Transfer Pump Physical Sizing Distribution
    const tanksBody: any[] = [
      [
        1,
        "Ground Water Break Tank",
        "Reinforced Concrete / Sectional GRP",
        `${calculations.groundPct}%`,
        groundTankVal,
        isSI ? "L" : "gal",
        `${calculations.groundDim.l}m L × ${calculations.groundDim.w}m W × ${calculations.groundDim.h}m H (+0.3m Freeboard)`,
      ],
      ...calculations.overheadTanksCalculated.map((t: any, idx: number) => [
        idx + 2,
        t.name,
        "Modular Sectional GRP / Polyethylene",
        `${t.sharePct.toFixed(0)}%`,
        isSI ? Math.round(t.volL).toLocaleString() : Math.round(t.volL / 3.78541).toLocaleString(),
        isSI ? "L" : "gal",
        `${t.dim.l}m L × ${t.dim.w}m W × ${t.dim.h}m H (+0.3m Freeboard)`,
      ]),
      [
        calculations.overheadTanksCalculated.length + 2,
        "Roof Transfer Pump",
        "Vertical Multistage Booster (1W + 1S)",
        "100% Roof",
        pumpFlowVal,
        isSI ? "L/s" : "GPM",
        `Designed for ${fillWindowHours}-Hour Roof Tank Filling Window`,
      ],
    ];

    const tanksTotalRow = [
      "",
      "TOTAL STORAGE RETENTION",
      "Combined Ground & Overhead Autonomy",
      "100%",
      totalStorageVal,
      isSI ? "m³" : "gal",
      `${storageDays} Day(s) Continuous Supply Storage`,
    ];
    (tanksTotalRow as any)._isTotal = true;
    tanksBody.push(tanksTotalRow);

    callAutoTable(doc, {
      startY: currentY + 6,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "left", cellWidth: 38 },
        2: { halign: "left", cellWidth: 38 },
        3: { halign: "center", cellWidth: 16 },
        4: { halign: "right", cellWidth: 24, fontStyle: "bold" },
        5: { halign: "center", cellWidth: 14 },
        6: { halign: "left", cellWidth: 44 },
      },
      head: [
        [
          { content: "No." },
          { content: "2. Facility / Equipment", halign: "left" },
          { content: "Specification & Tank Type", halign: "left" },
          { content: "Allocation" },
          { content: "Capacity / Flow" },
          { content: "Unit" },
          { content: "Dimensions / Operating Duty", halign: "left" },
        ],
      ],
      body: tanksBody,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body" && rawRow && rawRow._isTotal) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = blueFill;
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? 170;

    // 5. Table 3: Comprehensive Domestic Water Demand Schedule
    const wdBody: any[] = [];
    wdRows.forEach((r, idx) => {
      const rowTotal = !isSI
        ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541)
        : Math.round(r.ppl * r.lpd * (r.multiplier || 1));
      const rowRate = !isSI ? Math.round(r.lpd / 3.78541) : r.lpd;

      wdBody.push([
        idx + 1,
        r.name || `Space ${idx + 1}`,
        r.ppl,
        `×${r.multiplier || 1}`,
        r.cat || "General",
        rowRate.toLocaleString(),
        rowTotal.toLocaleString(),
      ]);
    });

    const wdTotalRow = [
      "",
      "TOTAL DOMESTIC LOAD",
      calculations.totalPeople,
      "",
      "—",
      "—",
      domLoadVal,
    ];
    (wdTotalRow as any)._isTotal = true;
    wdBody.push(wdTotalRow);

    callAutoTable(doc, {
      startY: currentY + 6,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.2,
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "left", cellWidth: 44 },
        2: { halign: "center", cellWidth: 20 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "left", cellWidth: 36 },
        5: { halign: "right", cellWidth: 26 },
        6: { halign: "right", cellWidth: 30, fontStyle: "bold" },
      },
      head: [
        [
          { content: "No." },
          { content: "3. Domestic Space Description", halign: "left" },
          { content: "Occupancy" },
          { content: "Multiplier" },
          { content: "Occupancy Category", halign: "left" },
          { content: `Rate (${isSI ? "LPD" : "gpd"})` },
          { content: `Daily Demand (${isSI ? "L/day" : "gal/day"})` },
        ],
      ],
      body: wdBody,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body" && rawRow && rawRow._isTotal) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = blueFill;
        }
      },
    });

    currentY = (doc as any).lastAutoTable?.finalY ?? 220;

    // 6. Table 4: Irrigation Landscaping Schedule (if present)
    if (irrRows.length > 0) {
      const irrBody: any[] = [];
      let totalIrrArea = 0;
      irrRows.forEach((r, idx) => {
        const rowArea = Number(r.area) || 0;
        totalIrrArea += rowArea;
        const rowTotal = !isSI
          ? Math.round((rowArea * r.lpd) / 3.78541)
          : Math.round(rowArea * r.lpd);
        const rowRate = !isSI ? (r.lpd / 40.7458).toFixed(2) : r.lpd.toFixed(1);

        irrBody.push([
          idx + 1,
          r.vegType || `Zone ${idx + 1}`,
          rowArea.toLocaleString(),
          rowRate,
          rowTotal.toLocaleString(),
          "Automated Drip / Spray System",
        ]);
      });

      const irrTotalRow = [
        "",
        "TOTAL IRRIGATION DEMAND",
        `${totalIrrArea.toLocaleString()} ${isSI ? "m²" : "ft²"}`,
        "—",
        irrLoadVal,
        "Landscaping Total Autonomy",
      ];
      (irrTotalRow as any)._isTotal = true;
      irrBody.push(irrTotalRow);

      callAutoTable(doc, {
        startY: currentY + 6,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.2,
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { halign: "left", cellWidth: 44 },
          2: { halign: "center", cellWidth: 26 },
          3: { halign: "right", cellWidth: 26 },
          4: { halign: "right", cellWidth: 32, fontStyle: "bold" },
          5: { halign: "left", cellWidth: 46 },
        },
        head: [
          [
            { content: "No." },
            { content: "4. Irrigation Plant Zone", halign: "left" },
            { content: `Area (${isSI ? "m²" : "ft²"})` },
            { content: `Rate (${isSI ? "L/m²" : "gal/ft²"})` },
            { content: `Daily Demand (${isSI ? "L/day" : "gal/day"})` },
            { content: "Irrigation Strategy", halign: "left" },
          ],
        ],
        body: irrBody,
        didParseCell: function (data: any) {
          const rawRow = data.row.raw;
          if (data.section === "body" && rawRow && rawRow._isTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
          }
        },
      });

      currentY = (doc as any).lastAutoTable?.finalY ?? 240;
    }

    // 7. Table 5: Auxiliary Water Reserves (Swimming Pool & Fire Fighting) (if present)
    if (poolArea || fireFlow) {
      const auxBody: any[] = [];
      if (poolArea && poolDepth) {
        auxBody.push([
          1,
          "Swimming Pool Makeup",
          `${poolArea} ${isSI ? "m²" : "ft²"} × ${poolDepth} ${isSI ? "m" : "ft"} Depth`,
          poolLoadVal,
          `Evaporation ${poolEvap}%/day + Backwash Loss`,
        ]);
      }
      if (fireFlow) {
        auxBody.push([
          auxBody.length + 1,
          "Fire Fighting Dedicated Reserve",
          `${fireFlow} USGPM Fire Pump Flow`,
          fireReserveVal,
          "60-Min Standard Duration (NFPA 13/14 Life Safety)",
        ]);
      }

      callAutoTable(doc, {
        startY: currentY + 6,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.2,
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { halign: "left", cellWidth: 44 },
          2: { halign: "center", cellWidth: 42 },
          3: { halign: "right", cellWidth: 32, fontStyle: "bold" },
          4: { halign: "left", cellWidth: 56 },
        },
        head: [
          [
            { content: "No." },
            { content: "5. Auxiliary Facility", halign: "left" },
            { content: "Design Sizing Parameters" },
            { content: `Daily Demand / Reserve (${isSI ? "L" : "gal"})` },
            { content: "Engineering Standard", halign: "left" },
          ],
        ],
        body: auxBody,
      });

      currentY = (doc as any).lastAutoTable?.finalY ?? 250;
    }

    // 8. Signature Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(activeProj?.id || "default", "/plumbing-water-demand", meta.userName || "");
      addPdfSignatureBlock(doc, currentY, sigDetails, activeProj?.id || "default", "/plumbing-water-demand");
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

    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Water_Demand_Report_${activeProj?.code || "P000"}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Water Demand & Tank Sizing PDF exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportWaterDemandPDF error:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};
