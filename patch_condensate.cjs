const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend', 'src', 'routes', 'condensate-drain-calc.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. location -> (project as any)?.location
c = c.replace(/project\?\.location/g, '(project as any)?.location');

// 2. getSignatureBlockDetails arguments
c = c.replace(
  'return getSignatureBlockDetails(project?.id || "default", "/condensate-drain-calc");',
  'return getSignatureBlockDetails(project?.id || "default", "/condensate-drain-calc", currentUserName, calcReviewState);'
);

// 3. forceSaveToCloud(true) -> forceSaveToCloud()
c = c.replace('forceSaveToCloud(true);', 'forceSaveToCloud();');

// 4. Add handleDuplicateCoil before handleExportPDF
if (!c.includes('const handleDuplicateCoil')) {
  const insertBefore = '  const handleExportPDF = async () => {';
  const duplicateFunc = `  const handleDuplicateCoil = (itemOrItems: CoilRow | CoilRow[]) => {
    if (isLocked) {
      toast.info("Calculation is approved and locked. Discipline Coordinator can unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    const newItems: CoilRow[] = items.map((item, idx) => ({
      ...item,
      id: "coil-" + Date.now() + "-" + idx,
      name: \`\${item.name} (Copy)\`,
      comments: []
    }));
    updateRowsWithHistory([...rows, ...newItems]);
    toast.success(\`Duplicated \${newItems.length} coil(s) successfully.\`);
  };\n\n`;
  c = c.replace(insertBefore, duplicateFunc + insertBefore);
}

fs.writeFileSync(p, c, 'utf8');
console.log('condensate-drain-calc.tsx patched successfully');
