const fs = require('fs');

const filePath = 'Z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const rewriteCard = (content, cardId) => {
  const contextMenuStartRegex = new RegExp(`(<ContextMenu>\\s*<ContextMenuTrigger asChild>\\s*)<div id="${cardId}"([\\s\\S]*?<div className="grid grid-cols-2 gap-3 text-xs">)`);
  
  const match = content.match(contextMenuStartRegex);
  if (match) {
    const fullMatch = match[0];
    const prefix = match[1]; // <ContextMenu>\n<ContextMenuTrigger asChild>\n
    const divAndHeader = match[2]; // <div id="card-..."...><div...Header...</div><div className="grid...">
    
    let newFullMatch = `<div id="${cardId}"${divAndHeader}`;
    // Replace the opening grid div with ContextMenu + Trigger + Grid div
    newFullMatch = newFullMatch.replace(
      '<div className="grid grid-cols-2 gap-3 text-xs">',
      '<ContextMenu>\n                      <ContextMenuTrigger asChild>\n                        <div className="grid grid-cols-2 gap-3 text-xs">'
    );
    
    content = content.replace(fullMatch, newFullMatch);
    
    // Now we need to move the closing </ContextMenuTrigger> to close the grid, not the whole card.
    // The previous structure was:
    // </div> (end of grid)
    // </ContextMenuTrigger>
    // <ContextMenuContent...
    
    // Wait, let's look at what follows the grid.
    // In card-flow, grid is closed with </div>, then </ContextMenuTrigger>.
    // Since we just shifted the ContextMenu inside, the closing tags `</ContextMenuTrigger>\n<ContextMenuContent...>\n</ContextMenu>` are actually in the right place because they come right after the `</div>` that closes the grid!
    // But we need to add a `</div>` to close the main card `div id="card-..."` at the very end.
    
    const contextMenuEndRegex = new RegExp(`(</ContextMenuContent>\\s*</ContextMenu>)`);
    // This is dangerous if we have multiple, but we can search for the first one after our replaced chunk
    
    let startIndex = content.indexOf(`id="${cardId}"`);
    let endIdx = content.indexOf(`</ContextMenu>`, startIndex) + `</ContextMenu>`.length;
    
    let before = content.substring(0, endIdx);
    let after = content.substring(endIdx);
    
    content = before + '\n                      </div>' + after;
  }
  return content;
};

content = rewriteCard(content, 'card-flow');
content = rewriteCard(content, 'card-pit');
content = rewriteCard(content, 'card-piping');

fs.writeFileSync(filePath, content);
console.log('Cards successfully rewritten!');
