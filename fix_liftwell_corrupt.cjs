const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

// Fix className
data = data.replace(
  /className=\{\\ order-b border-border hover:bg-slate-50 transition \\\\\}/g,
  'className={order-b border-border hover:bg-slate-50 transition }'
);

// Replace corrupt unicode characters
data = data.replace(/m\uFFFD/g, 'm²');

fs.writeFileSync(file, data, 'utf8');
