import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import ExcelJS from 'exceljs';
import pkg from 'file-saver';
const saveAs = (pkg as any)?.saveAs || pkg;
import { Tray, Cable, getCableTraySize } from './cableTrayHelpers';
import { getLicenseWatermark } from './license';

// Utility for borders
const allBorders: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' }
};

export async function exportCableTrayExcel(trays: Tray[], unitSystem: "si" | "ip", cableDatabase: Record<string, Record<string, number>>, projectName: string = "PROJECT NAME", docNumber: string = "CABLE TRAY CALCULATION") {
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Cable Tray Sizing');

  // Set column widths based on template
  sheet.getColumn(1).width = 8;  // Sr No.
  sheet.getColumn(2).width = 18; // Cable Type
  sheet.getColumn(3).width = 20; // From
  sheet.getColumn(4).width = 25; // To
  sheet.getColumn(5).width = 12; // No. of core
  sheet.getColumn(6).width = 14; // Cable size mm2
  sheet.getColumn(7).width = 14; // No. of Cables
  sheet.getColumn(8).width = 14; // Cable O.D(mm)
  sheet.getColumn(9).width = 16; // Sum of OD (mm)

  // 1. Document Header Block (Rows 2-4)
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  
  // Row 2
  sheet.getCell('A2').value = `Calculation No: ${docNumber}`;
  sheet.getCell('A2').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('B2').value = 'Rev. No.:';
  sheet.getCell('B2').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('E2').value = `Date       :${dateStr}`;
  sheet.getCell('E2').font = { name: 'Arial', size: 10, bold: true };

  // Row 3
  sheet.getCell('A3').value = 'Project No      :';
  sheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('E3').value = 'Client     :';
  sheet.getCell('E3').font = { name: 'Arial', size: 10, bold: true };

  // Row 4
  sheet.getCell('A4').value = `Project Name : ${projectName}`;
  sheet.getCell('A4').font = { name: 'Arial', size: 10, bold: true };
  sheet.getCell('E4').value = 'End User :';
  sheet.getCell('E4').font = { name: 'Arial', size: 10, bold: true };

  // 2. Standard Notes (Row 6)
  sheet.mergeCells('A6:I7');
  const noteCell = sheet.getCell('A6');
  noteCell.value = `Note :\n1. CPC cable are not considered separately in cable tray sizing, as it will be tied on top of the main power cables,\n2. Minimum 20% Spare space considered for sizing the cable trays.`;
  noteCell.font = { name: 'Arial', size: 10, italic: true };
  noteCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

  let currentRow = 9; // Start appending tray data

  trays.forEach((tray, tIndex) => {
    // 3. Tray Metadata
    sheet.getCell(`A${currentRow}`).value = "Location:";
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`B${currentRow}`).value = tray.name;
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    currentRow++;

    sheet.getCell(`A${currentRow}`).value = "TYPE";
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`B${currentRow}`).value = "NORMAL";
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    currentRow++;

    sheet.getCell(`A${currentRow}`).value = "Cable tray ref:";
    sheet.getCell(`A${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`B${currentRow}`).value = tIndex + 1;
    sheet.getCell(`B${currentRow}`).font = { name: 'Arial', size: 10, bold: true };
    sheet.getCell(`B${currentRow}`).alignment = { horizontal: 'left' };
    currentRow++;

    // 4. Table Headers
    const h1 = sheet.getRow(currentRow);
    h1.getCell(1).value = "Sr No.";
    h1.getCell(2).value = "Cable Type";
    h1.getCell(3).value = "From";
    h1.getCell(4).value = "To";
    h1.getCell(5).value = "Cable Details";
    sheet.mergeCells(currentRow, 5, currentRow, 8); // Merge columns 5 to 8 (E to H)
    h1.getCell(9).value = "Sum of \nOD (mm)";
    
    // Set borders and styles for top header row
    for(let i = 1; i <= 9; i++) {
        const c = h1.getCell(i);
        c.font = { bold: true, size: 10 };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = allBorders;
    }
    
    // Merge vertical cells for columns 1, 2, 3, 4, 9
    sheet.mergeCells(currentRow, 1, currentRow + 1, 1);
    sheet.mergeCells(currentRow, 2, currentRow + 1, 2);
    sheet.mergeCells(currentRow, 3, currentRow + 1, 3);
    sheet.mergeCells(currentRow, 4, currentRow + 1, 4);
    sheet.mergeCells(currentRow, 9, currentRow + 1, 9);
    
    currentRow++;

    const h2 = sheet.getRow(currentRow);
    h2.getCell(5).value = "No. of core";
    h2.getCell(6).value = "Cable \nsize mm2";
    h2.getCell(7).value = "No. of Cables";
    h2.getCell(8).value = "Cable \nO.D(mm)";
    
    // Set borders for bottom header row sub-columns
    for(let i = 5; i <= 8; i++) {
        const c = h2.getCell(i);
        c.font = { bold: true, size: 10 };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = allBorders;
    }
    currentRow++;

    let subTotal1 = 0;
    const startCableRow = currentRow;

    // Cables
    if (tray.cables.length === 0) {
        // Blank row if no cables
        const row = sheet.getRow(currentRow);
        row.getCell(3).value = tray.from || "";
        row.getCell(4).value = tray.to || "";
        for(let i=1; i<=9; i++) { row.getCell(i).border = allBorders; }
        currentRow++;
    } else {
        tray.cables.forEach((c: Cable, cIndex: number) => {
          const od = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
          const qtyNum = typeof c.qty === "number" ? c.qty : 0;
          const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
          if (!isNaN(sumOd) && qtyNum > 0) subTotal1 += sumOd;

          const row = sheet.getRow(currentRow);
          row.getCell(1).value = cIndex + 1;
          row.getCell(2).value = c.type;
          
          if (cIndex === 0) {
            row.getCell(3).value = tray.from || "";
            row.getCell(4).value = tray.to || "";
          }

          row.getCell(5).value = c.cores || "";
          row.getCell(6).value = c.size || "";
          row.getCell(7).value = c.qty;
          row.getCell(8).value = isNaN(od) ? "-" : Number(od.toFixed(1));
          row.getCell(9).value = isNaN(sumOd) ? "-" : Number(sumOd.toFixed(1));

          row.eachCell((cell, colNumber) => {
            if (colNumber >= 1 && colNumber <= 9) {
              cell.font = { size: 10 };
              cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
              cell.border = allBorders;
            }
          });
          currentRow++;
        });

        // Merge From and To columns across all cables
        if (tray.cables.length > 1) {
            sheet.mergeCells(startCableRow, 3, currentRow - 1, 3);
            sheet.mergeCells(startCableRow, 4, currentRow - 1, 4);
        }
    }

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
      { label: `${sparePercent}% Spare`, val: spareSpace },
      { label: "Total", val: total },
      { label: "Cable Tray Size", val: finalSize }
    ];

    summaries.forEach((sum) => {
      const r = sheet.getRow(currentRow);
      sheet.mergeCells(currentRow, 1, currentRow, 8); // Merge A to H
      const labelCell = r.getCell(1);
      labelCell.value = sum.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      
      const valCell = r.getCell(9);
      valCell.value = typeof sum.val === 'number' ? Number(sum.val.toFixed(2)) : sum.val;
      valCell.font = { size: 10, bold: true };
      valCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      
      // Set borders
      for(let i=1; i<=8; i++) { r.getCell(i).border = allBorders; }
      valCell.border = allBorders;
      
      currentRow++;
    });

    currentRow += 2; // Blank rows before next tray
  });

  // 5. Watermark Footer
  const watermarkText = await getLicenseWatermark();
  sheet.mergeCells(`A${currentRow}:I${currentRow + 1}`);
  const watermarkCell = sheet.getCell(`A${currentRow}`);
  watermarkCell.value = watermarkText;
  watermarkCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF999999' } };
  watermarkCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  await downloadFile(new Uint8Array(buffer), "Cable_Tray_Sizing.xlsx", "Excel Document", ["xlsx"]);
}
