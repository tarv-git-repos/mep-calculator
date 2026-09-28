const fs = require('fs');
let content = fs.readFileSync('frontend/src/routes/cable-tray-sizing.tsx', 'utf-8');

const targetPdf = `          let subTotal1 = 0;
          let hasValidCables = false;
          const tableData = tray.cables.map((c, idx) => {
            const baseOd = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
            const od = c.customOd !== undefined && c.customOd !== "" ? Number(c.customOd) : baseOd;
            const qtyNum = typeof c.qty === "number" ? c.qty : 0;
            const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
            if (!isNaN(sumOd) && qtyNum > 0) {
              subTotal1 += sumOd;
              hasValidCables = true;
            }
            return [
              idx + 1,
              c.type || "XLPE/SWA/PVC",
              c.cores || "-",
              c.size ? \`\${c.size} mm²\` : "-",
              qtyNum.toString(),
              isNaN(od) ? "-" : od.toFixed(1),
              isNaN(sumOd) ? "-" : sumOd.toFixed(1)
            ];
          });

          const spacingFactor = Number(tray.spacingFactor ?? 1);
          const spacingWidth = subTotal1 * spacingFactor;
          const subTotal2 = subTotal1 + spacingWidth;
          const sparePercentage = Number(tray.spareCapacity ?? 20);
          const spareWidth = subTotal2 * (sparePercentage / 100);
          const totalWidth = subTotal2 + spareWidth;
          const rawTraySize = hasValidCables ? getCableTraySize(totalWidth) : 'N/A';
          const formattedTraySize = formatTraySize(rawTraySize, unitSystem === "si");`;

const replacementPdf = `          const safeDb = cableDatabase || DEFAULT_CABLE_DATABASE;
          const { calcCables, traySize: rawTraySize } = calculateTraySizing(tray.cables, safeDb, tray.spacingFactor, tray.spareCapacity);
          
          const tableData = calcCables.map((c, idx) => {
            const qtyNum = typeof c.qty === "number" ? c.qty : 0;
            return [
              idx + 1,
              c.type || "XLPE/SWA/PVC",
              c.cores || "-",
              c.size ? \`\${c.size} mm²\` : "-",
              qtyNum.toString(),
              isNaN(c.od) ? "-" : c.od.toFixed(1),
              isNaN(c.sumOd) ? "-" : c.sumOd.toFixed(1)
            ];
          });

          const formattedTraySize = formatTraySize(rawTraySize, unitSystem === "si");`;

const targetRender = `          let subTotal1 = 0;
          let hasValidCables = false;
          
          const safeDb = cableDatabase || DEFAULT_CABLE_DATABASE;
          const calcCables = filteredCables.map(c => {
            const baseOd = c.cores && c.size ? (safeDb[c.cores]?.[c.size] ?? NaN) : NaN;
            const od = c.customOd !== undefined && c.customOd !== "" ? Number(c.customOd) : baseOd;
            const qtyNum = typeof c.qty === 'number' ? c.qty : 0;
            const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
            
            if (!isNaN(sumOd) && qtyNum > 0) {
              subTotal1 += sumOd;
              hasValidCables = true;
            }
            return { ...c, od, sumOd };
          });

          const spacingFactor = Number(tray.spacingFactor ?? 1);
          const spacingWidth = subTotal1 * spacingFactor;
          const subTotal2 = subTotal1 + spacingWidth;
          const sparePercentage = Number(tray.spareCapacity ?? 20);
          const spareWidth = subTotal2 * (sparePercentage / 100);
          const totalWidth = subTotal2 + spareWidth;
          const traySize = hasValidCables ? getCableTraySize(totalWidth) : 'N/A';`;

const replacementRender = `          const safeDb = cableDatabase || DEFAULT_CABLE_DATABASE;
          const { calcCables, subTotal1, subTotal2, spareWidth, totalWidth, traySize, hasValidCables, spacingFactor, sparePercentage, spacingWidth } = calculateTraySizing(filteredCables, safeDb, tray.spacingFactor, tray.spareCapacity);`;

let newContent = content.replace(targetPdf, replacementPdf);
newContent = newContent.replace(targetRender, replacementRender);
newContent = newContent.replace('import { Cable, Tray, TRAY_RANGES, getCableTraySize } from "../lib/cableTrayHelpers";', 'import { Cable, Tray, TRAY_RANGES, getCableTraySize } from "../lib/cableTrayHelpers";\\nimport { calculateTraySizing } from "@/lib/calc-cable-tray";');

fs.writeFileSync('frontend/src/routes/cable-tray-sizing.tsx', newContent);
console.log("Replaced successfully!");
