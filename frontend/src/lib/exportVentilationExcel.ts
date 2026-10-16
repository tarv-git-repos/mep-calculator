import { addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import * as ExcelJSModule from 'exceljs';
import * as fileSaver from 'file-saver';
import { downloadFile } from './download';
import { workspaceStore, type Space } from './workspace-store';
import { getOccupancyData } from './ashrae-data';

const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
const saveAs = (fileSaver as any)?.default?.saveAs || (fileSaver as any)?.saveAs || fileSaver;

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

export const exportVentilationExcel = async (
  spaces: Space[],
  meta: ProjectMetaData = {}
) => {
  let currentUserName = "System Admin";
  let activeProjectId = "default";
  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
      currentUserName = user.name || "System Admin";
      const ws = JSON.parse(localStorage.getItem('workspace-storage') || '{}');
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  const activeProj: any = workspaceStore.getState()?.project || {};

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ventilation Calculation', {
    views: [{ showGridLines: true }],
  });

  const baseFont = { name: 'Arial', size: 10, family: 2 };
  const boldFont = { ...baseFont, bold: true };
  const titleFont = { name: 'Arial', size: 14, bold: true };

  const grayFill: any = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' },
  };

  const peachFill: any = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFCE4D6' },
  };

  const blueFill: any = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDAE9F8' },
  };

  // Helper to set individual side border styles
  const setCellBorder = (
    cell: any,
    topStyle: string = 'thin',
    bottomStyle: string = 'thin',
    leftStyle: string = 'thin',
    rightStyle: string = 'thin'
  ) => {
    cell.border = {
      top: { style: topStyle, color: { argb: 'FF000000' } },
      bottom: { style: bottomStyle, color: { argb: 'FF000000' } },
      left: { style: leftStyle, color: { argb: 'FF000000' } },
      right: { style: rightStyle, color: { argb: 'FF000000' } },
    };
  };

  // Set Column Widths (15 columns)
  sheet.getColumn(1).width = 8;    // Sr. No.
  sheet.getColumn(2).width = 12;   // Space Floor
  sheet.getColumn(3).width = 24;   // Space Name
  sheet.getColumn(4).width = 22;   // Zone Name
  sheet.getColumn(5).width = 28;   // Occupancy Category
  sheet.getColumn(6).width = 12;   // Area (mÂ²)
  sheet.getColumn(7).width = 14;   // Fixtures/ Occupancy No's
  sheet.getColumn(8).width = 14;   // OA Rate L/s/mÂ²
  sheet.getColumn(9).width = 14;   // OA Rate L/s/person
  sheet.getColumn(10).width = 14;  // Total Fresh Air L/s
  sheet.getColumn(11).width = 14;  // Extract Air Number
  sheet.getColumn(12).width = 16;  // Extract Air Strategy
  sheet.getColumn(13).width = 14;  // Total Extract L/s
  sheet.getColumn(14).width = 16;  // Fresh Air Given L/s
  sheet.getColumn(15).width = 16;  // Extract Air Taken L/s

  // Title Row
  sheet.getRow(2).height = 24;
  sheet.getCell('A2').value = 'Ventilation Calculation';
  sheet.getCell('A2').font = titleFont;

  // Metadata Block (Rows 4 to 6)
  const calcNo = meta.calcNo || (activeProj as any)?.calcNo || 'TRV-CAL-101-R01';
  const today = meta.date || new Date().toLocaleDateString('en-GB');
  const projectNo = meta.projectNo || activeProj.code || 'P000';
  const projectName = meta.projectName || activeProj.name || '';
  const clientName = meta.client || activeProj.client || '';
  const endUser = meta.endUser || (activeProj as any)?.endUser || activeProj.location || '';

  sheet.mergeCells('A4:H4');
  sheet.getCell('A4').value = `Calculation No.:   ${calcNo}`;
  sheet.getCell('A4').font = boldFont;

  sheet.mergeCells('I4:O4');
  sheet.getCell('I4').value = `Date:  ${today}`;
  sheet.getCell('I4').font = boldFont;

  sheet.mergeCells('A5:H5');
  sheet.getCell('A5').value = `Project No.:   ${projectNo}`;
  sheet.getCell('A5').font = boldFont;

  sheet.mergeCells('I5:O5');
  sheet.getCell('I5').value = `Client:   ${clientName}`;
  sheet.getCell('I5').font = boldFont;

  sheet.mergeCells('A6:H6');
  sheet.getCell('A6').value = `Project Name:   ${projectName}`;
  sheet.getCell('A6').font = boldFont;

  sheet.mergeCells('I6:O6');
  sheet.getCell('I6').value = `End User:   ${endUser}`;
  sheet.getCell('I6').font = boldFont;
  sheet.getCell('I6').font = boldFont;

  for (let r = 4; r <= 6; r++) {
    sheet.getRow(r).height = 22;
    for (let c = 1; c <= 15; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === 4 ? 'medium' : 'thin';
      const bottomStyle = r === 6 ? 'medium' : 'thin';
      const leftStyle = c === 1 ? 'medium' : 'thin';
      const rightStyle = c === 15 ? 'medium' : (c === 8 ? 'medium' : 'thin');
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: 'middle', indent: (c === 1 || c === 9) ? 1 : 0 };
      if (!cell.font || !cell.font.bold) cell.font = baseFont;
    }
  }

  // Header Rows (Rows 8, 9, 10)
  sheet.getRow(8).height = 24;
  sheet.getRow(9).height = 32;
  sheet.getRow(10).height = 22;

  // Values & Merges FIRST
  sheet.mergeCells('A8:A10');
  sheet.getCell('A8').value = 'Sr. No.';

  sheet.mergeCells('B8:G8');
  sheet.getCell('B8').value = 'Space Parameters';

  sheet.mergeCells('H8:J8');
  sheet.getCell('H8').value = 'Fresh Air';

  sheet.mergeCells('K8:M8');
  sheet.getCell('K8').value = 'Extract';

  sheet.mergeCells('N8:O8');
  sheet.getCell('N8').value = 'Balancing';

  sheet.mergeCells('B9:B10');
  sheet.getCell('B9').value = 'Space Floor';

  sheet.mergeCells('C9:C10');
  sheet.getCell('C9').value = 'Space Name';

  sheet.mergeCells('D9:D10');
  sheet.getCell('D9').value = 'Zone Name';

  sheet.mergeCells('E9:E10');
  sheet.getCell('E9').value = 'Occupancy Category';

  sheet.getCell('F9').value = 'Area';
  sheet.getCell('G9').value = 'Fixtures/\nOccupancy';

  sheet.mergeCells('H9:I9');
  sheet.getCell('H9').value = 'Outdoor Air Rate';

  sheet.getCell('J9').value = 'Total Fresh Air';

  sheet.mergeCells('K9:K10');
  sheet.getCell('K9').value = 'Extract Air\nNumber';

  sheet.mergeCells('L9:L10');
  sheet.getCell('L9').value = 'Extract Air\nStrategy';

  sheet.getCell('M9').value = 'Total\nExtract';

  sheet.getCell('N9').value = 'Fresh Air\nGiven';
  sheet.getCell('O9').value = 'Extract Air\nTaken';

  sheet.getCell('F10').value = '(m²)';
  sheet.getCell('G10').value = "No's";
  sheet.getCell('H10').value = 'L/s/m²';
  sheet.getCell('I10').value = 'L/s/person';
  sheet.getCell('J10').value = 'L/s';
  sheet.getCell('M10').value = 'L/s';
  sheet.getCell('N10').value = 'L/s';
  sheet.getCell('O10').value = 'L/s';

  // Explicit Column-by-Column Border & Fill Assignment for Rows 8, 9, 10
  // Merged columns (B, C, D, E, K, L) get complete dark/medium box borders!
  // Stacked columns (F, G, H, I, J, M, N, O) get thin horizontal dividing lines between Row 9 & 10.
  const isMergedCol = (col: number) => [1, 2, 3, 4, 5, 11, 12].includes(col);

  for (let r = 8; r <= 10; r++) {
    for (let c = 1; c <= 15; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = boldFont;
      cell.fill = grayFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      if (r === 8) {
        // Row 8 top header row: medium on all 4 sides
        const leftStyle = [1, 2, 8, 11, 14].includes(c) ? 'medium' : 'thin';
        const rightStyle = [1, 7, 10, 13, 15].includes(c) ? 'medium' : 'thin';
        setCellBorder(cell, 'medium', 'medium', leftStyle, rightStyle);
      } else if (r === 9) {
        // Row 9: Top is medium (under Row 8), Left & Right depend on whether it's a merged column or section edge
        const topStyle = 'medium';
        const bottomStyle = isMergedCol(c) ? 'medium' : 'thin';
        const leftStyle = (isMergedCol(c) || [6, 8, 13, 14].includes(c)) ? 'medium' : 'thin';
        const rightStyle = (isMergedCol(c) || [7, 10, 13, 15].includes(c)) ? 'medium' : 'thin';
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      } else if (r === 10) {
        // Row 10: Bottom is medium (heavy line below header separating header from data rows)
        const topStyle = isMergedCol(c) ? 'medium' : 'thin';
        const bottomStyle = 'medium';
        const leftStyle = (isMergedCol(c) || [6, 8, 13, 14].includes(c)) ? 'medium' : 'thin';
        const rightStyle = (isMergedCol(c) || [7, 10, 13, 15].includes(c)) ? 'medium' : 'thin';
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      }
    }
  }

  // Data Rows (Starting Row 11)
  let startDataRow = 11;
  let currentRow = startDataRow;

  const sortedSpaces = [...spaces].sort((a, b) => {
    const floorA = (a.floor || 'GF').toLowerCase();
    const floorB = (b.floor || 'GF').toLowerCase();
    if (floorA !== floorB) return floorA.localeCompare(floorB);

    const zoneA = (a.zone || 'Default');
    const zoneB = (b.zone || 'Default');
    
    if (zoneA === 'Default' && zoneB !== 'Default') return 1;
    if (zoneA !== 'Default' && zoneB === 'Default') return -1;
    
    if (zoneA.toLowerCase() !== zoneB.toLowerCase()) return zoneA.localeCompare(zoneB);

    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  sortedSpaces.forEach((s, idx) => {
    const r = currentRow;
    sheet.getRow(r).height = 24;

    const data = getOccupancyData(s.category);
    const areaVal = parseFloat(String(s.area || 0));
    const multVal = s.multiplier || 1;
    const effectiveArea = areaVal * multVal;

    const occCount: number = typeof s.occupancy === 'number'
      ? s.occupancy
      : (typeof s.fixtures === 'number' ? s.fixtures : (parseInt(String(s.fixtures || 0)) || 0));

    const isCustom = Boolean(s.category && s.category.endsWith(" (Custom)"));
    const catLower = (s.category || "").toLowerCase();
    const isRestroom = catLower === "rest room / changing room" || catLower === "restroom" || catLower === "toilet" || catLower === "bathroom";

    let oaAreaRate = 0;
    let oaPeopleRate = 0;

    if (isCustom) {
      oaAreaRate = parseFloat(String((s as any).customAreaOA || 0)) || 0;
      oaPeopleRate = parseFloat(String((s as any).customPeopleOA || 0)) || 0;
    } else if (isRestroom) {
      oaAreaRate = 0;
      oaPeopleRate = 0;
    } else if (data) {
      oaAreaRate = typeof data.areaOA === "number" ? data.areaOA : 0.3;
      oaPeopleRate = typeof data.peopleOA === "number" ? data.peopleOA : 2.5;
    } else if (s.category && s.category !== "-") {
      oaAreaRate = 0.3;
      oaPeopleRate = 2.5;
    } else {
      oaAreaRate = 0;
      oaPeopleRate = 0;
    }

    const baseFresh = effectiveArea * oaAreaRate + occCount * oaPeopleRate;
    const totalFreshCalculated = Math.round(
      typeof s.minOA === "number" && !isNaN(s.minOA)
        ? s.minOA
        : baseFresh
    );
    const totalExtractCalculated = Math.round(s.minExt ?? 0);

    const freshAirGiven = Math.round(s.freshAir ?? totalFreshCalculated);
    const extractAirTaken = Math.round(s.extractAir ?? totalExtractCalculated);

    // Col A: Sr. No.
    const c1 = sheet.getCell(r, 1);
    c1.value = idx + 1;
    c1.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col B: Space Floor
    const c2 = sheet.getCell(r, 2);
    c2.value = s.floor || 'GF';
    c2.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col C: Space Name
    const c3 = sheet.getCell(r, 3);
    c3.value = s.name || `Space ${idx + 1}`;
    c3.alignment = { horizontal: 'left', vertical: 'middle' };

    // Col D: Zone Name
    const c4 = sheet.getCell(r, 4);
    c4.value = s.zone || 'Default';
    c4.alignment = { horizontal: 'left', vertical: 'middle' };

    // Col E: Occupancy Category
    const c5 = sheet.getCell(r, 5);
    c5.value = s.category || '-';
    c5.alignment = { horizontal: 'left', vertical: 'middle' };

    // Col F: Area (m²)
    const c6 = sheet.getCell(r, 6);
    c6.value = effectiveArea;
    c6.numFmt = '0.0';
    c6.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col G: Fixtures/ Occupancy No's
    const c7 = sheet.getCell(r, 7);
    c7.value = occCount || 0;
    c7.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col H: Outdoor Air Rate L/s/m²
    const c8 = sheet.getCell(r, 8);
    c8.value = oaAreaRate;
    c8.numFmt = '0.0';
    c8.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col I: Outdoor Air Rate L/s/person
    const c9 = sheet.getCell(r, 9);
    c9.value = oaPeopleRate;
    c9.numFmt = '0.0';
    c9.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col J: Total Fresh Air L/s
    const c10 = sheet.getCell(r, 10);
    c10.value = totalFreshCalculated;
    c10.numFmt = '#,##0';
    c10.alignment = { horizontal: 'center', vertical: 'middle' };

    let extNo: string | number = (s as any).extractAirNumber ?? '-';
    let extStrat: string = (s as any).extractAirStrategy ?? '-';

    if (isRestroom) {
      const sub = s.restroomSubCategories || {};
      const sumSub = 
        (sub.toiletPrivateContinuous || 0) +
        (sub.toiletPublicContinuous || 0) +
        (sub.toiletPrivateDiscontinuous || 0) +
        (sub.toiletPublicDiscontinuous || 0) +
        (sub.showerContinuous || 0) +
        (sub.showerDiscontinuous || 0) +
        (sub.janitorCloset || 0) +
        (sub.lockerRoom || 0) +
        (sub.changingPositions || 0);

      if (sumSub > 0) {
        const val = totalExtractCalculated / sumSub;
        extNo = val % 1 === 0 ? val.toString() : val.toFixed(1);
        extStrat = 'L/s/unit';
      } else {
        extNo = '-';
        extStrat = totalExtractCalculated > 0 ? 'L/s/unit' : '-';
      }
    } else if (catLower === "kitchen - commercial" || catLower === "kitchen - residential") {
      extNo = parseFloat(String((s as any).customAch || (data ? data.ach : 0))) || '-';
      extStrat = 'ACH';
    } else if (catLower === "ex. parking garages" || catLower.includes("parking")) {
      extNo = data ? parseFloat(String(data.exhaustPerArea)) : 3.7;
      extStrat = 'L/s/m²';
    } else if (data && data.exhaustPerUnit > 0) {
      extNo = occCount > 0 ? occCount : data.exhaustPerUnit;
      extStrat = 'L/s/unit';
    } else if (data && data.exhaustPerArea > 0) {
      extNo = data.exhaustPerArea;
      extStrat = 'L/s/m²';
    } else if (data && data.ach > 0) {
      extNo = data.ach;
      extStrat = 'ACH';
    } else if (totalExtractCalculated > 0) {
      extNo = '-';
      extStrat = 'L/s/m²';
    } else {
      extNo = '-';
      extStrat = '-';
    }

    c11.value = extNo;
    c11.alignment = { horizontal: 'center', vertical: 'middle' };

    c12.value = extStrat;
    c12.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col M: Total Extract L/s
    const c13 = sheet.getCell(r, 13);
    c13.value = totalExtractCalculated;
    c13.numFmt = '#,##0';
    c13.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col N: Fresh Air Given L/s
    const c14 = sheet.getCell(r, 14);
    c14.value = freshAirGiven;
    c14.numFmt = '#,##0';
    c14.alignment = { horizontal: 'center', vertical: 'middle' };

    // Col O: Extract Air Taken L/s
    const c15 = sheet.getCell(r, 15);
    c15.value = extractAirTaken;
    c15.numFmt = '#,##0';
    c15.alignment = { horizontal: 'center', vertical: 'middle' };

    // Set borders & font for data row
    for (let c = 1; c <= 15; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = baseFont;
      const leftStyle = (isMergedCol(c) || [6, 8, 13, 14].includes(c)) ? 'medium' : 'thin';
      const rightStyle = (isMergedCol(c) || [7, 10, 13, 15].includes(c)) ? 'medium' : 'thin';
      setCellBorder(cell, 'thin', 'thin', leftStyle, rightStyle);
    }

    currentRow++;
  });

  const lastDataRow = currentRow - 1;

  // Summary / Total Row
  sheet.getRow(currentRow).height = 25;

  sheet.mergeCells(`A${currentRow}:M${currentRow}`);
  const totalLabelCell = sheet.getCell(`A${currentRow}`);
  totalLabelCell.value = 'Total:';
  totalLabelCell.font = boldFont;
  totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let c = 1; c <= 15; c++) {
    const cell = sheet.getCell(currentRow, c);
    cell.fill = (c === 14 || c === 15) ? blueFill : grayFill;
    const leftStyle = (isMergedCol(c) || [6, 8, 13, 14].includes(c)) ? 'medium' : 'thin';
    const rightStyle = (isMergedCol(c) || [7, 10, 13, 15].includes(c)) ? 'medium' : 'thin';
    setCellBorder(cell, 'medium', 'medium', leftStyle, rightStyle);
  }

  // Col N Total: Fresh Air Given
  const totalFACell = sheet.getCell(currentRow, 14);
  if (lastDataRow >= startDataRow) {
    totalFACell.value = { formula: `=SUM(N${startDataRow}:N${lastDataRow})` };
  } else {
    totalFACell.value = 0;
  }
  totalFACell.font = boldFont;
  totalFACell.numFmt = '#,##0';
  totalFACell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Col O Total: Extract Air Taken
  const totalEACell = sheet.getCell(currentRow, 15);
  if (lastDataRow >= startDataRow) {
    totalEACell.value = { formula: `=SUM(O${startDataRow}:O${lastDataRow})` };
  } else {
    totalEACell.value = 0;
  }
  totalEACell.font = boldFont;
  totalEACell.numFmt = '#,##0';
  totalEACell.alignment = { horizontal: 'center', vertical: 'middle' };

  currentRow += 3; // Gap before Reference box

  // Reference Block (Left side)
  const refStartRow = currentRow;
  sheet.mergeCells(`A${refStartRow}:B${refStartRow}`);
  const refTitleCell = sheet.getCell(`A${refStartRow}`);
  refTitleCell.value = 'Reference:';
  refTitleCell.font = { ...boldFont, underline: true };

  sheet.mergeCells(`C${refStartRow}:E${refStartRow}`);
  sheet.getCell(`C${refStartRow}`).value = '1. Architectural Drawings:';
  sheet.getCell(`C${refStartRow}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 1}:B${refStartRow + 1}`);
  sheet.mergeCells(`C${refStartRow + 1}:E${refStartRow + 1}`);
  sheet.getCell(`C${refStartRow + 1}`).value = '2. ASHRAE 62.1 2026';
  sheet.getCell(`C${refStartRow + 1}`).font = baseFont;

  sheet.mergeCells(`A${refStartRow + 2}:B${refStartRow + 2}`);
  sheet.mergeCells(`C${refStartRow + 2}:E${refStartRow + 2}`);
  sheet.getCell(`C${refStartRow + 2}`).value = '3. ASHRAE 62.2 2026';
  sheet.getCell(`C${refStartRow + 2}`).font = baseFont;

  for (let r = refStartRow; r <= refStartRow + 2; r++) {
    sheet.getRow(r).height = 20;
    for (let c = 1; c <= 5; c++) {
      const cell = sheet.getCell(r, c);
      const topStyle = r === refStartRow ? 'medium' : 'thin';
      const bottomStyle = r === refStartRow + 2 ? 'medium' : 'thin';
      const leftStyle = c === 1 ? 'medium' : 'thin';
      const rightStyle = c === 5 ? 'medium' : (c === 2 ? 'medium' : 'thin');
      setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
      cell.alignment = { vertical: 'middle', indent: c === 1 ? 1 : 0 };
    }
  }

  // Gap before Signatures
  currentRow = refStartRow + 5;

  // Signature Block (Full width)
  const sigStartRow = currentRow;

  sheet.getRow(sigStartRow).height = 24;
  sheet.mergeCells(`A${sigStartRow}:C${sigStartRow}`);

  sheet.mergeCells(`D${sigStartRow}:G${sigStartRow}`);
  sheet.getCell(`D${sigStartRow}`).value = 'Originator';
  sheet.getCell(`D${sigStartRow}`).font = boldFont;
  sheet.getCell(`D${sigStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`H${sigStartRow}:K${sigStartRow}`);
  sheet.getCell(`H${sigStartRow}`).value = 'Reviewer';
  sheet.getCell(`H${sigStartRow}`).font = boldFont;
  sheet.getCell(`H${sigStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`L${sigStartRow}:O${sigStartRow}`);
  sheet.getCell(`L${sigStartRow}`).value = 'Approver';
  sheet.getCell(`L${sigStartRow}`).font = boldFont;
  sheet.getCell(`L${sigStartRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 15; c++) {
    const cell = sheet.getCell(sigStartRow, c);
    cell.fill = (c >= 1 && c <= 3) ? { type: 'pattern', pattern: 'none' } : grayFill;
    const rightStyle = (c === 3 || c === 7 || c === 11 || c === 15) ? 'medium' : 'thin';
    const leftStyle = c === 1 ? 'medium' : 'thin';
    setCellBorder(cell, 'medium', 'thin', leftStyle, rightStyle);
  }

  const {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  } = getSignatureBlockDetails(activeProj?.id || "default", "/ventilation", meta.userName || "");

  // Name Row
  const nameRow = sigStartRow + 1;
  sheet.getRow(nameRow).height = 24;
  sheet.mergeCells(`A${nameRow}:C${nameRow}`);
  sheet.getCell(`A${nameRow}`).value = 'Name:';
  sheet.getCell(`A${nameRow}`).font = boldFont;
  sheet.getCell(`A${nameRow}`).alignment = { horizontal: 'right', vertical: 'middle' };

  sheet.mergeCells(`D${nameRow}:G${nameRow}`);
  sheet.getCell(`D${nameRow}`).value = originatedName;
  sheet.getCell(`D${nameRow}`).font = baseFont;
  sheet.getCell(`D${nameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`H${nameRow}:K${nameRow}`);
  sheet.getCell(`H${nameRow}`).value = reviewerName;
  sheet.getCell(`H${nameRow}`).font = baseFont;
  sheet.getCell(`H${nameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`L${nameRow}:O${nameRow}`);
  sheet.getCell(`L${nameRow}`).value = approverName;
  sheet.getCell(`L${nameRow}`).font = baseFont;
  sheet.getCell(`L${nameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 15; c++) {
    const cell = sheet.getCell(nameRow, c);
    const rightStyle = (c === 3 || c === 7 || c === 11 || c === 15) ? 'medium' : 'thin';
    const leftStyle = c === 1 ? 'medium' : 'thin';
    setCellBorder(cell, 'thin', 'thin', leftStyle, rightStyle);
  }

  // Date Row
  const sigDateRow = sigStartRow + 2;
  sheet.getRow(sigDateRow).height = 24;
  sheet.mergeCells(`A${sigDateRow}:C${sigDateRow}`);
  sheet.getCell(`A${sigDateRow}`).value = 'Date:';
  sheet.getCell(`A${sigDateRow}`).font = boldFont;
  sheet.getCell(`A${sigDateRow}`).alignment = { horizontal: 'right', vertical: 'middle' };

  sheet.mergeCells(`D${sigDateRow}:G${sigDateRow}`);
  sheet.getCell(`D${sigDateRow}`).value = originatedDate;
  sheet.getCell(`D${sigDateRow}`).font = baseFont;
  sheet.getCell(`D${sigDateRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`H${sigDateRow}:K${sigDateRow}`);
  sheet.getCell(`H${sigDateRow}`).value = reviewerDate;
  sheet.getCell(`H${sigDateRow}`).font = baseFont;
  sheet.getCell(`H${sigDateRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells(`L${sigDateRow}:O${sigDateRow}`);
  sheet.getCell(`L${sigDateRow}`).value = approverDate;
  sheet.getCell(`L${sigDateRow}`).font = baseFont;
  sheet.getCell(`L${sigDateRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  for (let c = 1; c <= 15; c++) {
    const cell = sheet.getCell(sigDateRow, c);
    const rightStyle = (c === 3 || c === 7 || c === 11 || c === 15) ? 'medium' : 'thin';
    const leftStyle = c === 1 ? 'medium' : 'thin';
    setCellBorder(cell, 'thin', 'medium', leftStyle, rightStyle);
  }

  // Generate buffer & trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Ventilation_Calculation_${calcNo}.xlsx`;
  await downloadFile(new Uint8Array(buffer), filename, 'Excel Document', ['xlsx']);
};
