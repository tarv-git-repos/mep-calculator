const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const handleFocusEquipment = async \(e: Event\) => \{[\s\S]*?window\.addEventListener\('mep-focus-equipment', handleFocusEquipment\);/;

const newBlock = `const handleFocusEquipment = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const equip = customEvent.detail;
            if (!equip) return;
            
            if (!ui.btn2d.classList.contains('active')) {
                if (ui.btn2d.onclick) {
                    const p = ui.btn2d.onclick(new MouseEvent('click') as any);
                    if (p && (p as any).then) await p;
                }
            }
            
            if (equip.locationSpaceId) {
                let targetStoreyId = null;
                for (const [expressId, spData] of spaceWorldPolygons) {
                    if (String(expressId) === equip.locationSpaceId || String(spData.space?.expressId) === equip.locationSpaceId) {
                        targetStoreyId = spData.storeyExpressId;
                        break;
                    }
                }
                
                if (targetStoreyId && String(ui.selectLevel.value) !== String(targetStoreyId)) {
                    ui.selectLevel.value = String(targetStoreyId);
                    if (ui.selectLevel.onchange) {
                        const p2 = ui.selectLevel.onchange(new Event('change') as any);
                        if (p2 && (p2 as any).then) await p2;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 100));

            if (!world?.camera?.controls) return;
            const eqMesh = placedEquipment3DMeshes.find(m => m.userData?.equipmentId === equip.id);
            if (eqMesh) {
                const pos = eqMesh.position;
                world.camera.controls.moveTo(pos.x, pos.y, pos.z, true);
                if (world.camera.three.isOrthographicCamera || (world.camera.projection as any).current === 'Orthographic') {
                    world.camera.controls.zoomTo(10, true);
                } else {
                    world.camera.controls.dollyTo(15, true);
                }
            }
        };
        window.addEventListener('mep-focus-equipment', handleFocusEquipment);`;

if (content.match(regex)) {
    content = content.replace(regex, newBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully fixed handleFocusEquipment");
} else {
    console.log("Regex not found!");
}
