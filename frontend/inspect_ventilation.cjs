const fs = require('fs');
const code = fs.readFileSync('src/routes/ventilation.tsx', 'utf8');
const lines = code.split('\n');

console.log('Total lines in ventilation.tsx:', lines.length);

lines.forEach((l, i) => {
  if (
    l.includes('Flag') ||
    l.includes('flag') ||
    l.includes('name') && (l.includes('<input') || l.includes('<td') || l.includes('SPACE')) ||
    l.includes('ACTIONS') ||
    l.includes('ACTION') ||
    l.includes('toggleFlag')
  ) {
    if (i > 1000 && i < 2800) {
      console.log(`${i+1}: ${l}`);
    }
  }
});
