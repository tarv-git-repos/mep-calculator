const fs = require('fs');
const path = 'src/routes/heating-load.tsx';
let txt = fs.readFileSync(path, 'utf8');

const startStr = '<div\n                        id="card-hero-results"';
const startIdx = txt.indexOf(startStr);
const endIdx = txt.indexOf('</div>\n                      </div>\n                    </div>\n                  </div>\n                </div>\n              ) : (', startIdx);

console.log(startIdx, endIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `<ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-hero-results"
                            data-field-id="card-hero-results"
                            data-comment-target="card-hero-results"
                            className={\`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors \${isFieldHighlighted("card-hero-results", "Heating Load Summary")}\`}
                          >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                              <div className="flex items-center">
                                <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                  ⚡ Sizing Results Summary
                                </span>
                                {renderCommentBadge("card-hero-results", "Heating Load Summary")}
                              </div>
                            </div>

                            {/* 4-Box Grid matching Pump Sizing */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Plant Capacity</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? \`\${calcResults.kwTotal.toFixed(2)}\` : \`\${Math.round(calcResults.qTotal).toLocaleString()}\`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/hr"}</span>
                                </div>
                              </div>

                              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Base Heat Loss</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? \`\${calcResults.kwBase.toFixed(2)}\` : \`\${Math.round(calcResults.qBase).toLocaleString()}\`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/hr"}</span>
                                </div>
                              </div>

                              <div className="bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40 rounded-xl p-3.5">
                                <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Vent / Infiltration</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI ? \`\${calcResults.kwTotalAir.toFixed(2)}\` : \`\${Math.round(calcResults.qTotalAir).toLocaleString()}\`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/hr"}</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Load Density</div>
                                <div className="text-xl font-bold font-mono text-foreground mt-1">
                                  {isSI
                                    ? \`\${calcResults.loadDensityWPerSqm.toFixed(1)}\`
                                    : \`\${calcResults.loadDensityBtuPerSqft.toFixed(1)}\`}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">{isSI ? "W/m²" : "BTU/hr·ft²"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Detailed Metrics Table */}
                            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                              {[
                                { label: "Opaque Walls", val: calcResults.qWall, kw: calcResults.kwWall },
                                { label: "Roof / Ceiling", val: calcResults.qRoof, kw: calcResults.kwRoof },
                                { label: "Glazing / Windows", val: calcResults.qGlaz, kw: calcResults.kwGlaz },
                                { label: "Slab Perimeter", val: calcResults.qSlab, kw: calcResults.kwSlab },
                                { label: "Infiltration", val: calcResults.qInfil, kw: calcResults.kwInfil },
                                { label: "Fresh Air Vent", val: calcResults.qVent, kw: calcResults.kwVent },
                              ].map((b, i) => (
                                <div key={i} className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800 last:border-0 last:pb-0">
                                  <span className="text-slate-600 dark:text-zinc-400">{b.label}:</span>
                                  <span className="font-mono font-bold">
                                    {isSI ? \`\${b.kw.toFixed(2)} kW\` : \`\${Math.round(b.val)} BTU/hr\`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Heating Capacity", isSI ? \`\${calcResults.kwTotal.toFixed(2)} kW\` : \`\${Math.round(calcResults.qTotal)} BTU/hr\`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <span>Copy Plant Capacity</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => setFormulaModalOpen(true)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <span>View Mathematical Equations</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-hero-results", "Heating Load Summary")}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <span>Add Comment / Assign Task</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>`;
    
    txt = txt.substring(0, startIdx) + replacement + '\n' + txt.substring(endIdx);
    fs.writeFileSync(path, txt);
    console.log("Done");
}
