const fs = require('fs');
const path = require('path');

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('Specify file in src/routes/');
  process.exit(1);
}

const filePath = path.join(__dirname, 'src', 'routes', targetFile);
const code = fs.readFileSync(filePath, 'utf8');
const lines = code.split('\n');

console.log('=== FILE:', targetFile, 'Lines:', lines.length, '===');

lines.forEach((l, i) => {
  if (
    l.includes('isApprovedLocked') ||
    l.includes('isEffectiveReadOnly') ||
    l.includes('isLocked') ||
    l.includes('selectedRowIds') ||
    l.includes('selectedIds') ||
    l.includes('selectedSpaces') ||
    l.includes('selectedItems') ||
    l.includes('keydown') ||
    l.includes('type="checkbox"') ||
    l.includes("type='checkbox'")
  ) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
