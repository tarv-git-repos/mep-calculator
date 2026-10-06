const fs = require('fs');
const file = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/features/bim-viewer/components/Viewport3D.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /ui\.viewport\.addEventListener\('click', \(e: MouseEvent\) => \{[\s\S]*?log\("Fatal Error: " \+ e\.message\);\s*\}\s*\}\);/g;

const mergedClick = `ui.viewport.addEventListener('click', (e: MouseEvent) => {
            let debugDiv = document.getElementById('mep-debug');
            if (!debugDiv) {
                debugDiv = document.createElement('div');
                debugDiv.id = 'mep-debug';
                debugDiv.style.position = 'absolute';
                debugDiv.style.top = '10px';
                debugDiv.style.right = '10px';
                debugDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
                debugDiv.style.color = 'lime';
                debugDiv.style.padding = '10px';
                debugDiv.style.zIndex = '999999';
                debugDiv.style.fontFamily = 'monospace';
                debugDiv.style.pointerEvents = 'none';
                ui.viewport.appendChild(debugDiv);
            }
            const log = (msg) => { debugDiv.innerHTML = msg + "<br/>" + debugDiv.innerHTML; };
            log("Click fired!");

            try {
                const rect = ui.viewport.getBoundingClientRect();
                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                let eqHitGroup = null;
                try {
                    eqHitGroup = checkEquipmentHit(ndcX, ndcY);
                    log("Equipment hit: " + !!eqHitGroup);
                } catch(err) { log("Eq Hit Error: " + err.message); }

                if (eqHitGroup) {
                    let eqMesh = eqHitGroup;
                    if (eqMesh.userData?.isEquipmentGroup && transformControl) {
                        transformControl.camera = world.camera.three;
                        if (transformControl.object === eqMesh) {
                            transformControl.setMode(transformControl.getMode() === 'translate' ? 'rotate' : 'translate');
                            transformControl.showX = transformControl.getMode() === 'translate';
                            transformControl.showY = transformControl.getMode() === 'rotate';
                            transformControl.showZ = transformControl.getMode() === 'translate';
                        } else {
                            transformControl.setMode('translate');
                            transformControl.showX = true;
                            transformControl.showY = false;
                            transformControl.showZ = true;
                            transformControl.attach(eqMesh);
                        }
                    }
                } else {
                    let hitSpace = null;
                    try {
                        hitSpace = raycastSpaceUnderCursor(e);
                        log("Space hit: " + (hitSpace ? hitSpace.expressId : "null"));
                    } catch(err) { log("Space Hit Error: " + err.message); }

                    if (!hitSpace && transformControl && !ui.btnWalk.classList.contains('active')) {
                        transformControl.detach();
                    }
                    
                    if (hitSpace) {
                        log("Highlighting space " + hitSpace.expressId);
                        try {
                            if (typeof setSelectedSpaceHighlight === 'function') setSelectedSpaceHighlight(hitSpace.expressId, false);
                            if (typeof displaySelectedSpaceInfo === 'function') displaySelectedSpaceInfo(hitSpace.space);
                        } catch(err) { log("Highlight err: " + err.message); }
                    } else {
                        try {
                            if (typeof setSelectedSpaceHighlight === 'function') setSelectedSpaceHighlight(null, false);
                            ui.selectedSpaceInfo.innerHTML = "Click on a space in 3D view to select it.";
                        } catch(e){}
                    }
                }
            } catch(e) {
                log("Fatal Error: " + e.message);
            }
        });`;

content = content.replace(regex, mergedClick);
fs.writeFileSync(file, content, 'utf8');
console.log("Fixed syntax error");
