const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the timeout to 2000
content = content.replace("highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2500);", "highlightTimeoutRef.current = setTimeout(() => { setHighlightedTargetId(null); }, 2000);");

// Apply the useEffect fix for URL parsing
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


// Now process the cards and inputs!
// Wait! The git checkout reverted the file to a state where the cards STILL have the original `<ContextMenu>` wrapper around the whole card!
// Let's strip the outer ContextMenu wrapper first.
const removeOuterWrapper = (cardId) => {
  const topRegex = new RegExp(`[ \\t]*<ContextMenu>\\s*<ContextMenuTrigger asChild>\\s*(<div id="${cardId}")`);
  const match = content.match(topRegex);
  if (!match) return;
  content = content.replace(match[0], match[1]); // Replace with just the <div id="...">
  
  const cardStartIdx = content.indexOf(`id="${cardId}"`);
  const triggerEndIdx = content.indexOf('</ContextMenuTrigger>', cardStartIdx);
  const menuEndIdx = content.indexOf('</ContextMenu>', triggerEndIdx) + '</ContextMenu>'.length;
  
  const beforeEnd = content.substring(0, triggerEndIdx);
  const afterEnd = content.substring(menuEndIdx);
  content = beforeEnd + afterEnd; // Now the outer ContextMenu is completely gone!
};

removeOuterWrapper("card-flow");
removeOuterWrapper("card-pit");
removeOuterWrapper("card-piping");


// Now find every `<input ... />` and wrap it
const extractLabel = (content, inputIdx) => {
    const textBefore = content.substring(0, inputIdx);
    const labelMatch = textBefore.match(/<span>([^<]+)<\/span>\s*<span[^>]*>[^<]*<\/span>\s*<\/label>\s*$/);
    if (labelMatch) return labelMatch[1];
    const labelMatch2 = textBefore.match(/<span>([^<]+)<\/span>\s*<\/label>\s*$/);
    if (labelMatch2) return labelMatch2[1];
    return "Parameter";
};

const processInputsInCard = (cardId, resetCode, baseTitle) => {
  const cardStartIdx = content.indexOf(`id="${cardId}"`);
  const endMatch = content.substring(cardStartIdx).match(/<\/div>\s*<\/div>\s*(<(div id="card-|div className="mt-8)|$)/);
  if (!endMatch) return;
  
  const blockEnd = cardStartIdx + endMatch.index;
  let cardBlock = content.substring(cardStartIdx, blockEnd);
  
  // Replace inputs
  cardBlock = cardBlock.replace(/(<input[\s\S]*?\/>)/g, (match, p1, offset) => {
    const setterMatch = match.match(/set([A-Z][a-zA-Z0-9_]*)\(/);
    let setterName = setterMatch ? setterMatch[1].toLowerCase() : Math.random().toString(36).substring(7);
    const uniqueId = `${cardId}-${setterName}`;
    const labelName = extractLabel(cardBlock, offset);
    const newTitle = `${baseTitle} - ${labelName}`;
    
    let newInputTag = match.replace(`className={inputClass}`, `id="${uniqueId}" className={\`\${inputClass} \${isFieldHighlighted("${uniqueId}") ? "ring-4 ring-sky-400 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400 field-highlight-pulse item-highlight-pulse" : ""}\`}`);
    
    const menuContentString = `
                              <ContextMenuContent className="w-64 font-sans">
                                <ContextMenuItem onClick={() => { ${resetCode}; dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset ${baseTitle}</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleOpenComment("${uniqueId}", "${newTitle}")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>`;
                            
    return `<ContextMenu>\n                              <ContextMenuTrigger asChild>\n                                ${newInputTag}\n                              </ContextMenuTrigger>${menuContentString}`;
  });
  
  content = content.substring(0, cardStartIdx) + cardBlock + content.substring(blockEnd);
};

processInputsInCard("card-flow", "setReq(isSI ? 1000 : 264); setTime(1)", "Flow Parameters");
processInputsInCard("card-pit", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)", "Pit Sizing");
processInputsInCard("card-piping", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)", "Piping & Head");

fs.writeFileSync(filePath, content);
console.log('Successfully wrapped and highlighted inputs precisely!');
