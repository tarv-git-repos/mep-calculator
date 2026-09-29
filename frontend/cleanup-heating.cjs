const fs = require('fs');
let txt = fs.readFileSync('src/routes/heating-load.tsx', 'utf8');

// 1. Remove state variables and the showAdvanced flag
txt = txt.replace(/const \[uRoof, setURoof\] = useState[^;]+;/g, '');
txt = txt.replace(/const \[ventCfm, setVentCfm\] = useState[^;]+;/g, '');
txt = txt.replace(/const \[safetyMargin, setSafetyMargin\] = useState[^;]+;/g, '');
txt = txt.replace(/const \[showAdvanced, setShowAdvanced\] = useState[^;]+;/g, '');

// 2. Remove the Double-click text
const doubleClickTextTarget = `<span className="text-[10px] text-muted-foreground uppercase tracking-wider italic">
                            {showAdvanced ? "Advanced Visible" : "Double-click for advanced"}
                          </span>`;
txt = txt.replace(doubleClickTextTarget, '');

// 3. Remove onDoubleClick from the card container (approximate match, maybe we just use regex)
txt = txt.replace(/<div onDoubleClick=\{[^\}]+\}\s*className="bg-white/g, '<div className="bg-white');

// 4. Update the "Wall + Roof U-Value" input to not use `showAdvanced` and not set `uRoof`
txt = txt.replace(/<div className=\{showAdvanced \? "" : "col-span-2"\}>/g, '<div className="col-span-2">');
txt = txt.replace(/<label className="text-\[11px\] text-slate-500">\{showAdvanced \? "Wall U-Value" : "Wall \+ Roof U-Value"\} \(\{isSI \? "W\/m²K" : "U"\}\)<\/label>/g, 
  `<label className="text-[11px] text-slate-500">Wall + Roof U-Value ({isSI ? "W/m²K" : "U"})</label>`);

// Fix the onChange handler inside uWall input
const uWallChangeTarget = `onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") {
                                        setUWall("");
                                        if (!showAdvanced) setURoof("");
                                      } else if (isSI) {
                                        setUWall(val * U_SI_TO_IP);
                                        if (!showAdvanced) setURoof(val * U_SI_TO_IP);
                                      } else {
                                        setUWall(val);
                                        if (!showAdvanced) setURoof(val);
                                      }
                                      dirtyStore.set(true);
                                    }}`;
const uWallChangeReplacement = `onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") {
                                        setUWall("");
                                      } else if (isSI) {
                                        setUWall(val * U_SI_TO_IP);
                                      } else {
                                        setUWall(val);
                                      }
                                      dirtyStore.set(true);
                                    }}`;
txt = txt.replace(uWallChangeTarget, uWallChangeReplacement);

// 5. Remove the {showAdvanced && ( ... )} block completely
// This block contains uRoof, ventCfm, and safetyMargin inputs. Let's find it.
// We can use a regex that matches `{showAdvanced && (` up to the end of the safetyMargin div.
const showAdvancedBlocks = txt.match(/\{showAdvanced && \([\s\S]*?\}\)/g);
if (showAdvancedBlocks) {
    showAdvancedBlocks.forEach(b => txt = txt.replace(b, ''));
}

// 6. Update `calculateHeatingLoad` invocation
// It previously had 11 arguments, now 8 arguments.
const calcInvokeTarget = /const calcResults = calculateHeatingLoad\(\s*area,\s*height,\s*uWall,\s*uRoof,\s*uGlaz,\s*glazArea,\s*oat,\s*iat,\s*ach,\s*ventCfm,\s*safetyMargin\s*\);/;
txt = txt.replace(calcInvokeTarget, 'const calcResults = calculateHeatingLoad(area, height, uWall, uGlaz, glazArea, oat, iat, ach);');

// Also update the local storage JSON and parsing
txt = txt.replace(/uRoof, /g, '');
txt = txt.replace(/ventCfm, /g, '');
txt = txt.replace(/safetyMargin, /g, '');
txt = txt.replace(/uRoof: /g, '');
txt = txt.replace(/ventCfm: /g, '');
txt = txt.replace(/safetyMargin: /g, '');

