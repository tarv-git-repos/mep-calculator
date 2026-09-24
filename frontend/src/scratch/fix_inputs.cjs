const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const rewriteCard = (cardId, resetCode, commentTitle) => {
  // 1. Remove the outer wrappers
  const topRegex = new RegExp(`[ \\t]*<ContextMenu>\\s*<ContextMenuTrigger asChild>\\s*(<div id="${cardId}")`);
  const match = content.match(topRegex);
  if (!match) return;
  
  content = content.replace(match[0], match[1]); // Replace with just the <div id="...">
  
  // 2. Remove the closing wrappers
  const cardStartIdx = content.indexOf(`id="${cardId}"`);
  
  const triggerEndIdx = content.indexOf('</ContextMenuTrigger>', cardStartIdx);
  const menuEndIdx = content.indexOf('</ContextMenu>', triggerEndIdx) + '</ContextMenu>'.length;
  
  const beforeEnd = content.substring(0, triggerEndIdx);
  const afterEnd = content.substring(menuEndIdx);
  content = beforeEnd + afterEnd; // Now the outer ContextMenu is completely gone!
  
  // 3. Wrap every <input ... /> between cardStartIdx and the end of the card
  let cardBlock = content.substring(cardStartIdx, beforeEnd.length);
  
  const menuContentString = `
                              <ContextMenuContent className="w-64 font-sans">
                                <ContextMenuItem onClick={() => { ${resetCode}; dirtyStore.set(true); }} disabled={isEffectiveReadOnly} className="text-xs cursor-pointer">Reset ${commentTitle}</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleOpenComment("${cardId}", "${commentTitle}")} className="text-xs cursor-pointer text-primary flex items-center gap-2"><MessageSquare className="size-3.5" /> Add Comment / Task</ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>`;
                            
  // We will replace every `<input ... />` with `<ContextMenu><ContextMenuTrigger asChild><input ... /></ContextMenuTrigger>...menuContent...</ContextMenu>`
  cardBlock = cardBlock.replace(/(<input[\s\S]*?\/>)/g, (match) => {
    return `<ContextMenu>\n                              <ContextMenuTrigger asChild>\n                                ${match}\n                              </ContextMenuTrigger>${menuContentString}`;
  });
  
  // Put the modified cardBlock back
  content = content.substring(0, cardStartIdx) + cardBlock + content.substring(beforeEnd.length);
};

rewriteCard("card-flow", "setReq(isSI ? 1000 : 264); setTime(1)", "Flow Parameters");
rewriteCard("card-pit", "setPitFlow(5); setPitHold(5); setLongestPipe(15); setPropSide(2)", "Pit Sizing");
rewriteCard("card-piping", "setPipeVert(5); setPipeHoriz(20); setFricFactor(0.4); setStaticHead(5); setPresid(1); setSuction(0)", "Piping & Head");


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
content = content.replace("  const saveComments = (newList: any[]) => {", useEffectFixReplace + "\n\n  const saveComments = (newList: any[]) => {");

fs.writeFileSync(filePath, content);
console.log('Successfully wrapped inputs perfectly!');
