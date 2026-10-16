import fs from 'fs';
import path from 'path';

function searchInDir(dir, query) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      searchInDir(fullPath, query);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        console.log(`Found in ${fullPath}`);
      }
    }
  }
}

searchInDir('./src', 'selected');
