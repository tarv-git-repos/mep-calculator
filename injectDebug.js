const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

// Inject console logs in the old click listener
content = content.replace(
    /const eqHitGroup = checkEquipmentHit\(ndcX, ndcY\);\s*if \(eqHitGroup\) return;\s*const hit = raycastSpaceUnderCursor\(e\);/g,
    `const eqHitGroup = checkEquipmentHit(ndcX, ndcY);
                    console.log("[MEP Debug] Old Click Listener fired. isDragging:", isDragging, "btn2dActive:", ui.btn2d.classList.contains('active'), "eqHit:", !!eqHitGroup);
                    if (eqHitGroup) return;

                    const hit = raycastSpaceUnderCursor(e);
                    console.log("[MEP Debug] raycastSpaceUnderCursor result:", hit);`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Injected debug logs");
