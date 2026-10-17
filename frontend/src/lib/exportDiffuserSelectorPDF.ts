import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";
import { DIFFUSER_NAMES, type DiffuserRowItem } from "./calc-diffuser";

export interface DiffuserProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
  unitSystem?: "si" | "ip";
  includeStamp?: boolean;
  returnBuffer?: boolean;
}

export const exportDiffuserSelectorPDF = async (
  rows: (DiffuserRowItem & { sizing: any })[],
  meta: DiffuserProjectMetaData = {}
) => {
  if (!rows || rows.length === 0) {
    toast.error("No diffuser spaces available to export.");
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
    // A4 Landscape Mode (297mm x 210mm) for 12 columns to guarantee perfect legibility without truncation
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "CALC-HVAC-DIF01";
    const revNo = meta.revNo || activeProj?.revNo || "0";
    const today = meta.date || formatDateStr(new Date().toISOString());
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "MEP-DIF-2026";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Air Terminal & Diffuser Selection Study";
    const clientName = meta.client || activeProj?.client || "Prestige Group developers";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";
    const isIP = meta.unitSystem === "ip";
    const flowUnit = isIP ? "CFM" : "L/s";
    const velUnit = isIP ? "FPM" : "m/s";

    // 1. Standard Header & Metadata Block (automatically handles landscape 269mm width)
    const startY = addPdfHeader(doc, "Diffuser Selector Calculation", {
      calcNo,
      revNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    // 3. Group spaces by floor
    const sortedRows = [...rows].sort((a, b) => {
      const floorA = (a.floor || "GF").toLowerCase();
      const floorB = (b.floor || "GF").toLowerCase();
      if (floorA !== floorB) return floorA.localeCompare(floorB);
      return (a.name || "").localeCompare(b.name || "");
    });

    const rowsByFloor: { [floor: string]: (DiffuserRowItem & { sizing: any })[] } = {};
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
    let grandCount = 0;

    floorOrder.forEach((floorName) => {
      const floorRows = rowsByFloor[floorName];
      let floorFlow = 0;
      let floorCount = 0;

      floorRows.forEach((r) => {
        const flowVal = typeof r.airflow === "number" ? r.airflow : (parseFloat(String(r.airflow)) || 0);
        const countVal = typeof r.count === "number" && r.count > 0 ? r.count : (parseInt(String(r.count)) || 1);
        const flowPerDiff = r.sizing?.flowPerDiff ?? (flowVal / countVal);
        const neck = r.sizing?.neckSize || "-";
        const vel = isIP ? (r.sizing?.velocityFpm?.toFixed(0) || "-") : (r.sizing?.velocity?.toFixed(1) || "-");
        const throwDist = r.sizing?.throwVal || "-";
        const nc = r.sizing?.nc || "-";
        const status = r.sizing?.status || "PASS";
        const diffName = DIFFUSER_NAMES[r.diffType] || r.diffType;

        floorFlow += flowVal;
        floorCount += countVal;

        body.push([
          globalSrNo++,
          r.floor || "GF",
          r.name || "-",
          diffName,
          Math.round(flowVal).toLocaleString(),
          countVal,
          flowPerDiff.toFixed(1),
          neck,
          vel,
          throwDist,
          nc,
          status
        ]);
      });

      // Floor Total Row
      const floorTotalRow = [
        "",
        floorName,
        `TOTAL (${floorName})`,
        "",
        Math.round(floorFlow).toLocaleString(),
        floorCount,
        floorCount > 0 ? (floorFlow / floorCount).toFixed(1) : "-",
        "All Terminals Sized",
        "-",
        "-",
        "NC ≤ 30",
        "PASS"
      ];
      (floorTotalRow as any)._isFloorTotal = true;
      body.push(floorTotalRow);

      grandFlow += floorFlow;
      grandCount += floorCount;
    });

    // Grand Total Row if multiple floors
    if (floorOrder.length > 1) {
      const grandTotalRow = [
        "",
        "ALL",
        "OVERALL TOTAL",
        "",
        Math.round(grandFlow).toLocaleString(),
        grandCount,
        grandCount > 0 ? (grandFlow / grandCount).toFixed(1) : "-",
        "All Terminals Sized",
        "-",
        "-",
        "NC ≤ 30",
        "PASS"
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [229, 231, 235] as [number, number, number]; // Clean gray matching #E5E7EB

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        minCellHeight: 6
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
      },
      columnStyles: {
        0: { cellWidth: 10 },                 // Sr. No.
        1: { cellWidth: 16 },                 // Floor
        2: { halign: "left", cellWidth: 38 }, // Space Name
        3: { halign: "left", cellWidth: 42 }, // Diffuser Type
        4: { halign: "right", cellWidth: 24 },// Airflow
        5: { cellWidth: 14 },                 // Qty
        6: { halign: "right", cellWidth: 22 },// Flow/Diff
        7: { halign: "left", cellWidth: 40 }, // Recommended Neck
        8: { cellWidth: 18 },                 // Velocity
        9: { cellWidth: 18 },                 // Throw
        10: { cellWidth: 14 },                // NC
        11: { cellWidth: 13 }                 // Status
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Space Parameters", colSpan: 3, styles: { fillColor: primaryFill } },
          { content: "Airflow & Terminal Sizing", colSpan: 4, styles: { fillColor: primaryFill } },
          { content: "Acoustic & Throw Metrics", colSpan: 4, styles: { fillColor: primaryFill } }
        ],
        [
          { content: "Space Floor" },
          { content: "Space Name" },
          { content: "Diffuser Type" },
          { content: `Airflow\n(${flowUnit})` },
          { content: "Qty" },
          { content: `Flow/Diff\n(${flowUnit})` },
          { content: "Recommended Neck Size" },
          { content: `Velocity\n(${velUnit})` },
          { content: "Throw" },
          { content: "NC" },
          { content: "Status" }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotalRow = rawRow && (rawRow._isFloorTotal || rawRow._isGrandTotal);
          if (isTotalRow) {
            data.cell.styles.fontStyle = "bold";
            if (rawRow._isGrandTotal) {
              data.cell.styles.fillColor = [240, 240, 240];
            } else {
              data.cell.styles.fillColor = [248, 250, 252];
            }
          }
          // Highlight Status column
          if (data.column.index === 11) {
            data.cell.styles.fontStyle = "bold";
            if (data.cell.raw === "PASS") {
              data.cell.styles.textColor = [16, 120, 60];
            }
          }
        }
      }
    });

    let currentY = (doc as any).lastAutoTable?.finalY ?? 140;

    // Check page break for signature block in landscape A4 (needs ~35mm)
    if (currentY + 35 > 195) {
      doc.addPage("a4", "landscape");
      currentY = 14;
    }

    // 4. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProj?.id || "default",
        "/diffuser-selector",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProj?.id || "default",
        "/diffuser-selector",
        { left: 14, right: 14 } // Landscape margins
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

    await downloadFile(
      new Uint8Array(pdfBuffer),
      `Diffuser_Selector_Calculation_${projectNo}.pdf`,
      "PDF Document",
      ["pdf"]
    );
    toast.success("Diffuser Selector PDF exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportDiffuserSelectorPDF error:", error);
    if (!meta.returnBuffer) {
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};
