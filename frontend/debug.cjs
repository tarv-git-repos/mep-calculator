const fs = require('fs');
const txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');
const lines = txt.split(/\r?\n/);
const idx = lines.findIndex(l => l.includes('const calcResults = useMemo('));
for (let i = idx + 40; i < idx + 90; i++) {
    if (lines[i] !== undefined) {
        console.log(`${i+1}: ${lines[i]}`);
    }
}
