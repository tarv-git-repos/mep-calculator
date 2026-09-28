const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../frontend/src/routes');

const BORDER_SNIPPET = `calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"`;

// 1. circuit-breaker-sizing.tsx
{
  const filePath = path.join(routesDir, 'circuit-breaker-sizing.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.includes("{activeTab === 'calculator' ? (")) {
    code = code.replace(
      "{activeTab === 'calculator' ? (\n          <div className=\"flex flex-col gap-4\">",
      `{activeTab === 'calculator' ? (\n          <div className={\`flex flex-col gap-4 p-4 rounded-2xl transition-all duration-300 \${${BORDER_SNIPPET}}\`}>`
    );
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Updated circuit-breaker-sizing.tsx');
  }
}

// 2. lpd-calculation.tsx
{
  const filePath = path.join(routesDir, 'lpd-calculation.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.includes('<div className="relative z-10 flex flex-col w-full h-full min-h-0">')) {
    code = code.replace(
      '<div className="relative z-10 flex flex-col w-full h-full min-h-0">',
      `<div className={\`relative z-10 flex flex-col w-full h-full min-h-0 rounded-2xl overflow-hidden transition-all duration-300 \${${BORDER_SNIPPET}}\`}>`
    );
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Updated lpd-calculation.tsx');
  }
}

// 3. plumbing-fire-tank-duration.tsx
{
  const filePath = path.join(routesDir, 'plumbing-fire-tank-duration.tsx');
  let code = fs.readFileSync(filePath, 'utf8');
  if (code.includes('<div className="flex-1 min-h-0 pt-4 pb-4 overflow-hidden">')) {
    code = code.replace(
      '<div className="flex-1 min-h-0 pt-4 pb-4 overflow-hidden">',
      `<div className={\`flex-1 min-h-0 p-4 rounded-2xl transition-all duration-300 overflow-hidden \${${BORDER_SNIPPET}}\`}>`
    );
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Updated plumbing-fire-tank-duration.tsx');
  }
}
