const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the old outer wrappers and highlight logic from card-flow, card-pit, and card-piping
content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-flow" className={\`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors \${isFieldHighlighted("card-flow") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}\`}>`, `                      <div id="card-flow" className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setReq(isSI ? 1000 : 264); setTime(1); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Default</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-flow", "Flow Parameters")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-pit" className={\`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors \${isFieldHighlighted("card-pit") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}\`}>`, `                      <div id="card-pit" className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Pit Sizing</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-pit", "Pit Sizing")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-piping" className={\`bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-colors \${isFieldHighlighted("card-piping") ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25" : ""}\`}>`, `                      <div id="card-piping" className="bg-card border border-border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs">`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Piping & Head</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-piping", "Piping & Head")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

// Apply URL timeout fix
const useEffectFixTarget = `    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("commentTargetId") || params.get("commentTargetName")) {
        setTimeout(() => handleScrollTarget(params.get("commentTargetId") || undefined, params.get("commentTargetName") || undefined), 300);
      }
    }`;
const useEffectFixReplace = `
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId");
    const targetName = params.get("commentTargetName");
    
    if (targetId || targetName) {
      const timer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("mep-scroll-to-item", {
            detail: { id: targetId, name: targetName },
          })
        );
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [typeof window !== 'undefined' ? window.location.search : '']);`;

content = content.replace(useEffectFixTarget, "");
if (!content.includes("mep-scroll-to-item\", {")) {
    content = content.replace("  const saveComments = (newList: any[]) => {", useEffectFixReplace + "\n\n  const saveComments = (newList: any[]) => {");
}
content = content.replace("highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 4500);", "highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2000);");
// also handle the 2500ms case if the previous step did modify it somehow
content = content.replace("highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);", "highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2000);");


// We create a helper to precisely replace the 13 inputs
const rewriteInputBlock = (searchBlock, id, label, unitLabel, resetAction, inputMatch) => {
    // searchBlock is the EXACT string from baseline
    const newBlock = `
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div id="${id}" className={\`flex flex-col gap-1.5 border border-border/50 rounded-lg p-2.5 bg-card transition-colors \${isFieldHighlighted("${id}") ? "ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-400 field-highlight-pulse item-highlight-pulse" : ""}\`}>
                                <label className="font-semibold text-foreground flex justify-between items-center">
                                  <span>${label.split(" - ")[1] || label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">${unitLabel}</span>
                                    {renderCommentBadge("${id}", "${label}")}
                                  </div>
                                </label>
                                ${inputMatch}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-64 font-sans">
                              <ContextMenuItem onClick={() => { ${resetAction}; dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset ${label.split(" - ")[0]}</ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => handleOpenComment("${id}", "${label}")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>`;
                          
    content = content.replace(searchBlock, newBlock.trim());
};

