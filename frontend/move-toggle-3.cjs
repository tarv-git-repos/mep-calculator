const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const toggleMatch = txt.match(/<UnitToggle[\s\S]*?\/>/);
if(!toggleMatch) {
  console.error('UnitToggle not found');
  process.exit(1);
}
const toggleBlock = toggleMatch[0];

const actionContainerRegex = /<div className="flex items-center gap-2 select-none shrink-0">\s*<TBtn onClick=\{exportPdf\}>\s*<FileText className="size-3\.5" \/> Export\s*<\/TBtn>\s*\{\/\* Sizing Unit system toggle \*\/\}\s*<UnitToggle[\s\S]*?\/>\s*<\/div>/;

if (actionContainerRegex.test(txt)) {
    txt = txt.replace(actionContainerRegex, `<div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={exportPdf}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                </div>`);
} else {
    txt = txt.replace(toggleBlock, '');
}

const headerRegex = /<CalculationReviewBar[^>]*\/>\s*(\{commentsList\.length > 0 && \([\s\S]*?\}\s*\)\})?\s*<\/div>/;
const match = txt.match(headerRegex);

if (match) {
    const replacement = match[0] + `\n            <div className="flex items-center gap-2">\n              ` + toggleBlock + `\n            </div>`;
    txt = txt.replace(match[0], replacement);
    fs.writeFileSync('src/routes/heating-load.tsx', txt);
    console.log('Success');
} else {
    console.log('Header target not found!');
}
