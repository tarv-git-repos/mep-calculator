import ExcelJS from 'exceljs';
import pkg from 'file-saver';
const { saveAs } = pkg;
import { Tray, Cable, getCableTraySize } from './cableTrayHelpers';

// Utility for borders
const allBorders: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

export async function exportCableTrayExcel(trays: Tray[], unitSystem: "si" | "ip", cableDatabase: Record<string, Record<string, number>>, projectName: string = "PROJECT NAME", docNumber: string = "CABLE TRAY CALCULATION") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cable Tray Sizing');

  // Set column widths based on template
  sheet.getColumn(1).width = 4; // Margin
  sheet.getColumn(2).width = 8; // Sr No
  sheet.getColumn(3).width = 19; // Cable Type
  sheet.getColumn(4).width = 18; // From
  sheet.getColumn(5).width = 18; // To
  sheet.getColumn(6).width = 18; // Make up
  sheet.getColumn(7).width = 13; // Size
  sheet.getColumn(8).width = 13; // Qty
  sheet.getColumn(9).width = 13; // OD
  sheet.getColumn(10).width = 15; // Sum OD

  // 1. Add standard notes
  sheet.mergeCells('C8:I16');
  const noteCell = sheet.getCell('C8');
  noteCell.value = `Note :\n1. CPC cable are not considered separately in cable tray sizing, as it will be tied on top of the main power cables,\n2. Minimum 20% Spare space considered for sizing the cable trays.\n3. Dedicated Trays are considered for Normal feeders and Life safety feeders.`;
  noteCell.font = { name: 'Arial', size: 11 };
  noteCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

  // 2. Add Header Table
  sheet.mergeCells('D17:G19');
  const projectCell = sheet.getCell('D17');
  projectCell.value = projectName;
  projectCell.font = { name: 'Arial', size: 14, bold: true };
  projectCell.alignment = { vertical: 'middle', horizontal: 'center' };
  projectCell.border = allBorders;

  sheet.mergeCells('C17:C19');
  const projectLbl = sheet.getCell('C17');
  projectLbl.value = 'Project';
  projectLbl.font = { name: 'Arial', size: 11, bold: true };
  projectLbl.alignment = { vertical: 'middle', horizontal: 'left' };
  projectLbl.border = allBorders;

  sheet.mergeCells('H17:I19');
  const jobRef = sheet.getCell('H17');
  jobRef.value = 'Job Reference';
  jobRef.font = { name: 'Arial', size: 11 };
  jobRef.alignment = { vertical: 'top', horizontal: 'left' };
  jobRef.border = allBorders;

  // Metadata headers
  const metaHeaders = ["Part of Structure", "DR-10", "Calc by", "Date", "Checked by", "Date", "Revision"];
  
  sheet.mergeCells('C20:C21');
  sheet.mergeCells('D20:D21');
  sheet.mergeCells('E20:E21');
  sheet.mergeCells('F20:F21');
  sheet.mergeCells('G20:G21');
  sheet.mergeCells('H20:H21');
  sheet.mergeCells('I20:I21');

  metaHeaders.forEach((val, idx) => {
    const cell = sheet.getCell(20, idx + 3);
    cell.value = val;
    cell.font = { name: 'Arial', size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = allBorders;
    if (idx === 0) cell.alignment.horizontal = 'left';
  });

  const now = new Date().toISOString().split('T')[0];
  const docHeaders = ["Document Number", docNumber, "KK", now, "MK", now, "0C"];
  sheet.mergeCells('C22:C23');
  sheet.mergeCells('D22:D23');
  sheet.mergeCells('E22:E23');
  sheet.mergeCells('F22:F23');
  sheet.mergeCells('G22:G23');
  sheet.mergeCells('H22:H23');
  sheet.mergeCells('I22:I23');

  docHeaders.forEach((val, idx) => {
    const cell = sheet.getCell(22, idx + 3);
    cell.value = val;
    cell.font = { name: 'Arial', size: 11, bold: idx > 1 && typeof val === 'string' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = allBorders;
    if (idx === 0) cell.alignment.horizontal = 'left';
  });

  let currentRow = 26; // Start appending tray data below header

  trays.forEach((tray, tIndex) => {
    // Location & Tier
    sheet.getCell(`B${currentRow}`).value = "Location: ";
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`C${currentRow}`).value = tray.name;
    sheet.getCell(`C${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    currentRow++;

    sheet.getCell(`B${currentRow}`).value = "Tier No:";
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`C${currentRow}`).value = tIndex + 1;
    sheet.getCell(`C${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`C${currentRow}`).alignment = { horizontal: 'left' };
    currentRow++;

    // Table Headers
    const h1 = sheet.getRow(currentRow);
    h1.getCell(2).value = "Sr No.";
    h1.getCell(3).value = "Cable Type";
    h1.getCell(4).value = "From";
    h1.getCell(5).value = "To";
    h1.getCell(6).value = "Cable Details";
    sheet.mergeCells(currentRow, 6, currentRow, 9);
    h1.getCell(10).value = "Sum of OD (mm)";
    h1.eachCell((c) => { c.font = { bold: true, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = allBorders; });
    currentRow++;

    const h2 = sheet.getRow(currentRow);
    h2.getCell(2).value = "Sr No.";
    h2.getCell(3).value = "Cable Type";
    h2.getCell(4).value = "From";
    h2.getCell(5).value = "To";
    h2.getCell(6).value = "Cable Make up";
    h2.getCell(7).value = "Cable size mm2";
    h2.getCell(8).value = "No. of Cables";
    h2.getCell(9).value = "Cable O.D(mm)";
    h2.getCell(10).value = "Sum of OD (mm)";
    h2.eachCell((c) => { c.font = { bold: true, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = allBorders; });
    currentRow++;

    let subTotal1 = 0;

    // Cables
    tray.cables.forEach((c: Cable, cIndex: number) => {
      const od = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
      const qtyNum = typeof c.qty === "number" ? c.qty : 0;
      const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
      if (!isNaN(sumOd) && qtyNum > 0) subTotal1 += sumOd;

      const row = sheet.getRow(currentRow);
      row.getCell(2).value = cIndex + 1;
      row.getCell(3).value = c.type;
      row.getCell(4).value = c.from || "";
      row.getCell(5).value = c.to || "";
      row.getCell(6).value = `1 x ${c.cores}`; // Assuming make up
      row.getCell(7).value = c.size;
      row.getCell(8).value = c.qty;
      row.getCell(9).value = isNaN(od) ? "-" : Number(od.toFixed(1));
      row.getCell(10).value = isNaN(sumOd) ? "-" : Number(sumOd.toFixed(1));

      row.eachCell((cell, colNumber) => {
        if (colNumber >= 2 && colNumber <= 10) {
          cell.font = { size: 10 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorders;
        }
      });
      currentRow++;
    });

    // Summary calculations
    const sparePercent = Number(tray.spareCapacity ?? 20);
    const spacingFactor = Number(tray.spacingFactor ?? 1);
    const spacing = subTotal1 * spacingFactor;
    const subTotal2 = subTotal1 + spacing;
    const spareSpace = subTotal2 * (sparePercent / 100);
    const total = subTotal2 + spareSpace;
    const finalSize = getCableTraySize(total);

    const summaries = [
      { label: "Sub Total 1", val: subTotal1 },
      { label: `${spacingFactor}D spacing`, val: spacing },
      { label: "Sub Total 2", val: subTotal2 },
      { label: `${sparePercent}% Minimum spare Space`, val: spareSpace },
      { label: "Total", val: total },
      { label: "Cable Tray Size", val: finalSize }
    ];

    summaries.forEach((sum) => {
      const r = sheet.getRow(currentRow);
      sheet.mergeCells(currentRow, 2, currentRow, 9);
      const labelCell = r.getCell(2);
      labelCell.value = sum.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      
      const valCell = r.getCell(10);
      valCell.value = typeof sum.val === 'number' ? Number(sum.val.toFixed(2)) : sum.val;
      valCell.font = { size: 10, bold: true };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      labelCell.border = allBorders;
      valCell.border = allBorders;
      currentRow++;
    });

    currentRow += 2; // Blank rows before next tray
  });

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, "Cable_Tray_Sizing.xlsx");
}
