import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";

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
}

export interface BasementPdfTotals {
  total3: number;
  total6: number;
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
  groups: { basementLevel: string; rows: BasementFloorCalc[]; subtotal3: number; subtotal6: number; max10Fire: number; totalArea: number; totalEffArea: number }[],
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
    // Landscape A4 for wide table presentation
    const doc = new JsPDFClass("landscape", "mm", "a4");

    const callAutoTable = (pdfDoc: any, options: any) => {
      if (typeof autoTable === "function") {
        autoTable(pdfDoc, options);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(pdfDoc, options);
      } else if (typeof pdfDoc.autoTable === "function") {
        pdfDoc.autoTable(options);
      }
    };

    const calcNo = meta.calcNo || activeProj?.calcNo || "TRV-CAL-BS-001";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "";
    const clientName = meta.client || activeProj?.client || "";

    const ip = unitSystem === "ip";
    const areaUnit = ip ? "ft²" : "m²";
    const heightUnit = ip ? "ft" : "m";
    const flowUnit = ip ? "CFM" : "L/s";

    // Header Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Basement Smoke Extract Schedule & Fan Systems Report", 14, 14);

    // Metadata Box (Landscape width: 269mm total line from 14mm to 283mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 269, 18);
    doc.line(145, 18, 145, 36);
    doc.line(14, 24, 283, 24);
    doc.line(14, 30, 283, 30);

    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 147, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 160, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 147, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 160, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 45, 34);

    // Section 1: Basement Schedule Table
    let currentY = 42;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("1. Basement Multi-Zone Ventilation Schedule", 14, currentY);
    currentY += 4;

    const tableRows: any[] = [];
    groups.forEach((grp) => {
      // Group header
      tableRows.push([
        { content: `Basement Level: ${grp.basementLevel} (${grp.rows.length} ${grp.rows.length === 1 ? "Zone" : "Zones"})`, colSpan: 8, styles: { fontStyle: "bold", fillColor: [240, 244, 248] } }
      ]);

      grp.rows.forEach((r) => {
        tableRows.push([
          r.zoneName ? `${r.basementLevel} - ${r.zoneName}` : r.name,
          `${r.area.toLocaleString()} ${areaUnit}`,
          `${r.effArea.toLocaleString()} ${areaUnit}`,
          `${r.height} ${heightUnit}`,
          `${r.flow3ach.toLocaleString()} ${flowUnit}`,
          `${r.flow6ach.toLocaleString()} ${flowUnit}`,
          `${r.flow10ach.toLocaleString()} ${flowUnit}`,
          "Active"
        ]);
      });

      // Subtotal row
      tableRows.push([
        { content: `${grp.basementLevel} Subtotal`, styles: { fontStyle: "bold" } },
        `${grp.totalArea.toLocaleString()} ${areaUnit}`,
        `${grp.totalEffArea.toLocaleString()} ${areaUnit}`,
        "-",
        `${grp.subtotal3.toLocaleString()} ${flowUnit}`,
        `${grp.subtotal6.toLocaleString()} ${flowUnit}`,
        `${grp.max10Fire.toLocaleString()} ${flowUnit} (1 Zone Fire)`,
        ""
      ]);
    });

    callAutoTable(doc, {
      startY: currentY,
      head: [
        [
          "Level / Zone Name",
          `Gross Area (${areaUnit})`,
          `Eff. Area (${areaUnit})`,
          `Height (${heightUnit})`,
          `3 ACH Normal (${flowUnit})`,
          `6 ACH Normal (${flowUnit})`,
          `10 ACH Fire (${flowUnit})`,
          "Status"
        ]
      ],
      body: tableRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold" },
      theme: "grid"
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 30;

    // Check if new page needed
    if (finalY > 165) {
      doc.addPage();
      finalY = 20;
    }

    // Section 2: Global Fan Sizing & Summary
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2. Global Fan Capacity Summary", 14, finalY);
    finalY += 4;

    const summaryData = [
      ["Total Fan Quantity Sized:", `${totalFans} Fans`],
      ["Total 3 ACH Ventilation Flow:", `${totals.total3.toLocaleString()} ${flowUnit}`],
      ["Worst-Case 10 ACH Fire Extract Flow:", `${totals.max10.toLocaleString()} ${flowUnit}`],
      ["Required Low Speed Capacity / Fan:", `${totals.lowCap.toLocaleString()} ${flowUnit}`],
      ["Required High Speed Capacity / Fan:", `${totals.highCap.toLocaleString()} ${flowUnit}`]
    ];

    callAutoTable(doc, {
      startY: finalY,
      body: summaryData,
      margin: { left: 14, right: 140 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { fontStyle: "normal" } },
      theme: "grid"
    });

    finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : finalY + 30;

    // Check if new page needed
    if (finalY > 150) {
      doc.addPage();
      finalY = 20;
    }

    // Section 3: Fan Systems Head Loss Sizing Table
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. Fan Systems & Ductwork Head Loss Sizing", 14, finalY);
    finalY += 4;

    const fanRows: any[] = fanSystems.map((fs) => {
      const servedStr = fs.servedFloors.map((f) => f.name).join(", ");
      return [
        fs.name,
        fs.fanType,
        servedStr || "None",
        `${fs.length} m`,
        `${fs.eqLen.toFixed(1)} m`,
        `${fs.frictionLoss.toFixed(1)} Pa`,
        `${fs.louver} Pa`,
        `${fs.grille} Pa`,
        `${fs.sa} Pa`,
        `${fs.totalStatic} Pa`
      ];
    });

    callAutoTable(doc, {
      startY: finalY,
      head: [
        [
          "Fan System Name",
          "System Type",
          "Served Floors",
          "Duct Len",
          "Eq. Len",
          "Friction Loss",
          "Louver Drop",
          "Grille Drop",
          "SA Drop",
          "Total Static Sized"
        ]
      ],
      body: fanRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      theme: "grid"
    });

    finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : finalY + 40;

    if (finalY > 165) {
      doc.addPage();
      finalY = 20;
    }

    // Add 3-Tier Signature Block
    addPdfSignatureBlock(doc, finalY, currentUserName, activeProjectId, "/basement-smoke-calc");

    // Output & Download PDF
    const pdfBlob = doc.output("blob");
    const arrayBuffer = await pdfBlob.arrayBuffer();
    downloadFile(new Uint8Array(arrayBuffer), "Basement_Smoke_Calculation.pdf", "PDF Document", ["pdf"]);
  } catch (err) {
    console.error("Error generating Basement Smoke PDF report", err);
  }
};
