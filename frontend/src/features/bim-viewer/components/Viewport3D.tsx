import * as OBC from '@thatopen/components';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { RendererManager } from '../frontend/RendererManager';
import { FloorPlanManager } from '../frontend/FloorPlanManager';
import { SelectionManager } from '../frontend/SelectionManager';
import React, { useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../store/viewer-store';
import { Toolbar } from './Toolbar';
import { DropOverlay } from './DropOverlay';
import { workspaceStore } from '@/lib/workspace-store';
import { saveProjectIfcFile, getProjectIfcFile, deleteProjectIfcFile } from '@/lib/projectIfcStorage';
import { isMepValidSpaceName, sortSpacesByFloorAndName, resolveBestSpaceName } from '@/lib/bimViewerSpaceExtractor';
import { api as backendApi } from '@/services/api';

import { ensureApiBridge } from '../tauri-bridge';

export function Viewport3D() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);
    const [isReady, setIsReady] = useState(false);
    const [webglError, setWebglError] = useState(false);
    const rendererManagerRef = useRef<RendererManager | null>(null);

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
                appendChild: () => {}
            }
        };

        let _levels: any[] = [];
        
        // Replace getElementById('viewport') with viewportElement
        const getElementByIdBackup = document.getElementById;
        document.getElementById = (id) => id === 'viewport' ? viewportElement : getElementByIdBackup.call(document, id);

        let rendererManager: RendererManager;
        try {
            rendererManager = new RendererManager(viewportElement);
            rendererManagerRef.current = rendererManager;
        } catch (initErr) {
            console.error("Critical: Failed to construct RendererManager:", initErr);
            setWebglError(true);
            return;
        }

        const floorPlanManager = new FloorPlanManager(rendererManager);
        const selectionManager = new SelectionManager(rendererManager);

        const world = rendererManager.world;
        const components = rendererManager.components;
        const fragments = components.get(OBC.FragmentsManager);
        const casters = components.get(OBC.Raycasters);
        casters.get(world);

        // Eagerly initialize FragmentsManager worker in background on mount
        let isFragmentsInitialized = false;
        OBC.FragmentsManager.getWorker().then(worker => {
            if (!isFragmentsInitialized) {
                fragments.init(worker);
                isFragmentsInitialized = true;
            }
        }).catch(err => console.warn("FragmentsManager background init warning:", err));

        // Configure camera zoom speed (base 1.0, Shift + Scroll 3.0)
        const baseDollySpeed = 1.0;
        const shiftDollySpeed = 3.0;

        if (world.camera?.controls) {
            world.camera.controls.dollySpeed = baseDollySpeed;
        }

        const handleShiftDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift' && world.camera?.controls) {
                world.camera.controls.dollySpeed = shiftDollySpeed;
            }
        };

        const handleShiftUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift' && world.camera?.controls) {
                world.camera.controls.dollySpeed = baseDollySpeed;
            }
        };

        window.addEventListener('keydown', handleShiftDown);
        window.addEventListener('keyup', handleShiftUp);

        ui.viewport.addEventListener('wheel', (e: WheelEvent) => {
            if (e.shiftKey && world.camera?.controls) {
                const delta = e.deltaY < 0 ? 1.5 : -1.5;
                world.camera.controls.dolly(delta, true);
            }
        }, { passive: true });

        ui.viewport.addEventListener('dblclick', () => ui.btnClip.classList.contains('active') && ui.selectLevel.value === '' && floorPlanManager.createClipPlane());
        window.addEventListener('keydown', e => e.code === 'Delete' && floorPlanManager.deleteClipPlane());

        // Register camera update listener ONCE on mount
        const saveCameraState = () => {
            if (world?.camera?.controls) {
                try {
                    const pos = new THREE.Vector3();
                    const target = new THREE.Vector3();
                    world.camera.controls.getPosition(pos);
                    world.camera.controls.getTarget(target);
                    (window as any)._bimCameraState = {
                        pos: [pos.x, pos.y, pos.z],
                        target: [target.x, target.y, target.z]
                    };
                } catch {}
            }
        };

        let cameraUpdateDebounce: any = null;
        if (world.camera?.controls) {
            world.camera.controls.addEventListener("update", () => {
                if (isFragmentsInitialized && fragments?.core) {
                    try { fragments.core.update(); } catch {}
                }
                if (!cameraUpdateDebounce) {
                    cameraUpdateDebounce = setTimeout(() => {
                        saveCameraState();
                        cameraUpdateDebounce = null;
                    }, 100);
                }
            });
        }

        // Module-level lifecycle references for smooth cleanup and no memory leaks
        let currentModel: any = null;
        let activeTags: (THREE.Sprite | CSS2DObject)[] = [];
        let activeSpaceMeshes: THREE.Mesh[] = [];
        let activeSpaceLineMeshes: THREE.LineSegments[] = [];
        let activeSpaceCrossMeshes: THREE.LineSegments[] = [];
        let activeSpace2dFillMeshes: THREE.Mesh[] = [];
        let activeSpace2dOutlineMeshes: (THREE.LineLoop | THREE.LineSegments)[] = [];
        let activeSpace2dPickMeshes: THREE.Mesh[] = [];
        let activeSpaceBoundsMap = new Map<number, { box: THREE.Box3, center: THREE.Vector3, space: any, storeyExpressId: number }>();
        let activeSpaceWorldPolygons = new Map<number, { worldXZ: { x: number, z: number }[], space: any, storeyExpressId: number }>();
        let placedEquipment3DMeshes: THREE.Group[] = [];
        let unsubEquipmentStore: (() => void) | null = null;
        let activeSelectHighlightHandler: any = null;
        let activeSelectClearHandler: any = null;
        let viewportAbortController: AbortController | null = null;

        const disposeMeshList = (list: any[]) => {
            try {
                list.forEach(m => {
                    try {
                        if (m.parent) m.parent.remove(m);
                        if (m.geometry && typeof m.geometry.dispose === 'function') m.geometry.dispose();
                        if (m.material) {
                            if (Array.isArray(m.material)) {
                                m.material.forEach((mat: any) => {
                                    if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                                    if (typeof mat.dispose === 'function') mat.dispose();
                                });
                            } else {
                                if (m.material.map && typeof m.material.map.dispose === 'function') m.material.map.dispose();
                                if (typeof m.material.dispose === 'function') m.material.dispose();
                            }
                        }
                    } catch {}
                });
            } catch {}
            list.length = 0;
        };

        const cleanupCurrentSceneAndModel = async () => {
            // 1. Abort previous viewport event listeners
            try {
                if (viewportAbortController) {
                    viewportAbortController.abort();
                    viewportAbortController = null;
                }
            } catch {}

            // 2. Remove selection highlighter listeners
            try {
                if (activeSelectHighlightHandler && selectionManager.highlighter?.events?.select?.onHighlight) {
                    selectionManager.highlighter.events.select.onHighlight.remove(activeSelectHighlightHandler);
                    activeSelectHighlightHandler = null;
                }
            } catch {}
            try {
                if (activeSelectClearHandler && selectionManager.highlighter?.events?.select?.onClear) {
                    selectionManager.highlighter.events.select.onClear.remove(activeSelectClearHandler);
                    activeSelectClearHandler = null;
                }
            } catch {}
            try { await selectionManager.clear(); } catch {}

            // 3. Remove & dispose tags
            try {
                activeTags.forEach(t => {
                    try {
                        if (t.parent) t.parent.remove(t);
                        if ((t as any).material) {
                            if ((t as any).material.map && typeof (t as any).material.map.dispose === 'function') {
                                (t as any).material.map.dispose();
                            }
                            if (typeof (t as any).material.dispose === 'function') {
                                (t as any).material.dispose();
                            }
                        }
                        if ((t as any).element && typeof (t as any).element.remove === 'function') {
                            (t as any).element.remove();
                        }
                    } catch {}
                });
            } catch {}
            activeTags = [];

            // 4. Remove & dispose all space meshes, lines, crosshairs, and 2D outlines
            disposeMeshList(activeSpaceMeshes);
            disposeMeshList(activeSpaceLineMeshes);
            disposeMeshList(activeSpaceCrossMeshes);
            disposeMeshList(activeSpace2dFillMeshes);
            disposeMeshList(activeSpace2dOutlineMeshes);
            disposeMeshList(activeSpace2dPickMeshes);
            disposeMeshList(placedEquipment3DMeshes);
            activeSpaceBoundsMap.clear();
            activeSpaceWorldPolygons.clear();
            if (unsubEquipmentStore) { unsubEquipmentStore(); unsubEquipmentStore = null; }

            // 5. Remove clip plane
            try {
                if (floorPlanManager.activePlaneId) {
                    await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId);
                    floorPlanManager.activePlaneId = null;
                }
            } catch {}

            // 6. Dispose previous model
            try {
                if (currentModel) {
                    if (currentModel.object) {
                        currentModel.object.traverse((child: any) => {
                            try {
                                if (child.geometry && typeof child.geometry.dispose === 'function') {
                                    child.geometry.dispose();
                                }
                                if (child.material) {
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach((mat: any) => {
                                            if (mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                                            if (typeof mat.dispose === 'function') mat.dispose();
                                        });
                                    } else {
                                        if (child.material.map && typeof child.material.map.dispose === 'function') child.material.map.dispose();
                                        if (typeof child.material.dispose === 'function') child.material.dispose();
                                    }
                                }
                            } catch {}
                        });
                        if (currentModel.object.parent) {
                            currentModel.object.parent.remove(currentModel.object);
                        } else {
                            world.scene.three.remove(currentModel.object);
                        }
                    }
                    if (typeof currentModel.dispose === 'function') {
                        try { currentModel.dispose(); } catch (e) { console.warn("Model dispose warning:", e); }
                    }
                    currentModel = null;
                }
            } catch {}
        };

        let isModelLoadingInProgress = false;
        let activeModelSignature = '';

        (window as any).loadIfcFile = async (file: File, isPreload: boolean = false) => {
            if (!file?.name.toLowerCase().endsWith('.ifc')) return;
            const fileSignature = `${file.name}_${file.size}`;

            if (isModelLoadingInProgress) {
                console.log(`⏳ Model loading already in progress for "${file.name}". Skipping duplicate call.`);
                return;
            }

            if (currentModel && activeModelSignature === fileSignature) {
                console.log(`⚡ Model "${file.name}" is already loaded in 3D viewport. Instant return.`);
                store().setIsLoaded(true);
                store().setIsLoading(false);
                ui.overlay.style.display = 'none';
                ui.toolbar.style.display = 'flex';
                return;
            }

            isModelLoadingInProgress = true;
            activeModelSignature = fileSignature;

            (window as any)._currentLoadedFile = file;
            const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
            if (activeProjId && !isPreload) {
                saveProjectIfcFile(activeProjId, file);
            }

            ui.btn3d.classList.add('active');
            ui.btn2d.classList.remove('active');
            ui.btnOrbit.style.display = 'inline-block';
            ui.btnWalk.style.display = 'inline-block';
            ui.btnClip.style.display = 'inline-block';

            store().setIsLoading(true);
            store().setLoadingText('Cleaning up previous model & loading...');

            try {
                // Clean up previous scene objects and listeners completely before loading new model
                await cleanupCurrentSceneAndModel();

                try {
                    await floorPlanManager.enter3DMode();
                } catch (err) {
                    console.warn("Failed to reset camera to Perspective/Orbit on drop:", err);
                }

                store().setLoadingText('Loading your 3D model...');

                ensureApiBridge();
                const api = (window as any).api || {};
                const getFilePathFn = typeof api.getFilePath === 'function' 
                    ? api.getFilePath 
                    : ((f: File) => (f as any).path || f.name || "project_model.ifc");
                
                const fileKey = getFilePathFn(file);
                
                const processIfcFn = typeof api.processIfc === 'function' ? api.processIfc : null;
                if (!processIfcFn) {
                    throw new Error("3D IFC Converter Engine bridge unavailable.");
                }

                const { frag, json } = await processIfcFn(fileKey);

                const readFileFn = typeof api.readFile === 'function' ? api.readFile : null;
                if (!readFileFn) {
                    throw new Error("3D Geometry Cache Reader bridge unavailable.");
                }

                const [rawFrag, rawJson] = await Promise.all([
                    readFileFn(frag),
                    readFileFn(json)
                ]);
                const fragBytes = new Uint8Array(rawFrag.buffer ?? rawFrag);
                const jsonData = JSON.parse(new TextDecoder().decode(new Uint8Array(rawJson.buffer ?? rawJson)));

                try {
                    const extractedName = jsonData?.project?.name || jsonData?.project?.longName;
                    if (extractedName && extractedName !== 'Project' && extractedName !== 'Default Project') {
                        const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
                        if (activeProjId) {
                            await backendApi.updateProjectDetails(activeProjId, { name: extractedName });
                            const state = workspaceStore.getState();
                            if (state.project) state.project.name = extractedName;
                            const pInArr = state.projects.find(p => p.id === activeProjId);
                            if (pInArr) pInArr.name = extractedName;
                        }
                    }
                } catch (e) {
                    console.warn("Failed to sync project name from IFC", e);
                }

                if (fragBytes.byteLength === 0) {
                    console.error("❌ CRITICAL: .frag file is EMPTY! The IFC conversion produced no output.");
                    store().setLoadingText('Error: .frag file is empty - conversion failed');
                    store().setIsLoading(false);
                    return;
                }

                if (!isFragmentsInitialized) {
                    const worker = await OBC.FragmentsManager.getWorker();
                    fragments.init(worker);
                    isFragmentsInitialized = true;
                }
                selectionManager.setup();

                store().setLoadingText('Finalizing 3D scene & room overlays (Step 5/5)...');
                const model = await fragments.core.load(fragBytes, { modelId: `model-${Date.now()}` });
                currentModel = model;
                model.useCamera(world.camera.three);

                const bbox = new THREE.Box3().setFromObject(model.object);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const center = new THREE.Vector3();
                bbox.getCenter(center);

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
                    if (longName && /^\([A-Z0-9]+\)/i.test(longName.trim())) return true;
                    if (name && /^\([A-Z0-9]+\)/i.test(name.trim())) return true;
                    if (name.includes('garden') || longName.includes('garden') || objectType.includes('garden')) return true;
                    return false;
                };

                const spaceExpressIds = Object.values(jsonData.elements || {})
                    .filter((e: any) => e.type === 'IFCSPACE' && !isIgnoredSpace(e))
                    .map((e: any) => e.expressId);
                const spaceLocalIds = await model.getLocalIdsFromItemIds(spaceExpressIds);
                const expressIdToLocalId = new Map<number, number>();
                for (let i = 0; i < spaceExpressIds.length; i++) {
                    const expId = spaceExpressIds[i];
                    const locId = spaceLocalIds[i];
                    if (locId !== undefined) {
                        expressIdToLocalId.set(expId, locId);
                        allSpatialLocalIds.add(locId);
                    }
                }

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
                const spaceWorldPolygons = activeSpaceWorldPolygons;
                const spaceBoundsMap = activeSpaceBoundsMap;

                activeSpaceMeshes = spaceMeshes;
                activeSpaceLineMeshes = spaceLineMeshes;
                activeSpaceCrossMeshes = spaceCrossMeshes;
                activeSpace2dFillMeshes = space2dFillMeshes;
                activeSpace2dOutlineMeshes = space2dOutlineMeshes;
                activeSpace2dPickMeshes = space2dPickMeshes;

                const raycastSpaceUnderCursor = (e: MouseEvent): { space: any; expressId: number; storeyExpressId: number; point: THREE.Vector3 } | null => {
                    const is2DActive = ui.btn2d.classList.contains('active') || store().viewMode === '2d';
                    if (!is2DActive) return null;

                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                    // Use Three.js Raycaster from the active 2D orthographic camera
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

                    const activeLevelId = ui.selectLevel.value;
                    const currentLevel = useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(activeLevelId));
                    const floorElevation = currentLevel ? (currentLevel.elevation ?? 0) : 0;

                    // Intersect horizontal floor plane at floorElevation
                    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorElevation);
                    const planeHit = new THREE.Vector3();
                    const hasPlaneHit = raycaster.ray.intersectPlane(floorPlane, planeHit);
                    const worldPoint = hasPlaneHit ? planeHit : new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                    const clickX = worldPoint.x;
                    const clickZ = worldPoint.z;

                    const isDndEvent = (e as any).type === 'dragover' || (e as any).type === 'drop';
                    if (isDndEvent || (window as any)._enableMepDndDebug) {
                        console.log('[MEP-DND] client:', { clientX: e.clientX, clientY: e.clientY });
                        console.log('[MEP-DND] viewport rect:', { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) });
                        console.log('[MEP-DND] NDC:', { ndcX: Number(ndcX.toFixed(3)), ndcY: Number(ndcY.toFixed(3)) });
                        console.log('[MEP-DND] world:', { clickX: Number(clickX.toFixed(2)), clickZ: Number(clickZ.toFixed(2)), floorElevation });
                        console.log('[MEP-DND] selected level:', activeLevelId || '(all)');
                        console.log('[MEP-DND] polygons available:', spaceWorldPolygons.size, '| bounds available:', spaceBoundsMap.size);
                    }

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

                    // PASS 1: Test against 2D polygon footprints (exact polygon match if available)
                    if (spaceWorldPolygons.size > 0) {
                        for (const [expressId, data] of spaceWorldPolygons) {
                            if (activeLevelId && String(data.storeyExpressId) !== String(activeLevelId)) continue;
                            if (pointInPoly(clickX, clickZ, data.worldXZ)) {
                                if (isDndEvent) {
                                    console.log('[MEP-DND] candidate spaces: [Polygon Match]', data.space?.longName || data.space?.name || expressId);
                                    console.log('[MEP-DND] hitSpace:', data.space?.longName || data.space?.name || expressId);
                                }
                                return { space: data.space, expressId, storeyExpressId: data.storeyExpressId, point: new THREE.Vector3(clickX, floorElevation, clickZ) };
                            }
                        }
                    }

                    // PASS 2: Test 3D World Bounding Box & Center Proximity (Forgiving, hits anywhere in the room)
                    if (spaceBoundsMap.size > 0) {
                        const candidateHits: { expressId: number; data: any; distSq: number }[] = [];
                        const margin = 0.5; // 0.5m boundary tolerance for edge placement

                        // First check spaces on active level
                        for (const [expressId, data] of spaceBoundsMap) {
                            if (activeLevelId && String(data.storeyExpressId) !== String(activeLevelId)) continue;
                            const b = data.box;
                            if (clickX >= b.min.x - margin && clickX <= b.max.x + margin &&
                                clickZ >= b.min.z - margin && clickZ <= b.max.z + margin) {
                                const dx = clickX - data.center.x;
                                const dz = clickZ - data.center.z;
                                candidateHits.push({ expressId, data, distSq: dx * dx + dz * dz });
                            }
                        }

                        // If active level is set but no candidate hit, search all storeys as fallback
                        if (candidateHits.length === 0 && activeLevelId) {
                            for (const [expressId, data] of spaceBoundsMap) {
                                const b = data.box;
                                if (clickX >= b.min.x - margin && clickX <= b.max.x + margin &&
                                    clickZ >= b.min.z - margin && clickZ <= b.max.z + margin) {
                                    const dx = clickX - data.center.x;
                                    const dz = clickZ - data.center.z;
                                    candidateHits.push({ expressId, data, distSq: dx * dx + dz * dz });
                                }
                            }
                        }

                        if (isDndEvent) {
                            console.log('[MEP-DND] candidate spaces:', candidateHits.map(c => `${c.data.space?.longName || c.data.space?.name || c.expressId} (dist=${Math.sqrt(c.distSq).toFixed(1)}m, storey=${c.data.storeyExpressId})`));
                        }

                        if (candidateHits.length > 0) {
                            // Sort by proximity to room center (closest center wins)
                            candidateHits.sort((a, b) => a.distSq - b.distSq);
                            const best = candidateHits[0];
                            if (isDndEvent) {
                                console.log('[MEP-DND] hitSpace:', best.data.space?.longName || best.data.space?.name || best.expressId);
                            }
                            return {
                                space: best.data.space,
                                expressId: best.expressId,
                                storeyExpressId: best.data.storeyExpressId,
                                point: new THREE.Vector3(clickX, floorElevation, clickZ)
                            };
                        }
                    }

                    // PASS 3: Fallback polygon test across all levels
                    if (spaceWorldPolygons.size > 0) {
                        for (const [expressId, data] of spaceWorldPolygons) {
                            if (pointInPoly(clickX, clickZ, data.worldXZ)) {
                                if (isDndEvent) {
                                    console.log('[MEP-DND] candidate spaces: [Polygon Fallback]', data.space?.longName || data.space?.name || expressId);
                                    console.log('[MEP-DND] hitSpace:', data.space?.longName || data.space?.name || expressId);
                                }
                                return { space: data.space, expressId, storeyExpressId: data.storeyExpressId, point: new THREE.Vector3(clickX, floorElevation, clickZ) };
                            }
                        }
                    }

                    if (isDndEvent) {
                        console.log('[MEP-DND] candidate spaces: []');
                        console.log('[MEP-DND] hitSpace: null');
                    }
                    return null;
                };

                (window as any)._raycastSpaceUnderCursor = raycastSpaceUnderCursor;
                const setSelectedSpaceHighlight = (expressId: number | null, isHover: boolean = false) => {
                    if (!isHover) {
                        (window as any)._currentlySelectedExpressId = expressId;
                    }
                    const currentSelectedId = (window as any)._currentlySelectedExpressId;
                    const activeLevelId = ui.selectLevel.value;

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

                        mesh.visible = true;

                        if (isSelected) {
                            mat.color.setHex(0x3b82f6);
                            mat.opacity = 0.65;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mesh.renderOrder = 9999;
                        } else if (isHovered) {
                            mat.color.setHex(0x60a5fa);
                            mat.opacity = 0.45;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mesh.renderOrder = 9995;
                        } else {
                            mat.opacity = 0.0;
                            mat.depthTest = false;
                            mat.depthWrite = false;
                            mesh.renderOrder = 9990;
                        }
                    });

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
                            (c.material as THREE.LineBasicMaterial).color.setHex(0x1d4ed8);
                            (c.material as THREE.LineBasicMaterial).depthTest = false;
                            c.renderOrder = 995;
                        } else {
                            c.visible = false;
                        }
                    });

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
                            (outline.material as THREE.LineBasicMaterial).color.setHex(0xf59e0b);
                            (outline.material as THREE.LineBasicMaterial).depthTest = false;
                            (outline.material as THREE.LineBasicMaterial).depthWrite = false;
                            outline.renderOrder = 999;
                        } else {
                            const is2DView = ui.btn2d.classList.contains('active');
                            const isSpacesActive = is2DView && ui.btnSpaces.classList.contains('active');
                            if (isSpacesActive) {
                                outline.visible = true;
                                (outline.material as THREE.LineBasicMaterial).color.setHex(0xd1d5db);
                                (outline.material as THREE.LineBasicMaterial).depthTest = false;
                                (outline.material as THREE.LineBasicMaterial).depthWrite = false;
                                outline.renderOrder = 993;
                            } else {
                                outline.visible = false;
                            }
                        }
                    });
                };

                // Setup AbortController for viewport listeners to cleanly abort upon reloading models
                viewportAbortController = new AbortController();
                const signal = viewportAbortController.signal;

                let isDragging = false, startX = 0, startY = 0;
                ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
                    isDragging = false;
                    startX = e.clientX;
                    startY = e.clientY;
                }, { signal });

                let lastHoveredId: number | null = null;
                ui.viewport.addEventListener('pointermove', (e: PointerEvent) => {
                    if (e.buttons !== 0) { isDragging = true; return; }
                    if (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3) isDragging = true;

                    if (!ui.btn2d.classList.contains('active')) return;

                    const hit = raycastSpaceUnderCursor(e);
                    if (hit) {
                        ui.viewport.style.cursor = 'pointer';
                        if (lastHoveredId !== hit.expressId) {
                            lastHoveredId = hit.expressId;
                            setSelectedSpaceHighlight(hit.expressId, true);
                        }
                    } else {
                        ui.viewport.style.cursor = 'default';
                        if (lastHoveredId !== null) {
                            lastHoveredId = null;
                            setSelectedSpaceHighlight(null, true);
                        }
                    }
                }, { signal });

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
                                if (bbox && localClick.x >= bbox.min.x && localClick.x <= bbox.max.x &&
                                    localClick.z >= bbox.min.z && localClick.z <= bbox.max.z) {
                                    hit = true;
                                }
                            }
                        });
                        if (hit) return group;
                    }
                    return null;
                };

                let clickStartX = 0;
                let clickStartY = 0;
                ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
                    clickStartX = e.clientX;
                    clickStartY = e.clientY;
                }, { signal, capture: true });

                ui.viewport.addEventListener('click', (e: MouseEvent) => {
                    if (Math.abs(e.clientX - clickStartX) > 5 || Math.abs(e.clientY - clickStartY) > 5) return;
                    if (!ui.btn2d.classList.contains('active')) return;

                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const eqHitGroup = checkEquipmentHit(ndcX, ndcY);
                    if (eqHitGroup) return;

                    const hit = raycastSpaceUnderCursor(e);
                    if (hit) {
                        setSelectedSpaceHighlight(hit.expressId, false);
                        displaySelectedSpaceInfo(hit.space);
                    } else {
                        setSelectedSpaceHighlight(null, false);
                        ui.selectedSpaceInfo.innerHTML = "Click on a space in 3D view to select it.";
                    }
                }, { signal, capture: true });

                activeSelectHighlightHandler = (m: any) => {
                    const ids = m[model.modelId];
                    if (ids && ids.size > 0) {
                        const itemVal = Array.from(ids)[0] as number;
                        let expressId: number | undefined = itemVal;
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
                };
                if (selectionManager.highlighter?.events?.select?.onHighlight) {
                    selectionManager.highlighter.events.select.onHighlight.add(activeSelectHighlightHandler);
                }

                activeSelectClearHandler = () => {
                    setSelectedSpaceHighlight(null);
                    ui.selectedSpaceInfo.innerHTML = `Click on a space in 3D view to select it.`;
                };
                if (selectionManager.highlighter?.events?.select?.onClear) {
                    selectionManager.highlighter.events.select.onClear.add(activeSelectClearHandler);
                }

                await fragments.core.update(true);
                world.scene.three.add(model.object);

                if ((window as any)._bimCameraState && world?.camera?.controls) {
                    const { pos, target } = (window as any)._bimCameraState;
                    try {
                        world.camera.controls.setLookAt(pos[0], pos[1], pos[2], target[0], target[1], target[2], false);
                    } catch {}
                } else {
                    try {
                        const fitBox = new THREE.Box3().setFromObject(model.object);
                        const fitSphere = new THREE.Sphere();
                        fitBox.getBoundingSphere(fitSphere);
                        if (fitSphere.radius > 0) {
                            await world.camera.controls.fitToSphere(fitSphere, false);
                        }
                    } catch (fitErr) {
                        console.warn("Camera fitToSphere safely skipped:", fitErr);
                    }
                }

                const maxDim = Math.max(size.x, size.y, size.z);
                world.camera.three.near = 1.0;
                world.camera.three.far = Math.max(3000, maxDim * 6);
                world.camera.three.updateProjectionMatrix();

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

                const areaPattern = /^\([A-Z0-9]+\)/i;
                const storeys: { name: string; elevation: number; expressId: number; spaces: any[]; localSpaceIds: Set<number>; localElementIds: Set<number> }[] = [];
                const findStoreys = (node: any) => {
                    if (!node) return;
                    if (node.type === 'IFCBUILDINGSTOREY') {
                        const spaceChildren = (node.children || []).filter((c: any) => {
                            if (c.type !== 'IFCSPACE') return false;
                            const nameStr = String(c.name || '').trim();
                            const longNameStr = String(c.longName || '').trim();
                            if (areaPattern.test(nameStr) || areaPattern.test(longNameStr)) return false;
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

                _levels = [];
                ui.selectLevel.innerHTML = '<option value="">All Levels (No Cut)</option>';
                storeys.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.expressId.toString();
                    opt.innerText = `${s.name} (${(s.elevation / 1000).toFixed(2)}m)`;
                    _levels.push({ expressId: opt.value, name: opt.innerText.split(' (')[0], elevation: parseFloat(opt.innerText.match(/\((.*?)\)/)?.[1] || '0') * 1000 });
                });
                store().setLevels(_levels);

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

                                        const isOriginValid = origin.lengthSq() > 0.001 && origin.distanceTo(center) < Math.max(instanceBox.max.x - instanceBox.min.x, instanceBox.max.z - instanceBox.min.z);
                                        const finalCenter = isOriginValid ? origin : center;
                                        spaceCenters.set(expressId, finalCenter);

                                        const fullSpace = Object.values(jsonData.elements || {}).find((e: any) => e.type === 'IFCSPACE' && e.expressId === expressId) || (parentStorey ? parentStorey.spaces.find(sp => sp.expressId === expressId) : null);
                                        activeSpaceBoundsMap.set(expressId, {
                                            box: instanceBox,
                                            center: finalCenter,
                                            space: fullSpace,
                                            storeyExpressId: storeyId
                                        });

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
                                            pt3 = new THREE.Vector3(instanceBox.min.x, instanceBox.min.y, z);
                                            pt4 = new THREE.Vector3(instanceBox.max.x, instanceBox.max.y, z);
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
                        const fixMaterial = (m: any) => { m.side = THREE.DoubleSide; m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; m.needsUpdate = true; };
                        if (Array.isArray(child.material)) child.material.forEach(fixMaterial); else fixMaterial(child.material);
                    }
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
                    const is2DView = ui.btn2d.classList.contains('active') || store().viewMode === '2d';
                    const isSpacesActive = is2DView && (ui.btnSpaces.classList.contains('active') || store().isSpacesActive);
                    const activeExpressId = (window as any)._currentlySelectedExpressId;

                    if (!is2DView) {
                        space2dFillMeshes.forEach(mesh => { mesh.visible = false; });
                        space2dOutlineMeshes.forEach(mesh => { mesh.visible = false; });
                        space2dPickMeshes.forEach(mesh => { mesh.visible = false; });
                        return;
                    }

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
                                mat.opacity = 0.0;
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
                    const curBBox = new THREE.Box3().setFromObject(model.object);
                    const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
                    const height = currentVerticalAxis === 'y' ? (curBBox.max.y - curBBox.min.y) : (curBBox.max.z - curBBox.min.z);
                    const scale = height > 100 ? 1.0 : 0.001;

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

                    ui.selectedSpaceInfo.innerHTML = `
                        <div style="margin-bottom: 6px;"><strong>Name:</strong> ${space.longName || 'Room'}</div>
                        <div style="margin-bottom: 6px;"><strong>Number:</strong> ${space.name || ''}</div>
                        <div style="margin-bottom: 6px;"><strong>Level:</strong> ${floorLabel}</div>
                        <div style="margin-bottom: 6px;"><strong>Area:</strong> ${space.quantities?.Area?.toFixed(2) || 0} m²</div>
                        <div style="margin-bottom: 6px;"><strong>Height:</strong> ${space.quantities?.Height?.toFixed(2) || 0} mm</div>
                        <div style="margin-bottom: 6px;"><strong>Volume:</strong> ${space.quantities?.NetVolume?.toFixed(2) || 0} m³</div>
                    `;
                };

                const extractAndStoreBimSpaces = () => {
                    const spaceDataMap = Object.values(jsonData.elements || {}).filter((e: any) => e.type === 'IFCSPACE') as any[];
                    const rawExtracted: any[] = [];
                    storeys.forEach(st => {
                        st.spaces.forEach(sp => {
                            const fullSpace = spaceDataMap.find((e: any) => e.expressId === sp.expressId) || sp;
                            const cleanLongName = String(sp.longName || fullSpace.longName || "").trim();
                            const cleanName = String(sp.name || fullSpace.name || "").trim();
                            const displayName = resolveBestSpaceName(cleanLongName, cleanName, fullSpace.objectType, fullSpace.roomName, sp.expressId);
                            if (!isMepValidSpaceName(displayName)) return;

                            const storeyName = String(st.name || "Ground Floor").trim();
                            const area = parseFloat(String(fullSpace.quantities?.Area || fullSpace.quantities?.NetArea || sp.quantities?.Area || sp.area || 0)) || 0;
                            if (area < 1.0) return;
                            let height = parseFloat(String(fullSpace.quantities?.Height || fullSpace.quantities?.UnboundedHeight || sp.quantities?.Height || sp.height || 3.0)) || 3.0;
                            if (height > 100) height = height / 1000;

                            let length = parseFloat(String(fullSpace.quantities?.Length || sp.quantities?.Length || 0)) || 0;
                            let width = parseFloat(String(fullSpace.quantities?.Width || sp.quantities?.Width || 0)) || 0;
                            if ((length <= 0 || width <= 0) && area > 0) {
                                length = parseFloat(Math.sqrt(area * 1.25).toFixed(2));
                                width = parseFloat((area / length).toFixed(2));
                            }

                            rawExtracted.push({
                                id: `bim-${sp.expressId}`,
                                name: displayName,
                                level: storeyName,
                                zone: "Default",
                                area: Math.round(area * 100) / 100,
                                height: Math.round(height * 100) / 100,
                                length: length,
                                width: width,
                                fixtures: String(fullSpace.quantities?.Occupants || sp.quantities?.Occupants || ""),
                            });
                        });
                    });

                    const extractedBimSpaces = sortSpacesByFloorAndName(rawExtracted);
                    if (extractedBimSpaces.length > 0) {
                        (window as any).__BIM_VIEWER_SPACES__ = extractedBimSpaces;
                        try {
                            localStorage.setItem('mep_active_bim_spaces', JSON.stringify(extractedBimSpaces));
                            const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
                            if (activeProjId) {
                                localStorage.setItem(`mep_active_bim_spaces_${activeProjId}`, JSON.stringify(extractedBimSpaces));
                            }
                        } catch (e) {
                            console.warn("Storage quota warning for BIM spaces:", e);
                        }
                    }
                };

                const updateTagsForLevel = (selectedExpressId: string) => {
                    update2dSpaceOverlays(selectedExpressId);
                    activeTags.forEach(t => {
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

                    activeTags.forEach(t => {
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
                };

                ui.selectLevel.onchange = async () => {
                    const val = ui.selectLevel.value;
                    try { await selectionManager.clear(); } catch {}
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
                    const nextElevation = (index < storeys.length - 1) ? storeys[index + 1].elevation : storey.elevation + 4000;
                    const cutElevation = Math.max(nextElevation + 1500, storey.elevation + 3500);
                    const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
                    const worldHeight = getWorldHeight(cutElevation);
                    const worldCutPoint = currentVerticalAxis === 'y' ? new THREE.Vector3(0, worldHeight, 0) : new THREE.Vector3(0, 0, worldHeight);
                    const normal = currentVerticalAxis === 'y' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1);
                    floorPlanManager.activePlaneId = floorPlanManager.clipper.createFromNormalAndCoplanarPoint(world, normal, worldCutPoint);
                    const list = floorPlanManager.clipper.list as any;
                    const plane = list?.get ? list.get(floorPlanManager.activePlaneId) : (list && typeof list.values === 'function' ? Array.from(list.values()).find((p: any) => p.id === floorPlanManager.activePlaneId) : null);
                    if (plane) { plane.visible = false; if (plane.controls) { (plane.controls as any).visible = false; (plane.controls as any).enabled = false; } }

                    const activeSpacesSet = storey.localSpaceIds;
                    const inactiveSpacesSet = new Set<number>();
                    for (const id of spaceLocalIds) if (!activeSpacesSet.has(id)) inactiveSpacesSet.add(id);

                    await hider.set(false, { [model.modelId]: inactiveSpacesSet });
                    const is2DView = ui.btn2d.classList.contains('active');
                    const showSpaces = is2DView && ui.btnSpaces.classList.contains('active');
                    await hider.set(showSpaces, { [model.modelId]: activeSpacesSet });

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
                        try {
                            const fitBox = new THREE.Box3().setFromObject(model.object);
                            const fitSphere = new THREE.Sphere();
                            fitBox.getBoundingSphere(fitSphere);
                            if (fitSphere.radius > 0) {
                                await world.camera.controls.fitToSphere(fitSphere, true);
                            }
                        } catch (fitErr) {
                            console.warn("Level camera fitToSphere safely skipped:", fitErr);
                        }
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
                        try { await selectionManager.clear(); } catch {}
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
                    store().setViewMode('2d');
                    ui.btnOrbit.style.display = 'none'; ui.btnWalk.style.display = 'none'; ui.btnClip.style.display = 'none';
                    if (ui.btnWalk.classList.contains('active')) { document.exitPointerLock(); ui.btnWalk.classList.remove('active'); ui.btnOrbit.classList.add('active'); store().setCameraMode('orbit'); }
                    ui.selectLevel.style.display = 'inline-block';
                    await floorPlanManager.enter2DMode();
                    if (!ui.btnSpaces.classList.contains('active')) { ui.btnSpaces.classList.add('active'); store().setIsSpacesActive(true); }
                    if (!ui.btnTags.classList.contains('active')) { ui.btnTags.classList.add('active'); store().setIsTagsActive(true); }
                    await hider.set(ui.btnSpaces.classList.contains('active'), spaceMap);
                    const gfStorey = storeys.find(st => /ground/i.test(st.name) || /^gf/i.test(st.name)) || storeys.find(st => st.spaces && st.spaces.length > 0) || storeys[0];
                    if (gfStorey) {
                        ui.selectLevel.value = gfStorey.expressId.toString();
                        store().setSelectedLevel(gfStorey.expressId.toString());
                    }
                    await (ui.selectLevel as any).onchange();
                };

                ui.btn3d.onclick = async () => {
                    if (ui.btn3d.classList.contains('active')) return;
                    ui.btn3d.classList.add('active'); ui.btn2d.classList.remove('active');
                    store().setViewMode('3d');
                    ui.btnOrbit.style.display = 'inline-block'; ui.btnWalk.style.display = 'inline-block'; ui.btnClip.style.display = 'inline-block';
                    await floorPlanManager.enter3DMode();
                    await hider.set(false, spaceMap);
                    spaceLineMeshes.forEach(line => line.visible = false);
                    space2dFillMeshes.forEach(mesh => mesh.visible = false);
                    space2dOutlineMeshes.forEach(mesh => mesh.visible = false);
                    spaceCrossMeshes.forEach(c => c.visible = false);
                    space2dPickMeshes.forEach(mesh => mesh.visible = false);
                    updateTagsForLevel('');
                    
                    if (lastHoveredId !== null || ui.selectedSpaceInfo.innerHTML !== 'Click on a space in 3D view to select it.') {
                        lastHoveredId = null;
                        setSelectedSpaceHighlight(-1, false);
                        ui.selectedSpaceInfo.innerHTML = 'Click on a space in 3D view to select it.';
                    }

                    if (ui.btnClip.classList.contains('active')) {
                        ui.selectLevel.style.display = 'inline-block'; 
                        if (lastHoveredId !== null || ui.selectedSpaceInfo.innerHTML !== 'Click on a space in 3D view to select it.') {
                            lastHoveredId = null;
                            setSelectedSpaceHighlight(-1, false);
                            ui.selectedSpaceInfo.innerHTML = 'Click on a space in 3D view to select it.';
                        }
                        await (ui.selectLevel as any).onchange();
                    } else {
                        ui.selectLevel.value = ''; ui.selectLevel.style.display = 'none';
                        store().setSelectedLevel('');
                        await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
                        floorPlanManager.activePlaneId = null;
                        
                        // Restore visibility of all building elements across all levels
                        const allElementIds = new Set<number>();
                        storeys.forEach(s => s.localElementIds.forEach(id => allElementIds.add(id)));
                        if (allElementIds.size > 0) {
                            await hider.set(true, { [model.modelId]: allElementIds });
                        }
                        await hider.set(false, spaceMap);
                        updateTagsForLevel('');
                    }
                    try {
                        const fitBox = new THREE.Box3().setFromObject(model.object);
                        const fitSphere = new THREE.Sphere();
                        fitBox.getBoundingSphere(fitSphere);
                        if (fitSphere.radius > 0) {
                            await world.camera.controls.fitToSphere(fitSphere, true);
                        }
                    } catch (fitErr) {
                        console.warn("3D button camera fitToSphere safely skipped:", fitErr);
                    }
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
                                    const convertToGray = (mat: any) => {
                                        if (!mat) return mat;
                                        try {
                                            const clone = typeof mat.clone === 'function' ? mat.clone() : mat;
                                            if (clone && clone.color) {
                                                const lum = (clone.color.r ?? 0.7) * 0.299 + (clone.color.g ?? 0.7) * 0.587 + (clone.color.b ?? 0.7) * 0.114;
                                                const neutralLum = Math.max(0.45, Math.min(0.82, lum > 0 ? lum : 0.70));
                                                clone.color.setRGB(neutralLum, neutralLum, neutralLum);
                                            }
                                            return clone;
                                        } catch {
                                            return mat;
                                        }
                                    };

                                    if (Array.isArray(child.material)) {
                                        child._grayscaleMaterial = child.material.map(convertToGray);
                                    } else {
                                        child._grayscaleMaterial = convertToGray(child.material);
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

                const TAG_OFFSET_X = -6.0;
                const TAG_OFFSET_Z = 9.5;
                const TAG_OFFSET_Y = 0.0;
                const TAG_WORLD_WIDTH_METERS = 1.5;

                const PLANE_OFFSET_X = 0.3;
                const PLANE_OFFSET_Z = 0.1320;

                const createRoomTagSprite = (longName: string, floorLabel: string, name: string, area: number): THREE.Sprite => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1024;
                    canvas.height = 384;
                    const ctx = canvas.getContext('2d')!;

                    ctx.clearRect(0, 0, 1024, 384);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const line1 = `${longName || 'Room'} (${name || ''})`;
                    const line2 = `${area.toFixed(2)} m²`;

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
                    const height = currentVerticalAxis === 'y' ? (curBBox.max.y - curBBox.min.y) : (curBBox.max.z - curBBox.min.z);
                    const scale = height > 100 ? 1.0 : 0.001;
                    if (currentVerticalAxis === 'y') return new THREE.Vector3(localX * scale + TAG_OFFSET_X, localZ * scale + TAG_OFFSET_Y, -localY * scale + TAG_OFFSET_Z);
                    else return new THREE.Vector3(localX * scale + TAG_OFFSET_X, localY * scale + TAG_OFFSET_Z, localZ * scale + TAG_OFFSET_Y);
                };

                const processedRoomKeys = new Set<string>();
                const spaceElements = Object.values(jsonData.elements || {}).filter((e: any) => e.type === 'IFCSPACE' && !isIgnoredSpace(e)) as any[];

                let spaceLoopIndex = 0;
                for (const s of spaceElements) {
                    spaceLoopIndex++;
                    // Yield every 15 spaces to allow the browser event loop to breathe without freezing UI
                    if (spaceLoopIndex % 15 === 0) {
                        await new Promise(r => setTimeout(r, 0));
                    }

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
                    world.scene.three.add(obj);
                    activeTags.push(obj);

                    // Construct 2D Space Boundary Overlay
                    if (s.polygon && Array.isArray(s.polygon) && s.polygon.length > 2) {
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
                            opacity: 0.0,
                            side: THREE.DoubleSide,
                            depthTest: false,
                            depthWrite: false
                        });
                        const fillMesh = new THREE.Mesh(fillGeom, fillMat);
                        fillMesh.frustumCulled = false;
                        fillMesh.renderOrder = 9999;
                        fillMesh.rotation.x = Math.PI / 2;
                        fillMesh.position.y = targetY;
                        fillMesh.visible = false;

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
                        outlineMesh.visible = false;
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

                const minDistance = 2.5;
                for (let iter = 0; iter < 10; iter++) {
                    let moved = false;
                    for (let i = 0; i < activeTags.length; i++) {
                        for (let j = i + 1; j < activeTags.length; j++) {
                            const t1 = activeTags[i] as any, t2 = activeTags[j] as any;
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

                extractAndStoreBimSpaces();

                await hider.set(false, spaceMap);
                updateTagsForLevel('');
                
                store().setIsLoaded(true);
                store().setIsLoading(false);
            } catch (err) { 
                console.error("loadIfcFile error:", err);
                store().setLoadingText('Error: ' + err);
                store().setIsLoading(false);
            } finally {
                isModelLoadingInProgress = false;
            }
        };

        let activeGhostMesh: THREE.Group | null = null;
        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
            useViewerStore.getState().setDraggedEquipmentId(null);
            
            try {
                if (e.dataTransfer?.getData('text/plain')) {
                    const raw = e.dataTransfer.getData('text/plain');
                    console.log('[MEP-DND] handleDrop fired. raw dataTransfer:', raw, '| 2D active:', ui.btn2d.classList.contains('active'));
                    const data = JSON.parse(raw);
                    if (data.type === 'equipment' && ui.btn2d.classList.contains('active')) {
                        const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e) : null;
                        const hitSpace = hit ? { space: hit.space, expressId: hit.expressId, storeyExpressId: hit.storeyExpressId } : null;
                        const clickX = hit ? hit.point.x : (new THREE.Vector3(((e.clientX - ui.viewport.getBoundingClientRect().left) / ui.viewport.getBoundingClientRect().width) * 2 - 1, -((e.clientY - ui.viewport.getBoundingClientRect().top) / ui.viewport.getBoundingClientRect().height) * 2 + 1, 0).unproject(world.camera.three).x);
                        const clickZ = hit ? hit.point.z : (new THREE.Vector3(((e.clientX - ui.viewport.getBoundingClientRect().left) / ui.viewport.getBoundingClientRect().width) * 2 - 1, -((e.clientY - ui.viewport.getBoundingClientRect().top) / ui.viewport.getBoundingClientRect().height) * 2 + 1, 0).unproject(world.camera.three).z);
                        console.log('[MEP-DND] handleDrop hitSpace:', hitSpace ? `${hitSpace.space?.longName || hitSpace.space?.name} (id=${hitSpace.expressId})` : 'NULL — drop outside any valid space');

                        if (hitSpace) {
                            const level = useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(hitSpace!.storeyExpressId));
                            const floorElevation = level ? (level.elevation ?? 0) : 0;
                            console.log('[MEP-DND] floor:', level?.name, '| elevation:', floorElevation);
                            const state = workspaceStore.getState();
                            const equipIdx = state.equipment.findIndex(eq => eq.id === data.id);
                            console.log('[MEP-DND] equipIdx:', equipIdx, '| equipId:', data.id);
                            if (equipIdx !== -1) {
                                const newEquipment = [...state.equipment];
                                newEquipment[equipIdx] = {
                                    ...newEquipment[equipIdx],
                                    locationSpaceId: String(hitSpace.expressId),
                                    locationSpaceName: hitSpace.space.longName || hitSpace.space.name || `Space ${hitSpace.expressId}`,
                                    locationFloor: level ? level.name : 'Unknown Floor',
                                    positionX: clickX,
                                    positionY: floorElevation,
                                    positionZ: clickZ
                                };
                                console.log('[MEP-DND] calling updateEquipment with:', { locationSpaceId: String(hitSpace.expressId), positionX: clickX, positionY: floorElevation, positionZ: clickZ });
                                workspaceStore.updateEquipment(newEquipment);
                                console.log('[MEP-DND] updateEquipment done. New locationSpaceId:', workspaceStore.getState().equipment[equipIdx]?.locationSpaceId);
                            }
                        }
                        return;
                    }
                }
            } catch(err) { console.error('[MEP-DND] handleDrop error:', err); }

            const file = e.dataTransfer?.files[0];
            if (file && (window as any).loadIfcFile) {
                (window as any).loadIfcFile(file);
            }
        };

        const handleFocusEquipment = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const equip = customEvent.detail;
            if (!equip) return;
            
            if (!ui.btn2d.classList.contains('active')) {
                if (ui.btn2d.onclick) {
                    const p = ui.btn2d.onclick(new MouseEvent('click') as any);
                    if (p && (p as any).then) await p;
                }
            }
            
            if (equip.locationSpaceId) {
                let targetStoreyId = null;
                for (const [expressId, spData] of spaceWorldPolygons) {
                    if (String(expressId) === equip.locationSpaceId || String(spData.space?.expressId) === equip.locationSpaceId) {
                        targetStoreyId = spData.storeyExpressId;
                        break;
                    }
                }
                
                if (targetStoreyId && String(ui.selectLevel.value) !== String(targetStoreyId)) {
                    ui.selectLevel.value = String(targetStoreyId);
                    if (ui.selectLevel.onchange) {
                        const p2 = ui.selectLevel.onchange(new Event('change') as any);
                        if (p2 && (p2 as any).then) await p2;
                    }
                }
            }

            await new Promise(r => setTimeout(r, 100));

            if (!world?.camera?.controls) return;
            const eqMesh = placedEquipment3DMeshes.find(m => m.userData?.equipmentId === equip.id);
            if (eqMesh) {
                const pos = eqMesh.position;
                world.camera.controls.moveTo(pos.x, pos.y, pos.z, true);
                if (world.camera.three.isOrthographicCamera || (world.camera.projection as any).current === 'Orthographic') {
                    world.camera.controls.zoomTo(10, true);
                } else {
                    world.camera.controls.dollyTo(15, true);
                }
                
                if (transformControl) {
                    transformControl.camera = world.camera.three;
                    transformControl.setMode('translate');
                    transformControl.showX = true;
                    transformControl.showY = false;
                    transformControl.showZ = true;
                    transformControl.attach(eqMesh);
                }
            }
        };

        let transformControl: any = null;

        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);
        window.addEventListener('mep-focus-equipment', handleFocusEquipment);
        
        
        const renderEquipmentMeshes = () => {
            console.log('[MEP-EQUIPMENT-RENDER] renderEquipmentMeshes called');
            const state = workspaceStore.getState();
            disposeMeshList(placedEquipment3DMeshes);
            placedEquipment3DMeshes = [];

            state.equipment.forEach((equip) => {
                if (equip.locationSpaceId) {
                    console.log('[MEP-EQUIPMENT-RENDER] Rendering equipment:', {
                        id: equip.id,
                        tag: equip.tag,
                        locationSpaceId: equip.locationSpaceId,
                        locationSpaceName: equip.locationSpaceName,
                        locationFloor: equip.locationFloor,
                        dimL: equip.dimensions?.length,
                        dimW: equip.dimensions?.width,
                        dimH: equip.dimensions?.height,
                        posX: equip.positionX,
                        posY: equip.positionY,
                        posZ: equip.positionZ,
                        rotY: equip.rotationY
                    });
                    
                    let worldY = equip.positionY || 0;
                    if (equip.locationSpaceId && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                        const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                        if (spaceData) {
                            worldY = spaceData.box.min.y; // Correct physical world height of the space
                        }
                    }

                    const group = new THREE.Group();
                    group.position.set(equip.positionX || 0, worldY, equip.positionZ || 0);
                    if (equip.rotationY) group.rotation.y = equip.rotationY;
                    group.userData = { equipmentId: equip.id, isEquipmentGroup: true };

                    const L = (equip.dimensions?.length || 1500) / 1000;
                    const W = (equip.dimensions?.width || 1000) / 1000;
                    const H = (equip.dimensions?.height || 1000) / 1000;
                    const geometry = new THREE.BoxGeometry(L, H, W);
                    const material = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.y = H / 2;
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
            console.log('[MEP-EQUIPMENT-RENDER] placedEquipment3DMeshes count:', placedEquipment3DMeshes.length);
            console.log('[MEP-EQUIPMENT-RENDER] scene equipment group count:', world.scene.three.children.filter(c => c.userData?.isEquipmentGroup).length);
        };

        if (unsubEquipmentStore) unsubEquipmentStore();
        unsubEquipmentStore = workspaceStore.subscribe(() => {
            renderEquipmentMeshes();
        });
        renderEquipmentMeshes();

        transformControl = new TransformControls(world.camera.three, ui.viewport);
        transformControl.addEventListener('dragging-changed', (event: any) => {
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

        ui.viewport.addEventListener('pointerup', (e: PointerEvent) => {
            if (ui.btn2d.classList.contains('active')) { if (transformControl) transformControl.detach(); return; }
            
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
            const clickX = worldPos.x;
            const clickZ = worldPos.z;

            let eqHitGroup = null;
            for (const group of placedEquipment3DMeshes) {
                if (!group.userData?.isEquipmentGroup) continue;
                const localClick = new THREE.Vector3(clickX, group.position.y, clickZ);
                group.worldToLocal(localClick);
                let hit = false;
                group.traverse((c: any) => {
                    if (c.geometry && c.geometry.type === 'BoxGeometry') {
                        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
                        const bbox = c.geometry.boundingBox;
                        if (bbox && localClick.x >= bbox.min.x && localClick.x <= bbox.max.x &&
                            localClick.z >= bbox.min.z && localClick.z <= bbox.max.z) {
                            hit = true;
                        }
                    }
                });
                if (hit) { eqHitGroup = group; break; }
            }

            if (eqHitGroup) {
                if (transformControl) {
                    transformControl.camera = world.camera.three;
                    if (transformControl.object === eqHitGroup) {
                        transformControl.setMode(transformControl.getMode() === 'translate' ? 'rotate' : 'translate');
                        transformControl.showX = transformControl.getMode() === 'translate';
                        transformControl.showY = transformControl.getMode() === 'rotate';
                        transformControl.showZ = transformControl.getMode() === 'translate';
                    } else {
                        transformControl.setMode('translate');
                        transformControl.showX = true;
                        transformControl.showY = false;
                        transformControl.showZ = true;
                        transformControl.attach(eqHitGroup);
                    }
                }
            } else {
                if (transformControl) transformControl.detach();
            }
        });


        const keys = { w: 0, a: 0, s: 0, d: 0, q: 0, e: 0 };
        const handleWalkKeyDown = (e: KeyboardEvent) => e?.key && e.key.toLowerCase() in keys && ((keys as any)[e.key.toLowerCase()] = 1);
        const handleWalkKeyUp = (e: KeyboardEvent) => e?.key && e.key.toLowerCase() in keys && ((keys as any)[e.key.toLowerCase()] = 0);
        window.addEventListener('keydown', handleWalkKeyDown);
        window.addEventListener('keyup', handleWalkKeyUp);

        world.renderer!.onBeforeUpdate.add(() => {
            if (!ui.btnWalk.classList.contains('active')) return;
            const v = 0.5, c = world.camera.controls;
            if (keys.w) c.forward(v, true); if (keys.s) c.forward(-v, true);
            if (keys.a) c.truck(-v, 0, true); if (keys.d) c.truck(v, 0, true);
            if (keys.q) c.elevate(-v, true); if (keys.e) c.elevate(v, true);
        });

        ui.viewport.addEventListener('click', () => ui.btnWalk.classList.contains('active') && ui.viewport.requestPointerLock());
        ui.viewport.addEventListener('pointermove', (e: PointerEvent) => document.pointerLockElement === ui.viewport && (world.camera.controls.azimuthAngle -= e.movementX * 0.002, world.camera.controls.polarAngle -= e.movementY * 0.002));

        ui.btnOrbit.onclick = () => { document.exitPointerLock(); ui.btnOrbit.classList.add('active'); ui.btnWalk.classList.remove('active'); };
        ui.btnWalk.onclick = () => { ui.btnWalk.classList.add('active'); ui.btnOrbit.classList.remove('active'); };

                activeGhostMesh = null;
        
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
                console.log('[MEP-DND] viewport dragover: creating ghost for', draggedId, { L, W, H });
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
                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
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
        
        // Viewport drop listener handles ghost mesh and drag state cleanup.
        // Equipment placement mutation is authoritatively handled by document-level handleDrop.
        ui.viewport.addEventListener('drop', () => {
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
            useViewerStore.getState().setDraggedEquipmentId(null);
        });
        // --- 2D DIRECT EQUIPMENT DRAGGING ---
        let selectedEquipmentId: string | null = null;
        let activePlacedDragGroup: THREE.Group | null = null;
        let pointerIsDraggingPlaced = false;
        let dragStartX = 0;
        let dragStartY = 0;

        const updateEquipmentHighlights = () => {
            placedEquipment3DMeshes.forEach(g => {
                const isSelected = g.userData?.equipmentId === selectedEquipmentId;
                g.traverse(c => {
                    if (c instanceof THREE.Mesh) {
                        (c.material as THREE.MeshBasicMaterial).color.setHex(isSelected ? 0xffa500 : 0x3b82f6);
                    }
                });
            });
        };

        const checkPlacedEquipmentHit = (ndcX: number, ndcY: number) => {
            if (!ui.btn2d.classList.contains('active')) return null;
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
                        if (bbox && localClick.x >= bbox.min.x && localClick.x <= bbox.max.x &&
                            localClick.z >= bbox.min.z && localClick.z <= bbox.max.z) {
                            hit = true;
                        }
                    }
                });
                if (hit) return group;
            }
            return null;
        };

        ui.viewport.addEventListener('pointerdown', (e: PointerEvent) => {
            if (!ui.btn2d.classList.contains('active')) return;
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const hitGroup = checkPlacedEquipmentHit(ndcX, ndcY);
            if (hitGroup) {
                selectedEquipmentId = hitGroup.userData.equipmentId;
                activePlacedDragGroup = hitGroup;
                pointerIsDraggingPlaced = false;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                
                updateEquipmentHighlights();
                
                ui.viewport.setPointerCapture(e.pointerId);
                if (world.camera?.controls) world.camera.controls.enabled = false;
                e.stopImmediatePropagation();
            } else {
                selectedEquipmentId = null;
                updateEquipmentHighlights();
                activePlacedDragGroup = null;
            }
        });

        ui.viewport.addEventListener('pointermove', (e: PointerEvent) => {
            if (!ui.btn2d.classList.contains('active')) return;
            if (activePlacedDragGroup && ui.viewport.hasPointerCapture(e.pointerId)) {
                if (!pointerIsDraggingPlaced && (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3)) {
                    pointerIsDraggingPlaced = true;
                }
                
                if (pointerIsDraggingPlaced) {
                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
                    
                    const pseudoMouseEvent = new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY });
                    const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(pseudoMouseEvent) : null;
                    
                    if (hit) {
                        const level = useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(hit.storeyExpressId));
                        const floorElevation = level ? level.elevation : 0;
                        activePlacedDragGroup.position.set(hit.point.x, floorElevation, hit.point.z);
                    } else {
                        activePlacedDragGroup.position.set(worldPos.x, activePlacedDragGroup.position.y, worldPos.z);
                    }
                }
                e.stopImmediatePropagation();
            }
        });

        ui.viewport.addEventListener('pointerup', (e: PointerEvent) => {
            if (activePlacedDragGroup && ui.viewport.hasPointerCapture(e.pointerId)) {
                ui.viewport.releasePointerCapture(e.pointerId);
                if (world.camera?.controls) world.camera.controls.enabled = true;
                
                if (pointerIsDraggingPlaced) {
                    const equipId = activePlacedDragGroup.userData.equipmentId;
                    const pseudoMouseEvent = new MouseEvent('mouseup', { clientX: e.clientX, clientY: e.clientY });
                    const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(pseudoMouseEvent) : null;
                    
                    if (hit) {
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
                }
                
                activePlacedDragGroup = null;
                pointerIsDraggingPlaced = false;
                e.stopImmediatePropagation();
            }
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
            onLevelChange: (val: string) => { ui.selectLevel.value = val; ui.selectLevel.onchange && ui.selectLevel.onchange(); },
            onExportSchedule: () => { if ((window as any)._onGenerateSchedule) (window as any)._onGenerateSchedule(); },
            onRemoveModel: async () => {
                if (confirm("Are you sure you want to remove the loaded IFC model from this project?")) {
                    const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
                    if (activeProjId) {
                        await deleteProjectIfcFile(activeProjId);
                    }
                    (window as any)._currentLoadedFile = null;
                    (window as any).__BIM_VIEWER_SPACES__ = null;
                    try {
                        localStorage.removeItem('mep_active_bim_spaces');
                        if (activeProjId) localStorage.removeItem(`mep_active_bim_spaces_${activeProjId}`);
                    } catch {}
                    await cleanupCurrentSceneAndModel();
                    store().setIsLoaded(false);
                    store().setIsLoading(false);
                    window.location.reload();
                }
            }
        };
        
        setIsReady(true);

        // Preload saved project IFC file if present for active project
        let isPreloadTriggered = false;
        const activeProjId = workspaceStore.getState().activeProjectId || (typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") : "");
        if (activeProjId && !isPreloadTriggered) {
            isPreloadTriggered = true;
            getProjectIfcFile(activeProjId).then((savedFile) => {
                if (savedFile && (window as any).loadIfcFile) {
                    if (currentModel && activeModelSignature === `${savedFile.name}_${savedFile.size}`) {
                        console.log(`⚡ Model "${savedFile.name}" already active for project "${activeProjId}". Skipping duplicate preload.`);
                        store().setIsLoaded(true);
                        store().setIsLoading(false);
                        return;
                    }
                    console.log(`Preloading saved project IFC file: "${savedFile.name}" for project "${activeProjId}"...`);
                    (window as any).loadIfcFile(savedFile, true);
                } else {
                    console.log(`No saved IFC file found for project "${activeProjId}". Displaying clean upload state.`);
                    (window as any)._currentLoadedFile = null;
                    (window as any).__BIM_VIEWER_SPACES__ = null;
                    store().setIsLoaded(false);
                    store().setIsLoading(false);
                }
            });
        }

        return () => {
            isInitialized.current = false;
            document.getElementById = getElementByIdBackup;
            document.removeEventListener('dragover', handleDragOver);
            document.removeEventListener('drop', handleDrop);
            window.removeEventListener('mep-focus-equipment', handleFocusEquipment);
            if (transformControl) { transformControl.detach(); transformControl.dispose(); }
            window.removeEventListener('keydown', handleShiftDown);
            window.removeEventListener('keyup', handleShiftUp);
            window.removeEventListener('keydown', handleWalkKeyDown);
            window.removeEventListener('keyup', handleWalkKeyUp);
            if (rendererManagerRef.current) {
                rendererManagerRef.current.pause();
            }
        };
    }, []);

    if (webglError) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e20] text-white p-8 gap-5 h-full w-full select-none">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl shadow-inner">
                    ⚡
                </div>
                <div className="text-center max-w-md">
                    <h3 className="text-lg font-bold text-slate-100">3D WebGL Engine Ready for Restart</h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        The browser graphics pipeline experienced a temporary WebGL context refresh. Click below to reconnect the 3D BIM workspace.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setWebglError(false);
                        isInitialized.current = false;
                        window.location.reload();
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition-all cursor-pointer border border-blue-400/30 active:scale-95"
                >
                    Restart 3D Engine
                </button>
            </div>
        );
    }

    const getCb = () => (window as any)._toolbarCallbacks || {};

    return (
        <div className="flex-1 relative w-full h-full">
            <DropOverlay />
            <div id="viewport" ref={viewportRef} className="absolute inset-0 z-0"></div>
            <Toolbar 
                on3dToggle={() => getCb().on3dToggle?.()}
                on2dToggle={() => getCb().on2dToggle?.()}
                onColorToggle={(mode: string) => getCb().onColorToggle?.(mode)}
                onOrbitToggle={() => getCb().onOrbitToggle?.()}
                onWalkToggle={() => getCb().onWalkToggle?.()}
                onClipToggle={() => getCb().onClipToggle?.()}
                onTagsToggle={() => getCb().onTagsToggle?.()}
                onSpacesToggle={() => getCb().onSpacesToggle?.()}
                onLevelChange={(val: string) => getCb().onLevelChange?.(val)}
                onExportSchedule={() => getCb().onExportSchedule?.()}
                onRemoveModel={() => getCb().onRemoveModel?.()}
            />

            {/* TARV Brand Watermark Badge (Bottom-Left) */}
            <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(20,20,24,0.85)] border border-slate-700/60 shadow-lg backdrop-blur-md pointer-events-none select-none">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-sm">
                    <span className="text-[11px] font-black text-slate-950 tracking-tighter leading-none">T</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[12px] font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-400 leading-tight">
                        TARV
                    </span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                        MEP 3D ENGINE
                    </span>
                </div>
            </div>
        </div>
    );
}
