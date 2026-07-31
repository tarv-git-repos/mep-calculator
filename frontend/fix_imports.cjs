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
    const targetImport = 'import { downloadFile } from "@/lib/download";';
    
    // Check if the import is NOT at the top of the file (e.g. after some non-import code)
    // To be safe, just remove all instances of it and place exactly one at the top.
    if (content.includes(targetImport)) {
        // Remove all instances
        const cleanContent = content.split('\n').filter(line => !line.includes(targetImport)).join('\n');
        // Add to top
        const finalContent = targetImport + '\n' + cleanContent;
        if (content !== finalContent) {
            fs.writeFileSync(filePath, finalContent, 'utf8');
            console.log(`Fixed import in: ${filePath}`);
        }
    }
}

for (const dir of srcDirs) {
    processDir(dir);
}
console.log('Fix complete.');
