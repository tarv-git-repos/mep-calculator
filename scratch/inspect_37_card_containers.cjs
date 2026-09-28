const fs = require('fs');
const path = require('path');

const routesDir = path.resolve(__dirname, '../frontend/src/routes');

const targets = [
  'busbar-calculation.tsx',
  'busbar-voltage-drop.tsx',
  'cable-tray-sizing.tsx',
  'cable-voltage-drop.tsx',
  'capacitor-bank-sizing.tsx',
  'central-battery-sizing.tsx',
  'chw-pipe-sizer.tsx',
  'chw-pump-head.tsx',
  'circuit-breaker-sizing.tsx',
  'condensate-drain-calc.tsx',
  'condensate-drain.tsx',
  'conductor-sizing.tsx',
  'fresh-air-cooling-load.tsx',
  'generator-sizing.tsx',
  'liftwell-pressurization.tsx',
  'lighting-lux-calculation.tsx',
  'load-summary.tsx',
  'lpd-calculation.tsx',
  'plumbing-fire-tank-duration.tsx',
  'plumbing-fixture-unit.tsx',
  'plumbing-fm200.tsx',
  'plumbing-gas-tank.tsx',
  'plumbing-hazen-williams.tsx',
  'plumbing-loading-unit.tsx',
  'plumbing-pressure-vessel.tsx',
  'plumbing-sprinkler-density.tsx',
  'plumbing-supply-pipe-sizer.tsx',
  'plumbing-tank-sizing.tsx',
  'plumbing-water-demand.tsx',
  'project-load-schedule.tsx',
  'psychrometric.tsx',
  'refrigerant-pipe-sizing.tsx',
  'short-circuit-calculations.tsx',
  'smoke-extract-fan.tsx',
  'staircase-pressurization.tsx',
  'transformer-sizing.tsx',
  'ups-sizing-calculation.tsx'
];

for (const t of targets) {
  const code = fs.readFileSync(path.join(routesDir, t), 'utf8');
  console.log('================== ' + t + ' ==================');
  
  // Find lines around DataGrid, tabs, or main table card container
  const lines = code.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('<DataGrid') || l.includes('min-h-[400px]') || l.includes('min-h-[450px]') || l.includes('rounded-2xl') || l.includes('bg-card border') || l.includes('bg-white') && l.includes('border')) {
      console.log((idx+1) + ': ' + l.slice(0, 120));
    }
  });
}
