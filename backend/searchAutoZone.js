import fs from 'fs';

const content = fs.readFileSync('src/routes/index.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('_1') || line.includes('suggest') || line.includes('autoZone') || line.includes('Duplicate') || line.includes('rename')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
