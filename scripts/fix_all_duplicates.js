const fs = require('fs');
const path = require('path');

// 1. heating-load.tsx
const pHeating = path.join(__dirname, '../frontend/src/routes/heating-load.tsx');
if (fs.existsSync(pHeating)) {
  let c = fs.readFileSync(pHeating, 'utf8');
  // Remove duplicate constants
  const regexHeating = /\/\/ Conversion Constants[\s\S]*?const KW_TO_BTU_HR = 3412\.142;\r?\n/g;
  if (regexHeating.test(c)) {
    c = c.replace(regexHeating, '');
    fs.writeFileSync(pHeating, c, 'utf8');
    console.log('Fixed heating-load.tsx');
  } else {
    console.log('heating-load.tsx: duplicate constants already removed or not found');
  }
}

// 2. generator-sizing.tsx
const pGen = path.join(__dirname, '../frontend/src/routes/generator-sizing.tsx');
if (fs.existsSync(pGen)) {
  let c = fs.readFileSync(pGen, 'utf8');
  // Remove from type StarterType = "DOL"... up to STANDARD_SIZES = [...];
  const regexGen = /type StarterType = "DOL"[\s\S]*?const STANDARD_SIZES = \[[\s\S]*?\];\r?\n\r?\n/g;
  if (regexGen.test(c)) {
    c = c.replace(regexGen, '');
    fs.writeFileSync(pGen, c, 'utf8');
    console.log('Fixed generator-sizing.tsx');
  } else {
    console.log('generator-sizing.tsx: duplicate block not found with regex, trying alternate');
    const startIdx = c.indexOf('type StarterType = "DOL"');
    const endIdx = c.indexOf('function GeneratorSizingPage()');
    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      c = c.substring(0, startIdx) + c.substring(endIdx);
      fs.writeFileSync(pGen, c, 'utf8');
      console.log('Fixed generator-sizing.tsx with slice');
    }
  }
}

// 3. diffuser-selector.tsx
const pDiff = path.join(__dirname, '../frontend/src/routes/diffuser-selector.tsx');
if (fs.existsSync(pDiff)) {
  let c = fs.readFileSync(pDiff, 'utf8');
  const startIdx = c.indexOf('export interface DiffuserRowItem');
  const endIdx = c.indexOf('interface InlineInputProps');
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
    c = c.substring(0, startIdx) + c.substring(endIdx);
    fs.writeFileSync(pDiff, c, 'utf8');
    console.log('Fixed diffuser-selector.tsx with slice');
  }
}
