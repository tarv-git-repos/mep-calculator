const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

// 1. Add double-click to Sizing Parameters card
txt = txt.replace(
  'div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700"',
  'div onDoubleClick={() => setShowAdvanced(p => !p)} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700 select-none cursor-default"'
);

// 2. Hide safety margin field behind showAdvanced check
// First, find the safety margin block
const safetyMarginBlock = `<div className="col-span-2">
                                  <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={safetyMargin}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setSafetyMargin(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>`;

const newSafetyMarginBlock = `{showAdvanced && (
                                <div className="col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                                    <span className="text-[10px] text-primary/70 font-semibold px-1.5 bg-primary/10 rounded-sm">Advanced</span>
                                  </div>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={safetyMargin}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setSafetyMargin(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 mt-1 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                              )}`;

txt = txt.replace(safetyMarginBlock, newSafetyMarginBlock);

// 3. Remove "Load Climate Preset" dropdown from the action bar!
// Wait, user said "remove it (load climate preset)". The Fresh Air one had a button.
// Heating load has `HeatingProfileSelect`.
// Let's remove `<HeatingProfileSelect ... />`
txt = txt.replace(/<HeatingProfileSelect[\s\S]*?disabled={isEffectiveReadOnly}\s*\/>/m, '');

fs.writeFileSync('src/routes/heating-load.tsx', txt);
console.log('Applied advanced logic and removed preset dropdown');
