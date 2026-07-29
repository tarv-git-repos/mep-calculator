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
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (line.includes('downloadFile') && !line.includes('import')) {
                    console.log(`[${fullPath}:${i + 1}] ${line.trim()}`);
                }
            });
        }
    }
}

for (const dir of srcDirs) {
    processDir(dir);
}
