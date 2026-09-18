import * as ExcelJSModule from "exceljs";
import { downloadFile } from "./download";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { workspaceStore } from "./workspace-store";

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

export interface DiffuserRowExport {
  id: string;
  name: string;
  floor?: string;
  zone?: string;
  flow: number;
  count: number;
  flowPerDiff: number;
  diffType: string;
  diffTypeName: string;
  neckSize: string;
  velocity: number;
  velocityFpm: number;
  throwVal: string;
  nc: string;
  adpi: string;
}

export interface DiffuserScheduleExportParams {
  rows: DiffuserRowExport[];
  unitSystem: "si" | "ip";
}

export interface DiffuserExcelMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
}

export const exportDiffuserSelectorExcel = async (
  params: DiffuserScheduleExportParams | any,
  meta: DiffuserExcelMetaData = {}
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

  const sheet = workbook.addWorksheet("Diffuser Selection Schedule", {
    views: [{ showGridLines: true }],
  });

  const baseFont = { name: "Arial", size: 10, family: 2 };
  const boldFont = { ...baseFont, bold: true };
  const titleFont = { name: "Arial", size: 14, bold: true };
  const subHeaderFont = { name: "Arial", size: 11, bold: true };

  const grayFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  const peachFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" },
  };

  const blueFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDAE9F8" },
  };

  const highlightFill: any = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" }, // Soft green
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

  // Convert input to rows list
  let rowsList: DiffuserRowExport[] = [];
  const unitSystem = params.unitSystem || "si";
  const isIP = unitSystem === "ip";
  const flowUnit = isIP ? "CFM" : "L/s";
  const velUnit = isIP ? "FPM" : "m/s";
  const lenUnit = isIP ? "ft" : "m";

  if (Array.isArray(params.rows)) {
    rowsList = params.rows;
  } else if (params.calculatedData) {
    // Single item fallback
    rowsList = [
      {
        id: "1",
        name: "General Room",
        floor: "GF",
        zone: "Zone-1",
        flow: Number(params.calculatedData.flowVal || 0),
        count: Number(params.calculatedData.countVal || 1),
        flowPerDiff: Number(params.calculatedData.flowPerDiff || 0),
        diffType: params.diffuserType || "square",
        diffTypeName: (params.diffuserType || "square").toUpperCase(),
        neckSize: params.calculatedData.neckSize || "-",
        velocity: params.designVelocity || 2.0,
        velocityFpm: params.calculatedData.velocityFpm || 394,
        throwVal: params.calculatedData.throwVal || "-",
        nc: params.calculatedData.nc || "-",
        adpi: params.calculatedData.adpi || "-"
      }
    ];
  }

  // 12 Columns (A to L)
  sheet.getColumn(1).width = 8;    // A: Sr. No.
  sheet.getColumn(2).width = 12;   // B: Space Floor
  sheet.getColumn(3).width = 24;   // C: Space Name
  sheet.getColumn(4).width = 16;   // D: Zone
  sheet.getColumn(5).width = 24;   // E: Diffuser Model / Type
  sheet.getColumn(6).width = 15;   // F: Total Flow (L/s or CFM)
  sheet.getColumn(7).width = 12;   // G: Diffuser Qty
  sheet.getColumn(8).width = 15;   // H: Flow / Unit
  sheet.getColumn(9).width = 18;   // I: Recommended Neck Size
  sheet.getColumn(10).width = 15;  // J: Core Velocity
  sheet.getColumn(11).width = 14;  // K: Throw (T50)
  sheet.getColumn(12).width = 14;  // L: Noise Criteria (NC)

  // Title Row
  sheet.getRow(2).height = 24;
  sheet.getCell("A2").value = "Air Distribution & Diffuser Selection Schedule";
  sheet.getCell("A2").font = titleFont;

  // Metadata Block (Rows 4 to 6)
  const calcNo = meta.calcNo || (activeProj as any)?.calcNo || "TRV-DIF-CAL-01";
  const today = meta.date || new Date().toLocaleDateString("en-GB");
  const projectNo = meta.projectNo || activeProj.code || "P000";
  const projectName = meta.projectName || activeProj.name || "";
  const clientName = meta.client || activeProj.client || "";
  const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj.location || "";

  sheet.mergeCells("A4:F4");
  sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
  sheet.getCell("A4").font = boldFont;

  sheet.mergeCells("G4:L4");
  sheet.getCell("G4").value = `Date:  ${today}`;
  sheet.getCell("G4").font = boldFont;

  sheet.mergeCells("A5:F5");
  sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
  sheet.getCell("A5").font = boldFont;

  sheet.mergeCells("G5:L5");
  sheet.getCell("G5").value = `Client:   ${clientName}`;
  sheet.getCell("G5").font = boldFont;

  sheet.mergeCells("A6:F6");
  sheet.getCell("A6").value = `Project Name:   ${projectName}`;
  sheet.getCell("A6").font = boldFont;

  sheet.mergeCells("G6:L6");
  sheet.getCell("G6").value = `End User:   ${endUser}`;
  sheet.getCell("G6").font = boldFont;

  for (let r = 4; r <= 6; r++) {
    sheet.getRow(r).height = 22;
    for (let c = 1; c <= 12; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === 4 ? "medium" : "thin";
      const bottomStyle = r === 6 ? "medium" : "thin";
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = c === 12 ? "medium" : (c === 6 ? "medium" : "thin");
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: "middle", indent: (c === 1 || c === 7) ? 1 : 0 };
      if (!cell.font || !cell.font.bold) cell.font = baseFont;
    }
  }

  // Header Rows (Rows 8, 9, 10)
  sheet.getRow(8).height = 24;
  sheet.getRow(9).height = 30;
  sheet.getRow(10).height = 22;

  sheet.mergeCells("A8:E8");
  sheet.getCell("A8").value = "Space & Room Information";

  sheet.mergeCells("F8:H8");
  sheet.getCell("F8").value = "Airflow Demand";

  sheet.mergeCells("I8:L8");
  sheet.getCell("I8").value = "Diffuser Sizing & Performance";

  sheet.mergeCells("A9:A10");
  sheet.getCell("A9").value = "Sr. No.";

  sheet.mergeCells("B9:B10");
  sheet.getCell("B9").value = "Floor";

  sheet.mergeCells("C9:C10");
  sheet.getCell("C9").value = "Space / Room Name";

  sheet.mergeCells("D9:D10");
  sheet.getCell("D9").value = "Zone";

  sheet.mergeCells("E9:E10");
  sheet.getCell("E9").value = "Terminal Type / Model";

  sheet.getCell("F9").value = "Total Flow";
  sheet.getCell("G9").value = "Diffuser";
  sheet.getCell("H9").value = "Flow / Unit";

  sheet.getCell("F10").value = `(${flowUnit})`;
  sheet.getCell("G10").value = "Qty (No.)";
  sheet.getCell("H10").value = `(${flowUnit})`;

  sheet.mergeCells("I9:I10");
  sheet.getCell("I9").value = "Recommended\nNeck Size";

  sheet.getCell("J9").value = "Velocity";
  sheet.getCell("J10").value = `(${velUnit})`;

  sheet.getCell("K9").value = "Throw (T50)";
  sheet.getCell("K10").value = `(${lenUnit})`;

  sheet.mergeCells("L9:L10");
  sheet.getCell("L9").value = "Sound Rating\n(NC)";

  for (let r = 8; r <= 10; r++) {
    for (let c = 1; c <= 12; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = boldFont;
      cell.fill = r === 8 ? grayFill : blueFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      const topStyle = r === 8 ? "medium" : "thin";
      const bottomStyle = r === 10 ? "medium" : "thin";
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = c === 12 ? "medium" : "thin";
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
    }
  }

  // Data Rows
  let curRow = 11;
  const startDataRow = curRow;

  rowsList.forEach((row, idx) => {
    sheet.getRow(curRow).height = 22;

    sheet.getCell(`A${curRow}`).value = idx + 1;
    sheet.getCell(`A${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`B${curRow}`).value = row.floor || "GF";
    sheet.getCell(`B${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`C${curRow}`).value = row.name;
    sheet.getCell(`C${curRow}`).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    sheet.getCell(`D${curRow}`).value = row.zone || "Zone-1";
    sheet.getCell(`D${curRow}`).alignment = { horizontal: "left", vertical: "middle" };

    sheet.getCell(`E${curRow}`).value = row.diffTypeName;
    sheet.getCell(`E${curRow}`).alignment = { horizontal: "left", vertical: "middle" };

    sheet.getCell(`F${curRow}`).value = Number(row.flow.toFixed(1));
    sheet.getCell(`F${curRow}`).numFmt = "#,##0.0";
    sheet.getCell(`F${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`G${curRow}`).value = Number(row.count);
    sheet.getCell(`G${curRow}`).numFmt = "0";
    sheet.getCell(`G${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`H${curRow}`).value = Number(row.flowPerDiff.toFixed(1));
    sheet.getCell(`H${curRow}`).numFmt = "#,##0.0";
    sheet.getCell(`H${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`I${curRow}`).value = row.neckSize;
    sheet.getCell(`I${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(`I${curRow}`).font = boldFont;

    sheet.getCell(`J${curRow}`).value = isIP ? Number(row.velocityFpm.toFixed(0)) : Number(row.velocity.toFixed(2));
    sheet.getCell(`J${curRow}`).numFmt = isIP ? "#,##0" : "0.00";
    sheet.getCell(`J${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`K${curRow}`).value = row.throwVal;
    sheet.getCell(`K${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getCell(`L${curRow}`).value = row.nc;
    sheet.getCell(`L${curRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 12; c++) {
      const cell = sheet.getCell(curRow, c);
      if (!cell.font || !cell.font.bold) cell.font = baseFont;
      setCellBorder(cell, "thin", "thin", c === 1 ? "medium" : "thin", c === 12 ? "medium" : "thin");
    }

    curRow++;
  });

  const lastDataRow = curRow - 1;

  // Total Row
  sheet.getRow(curRow).height = 24;
  sheet.mergeCells(`A${curRow}:E${curRow}`);
  sheet.getCell(`A${curRow}`).value = "Total Scheduled Outlets:";
  sheet.getCell(`A${curRow}`).font = boldFont;
  sheet.getCell(`A${curRow}`).alignment = { horizontal: "right", vertical: "middle" };

  for (let c = 1; c <= 12; c++) {
    const cell = sheet.getCell(curRow, c);
    cell.fill = grayFill;
    setCellBorder(cell, "medium", "medium", c === 1 ? "medium" : "thin", c === 12 ? "medium" : "thin");
  }

  // Total Airflow
  const totalFlowCell = sheet.getCell(`F${curRow}`);
  if (lastDataRow >= startDataRow) {
    totalFlowCell.value = { formula: `=SUM(F${startDataRow}:F${lastDataRow})` };
  } else {
    totalFlowCell.value = 0;
  }
  totalFlowCell.font = boldFont;
  totalFlowCell.numFmt = "#,##0.0";
  totalFlowCell.alignment = { horizontal: "center", vertical: "middle" };

  // Total Diffusers
  const totalQtyCell = sheet.getCell(`G${curRow}`);
  if (lastDataRow >= startDataRow) {
    totalQtyCell.value = { formula: `=SUM(G${startDataRow}:G${lastDataRow})` };
  } else {
    totalQtyCell.value = 0;
  }
  totalQtyCell.font = boldFont;
  totalQtyCell.numFmt = "0";
  totalQtyCell.alignment = { horizontal: "center", vertical: "middle" };

  // Empty summary cells
  sheet.getCell(`H${curRow}`).value = "-";
  sheet.getCell(`H${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`I${curRow}`).value = "Schedule Complete";
  sheet.getCell(`I${curRow}`).font = boldFont;
  sheet.getCell(`I${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`J${curRow}`).value = "-";
  sheet.getCell(`J${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`K${curRow}`).value = "-";
  sheet.getCell(`K${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`L${curRow}`).value = "Complies";
  sheet.getCell(`L${curRow}`).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(`L${curRow}`).font = boldFont;

  // Gap before Reference Box
  curRow += 3;

  // Reference Block (Left side)
  const refStartRow = curRow;
  sheet.mergeCells(`A${refStartRow}:B${refStartRow}`);
  const refTitleCell = sheet.getCell(`A${refStartRow}`);
  refTitleCell.value = "Reference Standards:";
  refTitleCell.font = { ...boldFont, underline: true };

  sheet.mergeCells(`C${refStartRow}:F${refStartRow}`);
  sheet.getCell(`C${refStartRow}`).value = "1. ASHRAE Standard 70 - Method of Testing Air Outlets and Inlets";
  sheet.getCell(`C${refStartRow}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 1}:B${refStartRow + 1}`);
  sheet.mergeCells(`C${refStartRow + 1}:F${refStartRow + 1}`);
  sheet.getCell(`C${refStartRow + 1}`).value = "2. ASHRAE Handbook - Fundamentals (Space Air Diffusion & ADPI)";
  sheet.getCell(`C${refStartRow + 1}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 2}:B${refStartRow + 2}`);
  sheet.mergeCells(`C${refStartRow + 2}:F${refStartRow + 2}`);
  sheet.getCell(`C${refStartRow + 2}`).value = "3. SMACNA HVAC Systems Duct Design Guidelines";
  sheet.getCell(`C${refStartRow + 2}`).font = baseFont;

  for (let r = refStartRow; r <= refStartRow + 2; r++) {
    sheet.getRow(r).height = 20;
    for (let c = 1; c <= 6; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === refStartRow ? "medium" : "thin";
      const bottomStyle = r === refStartRow + 2 ? "medium" : "thin";
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = c === 6 ? "medium" : (c === 2 ? "medium" : "thin");
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: "middle", indent: c === 1 ? 1 : 0 };
    }
  }

  // Gap before Signatures
  curRow = refStartRow + 5;

  // Signature Block (Full width Columns A to L)
  const sigStartRow = curRow;
  sheet.getRow(sigStartRow).height = 24;

  sheet.mergeCells(`A${sigStartRow}:C${sigStartRow}`);
  sheet.getCell(`A${sigStartRow}`).value = "";

  sheet.mergeCells(`D${sigStartRow}:F${sigStartRow}`);
  sheet.getCell(`D${sigStartRow}`).value = "Originator";
  sheet.getCell(`D${sigStartRow}`).font = boldFont;
  sheet.getCell(`D${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${sigStartRow}:I${sigStartRow}`);
  sheet.getCell(`G${sigStartRow}`).value = "Reviewer";
  sheet.getCell(`G${sigStartRow}`).font = boldFont;
  sheet.getCell(`G${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`J${sigStartRow}:L${sigStartRow}`);
  sheet.getCell(`J${sigStartRow}`).value = "Approver";
  sheet.getCell(`J${sigStartRow}`).font = boldFont;
  sheet.getCell(`J${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 12; c++) {
    const cell = sheet.getCell(sigStartRow, c);
    cell.fill = peachFill;
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 3 || c === 6 || c === 9 || c === 12) ? "medium" : "thin";
    setCellBorder(cell, "medium", "thin", leftStyle, rightStyle);
  }

  const {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  } = getSignatureBlockDetails(activeProj?.id || "default", "/diffuser-selector", meta.userName || "");

  // Name Row
  const nameRow = sigStartRow + 1;
  sheet.getRow(nameRow).height = 24;
  sheet.mergeCells(`A${nameRow}:C${nameRow}`);
  sheet.getCell(`A${nameRow}`).value = "Name:";
  sheet.getCell(`A${nameRow}`).font = boldFont;
  sheet.getCell(`A${nameRow}`).alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(`D${nameRow}:F${nameRow}`);
  sheet.getCell(`D${nameRow}`).value = originatedName;
  sheet.getCell(`D${nameRow}`).font = baseFont;
  sheet.getCell(`D${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${nameRow}:I${nameRow}`);
  sheet.getCell(`G${nameRow}`).value = reviewerName;
  sheet.getCell(`G${nameRow}`).font = baseFont;
  sheet.getCell(`G${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`J${nameRow}:L${nameRow}`);
  sheet.getCell(`J${nameRow}`).value = approverName;
  sheet.getCell(`J${nameRow}`).font = baseFont;
  sheet.getCell(`J${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 12; c++) {
    const cell = sheet.getCell(nameRow, c);
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 3 || c === 6 || c === 9 || c === 12) ? "medium" : "thin";
    setCellBorder(cell, "thin", "thin", leftStyle, rightStyle);
  }

  // Date Row
  const dateRow = sigStartRow + 2;
  sheet.getRow(dateRow).height = 24;
  sheet.mergeCells(`A${dateRow}:C${dateRow}`);
  sheet.getCell(`A${dateRow}`).value = "Date:";
  sheet.getCell(`A${dateRow}`).font = boldFont;
  sheet.getCell(`A${dateRow}`).alignment = { horizontal: "right", vertical: "middle" };

  sheet.mergeCells(`D${dateRow}:F${dateRow}`);
  sheet.getCell(`D${dateRow}`).value = originatedDate;
  sheet.getCell(`D${dateRow}`).font = baseFont;
  sheet.getCell(`D${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`G${dateRow}:I${dateRow}`);
  sheet.getCell(`G${dateRow}`).value = reviewerDate;
  sheet.getCell(`G${dateRow}`).font = baseFont;
  sheet.getCell(`G${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells(`J${dateRow}:L${dateRow}`);
  sheet.getCell(`J${dateRow}`).value = approverDate;
  sheet.getCell(`J${dateRow}`).font = baseFont;
  sheet.getCell(`J${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

  for (let c = 1; c <= 12; c++) {
    const cell = sheet.getCell(dateRow, c);
    const leftStyle = c === 1 ? "medium" : "thin";
    const rightStyle = (c === 3 || c === 6 || c === 9 || c === 12) ? "medium" : "thin";
    setCellBorder(cell, "thin", "medium", leftStyle, rightStyle);
  }

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Diffuser_Selection_Schedule_${calcNo}.xlsx`;
  await downloadFile(new Uint8Array(buffer), filename, "Excel Document", ["xlsx"]);
};
