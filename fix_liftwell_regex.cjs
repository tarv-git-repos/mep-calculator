const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/<tr key=\{item\.id\} className=\{.*?\}\>/g, '<tr key={item.id} className={order-b border-border hover:bg-slate-50 transition }>');

fs.writeFileSync(file, data, 'utf8');
