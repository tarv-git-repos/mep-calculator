$content = Get-Content frontend/src/features/bim-viewer/components/Viewport3D.tsx -Raw
$content = $content -replace 'let draggedMep = '' '';\s*document\.querySelectorAll\(''\.mep-item''\)\.forEach\(el => el\.addEventListener\(''dragstart'', \(e: any\) => draggedMep = e\.target\.dataset\.type\)\);\s*ui\.viewport\.addEventListener\(''dragover'', \(e: DragEvent\) => e\.preventDefault\(\)\);\s*ui\.viewport\.addEventListener\(''drop'', \(e: DragEvent\) => \{.*?draggedMep = '''';\s*\}\);', "let activeGhostMesh: THREE.Group | null = null;
        
        ui.viewport.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            const draggedId = useViewerStore.getState().draggedEquipmentId;
            if (!draggedId) {
                if (activeGhostMesh) {
                    world.scene.three.remove(activeGhostMesh);
                    activeGhostMesh = null;
                }
                return;
            }
            
            const equip = workspaceStore.getState().equipment.find(eq => eq.id === draggedId);
            if (!equip) return;
            
            const L = (equip.dimensions?.length || 1500) / 1000;
            const W = (equip.dimensions?.width || 1000) / 1000;
            const H = (equip.dimensions?.height || 1000) / 1000;

            if (!activeGhostMesh) {
                activeGhostMesh = new THREE.Group();
                const geom = new THREE.BoxGeometry(L, H, W);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.y = H / 2;
                activeGhostMesh.add(mesh);
                world.scene.three.add(activeGhostMesh);
            }

            const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e) : null;
            if (hit) {
                (activeGhostMesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
                const level = useViewerStore.getState().levels.find(l => String(l.expressId) === String(hit.storeyExpressId));
                const floorElevation = level ? level.elevation : 0;
                activeGhostMesh.position.set(hit.point.x, floorElevation, hit.point.z);
            } else {
                (activeGhostMesh.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
                const rect = ui.viewport.getBoundingClientRect();
                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 - 1;
                const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                activeGhostMesh.position.set(worldPos.x, 0, worldPos.z);
            }
        });
        
        ui.viewport.addEventListener('dragleave', () => {
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
        });
        
        ui.viewport.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            const draggedId = useViewerStore.getState().draggedEquipmentId;
            if (!draggedId) return;
            
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
            useViewerStore.getState().setDraggedEquipmentId(null);

            const equip = workspaceStore.getState().equipment.find(eq => eq.id === draggedId);
            if (!equip) return;
            
            const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e) : null;
            if (hit) {
                const level = useViewerStore.getState().levels.find(l => String(l.expressId) === String(hit.storeyExpressId));
                const floorElevation = level ? level.elevation : 0;
                
                const updatedEquipment = workspaceStore.getState().equipment.map(eq => {
                    if (eq.id === draggedId) {
                        return {
                            ...eq,
                            locationSpaceId: String(hit.expressId),
                            locationSpaceName: hit.space?.name || hit.space?.longName || 'Unknown Space',
                            locationFloor: level ? level.name : 'Unknown Floor',
                            positionX: hit.point.x,
                            positionY: floorElevation,
                            positionZ: hit.point.z
                        };
                    }
                    return eq;
                });
                workspaceStore.getState().updateEquipment(updatedEquipment);
            }
        });"
Set-Content frontend/src/features/bim-viewer/components/Viewport3D.tsx -Value $content -NoNewline
