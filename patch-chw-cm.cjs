const fs = require('fs');

const tsxPath = 'frontend/src/routes/chw-pipe-sizer.tsx';
let tsx = fs.readFileSync(tsxPath, 'utf8');

const targetOpen = '<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">';
const targetClose = '</div>\n\n{/* Collapsible Intelligence Drawer */}';

if (tsx.includes(targetOpen) && tsx.includes(targetClose)) {
  const replacementOpen = `<ContextMenu>
<ContextMenuTrigger asChild>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start cursor-context-menu" onDoubleClick={() => setFormulaModalOpen(true)}>`;
  
  const replacementClose = `</div>
</ContextMenuTrigger>
<ContextMenuContent className="w-56 no-print">
  <ContextMenuItem onClick={() => setIntelOpen(true)}>
    <Sparkles className="mr-2 size-4" />
    Intelligence AI
  </ContextMenuItem>
  <ContextMenuItem onClick={() => setFormulaModalOpen(true)}>
    <Info className="mr-2 size-4" />
    Formula Breakdown
  </ContextMenuItem>
  <ContextMenuItem onClick={() => setScheduleModalOpen(true)}>
    <FileSpreadsheet className="mr-2 size-4" />
    Piping Schedule Details
  </ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuItem onClick={() => {
      if (!isApprovedLocked) {
        saveParams({
          flowRate: unitSystem === "si" ? "5.0" : "80",
          fluidType: "chw",
          temperature: unitSystem === "si" ? "6.7" : "44",
          pipeMaterial: "steel",
          targetDp: unitSystem === "si" ? "40" : "4.0"
        }, unitSystem);
      }
    }}
    disabled={isApprovedLocked}
  >
    <RotateCcw className="mr-2 size-4 text-red-500" />
    Reset Values
  </ContextMenuItem>
</ContextMenuContent>
</ContextMenu>\n\n{/* Collapsible Intelligence Drawer */}`;

  tsx = tsx.replace(targetOpen, replacementOpen);
  tsx = tsx.replace(targetClose, replacementClose);

  fs.writeFileSync(tsxPath, tsx);
  console.log('Successfully injected ContextMenu');
} else {
  console.log('Failed to find targets for ContextMenu injection');
}
