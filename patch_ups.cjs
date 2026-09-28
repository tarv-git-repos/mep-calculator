const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'frontend', 'src', 'routes', 'ups-sizing-calculation.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. setLoadRows with array
c = c.replace(
  /setLoadRows\(\(prev\)\s*=>\s*prev\.map\(\(r\)\s*=>\s*\(\{([\s\S]*?)\}\)\)\);/,
  'setLoadRows(loadRows.map((r) => ({$1})));'
);

// 2. handleOpenComment
if (!c.includes('const handleOpenComment')) {
  const insertBefore = '  const handleSaveComment = (newComment: any) => {';
  const openCommentFunc = `  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };\n\n`;
  c = c.replace(insertBefore, openCommentFunc + insertBefore);
}

// 3. endUser
c = c.replace(/project\?\.endUser/g, '(project as any)?.endUser');

// 4. ImportExcelBtn customTrigger
c = c.replace(
  /<ImportExcelBtn\s*customTrigger=\{([\s\S]*?)\}\s*columnMapping=\{([\s\S]*?)\}\s*onImport=\{([\s\S]*?)\}\s*\/>/,
  '<ImportExcelBtn columnMapping={$2} onImport={$3}>\n$1\n</ImportExcelBtn>'
);

fs.writeFileSync(p, c, 'utf8');
console.log('ups-sizing-calculation.tsx patched successfully');
