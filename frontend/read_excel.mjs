import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = "Z:\\09 PUBLIC SHARE\\PROJECTS-HASHEER\\VIKRAM\\P-521 VOLTAGE DROP CALCULATION.xlsx";
const workbook = XLSX.readFile(filePath);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // print first 20 rows
  for (let i = 0; i < Math.min(20, json.length); i++) {
    console.log(`Row ${i}:`, json[i]);
  }
}
