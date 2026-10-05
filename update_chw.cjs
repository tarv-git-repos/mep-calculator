const fs = require('fs');
const p = 'frontend/src/routes/chw-pipe-sizer.tsx';
let lines = fs.readFileSync(p, 'utf8').split('\n');

const handleReset = `  const handleReset = () => {
    saveParams({
      flowRate: '10',
      fluidType: 'chw',
      temperature: isSI ? '6.7' : '44',
      pipeMaterial: 'steel',
      targetDp: isSI ? '250' : '2.5'
    }, unitSystem);
  };`;

const matchTab = lines.findIndex(l => l.includes('const [activeTab, setActiveTab]'));
if (matchTab !== -1) {
  lines.splice(matchTab + 1, 0, handleReset);
}

const matchResult = lines.findIndex(l => l.includes('<div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">'));
if (matchResult !== -1) {
  lines[matchResult] = `                  <div 
                    onDoubleClick={() => setFormulaModalOpen(true)}
                    title="Double-click to view detailed calculations"
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 cursor-pointer hover:border-primary/40 transition-colors"
                  >`;
}

const matchGrid = lines.findIndex(l => l.includes('<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">'));
if (matchGrid !== -1) {
  lines.splice(matchGrid, 1, 
    '              <ContextMenu>',
    '                <ContextMenuTrigger>',
    '                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">'
  );
  
  let depth = 1;
  let endGrid = -1;
  for (let i = matchGrid + 3; i < lines.length; i++) {
    if (lines[i].includes('<div')) depth++;
    if (lines[i].includes('</div')) depth--;
    if (depth === 0) {
      endGrid = i;
      break;
    }
  }
  
  if (endGrid !== -1) {
    lines.splice(endGrid + 1, 0,
      '                </ContextMenuTrigger>',
      '                <ContextMenuContent className="w-48">',
      '                  <ContextMenuItem onClick={() => handleReset()}>',
      '                    <RefreshCw className="size-4 mr-2" /> Reset to Defaults',
      '                  </ContextMenuItem>',
      '                  <ContextMenuSeparator />',
      '                  <ContextMenuItem onClick={() => setFormulaModalOpen(true)}>',
      '                    <Info className="size-4 mr-2" /> View Detailed Calcs',
      '                  </ContextMenuItem>',
      '                </ContextMenuContent>',
      '              </ContextMenu>'
    );
  }
}

// Add RefreshCw icon if it's missing
const luMatch = lines.findIndex(l => l.includes('import {') && l.includes('lucide-react'));
if (luMatch !== -1) {
  if (!lines[luMatch].includes('RefreshCw')) {
    lines[luMatch] = lines[luMatch].replace('}', ', RefreshCw }');
  }
}

fs.writeFileSync(p, lines.join('\n'));
console.log('Done modifying chw-pipe-sizer.tsx');
