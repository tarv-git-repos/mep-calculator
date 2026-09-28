const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../frontend/src/routes');

const targets = [
  'busbar-calculation.tsx',
  'busbar-voltage-drop.tsx',
  'cable-tray-sizing.tsx',
  'cable-voltage-drop.tsx',
  'capacitor-bank-sizing.tsx',
  'circuit-breaker-sizing.tsx',
  'fresh-air-cooling-load.tsx',
  'generator-sizing.tsx',
  'liftwell-pressurization.tsx',
  'lighting-lux-calculation.tsx',
  'load-summary.tsx',
  'lpd-calculation.tsx',
  'plumbing-fire-tank-duration.tsx',
  'plumbing-gas-tank.tsx',
  'plumbing-pressure-vessel.tsx',
  'project-load-schedule.tsx',
  'staircase-pressurization.tsx',
  'transformer-sizing.tsx'
];

const BORDER_SNIPPET = `calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"`;

for (const t of targets) {
  const filePath = path.join(routesDir, t);
  let code = fs.readFileSync(filePath, 'utf8');

  // Ensure calcReviewState exists
  if (!code.includes('calcReviewState')) {
    const routeMatch = code.match(/createFileRoute\((['"])(.*?)\1\)/);
    const rPath = routeMatch ? routeMatch[2] : '/' + t.replace('.tsx', '');
    code = code.replace(
      /(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/,
      `$1\n  const calcReviewState = useCalculationReviewState("${rPath}", project?.id || activeProjectId);`
    );
  }

  // Find the first main card div below the toolbar/header
  // Usually right after calculation review bar or after header controls
  let updated = false;

  // Pattern A: <div className="flex-1 min-w-0 flex flex-col ...
  if (code.includes('<div className="flex-1 min-w-0 flex flex-col')) {
    code = code.replace(
      /<div className=["']flex-1 min-w-0 flex flex-col([^"']*)["']>/,
      `<div className={\`flex-1 min-w-0 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}$1\`}>`
    );
    updated = true;
  }
  // Pattern B: <div className="flex flex-col flex-1 min-h-0 ...
  else if (code.includes('<div className="flex flex-col flex-1 min-h-0')) {
    code = code.replace(
      /<div className=["']flex flex-col flex-1 min-h-0([^"']*)["']>/,
      `<div className={\`flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}$1\`}>`
    );
    updated = true;
  }
  // Pattern C: <div className="flex-1 flex flex-col ...
  else if (code.includes('<div className="flex-1 flex flex-col')) {
    code = code.replace(
      /<div className=["']flex-1 flex flex-col([^"']*)["']>/,
      `<div className={\`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}$1\`}>`
    );
    updated = true;
  }
  // Pattern D: <div className="flex-1 overflow-y-auto ...
  else if (code.includes('<div className="flex-1 overflow-y-auto')) {
    code = code.replace(
      /<div className=["']flex-1 overflow-y-auto([^"']*)["']>/,
      `<div className={\`flex-1 overflow-y-auto rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}$1\`}>`
    );
    updated = true;
  }

  if (updated) {
    console.log('Successfully updated:', t);
    fs.writeFileSync(filePath, code, 'utf8');
  } else {
    console.log('Could not match pattern in:', t);
  }
}
