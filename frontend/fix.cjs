const fs=require('fs'); 
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8'); 
txt = txt.replace(/<\/div>\s*\) : \(\s*<div className="flex-1 min-h-0 overflow-y-auto/g, '</div>\\n                </div>\\n              ) : (\\n                <div className="flex-1 min-h-0 overflow-y-auto');
fs.writeFileSync('src/routes/heating-load.tsx', txt);
