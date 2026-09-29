const fs=require('fs'); 
const txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8'); 
const startStr = '<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">';
const start = txt.indexOf(startStr);
const end = txt.indexOf(') : (', start);
console.log('start:', start, 'end:', end);
if(start !== -1 && end !== -1) {
  fs.writeFileSync('extracted-grid.txt', txt.substring(start, end));
}
