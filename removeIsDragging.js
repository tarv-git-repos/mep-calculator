const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/if \(isDragging && Math\.abs\(e\.clientX - startX\) > 5\) return;/g, "");
content = content.replace(/const worldPos = new THREE\.Vector3\(ndcX, ndcY, 0\)\.unproject\(world\.camera\.three\);/g, "const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);");

fs.writeFileSync(file, content, 'utf8');
