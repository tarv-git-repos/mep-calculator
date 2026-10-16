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
  includeStamp?: boolean;
  includeCover?: boolean;
  returnBuffer?: boolean;
}

export const exportBasementSmokePDF = async (
  groupsOrRows: any[],
  fanSystems: CalculatedFanSystem[] = [],
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
    // A4 Portrait Mode (210mm x 297mm) matching Preliminary Cooling Load
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
    const revNo = meta.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = meta.date || new Date().toLocaleDateString("en-GB");
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || "Basement Smoke Ventilation";
    const clientName = meta.client || activeProj?.client || "";
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || "";

    const ip = unitSystem === "ip";
    const areaUnit = ip ? "sq.ft" : "m²";
    const heightUnit = ip ? "ft" : "m";
    const volUnit = ip ? "cu.ft" : "m³";
    const flowUnit = ip ? "CFM" : "L/s";

    // 1. Header Title (Matching Preliminary Cooling Load)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Basement Smoke Calculation", 14, 14);

    // 2. Metadata Block (Exact Preliminary 2-column format: 182mm width)
    doc.setFontSize(8.5);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18);

    // Vertical line to separate left/right metadata
    doc.line(105, 18, 105, 36);
    doc.line(155, 18, 155, 24);

    // Horizontal lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Rev No.:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(revNo, 122, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 157, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 167, 22);

    // Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    // Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    // Extract individual zone calculation rows
    let allRows: BasementFloorCalc[] = [];
    if (Array.isArray(groupsOrRows)) {
      if (groupsOrRows.length > 0 && Array.isArray((groupsOrRows[0] as any)?.rows)) {
        groupsOrRows.forEach((g: any) => {
          if (Array.isArray(g.rows)) {
            g.rows.forEach((r: any) => {
              allRows.push({
                ...r,
                basementLevel: r.basementLevel || g.basementLevel || "Basement 1"
              });
            });
          }
        });
      } else {
        allRows = groupsOrRows;
      }
    }

    // Group spaces by level
    const rowsByLevel: { [lvl: string]: BasementFloorCalc[] } = {};
    const levelOrder: string[] = [];

    const sortedRows = [...allRows].sort((a, b) => {
      const lvlA = (a.basementLevel || "Basement 1").toLowerCase();
      const lvlB = (b.basementLevel || "Basement 1").toLowerCase();
      if (lvlA !== lvlB) return lvlA.localeCompare(lvlB);
      return (a.zoneName || a.name || "").localeCompare(b.zoneName || b.name || "");
    });

    sortedRows.forEach((r) => {
      const lvl = r.basementLevel || "Basement 1";
      if (!rowsByLevel[lvl]) {
        rowsByLevel[lvl] = [];
        levelOrder.push(lvl);
      }
      rowsByLevel[lvl].push(r);
    });

    const body: any[] = [];
    let globalSrNo = 1;

    let grandGrossArea = 0;
    let grandEffArea = 0;
    let grandVolume = 0;
    let grandFlow3 = 0;
    let grandFlow6 = 0;
    let grandMax10 = 0;

    levelOrder.forEach((lvlName) => {
      const lvlRows = rowsByLevel[lvlName];
      let lvlGross = 0;
      let lvlEff = 0;
      let lvlVol = 0;
      let lvlFlow3 = 0;
      let lvlFlow6 = 0;
      let lvlMax10 = 0;

      lvlRows.forEach((r) => {
        const grossArea = Number(r.area) || 0;
        const effArea = Number(r.effArea) || 0;
        const height = Number(r.height) || 0;
        const vol = Number(r.volume) || (effArea * height);
        const f3 = Number(r.flow3ach) || 0;
        const f6 = Number(r.flow6ach) || 0;
        const f10 = Number(r.flow10ach) || 0;

        lvlGross += grossArea;
        lvlEff += effArea;
        lvlVol += vol;
        lvlFlow3 += f3;
        lvlFlow6 += f6;
        lvlMax10 = Math.max(lvlMax10, f10);

        grandGrossArea += grossArea;
        grandEffArea += effArea;
        grandVolume += vol;
        grandFlow3 += f3;
        grandFlow6 += f6;
        grandMax10 = Math.max(grandMax10, f10);

        body.push([
          globalSrNo++,
          r.basementLevel || lvlName,
          r.zoneName ? `${r.basementLevel} - ${r.zoneName}` : r.name,
          Math.round(grossArea).toLocaleString(),
          Math.round(effArea).toLocaleString(),
          height.toFixed(2),
          Math.round(vol).toLocaleString(),
          Math.round(f3).toLocaleString(),
          Math.round(f6).toLocaleString(),
          Math.round(f10).toLocaleString()
        ]);
      });

      // Level Total Row
      const levelTotalRow = [
        "",
        lvlName,
        `TOTAL (${lvlName})`,
        Math.round(lvlGross).toLocaleString(),
        Math.round(lvlEff).toLocaleString(),
        "-",
        Math.round(lvlVol).toLocaleString(),
        Math.round(lvlFlow3).toLocaleString(),
        Math.round(lvlFlow6).toLocaleString(),
        Math.round(lvlMax10).toLocaleString()
      ];
      (levelTotalRow as any)._isLevelTotal = true;
      body.push(levelTotalRow);
    });

    // Grand Total Row if multiple levels
    if (levelOrder.length > 1) {
      const grandTotalRow = [
        "",
        "ALL",
        "OVERALL TOTAL",
        Math.round(grandGrossArea).toLocaleString(),
        Math.round(grandEffArea).toLocaleString(),
        "-",
        Math.round(grandVolume).toLocaleString(),
        Math.round(grandFlow3).toLocaleString(),
        Math.round(grandFlow6).toLocaleString(),
        Math.round(grandMax10).toLocaleString()
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [217, 217, 217] as [number, number, number];

    // 3. Primary Calculation Schedule Table (Starts at 42mm, matching Preliminary)
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
        cellPadding: { top: 2.2, bottom: 2.2, left: 0.8, right: 0.8 },
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
        1: { cellWidth: 18 },                 // Level
        2: { halign: "left", cellWidth: 32 }, // Zone Description
        3: { cellWidth: 18 },                 // Gross Area
        4: { cellWidth: 18 },                 // Eff Area
        5: { cellWidth: 14 },                 // Height
        6: { cellWidth: 20 },                 // Volume
        7: { cellWidth: 18 },                 // 3 ACH
        8: { cellWidth: 18 },                 // 6 ACH
        9: { cellWidth: 18, fillColor: [242, 248, 253] } // 10 ACH (Fire Max)
      },
      head: [
        [
          { content: "Sr. No.", rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: "Space & Geometry Parameters", colSpan: 4, styles: { fillColor: primaryFill } },
          { content: "Enclosed Volume", colSpan: 1, styles: { fillColor: primaryFill } },
          { content: `Airflow Demand by Air Change Rate (${flowUnit})`, colSpan: 3, styles: { fillColor: primaryFill } }
        ],
        [
          { content: "Level", styles: { fillColor: primaryFill } },
          { content: "Level / Zone Description", styles: { fillColor: primaryFill } },
          { content: `Gross Area\n(${areaUnit})`, styles: { fillColor: primaryFill } },
          { content: `Eff. Area\n(${areaUnit})`, styles: { fillColor: primaryFill } },
          { content: `Height\n(${heightUnit})`, styles: { fillColor: primaryFill } },
          { content: `Volume\n(${volUnit})`, styles: { fillColor: primaryFill } },
          { content: `3 ACH\n(Normal)`, styles: { fillColor: primaryFill } },
          { content: `6 ACH\n(Smoke)`, styles: { fillColor: primaryFill } },
          { content: `10 ACH\n(Fire Max)`, styles: { fillColor: primaryFill } }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === "body") {
          const isGrandTotal = rawRow && rawRow._isGrandTotal;
          const isLevelTotal = rawRow && rawRow._isLevelTotal;
          if (isGrandTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [218, 233, 248]; // Soft blue grand total
          } else if (isLevelTotal) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [240, 243, 246]; // Soft gray-blue level total
            if (data.column.index === 9) {
              data.cell.styles.fillColor = [225, 238, 250]; // Highlighted fire mode total
            }
          } else if (data.column.index === 9) {
            data.cell.styles.fillColor = [242, 248, 253]; // Light blue for standard body fire mode cell
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    });

    let finalY = (doc as any).lastAutoTable?.finalY ?? 150;

    // 4. Secondary Calculation Table: Fan Equipment Sizing Schedule (if fan systems present)
    if (fanSystems && fanSystems.length > 0) {
      finalY += 8;

      if (finalY > 220) {
        doc.addPage();
        finalY = 18;
      }

      const fanBodyRows = fanSystems.map((fs, idx) => {
        const qty = fs.fanQty || 1;
        const governingFlow = (fs as any).sizedCap ? Math.round((fs as any).sizedCap) : Math.max(Math.round(fs.lowCap || 0), Math.round(fs.highCap || 0));
        const perFanFlow = (fs as any).perFanCap ? Math.round((fs as any).perFanCap) : Math.ceil(governingFlow / Math.max(1, qty));
        const servedStr = fs.servedFloors?.map((sf: any) => sf.name || sf.zoneName).join(", ") || "All Levels";

        return [
          idx + 1,
          fs.name,
          fs.fanType || "Extract",
          servedStr,
          governingFlow.toLocaleString(),
          `${fs.totalStatic || 250}`,
          qty.toString(),
          perFanFlow.toLocaleString(),
          fs.governingMode || "Fire Mode"
        ];
      });

      const totalAllFans = fanSystems.reduce((acc, fs) => acc + (fs.fanQty || 1), 0);
      const totalCapacity = fanSystems.reduce((acc, fs) => acc + ((fs as any).sizedCap ? Math.round((fs as any).sizedCap) : Math.max(Math.round(fs.lowCap || 0), Math.round(fs.highCap || 0))), 0);
      const fanTotalRow = [
        "",
        "TOTAL",
        "",
        `${fanSystems.length} Fan System(s)`,
        totalCapacity.toLocaleString(),
        "-",
        totalAllFans.toString(),
        "-",
        ""
      ];
      (fanTotalRow as any)._isTotal = true;
      fanBodyRows.push(fanTotalRow);

      callAutoTable(doc, {
        startY: finalY,
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
          1: { halign: "left", cellWidth: 32 }, // Fan System Mark
          2: { cellWidth: 16 },                 // Type
          3: { halign: "left", cellWidth: 34 }, // Served Levels
          4: { cellWidth: 22, fillColor: [242, 248, 253] }, // Design Airflow
          5: { cellWidth: 18 },                 // Static (Pa)
          6: { cellWidth: 14 },                 // Fan Qty
          7: { cellWidth: 22, fillColor: [242, 248, 253] }, // Per-Fan Flow
          8: { cellWidth: 16 }                  // Governing Mode
        },
        head: [
          [
            { content: "Sr. No.", styles: { fillColor: primaryFill } },
            { content: "Fan System Mark", styles: { fillColor: primaryFill } },
            { content: "Type", styles: { fillColor: primaryFill } },
            { content: "Served Levels / Zones", styles: { fillColor: primaryFill } },
            { content: `Design Airflow\n(${flowUnit})`, styles: { fillColor: primaryFill } },
            { content: "Static\n(Pa)", styles: { fillColor: primaryFill } },
            { content: "Fan Qty", styles: { fillColor: primaryFill } },
            { content: `Per-Fan Flow\n(${flowUnit})`, styles: { fillColor: primaryFill } },
            { content: "Governing Mode", styles: { fillColor: primaryFill } }
          ]
        ],
        body: fanBodyRows,
        didParseCell: function(data: any) {
          const rawRow = data.row.raw;
          if (data.section === "body") {
            const isTotal = rawRow && rawRow._isTotal;
            if (isTotal) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 243, 246];
            } else if (data.column.index === 4 || data.column.index === 7) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [242, 248, 253];
            }
          }
        }
      });

      finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 40;
    }

    // 5. Signature Block (Clean neutral header - no orange/peach highlight)
    if (meta.includeStamp !== false) {
      let sigY = finalY + 8;
      if (sigY > 235) {
        doc.addPage();
        sigY = 18;
      }

      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(activeProjectId, "/basement-smoke-calc", meta.userName || currentUserName);

      callAutoTable(doc, {
        startY: sigY,
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
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "", styles: { fillColor: [255, 255, 255] } },
            { content: "Originator", styles: { fillColor: primaryFill } },
            { content: "Reviewer", styles: { fillColor: primaryFill } },
            { content: "Approver", styles: { fillColor: primaryFill } }
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
    }

    const pdfBuffer = doc.output("arraybuffer");
    const u8 = new Uint8Array(pdfBuffer);
    if (meta.returnBuffer) {
      return u8;
    }
    const cleanRev = meta.revNo ? `_${meta.revNo.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "";
    await downloadFile(u8, `Basement_Smoke_Calculation_${activeProj?.code || "P000"}${cleanRev}.pdf`, "PDF Document", ["pdf"]);
    toast.success("Basement Smoke Calculation PDF exported successfully!");
    return u8;
  } catch (error: any) {
    console.error("exportBasementSmokePDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};
