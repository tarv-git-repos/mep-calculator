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

const BORDER_SNIPPET = `calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"`;

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let code = fs.readFileSync(filePath, 'utf8');

  // Skip if uses StandardCalculatorLayout (already has the border)
  if (code.includes('<StandardCalculatorLayout')) continue;

  // 1. Ensure calcReviewState exists in component
  if (!code.includes('calcReviewState')) {
    const routeMatch = code.match(/createFileRoute\((['"])(.*?)\1\)/);
    const rPath = routeMatch ? routeMatch[2] : '/' + file.replace('.tsx', '');

    // Add calcReviewState hook
    code = code.replace(
      /(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/,
      `$1\n  const calcReviewState = useCalculationReviewState("${rPath}", project?.id || activeProjectId);`
    );
  }

  // 2. Replace static card container with dynamic 3-state border
  // Match common static card classes
  const staticPatterns = [
    /<div className=["']bg-card border border-border rounded-2xl shadow-\[0_1px_3px_rgba\(0,0,0,0\.05\)\] flex-1 flex flex-col([^"']*)["']>/,
    /<div className=["']flex-1 flex flex-col min-h-\[(?:400|450)px\] overflow-hidden rounded-2xl bg-card border border-border shadow-\[0_1px_3px_rgba\(0,0,0,0\.05\)\]([^"']*)["']>/,
    /<div className=["']bg-card border border-border rounded-2xl shadow-xs overflow-hidden([^"']*)["']>/,
    /<div className=["']flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full([^"']*)["']>/,
    /<div className=["']flex-1 min-w-0 flex flex-col pt-3 gap-3 overflow-y-auto h-full pb-4([^"']*)["']>/,
    /<div className=["']flex-1 min-w-0 flex flex-col pt-3 gap-2\.5 overflow-hidden h-full([^"']*)["']>/
  ];

  let replaced = false;

  // Check if it already has the 3-state border
  if (code.includes('border-emerald-500 ring-2 ring-emerald-500') && code.includes('border-red-500 ring-2 ring-red-500')) {
    // Already updated
    continue;
  }

  // If it only had the approved-only ternary, update it
  if (code.includes('border-emerald-500 ring-2 ring-emerald-500')) {
    code = code.replace(
      /calcReviewState\??\.status\s*===\s*["']APPROVED["']\s*\?\s*["'][^"']*border-emerald-500[^"']*["']\s*:\s*["'][^"']*["']/g,
      BORDER_SNIPPET
    );
    replaced = true;
  }

  // If still not replaced, search for the card container div
  if (!replaced) {
    for (const pat of staticPatterns) {
      if (pat.test(code)) {
        code = code.replace(pat, (match, extra) => {
          return `<div className={\`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}${extra || ''}\`}>`;
        });
        replaced = true;
        break;
      }
    }
  }

  if (replaced) {
    console.log('Successfully updated status card border in:', file);
    fs.writeFileSync(filePath, code, 'utf8');
  } else {
    console.log('Could not automatically match container pattern in:', file);
  }
}
