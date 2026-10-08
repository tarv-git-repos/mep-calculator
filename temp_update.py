import re

with open('frontend/src/features/bim-viewer/components/Viewport3D.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Isolate TransformControls to 3D only
pattern1 = r"(ui\.viewport\.addEventListener\('pointerup',\s*\(e:\s*PointerEvent\)\s*=>\s*\{)(\s*const\s*rect\s*=\s*ui\.viewport\.getBoundingClientRect\(\);)"
replacement1 = r"\1\n            if (ui.btn2d.classList.contains('active')) { if (transformControl) transformControl.detach(); return; }\2"
content = re.sub(pattern1, replacement1, content, count=1)

# 2. Replace dangling pointerup
pattern2 = r"\s*ui\.viewport\.addEventListener\('pointerup',\s*\(e:\s*PointerEvent\)\s*=>\s*\{\s*if\s*\(activePlacedDragGroup\s*&&\s*ui\.viewport\.hasPointerCapture\(e\.pointerId\)\)\s*\{.*?pointerIsDraggingPlaced\s*=\s*false;\s*\}\s*\}\);\s*"
replacement2 = r'''
        // --- 2D DIRECT EQUIPMENT DRAGGING ---
        let selectedEquipmentId: string | null = null;
        let activePlacedDragGroup: THREE.Group | null = null;
        let pointerIsDraggingPlaced = false;
        let dragStartX = 0;
        let dragStartY = 0;

        const updateEquipmentHighlights = () => {
            placedEquipment3DMeshes.forEach(g => {
                const isSelected = g.userData?.equipmentId === selectedEquipmentId;
                g.traverse(c => {
                    if (c instanceof THREE.Mesh) {
                        (c.material as THREE.MeshBasicMaterial).color.setHex(isSelected ? 0xffa500 : 0x3b82f6);
                    }
                });
            });
        };

        const checkPlacedEquipmentHit = (ndcX: number, ndcY: number) => {
            if (!ui.btn2d.classList.contains('active')) return null;
            const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
            const clickX = worldPos.x;
            const clickZ = worldPos.z;

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
                if (hit) return group;
            }
            return null;
        };

        ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
            if (!ui.btn2d.classList.contains('active')) return;
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const hitGroup = checkPlacedEquipmentHit(ndcX, ndcY);
            if (hitGroup) {
                selectedEquipmentId = hitGroup.userData.equipmentId;
                activePlacedDragGroup = hitGroup;
                pointerIsDraggingPlaced = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                
                updateEquipmentHighlights();
                
                ui.viewport.setPointerCapture(e.pointerId);
                if (world.camera?.controls) world.camera.controls.enabled = false;
                e.stopImmediatePropagation();
            } else {
                selectedEquipmentId = null;
                updateEquipmentHighlights();
                activePlacedDragGroup = null;
            }
        });

        ui.viewport.addEventListener('pointermove', (e: PointerEvent) => {
            if (!ui.btn2d.classList.contains('active')) return;
            if (activePlacedDragGroup && ui.viewport.hasPointerCapture(e.pointerId)) {
                if (!pointerIsDraggingPlaced && (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3)) {
                    pointerIsDraggingPlaced = true;
                }
                
                if (pointerIsDraggingPlaced) {
                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                    
                    const pseudoMouseEvent = new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY });
                    const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(pseudoMouseEvent) : null;
                    
                    if (hit) {
                        const level = useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(hit.storeyExpressId));
                        const floorElevation = level ? level.elevation : 0;
                        activePlacedDragGroup.position.set(hit.point.x, floorElevation, hit.point.z);
                    } else {
                        activePlacedDragGroup.position.set(worldPos.x, activePlacedDragGroup.position.y, worldPos.z);
                    }
                }
                e.stopImmediatePropagation();
            }
        });

        ui.viewport.addEventListener('pointerup', (e: PointerEvent) => {
            if (activePlacedDragGroup && ui.viewport.hasPointerCapture(e.pointerId)) {
                ui.viewport.releasePointerCapture(e.pointerId);
                if (world.camera?.controls) world.camera.controls.enabled = true;
                
                if (pointerIsDraggingPlaced) {
                    const equipId = activePlacedDragGroup.userData.equipmentId;
                    const pseudoMouseEvent = new MouseEvent('mouseup', { clientX: e.clientX, clientY: e.clientY });
                    const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(pseudoMouseEvent) : null;
                    
                    const updatedEquipment = workspaceStore.getState().equipment.map((eq: any) => {
                        if (eq.id === equipId) {
                            if (hit) {
                                const level = useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(hit.storeyExpressId));
                                const floorElevation = level ? level.elevation : 0;
                                return {
                                    ...eq,
                                    locationSpaceId: String(hit.expressId),
                                    locationSpaceName: hit.space?.name || hit.space?.longName || 'Unknown Space',
                                    locationFloor: level ? level.name : 'Unknown Floor',
                                    positionX: hit.point.x,
                                    positionY: floorElevation,
                                    positionZ: hit.point.z
                                };
                            } else {
                                return {
                                    ...eq,
                                    positionX: activePlacedDragGroup!.position.x,
                                    positionZ: activePlacedDragGroup!.position.z
                                };
                            }
                        }
                        return eq;
                    });
                    workspaceStore.getState().updateEquipment(updatedEquipment);
                }
                
                activePlacedDragGroup = null;
                pointerIsDraggingPlaced = false;
                e.stopImmediatePropagation();
            }
        });
'''
content = re.sub(pattern2, replacement2, content, flags=re.DOTALL)

with open('frontend/src/features/bim-viewer/components/Viewport3D.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
