import * as ExcelJSModule from "exceljs";
import * as fileSaver from "file-saver";
import { downloadFile } from "./download";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { workspaceStore } from "./workspace-store";

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
const saveAs = (fileSaver as any)?.default?.saveAs || (fileSaver as any)?.saveAs || fileSaver;

export interface SprinklerExcelRow {
  id: string;
  floor?: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number;
  flow: number;
  coverage: number;
  hazard: string;
  notes?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface SprinklerExcelMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  unitSystem?: "ip" | "si";
}

export const exportSprinklerKFactorExcel = async (
  rows: SprinklerExcelRow[],
  meta: SprinklerExcelMetaData = {},
  liveReviewState?: any
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

  const activeProj: any = workspaceStore.getState()?.project || {};

  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUserName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Sprinkler Calculation", {
    views: [{ showGridLines: true }]
  });

  const isSI = meta.unitSystem === "si";
  const pressUnit = isSI ? "bar" : "psi";
  const flowUnit = isSI ? "L/min" : "GPM";
  const areaUnit = isSI ? "m²" : "ft²";

  const baseFont = { name: "Arial", size: 10, family: 2 };
  const boldFont = { ...baseFont, bold: true };
  const titleFont = { name: "Arial", size: 14, bold: true };

  const grayFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  const blueFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDAE9F8" },
  };

  const greenFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2F0D9" },
  };

  const amberFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };

  const groupHeaderFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2F4F7" },
  };

  const setCellBorder = (
    cell: any,
    topStyle: string = "thin",
    bottomStyle: string = "thin",
    leftStyle: string = "thin",
    rightStyle: string = "thin"
  ) => {
    cell.border = {
      top: { style: topStyle, color: { argb: "FF000000" } },
      bottom: { style: bottomStyle, color: { argb: "FF000000" } },
      left: { style: leftStyle, color: { argb: "FF000000" } },
      right: { style: rightStyle, color: { argb: "FF000000" } },
    };
  };

  // Set Column Widths (10 Columns A to J)
  sheet.getColumn(1).width = 8;   // A: Sr. No.
  sheet.getColumn(2).width = 16;  // B: Floor / Level
  sheet.getColumn(3).width = 28;  // C: Sprinkler Label / Location
  sheet.getColumn(4).width = 15;  // D: K-Factor
  sheet.getColumn(5).width = 15;  // E: Sizing Target
  sheet.getColumn(6).width = 18;  // F: Pressure
  sheet.getColumn(7).width = 18;  // G: Flow Rate
  sheet.getColumn(8).width = 18;  // H: Coverage Area
  sheet.getColumn(9).width = 24;  // I: Hazard Classification
  sheet.getColumn(10).width = 18; // J: NFPA 13 Status

  // Title Row (Row 2)
  sheet.getRow(2).height = 26;
  sheet.getCell("A2").value = "NFPA 13 Sprinkler K-Factor & Hydraulic Calculation";
  sheet.getCell("A2").font = titleFont;

  // Metadata Block (Rows 4 to 6)
  const calcNo = meta.calcNo || (activeProj as any)?.calcNo || "FP-SKF-CALC-001";
  const today = meta.date || new Date().toLocaleDateString("en-GB");
  const projectNo = meta.projectNo || activeProj.code || "MEP-FP-2026";
  const projectName = meta.projectName || activeProj.name || "Sprinkler Hydraulic Sizing";
  const clientName = meta.client || activeProj.client || "Consistent Engineering Consultants";
  const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj.location || "Main Complex";

  sheet.mergeCells("A4:E4");
  sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
  sheet.getCell("A4").font = boldFont;

  sheet.mergeCells("F4:J4");
  sheet.getCell("F4").value = `Date:  ${today}`;
  sheet.getCell("F4").font = boldFont;

  sheet.mergeCells("A5:E5");
  sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
  sheet.getCell("A5").font = boldFont;

  sheet.mergeCells("F5:J5");
  sheet.getCell("F5").value = `Client:   ${clientName}`;
  sheet.getCell("F5").font = boldFont;

  sheet.mergeCells("A6:E6");
  sheet.getCell("A6").value = `Project Name:   ${projectName}`;
  sheet.getCell("A6").font = boldFont;

  sheet.mergeCells("F6:J6");
  sheet.getCell("F6").value = `End User:   ${endUser}`;
  sheet.getCell("F6").font = boldFont;

  for (let r = 4; r <= 6; r++) {
    sheet.getRow(r).height = 22;
    for (let c = 1; c <= 10; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === 4 ? "medium" : "thin";
      const bottomStyle = r === 6 ? "medium" : "thin";
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = c === 10 ? "medium" : (c === 5 ? "medium" : "thin");
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: "middle", indent: (c === 1 || c === 6) ? 1 : 0 };
      if (!cell.font || !cell.font.bold) cell.font = baseFont;
    }
  }

  // Summary Metrics Calculation
  let totalFlow = 0;
  let maxPressure = 0;
  let totalCoverage = 0;
  let hoseAllowance = isSI ? 950 : 250;

  rows.forEach((r) => {
    totalFlow += (r.flow || 0);
    totalCoverage += (r.coverage || 0);
    if (r.pressure > maxPressure) maxPressure = r.pressure;
  });

  const systemDemand = totalFlow + hoseAllowance;

  // Summary Stats Box (Rows 8 to 11) - Clean background matching Ventilation
  const r8 = sheet.getRow(8);
  r8.height = 24;
  sheet.mergeCells("A8:J8");
  for (let c = 1; c <= 10; c++) {
    const cell = r8.getCell(c);
    cell.value = "FIRE FIGHTING DESIGN SUMMARY STATS (NFPA 13)";
    cell.fill = grayFill;
    cell.font = boldFont;
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    setCellBorder(cell, "medium", "medium", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
  }

  const summaryData = [
    { l1: "Total Sprinkler Heads:", v1: rows.length, l2: "Total Demand Flow:", v2: `${totalFlow.toFixed(2)} ${flowUnit}` },
    { l1: "Total System Demand (with Hose):", v1: `${systemDemand.toFixed(2)} ${flowUnit}`, l2: "Max Node Operating Pressure:", v2: `${maxPressure.toFixed(2)} ${pressUnit}` },
    { l1: "Hose Stream Allowance:", v1: `${hoseAllowance} ${flowUnit}`, l2: "Design Standard / NFPA Code:", v2: "NFPA 13 Standard" },
  ];

  summaryData.forEach((item, idx) => {
    const rNum = 9 + idx;
    const r = sheet.getRow(rNum);
    r.height = 20;

    sheet.mergeCells(`A${rNum}:C${rNum}`);
    sheet.mergeCells(`E${rNum}:G${rNum}`);
    sheet.mergeCells(`H${rNum}:J${rNum}`);

    for (let c = 1; c <= 10; c++) {
      const cell = r.getCell(c);
      cell.font = boldFont;
      cell.alignment = { vertical: "middle" };
      setCellBorder(cell, "thin", idx === 2 ? "medium" : "thin", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
    }

    r.getCell(1).value = item.l1;
    r.getCell(4).value = item.v1;
    r.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

    r.getCell(5).value = item.l2;
    r.getCell(8).value = item.v2;
    r.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
  });

  // Section Header (Row 13)
  const r13 = sheet.getRow(13);
  r13.height = 24;
  sheet.mergeCells("A13:J13");
  for (let c = 1; c <= 10; c++) {
    const cell = r13.getCell(c);
    cell.value = "SPRINKLER HYDRAULIC SIZING SCHEDULE";
    cell.fill = grayFill;
    cell.font = boldFont;
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    setCellBorder(cell, "medium", "medium", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
  }

  // Multi-Tier Table Headers (Rows 14 and 15)
  sheet.getRow(14).height = 22;
  sheet.getRow(15).height = 24;

  // Tier 1 Merges (Row 14)
  sheet.mergeCells("A14:A15");
  sheet.getCell("A14").value = "Sr. No.";

  sheet.mergeCells("B14:D14");
  sheet.getCell("B14").value = "Sprinkler Head Parameters";

  sheet.mergeCells("E14:G14");
  sheet.getCell("E14").value = "Hydraulic Discharge & Pressure";

  sheet.mergeCells("H14:J14");
  sheet.getCell("H14").value = "Hazard Classification & Compliance";

  // Tier 2 Subheaders (Row 15)
  sheet.getCell("B15").value = "Floor / Level";
  sheet.getCell("C15").value = "Sprinkler Label";
  sheet.getCell("D15").value = `K-Factor\n(${isSI ? "Metric" : "US"})`;
  sheet.getCell("E15").value = "Target";
  sheet.getCell("F15").value = `Pressure\n(${pressUnit})`;
  sheet.getCell("G15").value = `Flow Rate\n(${flowUnit})`;
  sheet.getCell("H15").value = `Coverage\n(${areaUnit})`;
  sheet.getCell("I15").value = "Hazard Classification";
  sheet.getCell("J15").value = "NFPA 13 Status";

  for (let r = 14; r <= 15; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = boldFont;
      // Use blueFill ONLY on the primary output column header (Flow Rate, Col G) matching Ventilation
      cell.fill = (c === 7) ? blueFill : grayFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      setCellBorder(cell, r === 14 ? "medium" : "thin", r === 15 ? "medium" : "thin", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
    }
  }

  // Group Rows by Floor
  const floorGroups = new Map<string, SprinklerExcelRow[]>();
  rows.forEach((r) => {
    const f = r.floor || "Ground Floor";
    if (!floorGroups.has(f)) floorGroups.set(f, []);
    floorGroups.get(f)!.push(r);
  });

  let currentRow = 16;
  let overallIndex = 1;
  const dataRowStart = currentRow;

  floorGroups.forEach((floorRows, floorName) => {
    // Floor Group Header Row
    const fRow = sheet.getRow(currentRow);
    fRow.height = 22;
    sheet.mergeCells(`A${currentRow}:J${currentRow}`);
    for (let c = 1; c <= 10; c++) {
      const cell = fRow.getCell(c);
      cell.value = `📍 ${floorName} (${floorRows.length} sprinkler heads)`;
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF06456F" } };
      cell.fill = groupHeaderFill;
      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
    }
    currentRow++;

    // Group Data Rows (Clean white cells without excessive blue background)
    floorRows.forEach((r) => {
      const row = sheet.getRow(currentRow);
      row.height = 22;

      // Sr. No. (Col A) - Centered
      row.getCell(1).value = overallIndex++;
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      // Floor (Col B) - Centered
      row.getCell(2).value = floorName;
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

      // Label (Col C) - Left
      row.getCell(3).value = r.label;
      row.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

      // K-Factor (Col D) - Centered
      row.getCell(4).value = r.kFactor;
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(4).numFmt = "0.0";

      // Target (Col E) - Centered
      row.getCell(5).value = r.solveFor === "Q" ? "Flow (Q)" : "Pressure (P)";
      row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

      // Pressure (Col F) - Centered (clean background)
      row.getCell(6).value = r.pressure;
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(6).numFmt = "0.00";

      // Flow (Col G) - Centered (clean background)
      row.getCell(7).value = r.flow;
      row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).numFmt = "0.00";

      // Coverage Area (Col H) - Centered (clean background)
      row.getCell(8).value = r.coverage;
      row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(8).numFmt = "0.0";

      // Hazard (Col I) - Left
      row.getCell(9).value = r.hazard;
      row.getCell(9).alignment = { horizontal: "left", vertical: "middle" };

      // Compliance Status (Col J) - Centered
      const minP = isSI ? 0.48 : 7.0;
      const isCompliant = r.pressure >= minP;
      row.getCell(10).value = isCompliant ? "• COMPLIED" : "⚠️ LOW PRESSURE";
      row.getCell(10).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(10).font = { name: "Arial", size: 9.5, bold: true, color: { argb: isCompliant ? "FF2E7D32" : "FFD32F2F" } };
      row.getCell(10).fill = isCompliant ? greenFill : amberFill;

      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        if (!cell.font) cell.font = baseFont;
        setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
      }

      currentRow++;
    });
  });

  const dataRowEnd = currentRow - 1;

  // Grand Total Summary Row
  const totRow = sheet.getRow(currentRow);
  totRow.height = 24;
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  totRow.getCell(1).value = "TOTAL / SYSTEM DEMAND:";
  totRow.getCell(1).font = boldFont;
  totRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
  totRow.getCell(1).fill = grayFill;

  // Max Operating Pressure (Col F) - Centered
  totRow.getCell(6).value = maxPressure;
  totRow.getCell(6).font = boldFont;
  totRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  totRow.getCell(6).numFmt = "0.00";
  totRow.getCell(6).fill = grayFill;

  // Total Demand Flow (Col G) - Centered (Only this primary output cell gets blueFill, matching Ventilation)
  totRow.getCell(7).value = totalFlow;
  totRow.getCell(7).font = boldFont;
  totRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
  totRow.getCell(7).numFmt = "0.00";
  totRow.getCell(7).fill = blueFill;

  // Total Coverage (Col H) - Centered
  totRow.getCell(8).value = totalCoverage;
  totRow.getCell(8).font = boldFont;
  totRow.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
  totRow.getCell(8).numFmt = "0.0";
  totRow.getCell(8).fill = grayFill;

  sheet.mergeCells(`I${currentRow}:J${currentRow}`);
  totRow.getCell(9).value = `System: ${systemDemand.toFixed(1)} ${flowUnit}`;
  totRow.getCell(9).font = boldFont;
  totRow.getCell(9).alignment = { horizontal: "center", vertical: "middle" };
  totRow.getCell(9).fill = grayFill;

  for (let c = 1; c <= 10; c++) {
    const cell = totRow.getCell(c);
    setCellBorder(cell, "medium", "medium", c === 1 ? "medium" : "thin", c === 10 ? "medium" : "thin");
  }

  currentRow += 2;

  // 3-Tier Digital Review Signatures Block spanning Columns A to J (totalColumns = 10)
  addExcelSignatureBlock(
    sheet,
    currentRow,
    currentUserName,
    projectNo || activeProjectId,
    "/plumbing-sprinkler-kfactor",
    10
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${(projectName || "Sprinkler_K_Factor").replace(/\s+/g, "_")}_Calculation.xlsx`;
  downloadFile(new Uint8Array(buffer), filename, "Excel Document", ["xlsx"]);
};
