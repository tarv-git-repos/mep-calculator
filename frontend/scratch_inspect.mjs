import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const filePath = path.resolve('../CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx');
const wb = XLSX.readFile(filePath);

let out = `Sheet names: ${JSON.stringify(wb.SheetNames)}\n\n`;

for (const name of wb.SheetNames) {
  out += `\n====================================\n--- SHEET: ${name} ---\n====================================\n`;
  const sheet = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  data.forEach((row, idx) => {
    if (row && row.some(cell => cell !== undefined && cell !== '')) {
      out += `R${idx + 1}: ${JSON.stringify(row)}\n`;
    }
  });
}

fs.writeFileSync('../excel_dump_utf8.txt', out, 'utf8');
console.log('Written successfully, length:', out.length);
