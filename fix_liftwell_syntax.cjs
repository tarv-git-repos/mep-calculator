const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'className={\\ order-b border-border hover:bg-slate-50 transition \\}',
  'className={order-b border-border hover:bg-slate-50 transition }'
);

fs.writeFileSync(file, data);
