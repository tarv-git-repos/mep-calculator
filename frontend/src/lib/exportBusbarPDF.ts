import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addPdfHeader, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { calculateBusbarPanels, type LVPanel } from "./calc-busbar-calculation";
import { toast } from "sonner";

export const COPPER_BUSBAR_DATA: Record<string, { r: number; x: number; label: string }> = {
  "1000_rt": { r: 0.0523, x: 0.019, label: "1000 (Rt)" },
  "1000_r50": { r: 0.0474, x: 0.019, label: "1000 (R@50%RC)" },
  "1250_rt": { r: 0.0398, x: 0.017, label: "1250 (Rt)" },
  "1250_r50": { r: 0.0348, x: 0.017, label: "1250 (R@50%RC)" },
  "1600_rt": { r: 0.0277, x: 0.015, label: "1600 (Rt)" },
  "1600_r50": { r: 0.0237, x: 0.015, label: "1600 (R@50%RC)" },
  "2000_rt": { r: 0.0218, x: 0.014, label: "2000 (Rt)" },
  "2000_r50": { r: 0.0187, x: 0.014, label: "2000 (R@50%RC)" },
  "2500_rt": { r: 0.0177, x: 0.010, label: "2500 (Rt)" },
  "2500_r50": { r: 0.0151, x: 0.010, label: "2500 (R@50%RC)" },
  "3200_rt": { r: 0.0121, x: 0.006, label: "3200 (Rt)" },
  "3200_r50": { r: 0.0114, x: 0.006, label: "3200 (R@50%RC)" },
  "4000_rt": { r: 0.0108, x: 0.006, label: "4000 (Rt)" },
  "4000_r50": { r: 0.0093, x: 0.006, label: "4000 (R@50%RC)" },
  "5000_rt": { r: 0.0089, x: 0.005, label: "5000 (Rt)" },
  "5000_r50": { r: 0.0075, x: 0.005, label: "5000 (R@50%RC)" },
  "6300_rt": { r: 0.0065, x: 0.005, label: "6300 (Rt)" },
  "6300_r50": { r: 0.0061, x: 0.005, label: "6300 (R@50%RC)" }
};

export interface BusbarExportOptions {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  includeStamp?: boolean;
  returnBuffer?: boolean;
  allBusbarData?: Record<string, { r: number; x: number; label: string }>;
}

