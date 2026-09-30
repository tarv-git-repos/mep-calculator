const fs = require('fs');

function addKwTotalAir(filePath) {
    let txt = fs.readFileSync(filePath, 'utf8');
    
    // Add computation
    const computationTarget = `const kwInfil = qInfil * BTU_HR_TO_KW;`;
    if (txt.includes(computationTarget) && !txt.includes('const kwTotalAir')) {
        txt = txt.replace(computationTarget, computationTarget + `\n  const kwTotalAir = qTotalAir * BTU_HR_TO_KW;`);
    }

    // Add to return block
    const returnTarget = `kwInfil, kwVent,`;
    if (txt.includes(returnTarget) && !txt.includes('kwTotalAir,')) {
        txt = txt.replace(returnTarget, `kwInfil, kwVent, kwTotalAir,`);
    } else {
        // Fallback for different return block formatting
        const returnTarget2 = `kwInfil, kwVent, loadDensityBtuPerSqft`;
        if (txt.includes(returnTarget2) && !txt.includes('kwTotalAir,')) {
            txt = txt.replace(returnTarget2, `kwInfil, kwVent, kwTotalAir, loadDensityBtuPerSqft`);
        }
    }

    fs.writeFileSync(filePath, txt);
}

addKwTotalAir('src/routes/heating-load.tsx');
addKwTotalAir('src/lib/calc-heating-load.ts');
console.log('Success');
