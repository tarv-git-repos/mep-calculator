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

const injectionPoint = `              )}
            </div>
          </div>`;
const replacementPoint = `              )}
            </div>
            <div className="flex items-center gap-2">
              ${toggleBlock}
            </div>
          </div>`;

if(txt.includes(injectionPoint)) {
    txt = txt.replace(injectionPoint, replacementPoint);
    fs.writeFileSync('src/routes/heating-load.tsx', txt);
    console.log('Success');
} else {
    console.log('Injection point not found!');
}
