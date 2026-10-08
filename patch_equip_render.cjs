
const fs = require('fs');
const p = 'frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(p, 'utf8');

// 1. Add dispose to cleanup
content = content.replace(
  'disposeMeshList(activeSpace2dPickMeshes);',
  'disposeMeshList(activeSpace2dPickMeshes);\n            disposeMeshList(placedEquipment3DMeshes);\n            if (unsubEquipmentStore) { unsubEquipmentStore(); unsubEquipmentStore = null; }'
);

// 2. Add equipment rendering logic inside the useEffect, around line 1750 (before transformControl setup)
// Wait, I need a safe injection point. Let's look at 	ransformControl = new TransformControls(...)
const targetStr = \	ransformControl = new TransformControls(world.camera.three, ui.viewport);\;
const injection = \
        const renderEquipmentMeshes = () => {
            const state = workspaceStore.getState();
            disposeMeshList(placedEquipment3DMeshes);
            placedEquipment3DMeshes = [];

            state.equipment.forEach((equip) => {
                if (equip.locationSpaceId) {
                    const group = new THREE.Group();
                    group.position.set(equip.positionX || 0, equip.positionY || 0, equip.positionZ || 0);
                    if (equip.rotationY) group.rotation.y = equip.rotationY;
                    group.userData = { equipmentId: equip.id, isEquipmentGroup: true };

                    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                    const material = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = 0.4;
                    group.add(mesh);

                    const canvas = document.createElement('canvas');
                    canvas.width = 256; canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#1d4ed8';
                        ctx.fillRect(0, 0, 256, 64);
                        ctx.font = 'bold 32px sans-serif';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(equip.tag || 'EQUIP', 128, 32);
                    }
                    const tex = new THREE.CanvasTexture(canvas);
                    const spriteMat = new THREE.SpriteMaterial({ map: tex });
                    const sprite = new THREE.Sprite(spriteMat);
                    sprite.scale.set(2.0, 0.5, 1);
                    sprite.position.y = 1.2;
                    group.add(sprite);

                    world.scene.three.add(group);
                    placedEquipment3DMeshes.push(group);
                }
            });
        };

        if (unsubEquipmentStore) unsubEquipmentStore();
        unsubEquipmentStore = workspaceStore.subscribe((state, prevState) => {
            if (state.equipment !== prevState.equipment) {
                renderEquipmentMeshes();
            }
        });
        renderEquipmentMeshes();

        \;

content = content.replace(targetStr, injection + targetStr);

fs.writeFileSync(p, content);
console.log('Patched equipment rendering!');
