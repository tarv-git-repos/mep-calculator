const fs = require('fs');

const path = 'z:\\00 R&D Server\\04 MISC\\Vikrams  MEP CALCULATOR UPDATED\\vikram_updated_calc\\New Ui MEP\\MEP_Calculator_Project\\frontend\\src\\routes\\fresh-air-cooling-load.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnStart = content.indexOf('  return (\n    <AppShell');
if (returnStart === -1) {
  console.error("Could not find start of return");
  process.exit(1);
}

// Find the last `);` before the end of the file/function.
const returnEnd = content.lastIndexOf('  );\n}');
if (returnEnd === -1) {
  console.error("Could not find end of return");
  process.exit(1);
}

const before = content.slice(0, returnStart);
const after = '\n}\n';

const newJSX = `  const inputClass = "w-full h-8 px-2 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="Fresh Air Cooling Load"
      hideSubHeader={true}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Reference exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fresh Air Cooling Load</h1>
              </div>
              <CalculationReviewBar
                projectId={activeProjectId}
                calculatorPath="/fresh-air-cooling-load"
                calculatorTitle="Fresh Air Cooling Load"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle 
                unitSystem={unitSystem} 
                onChange={handleUnitSystemChange} 
                inputDescriptions="Entering/Leaving DB, WB, and Airflow" 
                conversionExample={unitSystem === "si" ? "Convert 35°C → 95°F, 0.47 m³/s → 1,000 CFM" : "Convert 95°F → 35°C, 1000 CFM → 0.47 m³/s"} 
              />
            </div>
          </div>

          {/* White / Dark Card container for Parameters & Results Grid */}
          <div className={\`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 \${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}\`}>

            {/* Action Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                <TBtn
                  onClick={() => setShowFormulaPanel(v => !v)}
                  title="View Step-by-Step Formula Breakdown"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <TBtn><Bookmark className="size-3.5 text-orange-500" /> Load Climate Preset <ChevronDown className="size-3.5" /></TBtn>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuItem onClick={() => applyPreset("gulf_summer")}>Gulf Summer (Extreme)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset("desert_peak")}>Desert Peak (Dry/Hot)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset("subtropical")}>Sub-tropical (Humid)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset("moderate")}>Moderate (Standard)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <TBtn title="Export Calculations"><Download className="size-3.5" /> Export <ChevronDown className="size-3.5" /></TBtn>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 font-sans">
                    <DropdownMenuItem onClick={handlePrintPDF}><FileText className="size-3.5 mr-2 text-red-500" /> Export to PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet className="size-3.5 mr-2 text-emerald-500" /> Export to Excel</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportJSON}><Download className="size-3.5 mr-2 text-blue-500" /> Export JSON Data</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Sizing Parameters Grid and Results */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              
              {showFormulaPanel && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-xs flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                    <span className="font-bold text-primary flex items-center gap-1.5">
                      <Activity className="size-4" />
                      Engineering Psychrometric Calculation Principles
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormulaPanel(false)}
                      className="text-muted-foreground hover:text-foreground text-[11px] font-bold"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-muted-foreground leading-relaxed">
                    <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                      <strong className="text-foreground block mb-1">1. Sensible Heat Load:</strong>
                      <code className="text-[11px] text-primary font-mono block">Q_sens = ṁ · c_p · (DB_in - DB_out)</code>
                      <span>Direct temperature drop of incoming outdoor air mass.</span>
                    </div>
                    <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                      <strong className="text-foreground block mb-1">2. Latent Heat Load:</strong>
                      <code className="text-[11px] text-primary font-mono block">Q_lat = ṁ · (W_in - W_out) · h_fg</code>
                      <span>Moisture extraction via coil condensation using humidity ratio \\(W\\).</span>
                    </div>
                    <div className="p-2.5 bg-background/60 rounded-xl border border-border/50">
                      <strong className="text-foreground block mb-1">3. Coil Capacity (TR):</strong>
                      <code className="text-[11px] text-primary font-mono block">Capacity (TR) = Q_total (kW) / 3.51685</code>
                      <span>Total cooling duty with user safety margin.</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        📥 Sizing Parameters
                      </span>
                    </div>

                    {/* ENTERING AIR PARAMS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-entering-air" 
                          data-field-id="card-entering-air" 
                          data-comment-target="card-entering-air"
                          className={\`p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-entering-air", "Entering Coil Air")}\`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Entering Coil Air (OA)
                              </span>
                              {renderCommentBadge("card-entering-air", "Entering Coil Air")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              RH: <strong className="text-primary font-mono">{calc.rhIn.toFixed(1)}%</strong> | W: <strong className="text-primary font-mono">{calc.wIn.toFixed(ip ? 2 : 5)} {uW}</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Dry Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={dbIn}
                                onChange={(e) => setDbIn(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={wbIn}
                                onChange={(e) => setWbIn(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setDbIn(ip ? 95 : 35); setWbIn(ip ? 78 : 25.5); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Entering Air
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-entering-air", "Entering Coil Air")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* LEAVING AIR PARAMS */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-leaving-air" 
                          data-field-id="card-leaving-air" 
                          data-comment-target="card-leaving-air"
                          className={\`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-leaving-air", "Leaving Coil Air")}\`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Leaving Coil Air (SA)
                              </span>
                              {renderCommentBadge("card-leaving-air", "Leaving Coil Air")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              RH: <strong className="text-primary font-mono">{calc.rhOut.toFixed(1)}%</strong> | W: <strong className="text-primary font-mono">{calc.wOut.toFixed(ip ? 2 : 5)} {uW}</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Dry Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={dbOut}
                                onChange={(e) => setDbOut(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Wet Bulb ({uT})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={wbOut}
                                onChange={(e) => setWbOut(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setDbOut(ip ? 55 : 12.8); setWbOut(ip ? 54 : 12.2); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Leaving Air
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-leaving-air", "Leaving Coil Air")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* AIRFLOW AND SAFETY */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div 
                          id="field-card-airflow" 
                          data-field-id="card-airflow" 
                          data-comment-target="card-airflow"
                          className={\`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3 p-2 -m-2 rounded-lg transition-colors \${isFieldHighlighted("card-airflow", "Airflow & Safety")}\`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Flow &amp; Safety
                              </span>
                              {renderCommentBadge("card-airflow", "Airflow & Safety Factor")}
                            </div>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Mass Flow: <strong className="text-foreground font-mono">{calc.mDot.toFixed(2)} kg/s</strong>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <label className="text-[11px] text-slate-500">Airflow Rate ({ip ? "CFM" : "m³/s"})</label>
                              <input
                                type="number" step="any"
                                disabled={isEffectiveReadOnly}
                                value={flowRate}
                                onChange={(e) => setFlowRate(e.target.value === "" ? "" : Number(e.target.value))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500">Safety Margin (%)</label>
                              <input
                                type="number" step="1" min="0" max="30"
                                disabled={isEffectiveReadOnly}
                                value={safetyFactor}
                                onChange={(e) => setSafetyFactor(Number(e.target.value) || 0)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem disabled={isEffectiveReadOnly} onClick={() => { setFlowRate(ip ? 1000 : 0.472); setSafetyFactor(5); dirtyStore.set(true); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
                          <RefreshCw className="size-3.5 text-muted-foreground" /> Reset Flow
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("card-airflow", "Airflow & Safety Factor")} className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                          <MessageSquare className="size-3.5" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>
                </div>

                {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7) */}
                <div className="lg:col-span-7 space-y-5">
                  
                  {/* Warnings */}
                  {warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-300 rounded-xl p-3.5 flex flex-col gap-1.5 text-xs select-none">
                      {warnings.map((w, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PRIMARY RESULTS CARD */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div 
                        id="card-hero-results" 
                        data-field-id="card-hero-results" 
                        data-comment-target="card-hero-results"
                        className={\`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-colors \${isFieldHighlighted("card-hero-results", "Sizing Results Summary")}\`}
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                          <div className="flex items-center">
                            <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                              ⚡ Cooling Coil Duty Results
                            </span>
                            {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            +{safetyFactor}% Margin Applied
                          </span>
                        </div>

                        {/* DISPLAY STAT CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Sensible Load</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calc.sensKw.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kW</span>
                            </div>
                          </div>

                          <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Latent Load</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calc.latKw.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kW</span>
                            </div>
                          </div>

                          <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">SHR</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calc.shr.toFixed(2)}
                            </div>
                          </div>

                          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5">
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Condensate</div>
                            <div className="text-xl font-bold font-mono text-foreground mt-1">
                              {calc.condensateKgH.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">L/h</span>
                            </div>
                          </div>
                        </div>

                        {/* DETAILED METRICS TABLE */}
                        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Sensible Heat Load:</span>
                            <span className="font-mono font-bold">{calc.sensLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Latent Heat Load:</span>
                            <span className="font-mono font-bold">{calc.latLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                            <span className="text-slate-600 dark:text-zinc-400">Total Coil Duty Load (Q_tot):</span>
                            <span className="font-mono font-bold">{calc.totLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} {uL} ({calc.totKw.toFixed(1)} kW)</span>
                          </div>
                          <div className="flex justify-between py-1 font-bold text-foreground">
                            <span>Required Cooling Capacity (Tons):</span>
                            <span className="font-mono text-[#0A7BC7] text-sm">{calc.capacityTons.toFixed(2)} TR</span>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment / Assign Task</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AssignCommentModal
        isOpen={commentModalOpen}
        onClose={() => setCommentModalOpen(false)}
        targetId={commentTargetItem?.id || ""}
        targetName={commentTargetItem?.name || ""}
        onSave={(c) => {
          const tId = commentTargetItem?.id || c?.targetId;
          const tName = commentTargetItem?.name || c?.targetName;
          const newC = { ...c, targetId: tId, targetName: tName, spaceId: tId, spaceName: tName, itemId: tId, targetType: "Fresh Air Cooling Load" };
          const u = [newC, ...commentsList];
          saveComments(u);
          notifyCommentAssigned({ ...newC, url: \`/fresh-air-cooling-load?targetId=\${tId}&targetName=\${encodeURIComponent(tName)}\` });
          setCommentModalOpen(false);
          toast.success("Comment assigned.");
        }}
        currentUserId={userData?.id || "user-1"}
        currentUserName={currentUserName}
      />
    </AppShell>
  );`;

fs.writeFileSync(path, before + newJSX + after);
console.log("Successfully replaced JSX!");
