const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const targetHeader = `<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800/60">
                                <div className="flex items-center gap-2.5 text-primary">
                                  <SlidersHorizontal className="size-4" />
                                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide">Sizing Parameters</h3>
                                </div>
                              </div>`;

const replacementHeader = `<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800/60">
                                <div className="flex items-center gap-2.5 text-primary">
                                  <SlidersHorizontal className="size-4" />
                                  <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide">Sizing Parameters</h3>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">(Double-click card for advanced options)</p>
                                  </div>
                                </div>
                              </div>`;

txt = txt.replace(targetHeader, replacementHeader);

const freshAirTarget = `<div>
                                  <label className="text-[11px] text-slate-500">Fresh Air ({isSI ? "L/s" : "CFM"})</label>`;
const freshAirReplacement = `{showAdvanced && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] text-slate-500">Fresh Air ({isSI ? "L/s" : "CFM"})</label>
                                    <span className="text-[10px] text-primary/70 font-semibold px-1.5 bg-primary/10 rounded-sm">Advanced</span>
                                  </div>`;

txt = txt.replace(freshAirTarget, freshAirReplacement);

const freshAirEndTarget = `const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setVentCfm("");
                                      else if (isSI) setVentCfm(val * LPS_TO_CFM);
                                      else setVentCfm(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>`;
const freshAirEndReplacement = `const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setVentCfm("");
                                      else if (isSI) setVentCfm(val * LPS_TO_CFM);
                                      else setVentCfm(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 mt-1 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                              )}`;

txt = txt.replace(freshAirEndTarget, freshAirEndReplacement);

fs.writeFileSync('src/routes/heating-load.tsx', txt);
console.log("Done");
