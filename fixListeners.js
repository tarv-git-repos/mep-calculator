const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the pointerdown listener in init
const pdRegex = /ui\.viewport\.addEventListener\('pointerdown', \(e: PointerEvent\) => \{[\s\S]*?\}, \{ signal \}\);/g;
const pdNew = `ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
                    isDragging = false;
                    startX = e.clientX;
                    startY = e.clientY;
                }, { signal, capture: true });`;
content = content.replace(pdRegex, pdNew);

const pmRegex = /ui\.viewport\.addEventListener\('pointermove', \(e: PointerEvent\) => \{[\s\S]*?\}, \{ signal \}\);/g;
const pmNew = `ui.viewport.addEventListener('pointermove', (e: PointerEvent) => {
                    if (e.buttons !== 0) { isDragging = true; return; }
                    if (startX === 0 && startY === 0) { startX = e.clientX; startY = e.clientY; }
                    if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true;

                    if (!ui.btn2d.classList.contains('active')) return;

                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const eqHitGroup = checkEquipmentHit(ndcX, ndcY);
                    if (eqHitGroup) {
                        ui.viewport.style.cursor = 'pointer';
                        return;
                    }

                    const hit = raycastSpaceUnderCursor(e);
                    if (hit) {
                        ui.viewport.style.cursor = 'pointer';
                        if (lastHoveredId !== hit.expressId) {
                            lastHoveredId = hit.expressId;
                            setSelectedSpaceHighlight(hit.expressId, true);
                        }
                    } else {
                        ui.viewport.style.cursor = 'default';
                        if (lastHoveredId !== null) {
                            lastHoveredId = null;
                            setSelectedSpaceHighlight(null, true);
                        }
                    }
                }, { signal, capture: true });`;
content = content.replace(pmRegex, pmNew);

const clickRegex = /ui\.viewport\.addEventListener\('click', \(e: MouseEvent\) => \{[\s\S]*?\}, \{ signal \}\);/g;
const clickNew = `ui.viewport.addEventListener('click', (e: MouseEvent) => {
                    if (isDragging && Math.abs(e.clientX - startX) > 5) return;
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
content = content.replace(clickRegex, clickNew);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated listeners with capture: true and hardened isDragging logic");
