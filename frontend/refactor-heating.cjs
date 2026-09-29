const fs = require('fs');

const path = 'src/routes/heating-load.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(') : (', startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find bounds", startIdx, endIdx);
    process.exit(1);
}

const newGrid = `<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: PARAMETER INPUTS */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 transition-all hover:border-slate-300 dark:hover:border-zinc-700">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                            📥 Sizing Parameters
                          </span>
                        </div>

                        {/* SPACE GEOMETRY */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="field-card-geometry" 
                              data-field-id="card-geometry" 
                              data-comment-target="card-geometry"
                              className={\`p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-geometry", "Space Geometry")}\`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Space Geometry & Area
                                  </span>
                                  {renderCommentBadge("card-geometry", "Space Geometry")}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Floor Area ({isSI ? "m²" : "sq ft"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof area === "number" ? parseFloat((area * SQFT_TO_SQM).toFixed(1)) : area}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setArea("");
                                      else if (isSI) setArea(val * SQM_TO_SQFT);
                                      else setArea(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Ceiling Height ({isSI ? "m" : "ft"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof height === "number" ? parseFloat((height * FT_TO_M).toFixed(2)) : height}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setHeight("");
                                      else if (isSI) setHeight(val * M_TO_FT);
                                      else setHeight(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[11px] text-slate-500">Total Glazing Area ({isSI ? "m²" : "sq ft"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof glazArea === "number" ? parseFloat((glazArea * SQFT_TO_SQM).toFixed(1)) : glazArea}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setGlazArea("");
                                      else if (isSI) setGlazArea(val * SQM_TO_SQFT);
                                      else setGlazArea(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => { setArea(isSI ? 5000 * SQM_TO_SQFT : 5000); setHeight(isSI ? 10 * M_TO_FT : 10); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                              <RotateCcw className="size-3.5 text-muted-foreground" /> Reset Geometry
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* ENVELOPE U-VALUES */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="field-card-envelope" 
                              data-field-id="card-envelope" 
                              data-comment-target="card-envelope"
                              className={\`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-envelope", "Envelope U-Values")}\`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Envelope Thermal Insulation
                                  </span>
                                  {renderCommentBadge("card-envelope", "Envelope U-Values")}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Wall U-Value ({isSI ? "W/m²K" : "U"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uWall === "number" ? parseFloat((uWall * U_IP_TO_SI).toFixed(3)) : uWall}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setUWall("");
                                      else if (isSI) setUWall(val * U_SI_TO_IP);
                                      else setUWall(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Roof U-Value ({isSI ? "W/m²K" : "U"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uRoof === "number" ? parseFloat((uRoof * U_IP_TO_SI).toFixed(3)) : uRoof}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setURoof("");
                                      else if (isSI) setURoof(val * U_SI_TO_IP);
                                      else setURoof(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[11px] text-slate-500">Glazing U-Value ({isSI ? "W/m²K" : "U"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uGlaz === "number" ? parseFloat((uGlaz * U_IP_TO_SI).toFixed(2)) : uGlaz}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setUGlaz("");
                                      else if (isSI) setUGlaz(val * U_SI_TO_IP);
                                      else setUGlaz(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => { setUWall(0.065); setURoof(0.035); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                              <RotateCcw className="size-3.5 text-muted-foreground" /> Reset U-Values
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* CLIMATE & TEMPERATURE */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="field-card-climate" 
                              data-field-id="card-climate" 
                              data-comment-target="card-climate"
                              className={\`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-climate", "Climate")}\`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Winter Climate & Temps
                                  </span>
                                  {renderCommentBadge("card-climate", "Climate")}
                                </div>
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  ΔT: <strong className="text-primary font-mono">{isSI ? calcResults.deltaTC.toFixed(1) + " °C" : calcResults.deltaTF.toFixed(1) + " °F"}</strong>
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Outdoor Temp ({isSI ? "°C" : "°F"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof oat === "number" ? parseFloat(((oat - 32) * 5 / 9).toFixed(1)) : oat}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setOat("");
                                      else if (isSI) setOat((val * 9 / 5) + 32);
                                      else setOat(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Indoor Temp ({isSI ? "°C" : "°F"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof iat === "number" ? parseFloat(((iat - 32) * 5 / 9).toFixed(1)) : iat}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setIat("");
                                      else if (isSI) setIat((val * 9 / 5) + 32);
                                      else setIat(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => { setOat(isSI ? 0 : 32); setIat(isSI ? 21.1 : 70); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                              <RotateCcw className="size-3.5 text-muted-foreground" /> Reset Temps
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* VENTILATION & MARGIN */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div 
                              id="field-card-ventilation" 
                              data-field-id="card-ventilation" 
                              data-comment-target="card-ventilation"
                              className={\`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-ventilation", "Ventilation")}\`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    Ventilation & Safety
                                  </span>
                                  {renderCommentBadge("card-ventilation", "Ventilation")}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="text-[11px] text-slate-500">Infiltration (ACH)</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={ach}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      setAch(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] text-slate-500">Fresh Air ({isSI ? "L/s" : "CFM"})</label>
                                  <input
                                    type="number" step="any"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof ventCfm === "number" ? parseFloat((ventCfm * CFM_TO_LPS).toFixed(1)) : ventCfm}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setVentCfm("");
                                      else if (isSI) setVentCfm(val * LPS_TO_CFM);
                                      else setVentCfm(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/50 rounded-md text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-60"
                                  />
                                </div>
                                <div className="col-span-2">
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
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem onClick={() => { setAch(0.35); setVentCfm(450); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                              <RotateCcw className="size-3.5 text-muted-foreground" /> Reset Flow
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                      </div>
                    </div>

                    {/* RIGHT COLUMN: HERO RESULTS SUMMARY */}
                    <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0">
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

                        {/* HERO BOXES */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 1. Required Boiler/Heater Capacity */}
                          <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 col-span-2">
                            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                              Required Heating Plant Capacity
                            </div>
                            <div className="text-3xl font-black text-blue-700 dark:text-blue-300">
                              {isSI
                                ? \`\${calcResults.kwTotal.toFixed(2)} kW\`
                                : \`\${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr\`}
                            </div>
                            <div className="text-[11.5px] font-medium text-blue-600/70 dark:text-blue-400/70 mt-1">
                              {isSI
                                ? \`\${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr (+\${safetyMargin}% margin)\`
                                : \`\${calcResults.kwTotal.toFixed(2)} kW (+\${safetyMargin}% margin)\`}
                            </div>
                          </div>

                          {/* 2. Total Base Loss */}
                          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                              Base Heat Loss
                            </div>
                            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                              {isSI ? \`\${calcResults.kwBase.toFixed(2)} kW\` : \`\${Math.round(calcResults.qBase).toLocaleString()} BTU/hr\`}
                            </div>
                            <div className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Steady-state loss</div>
                          </div>

                          {/* 3. Load Density */}
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              Load Density
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              {isSI
                                ? \`\${(calcResults.kwTotal * 1000 / (typeof area === 'number' ? area * SQFT_TO_SQM : 1)).toFixed(1)} W/m²\`
                                : \`\${(calcResults.qTotal / (typeof area === 'number' ? area : 1)).toFixed(1)} BTU/hr·ft²\`}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Normalized capacity</div>
                          </div>
                        </div>

                        {/* DETAILED METRICS TABLE */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            <span>Heat Loss Distribution Breakdown</span>
                            <span>Base Loss: {isSI ? calcResults.kwBase.toFixed(2) + " kW" : Math.round(calcResults.qBase) + " BTU/hr"}</span>
                          </div>
                          
                          {[
                            { label: "Opaque Walls", val: calcResults.qOpaque, kw: calcResults.kwOpaque, color: "bg-blue-500" },
                            { label: "Roof / Ceiling", val: calcResults.qRoof, kw: calcResults.kwRoof, color: "bg-emerald-500" },
                            { label: "Glazing / Windows", val: calcResults.qGlaz, kw: calcResults.kwGlaz, color: "bg-amber-500" },
                            { label: "Slab Perimeter", val: calcResults.qSlab, kw: calcResults.kwSlab, color: "bg-purple-500" },
                            { label: "Infiltration", val: calcResults.qInfil, kw: calcResults.kwInfil, color: "bg-pink-500" },
                            { label: "Fresh Air Vent", val: calcResults.qVent, kw: calcResults.kwVent, color: "bg-cyan-500" },
                          ].map((b, i) => {
                            const pct = calcResults.qBase > 0 ? (b.val / calcResults.qBase) * 100 : 0;
                            return (
                              <div key={i} className="flex flex-col gap-1.5 group">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                                    <div className={\`w-1.5 h-1.5 rounded-full \${b.color}\`} />
                                    {b.label}
                                  </span>
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    {isSI ? b.kw.toFixed(2) + " kW" : Math.round(b.val) + " BTU/hr"} <span className="text-slate-400 ml-1">({pct.toFixed(1)}%)</span>
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                  <div className={\`h-full \${b.color} transition-all duration-500\`} style={{ width: \`\${pct}%\` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>`;

content = content.substring(0, startIdx) + newGrid + content.substring(endIdx);
fs.writeFileSync(path, content);
console.log("Done");
