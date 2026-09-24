import XLSX from 'xlsx';
import path from 'path';

const filePath = path.resolve('../CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx');
const wb = XLSX.readFile(filePath);

console.log('Searching across all sheets...');
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddress];
      if (cell && cell.v !== undefined) {
        const text = String(cell.v).toLowerCase();
        if (text.includes('leaf') || text.includes('a.3') || text.includes('a-3') || text.includes('table-3') || text.includes('landing') || text.includes('single') || text.includes('double') || text.includes('table 3') || text.includes('leakage')) {
          console.log(`[${name}] ${cellAddress}: ${cell.v}`);
        }
      }
    }
  }
}
