import fs from 'fs';

const content = fs.readFileSync('src/routes/index.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('zone') || line.includes('Zone') || line.includes('SharedAssignmentModal')) {
    if (line.includes('handle') || line.includes('update') || line.includes('assign') || line.includes('set')) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  }
});
