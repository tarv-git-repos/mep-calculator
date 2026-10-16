import * as ExcelJSModule from "exceljs";
import { downloadFile } from "./download";
import { resolveLatestReviewState } from "./pdfHelpers";
import { workspaceStore } from "./workspace-store";
import { fToC, cfmToLps } from "@/utils/conversions";

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

export interface CondensateExportRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
  wIn?: number;
  wOut?: number;
  condFlow?: number;
}

export interface CondensateExcelMetaData {
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

// ASHRAE saturation pressure model (Pa)
function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

function wFromWB(db: number, wb: number, p: number = 101325): number {
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  const w = ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
  return Math.max(0, w);
}

export const exportCondensateExcel = async (
  rows: CondensateExportRow[],
  meta: CondensateExcelMetaData = {},
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

  // Resolve Review & Approval State
  const reviewState = liveReviewState || resolveLatestReviewState(activeProjectId, "/condensate-drain-calc");
  const isApproved = reviewState?.status === "APPROVED";
  const isReviewed = isApproved || reviewState?.status === "REVIEWED" || reviewState?.status === "IN_REVIEW";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = currentUserName;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("FCU - FAHU CONDENSATE DRAIN", {
    views: [{ showGridLines: true }]
  });

  const isIP = meta.unitSystem === "ip";

  const fontCambria = (size: number = 11, bold: boolean = false) => ({
    name: "Cambria",
    size,
    bold,
    family: 1
  });

  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFBFBFBF" }
  };

