const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add the helper function right before raycastSpaceUnderCursor
const helper = `
                const getEquipmentUnderCursor = (e: MouseEvent): any => {
                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);
                    
                    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                    const clickPos = new THREE.Vector3();
                    if (!raycaster.ray.intersectPlane(plane, clickPos)) {
                        return null;
                    }

                    for (const eqGroup of placedEquipment3DMeshes) {
                        const localPos = eqGroup.worldToLocal(clickPos.clone());
                        const boxMesh = eqGroup.children.find((c: any) => c.isMesh && c.geometry && c.geometry.type === 'BoxGeometry');
                        if (boxMesh && (boxMesh as any).geometry) {
                            (boxMesh as any).geometry.computeBoundingBox();
                            const bbox = (boxMesh as any).geometry.boundingBox;
                            // Expand the bounding box slightly for easier clicking
                            if (bbox) {
                                const expandedBbox = bbox.clone().expandByScalar(0.2); 
                                if (expandedBbox.containsPoint(localPos)) {
                                    return eqGroup;
                                }
                            }
                        }
                    }
                    return null;
                };
`;
if (!content.includes('getEquipmentUnderCursor')) {
    content = content.replace("const raycastSpaceUnderCursor = (e: MouseEvent)", helper + "\n                const raycastSpaceUnderCursor = (e: MouseEvent)");
}

// 2. Replace the intersectObjects logic in mousemove
const mousemoveRegex = /const ndcX = \(\(e\.clientX - rect\.left\) \/ rect\.width\) \* 2 - 1;\s*const ndcY = -\(\(e\.clientY - rect\.top\) \/ rect\.height\) \* 2 \+ 1;\s*const raycaster = new THREE\.Raycaster\(\);\s*raycaster\.setFromCamera\(new THREE\.Vector2\(ndcX, ndcY\), world\.camera\.three\);\s*const eqHits = raycaster\.intersectObjects\(placedEquipment3DMeshes, true\);\s*if \(eqHits\.length > 0\)/g;
content = content.replace(mousemoveRegex, "const hitEq = getEquipmentUnderCursor(e);\n                    if (hitEq)");

// 3. Replace the click logic for space selection
const clickRegex = /const ndcX = \(\(e\.clientX - rect\.left\) \/ rect\.width\) \* 2 - 1;\s*const ndcY = -\(\(e\.clientY - rect\.top\) \/ rect\.height\) \* 2 \+ 1;\s*const raycaster = new THREE\.Raycaster\(\);\s*raycaster\.setFromCamera\(new THREE\.Vector2\(ndcX, ndcY\), world\.camera\.three\);\s*const eqHits = raycaster\.intersectObjects\(placedEquipment3DMeshes, true\);\s*if \(eqHits\.length > 0\) return;/;
content = content.replace(clickRegex, "const hitEq = getEquipmentUnderCursor(e);\n                    if (hitEq) return;");

// 4. Replace the click logic at the bottom of the file (for equipment selection)
const bottomClickRegex = /const rect = ui\.viewport\.getBoundingClientRect\(\);\s*const ndcX = \(\(e\.clientX - rect\.left\) \/ rect\.width\) \* 2 - 1;\s*const ndcY = -\(\(e\.clientY - rect\.top\) \/ rect\.height\) \* 2 \+ 1;\s*const mouse = new THREE\.Vector2\(ndcX, ndcY\);\s*const raycaster = new THREE\.Raycaster\(\);\s*raycaster\.setFromCamera\(mouse, world\.camera\.three\);\s*const hits = raycaster\.intersectObjects\(placedEquipment3DMeshes, true\);\s*if \(hits\.length > 0\) \{[\s\S]*?let eqMesh = hits\[0\]\.object;[\s\S]*?while \(eqMesh\.parent && eqMesh\.parent !== world\.scene\.three && \!eqMesh\.userData\?\.isEquipmentGroup\) \{[\s\S]*?eqMesh = eqMesh\.parent;[\s\S]*?\}/;
content = content.replace(bottomClickRegex, `const hitEqGroup = getEquipmentUnderCursor(e);
            if (hitEqGroup) {
                let eqMesh = hitEqGroup;`);

fs.writeFileSync(file, content, 'utf8');
console.log("Successfully injected mathematical bounding box hit detection");
