const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'Simultaneously open escape doors (default: 2)',
  'Simultaneously open escape doors (default: 1)'
);

data = data.replace(
  'Remaining closed fire doors (default: 16)',
  'Remaining closed fire doors (default: 17)'
);

fs.writeFileSync(file, data);