  const summaryFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFD9D9D9" }
  };

  const peachFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFCE4D6" }
  };

  // Set Column Widths matching official CEC-MED-FRM-114 template
  sheet.getColumn(1).width = 7.5;   // A: S.No
  sheet.getColumn(2).width = 24;    // B: UNIT REF.
  sheet.getColumn(3).width = 20;    // C: ON COIL CONDN
  sheet.getColumn(4).width = 20;    // D: OFF COIL CONDN
  sheet.getColumn(5).width = 16;    // E: AIR FLOW RATE
  sheet.getColumn(6).width = 10;    // F: QTY.
  sheet.getColumn(7).width = 20;    // G: ON COIL SP.HUMIDITY
  sheet.getColumn(8).width = 20;    // H: OFF COIL SP.HUMIDITY
  sheet.getColumn(9).width = 22;    // I: MOISTURE REMOVED (BACKEND)
  sheet.getColumn(10).width = 20;   // J: MOISTURE REMOVED

  const calcNo = meta.calcNo || (activeProj as any)?.calcNo || "CEC-MED-PXXX-114";
  const revNo = meta.revNo || "Rev.0";
  const dateStr = meta.date || new Date().toLocaleDateString("en-GB");
  const projNo = meta.projectNo || activeProj?.code || "P000";
  const clientName = meta.client || activeProj?.client || "";
  const projectName = meta.projectName || activeProj?.name || "MEP Project";
  const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj?.location || "";

  // Helper to format ranges
  const formatRange = (
    startCell: string,
    endCell: string,
    value: any,
    font: any,
    alignment: any,
    fill?: any,
    customBorder?: any
  ) => {
    sheet.mergeCells(`${startCell}:${endCell}`);
    const tl = sheet.getCell(startCell);
    tl.value = value;
    tl.font = font;
    tl.alignment = alignment;
    if (fill) tl.fill = fill;

    const startCol = sheet.getCell(startCell).col;
    const startRow = sheet.getCell(startCell).row;
    const endCol = sheet.getCell(endCell).col;
    const endRow = sheet.getCell(endCell).row;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.getCell(r, c);
        cell.border = customBorder || {
          top: { style: r === 1 ? "medium" : "thin" as const, color: { indexed: 64 } },
          bottom: { style: "thin" as const, color: { indexed: 64 } },
          left: { style: c === 1 ? "double" : "thin" as const, color: { indexed: 64 } },
          right: { style: c === 10 ? "double" : "thin" as const, color: { indexed: 64 } },
        };
      }
    }
  };

  // Top Metadata Block (Rows 1 to 3)
  // Row 1
  sheet.getRow(1).height = 24;
  formatRange("A1", "D1", `Calculation No: ${calcNo} Rev. No.: ${revNo}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });
  formatRange("E1", "J1", `Date      : ${dateStr}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });

  // Row 2
  sheet.getRow(2).height = 24;
  formatRange("A2", "D2", `Project No      : ${projNo}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });
  formatRange("E2", "J2", `Client    : ${clientName}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });

  // Row 3
  sheet.getRow(3).height = 24;
  formatRange("A3", "D3", `Project Name : ${projectName}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });
  formatRange("E3", "J3", `End User: ${endUser}`, fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });

  // Row 4: Blank separator row with double outer borders
  sheet.getRow(4).height = 16;
  sheet.getCell("A4").border = { left: { style: "double", color: { indexed: 64 } } };
  sheet.getCell("J4").border = { right: { style: "double", color: { indexed: 64 } } };

  // Table Headers (Rows 5 & 6)
  sheet.getRow(5).height = 36;
  sheet.getRow(6).height = 22;

  // S.No (Merged A5:A6)
  formatRange("A5", "A6", "S.No", fontCambria(10, true), { horizontal: "center", vertical: "middle", wrapText: true }, headerFill, {
    top: { style: "medium", color: { indexed: 64 } },
    bottom: { style: "medium", color: { indexed: 64 } },
    left: { style: "double", color: { indexed: 64 } },
    right: { style: "medium", color: { indexed: 64 } }
  });

  // UNIT REF. (Merged B5:B6)
  formatRange("B5", "B6", "UNIT REF.", fontCambria(10, true), { horizontal: "center", vertical: "middle", wrapText: true }, headerFill, {
    top: { style: "medium", color: { indexed: 64 } },
    bottom: { style: "medium", color: { indexed: 64 } },
    left: { style: "medium", color: { indexed: 64 } },
    right: { style: "medium", color: { indexed: 64 } }
  });

  // Columns C to J (Row 5 Title, Row 6 Units)
  const headers = [
    { col: "C", cIdx: 3, title: "ON COIL CONDN DRY BULB/WET BULB", unit: "Â°C" },
    { col: "D", cIdx: 4, title: "OFF COIL CONDN DRY BULB/WET BULB", unit: "Â°C" },
    { col: "E", cIdx: 5, title: "AIR FLOW RATE", unit: "l/s" },
    { col: "F", cIdx: 6, title: "QTY.", unit: "NOS." },
    { col: "G", cIdx: 7, title: "ON COIL SP.HUMIDITY", unit: "kg/kg of dry air" },
    { col: "H", cIdx: 8, title: "OFF COIL SP.HUMIDITY", unit: "kg/kg of dry air" },
    { col: "I", cIdx: 9, title: "MOISTURE REMOVED (BACKEND)", unit: "kg of water/s" },
    { col: "J", cIdx: 10, title: "MOISTURE REMOVED", unit: "litres of water/s" },
  ];

  headers.forEach(h => {
    const c5 = sheet.getCell(5, h.cIdx);
    c5.value = h.title;
    c5.font = fontCambria(9.5, true);
    c5.fill = headerFill;
    c5.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c5.border = {
      top: { style: "medium", color: { indexed: 64 } },
      bottom: { style: "thin", color: { indexed: 64 } },
      left: { style: "medium", color: { indexed: 64 } },
      right: { style: h.cIdx === 10 ? "double" : "medium", color: { indexed: 64 } }
    };

    const c6 = sheet.getCell(6, h.cIdx);
    c6.value = h.unit;
    c6.font = fontCambria(9, false);
    c6.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c6.border = {
      top: { style: "thin", color: { indexed: 64 } },
      bottom: { style: "medium", color: { indexed: 64 } },
      left: { style: "medium", color: { indexed: 64 } },
      right: { style: h.cIdx === 10 ? "double" : "medium", color: { indexed: 64 } }
    };
  });

  // Data Rows (Row 7 onwards)
  const startDataRow = 7;
  const rowsToExport = rows.length > 0 ? rows : [
    { id: "coil-1", name: "AHU-01", dbIn: 24.0, wbIn: 18.0, dbOut: 13.0, wbOut: 12.0, flow: 1500 }
  ];

  rowsToExport.forEach((r, idx) => {
    const rowNum = startDataRow + idx;
    const row = sheet.getRow(rowNum);
    row.height = 24;

    // Convert to metric values if input was in IP
    const dbInC = isIP ? fToC(r.dbIn) : r.dbIn;
    const wbInC = isIP ? fToC(r.wbIn) : r.wbIn;
    const dbOutC = isIP ? fToC(r.dbOut) : r.dbOut;
    const wbOutC = isIP ? fToC(r.wbOut) : r.wbOut;
    const flowLps = isIP ? cfmToLps(r.flow) : r.flow;

    let calcWIn = 0;
    let calcWOut = 0;
    try { calcWIn = wFromWB(dbInC, wbInC); } catch (e) {}
    try { calcWOut = wFromWB(dbOutC, wbOutC); } catch (e) {}

    // S.No
    const c1 = row.getCell(1);
    c1.value = idx + 1;
    c1.alignment = { horizontal: "center", vertical: "middle" };

    // UNIT REF.
    const c2 = row.getCell(2);
    c2.value = r.name;
    c2.alignment = { horizontal: "center", vertical: "middle" };
    c2.font = fontCambria(10, true);

    // ON COIL CONDN
    const c3 = row.getCell(3);
    c3.value = `${dbInC.toFixed(1)} / ${wbInC.toFixed(1)}`;
    c3.alignment = { horizontal: "center", vertical: "middle" };

    // OFF COIL CONDN
    const c4 = row.getCell(4);
    c4.value = `${dbOutC.toFixed(1)} / ${wbOutC.toFixed(1)}`;
    c4.alignment = { horizontal: "center", vertical: "middle" };

    // AIR FLOW RATE (l/s)
    const c5 = row.getCell(5);
    c5.value = Math.round(flowLps);
    c5.alignment = { horizontal: "center", vertical: "middle" };
    c5.numFmt = "#,##0";

    // QTY.
    const c6 = row.getCell(6);
    c6.value = 1;
    c6.alignment = { horizontal: "center", vertical: "middle" };

    // ON COIL SP.HUMIDITY (kg/kg of dry air)
    const c7 = row.getCell(7);
    c7.value = Number(calcWIn.toFixed(6));
    c7.alignment = { horizontal: "center", vertical: "middle" };
    c7.numFmt = "0.000000";

    // OFF COIL SP.HUMIDITY (kg/kg of dry air)
    const c8 = row.getCell(8);
    c8.value = Number(calcWOut.toFixed(6));
    c8.alignment = { horizontal: "center", vertical: "middle" };
    c8.numFmt = "0.000000";

    // MOISTURE REMOVED (BACKEND) (kg of water/s) -> formula: =(G-H)*E*0.0012*F
    const c9 = row.getCell(9);
    c9.value = { formula: `MAX(0, (G${rowNum}-H${rowNum})*E${rowNum}*0.0012*F${rowNum})` };
    c9.alignment = { horizontal: "center", vertical: "middle" };
    c9.numFmt = "0.00";

    // MOISTURE REMOVED (litres of water/s)
    const c10 = row.getCell(10);
    c10.value = { formula: `I${rowNum}` };
    c10.alignment = { horizontal: "center", vertical: "middle" };
    c10.numFmt = "0.00";

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      if (!cell.font) cell.font = fontCambria(10, false);
      cell.border = {
        top: { style: "thin", color: { indexed: 64 } },
        bottom: { style: "thin", color: { indexed: 64 } },
        left: { style: c === 1 ? "double" : "thin", color: { indexed: 64 } },
        right: { style: c === 10 ? "double" : "thin", color: { indexed: 64 } },
      };
    }
  });

  const endDataRow = startDataRow + rowsToExport.length - 1;

  // Summary Rows
  // 1. Total Condensate Drain (Litres per Minute)
  const rSum1 = endDataRow + 1;
  sheet.getRow(rSum1).height = 24;
  sheet.mergeCells(`A${rSum1}:I${rSum1}`);
  const s1Text = sheet.getCell(`A${rSum1}`);
  s1Text.value = "Total Condensate Drain (Litres per Minute)";
  s1Text.font = fontCambria(11, true);
  s1Text.fill = summaryFill;
  s1Text.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  const s1Val = sheet.getCell(`J${rSum1}`);
  s1Val.value = { formula: `SUM(J${startDataRow}:J${endDataRow})*60` };
  s1Val.font = fontCambria(11, true);
  s1Val.numFmt = "0.00";
  s1Val.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 10; c++) {
    sheet.getCell(rSum1, c).border = {
      top: { style: "thin", color: { indexed: 64 } },
      bottom: { style: "thin", color: { indexed: 64 } },
      left: { style: c === 1 ? "double" : "thin", color: { indexed: 64 } },
      right: { style: c === 10 ? "double" : "thin", color: { indexed: 64 } },
    };
  }

  // 2. Total Volume of Water Collected (Cubic Meter per minute)
  const rSum2 = endDataRow + 2;
  sheet.getRow(rSum2).height = 24;
  sheet.mergeCells(`A${rSum2}:I${rSum2}`);
  const s2Text = sheet.getCell(`A${rSum2}`);
  s2Text.value = "Total Volume of Water Collected (Cubic Meter per minute)";
  s2Text.font = fontCambria(11, true);
  s2Text.fill = summaryFill;
  s2Text.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  const s2Val = sheet.getCell(`J${rSum2}`);
  s2Val.value = { formula: `J${rSum1}*0.001` };
  s2Val.font = fontCambria(11, true);
  s2Val.numFmt = "0.00";
  s2Val.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 10; c++) {
    sheet.getCell(rSum2, c).border = {
      top: { style: "thin", color: { indexed: 64 } },
      bottom: { style: "thin", color: { indexed: 64 } },
      left: { style: c === 1 ? "double" : "thin", color: { indexed: 64 } },
      right: { style: c === 10 ? "double" : "thin", color: { indexed: 64 } },
    };
  }

  // 3. Blank spacer between summary rows
  const rBlank = endDataRow + 3;
  sheet.getRow(rBlank).height = 24;
  sheet.getCell(`A${rBlank}`).border = { left: { style: "double", color: { indexed: 64 } } };
  sheet.getCell(`J${rBlank}`).border = { right: { style: "double", color: { indexed: 64 } } };

  // 4. Total Volume of Water Collected (Cubic Meter per Hour)
  const rSum3 = endDataRow + 4;
  sheet.getRow(rSum3).height = 24;
  sheet.mergeCells(`A${rSum3}:I${rSum3}`);
  const s3Text = sheet.getCell(`A${rSum3}`);
  s3Text.value = "Total Volume of Water Collected (Cubic Meter per Hour)";
  s3Text.font = fontCambria(11, true);
  s3Text.fill = summaryFill;
  s3Text.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  const s3Val = sheet.getCell(`J${rSum3}`);
  s3Val.value = { formula: `J${rSum2}*60` };
  s3Val.font = fontCambria(11, true);
  s3Val.numFmt = "0.00";
  s3Val.alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 10; c++) {
    sheet.getCell(rSum3, c).border = {
      top: { style: "thin", color: { indexed: 64 } },
      bottom: { style: "thin", color: { indexed: 64 } },
      left: { style: c === 1 ? "double" : "thin", color: { indexed: 64 } },
      right: { style: c === 10 ? "double" : "thin", color: { indexed: 64 } },
    };
  }

  // References Block
  const rRef = endDataRow + 5;
  sheet.getRow(rRef).height = 20;
  formatRange(`A${rRef}`, `J${rRef}`, "Reference:", fontCambria(11, true), { horizontal: "left", vertical: "middle", indent: 1 });

  const rRef1 = endDataRow + 6;
  sheet.getRow(rRef1).height = 20;
  formatRange(`A${rRef1}`, `J${rRef1}`, "1. Architectural Drawings:", fontCambria(11, false), { horizontal: "left", vertical: "middle", indent: 1 });

  const rRef2 = endDataRow + 7;
  sheet.getRow(rRef2).height = 20;
  formatRange(`A${rRef2}`, `J${rRef2}`, "2. DBR", fontCambria(11, false), { horizontal: "left", vertical: "middle", indent: 1 });

  // Single blank row before signatures with outer frame
  const rBlankSig = endDataRow + 8;
  sheet.getRow(rBlankSig).height = 20;
  sheet.getCell(`A${rBlankSig}`).border = { left: { style: "double", color: { indexed: 64 } } };
  sheet.getCell(`J${rBlankSig}`).border = { right: { style: "double", color: { indexed: 64 } } };

  // Signatures Block matching official template
  // Header Row (Row N+9)
  const rSigHead = endDataRow + 9;
  sheet.getRow(rSigHead).height = 24;

  formatRange(`A${rSigHead}`, `B${rSigHead}`, "", fontCambria(11, true), { horizontal: "center", vertical: "middle" }, peachFill);
  formatRange(`C${rSigHead}`, `D${rSigHead}`, "Originator", fontCambria(11, true), { horizontal: "center", vertical: "middle" }, peachFill);
  formatRange(`E${rSigHead}`, `G${rSigHead}`, "Reviewer", fontCambria(11, true), { horizontal: "center", vertical: "middle" }, peachFill);
  formatRange(`H${rSigHead}`, `J${rSigHead}`, "Approver", fontCambria(11, true), { horizontal: "center", vertical: "middle" }, peachFill);

  // Signatures: Name (Row N+10)
  const rSigName = endDataRow + 10;
  sheet.getRow(rSigName).height = 24;
  formatRange(`A${rSigName}`, `B${rSigName}`, "Name:", fontCambria(11, false), { horizontal: "left", vertical: "middle", indent: 1 });
  formatRange(`C${rSigName}`, `D${rSigName}`, currentUserName, fontCambria(11, true), { horizontal: "center", vertical: "middle" });
  formatRange(`E${rSigName}`, `G${rSigName}`, isReviewed ? (reviewState?.reviewerName || "Senior HVAC Engineer") : "", fontCambria(11, false), { horizontal: "center", vertical: "middle" });
  formatRange(`H${rSigName}`, `J${rSigName}`, isApproved ? (reviewState?.approverName || "Discipline Coordinator") : "", fontCambria(11, false), { horizontal: "center", vertical: "middle" });

  // Signatures: Signature (Row N+11)
  const rSigSig = endDataRow + 11;
  sheet.getRow(rSigSig).height = 24;
  formatRange(`A${rSigSig}`, `B${rSigSig}`, "Signature:", fontCambria(11, false), { horizontal: "left", vertical: "middle", indent: 1 });
  formatRange(`C${rSigSig}`, `D${rSigSig}`, "Digitally Verified", fontCambria(10, false), { horizontal: "center", vertical: "middle" });
  formatRange(`E${rSigSig}`, `G${rSigSig}`, isReviewed ? "Digitally Reviewed" : "", fontCambria(10, false), { horizontal: "center", vertical: "middle" });
  formatRange(`H${rSigSig}`, `J${rSigSig}`, isApproved ? "Digitally Approved" : "", fontCambria(10, false), { horizontal: "center", vertical: "middle" });

  // Signatures: Date (Row N+12)
  const rSigDate = endDataRow + 12;
  sheet.getRow(rSigDate).height = 28;
  const reviewDateStr = reviewState?.reviewedAt ? new Date(reviewState.reviewedAt).toLocaleDateString("en-GB") : dateStr;
  const approveDateStr = reviewState?.approvedAt ? new Date(reviewState.approvedAt).toLocaleDateString("en-GB") : dateStr;

  const doubleBottomBorder = {
    top: { style: "thin" as const, color: { indexed: 64 } },
    bottom: { style: "double" as const, color: { indexed: 64 } },
    left: { style: "thin" as const, color: { indexed: 64 } },
    right: { style: "thin" as const, color: { indexed: 64 } },
  };

  formatRange(`A${rSigDate}`, `B${rSigDate}`, "Date:", fontCambria(11, false), { horizontal: "left", vertical: "middle", indent: 1 }, undefined, {
    ...doubleBottomBorder,
    left: { style: "double" as const, color: { indexed: 64 } },
    right: { style: "thin" as const, color: { indexed: 64 } },
  });
  formatRange(`C${rSigDate}`, `D${rSigDate}`, dateStr, fontCambria(10, false), { horizontal: "center", vertical: "middle" }, undefined, doubleBottomBorder);
  formatRange(`E${rSigDate}`, `G${rSigDate}`, isReviewed ? reviewDateStr : "", fontCambria(10, false), { horizontal: "center", vertical: "middle" }, undefined, doubleBottomBorder);
  formatRange(`H${rSigDate}`, `J${rSigDate}`, isApproved ? approveDateStr : "", fontCambria(10, false), { horizontal: "center", vertical: "middle" }, undefined, {
    ...doubleBottomBorder,
    right: { style: "double" as const, color: { indexed: 64 } },
  });

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const sanitizedFilename = (projectName || "Condensate_Drain_Calculation").replace(/[^\w\d-_]/g, "_");
  downloadFile(
    new Uint8Array(xlsxBuffer),
    `CEC-MED-FRM-114-Rev.0-Condensate_Drain_Calculations-${sanitizedFilename}.xlsx`,
    "Excel Document",
    ["xlsx"]
  );
};
