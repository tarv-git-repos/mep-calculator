const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx'));

const results = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf8');

  // Check if it is a calculator / schedule page
  const isCalculator = code.includes('CalculationReviewBar') || code.includes('useCalculationReviewState') || code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly');
  if (!isCalculator) continue;

  const hasShortcuts = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  const hasLock = code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly') || code.includes('isLocked');
  
  // Look for selection states
  const selectionMatches = [...code.matchAll(/const\s+\[(selected\w*),\s*set\w+\]\s*=\s*useState/g)].map(m => m[1]);
  
  // Look for checkboxes
  const hasCheckboxes = code.includes('type="checkbox"');
  
  // Check if selection clearing effect exists
  const hasSelectionClearEffect = code.includes('setSelected') && (code.includes('if (isLocked') || code.includes('if (isApprovedLocked') || code.includes('if (isEffectiveReadOnly'));

  // Check if handleKeyDown has isLocked check
  const hasLockedShortcutGuard = code.includes('handleKeyDown') && (code.includes('if (isLocked') || code.includes('if (isApprovedLocked') || code.includes('if (isEffectiveReadOnly'));

  // Check if checkboxes have disabled={isLocked...}
  const hasDisabledCheckboxes = code.includes('disabled={isLocked') || code.includes('disabled={isApprovedLocked') || code.includes('disabled={isEffectiveReadOnly');

  results.push({
    file,
    selectionMatches,
    hasShortcuts,
    hasCheckboxes,
    hasSelectionClearEffect,
    hasLockedShortcutGuard,
    hasDisabledCheckboxes
  });
}

console.log(JSON.stringify(results, null, 2));
