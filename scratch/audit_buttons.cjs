const fs = require("fs");
const path = require("path");

const routesDir = path.join(__dirname, "../frontend/src/routes");
const files = fs.readdirSync(routesDir).filter(f => f.endsWith(".tsx"));

const NON_CALC = [
  "__root.tsx", "3d-view.tsx", "admin.tsx", "bim-viewer.tsx", "company-hierarchy.tsx",
  "dashboard.tsx", "equipment.tsx", "index.tsx", "login.tsx", "notifications.tsx",
  "privacy.tsx", "projects.tsx", "reports.tsx", "reset-password.tsx", "settings.tsx",
  "teams.tsx", "zones.tsx", "calculators.tsx"
];

const results = [];
for (const f of files) {
  if (NON_CALC.includes(f)) continue;
  const content = fs.readFileSync(path.join(routesDir, f), "utf8");
  const hasAppShell = content.includes("<AppShell");
  const hasUnitToggleImport = content.includes("UnitToggle");
  const hasUnitToggleRender = content.includes("<UnitToggle");
  const hasIntelButton = content.includes("Intelligence") && (content.includes("intelOpen") || content.includes("setIntelOpen"));
  const hasReviewBar = content.includes("<CalculationReviewBar");
  
  // Check if UnitToggle is in Header (flex justify-between or next to CalculationReviewBar)
  // or if UnitToggle is rendered at all
  results.push({
    file: f,
    hasAppShell,
    hasUnitToggleImport,
    hasUnitToggleRender,
    hasIntelButton,
    hasReviewBar
  });
}

console.log("=== CALCULATORS WITH BOTH UnitToggle AND IntelButton ===");
for (const r of results) {
  if (r.hasUnitToggleRender && r.hasIntelButton) {
    console.log(`  ${r.file}`);
  }
}

console.log("\n=== CALCULATORS MISSING UnitToggle RENDER OR IntelButton ===");
for (const r of results) {
  if (!r.hasUnitToggleRender || !r.hasIntelButton) {
    console.log(`${r.file.padEnd(35)} UnitToggle: ${String(r.hasUnitToggleRender).padEnd(5)} | IntelButton: ${String(r.hasIntelButton).padEnd(5)} | ReviewBar: ${r.hasReviewBar}`);
  }
}

