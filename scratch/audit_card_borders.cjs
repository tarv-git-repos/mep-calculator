const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../frontend/src/routes');

const nonCalc = [
  '3d-view.tsx', '__root.tsx', 'admin.tsx', 'bim-viewer.tsx', 'calculators.tsx',
  'company-hierarchy.tsx', 'dashboard.tsx', 'equipment.tsx', 'index.tsx',
  'login.tsx', 'notifications.tsx', 'privacy.tsx', 'projects.tsx', 'reports.tsx',
  'reset-password.tsx', 'sanity-check-tool.tsx', 'settings.tsx', 'teams.tsx', 'zones.tsx'
];

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx') && !nonCalc.includes(f));

const audit = [];

for (const f of files) {
  const code = fs.readFileSync(path.join(routesDir, f), 'utf8');
  const usesStandardLayout = code.includes('<StandardCalculatorLayout');
  const hasCalcReviewState = code.includes('calcReviewState') || code.includes('useCalculationReviewState');
  const has3StateBorder = code.includes('border-emerald-500 ring-2 ring-emerald-500') && 
                          code.includes('border-red-500 ring-2 ring-red-500') &&
                          code.includes('border-indigo-500 ring-2 ring-indigo-500');

  audit.push({
    file: f,
    usesStandardLayout,
    hasCalcReviewState,
    has3StateBorder
  });
}

console.log(JSON.stringify(audit, null, 2));

const missing = audit.filter(a => !a.usesStandardLayout && !a.has3StateBorder);
console.log('Missing 3-state card border (' + missing.length + '):', missing.map(m => m.file));
