const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === "node_modules" || file === ".git" || file === "dist") continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".html") || file.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = walk(path.join(__dirname, "../frontend/src"));
for (const f of allFiles) {
  const content = fs.readFileSync(f, "utf8");
  if (content.includes("Intelligence") && (content.includes("Approve") || content.includes("CalculationReviewBar"))) {
    // Search for any line with Intelligence
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Intelligence")) {
        // check 5 lines before
        const prev = lines.slice(Math.max(0, i - 5), i + 1).join(" ");
        if (prev.includes("as") || prev.includes("as<") || prev.includes("as\"") || prev.includes("as'") || prev.includes("as ")) {
          console.log(`Match in ${path.relative(path.join(__dirname, '..'), f)} line ${i+1}:`);
          console.log(lines.slice(Math.max(0, i - 4), i + 3).join("\n"));
          console.log("-----------------------------------------");
        }
      }
    }
  }
}
