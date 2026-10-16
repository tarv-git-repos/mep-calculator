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
import { workspaceStore, useWorkspace } from '@/lib/workspace-store';
import { Box, X } from 'lucide-react';
import { toast } from 'sonner';
import { saveProjectIfcFile, getProjectIfcFile, deleteProjectIfcFile } from '@/lib/projectIfcStorage';
import { isMepValidSpaceName, sortSpacesByFloorAndName, resolveBestSpaceName, getFloorRank } from '@/lib/bimViewerSpaceExtractor';
import { api as backendApi } from '@/services/api';
import { hasLiteralDimensions, getEquipmentLiteralDimensions } from '@/lib/ahu-dimensions-data';

import { ensureApiBridge } from '../tauri-bridge';

// ============================================================================
// CONFIGURATION: Adjust these values to perfectly align the 2D spaces with the 3D model
// Increasing X moves the spaces RIGHT. Decreasing X moves them LEFT.
// Increasing Z moves the spaces DOWN (on screen). Decreasing Z moves them UP.
// ============================================================================
const CONFIG_SPACE_OFFSET_X = -5.7; // Adjusted further right from -5.0
const CONFIG_SPACE_OFFSET_Z = 9.65;  // Adjust this if you need to move them up/down
// ============================================================================

export function Viewport3D() {
    const viewportRef = useRef<HTMLDivElement>(null);
    const isInitialized = useRef(false);
    const [isReady, setIsReady] = useState(false);
    const [webglError, setWebglError] = useState(false);
    const rendererManagerRef = useRef<RendererManager | null>(null);

    const selectedEquipmentId = useViewerStore(state => state.selectedEquipmentId);
    const { equipment } = useWorkspace();
    const selectedEquip = equipment.find(e => e.id === selectedEquipmentId && (e.locationSpaceId || e.positionX !== undefined) && hasLiteralDimensions(e));

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

            constructor(private hasCls: (cls: string) => boolean, private addCls: (cls: string) => void, private rmCls: (cls: string) => void) { }
        }

        const ui = {
            viewport: viewportElement,
            overlay: { classList: { add: () => { }, remove: () => { } }, style: { display: 'flex' } },
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
                appendChild: () => { }
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

        const handleViewportWheel = (e: WheelEvent) => {
            if (!world?.camera?.controls) return;

            // Guarantee camera controls are enabled whenever the user is not actively dragging equipment
            if (!(window as any)._isActivelyDraggingEquipment) {
                world.camera.controls.enabled = true;
            }

            const is2D = ui.btn2d.classList.contains('active') || ((world.camera.three as any)?.isOrthographicCamera ?? false);
            if (is2D) {
                world.camera.controls.mouseButtons.wheel = 32; // CameraControls.ACTION.ZOOM
                if (e.shiftKey) {
                    e.preventDefault();
                    const currentZoom = (world.camera.three as any).zoom || 1;
                    const factor = e.deltaY < 0 ? 1.3 : 0.77;
                    world.camera.controls.zoomTo(Math.max(0.001, Math.min(100, currentZoom * factor)), true);
                }
            } else {
                world.camera.controls.mouseButtons.wheel = 16; // CameraControls.ACTION.DOLLY
                if (e.shiftKey) {
                    e.preventDefault();
                    const delta = e.deltaY < 0 ? 3.0 : -3.0;
                    world.camera.controls.dolly(delta, true);
                }
            }
        };

        ui.viewport.addEventListener('wheel', handleViewportWheel, { passive: false });

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
                } catch { }
            }
        };

        let cameraUpdateDebounce: any = null;
        if (world.camera?.controls) {
            world.camera.controls.addEventListener("update", () => {
                if (isFragmentsInitialized && fragments?.core) {
                    try { fragments.core.update(); } catch { }
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

        const getMedianSpaceMinY = (spaces: any[]): number | null => {
            if (!spaces || spaces.length === 0) return null;
            const currentVerticalAxis = (world?.camera?.three && Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
            const yVals = spaces
                .map(sp => (currentVerticalAxis === 'y' ? sp.box?.min?.y : sp.box?.min?.z))
                .filter(y => typeof y === 'number' && !isNaN(y))
                .sort((a, b) => a - b);
            if (yVals.length === 0) return null;
            return yVals[Math.floor(yVals.length / 2)];
        };

        let placedEquipment3DMeshes: THREE.Group[] = [];
        let activeStoreys: { name: string; elevation: number; expressId: number; spaces: any[]; localSpaceIds: Set<number>; localElementIds: Set<number> }[] = [];
        let activeGetWorldHeight: ((elevation: number) => number) | null = null;
        let activeRenderEquipmentMeshes: (() => void) | null = null;
        let unsubEquipmentStore: (() => void) | null = null;
        let activeSelectHighlightHandler: any = null;
        let activeSelectClearHandler: any = null;
        let viewportAbortController: AbortController | null = null;

        const disposeMeshList = (list: any[]) => {
            try {
                list.forEach(m => {
                    try {
                        if (m.parent) m.parent.remove(m);
                        else if (world?.scene?.three) world.scene.three.remove(m);

                        m.traverse?.((child: any) => {
                            if (child.parent && child !== m) child.parent.remove(child);
                            if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
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
                        });

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
                    } catch { }
                });
            } catch { }
            list.length = 0;
        };

        const getStoreyElevationInMeters = (elev: number): number => {
            if (typeof elev !== 'number' || isNaN(elev)) return 0;
            if (Math.abs(elev) > 50) return elev / 1000;
            return elev;
        };

        const normalizeFloorName = (name?: string): string => {
            if (!name) return '';
            const clean = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (clean.includes('ground') || clean === 'gf' || clean === 'g' || clean === 'level0' || clean === 'floor0' || clean === 'l0' || clean === 'l00' || clean === '0' || clean === '00') return 'ground';
            if (clean.includes('first') || clean.includes('1st') || clean === 'ff' || clean === 'level1' || clean === 'floor1' || clean === 'l1' || clean === 'l01' || clean === '1' || clean === '01') return 'first';
            if (clean.includes('second') || clean.includes('2nd') || clean === 'sf' || clean === 'level2' || clean === 'floor2' || clean === 'l2' || clean === 'l02' || clean === '2' || clean === '02') return 'second';
            if (clean.includes('third') || clean.includes('3rd') || clean === 'tf' || clean === 'level3' || clean === 'floor3' || clean === 'l3' || clean === 'l03' || clean === '3' || clean === '03') return 'third';
            if (clean.includes('roof') || clean.includes('terrace') || clean.includes('top') || clean.includes('parapet')) return 'roof';
            if (clean.includes('basement') || clean === 'b1' || clean.includes('level-1') || clean === 'lb') return 'basement';
            return clean;
        };

        const matchFloorNames = (a?: string, b?: string): boolean => {
            if (!a || !b) return false;
            const strA = String(a).trim().toLowerCase();
            const strB = String(b).trim().toLowerCase();
            if (strA === strB) return true;
            const normA = normalizeFloorName(strA);
            const normB = normalizeFloorName(strB);
            if (normA !== '' && normA === normB) return true;
            const rankA = getFloorRank(strA);
            const rankB = getFloorRank(strB);
            if (rankA !== 500 && rankA !== 999 && rankA === rankB) return true;
            return false;
        };

        const findStoreyByFloor = (floorNameOrId?: string | number) => {
            if (!floorNameOrId) return null;
            const str = String(floorNameOrId).trim();
            if (!str) return null;

            if (activeStoreys && activeStoreys.length > 0) {
                const byId = activeStoreys.find((s: any) => String(s.expressId) === str);
                if (byId) return byId;
                const byExact = activeStoreys.find((s: any) => s.name?.toLowerCase() === str.toLowerCase());
                if (byExact) return byExact;
                const byNorm = activeStoreys.find((s: any) => matchFloorNames(s.name, str));
                if (byNorm) return byNorm;
            }

            const storeLevels = useViewerStore.getState().levels;
            if (storeLevels && storeLevels.length > 0) {
                const byId = storeLevels.find((s: any) => String(s.expressId) === str);
                if (byId) return { ...byId, spaces: (byId as any).spaces || [] };
                const byExact = storeLevels.find((s: any) => s.name?.toLowerCase() === str.toLowerCase());
                if (byExact) return { ...byExact, spaces: (byExact as any).spaces || [] };
                const byNorm = storeLevels.find((s: any) => matchFloorNames(s.name, str));
                if (byNorm) return { ...byNorm, spaces: (byNorm as any).spaces || [] };
            }

            // Fallback for roof queries: if query indicates roof, return roof storey or virtual roof
            if (/roof|terrace|parapet|deck/i.test(str) || normalizeFloorName(str) === 'roof') {
                const roofSt = activeStoreys?.find((s: any) => /roof|terrace|parapet|deck/i.test(s.name));
                if (roofSt) return roofSt;
                const topElev = (activeStoreys && activeStoreys.length > 0)
                    ? Math.max(...activeStoreys.map((s: any) => getStoreyElevationInMeters(s.elevation))) + 3.8
                    : 7.6;
                return {
                    name: 'ROOF LEVEL',
                    elevation: topElev * 1000,
                    expressId: -9999,
                    spaces: [],
                    localSpaceIds: new Set<number>(),
                    localElementIds: new Set<number>()
                };
            }

            return null;
        };

        const cleanupCurrentSceneAndModel = async () => {
            // 1. Abort previous viewport event listeners
            try {
                if (viewportAbortController) {
                    viewportAbortController.abort();
                    viewportAbortController = null;
                }
            } catch { }

            // 2. Remove selection highlighter listeners
            try {
                if (activeSelectHighlightHandler && selectionManager.highlighter?.events?.select?.onHighlight) {
                    selectionManager.highlighter.events.select.onHighlight.remove(activeSelectHighlightHandler);
                    activeSelectHighlightHandler = null;
                }
            } catch { }
            try {
                if (activeSelectClearHandler && selectionManager.highlighter?.events?.select?.onClear) {
                    selectionManager.highlighter.events.select.onClear.remove(activeSelectClearHandler);
                    activeSelectClearHandler = null;
                }
            } catch { }
            try { await selectionManager.clear(); } catch { }

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
                    } catch { }
                });
            } catch { }
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
            activeStoreys = [];
            activeGetWorldHeight = null;
            if (unsubEquipmentStore) { unsubEquipmentStore(); unsubEquipmentStore = null; }

            // 5. Remove clip plane
            try {
                if (floorPlanManager.activePlaneId) {
                    await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId);
                    floorPlanManager.activePlaneId = null;
                }
            } catch { }

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
                            } catch { }
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
            } catch { }
        };

        const safeRaycastModel = (raycaster: THREE.Raycaster, modelObject?: THREE.Object3D | null): THREE.Intersection[] => {
            if (!modelObject) return [];
            const results: THREE.Intersection[] = [];
            modelObject.traverse((child: any) => {
                if (!child.visible) return;
                if (child.isMesh || child.isInstancedMesh) {
                    const geom = child.geometry;
                    if (!geom || !geom.attributes || !geom.attributes.position || !geom.attributes.position.array) {
                        return;
                    }
                    if (geom.attributes.position.count === 0) {
                        return;
                    }
                    try {
                        const childIntersects: THREE.Intersection[] = [];
                        child.raycast(raycaster, childIntersects);
                        for (let k = 0; k < childIntersects.length; k++) {
                            results.push(childIntersects[k]);
                        }
                    } catch (_) {
                        // Skip faulty mesh safely without failing the raycast for the rest of the model
                    }
                }
            });
            results.sort((a, b) => a.distance - b.distance);
            return results;
        };
        (window as any)._safeRaycastModel = safeRaycastModel;

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

                const raycastSpaceUnderCursor = (e: MouseEvent, targetStoreyExpressId?: number | string): { space: any; expressId: number; storeyExpressId: number; point: THREE.Vector3 } | null => {
                    const is2DActive = ui.btn2d.classList.contains('active') || store().viewMode === '2d';
                    if (!is2DActive) return null;

                    const rect = ui.viewport.getBoundingClientRect();
                    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                    // Use Three.js Raycaster from the active 2D orthographic camera
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

                    const activeLevelId = targetStoreyExpressId || ui.selectLevel.value;
                    const effectiveLevel = activeLevelId
                        ? (useViewerStore.getState().levels.find((l: any) => String(l.expressId) === String(activeLevelId)) || (activeStoreys && activeStoreys.find((l: any) => String(l.expressId) === String(activeLevelId))))
                        : (activeStoreys && activeStoreys.length > 0 ? [...activeStoreys].sort((a, b) => a.elevation - b.elevation)[0] : null);
                    const effectiveLevelId = effectiveLevel ? String(effectiveLevel.expressId) : (activeLevelId ? String(activeLevelId) : '');

                    const floorElevation = effectiveLevel ? (effectiveLevel.elevation ?? 0) : 0;
                    const floorWorldY = activeGetWorldHeight ? activeGetWorldHeight(floorElevation) : (floorElevation > 100 ? floorElevation * 0.001 : floorElevation);

                    // Intersect horizontal floor plane at floorWorldY
                    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorWorldY);
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
                        console.log('[MEP-DND] world:', { clickX: Number(clickX.toFixed(2)), clickZ: Number(clickZ.toFixed(2)), floorWorldY });
                        console.log('[MEP-DND] effective level:', effectiveLevelId || '(none)');
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

                    // PASS 1: Test against 2D polygon footprints on effective level
                    if (spaceWorldPolygons.size > 0) {
                        for (const [expressId, data] of spaceWorldPolygons) {
                            if (effectiveLevelId && String(data.storeyExpressId) !== effectiveLevelId) continue;
                            if (pointInPoly(clickX, clickZ, data.worldXZ)) {
                                if (isDndEvent) {
                                    console.log('[MEP-DND] candidate spaces: [Polygon Match]', data.space?.longName || data.space?.name || expressId);
                                    console.log('[MEP-DND] hitSpace:', data.space?.longName || data.space?.name || expressId);
                                }
                                const roomFloorY = (spaceBoundsMap.get(expressId)?.box?.min?.y !== undefined)
                                    ? spaceBoundsMap.get(expressId)!.box.min.y
                                    : floorWorldY;
                                return { space: data.space, expressId, storeyExpressId: data.storeyExpressId, point: new THREE.Vector3(clickX, roomFloorY, clickZ) };
                            }
                        }
                    }

                    // PASS 2: Test 3D World Bounding Box on effective level
                    if (spaceBoundsMap.size > 0) {
                        const candidateHits: { expressId: number; data: any; distSq: number }[] = [];
                        const margin = 0.5; // 0.5m boundary tolerance for edge placement

                        for (const [expressId, data] of spaceBoundsMap) {
                            if (effectiveLevelId && String(data.storeyExpressId) !== effectiveLevelId) continue;
                            const b = data.box;
                            if (clickX >= b.min.x - margin && clickX <= b.max.x + margin &&
                                clickZ >= b.min.z - margin && clickZ <= b.max.z + margin) {
                                const dx = clickX - data.center.x;
                                const dz = clickZ - data.center.z;
                                candidateHits.push({ expressId, data, distSq: dx * dx + dz * dz });
                            }
                        }

                        if (isDndEvent) {
                            console.log('[MEP-DND] candidate spaces on level:', candidateHits.map(c => `${c.data.space?.longName || c.data.space?.name || c.expressId} (dist=${Math.sqrt(c.distSq).toFixed(1)}m, storey=${c.data.storeyExpressId})`));
                        }

                        if (candidateHits.length > 0) {
                            // Sort by proximity to room center (closest center wins)
                            candidateHits.sort((a, b) => a.distSq - b.distSq);
                            const best = candidateHits[0];
                            if (isDndEvent) {
                                console.log('[MEP-DND] hitSpace:', best.data.space?.longName || best.data.space?.name || best.expressId);
                            }
                            const roomFloorY = (best.data.box?.min?.y !== undefined)
                                ? best.data.box.min.y
                                : floorWorldY;
                            return {
                                space: best.data.space,
                                expressId: best.expressId,
                                storeyExpressId: best.data.storeyExpressId,
                                point: new THREE.Vector3(clickX, roomFloorY, clickZ)
                            };
                        }
                    }

                    // PASS 3: Fallback polygon test strictly constrained to effective level
                    if (spaceWorldPolygons.size > 0 && effectiveLevelId) {
                        for (const [expressId, data] of spaceWorldPolygons) {
                            if (String(data.storeyExpressId) !== effectiveLevelId) continue;
                            if (pointInPoly(clickX, clickZ, data.worldXZ)) {
                                if (isDndEvent) {
                                    console.log('[MEP-DND] candidate spaces: [Polygon Fallback]', data.space?.longName || data.space?.name || expressId);
                                    console.log('[MEP-DND] hitSpace:', data.space?.longName || data.space?.name || expressId);
                                }
                                const roomFloorY = (spaceBoundsMap.get(expressId)?.box?.min?.y !== undefined)
                                    ? spaceBoundsMap.get(expressId)!.box.min.y
                                    : floorWorldY;
                                return { space: data.space, expressId, storeyExpressId: data.storeyExpressId, point: new THREE.Vector3(clickX, roomFloorY, clickZ) };
                            }
                        }
                    }

                    // PASS 4: Clean fallback on target floor plane
                    return {
                        space: null,
                        expressId: 0,
                        storeyExpressId: Number(effectiveLevelId) || 0,
                        point: new THREE.Vector3(clickX, floorWorldY, clickZ)
                    };
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
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);
                    const meshes: THREE.Object3D[] = [];
                    placedEquipment3DMeshes.forEach(g => {
                        if (g.visible) {
                            g.traverse(c => {
                                if (c instanceof THREE.Mesh) meshes.push(c);
                            });
                        }
                    });
                    const hits = raycaster.intersectObjects(meshes, true);
                    if (hits.length > 0) {
                        let curr: THREE.Object3D | null = hits[0].object;
                        while (curr) {
                            if (curr.userData?.isEquipmentGroup) return curr as THREE.Group;
                            curr = curr.parent;
                        }
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
                    } catch { }
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
                        const rawElev = typeof node.elevation === 'number' ? node.elevation : 0;
                        storeys.push({
                            name: node.name || 'Unnamed Level',
                            elevation: rawElev,
                            expressId: node.expressId,
                            spaces: spaceChildren,
                            localSpaceIds: new Set<number>(),
                            localElementIds: new Set<number>()
                        });
                    }
                    if (node.children) node.children.forEach(findStoreys);
                };
                findStoreys(jsonData.project);

                const allElevationsZero = storeys.length > 1 && storeys.every(s => Math.abs(s.elevation) < 0.001);
                if (allElevationsZero) {
                    storeys.sort((a, b) => getFloorRank(a.name) - getFloorRank(b.name));
                    storeys.forEach((s, idx) => {
                        s.elevation = idx * 3800; // 3.8m spacing in mm
                    });
                } else {
                    storeys.sort((a, b) => {
                        const elevDiff = a.elevation - b.elevation;
                        if (Math.abs(elevDiff) > 0.05) return elevDiff;
                        return getFloorRank(a.name) - getFloorRank(b.name);
                    });
                }

                // If model has no explicit Roof storey, synthesize ROOF LEVEL above the highest floor
                const hasRoofStorey = storeys.some(s => /roof|terrace|parapet|deck/i.test(s.name));
                if (!hasRoofStorey && storeys.length > 0) {
                    const topStorey = storeys[storeys.length - 1];
                    const topElevMeters = getStoreyElevationInMeters(topStorey.elevation);
                    const modelTopMeters = verticalAxis === 'y' ? bbox.max.y : bbox.max.z;
                    const roofElevMeters = (modelTopMeters && !isNaN(modelTopMeters) && modelTopMeters > topElevMeters + 0.5)
                        ? modelTopMeters
                        : (topElevMeters + 3.8);
                    storeys.push({
                        name: 'ROOF LEVEL',
                        elevation: Math.round(roofElevMeters * 1000),
                        expressId: -9999,
                        spaces: [],
                        localSpaceIds: new Set<number>(),
                        localElementIds: new Set<number>()
                    });
                }

                for (const s of storeys) {
                    const ids = s.spaces.map(sp => sp.expressId);
                    const localIds = await model.getLocalIdsFromItemIds(ids);
                    s.localSpaceIds = new Set(localIds);

                    const storeyNode = findNodeById(jsonData.project, s.expressId);
                    const elemExpressIds: number[] = [];
                    getStoreyElements(storeyNode, elemExpressIds);
                    if (jsonData.elements) {
                        Object.values(jsonData.elements).forEach((el: any) => {
                            if (el && el.storeyId === s.expressId && el.expressId) {
                                elemExpressIds.push(el.expressId);
                            }
                        });
                    }
                    const localElemIds = await model.getLocalIdsFromItemIds(elemExpressIds);
                    s.localElementIds = new Set(localElemIds);
                }

                _levels = [];
                ui.selectLevel.innerHTML = '<option value="">All Levels (No Cut)</option>';
                storeys.forEach(s => {
                    const elevInMeters = getStoreyElevationInMeters(s.elevation);
                    const opt = document.createElement('option');
                    opt.value = s.expressId.toString();
                    opt.innerText = `${s.name} (${elevInMeters.toFixed(2)}m)`;
                    _levels.push({ expressId: opt.value, name: s.name, elevation: elevInMeters * 1000 });
                });
                store().setLevels(_levels);

                const spaceCenters = new Map<number, THREE.Vector3>();
                const allSpaceLocalIdsSet = new Set(spaceLocalIds);
                model.object.traverse((child: any) => {
                    child.frustumCulled = false;
                    if (child.isInstancedMesh && child.fragment && child.fragment.ids) {
                        const idsArray = Array.from(child.fragment.ids as Set<number>);
                        const hasMatchingSpaceId = idsArray.some(id => allSpaceLocalIdsSet.has(id));
                        if (hasMatchingSpaceId) {
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
                                    const globalMatrix = new THREE.Matrix4().multiplyMatrices(child.matrixWorld, matrix);

                                    // Apply the explicit space offset to correct alignment with the architectural model
                                    const spaceOffsetMatrix = new THREE.Matrix4().makeTranslation(CONFIG_SPACE_OFFSET_X, 0.0, CONFIG_SPACE_OFFSET_Z);
                                    globalMatrix.premultiply(spaceOffsetMatrix);

                                    const outline = new THREE.LineSegments(edgesGeom, lineMat);
                                    outline.applyMatrix4(globalMatrix);
                                    if (verticalAxis === 'y') outline.position.y += offsetVal; else outline.position.z += offsetVal;
                                    (outline as any).expressId = expressId;
                                    (outline as any).storeyId = storeyId;
                                    outline.visible = false;
                                    outline.renderOrder = 1;
                                    world.scene.three.add(outline);
                                    spaceLineMeshes.push(outline);

                                    if (baseBox) {
                                        const instanceBox = new THREE.Box3().copy(baseBox).applyMatrix4(globalMatrix);
                                        const origin = new THREE.Vector3().setFromMatrixPosition(globalMatrix);
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

                // --- ROBUST PHYSICAL SLAB TOP DETECTION FOR ALL BUILDING STOREYS ---
                const storeySlabTopMap = new Map<number, number>();

                // 1. Query ThatOpen IFC Categories for Slabs, Roofs, and Plates
                let slabLocalIdsSet = new Set<number>();
                try {
                    const slabCategories = await model.getItemsOfCategories([/IfcSlab/i, /IfcRoof/i, /IfcPlate/i, /IfcFloor/i]);
                    const slabIds = Object.values(slabCategories).flat() as number[];
                    slabLocalIdsSet = new Set(slabIds);
                } catch (_) {}

                // Also collect from jsonData.elements where element type indicates a slab/roof/floor
                const slabExpressIdsByStorey = new Map<number, number[]>();
                if (jsonData.elements) {
                    Object.values(jsonData.elements).forEach((el: any) => {
                        if (!el || !el.expressId) return;
                        const type = String(el.type || '').toUpperCase();
                        if (type.includes('SLAB') || type.includes('ROOF') || type.includes('FLOOR') || type.includes('PLATE')) {
                            const sId = el.storeyId;
                            if (sId !== undefined) {
                                if (!slabExpressIdsByStorey.has(sId)) slabExpressIdsByStorey.set(sId, []);
                                slabExpressIdsByStorey.get(sId)!.push(el.expressId);
                            }
                        }
                    });
                }

                // Compute bounding box of slab elements per storey using bboxer
                for (const s of storeys) {
                    const candidateLocalIds = new Set<number>();
                    if (s.localElementIds) {
                        for (const locId of s.localElementIds) {
                            if (slabLocalIdsSet.has(locId)) candidateLocalIds.add(locId);
                        }
                    }
                    const sSlabExpIds = slabExpressIdsByStorey.get(s.expressId) || [];
                    if (sSlabExpIds.length > 0) {
                        try {
                            const locIds = await model.getLocalIdsFromItemIds(sSlabExpIds);
                            locIds.forEach(id => { if (id !== undefined) candidateLocalIds.add(id); });
                        } catch (_) {}
                    }

                    if (candidateLocalIds.size > 0 && bboxer) {
                        try {
                            bboxer.list.clear();
                            await bboxer.addFromModelIdMap({ [model.modelId]: candidateLocalIds });
                            const b = bboxer.get();
                            if (!b.isEmpty() && isFinite(b.max.y)) {
                                storeySlabTopMap.set(s.expressId, b.max.y);
                                (s as any).physicalSlabTopY = b.max.y;
                                console.log(`[MEP-SLAB-DETECT] Storey "${s.name}" (ID ${s.expressId}) physical slab top via bboxer: ${b.max.y.toFixed(3)}m`);
                            }
                        } catch (err) {
                            console.warn(`[MEP-SLAB-DETECT] bboxer error for ${s.name}:`, err);
                        }
                    }
                }

                // 2. Physical 3D Downward Raycasting Probes to detect all horizontal slab planes across the building
                if (model.object) {
                    try {
                        const curBBox = new THREE.Box3().setFromObject(model.object);
                        const bCenter = new THREE.Vector3();
                        curBBox.getCenter(bCenter);
                        const bSize = new THREE.Vector3();
                        curBBox.getSize(bSize);

                        const probePoints: { x: number; z: number }[] = [];
                        probePoints.push({ x: bCenter.x, z: bCenter.z });
                        const gridSteps = 4;
                        for (let ix = 1; ix < gridSteps; ix++) {
                            for (let iz = 1; iz < gridSteps; iz++) {
                                probePoints.push({
                                    x: curBBox.min.x + (bSize.x * ix) / gridSteps,
                                    z: curBBox.min.z + (bSize.z * iz) / gridSteps
                                });
                            }
                        }

                        // Also include space centroids from jsonData if present
                        if (jsonData.elements) {
                            Object.values(jsonData.elements).forEach((el: any) => {
                                if (el && el.type === 'IFCSPACE' && el.polygon && Array.isArray(el.polygon) && el.polygon.length > 0) {
                                    let sx = 0, sy = 0;
                                    el.polygon.forEach((pt: any) => { sx += pt.x; sy += pt.y; });
                                    const scale = (bSize.y > 100 || bSize.x > 1000) ? 1.0 : 0.001;
                                    probePoints.push({ x: (sx / el.polygon.length) * scale, z: -(sy / el.polygon.length) * scale });
                                }
                            });
                        }

                        const rayStartY = curBBox.max.y + 4.0;
                        const rayDist = (curBBox.max.y - curBBox.min.y) + 8.0;
                        const detectedSurfaces: number[] = [];

                        for (const pt of probePoints) {
                            const probeRay = new THREE.Raycaster(
                                new THREE.Vector3(pt.x, rayStartY, pt.z),
                                new THREE.Vector3(0, -1, 0),
                                0.01,
                                rayDist
                            );
                            const hits = safeRaycastModel(probeRay, model.object);
                            for (const hit of hits) {
                                let worldNormalY = 1.0;
                                if (hit.face) {
                                    const norm = hit.face.normal.clone();
                                    if ((hit.object as any).isInstancedMesh && typeof hit.instanceId === 'number') {
                                        const instMesh = hit.object as THREE.InstancedMesh;
                                        const instMat = new THREE.Matrix4();
                                        instMesh.getMatrixAt(hit.instanceId, instMat);
                                        const worldMat = new THREE.Matrix4().multiplyMatrices(instMesh.matrixWorld, instMat);
                                        const normMat = new THREE.Matrix3().getNormalMatrix(worldMat);
                                        norm.applyMatrix3(normMat).normalize();
                                    } else {
                                        const normMat = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                                        norm.applyMatrix3(normMat).normalize();
                                    }
                                    worldNormalY = norm.y;
                                }
                                if (worldNormalY > 0.75) {
                                    detectedSurfaces.push(hit.point.y);
                                }
                            }
                        }

                        if (detectedSurfaces.length > 0) {
                            detectedSurfaces.sort((a, b) => a - b);
                            const clusters: { y: number; count: number }[] = [];
                            for (const y of detectedSurfaces) {
                                const c = clusters.find(cl => Math.abs(cl.y - y) < 0.15);
                                if (c) {
                                    c.y = (c.y * c.count + y) / (c.count + 1);
                                    c.count++;
                                } else {
                                    clusters.push({ y, count: 1 });
                                }
                            }

                            // Keep clusters with multiple hits, sorted ascending by Y
                            const slabPlanes = clusters.filter(c => c.count >= 2).sort((a, b) => a.y - b.y);
                            console.log('[MEP-SLAB-DETECT] Raycast detected slab planes:', slabPlanes.map(p => `${p.y.toFixed(3)}m (hits=${p.count})`));

                            const sortedStoreys = [...storeys].sort((a, b) => a.elevation - b.elevation);

                            // Find a reference datum offset from any already-detected storey
                            let refDatumOffset: number | null = null;
                            for (const s of sortedStoreys) {
                                if (storeySlabTopMap.has(s.expressId)) {
                                    refDatumOffset = storeySlabTopMap.get(s.expressId)! - getStoreyElevationInMeters(s.elevation);
                                    break;
                                }
                            }

                            if (refDatumOffset !== null) {
                                for (const s of sortedStoreys) {
                                    if (!storeySlabTopMap.has(s.expressId)) {
                                        const expY = getStoreyElevationInMeters(s.elevation) + refDatumOffset;
                                        const closest = slabPlanes.find(p => Math.abs(p.y - expY) < 0.6);
                                        const finalY = closest ? closest.y : expY;
                                        storeySlabTopMap.set(s.expressId, finalY);
                                        (s as any).physicalSlabTopY = finalY;
                                        console.log(`[MEP-SLAB-DETECT] Storey "${s.name}" slab top matched via ref offset: ${finalY.toFixed(3)}m`);
                                    }
                                }
                            } else if (slabPlanes.length > 0) {
                                const roofStorey = sortedStoreys[sortedStoreys.length - 1];
                                const highestPlane = slabPlanes[slabPlanes.length - 1];
                                const impliedOffset = highestPlane.y - getStoreyElevationInMeters(roofStorey.elevation);

                                for (const s of sortedStoreys) {
                                    if (!storeySlabTopMap.has(s.expressId)) {
                                        const expY = getStoreyElevationInMeters(s.elevation) + impliedOffset;
                                        let closest = slabPlanes[0];
                                        let minDiff = Infinity;
                                        for (const p of slabPlanes) {
                                            const diff = Math.abs(p.y - expY);
                                            if (diff < minDiff) { minDiff = diff; closest = p; }
                                        }
                                        const finalY = minDiff < 0.8 ? closest.y : expY;
                                        storeySlabTopMap.set(s.expressId, finalY);
                                        (s as any).physicalSlabTopY = finalY;
                                        console.log(`[MEP-SLAB-DETECT] Storey "${s.name}" slab top matched via slab planes: ${finalY.toFixed(3)}m`);
                                    }
                                }
                            }
                        }
                    } catch (probeErr) {
                        console.warn('[MEP-SLAB-DETECT] 3D raycast probe error:', probeErr);
                    }
                }

                // Determine the global calibrated datum offset
                let globalDatumOffset = 0;
                let foundGlobalDatum = false;
                for (const s of storeys) {
                    if (storeySlabTopMap.has(s.expressId)) {
                        globalDatumOffset = storeySlabTopMap.get(s.expressId)! - getStoreyElevationInMeters(s.elevation);
                        foundGlobalDatum = true;
                        break;
                    }
                }

                if (!foundGlobalDatum) {
                    for (const s of storeys) {
                        const spaces = Array.from(activeSpaceBoundsMap.values()).filter(sp => String(sp.storeyExpressId) === String(s.expressId));
                        const medianY = getMedianSpaceMinY(spaces);
                        if (medianY !== null) {
                            globalDatumOffset = medianY - getStoreyElevationInMeters(s.elevation);
                            foundGlobalDatum = true;
                            break;
                        }
                    }
                }

                if (!foundGlobalDatum) {
                    const curBBox = new THREE.Box3().setFromObject(model.object);
                    const baseElevation = storeys.length > 0 ? getStoreyElevationInMeters(storeys[0].elevation) : 0;
                    globalDatumOffset = (verticalAxis === 'y' ? curBBox.min.y : curBBox.min.z) - baseElevation;
                }

                console.warn('[MEP-CALIBRATED-DATUM]', {
                    globalDatumOffset,
                    foundGlobalDatum,
                    detectedStoreysCount: storeySlabTopMap.size,
                    detectedStoreys: Array.from(storeySlabTopMap.entries()).map(([id, y]) => ({ id, y }))
                });

                const getWorldHeight = (elevation: number): number => {
                    const elevInMeters = getStoreyElevationInMeters(elevation);

                    // 1. Check if elevation matches a known storey with detected physical slab
                    const matchedStorey = storeys.find(s => Math.abs(getStoreyElevationInMeters(s.elevation) - elevInMeters) < 0.2);
                    if (matchedStorey) {
                        if (storeySlabTopMap.has(matchedStorey.expressId)) {
                            return storeySlabTopMap.get(matchedStorey.expressId)!;
                        }
                        const spacesOnStorey = Array.from(activeSpaceBoundsMap.values()).filter(sp => String(sp.storeyExpressId) === String(matchedStorey.expressId));
                        const medianY = getMedianSpaceMinY(spacesOnStorey);
                        if (medianY !== null) {
                            return medianY;
                        }
                    }

                    return elevInMeters + globalDatumOffset;
                };

                activeStoreys = storeys;
                activeGetWorldHeight = getWorldHeight;

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
                    if (!space) {
                        ui.selectedSpaceInfo.innerHTML = '<div class="text-[#777] italic">Select a space in 3D or 2D view to inspect properties</div>';
                        return;
                    }
                    const parentStorey = storeys?.find(st => st.spaces?.some(sp => sp?.expressId === space.expressId));
                    const floorLabel = parentStorey ? parentStorey.name : 'Unknown Floor';

                    ui.selectedSpaceInfo.innerHTML = `
                        <div style="margin-bottom: 6px;"><strong>Name:</strong> ${space.longName || space.name || 'Room'}</div>
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
                    try { await selectionManager.clear(); } catch { }
                    await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
                    floorPlanManager.activePlaneId = null;

                    if (val === '') {
                        const allElementIds = new Set<number>();
                        storeys.forEach(s => s.localElementIds.forEach(id => allElementIds.add(id)));
                        await hider.set(true, { [model.modelId]: allElementIds });
                        await hider.set(false, spaceMap);
                        updateTagsForLevel('');
                        spaceLineMeshes.forEach(line => line.visible = false);
                        if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
                        return;
                    }

                    const storey = storeys.find(st => st.expressId.toString() === val);
                    if (!storey) return;

                    const index = storeys.indexOf(storey);
                    const storeyElevMeters = getStoreyElevationInMeters(storey.elevation);
                    const nextStorey = (index < storeys.length - 1) ? storeys[index + 1] : null;
                    const storeyHeightMeters = nextStorey
                        ? Math.max(2.4, getStoreyElevationInMeters(nextStorey.elevation) - storeyElevMeters)
                        : 3.5;

                    const isRoofLevel = /roof|terrace|parapet|deck/i.test(storey.name);
                    const currentVerticalAxis = (Math.abs(world.camera.three.up.z) > 0.5) ? 'z' : 'y';
                    const floorWorldHeight = getWorldHeight(storey.elevation);

                    // For interior storeys, cut away ceiling and upper roof: cut plane at ~2.2m above floor slab
                    // For roof levels, don't cut into the roof: cut well above the roof surface
                    const cutOffsetFromFloor = isRoofLevel ? 10.0 : Math.min(storeyHeightMeters - 0.3, 2.2);
                    const cutWorldHeight = floorWorldHeight + cutOffsetFromFloor;

                    const worldCutPoint = currentVerticalAxis === 'y' ? new THREE.Vector3(0, cutWorldHeight, 0) : new THREE.Vector3(0, 0, cutWorldHeight);
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
                        const planeY = getWorldHeight(storey.elevation);

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
                    if (world.camera?.controls) {
                        if (is2DView) world.camera.controls.mouseButtons.wheel = 32;
                        else world.camera.controls.mouseButtons.wheel = 16;
                        world.camera.controls.enabled = true;
                    }
                    if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
                };

                ui.btnClip.onclick = async () => {
                    const act = ui.btnClip.classList.toggle('active');
                    if (!act) {
                        ui.selectLevel.value = ''; ui.selectLevel.style.display = 'none';
                        await floorPlanManager.deleteClipPlane(floorPlanManager.activePlaneId || undefined);
                        floorPlanManager.activePlaneId = null;
                        await hider.set(false, spaceMap);
                        updateTagsForLevel('');
                        try { await selectionManager.clear(); } catch { }
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
                                const planeY = getWorldHeight(selectedStorey.elevation);

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
                    if (world.camera?.controls) {
                        world.camera.controls.mouseButtons.wheel = 32;
                        world.camera.controls.enabled = true;
                    }
                    if (!ui.btnSpaces.classList.contains('active')) { ui.btnSpaces.classList.add('active'); store().setIsSpacesActive(true); }
                    if (!ui.btnTags.classList.contains('active')) { ui.btnTags.classList.add('active'); store().setIsTagsActive(true); }
                    await hider.set(ui.btnSpaces.classList.contains('active'), spaceMap);
                    const gfStorey = storeys.find(st => /ground/i.test(st.name) || /^gf/i.test(st.name)) || storeys.find(st => st.spaces && st.spaces.length > 0) || storeys[0];
                    if (gfStorey) {
                        ui.selectLevel.value = gfStorey.expressId.toString();
                        store().setSelectedLevel(gfStorey.expressId.toString());
                    }
                    await (ui.selectLevel as any).onchange();
                    if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
                };

                ui.btn3d.onclick = async () => {
                    if (ui.btn3d.classList.contains('active')) return;
                    ui.btn3d.classList.add('active'); ui.btn2d.classList.remove('active');
                    store().setViewMode('3d');
                    ui.btnOrbit.style.display = 'inline-block'; ui.btnWalk.style.display = 'inline-block'; ui.btnClip.style.display = 'inline-block';
                    await floorPlanManager.enter3DMode();
                    if (world.camera?.controls) {
                        world.camera.controls.mouseButtons.wheel = 16;
                        world.camera.controls.enabled = true;
                    }
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
                    if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
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

                const SPACE_OFFSET_X = CONFIG_SPACE_OFFSET_X;
                const SPACE_OFFSET_Z = CONFIG_SPACE_OFFSET_Z;
                const SPACE_OFFSET_Y = 0.0;
                const TAG_WORLD_WIDTH_METERS = 1.5;

                const PLANE_OFFSET_X = 0.0;
                const PLANE_OFFSET_Z = 0.0;

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

                    let vec: THREE.Vector3;
                    if (currentVerticalAxis === 'y') vec = new THREE.Vector3(localX * scale + SPACE_OFFSET_X, localZ * scale + SPACE_OFFSET_Y, -localY * scale + SPACE_OFFSET_Z);
                    else vec = new THREE.Vector3(localX * scale + SPACE_OFFSET_X, localY * scale + SPACE_OFFSET_Z, localZ * scale + SPACE_OFFSET_Y);

                    if (model.object && model.object.matrixWorld) {
                        vec.applyMatrix4(model.object.matrixWorld);
                    }
                    return vec;
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
                        const boundsData = activeSpaceBoundsMap.get(s.expressId);
                        const targetY = boundsData?.box?.min?.y !== undefined
                            ? boundsData.box.min.y + 0.02
                            : (parentStorey ? getWorldHeight(parentStorey.elevation) : getWorldHeight(0));

                        const shape = new THREE.Shape();
                        const linePoints: THREE.Vector3[] = [];
                        const worldXZ: { x: number, z: number }[] = [];

                        // Robustly map the raw 2D polygon footprint exactly into the true 3D bounding box of the physical mesh
                        if (boundsData && boundsData.box && s.polygon.length > 0) {
                            const instanceBox = boundsData.box;

                            let rawMinX = Infinity, rawMaxX = -Infinity;
                            let rawMinY = Infinity, rawMaxY = -Infinity;
                            s.polygon.forEach((pt: any) => {
                                if (pt.x < rawMinX) rawMinX = pt.x;
                                if (pt.x > rawMaxX) rawMaxX = pt.x;
                                if (pt.y < rawMinY) rawMinY = pt.y;
                                if (pt.y > rawMaxY) rawMaxY = pt.y;
                            });

                            const rawWidthX = rawMaxX - rawMinX;
                            const rawWidthY = rawMaxY - rawMinY;
                            const trueWidthX = instanceBox.max.x - instanceBox.min.x;
                            const trueWidthZ = instanceBox.max.z - instanceBox.min.z;

                            const scaleX = rawWidthX > 0.0001 ? (trueWidthX / rawWidthX) : 1;
                            const scaleZ = rawWidthY > 0.0001 ? (trueWidthZ / rawWidthY) : 1;

                            s.polygon.forEach((pt: any, idx: number) => {
                                const wx = instanceBox.min.x + (pt.x - rawMinX) * scaleX;
                                // Invert Y to Z mapping to match Three.js Y-up standard where +Y screen is -Z world
                                const wz = instanceBox.max.z - (pt.y - rawMinY) * scaleZ;

                                if (idx === 0) shape.moveTo(wx, wz);
                                else shape.lineTo(wx, wz);

                                linePoints.push(new THREE.Vector3(wx, targetY, wz));
                                worldXZ.push({ x: wx, z: wz });
                            });
                        } else {
                            // Fallback to legacy mapping if no 3D mesh is present
                            s.polygon.forEach((pt: any, idx: number) => {
                                const pWorld = localToWorld(pt.x, pt.y, 0);
                                const wx = pWorld.x + PLANE_OFFSET_X;
                                const wz = pWorld.z + PLANE_OFFSET_Z;

                                if (idx === 0) shape.moveTo(wx, wz);
                                else shape.lineTo(wx, wz);

                                linePoints.push(new THREE.Vector3(wx, targetY, wz));
                                worldXZ.push({ x: wx, z: wz });
                            });
                        }

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

                // Re-subscribe workspace store so reverts/edits trigger live re-render
                if (unsubEquipmentStore) {
                    try { unsubEquipmentStore(); } catch {}
                    unsubEquipmentStore = null;
                }
                unsubEquipmentStore = workspaceStore.subscribe(() => {
                    try {
                        if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
                    } catch (subErr) {
                        console.warn('[MEP-EQUIPMENT-RENDER] subscribe error:', subErr);
                    }
                });
                if (activeRenderEquipmentMeshes) {
                    try { activeRenderEquipmentMeshes(); } catch (e) { console.warn(e); }
                }
            } catch (err) {
                console.error("loadIfcFile error:", err);
                store().setLoadingText('Error: ' + err);
                store().setIsLoading(false);
            } finally {
                isModelLoadingInProgress = false;
            }
        };

        let selectedEquipmentId: string | null = null;
        const setSelectedEquipment = (id: string | null) => {
            selectedEquipmentId = id;
            try {
                useViewerStore.getState().setSelectedEquipmentId(id);
            } catch (_) {}
        };
        (window as any)._setSelectedEquipment = setSelectedEquipment;

        const detectStoreyFromY = (y: number): any => {
            if (!activeStoreys || activeStoreys.length === 0) return null;
            const sorted = [...activeStoreys].sort((a, b) => a.elevation - b.elevation);
            for (let i = sorted.length - 1; i >= 0; i--) {
                const s = sorted[i];
                const sY = activeGetWorldHeight
                    ? activeGetWorldHeight(s.elevation)
                    : getStoreyElevationInMeters(s.elevation);
                if (y >= sY - 0.6) {
                    return s;
                }
            }
            return sorted[0];
        };
        (window as any)._detectStoreyFromY = detectStoreyFromY;

        const getPhysicalFloorSurfaceY = (x: number, z: number, storey?: any): number => {
            // 1. Resolve target storey
            let targetStorey = storey;
            if (!targetStorey) {
                const activeLevelVal = useViewerStore.getState().selectedLevel || ui.selectLevel?.value;
                if (activeLevelVal) targetStorey = findStoreyByFloor(activeLevelVal);
            }
            // Auto-detect storey from physical top-down raycast at (x, z) if not explicitly set
            if (!targetStorey && currentModel?.object) {
                try {
                    const curBBox = new THREE.Box3().setFromObject(currentModel.object);
                    const topDownRay = new THREE.Raycaster(
                        new THREE.Vector3(x, curBBox.max.y + 2.0, z),
                        new THREE.Vector3(0, -1, 0),
                        0.01,
                        curBBox.max.y - curBBox.min.y + 4.0
                    );
                    const hits = safeRaycastModel(topDownRay, currentModel.object);
                    if (hits && hits.length > 0) {
                        targetStorey = detectStoreyFromY(hits[0].point.y);
                    }
                } catch (_) {}
            }
            if (!targetStorey && activeStoreys && activeStoreys.length > 0) {
                targetStorey = activeStoreys.find((st: any) => /ground/i.test(st.name) || /^gf/i.test(st.name))
                    || activeStoreys.find((st: any) => st.spaces && st.spaces.length > 0)
                    || [...activeStoreys].sort((a, b) => a.elevation - b.elevation)[0];
            }

            // Nominal floor elevation datum
            const nominalY = (targetStorey && activeGetWorldHeight)
                ? activeGetWorldHeight(targetStorey.elevation)
                : (targetStorey && typeof targetStorey.elevation === 'number'
                    ? getStoreyElevationInMeters(targetStorey.elevation)
                    : 0);

            console.warn('[MEP-DEBUG-FLOOR-Y]', {
                targetStoreyName: targetStorey?.name,
                targetStoreyElev: targetStorey?.elevation,
                nominalY,
                modelObjExists: Boolean(currentModel?.object),
                x,
                z
            });

            if (!currentModel?.object) return nominalY;

            try {
                // A storey is an exterior roof if its name explicitly indicates roof/terrace/deck/parapet
                const isExplicitRoof = Boolean(
                    (targetStorey && /roof|terrace|parapet|deck/i.test(targetStorey.name)) ||
                    (typeof storey === 'string' && /roof|terrace|parapet|deck/i.test(storey))
                );

                const sortedStoreys = [...(activeStoreys || [])].sort((a, b) => a.elevation - b.elevation);
                const sIdx = targetStorey ? sortedStoreys.findIndex((s: any) => String(s.expressId) === String(targetStorey.expressId) || s.name?.toLowerCase() === targetStorey.name?.toLowerCase()) : -1;
                const nextStorey = (sIdx !== -1 && sIdx < sortedStoreys.length - 1) ? sortedStoreys[sIdx + 1] : null;
                const nextStoreyY = nextStorey
                    ? (activeGetWorldHeight ? activeGetWorldHeight(nextStorey.elevation) : getStoreyElevationInMeters(nextStorey.elevation))
                    : (nominalY + 3.8);

                const curBBox = new THREE.Box3().setFromObject(currentModel.object);

                let rayStartY: number;
                let rayDist: number;
                let bottomLimit: number;
                let upperLimit: number;

                if (isExplicitRoof) {
                    // For roof/terrace, start above highest building geometry and raycast down
                    rayStartY = curBBox.max.y + 4.0;
                    bottomLimit = nominalY - 0.8;
                    upperLimit = curBBox.max.y + 2.0;
                    rayDist = Math.max(10.0, (rayStartY - bottomLimit) + 2.0);
                } else {
                    // For interior storeys (Ground, First, Second Floor, etc.):
                    // Raycast downward strictly from BELOW the ceiling/slab above:
                    rayStartY = Math.min(nextStoreyY - 0.2, nominalY + 2.8);
                    // Floor slab top is within ±0.4m of nominal storey elevation.
                    // Set bottomLimit to nominalY - 0.45m so the ray NEVER pierces the slab to hit the subfloor/foundation below!
                    bottomLimit = nominalY - 0.45;
                    upperLimit = rayStartY - 0.05;
                    rayDist = Math.max(2.0, (rayStartY - bottomLimit) + 0.5);
                }

                const downRay = new THREE.Raycaster(
                    new THREE.Vector3(x, rayStartY, z),
                    new THREE.Vector3(0, -1, 0),
                    0.01,
                    rayDist
                );

                const intersects = safeRaycastModel(downRay, currentModel.object);
                if (intersects && intersects.length > 0) {
                    // Extract upward-facing hits (world normal.y > 0.35)
                    const upwardHits: { y: number; normalY: number; dist: number }[] = [];
                    for (const hit of intersects) {
                        if (hit.point.y < bottomLimit) continue;
                        if (hit.point.y > upperLimit) continue;

                        let worldNormalY = 1.0;
                        if (hit.face) {
                            const norm = hit.face.normal.clone();
                            if ((hit.object as any).isInstancedMesh && typeof hit.instanceId === 'number') {
                                const instMesh = hit.object as THREE.InstancedMesh;
                                const instMat = new THREE.Matrix4();
                                instMesh.getMatrixAt(hit.instanceId, instMat);
                                const worldMat = new THREE.Matrix4().multiplyMatrices(instMesh.matrixWorld, instMat);
                                const normMat = new THREE.Matrix3().getNormalMatrix(worldMat);
                                norm.applyMatrix3(normMat).normalize();
                            } else {
                                const normMat = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                                norm.applyMatrix3(normMat).normalize();
                            }
                            worldNormalY = norm.y;
                        }

                        // Surface must be facing upwards (slab/floor/deck surface, not ceiling or vertical wall)
                        if (worldNormalY > 0.35) {
                            upwardHits.push({ y: hit.point.y, normalY: worldNormalY, dist: hit.distance });
                        }
                    }

                    if (upwardHits.length > 0) {
                        if (isExplicitRoof) {
                            // On roof level, the highest upward-facing surface from above is the top of the roof/terrace slab!
                            upwardHits.sort((a, b) => b.y - a.y);
                            return upwardHits[0].y;
                        } else {
                            // On interior floors: prioritize upward surfaces in the floor slab zone (nominalY ± 0.45m)
                            // Among surfaces in the slab zone, take the highest surface (top floor finish / tiles of the slab)
                            const slabHits = upwardHits.filter(h => Math.abs(h.y - nominalY) <= 0.45);
                            if (slabHits.length > 0) {
                                slabHits.sort((a, b) => b.y - a.y);
                                return slabHits[0].y;
                            }
                            // Fallback to upward hit closest to nominal storey level
                            upwardHits.sort((a, b) => Math.abs(a.y - nominalY) - Math.abs(b.y - nominalY));
                            return upwardHits[0].y;
                        }
                    } else if (isExplicitRoof && intersects.length > 0) {
                        // Fallback on roof: highest surface hit directly from above
                        return intersects[0].point.y;
                    }
                }
            } catch (err) {
                console.warn('[MEP-RAYCAST-SLAB] error detecting physical floor surface:', err);
            }

            // Fallback to space median min Y if available
            if (targetStorey && activeSpaceBoundsMap.size > 0) {
                const spacesOnStorey = Array.from(activeSpaceBoundsMap.values()).filter(sp => String(sp.storeyExpressId) === String(targetStorey.expressId));
                const medianY = getMedianSpaceMinY(spacesOnStorey);
                if (medianY !== null) return medianY;
            }

            return nominalY;
        };
        (window as any)._getPhysicalFloorSurfaceY = getPhysicalFloorSurfaceY;

        const getEquipmentBaseFloorY = (equip: any): number => {
            // 1. If equipment specifies a floor, prioritize finding that storey
            if (equip.locationFloor) {
                const targetStorey = findStoreyByFloor(equip.locationFloor);
                if (targetStorey) {
                    if (typeof equip.positionX === 'number' && typeof equip.positionZ === 'number' && currentModel?.object) {
                        return getPhysicalFloorSurfaceY(equip.positionX, equip.positionZ, targetStorey);
                    }
                    // Check if assigned space belongs to this storey
                    if (equip.locationSpaceId && equip.locationSpaceId !== 'outside' && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                        const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                        if (spaceData && String(spaceData.storeyExpressId) === String(targetStorey.expressId) && spaceData.box?.min?.y !== undefined) {
                            return spaceData.box.min.y;
                        }
                    }
                    if (activeGetWorldHeight) return activeGetWorldHeight(targetStorey.elevation);
                    if (typeof targetStorey.elevation === 'number') {
                        return getStoreyElevationInMeters(targetStorey.elevation);
                    }
                }
            }

            // 2. If equipment has an assigned space, check if space exists in bounds map
            if (equip.locationSpaceId && equip.locationSpaceId !== 'outside' && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                if (spaceData?.box?.min?.y !== undefined) {
                    return spaceData.box.min.y;
                }
            }

            // 3. Fallback to active level selector
            const activeLevelVal = useViewerStore.getState().selectedLevel || ui.selectLevel?.value;
            if (activeLevelVal) {
                const st = findStoreyByFloor(activeLevelVal);
                if (st) {
                    if (typeof equip.positionX === 'number' && typeof equip.positionZ === 'number' && currentModel?.object) {
                        return getPhysicalFloorSurfaceY(equip.positionX, equip.positionZ, st);
                    }
                    if (activeGetWorldHeight) return activeGetWorldHeight(st.elevation);
                    if (typeof st.elevation === 'number') return getStoreyElevationInMeters(st.elevation);
                }
            }

            // 4. Fallback to lowest elevation storey (Ground Floor), never roof
            if (activeStoreys && activeStoreys.length > 0) {
                const sorted = [...activeStoreys].sort((a, b) => a.elevation - b.elevation);
                if (typeof equip.positionX === 'number' && typeof equip.positionZ === 'number' && currentModel?.object) {
                    return getPhysicalFloorSurfaceY(equip.positionX, equip.positionZ, sorted[0]);
                }
                if (activeGetWorldHeight) return activeGetWorldHeight(sorted[0].elevation);
                if (typeof sorted[0].elevation === 'number') return getStoreyElevationInMeters(sorted[0].elevation);
            }
            return 0;
        };
        (window as any)._getEquipmentBaseFloorY = getEquipmentBaseFloorY;

        let activeGhostMesh: THREE.Group | null = null;

        const getEquipmentWorldY = (equip: any): number => {
            // Equipment is always attached directly to the floor surface!
            let targetStorey: any = null;
            if (equip.locationFloor) {
                targetStorey = findStoreyByFloor(equip.locationFloor);
            }
            const isRoof = Boolean(
                (equip.locationFloor && /roof|terrace|parapet|deck/i.test(equip.locationFloor)) ||
                (equip.locationSpaceName && /roof|terrace|parapet|deck/i.test(equip.locationSpaceName)) ||
                (targetStorey && /roof|terrace|parapet|deck/i.test(targetStorey.name))
            );
            if (isRoof && (!targetStorey || !/roof|terrace|parapet|deck/i.test(targetStorey.name))) {
                targetStorey = findStoreyByFloor('ROOF LEVEL') || {
                    name: 'ROOF LEVEL',
                    expressId: -9999,
                    elevation: 7600
                };
            }
            if (!targetStorey && equip.locationSpaceId && equip.locationSpaceId !== 'outside' && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                if (spaceData?.storeyExpressId) targetStorey = findStoreyByFloor(spaceData.storeyExpressId);
            }

            const floorY = (typeof equip.positionX === 'number' && typeof equip.positionZ === 'number' && currentModel?.object)
                ? getPhysicalFloorSurfaceY(equip.positionX, equip.positionZ, targetStorey)
                : getEquipmentBaseFloorY(equip);

            // If equip.positionY exists and is within 0.15m of floorY, keep equip.positionY; otherwise snap to floorY
            if (typeof equip.positionY === 'number' && !isNaN(equip.positionY) && Math.abs(equip.positionY - floorY) < 0.15) {
                return equip.positionY;
            }
            return floorY;
        };

        const createEquipmentTagSprite = (tag: string, isSelected: boolean, is2D: boolean = false) => {
            const canvas = document.createElement('canvas');
            canvas.width = 384;
            canvas.height = 96;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = isSelected ? '#b45309' : '#1e3a8a';
                ctx.strokeStyle = isSelected ? '#fbbf24' : '#60a5fa';
                ctx.lineWidth = 6;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(8, 8, 368, 80, 16);
                else ctx.rect(8, 8, 368, 80);
                ctx.fill();
                ctx.stroke();

                ctx.font = 'bold 38px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(tag || 'EQUIP', 192, 48);
            }
            const tex = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: !is2D, depthWrite: false });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(2.4, 0.6, 1);
            return sprite;
        };

        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            const fallbackEquipId = useViewerStore.getState().draggedEquipmentId || (window as any)._currentlyDraggedEquipmentId;
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
            useViewerStore.getState().setDraggedEquipmentId(null);

            try {
                let equipId: string | null = null;
                if (e.dataTransfer?.getData('text/plain')) {
                    try {
                        const raw = e.dataTransfer.getData('text/plain');
                        console.log('[MEP-DND] handleDrop fired. raw dataTransfer:', raw, '| 2D active:', ui.btn2d.classList.contains('active'));
                        const data = JSON.parse(raw);
                        if (data && data.type === 'equipment' && data.id) {
                            equipId = data.id;
                        }
                    } catch (_) {}
                }
                if (!equipId && fallbackEquipId) {
                    equipId = fallbackEquipId;
                }
                if (!equipId && (window as any)._currentlyDraggedEquipmentId) {
                    equipId = (window as any)._currentlyDraggedEquipmentId;
                }

                if (equipId) {
                    const stateForDrop = workspaceStore.getState();
                    const equipToPlace = stateForDrop.equipment.find((eq: any) => eq.id === equipId || String(eq.id) === String(equipId));
                    if (!equipToPlace || !hasLiteralDimensions(equipToPlace)) {
                        toast.error(`"${equipToPlace?.tag || 'Equipment'}" has no dimensions assigned. Please assign zones to equipment in Ventilation first.`);
                        (window as any)._isActivelyDraggingEquipment = false;
                        return;
                    }

                    // Determine the target storey: prioritize equipment designated floor (e.g. ROOF LEVEL) or top dropdown
                    const selectedLevelFromStore = useViewerStore.getState().selectedLevel;
                    const activeLevelId = selectedLevelFromStore || ui.selectLevel?.value;
                    const isEquipExplicitRoof = Boolean(
                        (equipToPlace.locationFloor && /roof|terrace|parapet|deck/i.test(equipToPlace.locationFloor)) ||
                        (equipToPlace.locationSpaceName && /roof|terrace|parapet|deck/i.test(equipToPlace.locationSpaceName))
                    );

                    let targetStorey: any = null;
                    if (isEquipExplicitRoof) {
                        targetStorey = findStoreyByFloor('ROOF LEVEL') || (equipToPlace.locationFloor ? findStoreyByFloor(equipToPlace.locationFloor) : null);
                    } else if (activeLevelId) {
                        targetStorey = findStoreyByFloor(activeLevelId);
                    } else if (equipToPlace.locationFloor) {
                        targetStorey = findStoreyByFloor(equipToPlace.locationFloor);
                    }
                    if (!targetStorey && activeStoreys && activeStoreys.length > 0) {
                        targetStorey = activeStoreys.find((st: any) => /ground/i.test(st.name) || /^gf/i.test(st.name))
                            || activeStoreys.find((st: any) => st.spaces && st.spaces.length > 0)
                            || [...activeStoreys].sort((a, b) => a.elevation - b.elevation)[0];
                    }
                    const targetFloorWorldY = (targetStorey && activeGetWorldHeight)
                        ? activeGetWorldHeight(targetStorey.elevation)
                        : (targetStorey && typeof targetStorey.elevation === 'number'
                            ? getStoreyElevationInMeters(targetStorey.elevation)
                            : 0);

                    const is2D = ui.btn2d.classList.contains('active');
                    let clickX = 0, clickZ = 0;
                    let hitSpace: any = null;

                    if (is2D) {
                        const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e, targetStorey?.expressId) : null;
                        if (hit) {
                            clickX = hit.point.x;
                            clickZ = hit.point.z;
                            if (hit.space) {
                                hitSpace = { space: hit.space, expressId: hit.expressId, storeyExpressId: hit.storeyExpressId };
                            }
                        } else {
                            const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, targetFloorWorldY);
                            clickX = planeHit.x;
                            clickZ = planeHit.z;
                        }
                    } else {
                        // 3D Drop Mode: Raycast directly from camera through cursor onto 3D model!
                        const rect = ui.viewport.getBoundingClientRect();
                        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                        const raycaster = new THREE.Raycaster();
                        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

                        let direct3DHit: THREE.Intersection | null = null;
                        if (currentModel?.object) {
                            try {
                                const intersects = safeRaycastModel(raycaster, currentModel.object);
                                if (intersects && intersects.length > 0) {
                                    const effectiveStorey = targetStorey || (activeLevelId ? findStoreyByFloor(activeLevelId) : null);
                                    const isRoof = isEquipExplicitRoof || Boolean(effectiveStorey && /roof|terrace|parapet|deck/i.test(effectiveStorey.name));
                                    if (effectiveStorey) {
                                        const expY = (activeGetWorldHeight) ? activeGetWorldHeight(effectiveStorey.elevation) : targetFloorWorldY;
                                        const filtered = intersects.filter(i => isRoof ? (i.point.y >= expY - 2.5) : Math.abs(i.point.y - expY) < 2.5);
                                        direct3DHit = filtered.length > 0 ? filtered[0] : intersects[0];
                                    } else {
                                        // "All Levels" in 3D: Use exact physical 3D surface clicked!
                                        direct3DHit = intersects[0];
                                    }
                                }
                            } catch (_) {}
                        }

                        if (direct3DHit) {
                            clickX = direct3DHit.point.x;
                            clickZ = direct3DHit.point.z;
                            // Automatically detect storey from 3D surface height ONLY if targetStorey was NOT determined!
                            if (!targetStorey) {
                                targetStorey = detectStoreyFromY(direct3DHit.point.y);
                            }
                        } else {
                            const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetFloorWorldY);
                            const planePoint = new THREE.Vector3();
                            raycaster.ray.intersectPlane(floorPlane, planePoint);
                            clickX = planePoint.x;
                            clickZ = planePoint.z;
                        }

                        // Constrain 3D space bounding-box search to targetStorey ONLY
                        if (activeSpaceBoundsMap.size > 0 && targetStorey) {
                            for (const [expressId, spData] of activeSpaceBoundsMap) {
                                if (String(spData.storeyExpressId) !== String(targetStorey.expressId)) continue;
                                const b = spData.box;
                                if (clickX >= b.min.x && clickX <= b.max.x && clickZ >= b.min.z && clickZ <= b.max.z) {
                                    hitSpace = { space: spData.space, expressId, storeyExpressId: spData.storeyExpressId };
                                    break;
                                }
                            }
                        }
                    }

                    const isRoofStorey = isEquipExplicitRoof || Boolean(targetStorey && /roof|terrace|parapet|deck/i.test(targetStorey.name));

                    // Dynamically resolve exact physical slab top surface at (clickX, clickZ) for targetStorey
                    let targetWorldY = getPhysicalFloorSurfaceY(clickX, clickZ, targetStorey);
                    if (targetWorldY === undefined || isNaN(targetWorldY)) {
                        if (direct3DHit && typeof direct3DHit.point?.y === 'number') {
                            if (isRoofStorey || Math.abs(direct3DHit.point.y - targetFloorWorldY) < 3.0) {
                                targetWorldY = direct3DHit.point.y;
                            } else {
                                targetWorldY = targetFloorWorldY;
                            }
                        } else {
                            targetWorldY = targetFloorWorldY;
                        }
                    }

                    const spaceId = hitSpace ? String(hitSpace.expressId) : 'outside';
                    const spaceName = hitSpace ? (hitSpace.space?.longName || hitSpace.space?.name || `Space ${hitSpace.expressId}`) : (isRoofStorey ? 'Roof Deck / Open Area' : 'Floor / Open Area');
                    const floorName = (hitSpace?.storeyExpressId ? findStoreyByFloor(hitSpace.storeyExpressId)?.name : null) || targetStorey?.name || (isRoofStorey ? 'ROOF LEVEL' : 'Ground Floor');

                    const state = workspaceStore.getState();
                    const equipIdx = state.equipment.findIndex((eq: any) => eq.id === equipId || String(eq.id) === String(equipId));
                    if (equipIdx !== -1) {
                        const newEquipment = [...state.equipment];
                        newEquipment[equipIdx] = {
                            ...newEquipment[equipIdx],
                            locationSpaceId: spaceId,
                            locationSpaceName: spaceName,
                            locationFloor: floorName,
                            positionX: clickX,
                            positionY: targetWorldY,
                            positionZ: clickZ,
                            rotationY: 0
                        };
                        workspaceStore.updateEquipment(newEquipment);
                        setSelectedEquipment(newEquipment[equipIdx].id);
                        renderEquipmentMeshes();
                        toast.success(`Placed "${newEquipment[equipIdx].tag}" on ${floorName}`);
                    }
                    (window as any)._isActivelyDraggingEquipment = false;
                    if (world.camera?.controls) {
                        world.camera.controls.enabled = true;
                        if (ui.btn2d.classList.contains('active')) world.camera.controls.mouseButtons.wheel = 32;
                        else world.camera.controls.mouseButtons.wheel = 16;
                    }
                    return;
                }
            } catch (err) { console.error('[MEP-DND] handleDrop error:', err); }

            const file = e.dataTransfer?.files[0];
            if (file && (window as any).loadIfcFile) {
                (window as any).loadIfcFile(file);
            }
        };

        const handleFocusEquipment = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const equip = customEvent.detail;
            if (!equip) return;

            if (ui.btn2d.classList.contains('active')) {
                let targetStoreyId: string | null = null;
                if (equip.locationSpaceId && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                    targetStoreyId = String(activeSpaceBoundsMap.get(Number(equip.locationSpaceId))?.storeyExpressId || '');
                } else if (equip.locationFloor && activeStoreys) {
                    const st = findStoreyByFloor(equip.locationFloor);
                    if (st) targetStoreyId = String(st.expressId);
                }

                if (targetStoreyId && String(ui.selectLevel.value) !== targetStoreyId) {
                    ui.selectLevel.value = targetStoreyId;
                    if (ui.selectLevel.onchange) {
                        const p2 = ui.selectLevel.onchange(new Event('change') as any);
                        if (p2 && (p2 as any).then) await p2;
                    }
                }
            }

            setSelectedEquipment(equip.id);
            renderEquipmentMeshes();

            await new Promise(r => setTimeout(r, 60));

            if (!world?.camera?.controls) return;
            const eqMesh = placedEquipment3DMeshes.find(m => m.userData?.equipmentId === equip.id);
            if (eqMesh) {
                const pos = eqMesh.position;
                world.camera.controls.moveTo(pos.x, pos.y, pos.z, true);
                if (ui.btn2d.classList.contains('active')) {
                    world.camera.controls.zoomTo(10, true);
                } else {
                    world.camera.controls.dollyTo(15, true);
                }
            }
        };

        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);
        window.addEventListener('mep-focus-equipment', handleFocusEquipment);

        const renderEquipmentMeshes = () => {
            try {
                const is2D = ui.btn2d.classList.contains('active');
                const state = workspaceStore.getState();
                disposeMeshList(placedEquipment3DMeshes);
                placedEquipment3DMeshes = [];

                const activeLevelVal = useViewerStore.getState().selectedLevel || ui.selectLevel?.value;
                const currentSelectedStorey = activeLevelVal ? findStoreyByFloor(activeLevelVal) : null;

                state.equipment.forEach((equip) => {
                    const isPlaced = Boolean(equip.locationSpaceId || (equip.positionX !== undefined && equip.positionZ !== undefined));
                    if (!isPlaced) return;
                    if (!hasLiteralDimensions(equip)) return;

                    const dims = getEquipmentLiteralDimensions(equip);
                    if (!dims) return;

                    // Resolve target storey
                    let equipStorey: any = null;
                    if (equip.locationFloor) {
                        equipStorey = findStoreyByFloor(equip.locationFloor);
                    }
                    if (!equipStorey && equip.locationSpaceId && equip.locationSpaceId !== 'outside' && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                        const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                        if (spaceData?.storeyExpressId) equipStorey = findStoreyByFloor(spaceData.storeyExpressId);
                    }

                    // Auto-initialize positionX and positionZ if not yet set
                    if (equip.positionX === undefined || equip.positionZ === undefined) {
                        if (equip.locationSpaceId && equip.locationSpaceId !== 'outside' && activeSpaceBoundsMap.has(Number(equip.locationSpaceId))) {
                            const spaceData = activeSpaceBoundsMap.get(Number(equip.locationSpaceId));
                            if (spaceData?.center) {
                                equip.positionX = spaceData.center.x;
                                equip.positionZ = spaceData.center.z;
                            }
                        } else if (equipStorey) {
                            const spacesOnStorey = Array.from(activeSpaceBoundsMap.values()).filter(sp => String(sp.storeyExpressId) === String(equipStorey.expressId));
                            if (spacesOnStorey.length > 0 && spacesOnStorey[0].center) {
                                equip.positionX = spacesOnStorey[0].center.x;
                                equip.positionZ = spacesOnStorey[0].center.z;
                            }
                        }
                        if (equip.positionX === undefined) equip.positionX = 0;
                        if (equip.positionZ === undefined) equip.positionZ = 0;
                    }

                    const worldY = getEquipmentWorldY(equip);
                    console.warn('[MEP-DEBUG-RENDER-EQUIP]', {
                        equipTag: equip.tag,
                        locationFloor: equip.locationFloor,
                        positionX: equip.positionX,
                        positionY_before: equip.positionY,
                        positionZ: equip.positionZ,
                        worldY
                    });
                    equip.positionY = worldY;

                    // Strict floor filtering when a specific floor is selected in the top dropdown
                    let isVisibleOnCurrentLevel = true;
                    if (activeLevelVal && currentSelectedStorey) {
                        const equipStorey = equip.locationFloor ? findStoreyByFloor(equip.locationFloor) : null;
                        if (equipStorey) {
                            isVisibleOnCurrentLevel = String(equipStorey.expressId) === String(currentSelectedStorey.expressId)
                                || equipStorey.name?.toLowerCase() === currentSelectedStorey.name?.toLowerCase()
                                || matchFloorNames(equipStorey.name, currentSelectedStorey.name);
                        } else {
                            const matchesSpaceStorey = Boolean(equip.locationSpaceId && String(activeSpaceBoundsMap.get(Number(equip.locationSpaceId))?.storeyExpressId) === String(currentSelectedStorey.expressId));
                            const matchesFloorName = Boolean(equip.locationFloor && matchFloorNames(equip.locationFloor, currentSelectedStorey.name));
                            isVisibleOnCurrentLevel = matchesSpaceStorey || matchesFloorName;
                        }
                    }

                    const group = new THREE.Group();
                    group.position.set(equip.positionX || 0, worldY + 0.002, equip.positionZ || 0);
                    if (equip.rotationY) group.rotation.y = equip.rotationY;
                    group.userData = { equipmentId: equip.id, isEquipmentGroup: true };
                    group.visible = isVisibleOnCurrentLevel;

                    const L = dims.length / 1000;
                    const W = dims.width / 1000;
                    const H = dims.height / 1000;
                    const isSelected = equip.id === selectedEquipmentId;

                    // 1. Equipment main solid box mesh
                    const geometry = new THREE.BoxGeometry(L, H, W);
                    const boxMat = new THREE.MeshBasicMaterial({
                        color: isSelected ? 0xf59e0b : 0x2563eb,
                        transparent: true,
                        opacity: is2D ? 0.92 : 0.85,
                        depthTest: !is2D,
                        depthWrite: !is2D
                    });
                    const mesh = new THREE.Mesh(geometry, boxMat);
                    mesh.position.y = H / 2;
                    if (is2D) mesh.renderOrder = 10010;
                    group.add(mesh);

                    // 2. High-contrast sharp wireframe edges
                    const edgesGeom = new THREE.EdgesGeometry(geometry);
                    const edgesMat = new THREE.LineBasicMaterial({
                        color: isSelected ? 0xd97706 : (is2D ? 0x0f172a : 0x1e3a8a),
                        linewidth: 2,
                        depthTest: !is2D,
                        depthWrite: !is2D
                    });
                    const edgesLine = new THREE.LineSegments(edgesGeom, edgesMat);
                    edgesLine.position.y = H / 2;
                    if (is2D) edgesLine.renderOrder = 10012;
                    group.add(edgesLine);

                    // 3. Direction / Orientation indicator arrow on top face (points forward along +Z)
                    const arrowShape = new THREE.Shape();
                    const arrowSize = Math.min(L, W) * 0.38;
                    arrowShape.moveTo(0, arrowSize);
                    arrowShape.lineTo(-arrowSize * 0.55, -arrowSize * 0.4);
                    arrowShape.lineTo(0, -arrowSize * 0.15);
                    arrowShape.lineTo(arrowSize * 0.55, -arrowSize * 0.4);
                    arrowShape.closePath();

                    const arrowGeom = new THREE.ShapeGeometry(arrowShape);
                    arrowGeom.rotateX(-Math.PI / 2);
                    const arrowMat = new THREE.MeshBasicMaterial({
                        color: isSelected ? 0xffffff : 0xbfdbfe,
                        depthTest: !is2D,
                        depthWrite: !is2D
                    });
                    const arrowMesh = new THREE.Mesh(arrowGeom, arrowMat);
                    arrowMesh.position.y = H + 0.02;
                    if (is2D) arrowMesh.renderOrder = 10014;
                    group.add(arrowMesh);

                    // 4. Interactive Rotation Handle (Knob) when selected
                    if (isSelected) {
                        const handleDist = W / 2 + 0.75;
                        const stemGeom = new THREE.BufferGeometry().setFromPoints([
                            new THREE.Vector3(0, H + 0.05, 0),
                            new THREE.Vector3(0, H + 0.05, handleDist)
                        ]);
                        const stemMat = new THREE.LineBasicMaterial({
                            color: 0x10b981,
                            linewidth: 2,
                            depthTest: false,
                            depthWrite: false
                        });
                        const stemLine = new THREE.Line(stemGeom, stemMat);
                        if (is2D) stemLine.renderOrder = 10016;
                        group.add(stemLine);

                        const knobGeom = new THREE.SphereGeometry(0.24, 16, 16);
                        const knobMat = new THREE.MeshBasicMaterial({
                            color: 0x10b981,
                            depthTest: false,
                            depthWrite: false
                        });
                        const knobMesh = new THREE.Mesh(knobGeom, knobMat);
                        knobMesh.position.set(0, H + 0.05, handleDist);
                        knobMesh.userData = { isRotationHandle: true, equipmentId: equip.id };
                        if (is2D) knobMesh.renderOrder = 10018;
                        group.add(knobMesh);
                    }

                    // 5. Crisp floating badge label sprite
                    const sprite = createEquipmentTagSprite(equip.tag || 'EQUIP', isSelected, is2D);
                    sprite.position.y = H + 0.7;
                    if (is2D) sprite.renderOrder = 10020;
                    group.add(sprite);

                    world.scene.three.add(group);
                    placedEquipment3DMeshes.push(group);
                });

                // Keep activeRenderEquipmentMeshes reference updated
                activeRenderEquipmentMeshes = renderEquipmentMeshes;

            } catch (err) {
                console.warn('[MEP-EQUIPMENT-RENDER] error caught safely:', err);
            }
        };

        activeRenderEquipmentMeshes = renderEquipmentMeshes;
        (window as any)._renderEquipmentMeshes = () => {
            try {
                if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
            } catch (err) {
                console.warn('[MEP-EQUIPMENT-RENDER] manual trigger error:', err);
            }
        };

        const handleEquipmentUpdated = () => {
            try {
                if (activeRenderEquipmentMeshes) activeRenderEquipmentMeshes();
            } catch (err) {
                console.warn('[MEP-EQUIPMENT-RENDER] event trigger error:', err);
            }
        };
        window.addEventListener('mep-equipment-updated', handleEquipmentUpdated);

        if (unsubEquipmentStore) unsubEquipmentStore();
        unsubEquipmentStore = workspaceStore.subscribe(() => {
            try {
                renderEquipmentMeshes();
            } catch (subErr) {
                console.warn('[MEP-EQUIPMENT-RENDER] subscribe error:', subErr);
            }
        });
        try {
            renderEquipmentMeshes();
        } catch (initErr) {
            console.warn('[MEP-EQUIPMENT-RENDER] initial render error:', initErr);
        }



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
        (window as any)._clearEquipmentGhostMesh = () => {
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
        };

        ui.viewport.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            const draggedId = useViewerStore.getState().draggedEquipmentId || (window as any)._currentlyDraggedEquipmentId;
            if (!draggedId) {
                if (activeGhostMesh) {
                    world.scene.three.remove(activeGhostMesh);
                    activeGhostMesh = null;
                }
                return;
            }

            const equip = workspaceStore.getState().equipment.find(eq => eq.id === draggedId);
            if (!equip || !hasLiteralDimensions(equip)) return;

            const dims = getEquipmentLiteralDimensions(equip);
            if (!dims) return;

            const L = dims.length / 1000;
            const W = dims.width / 1000;
            const H = dims.height / 1000;

            if (activeGhostMesh && activeGhostMesh.userData?.equipmentId !== draggedId) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }

            if (!activeGhostMesh) {
                activeGhostMesh = new THREE.Group();
                activeGhostMesh.userData = { equipmentId: draggedId };
                const geom = new THREE.BoxGeometry(L, H, W);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0x10b981,
                    transparent: true,
                    opacity: 0.6,
                    depthTest: false,
                    depthWrite: false
                });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.y = H / 2;
                mesh.renderOrder = 10050;
                activeGhostMesh.add(mesh);

                const edgesGeom = new THREE.EdgesGeometry(geom);
                const edgesMat = new THREE.LineBasicMaterial({
                    color: 0x047857,
                    linewidth: 2,
                    depthTest: false,
                    depthWrite: false
                });
                const edgesLine = new THREE.LineSegments(edgesGeom, edgesMat);
                edgesLine.position.y = H / 2;
                edgesLine.renderOrder = 10052;
                activeGhostMesh.add(edgesLine);

                world.scene.three.add(activeGhostMesh);
            }

            const is2D = ui.btn2d.classList.contains('active');
            let ghostX = 0, ghostY = 0, ghostZ = 0;

            const selectedLevelFromStore = useViewerStore.getState().selectedLevel;
            const activeLevelId = selectedLevelFromStore || ui.selectLevel?.value;
            const currentLevel = (activeLevelId ? findStoreyByFloor(activeLevelId) : null) || (activeStoreys && activeStoreys[0]);
            const floorElevation = currentLevel ? (currentLevel.elevation ?? 0) : 0;
            const floorWorldY = (currentLevel && activeGetWorldHeight)
                ? activeGetWorldHeight(floorElevation)
                : (floorElevation > 100 ? floorElevation * 0.001 : floorElevation);
            let targetStoreyForGhost = currentLevel;

            if (is2D) {
                const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e, currentLevel?.expressId) : null;
                if (hit) {
                    ghostX = hit.point.x;
                    ghostY = hit.point.y;
                    ghostZ = hit.point.z;
                } else {
                    const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, floorWorldY);
                    ghostX = planeHit.x;
                    ghostY = floorWorldY;
                    ghostZ = planeHit.z;
                }
            } else {
                // 3D View Drag Over: Raycast onto physical model surfaces
                const rect = ui.viewport.getBoundingClientRect();
                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

                let direct3DHit: THREE.Intersection | null = null;
                if (currentModel?.object) {
                    try {
                        const intersects = safeRaycastModel(raycaster, currentModel.object);
                        if (intersects && intersects.length > 0) {
                            if (activeLevelId) {
                                const expectedStorey = findStoreyByFloor(activeLevelId);
                                const expY = (expectedStorey && activeGetWorldHeight) ? activeGetWorldHeight(expectedStorey.elevation) : floorWorldY;
                                const isRoof = expectedStorey && /roof|terrace/i.test(expectedStorey.name);
                                const filtered = intersects.filter(i => isRoof ? (i.point.y >= expY - 1.5) : Math.abs(i.point.y - expY) < 2.0);
                                direct3DHit = filtered.length > 0 ? filtered[0] : intersects[0];
                            } else {
                                direct3DHit = intersects[0];
                            }
                        }
                    } catch (_) {}
                }

                if (direct3DHit) {
                    ghostX = direct3DHit.point.x;
                    ghostZ = direct3DHit.point.z;
                    if (!activeLevelId) {
                        targetStoreyForGhost = detectStoreyFromY(direct3DHit.point.y);
                    }
                } else {
                    const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, floorWorldY);
                    ghostX = planeHit.x;
                    ghostZ = planeHit.z;
                }
            }

            ghostY = getPhysicalFloorSurfaceY(ghostX, ghostZ, targetStoreyForGhost);
            if ((ghostY === undefined || isNaN(ghostY)) && !is2D && targetStoreyForGhost) {
                const elev = (targetStoreyForGhost && activeGetWorldHeight)
                    ? activeGetWorldHeight(targetStoreyForGhost.elevation)
                    : getStoreyElevationInMeters(targetStoreyForGhost.elevation);
                if (typeof elev === 'number' && !isNaN(elev)) ghostY = elev;
            }
            activeGhostMesh.position.set(ghostX, ghostY + 0.002, ghostZ);
        });

        ui.viewport.addEventListener('dragleave', () => {
            if (activeGhostMesh) {
                world.scene.three.remove(activeGhostMesh);
                activeGhostMesh = null;
            }
        });

        ui.viewport.addEventListener('drop', (e: DragEvent) => {
            handleDrop(e);
        });

        // --- UNIFIED EQUIPMENT SELECTION, DRAGGING & ROTATION ---
        let activePlacedDragGroup: THREE.Group | null = null;
        let activeRotatingGroup: THREE.Group | null = null;
        let pointerIsDraggingPlaced = false;
        let pointerIsRotating = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let lastPointerDownTime = 0;
        let lastPointerDownObjId: string | null = null;

        const getFloorPlaneIntersection = (clientX: number, clientY: number, planeY: number): THREE.Vector3 => {
            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
            const hitPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, hitPoint)) {
                return hitPoint;
            }
            return new THREE.Vector3(ndcX, ndcY, 0).unproject(world.camera.three);
        };

        const handleUnifiedPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;

            const rect = ui.viewport.getBoundingClientRect();
            const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

            // 1. Check if rotation handle knob was clicked
            const handleMeshes: THREE.Object3D[] = [];
            placedEquipment3DMeshes.forEach(g => {
                if (g.visible) {
                    g.traverse(c => {
                        if (c.userData?.isRotationHandle) handleMeshes.push(c);
                    });
                }
            });
            const handleHits = raycaster.intersectObjects(handleMeshes, true);
            if (handleHits.length > 0) {
                const equipId = handleHits[0].object.userData?.equipmentId;
                const targetGroup = placedEquipment3DMeshes.find(g => g.userData?.equipmentId === equipId);
                if (targetGroup) {
                    pointerIsRotating = true;
                    activeRotatingGroup = targetGroup;
                    activePlacedDragGroup = targetGroup;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    try { ui.viewport.setPointerCapture(e.pointerId); } catch (_) {}
                    (window as any)._isActivelyDraggingEquipment = true;
                    if (world.camera?.controls) world.camera.controls.enabled = false;
                    e.stopImmediatePropagation();
                    return;
                }
            }

            // 2. Check if equipment box was clicked
            const equipMeshes: THREE.Object3D[] = [];
            placedEquipment3DMeshes.forEach(g => {
                if (g.visible) {
                    g.traverse(c => {
                        if (c instanceof THREE.Mesh && !c.userData?.isRotationHandle && !(c instanceof THREE.Sprite)) {
                            equipMeshes.push(c);
                        }
                    });
                }
            });
            const equipHits = raycaster.intersectObjects(equipMeshes, true);
            if (equipHits.length > 0) {
                let targetGroup: THREE.Group | null = null;
                let curr: THREE.Object3D | null = equipHits[0].object;
                while (curr) {
                    if (curr.userData?.isEquipmentGroup) {
                        targetGroup = curr as THREE.Group;
                        break;
                    }
                    curr = curr.parent;
                }

                if (targetGroup) {
                    const now = Date.now();
                    const clickedEquipId = targetGroup.userData?.equipmentId;

                    // Double Click to rotate 90° clockwise!
                    if (clickedEquipId === lastPointerDownObjId && (now - lastPointerDownTime) < 320) {
                        targetGroup.rotation.y = (targetGroup.rotation.y || 0) + Math.PI / 2;
                        const state = workspaceStore.getState();
                        const equipIdx = state.equipment.findIndex(eq => eq.id === clickedEquipId);
                        if (equipIdx !== -1) {
                            const newEquipment = [...state.equipment];
                            newEquipment[equipIdx] = {
                                ...newEquipment[equipIdx],
                                rotationY: targetGroup.rotation.y
                            };
                            workspaceStore.updateEquipment(newEquipment);
                        }
                        lastPointerDownTime = 0;
                        lastPointerDownObjId = null;
                        e.stopImmediatePropagation();
                        return;
                    }

                    lastPointerDownTime = now;
                    lastPointerDownObjId = clickedEquipId;

                    setSelectedEquipment(clickedEquipId);
                    pointerIsDraggingPlaced = false;
                    pointerIsRotating = false;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;

                    renderEquipmentMeshes();

                    const liveGroup = placedEquipment3DMeshes.find(g => g.userData?.equipmentId === clickedEquipId) || targetGroup;
                    activePlacedDragGroup = liveGroup;

                    // If Ctrl is held down during click, prepare rotation
                    if (e.ctrlKey || e.metaKey) {
                        pointerIsRotating = true;
                        activeRotatingGroup = liveGroup;
                    }

                    // DO NOT disable camera controls on initial click! Camera controls remain enabled for immediate zooming/panning
                    if (world.camera?.controls) {
                        world.camera.controls.enabled = true;
                        if (ui.btn2d.classList.contains('active')) world.camera.controls.mouseButtons.wheel = 32;
                        else world.camera.controls.mouseButtons.wheel = 16;
                    }

                    e.stopImmediatePropagation();
                    return;
                }
            }

            // 2b. If equipment is already selected and user holds Ctrl and clicks anywhere around it, rotate towards click
            if (selectedEquipmentId && (e.ctrlKey || e.metaKey)) {
                const targetGroup = placedEquipment3DMeshes.find(g => g.userData?.equipmentId === selectedEquipmentId);
                if (targetGroup) {
                    pointerIsRotating = true;
                    activeRotatingGroup = targetGroup;
                    activePlacedDragGroup = targetGroup;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    try { ui.viewport.setPointerCapture(e.pointerId); } catch (_) {}
                    (window as any)._isActivelyDraggingEquipment = true;
                    if (world.camera?.controls) world.camera.controls.enabled = false;

                    const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, targetGroup.position.y);
                    const dx = planeHit.x - targetGroup.position.x;
                    const dz = planeHit.z - targetGroup.position.z;
                    if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
                        targetGroup.rotation.y = Math.atan2(dx, dz);
                    }
                    e.stopImmediatePropagation();
                    return;
                }
            }

            // 3. Clicked outside -> deselect equipment
            if (selectedEquipmentId !== null) {
                setSelectedEquipment(null);
                renderEquipmentMeshes();
            }
            activePlacedDragGroup = null;
            activeRotatingGroup = null;
            pointerIsDraggingPlaced = false;
            pointerIsRotating = false;
            (window as any)._isActivelyDraggingEquipment = false;
            if (world.camera?.controls) {
                world.camera.controls.enabled = true;
                if (ui.btn2d.classList.contains('active')) world.camera.controls.mouseButtons.wheel = 32;
                else world.camera.controls.mouseButtons.wheel = 16;
            }
        };

        const handleUnifiedPointerMove = (e: PointerEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            // Rotating via knob handle OR Ctrl+drag
            if (activePlacedDragGroup || activeRotatingGroup) {
                const targetObj = activeRotatingGroup || activePlacedDragGroup;
                if (targetObj) {
                    const dist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);

                    // If user is holding Ctrl or was rotating via knob
                    if (pointerIsRotating || isCtrl) {
                        if (dist > 3 || pointerIsRotating) {
                            pointerIsRotating = true;
                            activeRotatingGroup = targetObj;
                            try { ui.viewport.setPointerCapture(e.pointerId); } catch (_) {}
                            (window as any)._isActivelyDraggingEquipment = true;
                            if (world.camera?.controls) world.camera.controls.enabled = false;

                            const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, targetObj.position.y);
                            const dx = planeHit.x - targetObj.position.x;
                            const dz = planeHit.z - targetObj.position.z;
                            if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
                                const angle = Math.atan2(dx, dz);
                                targetObj.rotation.y = angle;
                            }
                            e.stopImmediatePropagation();
                            return;
                        }
                    }

                    // Direct Dragging equipment across floor (in BOTH 2D and 3D views)
                    if (!isCtrl && !pointerIsRotating && activePlacedDragGroup) {
                        if (!pointerIsDraggingPlaced && dist > 4) {
                            pointerIsDraggingPlaced = true;
                            try { ui.viewport.setPointerCapture(e.pointerId); } catch (_) {}
                            (window as any)._isActivelyDraggingEquipment = true;
                            if (world.camera?.controls) world.camera.controls.enabled = false;
                            // Show only the green box while dragging
                            activePlacedDragGroup.traverse((child: any) => {
                                if (child instanceof THREE.Sprite || child.userData?.isRotationHandle || child instanceof THREE.Line) {
                                    child.visible = false;
                                } else if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry && child.material) {
                                    child.material.color?.setHex(0x10b981);
                                    child.material.opacity = 0.65;
                                } else if (child instanceof THREE.LineSegments && child.material) {
                                    child.material.color?.setHex(0x047857);
                                }
                            });
                        }

                        if (pointerIsDraggingPlaced) {
                            if (world.camera?.controls) world.camera.controls.enabled = false;
                            const is2D = ui.btn2d.classList.contains('active');
                            const selectedLevelFromStore = useViewerStore.getState().selectedLevel;
                            const activeLevelId = selectedLevelFromStore || ui.selectLevel?.value;
                            const activeEquipId = activePlacedDragGroup.userData?.equipmentId;
                            const equipData = workspaceStore.getState().equipment.find((eq: any) => eq.id === activeEquipId);
                            const isRoofStorey = Boolean(
                                (equipData?.locationFloor && /roof|terrace|parapet|deck/i.test(equipData.locationFloor)) ||
                                (equipData?.locationSpaceName && /roof|terrace|parapet|deck/i.test(equipData.locationSpaceName)) ||
                                (activeLevelId && /roof|terrace|parapet|deck/i.test(activeLevelId))
                            );

                            let equipFloorStorey = (isRoofStorey ? findStoreyByFloor('ROOF LEVEL') : null)
                                || (equipData?.locationFloor ? findStoreyByFloor(equipData.locationFloor) : null)
                                || (activeLevelId ? findStoreyByFloor(activeLevelId) : null)
                                || (activeStoreys && activeStoreys[0]);

                            if (is2D) {
                                const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e, equipFloorStorey?.expressId) : null;
                                if (hit) {
                                    activePlacedDragGroup.position.x = hit.point.x;
                                    activePlacedDragGroup.position.z = hit.point.z;
                                } else {
                                    const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, activePlacedDragGroup.position.y);
                                    activePlacedDragGroup.position.x = planeHit.x;
                                    activePlacedDragGroup.position.z = planeHit.z;
                                }
                            } else {
                                // 3D Direct Model & Planar Floor Dragging
                                const rect = ui.viewport.getBoundingClientRect();
                                const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                                const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                                const raycaster = new THREE.Raycaster();
                                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), world.camera.three);

                                let direct3DHit: THREE.Intersection | null = null;
                                if (currentModel?.object) {
                                    try {
                                        const intersects = safeRaycastModel(raycaster, currentModel.object);
                                        if (intersects && intersects.length > 0) {
                                            const effectiveStorey = equipFloorStorey || (activeLevelId ? findStoreyByFloor(activeLevelId) : null);
                                            const isRoof = isRoofStorey || Boolean(effectiveStorey && /roof|terrace|parapet|deck/i.test(effectiveStorey.name));
                                            if (effectiveStorey) {
                                                const expY = (activeGetWorldHeight) ? activeGetWorldHeight(effectiveStorey.elevation) : activePlacedDragGroup.position.y;
                                                const filtered = intersects.filter(i => isRoof ? (i.point.y >= expY - 2.5) : Math.abs(i.point.y - expY) < 2.5);
                                                direct3DHit = filtered.length > 0 ? filtered[0] : intersects[0];
                                            } else {
                                                direct3DHit = intersects[0];
                                            }
                                        }
                                    } catch (_) {}
                                }

                                if (direct3DHit) {
                                    activePlacedDragGroup.position.x = direct3DHit.point.x;
                                    activePlacedDragGroup.position.z = direct3DHit.point.z;
                                    if (!activeLevelId && !equipData?.locationFloor) {
                                        equipFloorStorey = detectStoreyFromY(direct3DHit.point.y);
                                    }
                                } else {
                                    const planeHit = getFloorPlaneIntersection(e.clientX, e.clientY, activePlacedDragGroup.position.y);
                                    activePlacedDragGroup.position.x = planeHit.x;
                                    activePlacedDragGroup.position.z = planeHit.z;
                                }
                            }
                            const liveFloorY = getPhysicalFloorSurfaceY(activePlacedDragGroup.position.x, activePlacedDragGroup.position.z, equipFloorStorey);
                            activePlacedDragGroup.position.y = liveFloorY + 0.002;
                            e.stopImmediatePropagation();
                            return;
                        }
                    }
                }
            }
        };

        const handleUnifiedPointerEnd = (e: PointerEvent | MouseEvent) => {
            (window as any)._isActivelyDraggingEquipment = false;

            if (pointerIsRotating && (activeRotatingGroup || activePlacedDragGroup)) {
                try {
                    if ('pointerId' in e && ui.viewport.hasPointerCapture(e.pointerId)) {
                        ui.viewport.releasePointerCapture(e.pointerId);
                    }
                } catch (_) {}

                const targetObj = activeRotatingGroup || activePlacedDragGroup;
                const equipId = targetObj?.userData?.equipmentId;
                const currentRotationY = targetObj?.rotation.y;
                if (equipId && currentRotationY !== undefined) {
                    const state = workspaceStore.getState();
                    const equipIdx = state.equipment.findIndex(eq => eq.id === equipId);
                    if (equipIdx !== -1) {
                        const newEquipment = [...state.equipment];
                        newEquipment[equipIdx] = {
                            ...newEquipment[equipIdx],
                            rotationY: currentRotationY
                        };
                        workspaceStore.updateEquipment(newEquipment);
                    }
                }

                pointerIsRotating = false;
                activeRotatingGroup = null;
            }

            if (activePlacedDragGroup) {
                try {
                    if ('pointerId' in e && ui.viewport.hasPointerCapture(e.pointerId)) {
                        ui.viewport.releasePointerCapture(e.pointerId);
                    }
                } catch (_) {}

                if (pointerIsDraggingPlaced) {
                    const equipId = activePlacedDragGroup.userData?.equipmentId;
                    const posX = activePlacedDragGroup.position.x;
                    const posZ = activePlacedDragGroup.position.z;
                    let posY = activePlacedDragGroup.position.y;

                    const state = workspaceStore.getState();
                    const equipIdx = state.equipment.findIndex(eq => eq.id === equipId);
                    const existingEquip = equipIdx !== -1 ? state.equipment[equipIdx] : null;

                    const is2D = ui.btn2d.classList.contains('active');
                    const selectedLevelFromStore = useViewerStore.getState().selectedLevel;
                    const activeLevelId = selectedLevelFromStore || ui.selectLevel?.value;

                    const isRoofStorey = Boolean(
                        (existingEquip?.locationFloor && /roof|terrace|parapet|deck/i.test(existingEquip.locationFloor)) ||
                        (existingEquip?.locationSpaceName && /roof|terrace|parapet|deck/i.test(existingEquip.locationSpaceName)) ||
                        (activeLevelId && /roof|terrace|parapet|deck/i.test(activeLevelId))
                    );

                    // Prioritize: 1. Roof storey if designated roof, 2. Top dropdown selection, 3. Equipment's existing locationFloor, 4. Detect from Y only if unassigned
                    let equipFloorStorey = (isRoofStorey ? findStoreyByFloor('ROOF LEVEL') : null)
                        || (existingEquip?.locationFloor ? findStoreyByFloor(existingEquip.locationFloor) : null)
                        || (activeLevelId ? findStoreyByFloor(activeLevelId) : null);
                    if (!equipFloorStorey && !is2D) {
                        equipFloorStorey = detectStoreyFromY(activePlacedDragGroup.position.y);
                    }
                    if (!equipFloorStorey) {
                        equipFloorStorey = (activeStoreys && activeStoreys.length > 0 ? [...activeStoreys].sort((a, b) => a.elevation - b.elevation)[0] : null);
                    }

                    let spaceId = 'outside';
                    let spaceName = 'Floor / Open Area';
                    let floorName = equipFloorStorey?.name || (isRoofStorey ? 'ROOF LEVEL' : 'Ground Floor');

                    if (is2D) {
                        const hit = (window as any)._raycastSpaceUnderCursor ? (window as any)._raycastSpaceUnderCursor(e, equipFloorStorey?.expressId) : null;
                        if (hit) {
                            if (hit.point?.y !== undefined) posY = hit.point.y;
                            if (hit.space) {
                                spaceId = String(hit.expressId);
                                spaceName = hit.space.longName || hit.space.name || `Space ${hit.expressId}`;
                                if (hit.storeyExpressId) {
                                    const st = findStoreyByFloor(hit.storeyExpressId);
                                    if (st) floorName = st.name;
                                }
                            }
                        }
                    } else {
                        // 3D mode space lookup constrained to equipFloorStorey
                        if (activeSpaceBoundsMap.size > 0 && equipFloorStorey) {
                            for (const [expressId, spData] of activeSpaceBoundsMap) {
                                if (String(spData.storeyExpressId) !== String(equipFloorStorey.expressId)) continue;
                                const b = spData.box;
                                if (posX >= b.min.x && posX <= b.max.x && posZ >= b.min.z && posZ <= b.max.z) {
                                    spaceId = String(expressId);
                                    spaceName = spData.space?.longName || spData.space?.name || `Space ${expressId}`;
                                    break;
                                }
                            }
                        }
                        if (spaceId === 'outside' && (isRoofStorey || (equipFloorStorey && /roof|terrace/i.test(equipFloorStorey.name)))) {
                            spaceName = 'Roof Deck / Open Area';
                        }
                    }

                    // Snap directly to physical slab surface at (posX, posZ) for equipFloorStorey
                    posY = getPhysicalFloorSurfaceY(posX, posZ, equipFloorStorey);
                    const storeyElevY = (equipFloorStorey && activeGetWorldHeight) ? activeGetWorldHeight(equipFloorStorey.elevation) : 0;
                    if (posY === undefined || isNaN(posY)) {
                        posY = storeyElevY;
                    } else if (!isRoofStorey && Math.abs(posY - storeyElevY) > 3.5) {
                        posY = storeyElevY;
                    }
                    activePlacedDragGroup.position.y = posY + 0.002;

                    if (equipIdx !== -1) {
                        const newEquipment = [...state.equipment];
                        newEquipment[equipIdx] = {
                            ...newEquipment[equipIdx],
                            locationSpaceId: spaceId,
                            locationSpaceName: spaceName,
                            locationFloor: floorName,
                            positionX: posX,
                            positionY: posY,
                            positionZ: posZ,
                            rotationY: activePlacedDragGroup.rotation.y
                        };
                        workspaceStore.updateEquipment(newEquipment);
                        renderEquipmentMeshes();
                    }
                }

                activePlacedDragGroup = null;
                pointerIsDraggingPlaced = false;
            }

            // GUARANTEE camera controls are re-enabled:
            if (world.camera?.controls) {
                world.camera.controls.enabled = true;
                if (ui.btn2d.classList.contains('active')) {
                    world.camera.controls.mouseButtons.wheel = 32;
                } else {
                    world.camera.controls.mouseButtons.wheel = 16;
                }
            }
        };

        ui.viewport.addEventListener('pointerdown', handleUnifiedPointerDown);
        ui.viewport.addEventListener('pointermove', handleUnifiedPointerMove);
        ui.viewport.addEventListener('pointerup', handleUnifiedPointerEnd);
        ui.viewport.addEventListener('pointercancel', handleUnifiedPointerEnd);
        window.addEventListener('pointerup', handleUnifiedPointerEnd);
        window.addEventListener('mouseup', handleUnifiedPointerEnd);

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if ((e.key === 'r' || e.key === 'R') && selectedEquipmentId) {
                const targetGroup = placedEquipment3DMeshes.find(g => g.userData?.equipmentId === selectedEquipmentId);
                if (!targetGroup) return;

                targetGroup.rotation.y = (targetGroup.rotation.y || 0) + Math.PI / 4;
                const state = workspaceStore.getState();
                const equipIdx = state.equipment.findIndex(eq => eq.id === selectedEquipmentId);
                if (equipIdx !== -1) {
                    const newEquipment = [...state.equipment];
                    newEquipment[equipIdx] = {
                        ...newEquipment[equipIdx],
                        rotationY: targetGroup.rotation.y
                    };
                    workspaceStore.updateEquipment(newEquipment);
                }
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEquipmentId) {
                const targetEquipId = selectedEquipmentId;
                const state = workspaceStore.getState();
                const targetEquip = state.equipment.find((eq: any) => eq.id === targetEquipId);
                if (targetEquip) {
                    const updated = state.equipment.map((eq: any) => {
                        if (eq.id === targetEquipId) {
                            return {
                                ...eq,
                                locationSpaceId: undefined,
                                locationSpaceName: undefined,
                                locationFloor: undefined,
                                positionX: undefined,
                                positionY: undefined,
                                positionZ: undefined,
                                rotationY: undefined,
                            };
                        }
                        return eq;
                    });
                    setSelectedEquipment(null);
                    workspaceStore.updateEquipment(updated);
                }
            }

            if (e.key === 'Escape' && selectedEquipmentId) {
                setSelectedEquipment(null);
                renderEquipmentMeshes();
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
                    } catch { }
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
            if (typeof document !== 'undefined' && document.pointerLockElement) {
                try { document.exitPointerLock(); } catch {}
            }
            if (cameraUpdateDebounce) clearTimeout(cameraUpdateDebounce);
            if (viewportAbortController) {
                try { viewportAbortController.abort(); } catch {}
            }
            if (unsubEquipmentStore) {
                try { unsubEquipmentStore(); } catch {}
                unsubEquipmentStore = null;
            }
            document.removeEventListener('dragover', handleDragOver);
            document.removeEventListener('drop', handleDrop);
            window.removeEventListener('mep-focus-equipment', handleFocusEquipment);
            window.removeEventListener('mep-equipment-updated', handleEquipmentUpdated);
            window.removeEventListener('keydown', handleShiftDown);
            window.removeEventListener('keyup', handleShiftUp);
            window.removeEventListener('keydown', handleWalkKeyDown);
            window.removeEventListener('keyup', handleWalkKeyUp);
            try {
                ui.viewport.removeEventListener('wheel', handleViewportWheel);
                ui.viewport.removeEventListener('pointerdown', handleUnifiedPointerDown);
                ui.viewport.removeEventListener('pointermove', handleUnifiedPointerMove);
                ui.viewport.removeEventListener('pointerup', handleUnifiedPointerEnd);
                ui.viewport.removeEventListener('pointercancel', handleUnifiedPointerEnd);
                window.removeEventListener('pointerup', handleUnifiedPointerEnd);
                window.removeEventListener('mouseup', handleUnifiedPointerEnd);
            } catch (_) {}
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

            {/* Selected Equipment Information HUD */}
            {selectedEquip && hasLiteralDimensions(selectedEquip) && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#18181b]/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl px-4 py-2.5 text-white max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <Box className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">
                                {selectedEquip.tag}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                                {selectedEquip.type || 'Equipment'}
                            </span>
                            {(() => {
                                const dims = getEquipmentLiteralDimensions(selectedEquip);
                                return dims ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                                        {dims.formatted}
                                    </span>
                                ) : null;
                            })()}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
                                Floor-Mounted
                            </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                            <span>Level: {selectedEquip.locationFloor || 'Floor'}</span>
                            <span>•</span>
                            <span>{selectedEquip.locationSpaceName || 'Floor Surface'}</span>
                            <span className="text-slate-400 ml-1">| Drag to move • Ctrl+Drag or &apos;R&apos; to change direction</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof (window as any)._setSelectedEquipment === 'function') {
                                (window as any)._setSelectedEquipment(null);
                            } else {
                                useViewerStore.getState().setSelectedEquipmentId(null);
                            }
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1 shrink-0"
                        title="Deselect Equipment"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
