const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = [
  "basement-smoke-calc.tsx",
  "busbar-calculation.tsx",
  "busbar-voltage-drop.tsx",
  "cable-tray-sizing.tsx",
  "cable-voltage-drop.tsx",
  "central-battery-sizing.tsx",
  "circuit-breaker-sizing.tsx",
  "condensate-drain-calc.tsx",
  "conductor-sizing.tsx",
  "diffuser-selector.tsx",
  "generator-sizing.tsx",
  "liftwell-pressurization.tsx",
  "lighting-lux-calculation.tsx",
  "load-summary.tsx",
  "lobby-pressurisation.tsx",
  "lpd-calculation.tsx",
  "plumbing-discharge-unit.tsx",
  "plumbing-drainage.tsx",
  "plumbing-fire-water-demand.tsx",
  "plumbing-fixture-unit.tsx",
  "plumbing-fm200.tsx",
  "plumbing-loading-unit.tsx",
  "plumbing-sprinkler-kfactor.tsx",
  "plumbing-storm-water.tsx",
  "plumbing-water-demand.tsx",
  "preliminary-cooling-load.tsx",
  "psychrometric.tsx",
  "short-circuit-calculations.tsx",
  "staircase-pressurization.tsx",
  "transformer-sizing.tsx",
  "ups-sizing-calculation.tsx",
  "ventilation.tsx",
  "zones.tsx"
];

const results = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  if (!fs.existsSync(filePath)) continue;
  const code = fs.readFileSync(filePath, 'utf8');

  const hasIsLocked = /const\s+isLocked\s*=/.test(code);
  const hasIsApprovedLocked = /const\s+isApprovedLocked\s*=/.test(code);
  const hasIsEffectiveReadOnly = /const\s+isEffectiveReadOnly\s*=/.test(code);

  const selMatches = [...code.matchAll(/const\s+\[(selected[a-zA-Z0-9_]*),\s*set([a-zA-Z0-9_]+)\]\s*=\s*useState(?:<[^>]+>)?\(([^)]*)\)/gi)];
  const selectionStates = selMatches.map(m => m[1]);

  const hasAutoClear = /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\((?:isLocked|isApprovedLocked|isEffectiveReadOnly)[^)]*\)[\s\S]*?set[a-zA-Z0-9_]*\(\[\]\)/m.test(code);

  const hasKeydownListener = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  const hasShortcutFreeze = hasKeydownListener && (code.includes('Calculation is Approved & Locked') || code.includes('is locked') || (code.includes('isLocked') && code.includes('e.preventDefault()')));

  const checkboxes = [...code.matchAll(/<input[^>]+type=["']checkbox["'][^>]*>/gi)].map(m => m[0]);
  const unguardedCheckboxes = checkboxes.filter(cb => !cb.includes('disabled='));

  results.push({
    file,
    hasIsLocked,
    hasIsApprovedLocked,
    hasIsEffectiveReadOnly,
    selectionStates,
    hasAutoClear,
    hasKeydownListener,
    hasShortcutFreeze,
    checkboxesCount: checkboxes.length,
    unguardedCheckboxesCount: unguardedCheckboxes.length
  });
}

console.log(JSON.stringify(results, null, 2));
