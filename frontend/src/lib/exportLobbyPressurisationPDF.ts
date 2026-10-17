import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { toast } from "sonner";

export interface LobbyFloorCalc {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  height: number;
  volume: number;
  flow6ach: number;
  flowM3h: number;
}

export interface CalculatedFanSystem {
  id: string;
  name: string;
  fanType: "Extract" | "Makeup" | "Pressurisation";
  servedFloors: LobbyFloorCalc[];
  length: number;
  frictionFactor: number;
  fittings?: number;
  eqLen?: number;
  frictionLoss: number;
  louver: number;
  grille: number;
  sa: number;
  safety?: number;
  totalStatic: number;
  totalFlow6: number;
  totalFlowM3h?: number;
  perFanCap?: number;
  fanQty?: number;
  location?: string;
}

export interface LobbyPdfTotals {
  totalArea: number;
  totalVolume: number;
  total6: number;
  totalM3h: number;
  perFanCapacity?: number;
  sizedCap?: number;
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

export const exportLobbyPressurisationPDF = async (
  _groups: any[],
  fanSystems: CalculatedFanSystem[],
  totals: LobbyPdfTotals,
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
    // A4 Portrait Mode
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

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-LP-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    const ip = unitSystem === "ip";
    const areaUnit = ip ? "ft²" : "m²";
    const heightUnit = ip ? "ft" : "m";
    const volUnit = ip ? "ft³" : "m³";
    const flowUnit = ip ? "CFM" : "L/s";

    // 1. Header & Standard Metadata Box (Central Org Branding)
    const startY = addPdfHeader(doc, "Lobby Pressurisation & Smoke Containment Report", {
      calcNo,
      date: today,
      projectNo,
      projectName,
      client: clientName,
      endUser
    });

    const primaryFill = [217, 217, 217] as [number, number, number];
    const blueFill = [218, 233, 248] as [number, number, number];
    const blueBodyFill = [242, 248, 253] as [number, number, number];

    // Section 1: Lobby Pressurisation Calculation (6 ACH Standard)
    let currentY = startY + 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("1. Lobby Pressurisation Schedule (6 ACH Standard)", 14, currentY);
    currentY += 3;

    const scheduleRows: any[] = [];

    fanSystems.forEach((fs) => {
      const numZones = fs.servedFloors.length;
      const roundedFlow = Math.round((fs.totalFlow6 || 0) / 10) * 10;

      if (numZones === 0) {
        scheduleRows.push([
          fs.name,
          fs.fanType || "Pressurisation",
          "None",
          "-",
          "0",
          "0",
          "0",
          `${roundedFlow.toLocaleString()}`
        ]);
      } else {
        fs.servedFloors.forEach((f, idx) => {
          const row: any[] = [];
          if (idx === 0) {
            row.push({ content: fs.name, rowSpan: numZones });
            row.push({ content: fs.fanType || "Pressurisation", rowSpan: numZones });
          }
          
          row.push(f.basementLevel || "-");
          row.push(f.zoneName || f.name);
          row.push(`${(f.area || 0).toLocaleString()}`);
          row.push(f.height !== undefined && f.height !== null ? `${f.height}` : "-");
          row.push(`${(f.volume || 0).toLocaleString()}`);
          row.push(`${(f.flow6ach || 0).toLocaleString()}`);

          scheduleRows.push(row);
        });
      }
    });

    if (fanSystems.length > 0) {
      const totalAllArea = fanSystems.reduce((sum, fs) => sum + fs.servedFloors.reduce((s, f) => s + (f.area || 0), 0), 0);
      const totalAllVol = fanSystems.reduce((sum, fs) => sum + fs.servedFloors.reduce((s, f) => s + (f.volume || 0), 0), 0);
      const totalAllFlow = fanSystems.reduce((sum, fs) => sum + fs.servedFloors.reduce((s, f) => s + (f.flow6ach || 0), 0), 0);
      const totalRow = [
        { content: "Total", colSpan: 2 },
        `All Served Lobbies (${fanSystems.length} Systems)`,
        "-",
        `${totalAllArea.toLocaleString()}`,
        "-",
        `${totalAllVol.toLocaleString()}`,
        `${totalAllFlow.toLocaleString()}`
      ];
      (totalRow as any)._isTotal = true;
      scheduleRows.push(totalRow);
    } else if (fanSystems.length === 0) {
      scheduleRows.push([
        { content: "No lobby fan systems configured", colSpan: 8, styles: { halign: "center", fontStyle: "italic" } }
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
        0: { halign: "center", cellWidth: 32 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "center", cellWidth: 22 },
        3: { cellWidth: 26 },
        4: { cellWidth: 18 },
        5: { cellWidth: 14 },
        6: { cellWidth: 22 },
        7: { cellWidth: 28, fillColor: [240, 247, 252] }
      },
      head: [
        [
          { content: "Fan System Name", styles: { halign: "center" } },
          { content: "System Type", styles: { halign: "center" } },
          { content: "Level / Floor", styles: { halign: "center" } },
          { content: "Zone", styles: { halign: "center" } },
          { content: `Area\n(${areaUnit})` },
          { content: `Height\n(${heightUnit})` },
          { content: `Volume\n(${volUnit})` },
          { content: `6 ACH Airflow\n(${flowUnit})`, styles: { fillColor: blueFill } }
        ]
      ],
      body: scheduleRows,
      didParseCell: function (data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isTotal = rawRow && rawRow._isTotal;
          if (isTotal) {
            data.cell.styles.fontStyle = "bold";
            if (data.column.index === 7) {
              data.cell.styles.fillColor = primaryFill;
            }
          } else if (data.column.index === 7) {
            data.cell.styles.fillColor = blueBodyFill;
            data.cell.styles.fontStyle = "bold";
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

    // Section 2: Pressurisation Fan Schedule
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("2. Pressurisation Fan Schedule", 14, finalY);
    finalY += 3;

    const fanRows: any[] = fanSystems.map((fs) => {
      const fQty = fs.fanQty || 1;
      const roundedFlow = Math.round((fs.totalFlow6 || 0) / 10) * 10;
      const rawPerFan = fs.perFanCap || Math.ceil(roundedFlow / Math.max(1, fQty));
      const perFanFlow = Math.round(rawPerFan / 10) * 10;
      const ductAccessoriesDrop = (fs.louver || 0) + (fs.grille || 0) + (fs.sa || 0);

      return [
        fs.name,
        fQty.toString(),
        fs.fanType || "Pressurisation",
        `${fs.length}`,
        `${fs.frictionLoss.toFixed(1)}`,
        `${ductAccessoriesDrop.toFixed(1)}`,
        `${fs.totalStatic}`,
        `${perFanFlow.toLocaleString()}`
      ];
    });

    if (fanSystems.length === 0) {
      fanRows.push([
        { content: "No fan systems configured", colSpan: 8, styles: { halign: "center", fontStyle: "italic" } }
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
        0: { halign: "center", cellWidth: 34 },
        1: { cellWidth: 16 },
        2: { cellWidth: 24 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22, fillColor: [240, 247, 252] },
        7: { cellWidth: 22, fillColor: [240, 247, 252] }
      },
      head: [
        [
          { content: "Fan System Name", styles: { halign: "center" } },
          { content: "Total No.\nof Fans" },
          { content: "Fan Type" },
          { content: `Duct Len\n(${ip ? "ft" : "m"})` },
          { content: "Friction Loss\n(Pa)" },
          { content: "Duct Accessories Drop\n(Pa)" },
          { content: "Total Static\n(Pa)", styles: { fillColor: blueFill } },
          { content: `Flow Rate per Fan\n(${flowUnit})`, styles: { fillColor: blueFill } }
        ]
      ],
      body: fanRows,
      didParseCell: function (data: any) {
        if (data.section === "body") {
          if (data.column.index === 6 || data.column.index === 7) {
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

    // Section 3: Professional Engineering 3-Tier Signature Block & Branding
    const sigDetails = getSignatureBlockDetails(activeProjectId, "/lobby-pressurisation", meta.userName || currentUserName);
    addPdfSignatureBlock(doc, finalY, sigDetails, activeProjectId, "/lobby-pressurisation");

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    const pdfBuffer = doc.output("arraybuffer");
    await downloadFile(new Uint8Array(pdfBuffer), `Lobby_Pressurisation_Report_${activeProj?.code || "P000"}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Lobby Pressurisation PDF exported successfully!");
  } catch (error: any) {
    console.error("exportLobbyPressurisationPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
