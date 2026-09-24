const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Apply useEffect fix and 2000ms fix
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
content = content.replace("highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);", "highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2000);");

// 2. Remove the outer wrappers from card-flow
content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-flow"`, `                      <div id="card-flow"`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setReq(isSI ? 1000 : 264); setTime(1); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Default</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-flow", "Flow Parameters")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

// Remove the outer wrappers from card-pit
content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-pit"`, `                      <div id="card-pit"`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Pit Sizing</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-pit", "Pit Sizing")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

// Remove the outer wrappers from card-piping
content = content.replace(`                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div id="card-piping"`, `                      <div id="card-piping"`);
content = content.replace(`                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-64 font-sans">
                      <ContextMenuItem onClick={() => { setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0); dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset Piping & Head</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => handleOpenComment("card-piping", "Piping & Head")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>`, ``);

// Now, precisely replace each input with its wrapped equivalent!
const wrapInput = (searchStr, id, label, resetAction) => {
    // Make sure we only replace the first matching input, just in case (though they are unique)
    const highlightLogic = `id="${id}" className={\`\${inputClass} \${isFieldHighlighted("${id}") ? "ring-4 ring-sky-400 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400 field-highlight-pulse item-highlight-pulse" : ""}\`}`;
    const wrappedStr = `
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                ${searchStr.replace("className={inputClass}", highlightLogic)}
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-64 font-sans">
                                <ContextMenuItem onClick={() => { ${resetAction}; dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset ${label.split(" - ")[0]}</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleOpenComment("${id}", "${label}")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>`;
    content = content.replace(searchStr, wrappedStr.trim());
};

// FLOW PARAMETERS
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? req : (typeof req === "number" ? req / GAL_TO_L : ""))} onChange={e => { const val = parseNum(e.target.value); setReq(val === "" ? "" : (isSI ? val : val * GAL_TO_L)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-flow-req", "Flow Parameters - Vol Req", "setReq(isSI ? 1000 : 264); setTime(1)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(time)} onChange={e => { setTime(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-flow-time", "Flow Parameters - Drawdown Time", "setReq(isSI ? 1000 : 264); setTime(1)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? flow : (typeof flow === "number" ? flow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-flow-manual", "Flow Parameters - Manual Flow", "setReq(isSI ? 1000 : 264); setTime(1)");

// PIT SIZING
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pitFlow : (typeof pitFlow === "number" ? pitFlow / GPM_TO_LPS : ""))} onChange={e => { const val = parseNum(e.target.value); setPitFlow(val === "" ? "" : (isSI ? val : val * GPM_TO_LPS)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-pit-flow", "Pit Sizing - Flow per Pit", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(pitHold)} onChange={e => { setPitHold(parseNum(e.target.value)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-pit-hold", "Pit Sizing - Pit Holding Time", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? longestPipe : (typeof longestPipe === "number" ? longestPipe / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setLongestPipe(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-pit-longest", "Pit Sizing - Longest Pipe Size", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? propSide : (typeof propSide === "number" ? propSide / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPropSide(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-pit-propside", "Pit Sizing - Proposing Side", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)");

// PIPING & HEAD
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeVert : (typeof pipeVert === "number" ? pipeVert / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeVert(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-vert", "Piping & Head - Vert Pipe", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? pipeHoriz : (typeof pipeHoriz === "number" ? pipeHoriz / FT_TO_M : ""))} onChange={e => { const val = parseNum(e.target.value); setPipeHoriz(val === "" ? "" : (isSI ? val : val * FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-horiz", "Piping & Head - Horiz Pipe", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? fricFactor : (typeof fricFactor === "number" ? (fricFactor / PSI_TO_BAR) * (FT_TO_M/100) * 100 : ""))} onChange={e => { const val = parseNum(e.target.value); setFricFactor(val === "" ? "" : (isSI ? val : (val * PSI_TO_BAR) / FT_TO_M)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-fric", "Piping & Head - Friction Factor", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? staticHead : (typeof staticHead === "number" ? staticHead / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setStaticHead(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-static", "Piping & Head - Static Head", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? presid : (typeof presid === "number" ? presid / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setPresid(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-presid", "Piping & Head - Residual Head", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");
wrapInput(`<input type="number" disabled={isEffectiveReadOnly} value={valOrEmpty(isSI ? suction : (typeof suction === "number" ? suction / PSI_TO_BAR : ""))} onChange={e => { const val = parseNum(e.target.value); setSuction(val === "" ? "" : (isSI ? val : val * PSI_TO_BAR)); dirtyStore.set(true); }} className={inputClass} />`,
    "card-piping-suction", "Piping & Head - Suction Head", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)");

fs.writeFileSync(filePath, content);
console.log("File flawlessly updated using explicit literal replacement.");
