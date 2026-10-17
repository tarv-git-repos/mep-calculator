import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface SprinklerExportRow {
  id: string;
  floor?: string;
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
  includeStamp?: boolean;
  reviewState?: any;
  returnBuffer?: boolean;
}

export const exportSprinklerKFactorPDF = async (
  rows: SprinklerExportRow[],
  meta: SprinklerProjectMetaData = {}
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
    const flowUnit = isSI ? "L/min" : "GPM";
    const areaUnit = isSI ? "mÂ²" : "ftÂ²";

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-SKF-001";
    const revNo = meta.revNo || activeProj?.revNo || "0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Sprinkler Hydraulic Calculation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    // 1. Standard Header & Metadata Block
    const startY = addPdfHeader(doc, "Sprinkler K-Factor Calculation Report", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    // 3. Group sprinklers by floor
    const sortedRows = [...rows].sort((a, b) => {
      const floorA = (a.floor || "GF").toLowerCase();
      const floorB = (b.floor || "GF").toLowerCase();
      if (floorA !== floorB) return floorA.localeCompare(floorB);
      return (a.label || "").localeCompare(b.label || "");
    });

    const rowsByFloor: { [floor: string]: SprinklerExportRow[] } = {};
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

    let grandFlow = 0;
    let grandCoverage = 0;

    floorOrder.forEach((floorName) => {
      const floorRows = rowsByFloor[floorName];
      let floorFlow = 0;
      let floorCoverage = 0;

      floorRows.forEach((r) => {
        const flowVal = Number(r.flow || 0);
        const covVal = Number(r.coverage || 0);
        const presVal = Number(r.pressure || 0);

        floorFlow += flowVal;
        floorCoverage += covVal;

        body.push([
          globalSrNo++,
          r.floor || "GF",
          r.label || "-",
          r.hazard || "Ordinary Hazard",
          r.kFactor ? `K-${Number(r.kFactor).toFixed(1)}` : "K-5.6",
          r.solveFor === "P" ? "Solve (P)" : "Solve (Q)",
          presVal.toFixed(2),
          covVal.toFixed(1),
          flowVal.toFixed(2),
          r.notes || "-"
        ]);
      });

      // Floor Total Row
      const floorTotalRow = [
        "",
        floorName,
        `TOTAL (${floorName})`,
        "",
        "",
        "",
        "",
        floorCoverage.toFixed(1),
        floorFlow.toFixed(2),
        ""
      ];
      (floorTotalRow as any)._isFloorTotal = true;
      body.push(floorTotalRow);

      grandFlow += floorFlow;
      grandCoverage += floorCoverage;
    });

    // Grand Total Row if multiple floors
    if (floorOrder.length > 1) {
      const grandTotalRow = [
        "",
        "ALL",
        "GRAND TOTAL",
        "",
        "",
        "",
        "",
        grandCoverage.toFixed(1),
        grandFlow.toFixed(2),
        ""
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [217, 217, 217] as [number, number, number]; // Clean gray from Ventilation

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
        0: { cellWidth: 8 },                 // Sr. No.
        1: { cellWidth: 14 },                // Floor
        2: { halign: "left", cellWidth: 26 },// Label / ID
        3: { halign: "left", cellWidth: 28 },// Hazard Category
        4: { cellWidth: 15 },                // K-Factor
        5: { cellWidth: 18 },                // Mode
        6: { cellWidth: 18 },                // Pressure
        7: { cellWidth: 18 },                // Coverage
        8: { cellWidth: 18 },                // Flow Rate
        9: { halign: "left", cellWidth: 19 } // Notes / Remarks
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Sprinkler Specification", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Hydraulic Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Discharge & Flow Results", colSpan: 3, styles: { fillColor: primaryFill } }
        ],
        [
          { content: "Floor" },
          { content: "Sprinkler ID" },
          { content: "Hazard Class" },
          { content: "K-Factor" },
          { content: "Calc Mode" },
          { content: `Pressure\n(${pressureUnit})` },
          { content: `Coverage\n(${areaUnit})` },
          { content: `Flow Rate\n(${flowUnit})` },
          { content: "Remarks" }
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

    let currentY = (doc as any).lastAutoTable?.finalY ?? 150;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 280) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 4. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProj?.id || "default",
        "/plumbing-sprinkler-kfactor",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProj?.id || "default",
        "/plumbing-sprinkler-kfactor"
      );
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

    await downloadFile(new Uint8Array(pdfBuffer), `Sprinkler_KFactor_Report_${projectNo}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Sprinkler K-Factor PDF exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportSprinklerKFactorPDF error:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};
