const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'doc.text(\\Project: \\\\, 14, 24);',
  'doc.text("Project: " + (project?.name || "N/A"), 14, 24);'
);

fs.writeFileSync(file, data);
