const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /if \(equip\.locationSpaceId\) \{[\s\S]*?await new Promise\(r => setTimeout\(r, 100\)\);/;

const newBlock = `if (equip.locationSpaceId) {
                let targetStoreyId = null;
                for (const [expressId, spData] of spaceWorldPolygons) {
                    if (String(expressId) === String(equip.locationSpaceId) || String(spData.space?.expressId) === String(equip.locationSpaceId)) {
                        targetStoreyId = spData.storeyExpressId;
                        break;
                    }
                }
                
                if (!targetStoreyId && equip.locationFloor) {
                    const st = storeys.find(s => s.name === equip.locationFloor);
                    if (st) targetStoreyId = st.expressId;
                }
                
                if (targetStoreyId && String(ui.selectLevel.value) !== String(targetStoreyId)) {
                    ui.selectLevel.value = String(targetStoreyId);
                    if (ui.selectLevel.onchange) {
                        const p2 = ui.selectLevel.onchange(new Event('change') as any);
                        if (p2 && (p2 as any).then) await p2;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 100));`;

if (content.match(regex)) {
    content = content.replace(regex, newBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully fixed handleFocusEquipment");
} else {
    console.log("Regex not found!");
}
