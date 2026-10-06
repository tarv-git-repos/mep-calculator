const fs = require('fs');
const path = require('path');

const routesDir = './src/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.tsx'));

const list = [];

for (const file of files) {
  const filePath = path.join(routesDir, file);
  const code = fs.readFileSync(filePath, 'utf8');

  const isCalc = code.includes('CalculationReviewBar') || code.includes('useCalculationReviewState') || code.includes('useCalculationLock') || code.includes('useCalculationEffectiveReadOnly');
  if (!isCalc) continue;

  const hasShortcuts = code.includes("addEventListener('keydown'") || code.includes('addEventListener("keydown"');
  const hasCheckbox = code.includes('type="checkbox"');
  const selectionMatches = [...code.matchAll(/const\s+\[(selected\w*),\s*set\w+\]\s*=\s*useState/g)].map(m => m[1]);

  if (hasShortcuts || hasCheckbox || selectionMatches.length > 0) {
    list.push({
      file,
      selectionMatches,
      hasShortcuts,
      hasCheckbox
    });
  }
}

console.log('Relevant Calculators Count:', list.length);
list.forEach(item => {
  console.log(`- ${item.file}: selections=[${item.selectionMatches.join(', ')}], hasShortcuts=${item.hasShortcuts}, hasCheckbox=${item.hasCheckbox}`);
});
