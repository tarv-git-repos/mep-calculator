const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const toggleMatch = txt.match(/<UnitToggle[\s\S]*?\/>/);
if(!toggleMatch) process.exit(1);
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

const targetStr = '<span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"}</span>';
const idx = txt.indexOf(targetStr);
const div1 = txt.indexOf('</div>', idx) + 6;
const div2 = txt.indexOf('</div>', div1) + 6;

const part1 = txt.substring(0, div2);
const part2 = txt.substring(div2);

txt = part1 + `\n            <div className="flex items-center gap-2">\n              ` + toggleBlock + `\n            </div>` + part2;

fs.writeFileSync('src/routes/heating-load.tsx', txt);
console.log('Success');
