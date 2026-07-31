import fs from 'fs';
import path from 'path';

function searchInDir(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      searchInDir(fullPath);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('zoneId') || line.includes('newZone.id') || line.includes('.zone =')) {
          if (line.includes('zone') && (line.includes('=') || line.includes(':'))) {
            console.log(`${fullPath}:L${idx + 1}: ${line.trim()}`);
          }
        }
      });
    }
  }
}

searchInDir('./src');
