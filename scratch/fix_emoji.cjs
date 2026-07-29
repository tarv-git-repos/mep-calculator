const fs = require('fs');
let content = fs.readFileSync('src/components/workspace/AppShell.tsx', 'utf8');
content = content.replace(/toast\.error\(.*disabled by the Administrator.*/g, 'toast.error("This feature is disabled by the Administrator.", { icon: "🔒" });');
fs.writeFileSync('src/components/workspace/AppShell.tsx', content);
