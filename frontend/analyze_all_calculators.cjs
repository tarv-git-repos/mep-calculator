const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx'));

const summary = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf8');

  const hasCalculationReview = code.includes('CalculationReviewBar') || code.includes('useCalculationReviewState') || code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly');
  const hasKeyDown = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  
  // Find selection states
  const selectionMatches = code.match(/const\s+\[(selected\w+),\s*set\w+\]\s*=\s*useState/g) || [];
  
  // Find isLocked or isEffectiveReadOnly
  const lockDefs = [];
  if (code.includes('useCalculationEffectiveReadOnly')) lockDefs.push('useCalculationEffectiveReadOnly');
  if (code.includes('useCalculationLock')) lockDefs.push('useCalculationLock');
  if (code.includes('const isLocked')) lockDefs.push('isLocked');

  summary.push({
    file,
    hasCalculationReview,
    lockDefs,
    selectionMatches,
    hasKeyDown
  });
}

console.log(JSON.stringify(summary, null, 2));
