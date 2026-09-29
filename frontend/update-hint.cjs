const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const target = `<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            📥 Sizing Parameters
                          </span>
                        </div>`;

const replacement = `<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            📥 Sizing Parameters
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider italic">
                            {showAdvanced ? "Advanced Visible" : "Double-click for advanced"}
                          </span>
                        </div>`;

if(txt.includes(target)) {
    txt = txt.replace(target, replacement);
    fs.writeFileSync('src/routes/heating-load.tsx', txt);
    console.log('Success');
} else {
    console.log('Target not found');
}
