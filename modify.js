const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('TransformControls')) {
    content = content.replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { TransformControls } from 'three/examples/jsm/controls/TransformControls';");
}

if (!content.includes('let transformControl: TransformControls')) {
    content = content.replace('let placedEquipment3DMeshes: THREE.Object3D[] = [];', 'let placedEquipment3DMeshes: THREE.Object3D[] = [];\n                        let transformControl: TransformControls | null = null;');
}

if (!content.includes('transformControl.detach();')) {
    content = content.replace('placedEquipment3DMeshes = [];', `placedEquipment3DMeshes = [];\n                    if (transformControl && transformControl.object) transformControl.detach();`);
}

const targetPosCalc = `
                        let targetPos: THREE.Vector3 | null = null;
                        if (eq.positionX !== undefined && eq.positionZ !== undefined) {
                            targetPos = new THREE.Vector3(eq.positionX, eq.positionY || 0, eq.positionZ);
                        } else {
                            const targetName = (eq.locationSpaceName || "").trim().toLowerCase();
`;
content = content.replace(/let targetPos: THREE\.Vector3 \| null = null;\s*const targetName = \(eq\.locationSpaceName \|\| ""\)\.trim\(\)\.toLowerCase\(\);/, targetPosCalc.trim());

const userDataSetup = `
                        const boxGroup = new THREE.Group();
                        boxGroup.userData = { isEquipmentGroup: true, equipmentId: eq.id };
                        boxGroup.position.copy(targetPos);
                        if (eq.rotationY !== undefined) boxGroup.rotation.y = eq.rotationY;
`;
content = content.replace(/const boxGroup = new THREE\.Group\(\);\s*boxGroup\.position\.copy\(targetPos\);/, userDataSetup.trim());

const setupTC = `
        const controls = new TransformControls(world.camera.three, ui.viewport);
        transformControl = controls;
        transformControl.addEventListener('dragging-changed', (event) => {
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

        ui.viewport.addEventListener('click', (e: MouseEvent) => {
            if (isDragging) return;
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const mouse = new THREE.Vector2(ndcX, ndcY);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, world.camera.three);
            const hits = raycaster.intersectObjects(placedEquipment3DMeshes, true);
            if (hits.length > 0) {
                let eqMesh = hits[0].object;
                while (eqMesh.parent && eqMesh.parent !== world.scene.three && !eqMesh.userData?.isEquipmentGroup) {
                    eqMesh = eqMesh.parent;
                }
                if (eqMesh.userData?.isEquipmentGroup && transformControl) {
                    if (transformControl.object === eqMesh) {
                        transformControl.setMode(transformControl.getMode() === 'translate' ? 'rotate' : 'translate');
                        transformControl.showX = true;
                        transformControl.showY = transformControl.getMode() === 'rotate'; // Only show Y for rotation
                        transformControl.showZ = true;
                    } else {
                        transformControl.setMode('translate');
                        transformControl.showX = true;
                        transformControl.showY = false;
                        transformControl.showZ = true;
                        transformControl.attach(eqMesh);
                    }
                }
            } else {
                const hitSpace = raycastSpaceUnderCursor(e);
                if (!hitSpace && transformControl && !ui.btnWalk.classList.contains('active')) {
                    transformControl.detach();
                }
            }
        });
`;
const anchor = "document.addEventListener('drop', handleDrop);";
if (!content.includes('const controls = new TransformControls')) {
    content = content.replace(anchor, anchor + "\n\n" + setupTC);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected TransformControls logic.');
