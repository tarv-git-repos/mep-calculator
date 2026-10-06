const fs = require('fs');
const path = require('path');

function inspectDrainage() {
  const code = fs.readFileSync('./src/routes/plumbing-drainage.tsx', 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('handleToggleSelect') || line.includes('selectedSpaceIds') || line.includes('type="checkbox"') || line.includes('onSelect')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
}

inspectDrainage();
