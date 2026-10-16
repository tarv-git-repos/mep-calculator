const fs = require('fs');
const path = require('path');

function inspectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

    if (entry.isDirectory()) {
      inspectFiles(fullPath, results);
    } else {
      const stats = fs.statSync(fullPath);
      results.push({
        path: fullPath,
        size: stats.size,
        mtime: stats.mtime
      });
    }
  }
  return results;
}

const baseDir = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project';
console.log("=== INSPECTING RECENT FILE MODIFICATIONS IN MEP_Calculator_Project ===");

const frontendFiles = inspectFiles(path.join(baseDir, 'frontend/src'));
frontendFiles.sort((a, b) => b.mtime - a.mtime);

console.log("\n--- Top 25 Most Recently Modified Files in frontend/src ---");
frontendFiles.slice(0, 25).forEach(f => {
  console.log(`${f.mtime.toISOString()} | ${f.size} bytes | ${f.path}`);
});

const backendFiles = inspectFiles(path.join(baseDir, 'backend'));
backendFiles.sort((a, b) => b.mtime - a.mtime);

console.log("\n--- Top 10 Most Recently Modified Files in backend ---");
backendFiles.slice(0, 10).forEach(f => {
  console.log(`${f.mtime.toISOString()} | ${f.size} bytes | ${f.path}`);
});
