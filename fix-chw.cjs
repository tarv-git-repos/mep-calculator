const fs = require('fs');
const tsxPath = 'frontend/src/routes/chw-pipe-sizer.tsx';
let lines = fs.readFileSync(tsxPath, 'utf8').split('\n');

const badStart = lines.findIndex((l, i) => l.includes('</div>') && lines[i+1]?.includes('</ContextMenuTrigger>'));
if (badStart !== -1) {
  lines.splice(badStart, 36);
  console.log('Removed bad block');
}

const insertPos = lines.findIndex(l => l.includes(')}'));
if (insertPos !== -1) {
  const endBlock = `        </div>
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
                flowRate: unitSystem === "si" ? 5.0 : 80,
                fluidType: "chw",
                temperature: unitSystem === "si" ? 6.7 : 44,
                pipeMaterial: "steel",
                targetDp: unitSystem === "si" ? 40 : 4.0
              }, unitSystem);
            }
          }}
          disabled={isApprovedLocked}
        >
          <RotateCcw className="mr-2 size-4 text-red-500" />
          Reset Values
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>`;
  lines.splice(insertPos - 1, 0, endBlock);
  fs.writeFileSync(tsxPath, lines.join('\n'));
  console.log('Fixed ContextMenu location');
}
