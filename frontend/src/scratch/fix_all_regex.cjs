const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const rewriteCard = (cardId) => {
  let target = content;
  
  // 1. Find and replace the top wrapper
  const topRegex = new RegExp(`[ \\t]*<ContextMenu>\\s*<ContextMenuTrigger asChild>\\s*<div id="${cardId}"`);
  const match = target.match(topRegex);
  
  if (!match) {
    console.error('Failed to find top of ' + cardId);
    return target;
  }
  
  // We want to keep the `<div id="cardId"` part, but remove the ContextMenu wrappers
  // Actually, we can just replace the match with the indentation + `<div id="cardId"`
  const indentationMatch = match[0].match(/^[ \t]*/);
  const indentation = indentationMatch ? indentationMatch[0] : '';
  const newStart = `${indentation}<div id="${cardId}"`;
  
  target = target.replace(match[0], newStart);
  
  // 2. Add ContextMenu inside, right before the grid
  let gridStart = `<div className="grid grid-cols-2 gap-3 text-xs">`;
  let idxCard = target.indexOf(`<div id="${cardId}"`);
  let idxGrid = target.indexOf(gridStart, idxCard);
  
  let beforeGrid = target.substring(0, idxGrid);
  let afterGrid = target.substring(idxGrid + gridStart.length);
  
  target = beforeGrid + `<ContextMenu>\n                        <ContextMenuTrigger asChild>\n                          ` + gridStart + afterGrid;
  
  // 3. Move the card's closing </div> to the bottom
  // The grid is closed with </div>, then the card is closed with </div>, then </ContextMenuTrigger>
  let idxTriggerEnd = target.indexOf(`</ContextMenuTrigger>`, idxGrid);
  let idxMenuEnd = target.indexOf(`</ContextMenu>`, idxTriggerEnd) + `</ContextMenu>`.length;
  
  let textBeforeTriggerEnd = target.substring(0, idxTriggerEnd);
  let idxLastDiv = textBeforeTriggerEnd.lastIndexOf(`</div>`);
  
  let p1 = target.substring(0, idxLastDiv);
  let p2 = target.substring(idxLastDiv + `</div>`.length, idxMenuEnd);
  let p3 = target.substring(idxMenuEnd);
  
  target = p1 + p2 + `\n                      </div>` + p3;
  
  return target;
};

content = rewriteCard("card-flow");
content = rewriteCard("card-pit");
content = rewriteCard("card-piping");

// The useEffect fix was already applied in the last run (because it didn't fail), but wait, the last run saved the file!
// So let's check if it's already there before applying.
if (!content.includes("new URLSearchParams(window.location.search);") || !content.includes("mep-scroll-to-item")) {
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
}

fs.writeFileSync(filePath, content);
console.log('Cards successfully rewritten!');
