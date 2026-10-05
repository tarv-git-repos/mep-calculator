const fs = require('fs');
const tsxPath = 'frontend/src/routes/chw-pipe-sizer.tsx';
let lines = fs.readFileSync(tsxPath, 'utf8').split('\n');

const badStart = lines.findIndex(l => l.includes('</ContextMenuTrigger>'));
if (badStart !== -1) {
  const badEnd = lines.findIndex((l, i) => i > badStart && l.includes('</ContextMenu>'));
  if (badEnd !== -1) {
    lines.splice(badStart - 1, badEnd - badStart + 2);
    console.log('Removed stray ContextMenu block');
  }
}

const cmOpen = lines.findIndex(l => l.includes('<ContextMenu>'));
if (cmOpen !== -1) {
  lines.splice(cmOpen, 2);
  const gridLine = lines.findIndex((l, i) => i >= cmOpen && l.includes('cursor-context-menu" onDoubleClick'));
  if (gridLine !== -1) {
    lines[gridLine] = '              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">';
  }
  console.log('Restored grid line and removed opening ContextMenu');
}

fs.writeFileSync(tsxPath, lines.join('\n'));
