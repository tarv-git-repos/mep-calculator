import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

const filePath = path.resolve('../CEC-MED-FRM-105-Rev.02-P509 - Staircase-Liftwell Pressurisation.xlsx');
const zip = new AdmZip(filePath);
const zipEntries = zip.getEntries();

console.log('Zip entries:');
zipEntries.forEach(entry => {
  if (entry.entryName.includes('media') || entry.entryName.includes('image') || entry.entryName.includes('drawing')) {
    console.log(entry.entryName, entry.header.size);
    // If it's an image, let's extract it to scratch
    if (entry.entryName.startsWith('xl/media/')) {
      const fileName = path.basename(entry.entryName);
      fs.writeFileSync(`../scratch/${fileName}`, entry.getData());
      console.log(`Extracted: ../scratch/${fileName}`);
    }
  }
});
