const fs = require('fs');
const txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

const startStr = 'id="card-hero-results"';
const start = txt.indexOf(startStr);
console.log(txt.substring(start - 100, start + 2000));
