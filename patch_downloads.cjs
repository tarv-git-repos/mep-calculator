const fs = require('fs');
const path = require('path');

const srcDirs = ['src/routes', 'src/components', 'src/lib'];

function processDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    let modified = false;

    // Skip if it's the download helper itself
    if (filePath.replace(/\\/g, '/').includes('src/lib/download.ts')) return;

    // 1. Replace doc.save("...") or doc.save(var)
    if (content.includes('doc.save(')) {
        content = content.replace(/doc\.save\((.+?)\);?/g, (match, filename) => {
            modified = true;
            return `const pdfBuffer = doc.output("arraybuffer");\n    downloadFile(new Uint8Array(pdfBuffer), ${filename}, "PDF Document", ["pdf"]);`;
        });
    }

    // 2. Replace ExcelJS saveAs patterns
    // Pattern: 
    // const buffer = await workbook.xlsx.writeBuffer();
    // const blob = new Blob([buffer], ...);
    // saveAs(blob, "filename.xlsx");
    if (content.includes('saveAs(') && content.includes('workbook.xlsx.writeBuffer()')) {
        content = content.replace(/const\s+blob\s*=\s*new\s+Blob\(\[buffer\],[\s\S]*?\);\s*saveAs\(blob,\s*(.+?)\);?/g, (match, filename) => {
            modified = true;
            return `await downloadFile(new Uint8Array(buffer), ${filename}, "Excel Document", ["xlsx"]);`;
        });
    }
    
    // 3. Replace XLSX.writeFile(wb, "...")
    if (content.includes('XLSX.writeFile(')) {
        content = content.replace(/XLSX\.writeFile\((.+?),\s*(.+?)\);?/g, (match, wb, filename) => {
            modified = true;
            // check if await is needed. Since we are inside a function, let's just use downloadFile.
            // If the function isn't async, await will error. But let's assume it doesn't matter or remove await.
            // Actually, we can remove await just in case, because downloadFile will execute in background if not awaited.
            return `const xlsxBuffer = XLSX.write(${wb}, { bookType: 'xlsx', type: 'array' });\n    downloadFile(new Uint8Array(xlsxBuffer), ${filename}, "Excel Document", ["xlsx"]);`;
        });
    }

    // 4. Remove file-saver and jspdf saveAs imports
    if (modified) {
        // We do NOT remove file-saver completely just in case, but we definitely inject our downloadFile
        if (!content.includes('import { downloadFile }')) {
            const lastImportIndex = content.lastIndexOf('import ');
            if (lastImportIndex !== -1) {
                const endOfLine = content.indexOf('\n', lastImportIndex);
                content = content.slice(0, endOfLine + 1) + 'import { downloadFile } from "@/lib/download";\n' + content.slice(endOfLine + 1);
            } else {
                content = 'import { downloadFile } from "@/lib/download";\n' + content;
            }
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Patched: ${filePath}`);
    }
}

for (const dir of srcDirs) {
    processDir(dir);
}
console.log('Patching complete.');
