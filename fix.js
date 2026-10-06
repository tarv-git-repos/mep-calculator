const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');
const startIndex = content.indexOf('const handleDragOver = (e: DragEvent) => e.preventDefault();');
const endIndexStr = 'document.addEventListener(\'drop\', handleDrop);';
const endIndex = content.lastIndexOf(endIndexStr) + endIndexStr.length;

const newBlock = `const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            const rawData = e.dataTransfer?.getData('text/plain');
            if (rawData) {
                try {
                    const data = JSON.parse(rawData);
                    if (data.type === 'equipment' && data.id) {
                        if (!ui.btn2d.classList.contains('active')) {
                            console.warn("Equipment placement is only supported in 2D View mode.");
                            return;
                        }

                        const rect = ui.viewport.getBoundingClientRect();
                        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                        const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                        const clickX = worldPos.x;
                        const clickZ = worldPos.z;

                        const pointInPoly = (px: number, pz: number, poly: { x: number, z: number }[]): boolean => {
                            let inside = false;
                            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                                const xi = poly[i].x, zi = poly[i].z;
                                const xj = poly[j].x, zj = poly[j].z;
                                if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
                                    inside = !inside;
                                }
                            }
                            return inside;
                        };

                        const activeLevelId = ui.selectLevel.value;
                        let foundSpace = null;
                        for (const [expressId, spData] of spaceWorldPolygons) {
                            if (activeLevelId && String(spData.storeyExpressId) !== String(activeLevelId)) continue;
                            if (pointInPoly(clickX, clickZ, spData.worldXZ)) {
                                foundSpace = spData.space;
                                break;
                            }
                        }

                        if (foundSpace) {
                            const cleanLongName = String(foundSpace.longName || "").trim();
                            const cleanName = String(foundSpace.name || "").trim();
                            const cleanObjType = String(foundSpace.ObjectType || foundSpace.objectType || "").trim();
                            let displayName = cleanLongName || cleanName || cleanObjType || \`Space \${foundSpace.expressId || ''}\`;
                            displayName = cleanSpaceName(displayName, foundSpace.expressId);
                            const storeyName = String(foundSpace.storeyName || "Ground Floor").trim();

                            const state = workspaceStore.getState();
                            const equipIdx = state.equipment.findIndex(eq => eq.id === data.id);
                            if (equipIdx !== -1) {
                                const newEquipment = [...state.equipment];
                                newEquipment[equipIdx] = {
                                    ...newEquipment[equipIdx],
                                    locationSpaceId: String(foundSpace.expressId || ''),
                                    locationSpaceName: displayName,
                                    locationFloor: storeyName
                                };
                                workspaceStore.setState({ equipment: newEquipment });
                                store().setLoadingText('');
                            }
                        }
                        return;
                    }
                } catch(err) {}
            }

            const file = e.dataTransfer?.files?.[0];
            if (file && (window as any).loadIfcFile) {
                (window as any).loadIfcFile(file);
            }
        };

        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);`;

content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed file successfully using node script.');
