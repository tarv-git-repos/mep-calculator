import { workspaceStore } from "@/lib/workspace-store";
import { toast } from "sonner";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "@/lib/download";
import {
  type LUSpace,
  type StandardPreset,
  LU_FIXTURES_META,
  PIPE_SIZING_TABLE,
  getStandardDemandHeaderTitle,
  calculateSpaceLU
} from "./calc-plumbing-loading-unit";

export interface LoadingUnitExportData {
  iopSpaces: LUSpace[];
  floorSections: string[];
  activeWeights: Record<string, number>;
  standardPreset: StandardPreset;
  selectedCategory: string;
  unitLabel: string;
  calculations: {
    totalLU: number;
    spaceUnitLU: Record<number, number>;
    spaceTotalsLU: Record<number, number>;
    flowLPS: number;
    flowGPM: number;
    selectedFlowLPS: number;
    pipeSizing: { sizeMM: number; maxFlowLPS: number };
    unitLabel: string;
    displayFlow: string;
    displaySelectedFlow: string;
  };
  showSpaceQty?: boolean;
  showFloorsCol?: boolean;
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

export const exportLoadingUnitPDF = async (data: LoadingUnitExportData): Promise<Uint8Array | boolean | void> => {
  const {
    iopSpaces,
    floorSections,
    activeWeights,
    standardPreset,
    selectedCategory,
    unitLabel,
    calculations,
    showSpaceQty = true,
    showFloorsCol = true,
    meta = {}
  } = data;

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

    const jsPDFModule = await import("jspdf");
    const JsPDFClass = jsPDFModule.default || (jsPDFModule as any).jsPDF || jsPDFModule;
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default || autoTableModule;

    // A4 Landscape Mode (297mm x 210mm) matching Ventilation / Corporate MEP standard
    const doc = new JsPDFClass("landscape", "mm", "a4");

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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-LU-CALC-R01";
    const revNo = meta.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = meta.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Water Supply Fixture Unit & Pipe Sizing";
    const clientName = meta.client || activeProj?.client || "Design Client";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Site Development";

    const primaryFill: [number, number, number] = [217, 217, 217]; // Uniform Gray #D9D9D9 (Matching Ventilation)
    const blueFill: [number, number, number] = [218, 233, 248];    // Soft Blue Highlight #DAE9F8 (Matching Ventilation)

    // 1. Header Title & Metadata Block (Using standard branded format)
    const startY = addPdfHeader(doc, "Loading Unit & Water Supply Fixture Sizing", {
      calcNo,
      revNo,
      projectNo,
      projectName,
      client: clientName,
      endUser,
      date: today
    });

    const appTitle = getStandardDemandHeaderTitle(standardPreset);

    // 2. Table 1: Executive Design Parameter & Demand Sizing Summary
    const summaryTableRows = [
      [
        { content: "No.", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Executive Design Parameter Summary", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Value", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Unit", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Engineering Design Basis", styles: { fontStyle: "bold", halign: "left", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ["1", "Total Water Supply Connected Spaces", `${iopSpaces.length}`, "spaces", "Architectural Space & Fixture Schedule"],
      ["2", "Total Water Supply Fixture Units", `${calculations.totalLU.toFixed(1)}`, unitLabel, `${iopSpaces.length} Space Definition(s) (Conforming to standard fixture ratings)`],
      ["3", "Simultaneous Peak Demand Flow Rate", `${calculations.flowLPS.toFixed(3)}`, "L/s", `Interpolated standard diversity curve (${appTitle})`],
      ["4", "Recommended Header Pipe Size", `DN${calculations.pipeSizing.sizeMM}`, "mm", `Velocity limit V <= 1.5 - 2.0 m/s (Maximum capacity: ${calculations.pipeSizing.maxFlowLPS} L/s)`],
      ["5", "No. of Booster Pumps (Configuration)", "1W + 1A + 1S", "Units", "Standard triplex booster pump station arrangement"],
      [
        { content: "6", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Selected Booster Pump Duty Flow Rate (Q)", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } },
        { content: `${calculations.selectedFlowLPS.toFixed(1)}`, styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "L/s", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "center" } },
        { content: "Design peak demand flow rate with standard margin", styles: { fontStyle: "bold", fillColor: blueFill, textColor: [0, 0, 0], halign: "left" } }
      ]
    ];

    callAutoTable(doc, {
      startY: startY + 2,
      body: summaryTableRows,
      theme: "grid",
      pageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 7.2,
        textColor: [0, 0, 0],
        valign: "middle",
        lineColor: [110, 110, 110],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 2.5, right: 2.5 },
        minCellHeight: 6.0
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { fontStyle: "semibold", cellWidth: 90, halign: "left" },
        2: { cellWidth: 35, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 110, halign: "left" }
      },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 75;

    // 4. Table 2: Detailed Sanitary Fixtures & Loading Unit Schedule
    const activeFixtures = LU_FIXTURES_META;
    const FIXTURE_LABELS: Record<string, string> = {
      wc: "W/C",
      handspray: "Hand Spray",
      basin: "Wash Basin",
      sink: "Sink Kitchen",
      shower: "Shower",
      washer: "Washing M/c",
      servicesink: "Service Sink",
      hose_bibb: "Hose Bibb",
      dishwasher: "Dishwasher",
      hose_bibb_1: "Bib Tap"
    };

    const summaryColSpan = 1 + (showSpaceQty ? 1 : 0) + (showFloorsCol ? 1 : 0) + 1;
    const totalHeaderCols = 1 + activeFixtures.length + summaryColSpan;

    const multiLevelHeaders = [
      [
        { content: "Description / Space", rowSpan: 3, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", valign: "middle", halign: "center" } },
        { content: "Sanitary Fixture Quantities", colSpan: activeFixtures.length, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } },
        { content: "Loading Unit Summary", colSpan: summaryColSpan, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }
      ],
      [
        ...activeFixtures.map(f => {
          const label = FIXTURE_LABELS[f.id] || f.short || f.id.toUpperCase();
          return { content: label, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } };
        }),
        { content: `${unitLabel} /\nSpace`, rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } },
        ...(showSpaceQty ? [{ content: "Space\nQty", rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }] : []),
        ...(showFloorsCol ? [{ content: "No. of\nFloors", rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }] : []),
        { content: `TOTAL\n${unitLabel}`, rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }
      ],
      [
        ...activeFixtures.map(f => {
          const weight = activeWeights[f.id] ?? 0;
          return { content: `${weight}`, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } };
        })
      ]
    ];

    const tableRows: any[] = [];

    floorSections.forEach(fl => {
      const floorItems = iopSpaces.filter(s => (s.floor || "6th FLOOR") === fl);
      if (floorItems.length === 0) return;

      // Floor Section Header Row
      tableRows.push([
        { content: `${fl.toUpperCase()}`, colSpan: totalHeaderCols, styles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" } }
      ]);

      let floorTotalLU = 0;

      floorItems.forEach((item: LUSpace) => {
        const unitLU = calculations.spaceUnitLU[item.id] || 0;
        const totalLu = calculations.spaceTotalsLU[item.id] || 0;
        floorTotalLU += totalLu;

        const rowData = [
          item.desc || "Space",
          ...activeFixtures.map(f => item.fixtures[f.id] || ""),
          Number(unitLU.toFixed(1)),
          ...(showSpaceQty ? [item.qty || 1] : []),
          ...(showFloorsCol ? [item.floorQty || 1] : []),
          Number(totalLu.toFixed(1))
        ];
        tableRows.push(rowData);
      });

      // Floor Subtotal Row (Soft Blue Highlighted #DAE9F8)
      const floorSubtotalRow = [
        { content: `TOTAL (${fl.toUpperCase()})`, colSpan: totalHeaderCols - 1, styles: { fontStyle: "bold", halign: "right", fillColor: blueFill, textColor: [0, 0, 0] } },
        { content: `${floorTotalLU.toFixed(1)} ${unitLabel}`, styles: { fontStyle: "bold", halign: "center", fillColor: blueFill, textColor: [0, 0, 0] } }
      ];
      tableRows.push(floorSubtotalRow);
    });

    // Total Building LU Summary Row (Soft blue highlighted)
    tableRows.push([
      { content: "TOTAL BUILDING WATER SUPPLY LOADING UNITS", colSpan: totalHeaderCols - 1, styles: { fontStyle: "bold", halign: "right", fillColor: blueFill, textColor: [0, 0, 0] } },
      { content: `${calculations.totalLU.toFixed(1)} ${unitLabel}`, styles: { fontStyle: "bold", textColor: [0, 0, 0], halign: "center", fillColor: blueFill } }
    ]);

    const descWidth = 40;
    const numDataCols = activeFixtures.length + summaryColSpan;
    const dataColWidth = Number(((269 - descWidth) / numDataCols).toFixed(2));

    const tableColumnStyles: Record<number, any> = {
      0: { halign: "left", fontStyle: "bold", cellWidth: descWidth, cellPadding: { left: 3.0, right: 1.5, top: 2.0, bottom: 2.0 } }
    };

    for (let i = 1; i <= numDataCols; i++) {
      tableColumnStyles[i] = { cellWidth: dataColWidth, halign: "center" };
    }

    callAutoTable(doc, {
      startY: currentY + 5,
      head: multiLevelHeaders,
      body: tableRows,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 6.8,
        textColor: [0, 0, 0],
        halign: "center",
        valign: "middle",
        lineColor: [110, 110, 110],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
        minCellHeight: 6.0
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 6.8,
        halign: "center",
        valign: "middle",
        lineColor: [110, 110, 110],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 0.8, right: 0.8 },
        minCellHeight: 6.0
      },
      bodyStyles: {
        fontSize: 6.8,
        halign: "center",
        valign: "middle",
        lineColor: [110, 110, 110],
        lineWidth: 0.1,
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
        minCellHeight: 6.0
      },
      columnStyles: tableColumnStyles,
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY || 120;

    // Check page break for Table 3 (Pipe Sizing Schedule - needs ~70mm)
    if (currentY + 72 > 190) {
      doc.addPage("a4", "landscape");
      currentY = 14;
    }

    // 5. Table 3: Hydraulic Pipe Sizing & Velocity Limits Schedule
    const pipeTableRows = [
      [
        { content: "Nominal Pipe Size", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: `Design Flow Range (${unitLabel})`, styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Max Flow Capacity (L/s)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Flow @ 1.2 m/s (L/s)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Flow @ 1.5 m/s (L/s)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } },
        { content: "Flow @ 1.8 m/s (L/s)", styles: { fontStyle: "bold", halign: "center", fillColor: primaryFill, textColor: [0, 0, 0] } }
      ],
      ...PIPE_SIZING_TABLE.map((row) => {
        const isSelected = calculations.pipeSizing.sizeMM === row.sizeMM;
        const rowStyle = isSelected ? { fillColor: blueFill, fontStyle: "bold", textColor: [0, 0, 0] } : {};
        return [
          { content: `DN${row.sizeMM} mm`, styles: { halign: "center", fontStyle: "bold", ...rowStyle } },
          { content: row.wsfuRange, styles: { halign: "center", ...rowStyle } },
          { content: `${row.flowMax} L/s`, styles: { halign: "center", ...rowStyle } },
          { content: `${row.q4fps.toFixed(2)} L/s`, styles: { halign: "center", ...rowStyle } },
          { content: `${row.q5fps.toFixed(2)} L/s`, styles: { halign: "center", ...rowStyle } },
          { content: `${row.q6fps.toFixed(2)} L/s`, styles: { halign: "center", ...rowStyle } }
        ];
      })
    ];

    callAutoTable(doc, {
      startY: currentY + 5,
      body: pipeTableRows,
      theme: "grid",
      pageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 6.8,
        textColor: [0, 0, 0],
        valign: "middle",
        lineColor: [110, 110, 110],
        lineWidth: 0.1,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
        minCellHeight: 5.5
      },
      columnStyles: {
        0: { cellWidth: 44, halign: "center" },
        1: { cellWidth: 45, halign: "center" },
        2: { cellWidth: 45, halign: "center" },
        3: { cellWidth: 45, halign: "center" },
        4: { cellWidth: 45, halign: "center" },
        5: { cellWidth: 45, halign: "center" }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable?.finalY || currentY + 45;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 190) {
      doc.addPage("a4", "landscape");
      currentY = 14;
    }

    // 6. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProj?.id || "default",
        "/plumbing-loading-unit",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(doc, currentY, sigDetails, activeProj?.id || "default", "/plumbing-loading-unit");
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

    await downloadFile(new Uint8Array(pdfBuffer), `Loading_Unit_Calculation_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Loading Unit Calculation PDF exported successfully!");
    return true;

  } catch (err: any) {
    console.error("PDF export error:", err);
    if (!meta.returnBuffer) {
      toast.error(err?.message || "Failed to generate PDF export.");
    }
    return false;
  }
};
