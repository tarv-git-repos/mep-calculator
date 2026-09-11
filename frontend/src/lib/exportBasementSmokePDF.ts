import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface BasementFloorCalc {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  effArea: number;
  height: number;
  volume: number;
  flow3ach: number;
  flow6ach: number;
  flow10ach: number;
}

export interface CalculatedFanSystem {
  id: string;
  name: string;
  fanType: "Extract" | "Makeup";
  servedFloors: BasementFloorCalc[];
  length: number;
  frictionFactor: number;
  fittings: number;
  eqLen: number;
  frictionLoss: number;
  louver: number;
  grille: number;
  sa: number;
  safety: number;
  totalStatic: number;
  flow3: number;
  flow6: number;
  flow10Max: number;
  lowCap: number;
  highCap: number;
  fanQty?: number;
  location?: string;
  zoneAchModes?: Record<string, 3 | 6>;
  max6FloorId?: string;
}

export interface BasementPdfTotals {
  total3: number;
  total6: number;
  normalScenarioSum?: number;
  max10: number;
  lowCap: number;
  highCap: number;
}

export interface ProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
}

export const exportBasementSmokePDF = async (
  _groups: any[],
  fanSystems: CalculatedFanSystem[],
  totals: BasementPdfTotals,
  totalFans: number,
  unitSystem: "ip" | "si",
  meta: ProjectMetaData = {}
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
    // A4 Portrait Mode matching Ventilation PDF export
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-BS-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    const ip = unitSystem === "ip";
    const areaUnit = ip ? "ft²" : "m²";
    const heightUnit = ip ? "ft" : "m";
    const flowUnit = ip ? "CFM" : "L/s";

    // Header Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SMOKE Ventilation Report", 14, 14);

    // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box for metadata

    // Vertical line to separate left/right metadata
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

    const primaryFill = [217, 217, 217] as [number, number, number];
    const blueFill = [218, 233, 248] as [number, number, number];
    const blueBodyFill = [242, 248, 253] as [number, number, number];

    // Section 1: Fans Smoke & Normal Ventilation Schedule
    let currentY = 42;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("1. Fans Smoke & Normal Ventilation Schedule", 14, currentY);
    currentY += 3;

    const fanScheduleRows: any[] = fanSystems.map((fs) => {
      const servedStr = fs.servedFloors.length > 0
        ? fs.servedFloors.map((f) => f.zoneName ? `${f.basementLevel} - ${f.zoneName}` : f.name).join("\n")
        : "None";

      const totalGrossArea = fs.servedFloors.reduce((sum, f) => sum + (f.area || 0), 0);
      const totalEffArea = fs.servedFloors.reduce((sum, f) => sum + (f.effArea || 0), 0);
      const uniqueHeights = Array.from(new Set(fs.servedFloors.map((f) => f.height).filter((h) => typeof h === "number" && !isNaN(h))));
      const heightStr = uniqueHeights.length > 0
        ? uniqueHeights.map((h) => `${h} ${heightUnit}`).join(", ")
        : "-";

      const max6Floor = fs.servedFloors.length > 0
        ? fs.servedFloors.reduce((max, r) => (r.flow6ach || 0) > (max.flow6ach || 0) ? r : max, fs.servedFloors[0])
        : null;
      const effectiveMax6Id = fs.max6FloorId || (max6Floor ? max6Floor.id : "");

      const modes = fs.servedFloors.map((sf) => {
        if (fs.zoneAchModes && fs.zoneAchModes[sf.id] !== undefined) {
          return fs.zoneAchModes[sf.id];
        }
        return sf.id === effectiveMax6Id ? 6 : 3;
      });
      const achSeqStr = modes.length > 0 ? ` (${modes.join(" - ")})` : "";

      const governingFlow = Math.max(fs.lowCap || 0, fs.highCap || 0);

      return [
        fs.name,
        servedStr,
        `${totalGrossArea.toLocaleString()} ${areaUnit}`,
        `${totalEffArea.toLocaleString()} ${areaUnit}`,
        heightStr,
        `${(fs.lowCap || 0).toLocaleString()}${achSeqStr}`,
        `${(fs.highCap || 0).toLocaleString()}`,
        `${governingFlow.toLocaleString()}`
      ];
    });

    if (fanSystems.length > 1) {
      const totalAllGrossArea = fanSystems.reduce((sum, fs) => sum + fs.servedFloors.reduce((s, f) => s + (f.area || 0), 0), 0);
      const totalAllEffArea = fanSystems.reduce((sum, fs) => sum + fs.servedFloors.reduce((s, f) => s + (f.effArea || 0), 0), 0);
      const totalAllLow = fanSystems.reduce((sum, fs) => sum + (fs.lowCap || 0), 0);
      const totalAllHigh = fanSystems.reduce((sum, fs) => sum + (fs.highCap || 0), 0);
      const totalAllSelected = fanSystems.reduce((sum, fs) => sum + Math.max(fs.lowCap || 0, fs.highCap || 0), 0);
      const totalRow = [
        "Total",
        `All Served Zones (${fanSystems.length} Fans)`,
        `${totalAllGrossArea.toLocaleString()} ${areaUnit}`,
        `${totalAllEffArea.toLocaleString()} ${areaUnit}`,
        "-",
        `${totalAllLow.toLocaleString()}`,
        `${totalAllHigh.toLocaleString()}`,
        `${totalAllSelected.toLocaleString()}`
      ];
      (totalRow as any)._isTotal = true;
      fanScheduleRows.push(totalRow);
    } else if (fanSystems.length === 0) {
      fanScheduleRows.push([
        { content: "No fans configured", colSpan: 8, styles: { halign: "center", fontStyle: "italic" } }
      ]);
    }

    callAutoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 6.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 0.8, right: 0.8 },
        minCellHeight: 6
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 }
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 32 },
        1: { halign: "left", cellWidth: 40 },
        2: { cellWidth: 17 },
        3: { cellWidth: 17 },
        4: { cellWidth: 13 },
        5: { cellWidth: 21, fillColor: [240, 247, 252] },
        6: { cellWidth: 21, fillColor: [240, 247, 252] },
        7: { cellWidth: 21, fillColor: [240, 247, 252] }
      },
      head: [
        [
          { content: "Fans", styles: { halign: "left" } },
          { content: "Level and Zone", styles: { halign: "left" } },
          { content: `Gross Area\n(${areaUnit})` },
          { content: `Eff. Area\n(${areaUnit})` },
          { content: `Height\n(${heightUnit})` },
          { content: `Normal Mode\n(${flowUnit})`, styles: { fillColor: blueFill } },
          { content: `Fire Mode\n(${flowUnit})`, styles: { fillColor: blueFill } },
          { content: `Selected Flow Rate\n(${flowUnit})`, styles: { fillColor: blueFill } }
        ]
      ],
      body: fanScheduleRows,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotal = rawRow && rawRow._isTotal;
          if (isTotal) {
            data.cell.styles.fontStyle = "bold";
            if (data.column.index === 5 || data.column.index === 6 || data.column.index === 7) {
              data.cell.styles.fillColor = primaryFill;
            }
          } else if (data.column.index === 5 || data.column.index === 6 || data.column.index === 7) {
            data.cell.styles.fillColor = blueBodyFill;
            if (data.column.index === 7) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      }
    });

    let finalY = (doc as any).lastAutoTable?.finalY ?? currentY + 30;
    finalY += 8;

    if (finalY > 230) {
      doc.addPage();
      finalY = 18;
    }

    // Section 2: Fan Systems & Ductwork Head Loss Sizing
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("2. Fan Systems & Ductwork Head Loss Sizing", 14, finalY);
    finalY += 3;

    const fanRows: any[] = fanSystems.map((fs) => {
      const totalFans = (fs as any).fanQty || 1;
      const fanLocation = (fs as any).location || "-";
      const governingFlow = Math.max(fs.lowCap || 0, fs.highCap || 0);
      const perFanFlow = (fs as any).perFanCap || Math.ceil(governingFlow / Math.max(1, totalFans));
      const ductAccessoriesDrop = (fs.louver || 0) + (fs.grille || 0) + (fs.sa || 0);

      return [
        fs.name,
        fs.fanType,
        totalFans.toString(),
        fanLocation,
        `${fs.length} ${ip ? "ft" : "m"}`,
        `${fs.frictionLoss.toFixed(1)} Pa`,
        `${ductAccessoriesDrop.toFixed(1)} Pa`,
        `${fs.totalStatic} Pa`,
        `${perFanFlow.toLocaleString()} ${flowUnit}`
      ];
    });

    if (fanSystems.length === 0) {
      fanRows.push([
        { content: "No fan systems configured", colSpan: 9, styles: { halign: "center", fontStyle: "italic" } }
      ]);
    }

    callAutoTable(doc, {
      startY: finalY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 6.5,
        halign: "center",
        valign: "middle",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 2, bottom: 2, left: 0.6, right: 0.6 },
        minCellHeight: 6
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: 0,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 0.4, right: 0.4 }
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 34 },
        1: { cellWidth: 18 },
        2: { cellWidth: 16 },
        3: { cellWidth: 18 },
        4: { cellWidth: 16 },
        5: { cellWidth: 18 },
        6: { cellWidth: 22 },
        7: { cellWidth: 20, fillColor: [240, 247, 252] },
        8: { cellWidth: 20, fillColor: [240, 247, 252] }
      },
      head: [
        [
          { content: "Fan System Name", styles: { halign: "left" } },
          { content: "System Type" },
          { content: "Total No.\nof Fans" },
          { content: "Location\nof Fan" },
          { content: `Duct Len\n(${ip ? "ft" : "m"})` },
          { content: "Friction Loss\n(Pa)" },
          { content: "Duct Accessories\nDrop (Pa)" },
          { content: "Total Static\n(Pa)", styles: { fillColor: blueFill } },
          { content: `Flow Rate per Fan\n(${flowUnit})`, styles: { fillColor: blueFill } }
        ]
      ],
      body: fanRows,
      didParseCell: function (data: any) {
        if (data.section === "body") {
          if (data.column.index === 7 || data.column.index === 8) {
            data.cell.styles.fillColor = blueBodyFill;
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 40;
    finalY += 8;

    if (finalY > 230) {
      doc.addPage();
      finalY = 18;
    }

    // Section 3: 3-Tier Signature Block
    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate
    } = getSignatureBlockDetails(activeProjectId, "/basement-smoke-calc", meta.userName || currentUserName);

    callAutoTable(doc, {
      startY: finalY,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: { fontSize: 8, halign: "center", valign: "middle", lineColor: [100, 100, 100], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
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
    await downloadFile(new Uint8Array(pdfBuffer), `Smoke_Ventilation_Report_${activeProj?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Smoke Ventilation PDF exported successfully!");
  } catch (error: any) {
    console.error("exportBasementSmokePDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
