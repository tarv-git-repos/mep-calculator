const fs = require('fs');

const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const fixCard = (cardId) => {
  // Find where the card starts
  const cardStartRegex = new RegExp(`[ \\t]*<ContextMenu>\\s*<ContextMenuTrigger asChild>\\s*<div id="${cardId}"`, 'g');
  const cardStartMatch = cardStartRegex.exec(content);
  
  if (cardStartMatch) {
    const startIdx = cardStartMatch.index;
    
    // Remove the ContextMenu wrappers from the start of the card
    content = content.replace(cardStartMatch[0], `<div id="${cardId}"`);
    
    // Find the inner grid div for this specific card
    const gridDiv = `<div className="grid grid-cols-2 gap-3 text-xs">`;
    const gridIdx = content.indexOf(gridDiv, startIdx);
    
    if (gridIdx !== -1) {
      // Wrap the grid in ContextMenu
      const wrappedGrid = `
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="grid grid-cols-2 gap-3 text-xs">`;
      content = content.substring(0, gridIdx) + wrappedGrid + content.substring(gridIdx + gridDiv.length);
      
      // Now find where the original ContextMenu Content ends.
      // We know there's a `</ContextMenuTrigger>` followed by `<ContextMenuContent>`
      
      const contentStartRegex = new RegExp(`</ContextMenuTrigger>\\s*<ContextMenuContent`, 'g');
      contentStartRegex.lastIndex = gridIdx;
      
      const contentMatch = contentStartRegex.exec(content);
      if (contentMatch) {
        // We need to move the `</ContextMenuTrigger>` BEFORE the closing `</div>` of the card.
        // Or wait, where is it currently? It's currently closing the card.
        // Actually, the grid is closed with `</div>`.
        // Then the card is closed with `</div>`.
        // Then we have `</ContextMenuTrigger>`.
        // We want to swap the order of the card's `</div>` and the `</ContextMenuTrigger>`.
        
        // Let's just find the `</ContextMenuTrigger>`
        const triggerEndIdx = contentMatch.index;
        
        // We want to remove `</ContextMenuTrigger>` from here and place it right before the card's `</div>`.
        // The card's `</div>` is the last `</div>` before `</ContextMenuTrigger>`.
        
        // Let's grab the text just before `</ContextMenuTrigger>`
        const previousDivRegex = /<\/div>\s*$/;
        const textBeforeTrigger = content.substring(0, triggerEndIdx);
        
        // Remove the `</ContextMenuTrigger>`
        const newTriggerString = `
                    </ContextMenuTrigger>
                    <ContextMenuContent`;
                    
        content = content.replace(contentMatch[0], newTriggerString);
        
        // BUT wait! The grid needs to be closed. Then the ContextMenu needs to be closed. Then the card needs to be closed.
        // It's much simpler. I will manually find the tags.
      }
    }
  }
};

// A much simpler and robust approach is string replacements based on exact context
let targetContent = content;

const replaceCard = (cardId) => {
  // 1. Remove from top
  const topFind = `<ContextMenu>\n                    <ContextMenuTrigger asChild>\n                      <div id="${cardId}"`;
  targetContent = targetContent.replace(topFind, `<div id="${cardId}"`);
  
  // 2. Add to inner grid
  const innerFind = `<div className="grid grid-cols-2 gap-3 text-xs">`;
  // We need to replace ONLY the first occurrence AFTER the cardId
  const cardIdx = targetContent.indexOf(`<div id="${cardId}"`);
  const gridIdx = targetContent.indexOf(innerFind, cardIdx);
  const beforeGrid = targetContent.substring(0, gridIdx);
  const afterGrid = targetContent.substring(gridIdx + innerFind.length);
  
  targetContent = beforeGrid + `<ContextMenu>\n                    <ContextMenuTrigger asChild>\n                      <div className="grid grid-cols-2 gap-3 text-xs">` + afterGrid;
  
  // 3. Move ContextMenu end blocks inside the card div
  // The current end block is:
  //                    </div>
  //                  </ContextMenuTrigger>
  //                  <ContextMenuContent className="w-64 font-sans">
  
  // I can just find `</ContextMenuTrigger>` after `cardIdx` and swap it with the `</div>` above it!
  const triggerIdx = targetContent.indexOf(`</ContextMenuTrigger>`, cardIdx);
  // Find the `</div>` right before `</ContextMenuTrigger>`
  const textBefore = targetContent.substring(0, triggerIdx);
  const lastDivIdx = textBefore.lastIndexOf(`</div>`);
  
  // Cut the `</div>` out and move it AFTER `</ContextMenu>`
  const contextMenuEndIdx = targetContent.indexOf(`</ContextMenu>`, triggerIdx) + `</ContextMenu>`.length;
  
  const part1 = targetContent.substring(0, lastDivIdx);
  const part2 = targetContent.substring(lastDivIdx + 6, contextMenuEndIdx);
  const part3 = targetContent.substring(contextMenuEndIdx);
  
  targetContent = part1 + part2 + `\n                      </div>` + part3;
};

replaceCard("card-flow");
replaceCard("card-pit");
replaceCard("card-piping");

fs.writeFileSync(filePath, targetContent);
console.log('Cards successfully rewritten manually!');
