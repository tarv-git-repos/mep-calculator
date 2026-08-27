import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { RendererManager } from '../frontend/RendererManager';
import { FloorPlanManager } from '../frontend/FloorPlanManager';
import { SelectionManager } from '../frontend/SelectionManager';
import React, { useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../store/viewer-store';
import { Toolbar } from './Toolbar';
import { DropOverlay } from './DropOverlay';

export function Viewport3D() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!viewportRef.current || isInitialized.current) return;
        isInitialized.current = true;

        const viewportElement = viewportRef.current;

        // Mock UI object that syncs with Zustand store
        const store = useViewerStore.getState;
        
        class MockBtn {
            classList = {
                contains: (cls: string) => this.hasCls(cls),
                add: (cls: string) => this.addCls(cls),
                remove: (cls: string) => this.rmCls(cls),
                toggle: (cls: string) => {
                    const has = this.hasCls(cls);
                    if (has) this.rmCls(cls); else this.addCls(cls);
                    return !has;
                }
            };
            style = { display: 'block' };
            onclick: any = null;
            
            constructor(private hasCls: (cls: string) => boolean, private addCls: (cls: string) => void, private rmCls: (cls: string) => void) {}
        }

        const ui = {
            viewport: viewportElement,
            overlay: { classList: { add: () => {}, remove: () => {} }, style: { display: 'flex' } },
            loader: { style: { display: 'none' } },
            text: { innerText: 'Drag & Drop .ifc file here' },
            toolbar: { style: { display: 'none' } },
            selectedSpaceInfo: { 
                set innerHTML(val: string) { store().setSelectedSpaceInfo(val); },
                get innerHTML() { return store().selectedSpaceInfo; }
            },
            
            btn3d: new MockBtn(() => store().viewMode === '3d', () => store().setViewMode('3d'), () => store().setViewMode('2d')),
            btn2d: new MockBtn(() => store().viewMode === '2d', () => store().setViewMode('2d'), () => store().setViewMode('3d')),
            
            btnColorFull: new MockBtn(() => store().colorMode === 'full', () => store().setColorMode('full'), () => store().setColorMode('mono')),
            btnColorMono: new MockBtn(() => store().colorMode === 'mono', () => store().setColorMode('mono'), () => store().setColorMode('full')),
            
            btnOrbit: new MockBtn(() => store().cameraMode === 'orbit', () => store().setCameraMode('orbit'), () => store().setCameraMode('walk')),
            btnWalk: new MockBtn(() => store().cameraMode === 'walk', () => store().setCameraMode('walk'), () => store().setCameraMode('orbit')),
            
            btnClip: new MockBtn(() => store().isClipActive, () => store().setIsClipActive(true), () => store().setIsClipActive(false)),
            btnTags: new MockBtn(() => store().isTagsActive, () => store().setIsTagsActive(true), () => store().setIsTagsActive(false)),
            btnSpaces: new MockBtn(() => store().isSpacesActive, () => store().setIsSpacesActive(true), () => store().setIsSpacesActive(false)),
            
            selectLevel: {
                get value() { return store().selectedLevel; },
                set value(val: string) { store().setSelectedLevel(val); },
                style: { display: 'none' },
                onchange: null as any,
                innerHTML: '',
                appendChild: () => {} // Handled by react
            }
        };

        // Inject levels into store instead of DOM options
        const originalAppendChild = ui.selectLevel.appendChild;
        const _levels: any[] = [];
        ui.selectLevel.appendChild = (opt: any) => {
            // intercept level options
        };
        
        // Expose UI mock to the original code
        
        // Replace getElementById('viewport') with viewportElement
        const getElementByIdBackup = document.getElementById;
        document.getElementById = (id) => id === 'viewport' ? viewportElement : getElementByIdBackup.call(document, id);

        

const rendererManager = new RendererManager(viewportElement);
const floorPlanManager = new FloorPlanManager(rendererManager);
const selectionManager = new SelectionManager(rendererManager);

const world = rendererManager.world;
const components = rendererManager.components;
const fragments = components.get(OBC.FragmentsManager);
const casters = components.get(OBC.Raycasters);
casters.get(world);

ui.viewport.addEventListener('dblclick', () => ui.btnClip.classList.contains('active') && ui.selectLevel.value === '' && floorPlanManager.createClipPlane());
window.addEventListener('keydown', e => e.code === 'Delete' && floorPlanManager.deleteClipPlane());

let tags: CSS2DObject[] = [];
let isFragmentsInitialized = false;

const loadIfcFile = async (file: File) => {
    if (!file?.name.toLowerCase().endsWith('.ifc')) return;

    ui.btn3d.classList.add('active');
    ui.btn2d.classList.remove('active');
    ui.btnOrbit.style.display = 'inline-block';
    ui.btnWalk.style.display = 'inline-block';
    ui.btnClip.style.display = 'inline-block';
    try {
        await floorPlanManager.enter3DMode();
    } catch (err) {
        console.warn("Failed to reset camera to Perspective/Orbit on drop:", err);
    }

    tags.forEach(t => {
        if (t.parent) t.parent.remove(t);
        t.element.remove();
    });
    tags = [];

    store().setIsLoading(true);
    store().setLoadingText('Converting IFC (this may take a moment)...');
};

