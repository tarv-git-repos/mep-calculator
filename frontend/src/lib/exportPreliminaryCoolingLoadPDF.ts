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

    const calcNo = meta.calcNo || activeProj?.calcNo || "CEC-MED-PXXX-110 Rev. No: 0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Preliminary HVAC Project";
    const clientName = meta.client || activeProj?.client || "Consistent Engineering Consultants";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "Standard Commercial / Residential";

    const leftMargin = 14;
    const rightMargin = 196; // 210 - 14
    const contentWidth = 182; // 196 - 14

    // Header Title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("PRELIMINARY COOLING LOAD CALCULATIONS", leftMargin, 13);

    // Metadata Box (matches CEC-MED-FRM-110)
    doc.setFontSize(8.5);
    doc.setLineWidth(0.3);
    doc.setDrawColor(40, 40, 40);
    doc.rect(leftMargin, 16, contentWidth, 18);

    // Vertical divider
    doc.line(105, 16, 105, 34);

    // Horizontal dividers
    doc.line(leftMargin, 22, rightMargin, 22);
    doc.line(leftMargin, 28, rightMargin, 28);

    // Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No:", leftMargin + 2, 20.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(calcNo), leftMargin + 28, 20.2);

    doc.setFont("helvetica", "bold");
    doc.text("Date       :", 107, 20.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(today), 122, 20.2);

    // Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No      :", leftMargin + 2, 26.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectNo), leftMargin + 28, 26.2);

    doc.setFont("helvetica", "bold");
    doc.text("Client     :", 107, 26.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(clientName), 122, 26.2);

    // Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name :", leftMargin + 2, 32.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectName), leftMargin + 28, 32.2);

    doc.setFont("helvetica", "bold");
    doc.text("End User :", 107, 32.2);
    doc.setFont("helvetica", "normal");
    doc.text(String(endUser), 124, 32.2);

    // Group rows by floor
    const groupedFloors: Record<string, PclExportRow[]> = {};
    const floorOrderList: string[] = [];

    rows.forEach((r) => {
      const fl = (r.floor || "GF").trim();
      if (!groupedFloors[fl]) {
        groupedFloors[fl] = [];
        floorOrderList.push(fl);
      }
      groupedFloors[fl].push(r);
    });

    const body: any[] = [];
    let globalSrNo = 1;
    let totalProjectArea = 0;
    let totalProjectTr = 0;
    let totalProjectKw = 0;
    let totalProjectFaLs = 0;

    const primaryHeaderFill = [224, 224, 224] as [number, number, number]; // #E0E0E0
    const floorHeaderFill = [238, 238, 238] as [number, number, number]; // #EEEEEE
    const subtotalFill = [200, 200, 200] as [number, number, number]; // #C8C8C8

    floorOrderList.forEach((floorName) => {
      const floorRows = groupedFloors[floorName];
      let floorArea = 0;
      let floorTr = 0;
      let floorKw = 0;

      // Floor Section Header Row
      const floorBannerRow = [
        {
          content: floorName.toUpperCase() + " FLOOR",
          colSpan: 6,
          styles: {
            fillColor: floorHeaderFill,
            fontStyle: "bold",
            halign: "center",
            textColor: [0, 0, 0],
          },
        },
      ];
      body.push(floorBannerRow);

      floorRows.forEach((r) => {
        const numArea = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const density = r.density || 120;
        const kw = r.kw || (numArea * density) / 1000;
        const tr = r.tr || kw / 3.51685;

        // Area per TR = Area / TR (m²/TR)
        const areaPerTr = tr > 0 ? (numArea / tr).toFixed(1) : (3516.85 / (density || 120)).toFixed(1);

        floorArea += numArea;
        floorTr += tr;
        floorKw += kw;

        body.push([
          globalSrNo++,
          r.name,
          numArea > 0 ? numArea.toFixed(1) : "-",
          r.occupancy ? String(r.occupancy) : "-",
          areaPerTr,
          tr.toFixed(2),
        ]);
      });

      totalProjectArea += floorArea;
      totalProjectTr += floorTr;
      totalProjectKw += floorKw;

      // Fresh Air estimation for floor
      const estimatedFaLs = Math.round(floorArea * 0.85);
      totalProjectFaLs += estimatedFaLs;
    });

    // 1. Total Cooling Load Row
    const totalCoolingLoadRow = [
      {
        content: "Total Cooling load",
        colSpan: 2,
        styles: { fillColor: subtotalFill, fontStyle: "bold", halign: "left" },
      },
      {
        content: totalProjectArea.toFixed(1),
        styles: { fillColor: subtotalFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: "-",
        styles: { fillColor: subtotalFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: totalProjectTr > 0 ? (totalProjectArea / totalProjectTr).toFixed(1) : "-",
        styles: { fillColor: subtotalFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: totalProjectTr.toFixed(2),
        styles: { fillColor: subtotalFill, fontStyle: "bold", halign: "center" },
      },
    ];
    body.push(totalCoolingLoadRow);

    // 2. Fresh Air Section Header
    const faNoteRow = [
      {
        content: "Consider Fresh Air greater between CEC-MED-FRM-101 and CEC-MED-FRM-102",
        colSpan: 6,
        styles: { fillColor: [255, 255, 255], fontStyle: "normal", halign: "left" },
      },
    ];
    body.push(faNoteRow);

    // 3. Fresh Air Header Row
    const faHeaderRow = [
      {
        content: "Fresh air",
        colSpan: 2,
        styles: { fillColor: primaryHeaderFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: "Area (L/s)",
        styles: { fillColor: primaryHeaderFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: "Occupancy (L/s)",
        styles: { fillColor: primaryHeaderFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: "Total FA (L/s)",
        styles: { fillColor: primaryHeaderFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: "TR",
        styles: { fillColor: primaryHeaderFill, fontStyle: "bold", halign: "center" },
      },
    ];
    body.push(faHeaderRow);

    // Fresh Air Calculations
    const faAreaLs = Math.round(totalProjectArea * 0.3);
    const faOccLs = Math.round(totalProjectArea * 0.45);
    const totalFaLs = totalProjectFaLs > 0 ? totalProjectFaLs : Math.max(faAreaLs + faOccLs, 100);
    const freshAirTr = Number(((totalFaLs * 1.2 * 1.006 * 14) / 3.51685 / 10).toFixed(2)) || Number((totalProjectTr * 0.15).toFixed(2));
    const grandTotalTr = Number((totalProjectTr + freshAirTr).toFixed(2));

    // Fresh Air Data Row
    const faDataRow = [
      {
        content: "Outdoor Fresh Air Supply",
        colSpan: 2,
        styles: { halign: "left" },
      },
      {
        content: faAreaLs.toLocaleString(),
        styles: { halign: "center" },
      },
      {
        content: faOccLs.toLocaleString(),
        styles: { halign: "center" },
      },
      {
        content: totalFaLs.toLocaleString(),
        styles: { halign: "center", fontStyle: "bold" },
      },
      {
        content: freshAirTr.toFixed(2),
        styles: { halign: "center", fontStyle: "bold" },
      },
    ];
    body.push(faDataRow);

    // Total Fresh Air Summary Row
    const totalFaRow = [
      {
        content: "Total Fresh Air",
        colSpan: 4,
        styles: { fillColor: floorHeaderFill, fontStyle: "bold", halign: "left" },
      },
      {
        content: totalFaLs.toLocaleString() + " L/s",
        styles: { fillColor: floorHeaderFill, fontStyle: "bold", halign: "center" },
      },
      {
        content: freshAirTr.toFixed(2),
        styles: { fillColor: floorHeaderFill, fontStyle: "bold", halign: "center" },
      },
    ];
    body.push(totalFaRow);

    // Grand Total Cooling Load + Fresh Air Row
    const grandTotalRow = [
      {
        content: "Total Cooling load + Fresh Air load (TR)",
        colSpan: 5,
        styles: {
          fillColor: subtotalFill,
          fontStyle: "bold",
          halign: "left",
          fontSize: 8.5,
        },
      },
      {
        content: grandTotalTr.toFixed(2),
        styles: {
          fillColor: subtotalFill,
          fontStyle: "bold",
          halign: "center",
          fontSize: 8.5,
        },
      },
    ];
    body.push(grandTotalRow);

    // References Section Rows
    body.push([
      {
        content: "Reference:",
        colSpan: 6,
        styles: { fontStyle: "bold", halign: "left", fillColor: [255, 255, 255] },
      },
    ]);
    body.push([
      {
        content: "1. Architectural Drawings: " + (meta.archDrawingRef || "Approved Architectural Drawings"),
        colSpan: 6,
        styles: { halign: "left", fillColor: [255, 255, 255] },
      },
    ]);
    body.push([
      {
        content: "2. DBR: " + (meta.dbrRef || "Approved Design Basis Report (DBR)"),
        colSpan: 6,
        styles: { halign: "left", fillColor: [255, 255, 255] },
      },
    ]);

    // Build Main Table with AutoTable
    callAutoTable(doc, {
      startY: 37,
      margin: { left: leftMargin, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [80, 80, 80],
        lineWidth: 0.15,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        minCellHeight: 6,
      },
      headStyles: {
        fillColor: primaryHeaderFill,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        fontSize: 8,
      },
      head: [
        [
          { content: "Sr. No.", styles: { cellWidth: 12 } },
          { content: "Description", styles: { halign: "left", cellWidth: 62 } },
          { content: "Area\n(Sq. M)", styles: { cellWidth: 26 } },
          { content: "Occupancy\n(No.)", styles: { cellWidth: 24 } },
          { content: "Area (Sq. M)\nper TR", styles: { cellWidth: 28 } },
          { content: "Total Cooling\ncapacity TR", styles: { cellWidth: 30 } },
        ],
      ],
      body: body,
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 62, halign: "left" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 28, halign: "center" },
        5: { cellWidth: 30, halign: "center" },
      },
    });

    // Signature Block Section
    const finalY = (doc as any).lastAutoTable?.finalY ?? 180;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(activeProjectId, "/preliminary-cooling-load", meta.userName || currentUserName);

    callAutoTable(doc, {
      startY: finalY + 6,
      margin: { left: leftMargin, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [80, 80, 80],
        lineWidth: 0.15,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: [255, 230, 204], // Peach / accent
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      head: [
        [
          { content: "", styles: { cellWidth: 28 } },
          { content: "Originated by", styles: { cellWidth: 51 } },
          { content: "Reviewed by", styles: { cellWidth: 51 } },
          { content: "Approved by", styles: { cellWidth: 52 } },
        ],
      ],
      body: [
        [
          { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedName, styles: { halign: "center" } },
          { content: reviewerName || "-", styles: { halign: "center" } },
          { content: approverName || "-", styles: { halign: "center" } },
        ],
        [
          { content: "Signature:", styles: { fontStyle: "bold", halign: "right" } },
          { content: "", styles: { halign: "center" } },
          { content: "", styles: { halign: "center" } },
          { content: "", styles: { halign: "center" } },
        ],
        [
          { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
          { content: originatedDate, styles: { halign: "center" } },
          { content: reviewerDate || "-", styles: { halign: "center" } },
          { content: approverDate || "-", styles: { halign: "center" } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 51 },
        2: { cellWidth: 51 },
        3: { cellWidth: 52 },
      },
    });

    const pdfBuffer = doc.output("arraybuffer");
    const safeProjectName = (projectName || "Preliminary_Cooling_Load").replace(/[^a-zA-Z0-9_-]/g, "_");
    await downloadFile(
      new Uint8Array(pdfBuffer),
      `CEC_MED_FRM_110_${safeProjectName}_Report.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Preliminary Cooling Load PDF exported successfully!");
  } catch (error: any) {
    console.error("exportPreliminaryCoolingLoadPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
