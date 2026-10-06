const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';
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

const report = [];

for (const file of files) {
  const code = fs.readFileSync(path.join(routesDir, file), 'utf8');

  // Check how isLocked is defined
  const isLockedMatch = code.match(/const\s+(isLocked|isApprovedLocked|isEffectiveReadOnly)\s*=/g) || [];
  
  // Selection states
  const selStates = [...code.matchAll(/const\s+\[(selected\w*),\s*set\w+\]\s*=\s*useState/g)].map(m => m[1]);

  // Check if selection clearing effect exists
  const hasSelectionClearEffect = selStates.length > 0 && /useEffect\(\s*\(\)\s*=>\s*\{\s*if\s*\((isLocked|isApprovedLocked|isEffectiveReadOnly)\)\s*\{[\s\S]*?setSelected/m.test(code);

  // Check if shortcuts exist and if isLocked is checked in handleKeyDown
  const hasShortcuts = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  const hasLockedInKeyDown = hasShortcuts && /if\s*\((isLocked|isApprovedLocked|isEffectiveReadOnly)\)[\s\S]*?(KeyA|Delete|Backspace|readonly-notice|toast|prevent)/.test(code);

  // Check if checkboxes have disabled={isLocked}
  const checkboxes = [...code.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map(m => m[0]);
  const uncheckedDisabled = checkboxes.filter(cb => !cb.includes('disabled='));

  report.push({
    file,
    isLockedDefs: isLockedMatch,
    selStates,
    hasSelectionClearEffect,
    hasShortcuts,
    hasLockedInKeyDown,
    totalCheckboxes: checkboxes.length,
    checkboxesWithoutDisabled: uncheckedDisabled.length
  });
}

console.log(JSON.stringify(report, null, 2));
