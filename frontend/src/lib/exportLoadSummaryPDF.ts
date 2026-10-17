import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import {
  type LoadRow,
  cleanSpaceName,
  extractFloorName,
  cleanRemarks
} from "./calc-load-summary";
import { toast } from "sonner";

export interface LoadSummaryPDFMeta {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
  includeStamp?: boolean;
  returnBuffer?: boolean;
}

export interface LoadSummaryExportData {
  rows: LoadRow[];
  filteredRows?: LoadRow[];
  totalPower?: number;
  totalPowerWithSafety?: number;
  transformers?: string;
  unitSystem?: "si" | "ip";
  sortedFloorOrder?: string[];
  meta?: LoadSummaryPDFMeta;
}

export async function exportLoadSummaryPDF(
  data: LoadSummaryExportData,
  unitSystem: "si" | "ip" = "si",
  options: LoadSummaryPDFMeta = {}
): Promise<Uint8Array | boolean> {
  const meta = { ...data.meta, ...options };
  const rows = data.rows || [];
  const exportRows = data.filteredRows && data.filteredRows.length > 0 ? data.filteredRows : rows;

  if (exportRows.length === 0) {
    if (!meta.returnBuffer) toast.error("No spaces available to export.");
    return false;
  }

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const callAutoTable = (tDoc: any, tOptions: any) => {
      if (typeof autoTable === "function") {
        autoTable(tDoc, tOptions);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(tDoc, tOptions);
      } else if ((tDoc as any).autoTable) {
        (tDoc as any).autoTable(tOptions);
      }
    };

    const state = workspaceStore.getState();
    const activeProj: any = state.project || {};

    const projectName = meta.projectName || activeProj?.name || "Electrical Load Summary";
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "TRV-EED-001";
    const calcNo = meta.calcNo || "CEC-EED-PXXX-203";
    const revNo = meta.revNo || "R0";
    const clientName = meta.client || activeProj?.client || "-";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "-";
    const currentDate = meta.date || formatDateStr(new Date().toISOString());
    const currentUserName = meta.userName || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("mep_user") || "{}")?.name : "") || "System Admin";

    // Column styles for 182mm printable width
    const columnStyles = {
      0: { cellWidth: 8, halign: "center" as const },
      1: { cellWidth: 38, halign: "left" as const },
      2: { cellWidth: 14, halign: "center" as const },
      3: { cellWidth: 16, halign: "center" as const },
      4: { cellWidth: 16, halign: "center" as const },
      5: { cellWidth: 16, halign: "center" as const },
      6: { cellWidth: 16, halign: "center" as const },
      7: { cellWidth: 18, halign: "center" as const },
      8: { cellWidth: 18, halign: "center" as const },
      9: { cellWidth: 22, halign: "left" as const }
    };

    // 1. Standard Header & Metadata Block
    const startY = addPdfHeader(doc, "Electrical Load Summary Calculation", {
      calcNo,
      revNo,
      date: currentDate,
      projectNo,
      projectName,
      client: clientName,
      endUser,
    });

    // 2. Main Data Rows grouped floor-wise
    const dataRows: any[] = [];
    let globalIndex = 1;

    const floorGroups: Record<string, LoadRow[]> = {};
    exportRows.forEach((r) => {
      const fl = r.floor || extractFloorName(r);
      if (!floorGroups[fl]) floorGroups[fl] = [];
      floorGroups[fl].push(r);
    });

    const defaultSortedFloors = data.sortedFloorOrder || Object.keys(floorGroups);
    const floorsToExport = defaultSortedFloors.filter((fl) => floorGroups[fl] && floorGroups[fl].length > 0);
    Object.keys(floorGroups).forEach((fl) => {
      if (!floorsToExport.includes(fl)) floorsToExport.push(fl);
    });

    floorsToExport.forEach((fl) => {
      const floorRows = floorGroups[fl] || [];
      const floorCount = floorRows.length;
      const floorArea = floorRows.reduce((sum, r) => sum + (Number(r.area) || 0) * (Number(r.qty) || 1), 0);
      const floorLighting = floorRows.reduce((sum, r) => sum + (Number(r.lighting) || 0) * (Number(r.qty) || 1), 0);
      const floorPower = floorRows.reduce((sum, r) => sum + (Number(r.power) || 0) * (Number(r.qty) || 1), 0);
      const floorHvac = floorRows.reduce((sum, r) => sum + (Number(r.hvac) || 0) * (Number(r.qty) || 1), 0);
      const floorOther = floorRows.reduce((sum, r) => sum + (Number(r.other) || 0) * (Number(r.qty) || 1), 0);
      const floorTotalKw = floorRows.reduce((sum, r) => sum + (Number(r.totalLoad) || 0), 0);

      // Floor Section Header Row spanning all 10 columns
      dataRows.push([
        {
          content: `FLOOR: ${fl.toUpperCase()} (${floorCount} ${floorCount === 1 ? "space" : "spaces"} · ${floorTotalKw.toFixed(2)} kW · ${floorArea.toFixed(1)} ${unitSystem === "ip" ? "sq.ft" : "m²"})`,
          colSpan: 10,
          styles: {
            fillColor: [225, 235, 248],
            textColor: [12, 45, 90],
            fontStyle: "bold",
            halign: "left" as const,
            cellPadding: 2,
            fontSize: 8
          }
        }
      ]);

      // Each space in this floor
      floorRows.forEach((r) => {
        dataRows.push([
          { content: String(globalIndex++), styles: { halign: "center" as const } },
          { content: cleanSpaceName(r.description || ""), styles: { halign: "left" as const } },
          { content: String(r.qty ?? 0), styles: { halign: "center" as const } },
          { content: String(r.area ?? 0), styles: { halign: "center" as const } },
          { content: String(r.lighting ?? 0), styles: { halign: "center" as const } },
          { content: String(r.power ?? 0), styles: { halign: "center" as const } },
          { content: String(r.hvac ?? 0), styles: { halign: "center" as const } },
          { content: String(r.other ?? 0), styles: { halign: "center" as const } },
          { content: String(r.totalLoad ?? 0), styles: { halign: "center" as const } },
          { content: cleanRemarks(r.remarks) || "", styles: { halign: "left" as const } }
        ]);
      });

      // Floor Subtotal Row
      dataRows.push([
        {
          content: `Subtotal (${fl.toUpperCase()}):`,
          colSpan: 2,
          styles: { halign: "right" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252], textColor: [20, 50, 90] }
        },
        { content: "-", styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorArea.toFixed(1), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorLighting.toFixed(2), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorPower.toFixed(2), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorHvac.toFixed(2), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorOther.toFixed(2), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252] } },
        { content: floorTotalKw.toFixed(2), styles: { halign: "center" as const, fontStyle: "bold" as const, fillColor: [245, 248, 252], textColor: [12, 45, 90] } },
        { content: "", styles: { fillColor: [245, 248, 252] } }
      ]);
    });

    callAutoTable(doc, {
      startY: startY + 2,
      margin: { left: 14, right: 14, top: 14, bottom: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 1,
        valign: "middle"
      },
      head: [
        [
          { content: "S.No", styles: { halign: "center" } },
          { content: "Description", styles: { halign: "center" } },
          { content: "Qty\nunit", styles: { halign: "center" } },
          { content: unitSystem === "ip" ? "Area\nsq. ft." : "Area\nsq. m.", styles: { halign: "center" } },
          { content: "Lighting\nkW", styles: { halign: "center" } },
          { content: "Power\nkW", styles: { halign: "center" } },
          { content: "HVAC\nkW", styles: { halign: "center" } },
          { content: "Other Load\nkW", styles: { halign: "center" } },
          { content: "Total Load\nkW", styles: { halign: "center" } },
          { content: "Remarks", styles: { halign: "center" } }
        ]
      ],
      headStyles: {
        fillColor: [217, 217, 217],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        fontSize: 7.5
      },
      body: dataRows,
      columnStyles,
      tableWidth: 182
    });

    const calculatedTotalPower = data.totalPower !== undefined 
      ? data.totalPower 
      : exportRows.reduce((sum, r) => sum + (Number(r.totalLoad) || 0), 0);
    const calculatedTotalPowerWithSafety = data.totalPowerWithSafety !== undefined
      ? data.totalPowerWithSafety
      : calculatedTotalPower * 1.1;

    // Check remaining space before summary + references + signature block
    const neededSpace = 75;
    let currentY = (doc as any).lastAutoTable.finalY + 2;
    if (doc.internal.pageSize.getHeight() - currentY < neededSpace) {
      doc.addPage();
      currentY = 14;
    }

    // 3. Summary Rows Table
    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 1.2,
        valign: "middle"
      },
      body: [
        [
          { content: "  Total Electrical Power", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
          { content: `${calculatedTotalPower.toFixed(2)} kW`, styles: { halign: "center", fontStyle: "bold" } },
          { content: "", styles: { halign: "center" } }
        ],
        [
          { content: "  Total Power Required Considering 10% safety (kW)", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
          { content: `${calculatedTotalPowerWithSafety.toFixed(2)} kW`, styles: { halign: "center", fontStyle: "bold" } },
          { content: "", styles: { halign: "center" } }
        ],
        [
          { content: "  Selected Number of Transformers", colSpan: 8, styles: { halign: "left", fontStyle: "bold" } },
          { content: data.transformers || "1 x 1000 kVA", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } }
        ]
      ],
      columnStyles,
      tableWidth: 182
    });

    // 4. References Table
    callAutoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 1.2,
        valign: "middle",
        fontStyle: "bold"
      },
      body: [
        [{ content: "  Reference: 1. Architectural Drawings", colSpan: 10, styles: { halign: "left" } }],
        [{ content: "                    2. DBR", colSpan: 10, styles: { halign: "left" } }],
        [{ content: "                    3. Summary of Cooling Load", colSpan: 10, styles: { halign: "left" } }],
        [{ content: "                    4. Selection from Manufacturer", colSpan: 10, styles: { halign: "left" } }]
      ],
      tableWidth: 182
    });

    currentY = (doc as any).lastAutoTable?.finalY || 140;

    // Check page break for signature block (needs ~35mm)
    if (currentY + 35 > 280) {
      doc.addPage("a4", "portrait");
      currentY = 14;
    }

    // 5. Professional Engineering Review & Sign-Off Block & Branding
    if (meta.includeStamp !== false) {
      const sigDetails = getSignatureBlockDetails(
        activeProj?.id || "default",
        "/load-summary",
        meta.userName || currentUserName,
        meta.reviewState
      );
      addPdfSignatureBlock(
        doc,
        currentY,
        sigDetails,
        activeProj?.id || "default",
        "/load-summary"
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

    const fileName = `Load_Summary_${(projectNo || projectName || "Project").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Electrical Load Summary PDF exported successfully!");
    return true;
  } catch (err: any) {
    console.error("Failed to export Load Summary PDF:", err);
    if (!meta.returnBuffer) {
      toast.error(err?.message || "Failed to export Load Summary PDF.");
    }
    return false;
  }
}
