import re

with open('frontend/src/features/bim-viewer/components/Viewport3D.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"(if\s*\(pointerIsDraggingPlaced\)\s*\{\s*const\s*equipId\s*=\s*activePlacedDragGroup\.userData\.equipmentId;\s*const\s*pseudoMouseEvent\s*=\s*new\s*MouseEvent\('mouseup',\s*\{\s*clientX:\s*e\.clientX,\s*clientY:\s*e\.clientY\s*\}\);\s*const\s*hit\s*=\s*\(window\s*as\s*any\)\._raycastSpaceUnderCursor\s*\?\s*\(window\s*as\s*any\)\._raycastSpaceUnderCursor\(pseudoMouseEvent\)\s*:\s*null;\s*)const\s*updatedEquipment\s*=\s*workspaceStore\.getState\(\)\.equipment\.map\(\(eq:\s*any\)\s*=>\s*\{\s*if\s*\(eq\.id\s*===\s*equipId\)\s*\{\s*if\s*\(hit\)\s*\{\s*const\s*level\s*=\s*useViewerStore\.getState\(\)\.levels\.find\(\(l:\s*any\)\s*=>\s*String\(l\.expressId\)\s*===\s*String\(hit\.storeyExpressId\)\);\s*const\s*floorElevation\s*=\s*level\s*\?\s*level\.elevation\s*:\s*0;\s*return\s*\{\s*\.\.\.eq,\s*locationSpaceId:\s*String\(hit\.expressId\),\s*locationSpaceName:\s*hit\.space\?\.name\s*\|\|\s*hit\.space\?\.longName\s*\|\|\s*'Unknown\s*Space',\s*locationFloor:\s*level\s*\?\s*level\.name\s*:\s*'Unknown\s*Floor',\s*positionX:\s*hit\.point\.x,\s*positionY:\s*floorElevation,\s*positionZ:\s*hit\.point\.z\s*\};\s*\}\s*else\s*\{\s*return\s*\{\s*\.\.\.eq,\s*positionX:\s*activePlacedDragGroup!\.position\.x,\s*positionZ:\s*activePlacedDragGroup!\.position\.z\s*\};\s*\}\s*\}\s*return\s*eq;\s*\}\);\s*workspaceStore\.getState\(\)\.updateEquipment\(updatedEquipment\);\s*"

replacement = r'''\1if (hit) {
                        const updatedEquipment = workspaceStore.getState().equipment.map((eq: any) => {
                            if (eq.id === equipId) {
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
                            }
                            return eq;
                        });
                        workspaceStore.getState().updateEquipment(updatedEquipment);
                    } else {
                        // Invalid drop: revert to previous valid state
                        const orig = workspaceStore.getState().equipment.find((eq: any) => eq.id === equipId);
                        if (orig && activePlacedDragGroup) {
                            activePlacedDragGroup.position.set(orig.positionX || 0, orig.positionY || 0, orig.positionZ || 0);
                        }
                    }
                '''

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('frontend/src/features/bim-viewer/components/Viewport3D.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
