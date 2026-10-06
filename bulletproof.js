const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexOldClick = /ui\.viewport\.addEventListener\('click', \(e: MouseEvent\) => \{[\s\S]*?if \(isDragging\) return;[\s\S]*?const hit = raycastSpaceUnderCursor\(e\);[\s\S]*?ui\.selectedSpaceInfo\.innerHTML = `Click on a space in 3D view to select it\.`;\s*\}\s*\}, \{ signal \}\);/g;

const newClickLogic = `let clickStartX = 0;
                let clickStartY = 0;
                ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
                    clickStartX = e.clientX;
                    clickStartY = e.clientY;
                }, { signal, capture: true });

                ui.viewport.addEventListener('click', (e: MouseEvent) => {
                    if (Math.abs(e.clientX - clickStartX) > 5 || Math.abs(e.clientY - clickStartY) > 5) return;
                    if (!ui.btn2d.classList.contains('active')) return;

                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const eqHitGroup = checkEquipmentHit(ndcX, ndcY);
                    if (eqHitGroup) return;

                    const hit = raycastSpaceUnderCursor(e);
                    if (hit) {
                        setSelectedSpaceHighlight(hit.expressId, false);
                        displaySelectedSpaceInfo(hit.space);
                    } else {
                        setSelectedSpaceHighlight(null, false);
                        ui.selectedSpaceInfo.innerHTML = "Click on a space in 3D view to select it.";
                    }
                }, { signal, capture: true });`;

content = content.replace(regexOldClick, newClickLogic);
fs.writeFileSync(file, content, 'utf8');
console.log("Bulletproofed space selection click listener");