export async function exportBusbarPDF(
  data: {
    flatCalculatedSections?: any[];
    panels?: LVPanel[];
  },
  unitSystem: "si" | "ip" = "si",
  options: BusbarExportOptions = {}
): Promise<Uint8Array | boolean> {
  const busbarLookup = options.allBusbarData || COPPER_BUSBAR_DATA;

  let flatSections = data.flatCalculatedSections;
  if (!flatSections || flatSections.length === 0) {
    if (data.panels && data.panels.length > 0) {
      const calcPanels = calculateBusbarPanels(data.panels, busbarLookup, unitSystem);
      flatSections = calcPanels.flatMap(p => p.calcSections.map(s => ({ ...s, panelId: p.id, panelName: p.name })));
    } else {
      flatSections = [];
    }
  }

  try {
    const doc = new jsPDF("l", "mm", "a4");
    const primaryFill: [number, number, number] = [217, 217, 217];

    const runAutoTable = (tOpts: any) => {
      if (typeof autoTable === "function") {
        autoTable(doc, tOpts);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(doc, tOpts);
      } else if ((doc as any).autoTable) {
        (doc as any).autoTable(tOpts);
      }
    };

    let lastSectionCardEndY = 50;

    if (flatSections.length === 0) {
      const startY = addPdfHeader(doc, "Busbar Sizing Calculation", options);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("No busbar sections calculated.", 14, startY + 5);
      lastSectionCardEndY = startY + 15;
    } else {
      flatSections.forEach((section: any, sIndex: number) => {
        if (sIndex > 0) doc.addPage();

        const headerStartY = addPdfHeader(doc, "Busbar Sizing Calculation", options);

        const ratingLabel = busbarLookup[section.ratingId]?.label || section.ratingId;
        const rawR = busbarLookup[section.ratingId]?.r || 0;
        const rawX = busbarLookup[section.ratingId]?.x || 0;
        const rVal = (unitSystem === "ip" ? (rawR * 0.3048) : rawR).toFixed(4);
        const xVal = (unitSystem === "ip" ? (rawX * 0.3048) : rawX).toFixed(4);
        const rUnit = unitSystem === "ip" ? "mOhm/ft" : "mOhm/m";

        // Styled Subheader Info Box
        const infoBoxStartY = headerStartY + 2;
        doc.setFillColor(245, 247, 250);
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(14, infoBoxStartY, 269, 12, 1.5, 1.5, "FD");

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`Panel: ${section.panelName || "Panel"}  |  Busbar Section: ${section.name || "Section"}`, 18, infoBoxStartY + 4.5);

        doc.setFontSize(8.0);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const useMd = section.useMdForCurrent !== false;
        const currentBasis = useMd ? "MD" : "TCL";
        doc.text(`Selected Busbar: ${ratingLabel} (R: ${rVal} ${rUnit}, X: ${xVal} ${rUnit})  |  Voltage: ${section.volts}V  |  PF: ${section.pf}  |  Current Basis: ${currentBasis}`, 18, infoBoxStartY + 9);

        const tableData = (section.calcRows || []).map((r: any, idx: number) => {
          const row = [
            idx + 1,
            r.desc || "",
            (r.length || 0).toString(),
            (r.loadKw || 0).toString(),
            (r.tcl || 0).toFixed(2),
          ];
          if (useMd) {
            row.push((r.md || 0).toFixed(2));
          }
          row.push(
            (r.current || 0).toFixed(2),
            (r.vd || 0).toFixed(2),
            (r.vdPercent || 0).toFixed(3) + "%",
            (r.cumulativeVdPercent || 0).toFixed(3) + "%"
          );
          return row;
        });

        const totalVd = (section.calcRows || []).reduce((sum: number, row: any) => sum + (Number(row.vd) || 0), 0);
        const totalCumVd = (section as any).totalCumulativeVd ?? (section.calcRows?.[section.calcRows.length - 1]?.cumulativeVdPercent ?? 0);
        const isExceeded = totalCumVd > 2.5;

        const footData = [
          useMd ? [
            "",
            "Cumulative VD up to SMDB",
            "",
            "",
            "",
            "",
            "",
            totalVd.toFixed(2) + " V",
            Number(totalCumVd).toFixed(3) + "%",
            isExceeded ? "EXCEEDS (FAIL)" : "PASS"
          ] : [
            "",
            "Cumulative VD up to SMDB",
            "",
            "",
            "",
            totalVd.toFixed(2) + " V",
            Number(totalCumVd).toFixed(3) + "%",
            isExceeded ? "EXCEEDS (FAIL)" : "PASS"
          ]
        ];

        const lenHeader = unitSystem === "ip" ? "Len (ft)" : "Len (m)";

        // Dynamic Column Widths (Printable width: 269mm)
        const columnStyles: Record<number, any> = useMd ? {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 45, halign: "left", fontStyle: "bold", cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } },
          2: { cellWidth: 26.5, halign: "center" },
          3: { cellWidth: 26.5, halign: "center" },
          4: { cellWidth: 26.5, halign: "center" },
          5: { cellWidth: 26.5, halign: "center" },
          6: { cellWidth: 26.5, halign: "center" },
          7: { cellWidth: 26.5, halign: "center" },
          8: { cellWidth: 26.5, halign: "center" },
          9: { cellWidth: 26.5, halign: "center" }
        } : {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 47, halign: "left", fontStyle: "bold", cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } },
          2: { cellWidth: 30, halign: "center" },
          3: { cellWidth: 30, halign: "center" },
          4: { cellWidth: 30, halign: "center" },
          5: { cellWidth: 30, halign: "center" },
          6: { cellWidth: 30, halign: "center" },
          7: { cellWidth: 30, halign: "center" },
          8: { cellWidth: 30, halign: "center" }
        };

        const pdfHead = [
          useMd
            ? ["No.", "Description", lenHeader, "Load\n(kW)", "TCL\n(kW)", "MD\n(kW)", "Current\n(A)", "Vdrop\n(V)", "Vdrop\n%", "Cum.\n%"]
            : ["No.", "Description", lenHeader, "Load\n(kW)", "TCL\n(kW)", "Current\n(A)", "Vdrop\n(V)", "Vdrop\n%", "Cum.\n%"]
        ];

        runAutoTable({
          head: pdfHead,
          body: tableData,
          foot: footData,
          startY: infoBoxStartY + 15,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 7.5,
            textColor: [0, 0, 0],
            halign: "center",
            valign: "middle",
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
            cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
            minCellHeight: 8.5
          },
          headStyles: {
            fillColor: primaryFill,
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            valign: "middle",
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
            cellPadding: { top: 3.0, bottom: 3.0, left: 1.0, right: 1.0 },
            minCellHeight: 8.5
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [0, 0, 0],
            halign: "center",
            valign: "middle",
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
            cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
            minCellHeight: 8.5
          },
          footStyles: {
            fillColor: isExceeded ? [255, 230, 230] : [240, 240, 240],
            textColor: isExceeded ? [180, 0, 0] : [0, 0, 0],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            valign: "middle",
            lineColor: [100, 100, 100],
            lineWidth: 0.1,
            minCellHeight: 8.5
          },
          columnStyles: columnStyles,
          margin: { left: 14, right: 14 }
        });

        const tableFinalY = (doc as any).lastAutoTable?.finalY || (infoBoxStartY + 35);
        const cardStartY = tableFinalY + 6;

        // Draw Summary & Recommendation Card (Spanning full 269mm width)
        doc.setFillColor(isExceeded ? 253 : 245, isExceeded ? 237 : 248, isExceeded ? 237 : 245);
        doc.setDrawColor(isExceeded ? 231 : 180, isExceeded ? 76 : 180, isExceeded ? 60 : 180);
        doc.roundedRect(14, cardStartY, 269, 14, 2, 2, "FD");

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isExceeded ? 192 : 39, isExceeded ? 57 : 174, isExceeded ? 43 : 96);
        doc.text(`SELECTED / SUGGESTED BUSBAR: ${ratingLabel}`, 18, cardStartY + 5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(`Cumulative Voltage Drop: ${Number(totalCumVd).toFixed(3)}% | Status: ${isExceeded ? 'EXCEEDS 2.5% STANDARD LIMIT (Select larger busbar rating)' : 'WITHIN 2.5% STANDARD LIMIT (PASS)'}`, 18, cardStartY + 10);

        lastSectionCardEndY = cardStartY + 14;
      });
    }

    const state = workspaceStore.getState();
    const activeProj: any = state.project || {};
    const currentUserName = options.userName || (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("mep_user") || "{}")?.name : "") || "System Admin";

    if (options.includeStamp !== false) {
      const sigFinalY = Math.max(lastSectionCardEndY + 8, 75);
      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(activeProj?.id || "default", "busbar-calculation", currentUserName);

      runAutoTable({
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        headStyles: {
          fillColor: [255, 230, 204],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || "-", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || "-", styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 77, halign: "center" },
          2: { cellWidth: 77, halign: "center" },
          3: { cellWidth: 77, halign: "center" }
        }
      });
    }

    const pdfBuffer = doc.output("arraybuffer");
    if (options.returnBuffer) {
      return new Uint8Array(pdfBuffer);
    }

    const fileName = `Busbar_Calculation_${(options.projectName || activeProj?.code || "TRV").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
    toast.success("Busbar calculation PDF exported successfully!");
    return true;
  } catch (err: any) {
    console.error("Failed to export Busbar PDF:", err);
    if (!options.returnBuffer) {
      toast.error("Failed to export Busbar calculation PDF.");
    }
    return false;
  }
}
