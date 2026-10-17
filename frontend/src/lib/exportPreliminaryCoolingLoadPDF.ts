import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
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
  includeStamp?: boolean;
  returnBuffer?: boolean;
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
    const revNo = meta.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Preliminary Cooling Load Estimation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Preliminary Cooling Load Calculation", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

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
    let grandOcc = 0;

    floorOrder.forEach((floorName) => {
      const floorRows = rowsByFloor[floorName];
      let floorArea = 0;
      let floorWatts = 0;
      let floorKw = 0;
      let floorTr = 0;
      let floorOcc = 0;

      floorRows.forEach((r) => {
        const areaVal = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const densityVal = (typeof r.density === "number" && r.density > 0) ? r.density : 120;
        const wattsVal = (typeof r.dissipation === "number" && r.dissipation > 0)
          ? r.dissipation
          : Math.round(areaVal * densityVal);
        const kwVal = (typeof r.kw === "number" && r.kw > 0)
          ? r.kw
          : wattsVal / 1000;
        const trVal = (typeof r.tr === "number" && r.tr > 0)
          ? r.tr
          : kwVal / 3.517;

        const occCount = r.occupancy && r.occupancy !== "-"
          ? (typeof r.occupancy === "number" ? r.occupancy : (parseInt(String(r.occupancy)) || 0))
          : 0;

        floorArea += areaVal;
        floorWatts += wattsVal;
        floorKw += kwVal;
        floorTr += trVal;
        floorOcc += occCount;

        body.push([
          globalSrNo++,
          r.floor || "GF",
          r.name || "-",
          r.type || "General",
          areaVal.toFixed(1),
          occCount > 0 ? occCount : "-",
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
        floorOcc > 0 ? floorOcc : "",
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
      grandOcc += floorOcc;
    });

    // Grand Total Row if multiple floors
    if (floorOrder.length > 1) {
      const grandTotalRow = [
        "",
        "ALL",
        "GRAND TOTAL",
        "",
        grandArea.toFixed(1),
        grandOcc > 0 ? grandOcc : "",
        grandArea > 0 ? ((grandWatts / grandArea)).toFixed(0) : "",
        Math.round(grandWatts),
        grandKw.toFixed(2),
        grandTr.toFixed(2)
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean neutral corporate gray matching Ventilation

    callAutoTable(doc, {
      startY: startY + 2,
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
        0: { cellWidth: 8 },                  // Sr. No.
        1: { cellWidth: 14 },                 // Floor
        2: { halign: "left", cellWidth: 32 }, // Space Name
        3: { halign: "left", cellWidth: 28 }, // Space Type
        4: { cellWidth: 18 },                 // Area (m²)
        5: { cellWidth: 14 },                 // Occupancy
        6: { cellWidth: 18 },                 // Density (W/m²)
        7: { cellWidth: 20 },                 // Heat Gain (W)
        8: { cellWidth: 15, fillColor: [242, 248, 253] }, // Load (kW) - Soft blue highlight
        9: { cellWidth: 15, fillColor: [242, 248, 253] }  // Load (TR) - Soft blue highlight
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Space Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Design Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Cooling Load Metrics", colSpan: 3, styles: { fillColor: primaryFill } }
        ],
        [
          { content: "Space Floor", styles: { fillColor: primaryFill } },
          { content: "Space Name", styles: { fillColor: primaryFill } },
          { content: "Space Type", styles: { fillColor: primaryFill } },
          { content: "Area\n(m²)", styles: { fillColor: primaryFill } },
          { content: "Occupancy", styles: { fillColor: primaryFill } },
          { content: "Density\n(W/m²)", styles: { fillColor: primaryFill } },
          { content: "Heat Gain\n(W)", styles: { fillColor: primaryFill } },
          { content: "Load\n(kW)", styles: { fillColor: primaryFill } },
          { content: "Load\n(TR)", styles: { fillColor: primaryFill } }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isGrandTotal = rawRow && rawRow._isGrandTotal;
          const isFloorTotal = rawRow && rawRow._isFloorTotal;
          if (isGrandTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [218, 233, 248]; // Highlight grand total row with soft blue fill
          } else if (isFloorTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 243, 246]; // Soft light gray-blue for floor total
            if (data.column.index === 8 || data.column.index === 9) {
              data.cell.styles.fillColor = [225, 238, 250]; // Highlighted cooling load totals
            }
          } else if (data.column.index === 8 || data.column.index === 9) {
            data.cell.styles.fillColor = [242, 248, 253]; // Light blue for standard body cooling load result cells
            data.cell.styles.fontStyle = "bold"; // Bold for important result metrics
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

    // 4. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(activeProj?.id || "default", "/preliminary-cooling-load", meta.userName || "");
      addPdfSignatureBlock(doc, finalY, sigDetails, activeProj?.id || "default", "/preliminary-cooling-load");
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

    await downloadFile(new Uint8Array(pdfBuffer), `Preliminary_Cooling_Load_Calculation_${activeProj?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Preliminary Cooling Load PDF exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportPreliminaryCoolingLoadPDF error:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};