(window as any).loadIfcFile = async (file: File) => {
    if (!file?.name.toLowerCase().endsWith('.ifc')) return;

    ui.btn3d.classList.add('active');
    ui.btn2d.classList.remove('active');
    ui.btnOrbit.style.display = 'inline-block';
    ui.btnWalk.style.display = 'inline-block';
    ui.btnClip.style.display = 'inline-block';
    try {
        await floorPlanManager.enter3DMode();
    } catch (err) {
        console.warn("Failed to reset camera to Perspective/Orbit on drop:", err);
    }

    tags.forEach(t => {
        if (t.parent) t.parent.remove(t);
        t.element.remove();
    });
    tags = [];

    store().setIsLoading(true);
    store().setLoadingText('Converting IFC (this may take a moment)...');

    try {
        const fileKey = (window as any).api.getFilePath(file);
        const { frag, json } = await (window as any).api.processIfc(fileKey);
        const [rawFrag, rawJson] = await Promise.all([
            (window as any).api.readFile(frag),
            (window as any).api.readFile(json)
        ]);
        const fragBytes = new Uint8Array(rawFrag.buffer ?? rawFrag);
        const jsonData = JSON.parse(new TextDecoder().decode(new Uint8Array(rawJson.buffer ?? rawJson)));

        if (fragBytes.byteLength === 0) {
            console.error("❌ CRITICAL: .frag file is EMPTY! The IFC conversion produced no output.");
            store().setLoadingText('Error: .frag file is empty - conversion failed');
            store().setIsLoading(false);
            return;
        }

        if (!isFragmentsInitialized) {
            fragments.init(await OBC.FragmentsManager.getWorker());
            isFragmentsInitialized = true;
        }

        const model = await fragments.core.load(fragBytes, { modelId: `model-${Date.now()}` });
        model.useCamera(world.camera.three);


        const bbox = new THREE.Box3().setFromObject(model.object);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        console.log("📐 [MODEL BBOX DEBUG]", {
            min: { x: bbox.min.x.toFixed(2), y: bbox.min.y.toFixed(2), z: bbox.min.z.toFixed(2) },
            max: { x: bbox.max.x.toFixed(2), y: bbox.max.y.toFixed(2), z: bbox.max.z.toFixed(2) },
            center: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) },
            size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) }
        });

        const verticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
        const modelHeight = verticalAxis === 'y' ? (bbox.max.y - bbox.min.y) : (bbox.max.z - bbox.min.z);

        const hider = components.get(OBC.Hider);
        const bboxer = components.get(OBC.BoundingBoxer);
        const spatialCategories = await model.getItemsOfCategories([
            /IfcSpace/i, /IfcBuildingStorey/i, /IfcBuilding$/i, /IfcSite$/i, /IfcProject$/i, /IfcZone/i, /IfcVirtualElement/i
        ]);
        const allSpatialLocalIds = new Set<number>(Object.values(spatialCategories).flat());

        const isIgnoredSpace = (s: any): boolean => {
            if (!s) return false;
            const name = String(s.name || '').toLowerCase();
            const longName = String(s.longName || '').toLowerCase();
            const objectType = String(s.objectType || '').toLowerCase();
            if (longName && /^\([A-Z]\)\s/i.test(longName)) return true;
            if (name.includes('garden') || longName.includes('garden') || objectType.includes('garden')) return true;
            return false;
        };

        const spaceExpressIds = Object.values(jsonData.elements || {})
            .filter((e: any) => e.type === 'IFCSPACE' && !isIgnoredSpace(e))
            .map((e: any) => e.expressId);
        const spaceLocalIds = await model.getLocalIdsFromItemIds(spaceExpressIds);
        for (const id of spaceLocalIds) allSpatialLocalIds.add(id);

        const expressIdToLocalId = new Map<number, number>();
        await Promise.all(spaceExpressIds.map(async (id) => {
            const localIds = await model.getLocalIdsFromItemIds([id]);
            if (localIds && localIds.length > 0) {
                expressIdToLocalId.set(id, localIds[0]);
            }
        }));

        const spaceMap = { [model.modelId]: allSpatialLocalIds };

        selectionManager.highlighter.selectable = {
            hover: { [model.modelId]: new Set(spaceLocalIds) },
            select: { [model.modelId]: new Set(spaceLocalIds) }
        };

        const spaceMeshes: THREE.Mesh[] = [];
        const spaceLineMeshes: THREE.LineSegments[] = [];
        const spaceCrossMeshes: THREE.LineSegments[] = [];
        const space2dFillMeshes: THREE.Mesh[] = [];
        const space2dOutlineMeshes: (THREE.LineLoop | THREE.LineSegments)[] = [];
        const space2dPickMeshes: THREE.Mesh[] = [];
        // Store world-space 2D polygon coords per space for point-in-polygon click detection
        const spaceWorldPolygons: Map<number, { worldXZ: { x: number, z: number }[], space: any, storeyExpressId: number }> = new Map();

        const highlightWithOpaqueSpaces = async (name: string) => {
            spaceMeshes.forEach(mesh => {
                const makeOpaque = (m: any) => { m.transparent = false; m.opacity = 1.0; m.depthWrite = true; m.depthTest = false; m.needsUpdate = true; };
                if (Array.isArray(mesh.material)) mesh.material.forEach(makeOpaque);
                else makeOpaque(mesh.material);
            });

            const originalRaycastMap = new Map<any, any>();
            world.scene.three.traverse((child: any) => {
                if ((child.isMesh || child.isInstancedMesh || child.isLine || child.isPoints) && !spaceMeshes.includes(child as any)) {
                    originalRaycastMap.set(child, child.raycast);
                    child.raycast = () => { };
                }
            });

            try { await selectionManager.highlighter.highlight(name); } catch (err) { }

            originalRaycastMap.forEach((raycastFn, child) => {
                child.raycast = raycastFn;
            });

            spaceMeshes.forEach(mesh => {
                const makeTransparent = (m: any) => { m.transparent = true; m.opacity = 0.0; m.color.setHex(0x3bb2d0); m.depthWrite = false; m.depthTest = false; m.polygonOffset = true; m.polygonOffsetFactor = -1.0; m.polygonOffsetUnits = -1.0; m.needsUpdate = true; };
                if (Array.isArray(mesh.material)) mesh.material.forEach(makeTransparent);
                else makeTransparent(mesh.material);
            });
        };

        const isFloorPlanActive = (): boolean => {
            return ui.btn2d.classList.contains('active') || ui.btnClip.classList.contains('active');
        };

        const raycastSpaceUnderCursor = (e: MouseEvent): { space: any; expressId: number } | null => {
            if (!ui.btn2d.classList.contains('active')) return null;

            // Unproject screen click to world coordinates using orthographic camera
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
            const clickX = worldPos.x;
            const clickZ = worldPos.z;

            const activeLevelId = ui.selectLevel.value;

            // Point-in-polygon test for each space on the active floor
            const pointInPoly = (px: number, pz: number, poly: { x: number, z: number }[]): boolean => {
                let inside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = poly[i].x, zi = poly[i].z;
                    const xj = poly[j].x, zj = poly[j].z;
                    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            for (const [expressId, data] of spaceWorldPolygons) {
                if (activeLevelId && String(data.storeyExpressId) !== String(activeLevelId)) continue;
                if (pointInPoly(clickX, clickZ, data.worldXZ)) {
                    return { space: data.space, expressId };
                }
            }

            return null;
        };

        const setSelectedSpaceHighlight = (expressId: number | null, isHover: boolean = false) => {
            // Allow space planes visible in both 2D and 3D for diagnosis

            if (!isHover) {
                (window as any)._currentlySelectedExpressId = expressId;
            }
            const currentSelectedId = (window as any)._currentlySelectedExpressId;
            const activeLevelId = ui.selectLevel.value;

            // 1. Update 2D Fill Meshes (Revit Blue for both Hover and Selection)
            space2dFillMeshes.forEach(mesh => {
                const meshExpressId = (mesh as any).spaceExpressId;
                const storeyId = (mesh as any).storeyExpressId;
                const mat = mesh.material as THREE.MeshBasicMaterial;

                if (activeLevelId && storeyId !== undefined && String(storeyId) !== String(activeLevelId)) {
                    mesh.visible = false;
                    return;
                }

                const isSelected = currentSelectedId !== null && currentSelectedId !== undefined && String(meshExpressId) === String(currentSelectedId);
                const isHovered = isHover && expressId !== null && String(meshExpressId) === String(expressId);

                // ALWAYS visible on active floor!
                mesh.visible = true;

                if (isSelected) {
                    mat.color.setHex(0x3b82f6); // Vivid Revit Blue Selected Fill
                    mat.opacity = 0.65;
                    mat.depthTest = false;
                    mat.depthWrite = false;
                    mesh.renderOrder = 9999;
                } else if (isHovered) {
                    mat.color.setHex(0x60a5fa); // Soft Blue Hover Fill
                    mat.opacity = 0.45;
                    mat.depthTest = false;
                    mat.depthWrite = false;
                    mesh.renderOrder = 9995;
                } else {
                    mat.opacity = 0.0; // Transparent (invisible) till clicked or hovered
                    mat.depthTest = false;
                    mat.depthWrite = false;
                    mesh.renderOrder = 9990;
                }
            });

            // 2. Update 3D Crosshair 'X' Lines (Revit Blue 'X' for Hover and Selection)
            spaceCrossMeshes.forEach(c => {
                const meshExpressId = (c as any).expressId;
                const storeyId = (c as any).storeyId;

                if (activeLevelId && storeyId !== undefined && String(storeyId) !== String(activeLevelId)) {
                    c.visible = false;
                    return;
                }

                const isSelected = currentSelectedId !== null && String(meshExpressId) === String(currentSelectedId);
                const isHovered = isHover && expressId !== null && String(meshExpressId) === String(expressId);

                if (isSelected || isHovered) {
                    c.visible = true;
                    (c.material as THREE.LineBasicMaterial).color.setHex(0x1d4ed8); // Revit Blue 'X'
                    (c.material as THREE.LineBasicMaterial).depthTest = false;
                    c.renderOrder = 995;
                } else {
                    c.visible = false;
                }
            });

            // 3. Update Line Boundary Meshes & 2D Outline Loops
            space2dOutlineMeshes.forEach(outline => {
                const meshExpressId = (outline as any).spaceExpressId;
                const storeyId = (outline as any).storeyExpressId;

                if (activeLevelId && storeyId !== undefined && String(storeyId) !== String(activeLevelId)) {
                    outline.visible = false;
                    return;
                }

                const isSelected = currentSelectedId !== null && currentSelectedId !== undefined && String(meshExpressId) === String(currentSelectedId);
                const isHovered = isHover && expressId !== null && String(meshExpressId) === String(expressId);

                if (isSelected || isHovered) {
                    outline.visible = true;
                    (outline.material as THREE.LineBasicMaterial).color.setHex(0xf59e0b); // Bright Amber Gold Highlight Outline
                    (outline.material as THREE.LineBasicMaterial).depthTest = false;
                    (outline.material as THREE.LineBasicMaterial).depthWrite = false;
                    outline.renderOrder = 999;
                } else {
                    const is2DView = ui.btn2d.classList.contains('active');
                    const isSpacesActive = is2DView && ui.btnSpaces.classList.contains('active');
                    if (isSpacesActive) {
                        outline.visible = true;
                        (outline.material as THREE.LineBasicMaterial).color.setHex(0xd1d5db); // Light-grey wall partition border
                        (outline.material as THREE.LineBasicMaterial).depthTest = false;
                        (outline.material as THREE.LineBasicMaterial).depthWrite = false;
                        outline.renderOrder = 993;
                    } else {
                        outline.visible = false;
                    }
                }
            });
        };

        let isDragging = false, startX = 0, startY = 0;
        ui.viewport.addEventListener('mousedown', (e: MouseEvent) => { isDragging = false; startX = e.clientX; startY = e.clientY; });
        ui.viewport.addEventListener('mousemove', async (e: MouseEvent) => {
            if (e.buttons !== 0) { isDragging = true; return; }
            if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true;

            const hit = raycastSpaceUnderCursor(e);
            if (hit) {
                ui.viewport.style.cursor = 'pointer';
                setSelectedSpaceHighlight(hit.expressId, true);
            } else {
                ui.viewport.style.cursor = 'default';
                setSelectedSpaceHighlight(null, true);
            }
        });

        ui.viewport.addEventListener('click', async (e: MouseEvent) => {
            if (isDragging) return;

            const hit = raycastSpaceUnderCursor(e);
            if (hit) {
                setSelectedSpaceHighlight(hit.expressId, false);
                displaySelectedSpaceInfo(hit.space);
                return;
            } else {
                setSelectedSpaceHighlight(null, false);
                ui.selectedSpaceInfo.innerHTML = `Click on a space in 3D view to select it.`;
            }
        });

        selectionManager.highlighter.events.select.onHighlight.add((m: any) => {
            const ids = m[model.modelId];
            if (ids && ids.size > 0) {
                const itemVal = Array.from(ids)[0] as number;
                let expressId: number | undefined = itemVal;
                // If itemVal is a localId, look up expressId
                for (const [expId, locId] of expressIdToLocalId.entries()) {
                    if (locId === itemVal) { expressId = expId; break; }
                }
                if (expressId !== undefined) {
                    setSelectedSpaceHighlight(expressId);
                    const space = Object.values(jsonData.elements || {}).find((e: any) => e.type === 'IFCSPACE' && e.expressId === expressId) as any;
                    if (space && (displaySelectedSpaceInfo as any)) {
                        displaySelectedSpaceInfo(space);
                    }
                }
            }
        });

        selectionManager.highlighter.events.select.onClear.add(() => {
            setSelectedSpaceHighlight(null);
            ui.selectedSpaceInfo.innerHTML = `Click on a space in 3D view to select it.`;
        });

        await fragments.core.update(true);
        world.scene.three.add(model.object);
        world.camera.controls.fitToSphere(model.object, true);
        world.camera.controls.addEventListener("update", () => fragments.core.update());

        const maxDim = Math.max(size.x, size.y, size.z);
        world.camera.three.near = 1.0;
        world.camera.three.far = Math.max(3000, maxDim * 6);
        world.camera.three.updateProjectionMatrix();

        const spaceCenters = new Map<number, THREE.Vector3>();
        const allSpaceLocalIdsSet = new Set(spaceLocalIds);
        model.object.traverse((child: any) => {
            child.frustumCulled = false;
            if (child.isInstancedMesh && child.fragment && child.fragment.ids) {
                const firstId = Array.from(child.fragment.ids as Set<number>)[0];
                if (allSpaceLocalIdsSet.has(firstId)) {
                    spaceMeshes.push(child);
                    const fixSpaceMaterial = (m: any) => { m.side = THREE.DoubleSide; m.transparent = true; m.opacity = 0.0; m.color.setHex(0x3bb2d0); m.depthWrite = false; m.depthTest = false; m.polygonOffset = true; m.polygonOffsetFactor = -1.0; m.polygonOffsetUnits = -1.0; m.needsUpdate = true; };
                    if (Array.isArray(child.material)) child.material.forEach(fixSpaceMaterial); else fixSpaceMaterial(child.material);

                    const ids = Array.from(child.fragment.ids as Set<number>);
                    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                    const baseBox = child.geometry.boundingBox;
                    const edgesGeom = new THREE.EdgesGeometry(child.geometry);
                    const posAttr = edgesGeom.attributes.position;
                    if (posAttr) {
                        for (let k = 0; k < posAttr.count; k++) {
                            if (verticalAxis === 'y') posAttr.setY(k, 0); else posAttr.setZ(k, 0);
                        }
                        posAttr.needsUpdate = true;
                    }
                    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a, transparent: false, depthWrite: true, depthTest: false });

                    const localIdToExpressId = new Map<number, number>();
                    for (const [expId, locId] of expressIdToLocalId.entries()) localIdToExpressId.set(locId, expId);

                    const offsetVal = (modelHeight > 100) ? 50.0 : 0.05;
                    for (let i = 0; i < child.count; i++) {
                        const localId = ids[i];
                        const expressId = localIdToExpressId.get(localId);
                        if (expressId !== undefined) {
                            const parentStorey = storeys.find(st => st.spaces.some(sp => sp.expressId === expressId));
                            const storeyId = parentStorey ? parentStorey.expressId : 0;
                            const matrix = new THREE.Matrix4();
                            child.getMatrixAt(i, matrix);

                            const outline = new THREE.LineSegments(edgesGeom, lineMat);
                            outline.applyMatrix4(matrix);
                            if (verticalAxis === 'y') outline.position.y += offsetVal; else outline.position.z += offsetVal;
                            (outline as any).expressId = expressId;
                            (outline as any).storeyId = storeyId;
                            outline.visible = false;
                            outline.renderOrder = 1;
                            world.scene.three.add(outline);
                            spaceLineMeshes.push(outline);

                            if (baseBox) {
                                const instanceBox = new THREE.Box3().copy(baseBox).applyMatrix4(matrix);
                                const origin = new THREE.Vector3().setFromMatrixPosition(matrix);
                                const center = new THREE.Vector3();
                                instanceBox.getCenter(center);

                                // In Revit, the IfcSpace local origin matches the manual Room Location Point.
                                // If the origin is identical to the building center (0,0,0), fallback to geometric center.
                                const isOriginValid = origin.lengthSq() > 0.001 && origin.distanceTo(center) < Math.max(instanceBox.max.x - instanceBox.min.x, instanceBox.max.z - instanceBox.min.z);
                                spaceCenters.set(expressId, isOriginValid ? origin : center);

                                let pt1, pt2, pt3, pt4;
                                if (verticalAxis === 'y') {
                                    const y = instanceBox.max.y + offsetVal + 0.1;
                                    pt1 = new THREE.Vector3(instanceBox.min.x, y, instanceBox.min.z);
                                    pt2 = new THREE.Vector3(instanceBox.max.x, y, instanceBox.max.z);
                                    pt3 = new THREE.Vector3(instanceBox.min.x, y, instanceBox.max.z);
                                    pt4 = new THREE.Vector3(instanceBox.max.x, y, instanceBox.min.z);
                                } else {
                                    const z = instanceBox.max.z + offsetVal + 0.1;
                                    pt1 = new THREE.Vector3(instanceBox.min.x, instanceBox.min.y, z);
                                    pt2 = new THREE.Vector3(instanceBox.max.x, instanceBox.max.y, z);
                                    pt3 = new THREE.Vector3(instanceBox.min.x, instanceBox.max.y, z);
                                    pt4 = new THREE.Vector3(instanceBox.max.x, instanceBox.min.y, z);
                                }
                                const crossGeom = new THREE.BufferGeometry().setFromPoints([pt1, pt2, pt3, pt4]);
                                const crossMat = new THREE.LineBasicMaterial({ color: 0x0055ff, transparent: false, depthWrite: false, depthTest: false, linewidth: 2 });
                                const crossLine = new THREE.LineSegments(crossGeom, crossMat);
                                (crossLine as any).expressId = expressId;
                                crossLine.visible = false;
                                crossLine.renderOrder = 3;
                                world.scene.three.add(crossLine);
                                spaceCrossMeshes.push(crossLine);
                            }
                        }
                    }
                    return;
                }
            }
            if ((child.isMesh || child.isInstancedMesh) && child.material) {
                const fixMaterial = (m: any) => { m.side = THREE.DoubleSide; if (child.isInstancedMesh && m.color) m.color.setHex(0x555555); m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; m.needsUpdate = true; };
                if (Array.isArray(child.material)) child.material.forEach(fixMaterial); else fixMaterial(child.material);
            }
        });





        const findNodeById = (node: any, id: number): any => {
            if (!node) return null;
            if (node.expressId === id) return node;
            if (node.children) {
                for (const child of node.children) {
                    const found = findNodeById(child, id);
                    if (found) return found;
                }
            }
            return null;
        };

        const getStoreyElements = (node: any, expressIds: number[]) => {
            if (!node) return;
            if (node.expressId) expressIds.push(node.expressId);
            if (node.children) {
                node.children.forEach((c: any) => getStoreyElements(c, expressIds));
            }
        };

        const areaPattern = /^\([A-Z]\)\s/i;
        const storeys: { name: string; elevation: number; expressId: number; spaces: any[]; localSpaceIds: Set<number>; localElementIds: Set<number> }[] = [];
        const findStoreys = (node: any) => {
            if (!node) return;
            if (node.type === 'IFCBUILDINGSTOREY') {
                const spaceChildren = (node.children || []).filter((c: any) => {
                    if (c.type !== 'IFCSPACE') return false;
                    if (c.longName && areaPattern.test(c.longName)) return false;
                    return true;
                });
                storeys.push({
                    name: node.name || 'Unnamed Level',
                    elevation: typeof node.elevation === 'number' ? node.elevation : 0,
                    expressId: node.expressId,
                    spaces: spaceChildren,
                    localSpaceIds: new Set<number>(),
                    localElementIds: new Set<number>()
                });
            }
            if (node.children) node.children.forEach(findStoreys);
        };
        findStoreys(jsonData.project);
        storeys.sort((a, b) => a.elevation - b.elevation);

        for (const s of storeys) {
            const ids = s.spaces.map(sp => sp.expressId);
            const localIds = await model.getLocalIdsFromItemIds(ids);
            s.localSpaceIds = new Set(localIds);

            const storeyNode = findNodeById(jsonData.project, s.expressId);
            const elemExpressIds: number[] = [];
            getStoreyElements(storeyNode, elemExpressIds);
            const localElemIds = await model.getLocalIdsFromItemIds(elemExpressIds);
            s.localElementIds = new Set(localElemIds);
        }

        ui.selectLevel.innerHTML = '<option value="">All Levels (No Cut)</option>';
        storeys.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.expressId.toString();
            opt.innerText = `${s.name} (${(s.elevation / 1000).toFixed(2)}m)`;
            
            _levels.push({ expressId: opt.value, name: opt.innerText.split(' (')[0], elevation: parseFloat(opt.innerText.match(/\((.*?)\)/)?.[1] || '0') * 1000 });
            store().setLevels(_levels);
        
        });

        const getWorldHeight = (elevation: number): number => {
            const curBBox = new THREE.Box3().setFromObject(model.object);
            const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
            const height = currentVerticalAxis === 'y' ? (curBBox.max.y - curBBox.min.y) : (curBBox.max.z - curBBox.min.z);
            const scale = height > 100 ? 1.0 : 0.001;
            const bottomCoordinate = currentVerticalAxis === 'y' ? curBBox.min.y : curBBox.min.z;
            const lowestStoreyElevation = storeys.length > 0 ? storeys[0].elevation : 0;
            return bottomCoordinate + (elevation - lowestStoreyElevation) * scale;
        };

        const update2dSpaceOverlays = (selectedExpressId: string) => {
            const is2DView = ui.btn2d.classList.contains('active');
            const isSpacesActive = is2DView && ui.btnSpaces.classList.contains('active');
            const activeExpressId = (window as any)._currentlySelectedExpressId;

            space2dFillMeshes.forEach(mesh => {
                const storeyId = (mesh as any).storeyExpressId;
                const meshExpressId = (mesh as any).spaceExpressId;
                const mat = mesh.material as THREE.MeshBasicMaterial;

                mat.depthTest = false;
                mat.depthWrite = false;

                if (selectedExpressId !== '' && storeyId !== undefined && String(storeyId) !== String(selectedExpressId)) {
                    mesh.visible = false;
                } else {
                    mesh.visible = true;
                    if (activeExpressId !== null && activeExpressId !== undefined && String(meshExpressId) === String(activeExpressId)) {
                        mat.color.setHex(0x3b82f6);
                        mat.opacity = 0.65;
                        mesh.renderOrder = 9999;
                    } else {
                        mat.opacity = 0.0; // Transparent (invisible) till clicked or hovered
                        mesh.renderOrder = 9990;
                    }
                }
            });

            space2dOutlineMeshes.forEach(mesh => {
                const storeyId = (mesh as any).storeyExpressId;
                if (!isSpacesActive && !activeExpressId) {
                    mesh.visible = false;
                } else if (selectedExpressId !== '') {
                    mesh.visible = (storeyId !== undefined && String(storeyId) === String(selectedExpressId));
                } else {
                    mesh.visible = true;
                }
            });

            // Space Pick Meshes visible in 3D View as well for diagnosis
            space2dPickMeshes.forEach(mesh => {
                const storeyId = (mesh as any).storeyExpressId;
                if (selectedExpressId !== '') {
                    mesh.visible = (storeyId !== undefined && String(storeyId) === String(selectedExpressId));
                } else {
                    mesh.visible = true;
                }
            });
        };

        const getSpaceCoordinatesDebug = (space: any) => {
            const parentStorey = storeys.find(st => st.spaces.some(sp => sp.expressId === space.expressId));
            const curBBox = new THREE.Box3().setFromObject(model.object);
            const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
            const modelHeight = currentVerticalAxis === 'y' ? (curBBox.max.y - curBBox.min.y) : (curBBox.max.z - curBBox.min.z);
            const scale = modelHeight > 100 ? 1.0 : 0.001;

            // 1. Actual Model Placed Space World Coordinate
            let actualPos: THREE.Vector3;
            if (spaceCenters.has(space.expressId)) {
                actualPos = spaceCenters.get(space.expressId)!.clone();
            } else if (space.spaceCenter) {
                actualPos = localToWorld(space.spaceCenter.x, space.spaceCenter.y, space.spaceCenter.z);
            } else if (space.placement?.position) {
                actualPos = localToWorld(space.placement.position.x, space.placement.position.y, space.placement.position.z);
            } else {
                actualPos = new THREE.Vector3(0, 0, 0);
            }

            if (model.object && model.object.matrixWorld) {
                actualPos.applyMatrix4(model.object.matrixWorld);
            }

            // 2. Compute Alignment Shift
            const poly = space.polygon || [];
            let shiftX = 0, shiftZ = 0, targetY = actualPos.y;
            if (Array.isArray(poly) && poly.length > 0) {
                let rawSumX = 0, rawSumY = 0;
                poly.forEach((pt: any) => { rawSumX += pt.x; rawSumY += pt.y; });
                const rawCentroidX = (rawSumX / poly.length) * scale;
                const rawCentroidY = (rawSumY / poly.length) * scale;
                shiftX = actualPos.x - rawCentroidX;
                shiftZ = currentVerticalAxis === 'y' ? (actualPos.z - (-rawCentroidY)) : 0;
            }

            // 3. Blue Highlighted Model Aligned World Coordinates
            const blueWorldVertices: THREE.Vector3[] = [];
            if (Array.isArray(poly) && poly.length > 0) {
                poly.forEach((pt: any) => {
                    const wx = pt.x * scale + shiftX;
                    const wy = pt.y * scale;
                    if (currentVerticalAxis === 'y') {
                        const wz = -pt.y * scale + shiftZ;
                        blueWorldVertices.push(new THREE.Vector3(wx, targetY + 0.05, wz));
                    } else {
                        blueWorldVertices.push(new THREE.Vector3(wx, wy, targetY + 0.05));
                    }
                });
            }

            let blueCentroid = new THREE.Vector3(0, 0, 0);
            if (blueWorldVertices.length > 0) {
                let sumX = 0, sumY = 0, sumZ = 0;
                blueWorldVertices.forEach(v => { sumX += v.x; sumY += v.y; sumZ += v.z; });
                blueCentroid.set(sumX / blueWorldVertices.length, sumY / blueWorldVertices.length, sumZ / blueWorldVertices.length);
            }

            const delta = new THREE.Vector3().subVectors(actualPos, blueCentroid);
            const distance = actualPos.distanceTo(blueCentroid);

            return {
                actualPos,
                blueWorldVertices,
                blueCentroid,
                delta,
                distance,
                polyCount: poly.length
            };
        };

        const displaySelectedSpaceInfo = (space: any) => {
            const parentStorey = storeys.find(st => st.spaces.some(sp => sp.expressId === space.expressId));
            const floorLabel = parentStorey ? parentStorey.name : 'Unknown Floor';
            const info = getSpaceCoordinatesDebug(space);

            const actualStr = `X: ${info.actualPos.x.toFixed(3)}, Y: ${info.actualPos.y.toFixed(3)}, Z: ${info.actualPos.z.toFixed(3)}`;
            const blueCentroidStr = `X: ${info.blueCentroid.x.toFixed(3)}, Y: ${info.blueCentroid.y.toFixed(3)}, Z: ${info.blueCentroid.z.toFixed(3)}`;
            const deltaStr = `ΔX: ${info.delta.x.toFixed(3)}, ΔY: ${info.delta.y.toFixed(3)}, ΔZ: ${info.delta.z.toFixed(3)}`;

            const vertListHtml = info.blueWorldVertices.map((v, i) =>
                `[${i}] X: ${v.x.toFixed(2)}, Y: ${v.y.toFixed(2)}, Z: ${v.z.toFixed(2)}`
            ).join('<br/>');

            ui.selectedSpaceInfo.innerHTML = `
                <div style="margin-bottom: 6px;"><strong>Name:</strong> ${space.longName || 'Room'}</div>
                <div style="margin-bottom: 6px;"><strong>Number:</strong> ${space.name || ''}</div>
                <div style="margin-bottom: 6px;"><strong>Level:</strong> ${floorLabel}</div>
                <div style="margin-bottom: 6px;"><strong>Area:</strong> ${space.quantities?.Area?.toFixed(2) || 0} m²</div>
                <div style="margin-bottom: 6px;"><strong>Height:</strong> ${space.quantities?.Height?.toFixed(2) || 0} mm</div>
                <div style="margin-bottom: 6px;"><strong>Volume:</strong> ${space.quantities?.NetVolume?.toFixed(2) || 0} m³</div>
            `;

            console.log(`[Space Select Debug] Space #${space.expressId} (${space.name || ''} - ${space.longName || ''})`, {
                expressId: space.expressId,
                actualModelPlacedCoord: info.actualPos,
                blueModelCentroidCoord: info.blueCentroid,
                offsetDelta: info.delta,
                distanceOffsetMeters: info.distance,
                blueModelWorldVertices: info.blueWorldVertices
            });
        };

        const log2dSpaceDebugInfo = (selectedExpressId: string) => {
            const storey = storeys.find(st => st.expressId.toString() === selectedExpressId);
            const targetStoreys = storey ? [storey] : storeys;
            const spaceDataMap = Object.values(jsonData.elements || {}).filter((e: any) => e.type === 'IFCSPACE') as any[];

            targetStoreys.forEach(st => {
                const tableData: any[] = [];
                const detailedLogs: any[] = [];

                st.spaces.forEach(sp => {
                    const fullSpace = spaceDataMap.find((e: any) => e.expressId === sp.expressId);
                    if (!fullSpace) return;

                    const info = getSpaceCoordinatesDebug(fullSpace);

                    const actualStr = `(${info.actualPos.x.toFixed(2)}, ${info.actualPos.y.toFixed(2)}, ${info.actualPos.z.toFixed(2)})`;
                    const blueCentroidStr = `(${info.blueCentroid.x.toFixed(2)}, ${info.blueCentroid.y.toFixed(2)}, ${info.blueCentroid.z.toFixed(2)})`;
                    const deltaStr = `(${info.delta.x.toFixed(2)}, ${info.delta.y.toFixed(2)}, ${info.delta.z.toFixed(2)})`;

                    tableData.push({
                        'Space ID': sp.expressId,
                        'Name': fullSpace.name || sp.name || '',
                        'Long Name': fullSpace.longName || sp.longName || 'Room',
                        'Actual Model Placed Space (World)': actualStr,
                        'Blue Model Centroid (World)': blueCentroidStr,
                        'Offset Δ (Actual - Blue)': deltaStr,
                        'Dist (m)': info.distance.toFixed(2),
                        'Vertices': info.blueWorldVertices.length
                    });

                    detailedLogs.push({
                        spaceId: sp.expressId,
                        name: fullSpace.name || sp.name,
                        longName: fullSpace.longName || sp.longName,
                        actualModelPlacedPos: info.actualPos,
                        blueModelCentroid: info.blueCentroid,
                        offsetDelta: info.delta,
                        distanceOffsetMeters: info.distance,
                        blueModelVerticesWorld: info.blueWorldVertices.map(v => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) }))
                    });
                });

                console.group(`🔍 [SPACE DEBUG COORDINATES] Storey: ${st.name} (${st.spaces.length} Spaces)`);
                console.log('📌 COMPARISON: Actual Model Placed Coordinates VS Blue Highlighted Model Coordinates');
                console.table(tableData);
                console.groupCollapsed('📋 Detailed World Coordinates & Vertices List (Click to Expand)');
                detailedLogs.forEach(log => console.log(`Space #${log.spaceId} [${log.name} - ${log.longName}]`, log));
                console.groupEnd();
                console.groupEnd();
            });
        };

        const updateTagsForLevel = (selectedExpressId: string) => {
            update2dSpaceOverlays(selectedExpressId);
            tags.forEach(t => {
                t.visible = false;
                if ((t as any).element) { (t as any).element.style.opacity = '0'; (t as any).element.style.display = 'none'; }
            });
            if (!ui.btnTags.classList.contains('active')) return;
            if (!ui.btnClip.classList.contains('active') && !ui.btn2d.classList.contains('active')) return;
            if (selectedExpressId === '') return;
            const storey = storeys.find(st => st.expressId.toString() === selectedExpressId);
            if (!storey) return;
            const worldFloorHeight = getWorldHeight(storey.elevation);
            const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';

            tags.forEach(t => {
                const space = (t as any).originalSpace;
                if (space && storey.spaces.some(sp => String(sp.expressId) === String(space.expressId))) {
                    t.visible = true;
                    if ((t as any).element) { (t as any).element.style.opacity = '1'; (t as any).element.style.display = 'block'; }
                    if ((t as any).worldCenter) {
                        const wc = (t as any).worldCenter;
                        if (currentVerticalAxis === 'y') t.position.set(wc.x, worldFloorHeight + 1.5, wc.z);
                        else t.position.set(wc.x, wc.y, worldFloorHeight + 1.5);
                    }
                }
            });

            log2dSpaceDebugInfo(selectedExpressId);
        };

        ui.selectLevel.onchange = async () => {
            const val = ui.selectLevel.value;
            selectionManager.clear();
            await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
            floorPlanManager.activePlaneId = null;

            if (val === '') {
                const allElementIds = new Set<number>();
                storeys.forEach(s => s.localElementIds.forEach(id => allElementIds.add(id)));
                await hider.set(true, { [model.modelId]: allElementIds });
                await hider.set(false, spaceMap);
                updateTagsForLevel('');
                spaceLineMeshes.forEach(line => line.visible = false);
                return;
            }

            const storey = storeys.find(st => st.expressId.toString() === val);
            if (!storey) return;

            const index = storeys.indexOf(storey);
            const cutElevation = (index < storeys.length - 1) ? storeys[index + 1].elevation : storey.elevation + 4000;
            const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
            const worldHeight = getWorldHeight(cutElevation);
            const worldCutPoint = currentVerticalAxis === 'y' ? new THREE.Vector3(0, worldHeight, 0) : new THREE.Vector3(0, 0, worldHeight);
            const normal = currentVerticalAxis === 'y' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1);
            floorPlanManager.activePlaneId = floorPlanManager.clipper.createFromNormalAndCoplanarPoint(world, normal, worldCutPoint);
            const list = floorPlanManager.clipper.list as any;
            const plane = list?.get ? list.get(floorPlanManager.activePlaneId) : (list && typeof list.values === 'function' ? Array.from(list.values()).find((p: any) => p.id === floorPlanManager.activePlaneId) : null);
            if (plane) { plane.visible = false; if (plane.controls) { (plane.controls as any).visible = false; (plane.controls as any).enabled = false; } }

            // Hide spaces of other storeys, show spaces of this storey
            const activeSpacesSet = storey.localSpaceIds;
            const inactiveSpacesSet = new Set<number>();
            for (const id of spaceLocalIds) if (!activeSpacesSet.has(id)) inactiveSpacesSet.add(id);

            await hider.set(false, { [model.modelId]: inactiveSpacesSet });
            const is2DView = ui.btn2d.classList.contains('active');
            const showSpaces = is2DView && ui.btnSpaces.classList.contains('active');
            await hider.set(showSpaces, { [model.modelId]: activeSpacesSet });

            // Hide elements of upper storeys so they don't block 2D top view
            const upperStoreyElements = new Set<number>();
            const lowerAndCurrentStoreyElements = new Set<number>();

            for (const s of storeys) {
                if (s.elevation > storey.elevation) {
                    s.localElementIds.forEach(id => upperStoreyElements.add(id));
                } else {
                    s.localElementIds.forEach(id => lowerAndCurrentStoreyElements.add(id));
                }
            }
            await hider.set(false, { [model.modelId]: upperStoreyElements });
            await hider.set(true, { [model.modelId]: lowerAndCurrentStoreyElements });

            updateTagsForLevel(val);
            spaceLineMeshes.forEach(line => { line.visible = showSpaces && ((line as any).storeyId === storey.expressId); });

            if (is2DView) {
                const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
                const storeyIdx = sortedStoreys.findIndex(st => st.expressId === storey.expressId);
                const planeElevation = storeyIdx > 0 ? sortedStoreys[storeyIdx - 1].elevation : 0;
                const planeY = getWorldHeight(planeElevation);

                const cam = world.camera.three;
                cam.position.y = planeY + 50;
                world.camera.controls.setTarget(world.camera.controls.getTarget(new THREE.Vector3()).x, planeY, world.camera.controls.getTarget(new THREE.Vector3()).z, true);
                if ((cam as any).isOrthographicCamera) {
                    (cam as any).near = -10000;
                    (cam as any).far = 10000;
                    (cam as any).updateProjectionMatrix();
                }
                await world.camera.controls.rotateTo(0, 0, true);
                await world.camera.controls.fitToSphere(model.object, true);
            }
        };

        ui.btnClip.onclick = async () => {
            const act = ui.btnClip.classList.toggle('active');
            if (!act) {
                ui.selectLevel.value = ''; ui.selectLevel.style.display = 'none';
                await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
                floorPlanManager.activePlaneId = null;
                await hider.set(false, spaceMap);
                updateTagsForLevel('');
                selectionManager.clear();
                spaceLineMeshes.forEach(line => line.visible = false);
            } else { 
                ui.selectLevel.style.display = 'inline-block'; 
                if (lastHoveredId !== null || ui.selectedSpaceInfo.innerHTML !== 'Click on a space in 2D view to select it.') {
                    lastHoveredId = null;
                    setSelectedSpaceHighlight(-1, false);
                    ui.selectedSpaceInfo.innerHTML = 'Click on a space in 2D view to select it.';
                }
                await (ui.selectLevel as any).onchange();
            }
        };

        ui.btnTags.onclick = () => { ui.btnTags.classList.toggle('active'); updateTagsForLevel(ui.selectLevel.value); };

        ui.btnSpaces.onclick = async () => {
            const act = ui.btnSpaces.classList.toggle('active');
            const is2DView = ui.btn2d.classList.contains('active');
            if (is2DView) {
                await hider.set(act, spaceMap);
                const val = ui.selectLevel.value;
                spaceLineMeshes.forEach(line => {
                    if (val === '') line.visible = act;
                    else line.visible = act && String((line as any).storeyId) === val;
                });
                updateTagsForLevel(val);

                // Set 2D camera elevation to match below-floor plane level
                if (ui.btn2d.classList.contains('active')) {
                    const selectedStorey = storeys.find(st => String(st.expressId) === String(val));
                    if (selectedStorey) {
                        const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
                        const storeyIdx = sortedStoreys.findIndex(st => st.expressId === selectedStorey.expressId);
                        const planeElevation = storeyIdx > 0 ? sortedStoreys[storeyIdx - 1].elevation : 0;
                        const planeY = getWorldHeight(planeElevation);

                        const cam = world.camera.three;
                        cam.position.y = planeY + 50;
                        if ((cam as any).isOrthographicCamera) {
                            (cam as any).near = -10000;
                            (cam as any).far = 10000;
                            (cam as any).updateProjectionMatrix();
                        }
                    }
                }
            } else {
                await hider.set(false, spaceMap);
                spaceLineMeshes.forEach(line => line.visible = false);
                updateTagsForLevel('');
            }
        };

        ui.btn2d.onclick = async () => {
            if (ui.btn2d.classList.contains('active')) return;
            ui.btn2d.classList.add('active'); ui.btn3d.classList.remove('active');
            ui.btnOrbit.style.display = 'none'; ui.btnWalk.style.display = 'none'; ui.btnClip.style.display = 'none';
            if (ui.btnWalk.classList.contains('active')) { document.exitPointerLock(); ui.btnWalk.classList.remove('active'); ui.btnOrbit.classList.add('active'); }
            ui.selectLevel.style.display = 'inline-block';
            await floorPlanManager.enter2DMode();
            if (!ui.btnSpaces.classList.contains('active')) { ui.btnSpaces.classList.add('active'); }
            if (!ui.btnTags.classList.contains('active')) { ui.btnTags.classList.add('active'); }
            await hider.set(ui.btnSpaces.classList.contains('active'), spaceMap);
            // Default specifically to Ground Floor when opening 2D View
            const gfStorey = storeys.find(st => /ground/i.test(st.name) || /^gf/i.test(st.name)) || storeys.find(st => st.spaces && st.spaces.length > 0) || storeys[0];
            if (gfStorey) {
                ui.selectLevel.value = gfStorey.expressId.toString();
            }
            await (ui.selectLevel as any).onchange();
        };

        ui.btn3d.onclick = async () => {
            if (ui.btn3d.classList.contains('active')) return;
            ui.btn3d.classList.add('active'); ui.btn2d.classList.remove('active');
            ui.btnOrbit.style.display = 'inline-block'; ui.btnWalk.style.display = 'inline-block'; ui.btnClip.style.display = 'inline-block';
            await floorPlanManager.enter3DMode();
            await hider.set(false, spaceMap);
            spaceLineMeshes.forEach(line => line.visible = false);
            space2dFillMeshes.forEach(mesh => mesh.visible = false);
            space2dOutlineMeshes.forEach(mesh => mesh.visible = false);
            spaceCrossMeshes.forEach(c => c.visible = false);
            updateTagsForLevel('');
            
            if (lastHoveredId !== null || ui.selectedSpaceInfo.innerHTML !== 'Click on a space in 2D view to select it.') {
                lastHoveredId = null;
                setSelectedSpaceHighlight(-1, false);
                ui.selectedSpaceInfo.innerHTML = 'Click on a space in 2D view to select it.';
            }

            if (ui.btnClip.classList.contains('active')) {
                ui.selectLevel.style.display = 'inline-block'; 
                if (lastHoveredId !== null || ui.selectedSpaceInfo.innerHTML !== 'Click on a space in 2D view to select it.') {
                    lastHoveredId = null;
                    setSelectedSpaceHighlight(-1, false);
                    ui.selectedSpaceInfo.innerHTML = 'Click on a space in 2D view to select it.';
                }
                await (ui.selectLevel as any).onchange();
            } else {
                ui.selectLevel.value = ''; ui.selectLevel.style.display = 'none';
                await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
                floorPlanManager.activePlaneId = null;
                updateTagsForLevel('');
            }
            world.camera.controls.fitToSphere(model.object, true);
        };

        const applyGrayscaleMode = (enableGrayscale: boolean) => {
            if (!model || !model.object) return;
            model.object.traverse((child: any) => {
                if ((child.isMesh || child.isInstancedMesh) && child.material && !spaceMeshes.includes(child as any) && !space2dFillMeshes.includes(child as any)) {
                    if (!child._originalMaterial) {
                        child._originalMaterial = child.material;
                    }
                    if (enableGrayscale) {
                        if (!child._grayscaleMaterial) {
                            if (Array.isArray(child.material)) {
                                child._grayscaleMaterial = child.material.map((m: any) => {
                                    const clone = m.clone();
                                    if (clone.color) {
                                        const lum = clone.color.r * 0.299 + clone.color.g * 0.587 + clone.color.b * 0.114;
                                        const neutralLum = Math.max(0.45, Math.min(0.82, lum > 0 ? lum : 0.70));
                                        clone.color.setRGB(neutralLum, neutralLum, neutralLum);
                                    }
                                    return clone;
                                });
                            } else {
                                const clone = child.material.clone();
                                if (clone.color) {
                                    const lum = clone.color.r * 0.299 + clone.color.g * 0.587 + clone.color.b * 0.114;
                                    const neutralLum = Math.max(0.45, Math.min(0.82, lum > 0 ? lum : 0.70));
                                    clone.color.setRGB(neutralLum, neutralLum, neutralLum);
                                }
                                child._grayscaleMaterial = clone;
                            }
                        }
                        child.material = child._grayscaleMaterial;
                    } else {
                        child.material = child._originalMaterial;
                    }
                }
            });
        };

        ui.btnColorFull.onclick = () => {
            if (ui.btnColorFull.classList.contains('active')) return;
            ui.btnColorFull.classList.add('active');
            ui.btnColorMono.classList.remove('active');
            applyGrayscaleMode(false);
        };

        ui.btnColorMono.onclick = () => {
            if (ui.btnColorMono.classList.contains('active')) return;
            ui.btnColorMono.classList.add('active');
            ui.btnColorFull.classList.remove('active');
            applyGrayscaleMode(true);
        };

        // Manual Offset & Size Variables for tag position and size adjustment
        const TAG_OFFSET_X = -6.0; // Negative shifts tags LEFT on floorplan view
        const TAG_OFFSET_Z = 9.5; // Positive shifts tags DOWN on floorplan view
        const TAG_OFFSET_Y = 0.0;
        const TAG_WORLD_WIDTH_METERS = 1.5; // Fixed tag width in 3D world meters (locked to model geometry)

        // Manual Offset Variables for 2D Space Highlight Plane Position Adjustment (Left/Right & Up/Down in 2D View)
        const PLANE_OFFSET_X = 0.3; // Model-aligned position (no offset relative to tags)
        const PLANE_OFFSET_Z = 0.1320; // Model-aligned position (no offset relative to tags)

        const createRoomTagSprite = (longName: string, floorLabel: string, name: string, area: number): THREE.Sprite => {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 384;
            const ctx = canvas.getContext('2d')!;

            ctx.clearRect(0, 0, 1024, 384);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const line1 = `${longName || 'Room'} (${name || ''})`;
            const line2 = `${area.toFixed(1)} m²`;

            // Auto-fit font size so long titles never clip at canvas boundaries
            let fontSize1 = 64;
            ctx.font = `bold ${fontSize1}px "Segoe UI", Arial, sans-serif`;
            let textWidth = ctx.measureText(line1).width;
            while (textWidth > 960 && fontSize1 > 24) {
                fontSize1 -= 2;
                ctx.font = `bold ${fontSize1}px "Segoe UI", Arial, sans-serif`;
                textWidth = ctx.measureText(line1).width;
            }

            ctx.fillStyle = '#000000';
            ctx.fillText(line1, 512, 130);

            const fontSize2 = Math.min(52, Math.round(fontSize1 * 0.85));
            ctx.font = `bold ${fontSize2}px "Segoe UI", Arial, sans-serif`;
            ctx.fillStyle = '#000000';
            ctx.fillText(line2, 512, 250);

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            const mat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.05,
                depthTest: false,
                depthWrite: false
            });

            const sprite = new THREE.Sprite(mat);
            sprite.renderOrder = 9999;
            const aspect = 1024 / 384;
            const spriteWidth = TAG_WORLD_WIDTH_METERS || 1.5;
            const spriteHeight = spriteWidth / aspect;
            sprite.scale.set(spriteWidth, spriteHeight, 1.0);
            return sprite;
        };

        const localToWorld = (localX: number, localY: number, localZ: number): THREE.Vector3 => {
            const curBBox = new THREE.Box3().setFromObject(model.object);
            const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
            const modelHeight = currentVerticalAxis === 'y' ? (curBBox.max.y - curBBox.min.y) : (curBBox.max.z - curBBox.min.z);
            const scale = modelHeight > 100 ? 1.0 : 0.001;
            if (currentVerticalAxis === 'y') return new THREE.Vector3(localX * scale + TAG_OFFSET_X, localZ * scale + TAG_OFFSET_Y, -localY * scale + TAG_OFFSET_Z);
            else return new THREE.Vector3(localX * scale + TAG_OFFSET_X, localY * scale + TAG_OFFSET_Z, localZ * scale + TAG_OFFSET_Y);
        };

        const processedRoomKeys = new Set<string>();

        for (const s of Object.values(jsonData.elements || {}).filter((e: any) => e.type === 'IFCSPACE' && !isIgnoredSpace(e)) as any[]) {
            const parentStorey = storeys.find(st => st.spaces.some(sp => sp.expressId === s.expressId));
            const storeyId = parentStorey ? parentStorey.expressId : 0;

            const roomKey = `${(s.name || '').trim().toUpperCase()}_${storeyId}`;
            if (s.name && processedRoomKeys.has(roomKey)) {
                continue;
            }
            if (s.name) {
                processedRoomKeys.add(roomKey);
            }

            const floorLabel = parentStorey ? parentStorey.name : 'Unknown Floor';
            const areaVal = s.quantities?.Area || 0;
            const obj = createRoomTagSprite(s.longName || 'Room', floorLabel, s.name || '', areaVal) as any;
            obj.originalSpace = s;

            let positioned = false;
            if (spaceCenters.has(s.expressId)) {
                const center = spaceCenters.get(s.expressId)!;
                obj.worldCenter = center.clone();
                obj.position.copy(center);
                positioned = true;
            } else if (s.labelPosition) {
                const pos = localToWorld(s.labelPosition.x, s.labelPosition.y, s.labelPosition.z);
                obj.worldCenter = pos.clone();
                obj.position.copy(pos);
                positioned = true;
            } else {
                const localId = expressIdToLocalId.get(s.expressId);
                if (localId !== undefined) {
                    bboxer.list.clear();
                    await bboxer.addFromModelIdMap({ [model.modelId]: new Set([localId]) });
                    const box = bboxer.get();
                    if (!box.isEmpty()) {
                        const center = new THREE.Vector3(); box.getCenter(center);
                        obj.worldCenter = center.clone(); obj.position.copy(center); positioned = true;
                    }
                }
            }
            if (!positioned && s.placement?.position) {
                const pos = localToWorld(s.placement.position.x, s.placement.position.y, s.placement.position.z);
                obj.worldCenter = pos.clone(); obj.position.copy(pos);
            }
            world.scene.three.add(obj); tags.push(obj);

            // Construct 2D Space Boundary Overlay
            if (s.polygon && Array.isArray(s.polygon) && s.polygon.length > 2) {
                let actualPos: THREE.Vector3;
                if (spaceCenters.has(s.expressId)) {
                    actualPos = spaceCenters.get(s.expressId)!.clone();
                } else if (s.spaceCenter) {
                    actualPos = localToWorld(s.spaceCenter.x, s.spaceCenter.y, s.spaceCenter.z);
                } else if (s.placement?.position) {
                    actualPos = localToWorld(s.placement.position.x, s.placement.position.y, s.placement.position.z);
                } else {
                    actualPos = new THREE.Vector3(0, 0, 0);
                }
                if (model.object && model.object.matrixWorld) {
                    actualPos.applyMatrix4(model.object.matrixWorld);
                }

                // Set plane elevation to the elevation of the floor directly BELOW this level
                const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);
                const storeyIdx = parentStorey ? sortedStoreys.findIndex(st => st.expressId === parentStorey.expressId) : -1;
                const planeElevation = storeyIdx > 0 ? sortedStoreys[storeyIdx - 1].elevation : 0;
                const targetY = getWorldHeight(planeElevation);

                const shape = new THREE.Shape();
                const linePoints: THREE.Vector3[] = [];
                const worldXZ: { x: number, z: number }[] = [];

                s.polygon.forEach((pt: any, idx: number) => {
                    const pWorld = localToWorld(pt.x, pt.y, 0);
                    const wx = pWorld.x + PLANE_OFFSET_X;
                    const wz = pWorld.z + PLANE_OFFSET_Z;

                    if (idx === 0) shape.moveTo(wx, wz);
                    else shape.lineTo(wx, wz);

                    linePoints.push(new THREE.Vector3(wx, targetY, wz));
                    worldXZ.push({ x: wx, z: wz });
                });

                const fillGeom = new THREE.ShapeGeometry(shape);
                const fillMat = new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.0, // Transparent until clicked or hovered
                    side: THREE.DoubleSide,
                    depthTest: false,
                    depthWrite: false
                });
                const fillMesh = new THREE.Mesh(fillGeom, fillMat);
                fillMesh.frustumCulled = false;
                fillMesh.renderOrder = 9999;

                fillMesh.rotation.x = Math.PI / 2;
                fillMesh.position.y = targetY;

                (fillMesh as any).spaceExpressId = s.expressId;
                (fillMesh as any).spaceData = s;
                (fillMesh as any).storeyExpressId = parentStorey?.expressId;

                world.scene.three.add(fillMesh);
                space2dFillMeshes.push(fillMesh);

                if (linePoints.length > 0) linePoints.push(linePoints[0].clone());
                const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
                const lineMat = new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 3, depthTest: false, depthWrite: false });
                const outlineMesh = new THREE.LineLoop(lineGeom, lineMat);
                outlineMesh.frustumCulled = false;
                outlineMesh.renderOrder = 9998;
                (outlineMesh as any).spaceExpressId = s.expressId;
                (outlineMesh as any).storeyExpressId = parentStorey?.expressId;

                world.scene.three.add(outlineMesh);
                space2dOutlineMeshes.push(outlineMesh);

                spaceWorldPolygons.set(s.expressId, {
                    worldXZ,
                    space: s,
                    storeyExpressId: parentStorey?.expressId || 0
                });
            }
        }

        // 2D space click & hover using point-in-polygon (ONLY in 2D View)
        let lastHoveredId: number | null = null;
        ui.viewport.addEventListener('mousemove', (e: MouseEvent) => {
            if (isDragging) return;
            if (!ui.btn2d.classList.contains('active')) return;

            const hit = raycastSpaceUnderCursor(e);
            if (hit) {
                if (lastHoveredId !== hit.expressId) {
                    lastHoveredId = hit.expressId;
                    setSelectedSpaceHighlight(hit.expressId, true);
                }
            } else {
                if (lastHoveredId !== null) {
                    lastHoveredId = null;
                    setSelectedSpaceHighlight(null, true);
                }
            }
        });

        ui.viewport.addEventListener('click', async (e: MouseEvent) => {
            if (isDragging) return;
            if (!ui.btn2d.classList.contains('active')) return;

            const hit = raycastSpaceUnderCursor(e);
            if (hit) {
                setSelectedSpaceHighlight(hit.expressId, false);
                displaySelectedSpaceInfo(hit.space);
            } else {
                setSelectedSpaceHighlight(null, false);
            }
        });

        const minDistance = 2.5;
        for (let iter = 0; iter < 10; iter++) {
            let moved = false;
            for (let i = 0; i < tags.length; i++) {
                for (let j = i + 1; j < tags.length; j++) {
                    const t1 = tags[i] as any, t2 = tags[j] as any;
                    if (t1.worldCenter && t2.worldCenter) {
                        const dist = t1.worldCenter.distanceTo(t2.worldCenter);
                        if (dist < minDistance) {
                            const dir = new THREE.Vector3().subVectors(t1.worldCenter, t2.worldCenter).normalize();
                            if (dir.lengthSq() === 0) dir.set(1, 0, 0);
                            const overlap = (minDistance - dist) / 2;
                            t1.worldCenter.add(dir.clone().multiplyScalar(overlap));
                            t2.worldCenter.sub(dir.clone().multiplyScalar(overlap));
                            moved = true;
                        }
                    }
                }
            }
            if (!moved) break;
        }

        await hider.set(false, spaceMap);
        updateTagsForLevel('');
        
            store().setIsLoaded(true);
            store().setIsLoading(false);
        
    } catch (err) { 
            store().setLoadingText('Error: ' + err);
            store().setIsLoading(false);
    }
};

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && (window as any).loadIfcFile) {
        (window as any).loadIfcFile(file);
    }
});