// FLOW PARAMETERS
rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Vol Req</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L" : "Gal"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? req : (typeof req === "number" ? req / GAL_TO_L : ""))} onChange={e => { const val = parseNum(e.target.value); setReq(val === "" ? "" : (isSI ? val : val * GAL_TO_L)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-flow-req", "Flow Parameters - Vol Req", "{isSI ? \"L\" : \"Gal\"}", "setReq(isSI ? 1000 : 264); setTime(1)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? req : (typeof req === "number" ? req / GAL_TO_L : ""))} onChange={e => { const val = parseNum(e.target.value); setReq(val === "" ? "" : (isSI ? val : val * GAL_TO_L)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Drawdown Time</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">Hrs</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(time)} onChange={e => { setTime(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-flow-time", "Flow Parameters - Drawdown Time", "Hrs", "setReq(isSI ? 1000 : 264); setTime(1)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(time)} onChange={e => { setTime(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Manual Flow</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L/s" : "GPM"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? flow : (typeof flow === "number" ? flow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-flow-manual", "Flow Parameters - Manual Flow", "{isSI ? \"L/s\" : \"GPM\"}", "setReq(isSI ? 1000 : 264); setTime(1)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? flow : (typeof flow === "number" ? flow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />`);

// PIT SIZING
rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Flow per Pit</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "L/s" : "GPM"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pitFlow : (typeof pitFlow === "number" ? pitFlow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setPitFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-pit-flow", "Pit Sizing - Flow per Pit", "{isSI ? \"L/s\" : \"GPM\"}", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pitFlow : (typeof pitFlow === "number" ? pitFlow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setPitFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Pit Holding Time</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">Mins</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(pitHold)} onChange={e => { setPitHold(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-pit-hold", "Pit Sizing - Pit Holding Time", "Mins", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(pitHold)} onChange={e => { setPitHold(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Longest Pipe Size</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? longestPipe : (typeof longestPipe === "number" ? longestPipe / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setLongestPipe(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-pit-longest", "Pit Sizing - Longest Pipe Size", "{isSI ? \"m\" : \"ft\"}", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? longestPipe : (typeof longestPipe === "number" ? longestPipe / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setLongestPipe(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Proposing Side</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? propSide : (typeof propSide === "number" ? propSide / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPropSide(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-pit-propside", "Pit Sizing - Proposing Side", "{isSI ? \"m\" : \"ft\"}", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? propSide : (typeof propSide === "number" ? propSide / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPropSide(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`);

// PIPING & HEAD
rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Vert Pipe</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeVert : (typeof pipeVert === "number" ? pipeVert / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeVert(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-vert", "Piping & Head - Vert Pipe", "{isSI ? \"m\" : \"ft\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeVert : (typeof pipeVert === "number" ? pipeVert / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeVert(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Horiz Pipe</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "m" : "ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeHoriz : (typeof pipeHoriz === "number" ? pipeHoriz / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeHoriz(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-horiz", "Piping & Head - Horiz Pipe", "{isSI ? \"m\" : \"ft\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeHoriz : (typeof pipeHoriz === "number" ? pipeHoriz / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeHoriz(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Friction Factor</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "kPa/m" : "psi/100ft"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? fricFactor : (typeof fricFactor === "number" ? (fricFactor / PSI_TO_BAR) * (FT_TO_M/100) * 100 : ""))} onChange={e => { const val = parseNum(e.target.value); setFricFactor(val === "" ? "" : (isSI ? val : (val * PSI_TO_BAR) / FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-fric", "Piping & Head - Friction Factor", "{isSI ? \"kPa/m\" : \"psi/100ft\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? fricFactor : (typeof fricFactor === "number" ? (fricFactor / PSI_TO_BAR) * (FT_TO_M/100) * 100 : ""))} onChange={e => { const val = parseNum(e.target.value); setFricFactor(val === "" ? "" : (isSI ? val : (val * PSI_TO_BAR) / FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Static Head</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "Bar" : "PSI"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? staticHead : (typeof staticHead === "number" ? staticHead / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setStaticHead(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-static", "Piping & Head - Static Head", "{isSI ? \"Bar\" : \"PSI\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? staticHead : (typeof staticHead === "number" ? staticHead / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setStaticHead(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Residual Head</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "Bar" : "PSI"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? presid : (typeof presid === "number" ? presid / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setPresid(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-presid", "Piping & Head - Residual Head", "{isSI ? \"Bar\" : \"PSI\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? presid : (typeof presid === "number" ? presid / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setPresid(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`);

rewriteInputBlock(
`<div className="flex flex-col gap-1.5">
                            <label className="font-semibold text-foreground flex justify-between">
                              <span>Suction Head</span>
                              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">{isSI ? "Bar" : "PSI"}</span>
                            </label>
                            <input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? suction : (typeof suction === "number" ? suction / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setSuction(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />
                          </div>`,
"card-piping-suction", "Piping & Head - Suction Head", "{isSI ? \"Bar\" : \"PSI\"}", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)",
`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? suction : (typeof suction === "number" ? suction / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setSuction(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`);

fs.writeFileSync(filePath, content);
console.log("File beautifully updated to replicate the modern ventilation card wrappers.");
