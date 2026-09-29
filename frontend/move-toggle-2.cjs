const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const toggleMatch = txt.match(/<UnitToggle[\s\S]*?\/>/);
if(!toggleMatch) {
  console.error('UnitToggle not found');
  process.exit(1);
}
const toggleBlock = toggleMatch[0];

// First, find the exact block where it currently is, and replace it with just the Export button
const actionContainerRegex = /<div className="flex items-center gap-2 select-none shrink-0">\s*<TBtn onClick=\{exportPdf\}>\s*<FileText className="size-3\.5" \/> Export\s*<\/TBtn>\s*\{\/\* Sizing Unit system toggle \*\/\}\s*<UnitToggle[\s\S]*?\/>\s*<\/div>/;

if (actionContainerRegex.test(txt)) {
    txt = txt.replace(actionContainerRegex, `<div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={exportPdf}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                </div>`);
} else {
    // try to just remove the toggleBlock directly from the action container
    txt = txt.replace(toggleBlock, ''); 
}

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

if(txt.includes(headerTarget)) {
    txt = txt.replace(headerTarget, headerReplacement);
    fs.writeFileSync('src/routes/heating-load.tsx', txt);
    console.log('Success');
} else {
    console.log('Header target not found!');
}
