const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  '\\mep_auto_state_\\_/liftwell-pressurization_list\\',
  '"mep_auto_state_" + (project?.id || activeProjectId) + "_/liftwell-pressurization_list"'
);
data = data.replace(
  '\\mep_auto_state_\\_/liftwell-pressurization_list\\',
  '"mep_auto_state_" + (project?.id || activeProjectId) + "_/liftwell-pressurization_list"'
);
// fix the addItem string too
data = data.replace(
  /name: \\LIFTWELL-\\\[.*?\]/,
  'name: "LIFTWELL-" + (items.length + 1).toString().padStart(2, "0")'
);

fs.writeFileSync(file, data);
