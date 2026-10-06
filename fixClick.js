const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

// Helper function to inject
const checkEquipmentHitFn = `
        const checkEquipmentHit = (ndcX: number, ndcY: number) => {
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
                        // BoxGeometry is centered at 0,0,0 in local space
                        if (bbox && 
                            localClick.x >= bbox.min.x && localClick.x <= bbox.max.x &&
                            localClick.z >= bbox.min.z && localClick.z <= bbox.max.z) {
                            hit = true;
                        }
                    }
                });
                if (hit) return group;
            }
            return null;
        };
`;

// 1. Inject checkEquipmentHitFn after raycastSpaceUnderCursor definition
if (!content.includes('const checkEquipmentHit = ')) {
    content = content.replace(/(const raycastSpaceUnderCursor =.*?};)/s, "$1\n" + checkEquipmentHitFn);
}

// 2. Fix the mousemove listener
content = content.replace(/const raycaster = new THREE\.Raycaster\(\);\s*raycaster\.setFromCamera\(new THREE\.Vector2\(ndcX, ndcY\), world\.camera\.three\);\s*const eqHits = raycaster\.intersectObjects\(placedEquipment3DMeshes, true\);\s*if \(eqHits\.length > 0\) {/g, `const eqHitGroup = checkEquipmentHit(ndcX, ndcY);\n                    if (eqHitGroup) {`);

// 3. Fix the bottom click listener
// In the click listener at the bottom:
const bottomClickReplace = `const mouse = new THREE.Vector2(ndcX, ndcY);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, world.camera.three);
            const hits = raycaster.intersectObjects(placedEquipment3DMeshes, true);
            if (hits.length > 0) {
                let eqMesh = hits[0].object;
                while (eqMesh.parent && eqMesh.parent !== world.scene.three && !eqMesh.userData?.isEquipmentGroup) {
                    eqMesh = eqMesh.parent;
                }
                if (eqMesh.userData?.isEquipmentGroup && transformControl) {`;
                
const bottomClickNew = `const eqHitGroup = checkEquipmentHit(ndcX, ndcY);
            if (eqHitGroup) {
                let eqMesh = eqHitGroup;
                if (eqMesh.userData?.isEquipmentGroup && transformControl) {`;

content = content.replace(bottomClickReplace, bottomClickNew);

// 4. One edge case: The HTML label overlay might be blocking the click! 
// Let's add pointer-events-none to the label div in updatePlacedEquipment3DBoxes
content = content.replace(/labelDiv\.className = 'bg-\\[#1a1a1c\\]/g, "labelDiv.className = 'pointer-events-none bg-[#1a1a1c]");

fs.writeFileSync(file, content, 'utf8');
console.log("Updated raycasting to 2D mathematical bounds checking");