const keys = { w: 0, a: 0, s: 0, d: 0, q: 0, e: 0 };
window.addEventListener('keydown', (e: KeyboardEvent) => e.key.toLowerCase() in keys && ((keys as any)[e.key.toLowerCase()] = 1));
window.addEventListener('keyup', (e: KeyboardEvent) => e.key.toLowerCase() in keys && ((keys as any)[e.key.toLowerCase()] = 0));
world.renderer!.onBeforeUpdate.add(() => {
    if (!ui.btnWalk.classList.contains('active')) return;
    const v = 0.5, c = world.camera.controls;
    if (keys.w) c.forward(v, true); if (keys.s) c.forward(-v, true);
    if (keys.a) c.truck(-v, 0, true); if (keys.d) c.truck(v, 0, true);
    if (keys.q) c.elevate(-v, true); if (keys.e) c.elevate(v, true);
});
ui.viewport.addEventListener('click', () => ui.btnWalk.classList.contains('active') && ui.viewport.requestPointerLock());
ui.viewport.addEventListener('mousemove', (e: MouseEvent) => document.pointerLockElement === ui.viewport && (world.camera.controls.azimuthAngle -= e.movementX * 0.002, world.camera.controls.polarAngle -= e.movementY * 0.002));

ui.btnOrbit.onclick = () => { document.exitPointerLock(); ui.btnOrbit.classList.add('active'); ui.btnWalk.classList.remove('active'); };
ui.btnWalk.onclick = () => { ui.btnWalk.classList.add('active'); ui.btnOrbit.classList.remove('active'); };

