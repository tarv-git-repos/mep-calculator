const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. ADD TRANSFORMCONTROLS IMPORT
if (!content.includes('TransformControls')) {
    content = content.replace("import * as OBC from '@thatopen/components';", "import * as OBC from '@thatopen/components';\nimport { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';");
}

// 2. ADD handleDrop WITH 2D EQUIPMENT DROP + TransformControls Instantiation
const handleDropRegex = /const handleDrop = \(e: DragEvent\) => \{[\s\S]*?document\.addEventListener\('drop', handleDrop\);/;

const newHandleDropBlock = `const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            
            try {
                if (e.dataTransfer?.getData('text/plain')) {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.type === 'equipment' && ui.btn2d.classList.contains('active')) {
                        const rect = ui.viewport.getBoundingClientRect();
                        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                        
                        const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                        const clickX = worldPos.x;
                        const clickZ = worldPos.z;

                        const activeLevelId = ui.selectLevel.value;
                        
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

                        let hitSpace = null;
                        for (const [expressId, spData] of spaceWorldPolygons) {
                            if (activeLevelId && String(spData.storeyExpressId) !== String(activeLevelId)) continue;
                            if (pointInPoly(clickX, clickZ, spData.worldXZ)) {
                                hitSpace = { space: spData.space, expressId: Number(expressId) };
                                break;
                            }
                        }

                        if (hitSpace) {
                            const state = workspaceStore.getState();
                            const equipIdx = state.equipment.findIndex(eq => eq.id === data.id);
                            if (equipIdx !== -1) {
                                const newEquipment = [...state.equipment];
                                newEquipment[equipIdx] = {
                                    ...newEquipment[equipIdx],
                                    locationSpaceId: String(hitSpace.expressId),
                                    locationSpaceName: hitSpace.space.longName || hitSpace.space.name || \`Space \${hitSpace.expressId}\`,
                                    positionX: clickX,
                                    positionY: 0,
                                    positionZ: clickZ
                                };
                                workspaceStore.setState({ equipment: newEquipment });
                            }
                        }
                        return;
                    }
                }
            } catch(err) {}

            const file = e.dataTransfer?.files[0];
            if (file && (window as any).loadIfcFile) {
                (window as any).loadIfcFile(file);
            }
        };

        const handleFocusEquipment = async (e: Event) => {
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
                
                if (transformControl) {
                    transformControl.camera = world.camera.three;
                    transformControl.setMode('translate');
                    transformControl.showX = true;
                    transformControl.showY = false;
                    transformControl.showZ = true;
                    transformControl.attach(eqMesh);
                }
            }
        };

        let transformControl: any = null;

        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);
        window.addEventListener('mep-focus-equipment', handleFocusEquipment);
        
        transformControl = new TransformControls(world.camera.three, ui.viewport);
        transformControl.addEventListener('dragging-changed', (event: any) => {
            world.camera.controls.enabled = !event.value;
            if (!event.value && transformControl.object) {
                const eqId = transformControl.object.userData.equipmentId;
                const state = workspaceStore.getState();
                const equipIdx = state.equipment.findIndex(eq => eq.id === eqId);
                if (equipIdx !== -1) {
                    const newEquipment = [...state.equipment];
                    newEquipment[equipIdx] = {
                        ...newEquipment[equipIdx],
                        positionX: transformControl.object.position.x,
                        positionY: transformControl.object.position.y,
                        positionZ: transformControl.object.position.z,
                        rotationY: transformControl.object.rotation.y
                    };
                    workspaceStore.setState({ equipment: newEquipment });
                }
            }
        });
        world.scene.three.add(transformControl);

        ui.viewport.addEventListener('pointerup', (e: PointerEvent) => {
            if (isDragging && Math.abs(e.clientX - startX) > 5) return;
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
            const clickX = worldPos.x;
            const clickZ = worldPos.z;

            let eqHitGroup = null;
            for (const group of placedEquipment3DMeshes) {
                if (!group.userData?.isEquipmentGroup) continue;
                const localClick = new THREE.Vector3(clickX, group.position.y, clickZ);
                group.worldToLocal(localClick);
                let hit = false;
                group.traverse((c: any) => {
                    if (c.geometry && c.geometry.type === 'BoxGeometry') {
                        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
                        const bbox = c.geometry.boundingBox;
                        if (bbox && localClick.x >= bbox.min.x && localClick.x <= bbox.max.x &&
                            localClick.z >= bbox.min.z && localClick.z <= bbox.max.z) {
                            hit = true;
                        }
                    }
                });
                if (hit) { eqHitGroup = group; break; }
            }

            if (eqHitGroup) {
                if (transformControl) {
                    transformControl.camera = world.camera.three;
                    if (transformControl.object === eqHitGroup) {
                        transformControl.setMode(transformControl.getMode() === 'translate' ? 'rotate' : 'translate');
                        transformControl.showX = transformControl.getMode() === 'translate';
                        transformControl.showY = transformControl.getMode() === 'rotate';
                        transformControl.showZ = transformControl.getMode() === 'translate';
                    } else {
                        transformControl.setMode('translate');
                        transformControl.showX = true;
                        transformControl.showY = false;
                        transformControl.showZ = true;
                        transformControl.attach(eqHitGroup);
                    }
                }
            } else {
                if (transformControl) transformControl.detach();
            }
        });
`;

content = content.replace(handleDropRegex, newHandleDropBlock);

// 3. Update placedEquipment3DMeshes logic
const updateBoxesRegex = /const updatePlacedEquipment3DBoxes = \(\) => \{[\s\S]*?placedEquipment3DMeshes\.forEach\(m => \{[\s\S]*?\}\);/g;
const newUpdateBoxes = `const updatePlacedEquipment3DBoxes = () => {
            if (transformControl) transformControl.detach();
            placedEquipment3DMeshes.forEach(m => {
                if (m.userData?.isEquipmentGroup) {
                    m.traverse((c: any) => {
                        if (c.geometry) c.geometry.dispose();
                        if (c.material) c.material.dispose();
                    });
                    world.scene.three.remove(m);
                }
            });`;
content = content.replace(updateBoxesRegex, newUpdateBoxes);

// Fix equipment positions reading from state
const equipRenderRegex = /const targetPos = new THREE\.Vector3\(centerX, 0, centerZ\);[\s\S]*?group\.position\.copy\(targetPos\);/g;
const newEquipRender = `let posX = centerX;
                    let posY = 0;
                    let posZ = centerZ;
                    
                    if (equip.positionX !== undefined) posX = equip.positionX;
                    if (equip.positionY !== undefined) posY = equip.positionY;
                    if (equip.positionZ !== undefined) posZ = equip.positionZ;
                    
                    const targetPos = new THREE.Vector3(posX, posY, posZ);
                    
                    const group = new THREE.Group();
                    group.userData = { isEquipmentGroup: true, equipmentId: equip.id };
                    group.position.copy(targetPos);
                    if (equip.rotationY !== undefined) {
                        group.rotation.y = equip.rotationY;
                    }`;
content = content.replace(equipRenderRegex, newEquipRender);


// 4. Update cleanup
const cleanupRegex = /document\.removeEventListener\('drop', handleDrop\);/g;
const newCleanup = `document.removeEventListener('drop', handleDrop);
            window.removeEventListener('mep-focus-equipment', handleFocusEquipment);
            if (transformControl) { transformControl.detach(); transformControl.dispose(); }`;
content = content.replace(cleanupRegex, newCleanup);


// 5. FIX THE isDragging BUG BY USING POINTER EVENTS ON THE OLD LISTENER
content = content.replace(/ui\.viewport\.addEventListener\('mousedown', \(e: MouseEvent\)/g, "ui.viewport.addEventListener('pointerdown', (e: PointerEvent)");
content = content.replace(/ui\.viewport\.addEventListener\('mousemove', \(e: MouseEvent\)/g, "ui.viewport.addEventListener('pointermove', (e: PointerEvent)");

fs.writeFileSync(file, content, 'utf8');
console.log("Restored all features seamlessly");
