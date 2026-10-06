const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx'));

const detailed = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf8');

  const isCalc = code.includes('CalculationReviewBar') || code.includes('useCalculationReviewState') || code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly');
  if (!isCalc) continue;

  const rowSelectionStates = [];
  const matches = code.matchAll(/const\s+\[(selected\w*),/g);
  for (const m of matches) {
    rowSelectionStates.push(m[1]);
  }

  const hasKeyDown = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  const hasCheckbox = code.includes('type="checkbox"');
  const usesLock = code.includes('isLocked') || code.includes('isApprovedLocked') || code.includes('isEffectiveReadOnly');

  detailed.push({
    file,
    rowSelectionStates,
    hasKeyDown,
    hasCheckbox,
    usesLock
  });
}

console.log(JSON.stringify(detailed, null, 2));