// Also remove from preset config type and usage
txt = txt.replace(/uRoof:\s*number;\s*\/\/\s*BTU\/hr·ft²·°F\n/g, '');
txt = txt.replace(/ventCfm:\s*number;\s*\/\/\s*Ventilation fresh air CFM\n/g, '');
txt = txt.replace(/safetyMargin:\s*number;\s*\/\/\s*%\n/g, '');
txt = txt.replace(/uRoof:\s*[\d\.]+,\n/g, '');
txt = txt.replace(/ventCfm:\s*[\d\.]+,\n/g, '');
txt = txt.replace(/safetyMargin:\s*[\d\.]+,\n/g, '');

// Remove them from preset loading
txt = txt.replace(/setURoof\(preset\.uRoof\);\n/g, '');
txt = txt.replace(/setVentCfm\(preset\.ventCfm\);\n/g, '');
txt = txt.replace(/setSafetyMargin\(preset\.safetyMargin\);\n/g, '');

// 7. Remove them from the Formula Breakdown if present
// We will just let the formula breakdown remain as is, or we can clean up step 3 which talks about safety margin.
const formulaStep3Regex = /<div className="space-y-2\.5">\s*<div className="font-bold text-slate-700[^>]*>\s*<span[^>]*>3<\/span>\s*Total Sized Plant Capacity\s*<\/div>[\s\S]*?<\/div>/;
txt = txt.replace(formulaStep3Regex, '');

// Update Formula 2 which talked about ventilation
txt = txt.replace(/Infiltration & Ventilation \(Sensible\)/, 'Infiltration (Sensible)');
txt = txt.replace(/Q_air = 1\.08 × CFM × \(T_in - T_out\)/, 'Q_infil = 1.08 × CFM × (T_in - T_out)');
txt = txt.replace(/Q_air = 1\.20 × L\/s × \(T_in - T_out\)/, 'Q_infil = 1.20 × L/s × (T_in - T_out)');

// Clean up results mapped in UI:
// Wait, the detailed metrics maps:
// { label: "Roof Conduction", val: calcResults.qRoof, kw: calcResults.kwRoof },
// { label: "Fresh Air Vent", val: calcResults.qVent, kw: calcResults.kwVent },
const detailedMetricsRegex1 = /\{\s*label:\s*"Roof Conduction"[^\}]+\},/g;
const detailedMetricsRegex2 = /\{\s*label:\s*"Fresh Air Vent"[^\}]+\},/g;
txt = txt.replace(detailedMetricsRegex1, '');
txt = txt.replace(detailedMetricsRegex2, '');

// Also clean up any occurrences of `calcResults.pctVent` or `calcResults.pctRoof` if used in a chart.
txt = txt.replace(/\{\s*id:\s*"roof"[^\}]+\},/g, '');
txt = txt.replace(/\{\s*id:\s*"vent"[^\}]+\},/g, '');

// And in the PDF / Excel exports:
txt = txt.replace(/\[\s*"Roof U-Value"[^\]]+\]\s*,/g, '');
txt = txt.replace(/\[\s*"Fresh Air Supply Rate"[^\]]+\]\s*,/g, '');
txt = txt.replace(/\[\s*"Safety Margin"[^\]]+\]\s*,/g, '');
txt = txt.replace(/\[\s*"Roof Conduction"[^\]]+\]\s*,/g, '');
txt = txt.replace(/\[\s*"Fresh Air Heating Load"[^\]]+\]\s*,/g, '');

// HTML export table rows
const trRoofInput = /<tr>[\s\S]*?Roof U-Value[\s\S]*?<\/tr>/g;
const trVentInput = /<tr>[\s\S]*?Fresh Air Supply Rate[\s\S]*?<\/tr>/g;
const trSafetyInput = /<tr>[\s\S]*?Safety Margin[\s\S]*?<\/tr>/g;
const trRoofRes = /<tr>[\s\S]*?Roof Conduction[\s\S]*?<\/tr>/g;
const trVentRes = /<tr>[\s\S]*?Fresh Air Heating Load[\s\S]*?<\/tr>/g;

txt = txt.replace(trRoofInput, '');
txt = txt.replace(trVentInput, '');
txt = txt.replace(trSafetyInput, '');
txt = txt.replace(trRoofRes, '');
txt = txt.replace(trVentRes, '');

fs.writeFileSync('src/routes/heating-load.tsx', txt);
console.log('Cleanup script finished!');
