const fs = require('fs');
const path = require('path');

function searchInDir(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.name === 'node_modules' || file.name === '.git' || file.name === 'dist') continue;

    if (file.isDirectory()) {
      searchInDir(fullPath, pattern);
    } else if (file.name.endsWith('.tsx') || file.name.endsWith('.ts') || file.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`Found "${pattern}" in ${fullPath}`);
      }
    }
  }
}

const baseDir = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project';
console.log("=== SEARCHING FOR LICENSE & SUBSCRIPTION IN CODEBASE ===");
searchInDir(path.join(baseDir, 'frontend/src'), 'license');
searchInDir(path.join(baseDir, 'frontend/src'), 'subscription');
searchInDir(path.join(baseDir, 'backend'), 'license');
searchInDir(path.join(baseDir, 'backend'), 'subscription');
