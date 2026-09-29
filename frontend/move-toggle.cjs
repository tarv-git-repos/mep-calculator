const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const headerTarget = `<div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Winter Heating Load</h1>
                </div>
                <CalculationReviewBar
                  projectId={activeProjectId}
                  calculatorPath="/heating-load"
                  calculatorTitle="Winter Heating Load"
                />
              </div>
            </div>`;

const toggleMatch = txt.match(/<UnitToggle[\s\S]*?\/>/);
const toggleBlock = toggleMatch ? toggleMatch[0] : '';

if(!toggleBlock) {
  console.error('UnitToggle not found');
  process.exit(1);
}

const headerReplacement = `<div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Winter Heating Load</h1>
                </div>
                <CalculationReviewBar
                  projectId={activeProjectId}
                  calculatorPath="/heating-load"
                  calculatorTitle="Winter Heating Load"
                />
              </div>
              <div className="flex items-center gap-2">
                ${toggleBlock}
              </div>
            </div>`;

txt = txt.replace(headerTarget, headerReplacement);

const actionSelectorTargetRegex = /<div className="flex items-center gap-2 select-none shrink-0">\s*<TBtn onClick=\{exportPdf\}>\s*<FileText className="size-3\.5" \/> Export\s*<\/TBtn>[\s\S]*?<UnitToggle[\s\S]*?\/>\s*<\/div>/;

const actionSelectorReplacement = `<div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={exportPdf}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                </div>`;

if(actionSelectorTargetRegex.test(txt)) {
    txt = txt.replace(actionSelectorTargetRegex, actionSelectorReplacement);
    fs.writeFileSync('src/routes/heating-load.tsx', txt);
    console.log('Success');
} else {
    console.log('Could not find the action selector target block to remove the original UnitToggle.');
    // Let's just do a manual replace of the toggle block after removing the original one if exact string matching fails
    txt = txt.replace(toggleBlock, ''); // First remove it from everywhere
    // Wait, since I already replaced headerReplacement, the toggleBlock is now in the string twice.
    // I should just replace the actionSelector block. Let's inspect it to see why it might fail.
}
