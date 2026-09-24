import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.resolve('../CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx');
const wb = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true });

function dumpSheet(sheetName) {
  let out = `\n========================================\nDETAILS FOR SHEET: ${sheetName}\n========================================\n`;
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return `Sheet ${sheetName} not found!`;
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
  out += `Range: ${sheet['!ref']}\n`;

  for (let R = range.s.r; R <= range.e.r; ++R) {
    let rowVals = [];
    let hasVal = false;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];
      if (cell) {
        hasVal = true;
        let cellStr = `${cellAddress}: `;
        if (cell.f) cellStr += `[FORMULA: ${cell.f}] = `;
        cellStr += `${cell.v !== undefined ? cell.v : cell.w}`;
        rowVals.push(cellStr);
      }
    }
    if (hasVal) {
      out += `Row ${R + 1}: ${rowVals.join(' | ')}\n`;
    }
  }
  return out;
}

let fullOut = '';
fullOut += dumpSheet('LIFTWELL-01');
fullOut += dumpSheet('STAIR 01&03');
fullOut += dumpSheet('STAIR 02');

fs.writeFileSync('../liftwell_and_stair_detailed.txt', fullOut, 'utf8');
console.log('Saved detailed dump, length:', fullOut.length);
