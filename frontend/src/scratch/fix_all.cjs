const fs = require('fs');
const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const rewriteCard = (cardId, commentTitle) => {
  // We want to replace:
  // <ContextMenu>\n                    <ContextMenuTrigger asChild>\n                      <div id="card-..."
  // with:
  // <div id="card-..."
  
  // Actually, we can use a simpler approach.
  
  let target = content;
  
  // 1. Remove the outer wrappers
  let topTarget = `<ContextMenu>\n                    <ContextMenuTrigger asChild>\n                      <div id="${cardId}"`;
  if (!target.includes(topTarget)) {
    console.error('Failed to find top of ' + cardId);
    return target;
  }
  target = target.replace(topTarget, `<div id="${cardId}"`);
  
  // 2. Add ContextMenu inside, right before the grid
  let gridStart = `<div className="grid grid-cols-2 gap-3 text-xs">`;
  let idxCard = target.indexOf(`<div id="${cardId}"`);
  let idxGrid = target.indexOf(gridStart, idxCard);
  
  let beforeGrid = target.substring(0, idxGrid);
  let afterGrid = target.substring(idxGrid + gridStart.length);
  
  target = beforeGrid + `<ContextMenu>\n                        <ContextMenuTrigger asChild>\n                          ` + gridStart + afterGrid;
  
  // 3. The grid originally closes with `</div>`
  // After the grid's `</div>`, it used to have:
  //                     </div>
  //                   </ContextMenuTrigger>
  //                   <ContextMenuContent
  //
  // Let's find `</ContextMenuTrigger>` after idxGrid.
  let idxTriggerEnd = target.indexOf(`</ContextMenuTrigger>`, idxGrid);
  
  // We need to replace the section from the grid's closing `</div>` to `</ContextMenuTrigger>`
  // with `</ContextMenuTrigger>` so that the card's `</div>` stays below `</ContextMenu>`.
  
  // Actually, the original structure at the bottom was:
  //                           </div>  <-- closes last input row
  //                         </div> <-- closes grid
  //                       </div> <-- closes card
  //                     </ContextMenuTrigger>
  //                     <ContextMenuContent...
  //
  // We want to move the `</div>` that closes the card, to the very bottom, AFTER `</ContextMenu>`.
  // Wait, no. The grid is closed. Then `</ContextMenuTrigger>` should happen. Then `<ContextMenuContent>`. Then `</ContextMenu>`. Then the card is closed.
  
  // Let's find the `</ContextMenu>` tag for this card.
  let idxMenuEnd = target.indexOf(`</ContextMenu>`, idxTriggerEnd) + `</ContextMenu>`.length;
  
  // So the block we want to shift is the card's `</div>` which is currently immediately before `</ContextMenuTrigger>`.
  // Let's find the `</div>` before `</ContextMenuTrigger>`.
  let textBeforeTriggerEnd = target.substring(0, idxTriggerEnd);
  let idxLastDiv = textBeforeTriggerEnd.lastIndexOf(`</div>`);
  
  // Remove that `</div>` from there.
  let p1 = target.substring(0, idxLastDiv);
  let p2 = target.substring(idxLastDiv + `</div>`.length, idxMenuEnd);
  let p3 = target.substring(idxMenuEnd);
  
  // Re-insert it after `</ContextMenu>`
  target = p1 + p2 + `\n                      </div>` + p3;
  
  return target;
};

content = rewriteCard("card-flow", "Flow Parameters");
content = rewriteCard("card-pit", "Pit Sizing");
content = rewriteCard("card-piping", "Piping & Head");

// ALSO apply the useEffect fix directly in this script!
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
console.log('Fixed flawlessly!');
