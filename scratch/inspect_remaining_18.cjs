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

for (const t of targets) {
  const code = fs.readFileSync(path.join(routesDir, t), 'utf8');
  console.log('=== ' + t + ' ===');
  
  // Find where calculation toolbar/header ends and the main card begins
  const lines = code.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('<DataGrid') || l.includes('min-h-[') || (l.includes('<div') && (l.includes('border') || l.includes('rounded-') || l.includes('bg-')) && !l.includes('<div className="flex items-center') && !l.includes('<div className="flex justify-between'))) {
      if (idx > 200 && idx < 1200) {
        console.log((idx+1) + ': ' + l.slice(0, 100));
      }
    }
  });
}
