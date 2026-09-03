import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-PCL-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Preliminary Cooling Load Estimation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Header Title (Matching Ventilation)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Preliminary Cooling Load Calculation Report", 14, 14);

    // 2. Metadata Block (Exact Ventilation 2-column format)
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

    // 3. Group spaces by floor
    const sortedRows = [...rows].sort((a, b) => {
      const floorA = (a.floor || "GF").toLowerCase();
      const floorB = (b.floor || "GF").toLowerCase();
      if (floorA !== floorB) return floorA.localeCompare(floorB);
      return (a.name || "").localeCompare(b.name || "");
    });

    const rowsByFloor: { [floor: string]: PclExportRow[] } = {};
    const floorOrder: string[] = [];

    sortedRows.forEach((r) => {
      const fl = r.floor || "GF";
      if (!rowsByFloor[fl]) {
        rowsByFloor[fl] = [];
        floorOrder.push(fl);
      }
      rowsByFloor[fl].push(r);
    });

    const body: any[] = [];
    let globalSrNo = 1;

    let grandArea = 0;
    let grandWatts = 0;
    let grandKw = 0;
    let grandTr = 0;

    floorOrder.forEach((floorName) => {
      const floorRows = rowsByFloor[floorName];
      let floorArea = 0;
      let floorWatts = 0;
      let floorKw = 0;
      let floorTr = 0;

      floorRows.forEach((r) => {
        const areaVal = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const densityVal = r.density || 120;
        const kwVal = typeof r.kw === "number" ? r.kw : (areaVal * densityVal) / 1000;
        const trVal = typeof r.tr === "number" ? r.tr : kwVal / 3.517;
        const wattsVal = r.dissipation || (areaVal * densityVal);

        floorArea += areaVal;
        floorWatts += wattsVal;
        floorKw += kwVal;
        floorTr += trVal;

        body.push([
          globalSrNo++,
          r.floor || "GF",
          r.name || "-",
          r.type || "General",
          areaVal.toFixed(1),
          r.occupancy || "-",
          densityVal.toFixed(0),
          Math.round(wattsVal),
          kwVal.toFixed(2),
          trVal.toFixed(2)
        ]);
      });

      // Floor Total Row
      const floorTotalRow = [
        "",
        floorName,
        `TOTAL (${floorName})`,
        "",
        floorArea.toFixed(1),
        "",
        floorArea > 0 ? ((floorWatts / floorArea)).toFixed(0) : "",
        Math.round(floorWatts),
        floorKw.toFixed(2),
        floorTr.toFixed(2)
      ];
      (floorTotalRow as any)._isFloorTotal = true;
      body.push(floorTotalRow);

      grandArea += floorArea;
      grandWatts += floorWatts;
      grandKw += floorKw;
      grandTr += floorTr;
    });

    // Grand Total Row if multiple floors
    if (floorOrder.length > 1) {
      const grandTotalRow = [
        "",
        "ALL",
        "GRAND TOTAL",
        "",
        grandArea.toFixed(1),
        "",
        grandArea > 0 ? ((grandWatts / grandArea)).toFixed(0) : "",
        Math.round(grandWatts),
        grandKw.toFixed(2),
        grandTr.toFixed(2)
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean gray from Ventilation

    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 },
        minCellHeight: 6.5
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
      },
      columnStyles: {
        0: { cellWidth: 8 },                 // Sr. No.
        1: { cellWidth: 14 },                // Floor
        2: { halign: "left", cellWidth: 32 },// Space Name
        3: { halign: "left", cellWidth: 28 },// Space Type
        4: { cellWidth: 18 },                // Area (m²)
        5: { cellWidth: 14 },                // Occupancy
        6: { cellWidth: 18 },                // Density (W/m²)
        7: { cellWidth: 20 },                // Watts (W)
        8: { cellWidth: 15 },                // Load (kW)
        9: { cellWidth: 15 }                 // Load (TR)
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Space Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Design Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Cooling Load Metrics", colSpan: 3, styles: { fillColor: primaryFill } }
        ],
        [
          { content: "Space Floor" },
          { content: "Space Name" },
          { content: "Space Type" },
          { content: "Area\n(m²)" },
          { content: "Occupancy" },
          { content: "Density\n(W/m²)" },
          { content: "Heat Gain\n(W)" },
          { content: "Load\n(kW)" },
          { content: "Load\n(TR)" }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotalRow = rawRow && (rawRow._isFloorTotal || rawRow._isGrandTotal);
          if (isTotalRow) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate
    } = getSignatureBlockDetails(activeProj?.id || "default", "/preliminary-cooling-load", meta.userName || "");

    // 4. Signature Block (Exact warm peach header from Ventilation)
    callAutoTable(doc, {
      startY: finalY + 8,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 8,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
      },
      headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
      head: [
        [
          { content: "" },
          { content: "Originated by" },
          { content: "Reviewed by" },
          { content: "Approved by" }
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
    await downloadFile(new Uint8Array(pdfBuffer), `Preliminary_Cooling_Load_Report_${activeProj?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Preliminary Cooling Load PDF exported successfully!");
  } catch (error: any) {
    console.error("exportPreliminaryCoolingLoadPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
