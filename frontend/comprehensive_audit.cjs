const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx'));

const results = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf8');

  // Check if it is a calculator / workspace component
  const hasReviewBar = code.includes('CalculationReviewBar');
  const hasLockHook = code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly');
  const hasShortcuts = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"') || code.includes('useHotkeys');
  
  // Find all useState with select/selection
  const selectMatches = [...code.matchAll(/const\s+\[([a-zA-Z0-9_]*select[a-zA-Z0-9_]*),\s*set([a-zA-Z0-9_]+)\]\s*=\s*useState(?:<[^>]+>)?\(([^)]*)\)/gi)];
  const selectionStates = selectMatches.map(m => ({
    name: m[1],
    setter: 'set' + m[2],
    initial: m[3]
  }));

  // Check if isLocked is defined
  const hasIsLocked = /const\s+isLocked\s*=/.test(code);
  const hasIsApprovedLocked = /const\s+isApprovedLocked\s*=/.test(code);
  const hasIsEffectiveReadOnly = /const\s+isEffectiveReadOnly\s*=/.test(code);

  // Check if checkboxes exist
  const checkboxes = [...code.matchAll(/<input[^>]+type=["']checkbox["'][^>]*>/gi)].map(m => m[0]);
  const unguardedCheckboxes = checkboxes.filter(cb => !cb.includes('disabled=') && !cb.includes('disabled'));

  // Check if shortcuts handle lock
  const hasShortcutLockGuard = /if\s*\((?:isLocked|isApprovedLocked|isEffectiveReadOnly)[^)]*\)\s*\{[\s\S]*?(?:KeyA|toast|prevent)/.test(code);

  // Check if selection clearing effect is present
  const hasAutoClear = /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?if\s*\((?:isLocked|isApprovedLocked|isEffectiveReadOnly)[^)]*\)[\s\S]*?set[a-zA-Z0-9_]*\(\[\]\)/m.test(code);

  results.push({
    file,
    hasReviewBar,
    hasLockHook,
    hasIsLocked,
    hasIsApprovedLocked,
    hasIsEffectiveReadOnly,
    selectionStates,
    hasShortcuts,
    hasShortcutLockGuard,
    hasAutoClear,
    checkboxesCount: checkboxes.length,
    unguardedCheckboxesCount: unguardedCheckboxes.length
  });
}

console.log(JSON.stringify(results.filter(r => r.hasReviewBar || r.hasLockHook || r.hasShortcuts || r.selectionStates.length > 0), null, 2));