let draggedMep = '';
document.querySelectorAll('.mep-item').forEach(el => el.addEventListener('dragstart', (e: any) => draggedMep = e.target.dataset.type));
ui.viewport.addEventListener('dragover', (e: DragEvent) => e.preventDefault());
ui.viewport.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault(); if (!draggedMep) return;
    const rect = ui.viewport.getBoundingClientRect(), mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(mouse, world.camera.three);
    const hits = raycaster.intersectObjects(world.scene.three.children, true);
    if (hits.length) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: draggedMep === 'AHU' ? 0x4da6ff : draggedMep === 'Pump' ? 0x4dff88 : 0xff4d4d }));
        mesh.position.copy(hits[0].point).add(hits[0].face?.normal?.clone().multiplyScalar(0.25) || new THREE.Vector3());
        world.scene.three.add(mesh);
    }
    draggedMep = '';
});

        
        // Expose Toolbar callbacks to window so the React component can trigger them
        (window as any)._toolbarCallbacks = {
            on3dToggle: () => ui.btn3d.onclick && ui.btn3d.onclick(),
            on2dToggle: () => ui.btn2d.onclick && ui.btn2d.onclick(),
            onColorToggle: (mode: string) => mode === 'full' ? (ui.btnColorFull.onclick && ui.btnColorFull.onclick()) : (ui.btnColorMono.onclick && ui.btnColorMono.onclick()),
            onOrbitToggle: () => ui.btnOrbit.onclick && ui.btnOrbit.onclick(),
            onWalkToggle: () => ui.btnWalk.onclick && ui.btnWalk.onclick(),
            onClipToggle: () => ui.btnClip.onclick && ui.btnClip.onclick(),
            onTagsToggle: () => ui.btnTags.onclick && ui.btnTags.onclick(),
            onSpacesToggle: () => ui.btnSpaces.onclick && ui.btnSpaces.onclick(),
            onLevelChange: (val: string) => { ui.selectLevel.value = val; ui.selectLevel.onchange && ui.selectLevel.onchange(); }
        };
        
        setIsReady(true);

        return () => {
            document.getElementById = getElementByIdBackup;
        };
    }, []);

    const cb = (window as any)._toolbarCallbacks || {};

    return (
        <div className="flex-1 relative w-full h-full">
            <DropOverlay />
            <div id="viewport" ref={viewportRef} className="absolute inset-0 z-0"></div>
            <Toolbar 
                on3dToggle={cb.on3dToggle}
                on2dToggle={cb.on2dToggle}
                onColorToggle={cb.onColorToggle}
                onOrbitToggle={cb.onOrbitToggle}
                onWalkToggle={cb.onWalkToggle}
                onClipToggle={cb.onClipToggle}
                onTagsToggle={cb.onTagsToggle}
                onSpacesToggle={cb.onSpacesToggle}
                onLevelChange={cb.onLevelChange}
            />
        </div>
    );
}
