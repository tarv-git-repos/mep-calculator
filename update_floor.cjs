const fs = require('fs');
const p = 'frontend/src/routes/preliminary-cooling-load.tsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

const displayFloorCode = `const displayFloor = (f: string | undefined | null) => (f && !f.toLowerCase().includes('floor')) ? \`Floor - \${f}\` : (f || '');`;

// Add displayFloor near the top of the component
const matchImport = lines.findIndex(l => l.includes('export default function PreliminaryCoolingLoad'));
if (matchImport !== -1) {
  lines.splice(matchImport + 1, 0, displayFloorCode);
}

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('{floor}</span>')) {
    lines[i] = lines[i].replace('{floor}</span>', '{displayFloor(floor)}</span>');
  }
  if (lines[i].includes('>{r.floor}</td>')) {
    lines[i] = lines[i].replace('>{r.floor}</td>', '>{displayFloor(r.floor)}</td>');
  }
  if (lines[i].includes('{r.floor || "GF"}</td>')) {
    lines[i] = lines[i].replace('{r.floor || "GF"}</td>', '{displayFloor(r.floor || "GF")}</td>');
  }
  if (lines[i].includes('Floor: {fl}')) {
    lines[i] = lines[i].replace('Floor: {fl}', '{displayFloor(fl)}');
  }
  if (lines[i].includes('Floor: {floor}')) {
    lines[i] = lines[i].replace('Floor: {floor}', '{displayFloor(floor)}');
  }
}
fs.writeFileSync(p, lines.join('\n'));
console.log('Done modifying floor display');
