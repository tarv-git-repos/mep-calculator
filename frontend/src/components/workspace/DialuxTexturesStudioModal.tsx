import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Palette,
  Layers,
  Sparkles,
  Sliders,
  Check,
  RotateCcw,
  Pipette,
  PaintBucket,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Camera,
  Activity,
  Box,
  Compass,
  FileDown,
  Info,
  Shield,
  Grid,
  Sun,
  Flame,
  Split,
  Building2,
  Lock,
  Unlock,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  TextureTilingMode,
  SurfaceType,
  MaterialCategory,
  TextureTransform,
  DetailedMaterial,
  SurfaceMaterialAssignment,
  RadiosityImpactResult,
  BUILTIN_DETAILED_MATERIALS,
  DEFAULT_SURFACE_ASSIGNMENTS,
  calculateRadiosityImpact,
  generateProceduralCanvasTexture,
} from "@/lib/dialux-textures-engine";

export interface DialuxTexturesStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyMaterialsToSimulation?: (assignments: SurfaceMaterialAssignment[]) => void;
}

export function DialuxTexturesStudioModal({
  isOpen,
  onClose,
  projectName = "Executive Suite & Architectural Surface Finishes",
  onApplyMaterialsToSimulation,
}: DialuxTexturesStudioModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "mapping" | "uv_transform" | "optical" | "catalog"
  >("viewport");

  // Materials Catalog & Assignments State
  const [materials, setMaterials] = useState<DetailedMaterial[]>(BUILTIN_DETAILED_MATERIALS);
  const [assignments, setAssignments] = useState<SurfaceMaterialAssignment[]>(DEFAULT_SURFACE_ASSIGNMENTS);

  // Active Selected Material & Surface
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("wood_natural_oak");
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<SurfaceType>("floor");

  // Tool Mode: 'select' | 'paint' | 'pipette'
  const [toolMode, setToolMode] = useState<"select" | "paint" | "pipette">("paint");
  const [shiftKeyMode, setShiftKeyMode] = useState<boolean>(false);

  // Global Replace Material Dialog State
  const [replaceSourceId, setReplaceSourceId] = useState<string>("concrete_smooth_fairfaced");
  const [replaceTargetId, setReplaceTargetId] = useState<string>("marble_carrara_white");

  // Catalog Filters
  const [catalogCategory, setCatalogCategory] = useState<string>("all");

  // 3D Viewport Layer Toggles
  const [showFixtures, setShowFixtures] = useState(true);
  const [showWireframe, setShowWireframe] = useState(true);
  const [showLuminanceHud, setShowLuminanceHud] = useState(true);

  // Room Geometry Dimensions
  const roomL = 10.0;
  const roomW = 8.0;
  const roomH = 3.2;

  // Active Material & Surface Objects
  const activeMaterial = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterialId) || materials[0];
  }, [materials, selectedMaterialId]);

  const materialsMap = useMemo(() => {
    const map: Record<string, DetailedMaterial> = {};
    materials.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [materials]);

  // Radiosity Calculation Result
  const radiosityResult: RadiosityImpactResult = useMemo(() => {
    return calculateRadiosityImpact(roomL, roomW, roomH, assignments, materialsMap, 36000);
  }, [assignments, materialsMap]);

  // 3D Scene Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Helper: Update Active Material fields
  const handleUpdateActiveMaterial = (patch: Partial<DetailedMaterial>) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === activeMaterial.id ? { ...m, ...patch } : m))
    );
  };

  // Helper: Update Transform of Active Material
  const handleUpdateTransform = (patch: Partial<TextureTransform>) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === activeMaterial.id
          ? { ...m, transform: { ...m.transform, ...patch } }
          : m
      )
    );
  };

  // Helper: Apply Material to surface (with Shift-Key support for All Walls)
  const applyMaterialToSurface = (surfaceId: SurfaceType, materialId: string) => {
    if (shiftKeyMode && surfaceId.startsWith("wall_")) {
      // Shift Key Pro-Tip from Tutorial 27: Apply to all room walls simultaneously!
      setAssignments((prev) =>
        prev.map((a) => (a.surfaceId.startsWith("wall_") ? { ...a, materialId } : a))
      );
      toast.success(`[Shift-Key Batch] Applied "${materialsMap[materialId]?.name}" to ALL walls!`);
    } else {
      setAssignments((prev) =>
        prev.map((a) => (a.surfaceId === surfaceId ? { ...a, materialId } : a))
      );
      toast.success(`Applied "${materialsMap[materialId]?.name}" to ${surfaceId}`);
    }
  };

  // Helper: Global Replace Material Tool
  const handleGlobalReplace = () => {
    let replacedCount = 0;
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.materialId === replaceSourceId) {
          replacedCount++;
          return { ...a, materialId: replaceTargetId };
        }
        return a;
      })
    );
    toast.success(
      `Replaced "${materialsMap[replaceSourceId]?.name}" with "${materialsMap[replaceTargetId]?.name}" on ${replacedCount} surfaces.`
    );
  };

  // Preset Camera Positions
  const setCameraView = (type: "interior" | "floor" | "ceiling" | "north" | "accent") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (type) {
      case "interior":
        cam.position.set(0, 1.8, 4.2);
        ctrl.target.set(0, 1.4, 0);
        break;
      case "floor":
        cam.position.set(0, 3.5, 2.5);
        ctrl.target.set(0, 0, 0);
        break;
      case "ceiling":
        cam.position.set(0, 0.8, 1.5);
        ctrl.target.set(0, roomH, 0);
        break;
      case "north":
        cam.position.set(0, 1.6, -1.0);
        ctrl.target.set(0, 1.6, -roomW / 2);
        break;
      case "accent":
        cam.position.set(2.5, 1.4, 2.0);
        ctrl.target.set(3.5, 1.2, 0);
        break;
    }
    ctrl.update();
  };

  // 3D Initialization
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 4.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.4, 0);
    controlsRef.current = controls;

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(5, 12, 6);
    scene.add(dirLight);

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current?.domElement) rendererRef.current.dispose();
      container.innerHTML = "";
    };
  }, [isOpen]);

  // Build & Re-Texture 3D Meshes when materials or assignments change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear previous dynamic meshes
    const toRemove: any[] = [];
    scene.traverse((obj: any) => {
      if (obj.userData?.isDynamic) toRemove.push(obj);
    });
    toRemove.forEach((obj) => scene.remove(obj));

    // Helper: Create textured Three.js Material
    const buildThreeMaterial = (mat: DetailedMaterial, faceW: number, faceH: number) => {
      const canvas = generateProceduralCanvasTexture(mat.texturePattern, mat.colorHex, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      // Real-World Physical Metric Sizing: Repeat = Face Dimension / Texture Dimension
      const tileW = Math.max(0.1, mat.transform.sizeXMeters);
      const tileH = Math.max(0.1, mat.transform.sizeYMeters);
      const repeatX = Math.max(1, faceW / tileW);
      const repeatY = Math.max(1, faceH / tileH);
      texture.repeat.set(repeatX, repeatY);
      texture.rotation = (mat.transform.rotationDeg * Math.PI) / 180;
      texture.offset.set(mat.transform.offsetX, mat.transform.offsetY);

      return new THREE.MeshStandardMaterial({
        map: texture,
        color: new THREE.Color(mat.colorHex),
        roughness: mat.roughness,
        metalness: mat.metallic,
        transparent: mat.transparency > 0,
        opacity: 1.0 - mat.transparency * 0.7,
        side: THREE.DoubleSide,
      });
    };

    // 1. FLOOR
    const floorAssign = assignments.find((a) => a.surfaceId === "floor");
    const floorMat = materialsMap[floorAssign?.materialId || ""] || materials[0];
    const floorThreeMat = buildThreeMaterial(floorMat, roomL, roomW);
    const floorGeo = new THREE.PlaneGeometry(roomL, roomW);
    const floorMesh = new THREE.Mesh(floorGeo, floorThreeMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.userData = { isDynamic: true, surfaceId: "floor" };
    scene.add(floorMesh);

    // 2. CEILING
    const ceilAssign = assignments.find((a) => a.surfaceId === "ceiling");
    const ceilMat = materialsMap[ceilAssign?.materialId || ""] || materials[7];
    const ceilThreeMat = buildThreeMaterial(ceilMat, roomL, roomW);
    const ceilGeo = new THREE.PlaneGeometry(roomL, roomW);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilThreeMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.y = roomH;
    ceilMesh.userData = { isDynamic: true, surfaceId: "ceiling" };
    scene.add(ceilMesh);

    // 3. NORTH WALL (Z = -roomW/2)
    const nAssign = assignments.find((a) => a.surfaceId === "wall_north");
    const nMat = materialsMap[nAssign?.materialId || ""] || materials[6];
    const nThreeMat = buildThreeMaterial(nMat, roomL, roomH);
    const nGeo = new THREE.PlaneGeometry(roomL, roomH);
    const nMesh = new THREE.Mesh(nGeo, nThreeMat);
    nMesh.position.set(0, roomH / 2, -roomW / 2);
    nMesh.userData = { isDynamic: true, surfaceId: "wall_north" };
    scene.add(nMesh);

    // 4. SOUTH WALL (Z = +roomW/2)
    const sAssign = assignments.find((a) => a.surfaceId === "wall_south");
    const sMat = materialsMap[sAssign?.materialId || ""] || materials[5];
    const sThreeMat = buildThreeMaterial(sMat, roomL, roomH);
    const sGeo = new THREE.PlaneGeometry(roomL, roomH);
    const sMesh = new THREE.Mesh(sGeo, sThreeMat);
    sMesh.rotation.y = Math.PI;
    sMesh.position.set(0, roomH / 2, roomW / 2);
    sMesh.userData = { isDynamic: true, surfaceId: "wall_south" };
    scene.add(sMesh);

    // 5. EAST WALL (X = +roomL/2)
    const eAssign = assignments.find((a) => a.surfaceId === "wall_east");
    const eMat = materialsMap[eAssign?.materialId || ""] || materials[6];
    const eThreeMat = buildThreeMaterial(eMat, roomW, roomH);
    const eGeo = new THREE.PlaneGeometry(roomW, roomH);
    const eMesh = new THREE.Mesh(eGeo, eThreeMat);
    eMesh.rotation.y = -Math.PI / 2;
    eMesh.position.set(roomL / 2, roomH / 2, 0);
    eMesh.userData = { isDynamic: true, surfaceId: "wall_east" };
    scene.add(eMesh);

    // 6. WEST WALL (X = -roomL/2)
    const wAssign = assignments.find((a) => a.surfaceId === "wall_west");
    const wMat = materialsMap[wAssign?.materialId || ""] || materials[6];
    const wThreeMat = buildThreeMaterial(wMat, roomW, roomH);
    const wGeo = new THREE.PlaneGeometry(roomW, roomH);
    const wMesh = new THREE.Mesh(wGeo, wThreeMat);
    wMesh.rotation.y = Math.PI / 2;
    wMesh.position.set(-roomL / 2, roomH / 2, 0);
    wMesh.userData = { isDynamic: true, surfaceId: "wall_west" };
    scene.add(wMesh);

    // 7. ACCENT FEATURE PANEL / RECEPTION DESK
    const accAssign = assignments.find((a) => a.surfaceId === "accent_feature");
    const accMat = materialsMap[accAssign?.materialId || ""] || materials[2];
    const accThreeMat = buildThreeMaterial(accMat, 2.4, 1.1);
    const deskGeo = new THREE.BoxGeometry(2.4, 1.1, 0.8);
    const deskMesh = new THREE.Mesh(deskGeo, accThreeMat);
    deskMesh.position.set(0, 0.55, 0);
    deskMesh.userData = { isDynamic: true, surfaceId: "accent_feature" };
    scene.add(deskMesh);

    // 8. Room Edges Wireframe
    if (showWireframe) {
      const roomGeo = new THREE.BoxGeometry(roomL, roomH, roomW);
      const roomEdges = new THREE.EdgesGeometry(roomGeo);
      const wire = new THREE.LineSegments(
        roomEdges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 })
      );
      wire.position.set(0, roomH / 2, 0);
      wire.userData = { isDynamic: true };
      scene.add(wire);
    }

    // 9. Ceiling Luminaires Array & Cones
    if (showFixtures) {
      const lights = [
        [-2.5, roomH, -2.0],
        [2.5, roomH, -2.0],
        [-2.5, roomH, 2.0],
        [2.5, roomH, 2.0],
      ];
      lights.forEach(([lx, ly, lz]) => {
        const fixGeo = new THREE.BoxGeometry(0.8, 0.08, 0.4);
        const fixMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const fix = new THREE.Mesh(fixGeo, fixMat);
        fix.position.set(lx, ly - 0.04, lz);
        fix.userData = { isDynamic: true };
        scene.add(fix);

        // Light cone
        const coneGeo = new THREE.ConeGeometry(2.2, 2.8, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.1,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(lx, ly - 1.4, lz);
        cone.userData = { isDynamic: true };
        scene.add(cone);
      });
    }
  }, [assignments, materials, materialsMap, showFixtures, showWireframe]);

  // Export JSON Report
  const handleExportJson = () => {
    const reportData = {
      project: projectName,
      tutorial: "DIALux evo Tutorial Part 27 — Enhancing projects with detailed textures",
      timestamp: new Date().toISOString(),
      materials,
      assignments,
      radiosityResult,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DIALux_Detailed_Textures_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Detailed textures & materials configuration exported.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 rounded-lg shadow-sm text-white">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Detailed Textures & Materials Studio
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-400 border border-rose-700/50">
                  Tutorial Part 27
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-400 border border-amber-700/50">
                  PBR Metric Scaling & Radiosity
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Enhancing Projects with Detailed Textures — Metric Physical Sizing, UV Rotation, Reflectance & Shift-Key Batching
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-600/80 transition"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center justify-between px-5 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "viewport"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              1. 3D Texture Viewport
            </button>

            <button
              onClick={() => setActiveTab("mapping")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "mapping"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <PaintBucket className="w-3.5 h-3.5" />
              2. Surface Mapping & Painter
            </button>

            <button
              onClick={() => setActiveTab("uv_transform")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "uv_transform"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              3. UV Metric Scaling & Rotation
            </button>

            <button
              onClick={() => setActiveTab("optical")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "optical"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              4. Reflectance & Precious Gloss
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "catalog"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              5. Materials & Texture Catalog ({materials.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export Textures
            </button>
            <button
              onClick={() => {
                if (onApplyMaterialsToSimulation) {
                  onApplyMaterialsToSimulation(assignments);
                }
                toast.success("Applied detailed textures & surface reflectances to simulation!");
              }}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Apply to Simulation
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-hidden relative flex">
          {/* TAB 1: 3D TEXTURE VIEWPORT */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              {/* Main 3D Canvas */}
              <div className="flex-1 h-full relative bg-slate-950 flex flex-col">
                <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

                {/* Top Interactive Toolstrip HUD */}
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-full px-4 py-1.5 shadow-xl flex items-center gap-3 z-10">
                  <span className="text-[11px] font-bold text-slate-300">Tool:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setToolMode("paint")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                        toolMode === "paint"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <PaintBucket className="w-3.5 h-3.5" />
                      Paint Bucket
                    </button>
                    <button
                      onClick={() => setToolMode("pipette")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                        toolMode === "pipette"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <Pipette className="w-3.5 h-3.5" />
                      Eyedropper (Pipette)
                    </button>
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  {/* Shift-Key Pro-Tip Toggle */}
                  <button
                    onClick={() => {
                      setShiftKeyMode(!shiftKeyMode);
                      toast.info(`Shift-key batch mode is now ${!shiftKeyMode ? "ENABLED (All Walls)" : "DISABLED (Single Face)"}`);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition border ${
                      shiftKeyMode
                        ? "bg-amber-600 text-white border-amber-500 shadow-sm animate-pulse"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                    title="Tutorial 27 Pro-Tip: Pressing Shift applies material to all walls of the room at once"
                  >
                    <span>[Shift] Batch All Walls</span>
                  </button>
                </div>

                {/* Left 3D Camera & Layer Controls HUD */}
                <div className="absolute top-14 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 shadow-lg flex flex-col gap-2 max-w-xs">
                  <span className="text-[11px] font-bold text-slate-200 border-b border-slate-700 pb-1 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5 text-rose-400" />
                    Camera Presets
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      onClick={() => setCameraView("interior")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 text-left truncate transition"
                    >
                      Interior View
                    </button>
                    <button
                      onClick={() => setCameraView("floor")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 text-left truncate transition"
                    >
                      Floor Parquet
                    </button>
                    <button
                      onClick={() => setCameraView("ceiling")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sky-300 text-left truncate transition"
                    >
                      Ceiling Grid
                    </button>
                    <button
                      onClick={() => setCameraView("north")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-rose-300 text-left truncate transition"
                    >
                      North Wall Wash
                    </button>
                  </div>

                  <div className="border-t border-slate-700 pt-1.5 flex flex-col gap-1 text-[11px]">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFixtures}
                        onChange={(e) => setShowFixtures(e.target.checked)}
                        className="rounded border-slate-700 text-yellow-400 focus:ring-0"
                      />
                      Luminaires & Light Cones
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWireframe}
                        onChange={(e) => setShowWireframe(e.target.checked)}
                        className="rounded border-slate-700 text-sky-400 focus:ring-0"
                      />
                      Room Edges Outline
                    </label>
                  </div>
                </div>

                {/* Bottom Radiosity & Luminance Impact HUD */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">Active Texture: {activeMaterial.name}</span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 inline-block"
                        style={{ backgroundColor: activeMaterial.colorHex }}
                      />
                      Reflectance (rho): <strong className="text-amber-400 font-mono">{Math.round(activeMaterial.reflectanceRho * 100)}%</strong>
                    </span>
                    <span>
                      Physical Scale:{" "}
                      <strong className="text-sky-400 font-mono">
                        {activeMaterial.transform.sizeXMeters}m × {activeMaterial.transform.sizeYMeters}m
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span>
                      Room Avg Rho: <strong className="text-white font-mono">{Math.round(radiosityResult.averageRoomReflectance * 100)}%</strong>
                    </span>
                    <span>
                      Utilization CU: <strong className="text-sky-300 font-mono">{radiosityResult.coefficientOfUtilization}</strong>
                    </span>
                    <span>
                      Est. Lux: <strong className="text-emerald-400 font-mono font-bold">{radiosityResult.estimatedAverageLux} lx</strong>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        radiosityResult.luxMultiplierFromStandard >= 1.0
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                          : "bg-rose-950 text-rose-400 border border-rose-700"
                      }`}
                    >
                      {radiosityResult.luxMultiplierFromStandard >= 1.0 ? "+" : ""}
                      {Math.round((radiosityResult.luxMultiplierFromStandard - 1.0) * 100)}% RADIOSITY IMPACT
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Quick Inspector Pane */}
              <div className="w-full md:w-80 bg-slate-800/90 border-l border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <PaintBucket className="w-4 h-4 text-rose-400" />
                    Quick Surface Applicator
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Select a surface to assign the active texture.
                  </p>
                </div>

                {/* Surface List Selector */}
                <div className="space-y-1.5">
                  {assignments.map((assign) => {
                    const mat = materialsMap[assign.materialId] || materials[0];
                    const isSel = selectedSurfaceId === assign.surfaceId;

                    return (
                      <div
                        key={assign.surfaceId}
                        onClick={() => setSelectedSurfaceId(assign.surfaceId)}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition ${
                          isSel
                            ? "bg-rose-950/40 border-rose-500"
                            : "bg-slate-900/60 border-slate-750 hover:border-slate-600"
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-white block">{assign.surfaceName}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">
                            {mat.name} ({Math.round(mat.reflectanceRho * 100)}% rho)
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            applyMaterialToSurface(assign.surfaceId, activeMaterial.id);
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold transition shadow-sm"
                        >
                          Apply
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Shift Key Pro-Tip Banner */}
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Tutorial 27 Pro-Tip:
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Enable <strong>[Shift] Batch All Walls</strong> to texture every wall in the room in a single click, keeping uniform material properties.
                  </p>
                </div>

                {/* Navigation to UV & Optical Tabs */}
                <button
                  onClick={() => setActiveTab("uv_transform")}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition shadow"
                >
                  Adjust UV Scale & Rotation →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SURFACE MAPPING & PAINTER */}
          {activeTab === "mapping" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              {/* Global Replace Material Bar */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-sky-400" />
                    Global Replace Material Tool
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Find every instance of a material across all room surfaces and replace it simultaneously.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <span className="text-slate-400">Replace:</span>
                    <select
                      value={replaceSourceId}
                      onChange={(e) => setReplaceSourceId(e.target.value)}
                      className="bg-transparent text-white outline-none cursor-pointer"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-slate-400 text-xs font-bold">with</span>

                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <select
                      value={replaceTargetId}
                      onChange={(e) => setReplaceTargetId(e.target.value)}
                      className="bg-transparent text-white outline-none cursor-pointer"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleGlobalReplace}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition shadow"
                  >
                    Execute Replace
                  </button>
                </div>
              </div>

              {/* Surface Mapping Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
                        <th className="py-3 px-4 font-semibold">Surface Designation</th>
                        <th className="py-3 px-4 font-semibold">Area ($m^2$)</th>
                        <th className="py-3 px-4 font-semibold">Assigned Material</th>
                        <th className="py-3 px-4 font-semibold">Reflectance (rho)</th>
                        <th className="py-3 px-4 font-semibold">Specular Gloss</th>
                        <th className="py-3 px-4 font-semibold">Texture Dimensions</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {assignments.map((assign) => {
                        const mat = materialsMap[assign.materialId] || materials[0];

                        return (
                          <tr key={assign.surfaceId} className="hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-medium text-white">
                              {assign.surfaceName}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {assign.areaM2.toFixed(1)} $m^2$
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={assign.materialId}
                                onChange={(e) => {
                                  applyMaterialToSurface(assign.surfaceId, e.target.value);
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                              >
                                {materials.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-amber-400">
                              {Math.round(mat.reflectanceRho * 100)}%
                            </td>
                            <td className="py-3 px-4 font-mono text-sky-300">
                              {Math.round(mat.specularRho * 100)}% ({mat.roughness < 0.3 ? "Polished" : "Matte"})
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {mat.transform.sizeXMeters}m × {mat.transform.sizeYMeters}m
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedMaterialId(mat.id);
                                  setSelectedSurfaceId(assign.surfaceId);
                                  setActiveTab("uv_transform");
                                }}
                                className="text-rose-400 hover:underline font-semibold text-[11px]"
                              >
                                Edit UV →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UV METRIC SCALING & ROTATION */}
          {activeTab === "uv_transform" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-rose-400" />
                  Real-World Metric UV Scaling & Alignment
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust texture physical dimensions ($X \times Y$ meters), rotation angles, and grout joint shifts per Tutorial Part 27.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Physical Dimensions Panel */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-bold text-white text-sm">Physical Dimensions (Meters)</span>
                    <button
                      onClick={() => handleUpdateTransform({ lockAspectRatio: !activeMaterial.transform.lockAspectRatio })}
                      className="flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                    >
                      {activeMaterial.transform.lockAspectRatio ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Aspect Ratio Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Aspect Ratio Free</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Size X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Width (X-Meters):</span>
                      <strong className="text-sky-400 font-mono">{activeMaterial.transform.sizeXMeters.toFixed(2)} m</strong>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="4.00"
                      step="0.05"
                      value={activeMaterial.transform.sizeXMeters}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.1;
                        if (activeMaterial.transform.lockAspectRatio) {
                          const ratio = activeMaterial.transform.sizeYMeters / activeMaterial.transform.sizeXMeters;
                          handleUpdateTransform({ sizeXMeters: val, sizeYMeters: Math.round(val * ratio * 100) / 100 });
                        } else {
                          handleUpdateTransform({ sizeXMeters: val });
                        }
                      }}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Size Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Height (Y-Meters):</span>
                      <strong className="text-sky-400 font-mono">{activeMaterial.transform.sizeYMeters.toFixed(2)} m</strong>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="4.00"
                      step="0.05"
                      value={activeMaterial.transform.sizeYMeters}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.1;
                        if (activeMaterial.transform.lockAspectRatio) {
                          const ratio = activeMaterial.transform.sizeXMeters / activeMaterial.transform.sizeYMeters;
                          handleUpdateTransform({ sizeYMeters: val, sizeXMeters: Math.round(val * ratio * 100) / 100 });
                        } else {
                          handleUpdateTransform({ sizeYMeters: val });
                        }
                      }}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Dimension Presets */}
                  <div className="pt-2 border-t border-slate-700/60">
                    <span className="text-[11px] text-slate-400 block mb-1.5">Common Tile & Plank Presets:</span>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        onClick={() => handleUpdateTransform({ sizeXMeters: 0.60, sizeYMeters: 0.60 })}
                        className="p-1.5 bg-slate-900 hover:bg-slate-700 rounded text-slate-200"
                      >
                        60×60 cm Tile
                      </button>
                      <button
                        onClick={() => handleUpdateTransform({ sizeXMeters: 1.20, sizeYMeters: 0.20 })}
                        className="p-1.5 bg-slate-900 hover:bg-slate-700 rounded text-slate-200"
                      >
                        120×20 cm Plank
                      </button>
                      <button
                        onClick={() => handleUpdateTransform({ sizeXMeters: 0.30, sizeYMeters: 0.10 })}
                        className="p-1.5 bg-slate-900 hover:bg-slate-700 rounded text-slate-200"
                      >
                        30×10 cm Subway
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rotation & Offset Shift Panel */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-bold text-white text-sm">Rotation Angle & Joint Shift</span>
                    <RotateCw className="w-4 h-4 text-rose-400" />
                  </div>

                  {/* Rotation Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Rotation Angle:</span>
                      <strong className="text-rose-400 font-mono">{activeMaterial.transform.rotationDeg}°</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="5"
                      value={activeMaterial.transform.rotationDeg}
                      onChange={(e) => handleUpdateTransform({ rotationDeg: parseInt(e.target.value) || 0 })}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <button onClick={() => handleUpdateTransform({ rotationDeg: 0 })}>0° (Straight)</button>
                      <button onClick={() => handleUpdateTransform({ rotationDeg: 45 })}>45° (Diagonal)</button>
                      <button onClick={() => handleUpdateTransform({ rotationDeg: 90 })}>90° (Turn)</button>
                      <button onClick={() => handleUpdateTransform({ rotationDeg: 180 })}>180°</button>
                    </div>
                  </div>

                  {/* U Offset Shift */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Origin Shift U (Horizontal):</span>
                      <strong className="text-amber-400 font-mono">{activeMaterial.transform.offsetX.toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={activeMaterial.transform.offsetX}
                      onChange={(e) => handleUpdateTransform({ offsetX: parseFloat(e.target.value) || 0 })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* V Offset Shift */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Origin Shift V (Vertical):</span>
                      <strong className="text-amber-400 font-mono">{activeMaterial.transform.offsetY.toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={activeMaterial.transform.offsetY}
                      onChange={(e) => handleUpdateTransform({ offsetY: parseFloat(e.target.value) || 0 })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REFLECTANCE & PRECIOUS GLOSS */}
          {activeTab === "optical" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Material Optical Properties & Precious Reflectivity
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tune diffuse reflectance, specular highlights (gloss), and surface roughness to produce realistic, luxurious atmospheres.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
                  <span className="font-bold text-white text-sm block border-b border-slate-700 pb-2">
                    Reflectance & Specular Highlighting
                  </span>

                  {/* Diffuse Reflectance */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Diffuse Reflectance (rho):</span>
                      <strong className="text-amber-400 font-mono font-bold">
                        {Math.round(activeMaterial.reflectanceRho * 100)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.95"
                      step="0.01"
                      value={activeMaterial.reflectanceRho}
                      onChange={(e) => handleUpdateActiveMaterial({ reflectanceRho: parseFloat(e.target.value) || 0.1 })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>5% (Black Velvet)</span>
                      <span>50% (Standard Wall)</span>
                      <span>85% (Clean White Plaster)</span>
                    </div>
                  </div>

                  {/* Specular Gloss */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Specular Reflectance (Gloss / Luxury Sheen):</span>
                      <strong className="text-sky-400 font-mono font-bold">
                        {Math.round(activeMaterial.specularRho * 100)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.90"
                      step="0.02"
                      value={activeMaterial.specularRho}
                      onChange={(e) => handleUpdateActiveMaterial({ specularRho: parseFloat(e.target.value) || 0 })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0% (Matte Plaster)</span>
                      <span>25% (Satin Varnish)</span>
                      <span>70%+ (Polished Marble / Metal)</span>
                    </div>
                  </div>

                  {/* Roughness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Surface Roughness:</span>
                      <strong className="text-slate-200 font-mono font-bold">
                        {Math.round(activeMaterial.roughness * 100)}% ({activeMaterial.roughness < 0.2 ? "Mirror Smooth" : "Textured Matte"})
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="1.00"
                      step="0.05"
                      value={activeMaterial.roughness}
                      onChange={(e) => handleUpdateActiveMaterial({ roughness: parseFloat(e.target.value) || 0.5 })}
                      className="w-full accent-slate-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Radiosity Impact Meter */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
                  <span className="font-bold text-white text-sm block border-b border-slate-700 pb-2">
                    Photometric Radiosity Inter-Reflection Impact
                  </span>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Higher surface reflectances bounce more light into the room cavity, boosting the Coefficient of Utilization ($CU$) and decreasing the total fixture wattage required to achieve target lux.
                  </p>

                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-750 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Room Cavity Ratio (RCR):</span>
                      <strong className="text-white font-mono">{radiosityResult.roomCavityRatio}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weighted Average Room Reflectance:</span>
                      <strong className="text-amber-400 font-mono">
                        {Math.round(radiosityResult.averageRoomReflectance * 100)}%
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Coefficient of Utilization (CU):</span>
                      <strong className="text-sky-300 font-mono">{radiosityResult.coefficientOfUtilization}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Maintained Average Illuminance:</span>
                      <strong className="text-emerald-400 font-mono font-bold text-sm">
                        {radiosityResult.estimatedAverageLux} lx
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MATERIALS CATALOG */}
          {activeTab === "catalog" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Palette className="w-5 h-5 text-rose-400" />
                    Built-in Detailed Materials & Textures Library
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a material to inspect its optical properties or apply it to active surfaces.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Category:</span>
                  <select
                    value={catalogCategory}
                    onChange={(e) => setCatalogCategory(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="wood">Woods & Parquets</option>
                    <option value="stone_marble">Stones & Marbles</option>
                    <option value="ceramic_tile">Ceramic & Porcelain</option>
                    <option value="concrete_plaster">Concrete & Plaster</option>
                    <option value="carpet_fabric">Carpets & Fabrics</option>
                    <option value="metal">Architectural Metals</option>
                    <option value="outdoor_ground">Outdoor Grounds</option>
                  </select>
                </div>
              </div>

              {/* Materials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {materials
                  .filter((m) => catalogCategory === "all" || m.category === catalogCategory)
                  .map((mat) => {
                    const isSelected = mat.id === selectedMaterialId;

                    return (
                      <div
                        key={mat.id}
                        onClick={() => setSelectedMaterialId(mat.id)}
                        className={`p-4 rounded-xl border flex flex-col justify-between cursor-pointer transition ${
                          isSelected
                            ? "bg-slate-800 border-rose-500 ring-1 ring-rose-500 shadow-lg"
                            : "bg-slate-850/60 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-slate-300 border border-slate-700">
                              {mat.category}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: mat.colorHex }}
                              />
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-white mb-1">{mat.name}</h4>
                          <p className="text-xs text-slate-400 mb-3">{mat.description}</p>
                        </div>

                        <div className="space-y-1.5 border-t border-slate-700/60 pt-3 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Reflectance (rho):</span>
                            <strong className="text-amber-400 font-mono font-bold">
                              {Math.round(mat.reflectanceRho * 100)}%
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Physical Size:</span>
                            <strong className="text-sky-400 font-mono">
                              {mat.transform.sizeXMeters}m × {mat.transform.sizeYMeters}m
                            </strong>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              applyMaterialToSurface(selectedSurfaceId, mat.id);
                            }}
                            className="w-full mt-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition shadow-sm"
                          >
                            Apply to {selectedSurfaceId}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-2.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>DIALux evo Official Tutorial 27 Engine Active</span>
            <span className="text-slate-600">|</span>
            <span>Active Texture: <strong className="text-white">{activeMaterial.name}</strong></span>
            <span className="text-slate-600">|</span>
            <span>
              Shift-Key Batch:{" "}
              <strong className={shiftKeyMode ? "text-amber-400" : "text-slate-500"}>
                {shiftKeyMode ? "ALL WALLS" : "OFF"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAssignments(DEFAULT_SURFACE_ASSIGNMENTS);
                setMaterials(BUILTIN_DETAILED_MATERIALS);
                toast.info("Reset surfaces and materials to defaults");
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition cursor-pointer"
            >
              Close Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
