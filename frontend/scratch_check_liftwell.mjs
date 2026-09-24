import XLSX from 'xlsx';
import path from 'path';

const filePath = path.resolve('../CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx');
const wb = XLSX.readFile(filePath);

const sheet = wb.Sheets['LIFTWELL-01'];
const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:U90');

console.log('Checking columns in LIFTWELL-01:');
for (let R = range.s.r; R <= range.e.r; ++R) {
  let cells = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: R, c: C });
    const cell = sheet[addr];
    if (cell && cell.v !== undefined && cell.v !== '') {
      cells.push(`${addr}: ${cell.v}`);
    }
  }
  if (cells.length > 0) {
    console.log(`Row ${R+1}:`, cells.join(' | '));
  }
}
