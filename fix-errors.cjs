const fs = require('fs');

// Fix PCL
const pclPath = 'frontend/src/routes/preliminary-cooling-load.tsx';
let pcl = fs.readFileSync(pclPath, 'utf8');
pcl = pcl.replace(
  '<strong className="font-bold text-primary">{floor}</strong>',
  '<strong className="font-bold text-primary">{floor.toLowerCase().includes(\'floor\') ? floor : \`Floor - \${floor}\`}</strong>'
);
fs.writeFileSync(pclPath, pcl);

// Fix Diffuser Selector
const dsPath = 'frontend/src/routes/diffuser-selector.tsx';
let ds = fs.readFileSync(dsPath, 'utf8');
// Fix markDirty
ds = ds.replace('markDirty();', 'dirtyStore.getState().markDirty();');
// Fix SavedCalculation
ds = ds.replace(/SavedCalculation\[\]/g, 'any[]');

fs.writeFileSync(dsPath, ds);

console.log('Fixed files');
