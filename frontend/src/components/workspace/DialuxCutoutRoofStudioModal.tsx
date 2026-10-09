import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Scissors,
  Layers,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Camera,
  Activity,
  Box,
  Compass,
  FileDown,
  Check,
  RotateCcw,
  Info,
  Shield,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  CutoutShapeType,
  CutoutTargetSurface,
  Point2D,
  CutoutItem,
  RoofWingGeometry,
  CutoutStudioProjectModel,
  CutoutCalculationMetrics,
  calculateShoelaceArea,
  recalculateCutoutMetrics,
  TUTORIAL_24_PRESETS,
} from "@/lib/dialux-cutout-roof-engine";

export interface DialuxCutoutRoofStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyToSimulation?: (project: CutoutStudioProjectModel) => void;
}

export function DialuxCutoutRoofStudioModal({
  isOpen,
  onClose,
  projectName = "Advanced Building Geometry & Roof Intersections",
  onApplyToSimulation,
}: DialuxCutoutRoofStudioModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"viewport" | "cutouts" | "vertices" | "roofs" | "quantities">("viewport");

  // Project Model
  const [activePresetId, setActivePresetId] = useState<string>("l_shaped_cross_gable_trim");
  const [project, setProject] = useState<CutoutStudioProjectModel>(TUTORIAL_24_PRESETS[0]);

  // Selected Cutout for editing
  const [selectedCutoutId, setSelectedCutoutId] = useState<string>(
    TUTORIAL_24_PRESETS[0].cutouts[0]?.id || ""
  );

  // Viewport Settings
  const [cameraView, setCameraView] = useState<"perspective" | "top" | "valley" | "interior">("perspective");
  const [showWireframe, setShowWireframe] = useState(true);
  const [showClipSection, setShowClipSection] = useState(false);

  // 3D Three.js Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const cutoutMeshRef = useRef<any>(null);

  // Computed Architectural Metrics
  const metrics: CutoutCalculationMetrics = useMemo(() => {
    return recalculateCutoutMetrics(project);
  }, [project]);

  // Active Cutout Reference
  const activeCutout = useMemo(() => {
    return project.cutouts.find((c) => c.id === selectedCutoutId) || project.cutouts[0];
  }, [project.cutouts, selectedCutoutId]);

  // Handle Preset Switching
  const handleLoadPreset = (preset: CutoutStudioProjectModel) => {
    setActivePresetId(preset.id);
    setProject(JSON.parse(JSON.stringify(preset)));
    if (preset.cutouts[0]) {
      setSelectedCutoutId(preset.cutouts[0].id);
    }
    toast.success(`Loaded Tutorial 24 preset: ${preset.name}`);
  };

  // Switch Camera Views
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (cameraView === "perspective") {
      cam.position.set(-16, 15, 18);
      ctrl.target.set(project.buildingLengthM / 2, project.buildingHeightM / 2, project.buildingWidthM / 2);
    } else if (cameraView === "top") {
      cam.position.set(project.buildingLengthM / 2, 26, project.buildingWidthM / 2 + 0.001);
      ctrl.target.set(project.buildingLengthM / 2, 0, project.buildingWidthM / 2);
    } else if (cameraView === "valley") {
      cam.position.set(2, 10, 8);
      ctrl.target.set(6, 7, 3);
    } else if (cameraView === "interior") {
      cam.position.set(project.buildingLengthM / 2, 2.5, project.buildingWidthM / 2);
      ctrl.target.set(project.buildingLengthM / 2, 8, project.buildingWidthM / 2);
    }
    ctrl.update();
  }, [cameraView, project]);

  // 2. Three.js Scene Initialization & 3D Model Construction
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(-16, 15, 18);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(project.buildingLengthM / 2, project.buildingHeightM / 2, project.buildingWidthM / 2);
    controlsRef.current = controls;

    // Ambient Hall Fill
    const ambLight = new THREE.AmbientLight(0x94a3b8, 0.5);
    scene.add(ambLight);

    // Sun Directional Light
    const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    dirLight.position.set(-15, 25, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground Plane
    const groundGeom = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(project.buildingLengthM / 2, 0, project.buildingWidthM / 2);
    scene.add(groundMesh);

    // Building Base Walls (Storeys)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.7,
      wireframe: false,
    });
    const mainBoxGeom = new THREE.BoxGeometry(
      project.buildingLengthM,
      project.buildingHeightM,
      project.buildingWidthM
    );
    const mainBoxMesh = new THREE.Mesh(mainBoxGeom, wallMat);
    mainBoxMesh.position.set(
      project.buildingLengthM / 2,
      project.buildingHeightM / 2,
      project.buildingWidthM / 2
    );
    mainBoxMesh.castShadow = true;
    mainBoxMesh.receiveShadow = true;
    scene.add(mainBoxMesh);

    // Pitched Roof Wings Construction
    project.roofs.forEach((roof) => {
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xb45309, // terracotta clay roof tile
        roughness: 0.5,
        side: THREE.DoubleSide,
      });

      if (roof.type === "gable_double_pitch" || roof.type === "l_shaped_cross_gable") {
        // Construct triangular prism for gable roof
        const shape = new THREE.Shape();
        const halfW = roof.widthM / 2 + roof.overhangM;
        shape.moveTo(-halfW, 0);
        shape.lineTo(0, roof.ridgeHeightM);
        shape.lineTo(halfW, 0);
        shape.closePath();

        const extrudeSettings = {
          steps: 1,
          depth: roof.lengthM + 2 * roof.overhangM,
          bevelEnabled: false,
        };
        const roofGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);

        if (roof.rotationDegrees === 90) {
          roofMesh.rotation.y = Math.PI / 2;
          roofMesh.position.set(roof.origin.x, roof.eaveHeightM, roof.origin.y);
        } else {
          roofMesh.rotation.y = 0;
          roofMesh.position.set(
            roof.origin.x - roof.overhangM,
            roof.eaveHeightM,
            roof.origin.y + roof.widthM / 2
          );
        }
        roofMesh.castShadow = true;
        scene.add(roofMesh);
      } else {
        // Shed single pitch
        const shedGeom = new THREE.BoxGeometry(roof.lengthM, 0.25, roof.widthM);
        const shedMesh = new THREE.Mesh(shedGeom, roofMat);
        shedMesh.position.set(roof.lengthM / 2, roof.eaveHeightM + 0.2, roof.widthM / 2);
        shedMesh.rotation.x = 0.05;
        scene.add(shedMesh);
      }
    });

    // 3D Visual Cutout Prisms & Wireframes
    project.cutouts.forEach((cut) => {
      if (!cut.isEnabled) return;
      const cutDepth = cut.limitCuttingDepth ? cut.cuttingDepthM : 1.2;
      const cutMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cut.colorHex),
        transparent: true,
        opacity: 0.75,
        wireframe: showWireframe,
      });

      let geom: any;
      if (cut.shapeType === "rectangular") {
        geom = new THREE.BoxGeometry(cut.widthM || 2.4, cutDepth, cut.lengthM || 2.4);
      } else if (cut.shapeType === "circular") {
        geom = new THREE.CylinderGeometry(cut.radiusM || 1, cut.radiusM || 1, cutDepth, 24);
      } else {
        // Polygonal Prism
        const polyShape = new THREE.Shape();
        if (cut.polygonPoints.length > 0) {
          polyShape.moveTo(cut.polygonPoints[0].x, cut.polygonPoints[0].y);
          for (let p = 1; p < cut.polygonPoints.length; p++) {
            polyShape.lineTo(cut.polygonPoints[p].x, cut.polygonPoints[p].y);
          }
          polyShape.closePath();
        }
        geom = new THREE.ExtrudeGeometry(polyShape, { depth: cutDepth, bevelEnabled: false });
      }

      const cutMesh = new THREE.Mesh(geom, cutMat);
      cutMesh.position.set(cut.centerPosition.x, cut.centerPosition.y, cut.centerPosition.z);
      scene.add(cutMesh);
      if (cut.id === selectedCutoutId) {
        cutoutMeshRef.current = cutMesh;
      }
    });

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [isOpen, project, showWireframe, selectedCutoutId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#10141f] border border-cyan-900/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 24 ADVANCED CUTOUT TOOL
        ========================================================================= */}
        <div className="px-5 py-3.5 bg-[#141b2d] border-b border-cyan-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Cutout Tool & Complex Roofs
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                  Tutorial Part 24
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  Advanced Geometry
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Polygonal Cutout • Roof Valley Trimming • Depth Limiting • Atriums & Dormers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Preset Selector */}
            <select
              value={activePresetId}
              onChange={(e) => {
                const found = TUTORIAL_24_PRESETS.find((p) => p.id === e.target.value);
                if (found) handleLoadPreset(found);
              }}
              className="bg-slate-800 border border-slate-700 text-cyan-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-semibold cursor-pointer max-w-xs truncate"
            >
              {TUTORIAL_24_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            NAVIGATION TABS
        ========================================================================= */}
        <div className="px-5 bg-[#121624] border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "viewport"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>1. 3D Viewport & Carving</span>
            </button>

            <button
              onClick={() => setActiveTab("cutouts")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "cutouts"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>2. Cutout Tool Manager</span>
              <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded text-[10px] font-mono">
                {project.cutouts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("vertices")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "vertices"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>3. Vertex Coordinate Table</span>
            </button>

            <button
              onClick={() => setActiveTab("roofs")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "roofs"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>4. Roof Wings & Intersections</span>
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                {project.roofs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("quantities")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "quantities"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Box className="w-4 h-4" />
              <span>5. Net Areas & Enclosed Volume</span>
            </button>
          </div>

          <div className="flex items-center gap-2 py-1.5 text-xs">
            <span className="text-slate-400">
              Net Roof: <strong className="text-cyan-300">{metrics.netRoofAreaM2} m²</strong>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Cut Void: <strong className="text-amber-300">{metrics.totalCutoutAreaM2} m²</strong>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Net Vol: <strong className="text-emerald-300">{metrics.enclosedVolumeNetM3} m³</strong>
            </span>
          </div>
        </div>

        {/* =========================================================================
            TAB CONTENT PANELS
        ========================================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* TAB 1: 3D VIEWPORT & CARVING */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Three.js Canvas */}
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <div ref={mountRef} className="w-full h-full" />

                {/* Camera View Selector HUD */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-[#0c101c]/80 backdrop-blur-md p-2 rounded-lg border border-cyan-900/40">
                  <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider mr-1">Camera:</span>
                  <button
                    onClick={() => setCameraView("perspective")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "perspective" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Perspective 3D
                  </button>
                  <button
                    onClick={() => setCameraView("top")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "top" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Top Plan 2D
                  </button>
                  <button
                    onClick={() => setCameraView("valley")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "valley" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Valley Intersection
                  </button>
                  <button
                    onClick={() => setCameraView("interior")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "interior" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Atrium Look-Up
                  </button>
                </div>

                {/* Wireframe Toggle */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0c101c]/80 backdrop-blur-md p-2 rounded-lg border border-cyan-900/40">
                  <button
                    onClick={() => setShowWireframe(!showWireframe)}
                    className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
                      showWireframe ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cutout Wireframe: {showWireframe ? "ON" : "OFF"}</span>
                  </button>
                </div>
              </div>

              {/* Viewport Side Quick Settings */}
              <div className="w-full md:w-84 bg-[#121626] border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">
                    Active Cutout Settings
                  </h3>
                  {activeCutout ? (
                    <div className="space-y-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-xs text-white font-bold block">{activeCutout.name}</span>
                        <span className="text-[11px] text-slate-400">
                          Target: {activeCutout.targetSurface.toUpperCase()} ({activeCutout.shapeType})
                        </span>
                      </div>

                      {/* Limit Cutting Depth Checkbox */}
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                          <input
                            type="checkbox"
                            checked={activeCutout.limitCuttingDepth}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setProject((prev) => ({
                                ...prev,
                                cutouts: prev.cutouts.map((c) =>
                                  c.id === activeCutout.id ? { ...c, limitCuttingDepth: checked } : c
                                ),
                              }));
                            }}
                            className="rounded border-slate-700 text-cyan-600 focus:ring-0"
                          />
                          <span className="font-semibold">Limit Cutting Depth (Schnitttiefe)</span>
                        </label>

                        {activeCutout.limitCuttingDepth && (
                          <div className="pl-6 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Depth</span>
                              <span className="text-cyan-400 font-mono font-bold">
                                {activeCutout.cuttingDepthM.toFixed(2)} m
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="2.0"
                              step="0.05"
                              value={activeCutout.cuttingDepthM}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setProject((prev) => ({
                                  ...prev,
                                  cutouts: prev.cutouts.map((c) =>
                                    c.id === activeCutout.id ? { ...c, cuttingDepthM: val } : c
                                  ),
                                }));
                              }}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-500 block">
                              Cuts only through roof slab thickness without puncturing lower storey ceiling!
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No cutout selected</span>
                  )}
                </div>

                {/* Instant Metric Summary Cards */}
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Gross Roof Area</span>
                      <strong className="text-sm text-slate-200 font-mono">{metrics.grossRoofAreaM2} m²</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Net Roof Area</span>
                      <strong className="text-sm text-cyan-300 font-mono font-bold">
                        {metrics.netRoofAreaM2} m²
                      </strong>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total Cutout Area</span>
                      <strong className="text-sm text-amber-300 font-mono font-bold">
                        {metrics.totalCutoutAreaM2} m²
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Void Fraction</span>
                      <span className="text-xs text-slate-300 font-mono font-bold">
                        {metrics.cutoutAreaPercentage}%
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Enclosed Net Volume</span>
                      <strong className="text-sm text-emerald-300 font-mono font-bold">
                        {metrics.enclosedVolumeNetM3} m³
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Gross Volume</span>
                      <span className="text-xs text-slate-400 font-mono">{metrics.enclosedVolumeGrossM3} m³</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Tutorial Tip */}
                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-xs">
                  <span className="font-bold text-cyan-300 block mb-1">DIALux evo Tutorial Tip:</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When joining perpendicular roof slopes (cross-gables), use the <strong>Polygonal Cutout</strong> along the 45° valley line to cleanly remove overlapping roof faces and prevent light leak artifacts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUTOUT TOOL MANAGER */}
          {activeTab === "cutouts" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                      <Scissors className="w-5 h-5 text-cyan-400" />
                      <span>Cutout Tool Elements & Placements</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Create polygonal, rectangular, or circular cutouts across roofs, ceilings, and walls.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const newId = `cutout_${Date.now()}`;
                      const newCut: CutoutItem = {
                        id: newId,
                        name: `Custom Polygonal Cutout #${project.cutouts.length + 1}`,
                        shapeType: "polygonal",
                        targetSurface: "roof",
                        targetElementId: project.roofs[0]?.id || "roof_main",
                        polygonPoints: [
                          { x: 0, y: 0 },
                          { x: 3, y: 0 },
                          { x: 1.5, y: 2.5 },
                        ],
                        centerPosition: { x: 4, y: 3, z: 6 },
                        limitCuttingDepth: true,
                        cuttingDepthM: 0.35,
                        rotationDegrees: 0,
                        isEnabled: true,
                        colorHex: "#38bdf8",
                      };
                      setProject((prev) => ({ ...prev, cutouts: [...prev.cutouts, newCut] }));
                      setSelectedCutoutId(newId);
                      toast.success("Created new cutout element");
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Cutout</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {project.cutouts.map((cut) => (
                    <div
                      key={cut.id}
                      onClick={() => setSelectedCutoutId(cut.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition flex flex-wrap items-center justify-between gap-4 ${
                        selectedCutoutId === cut.id
                          ? "bg-cyan-950/20 border-cyan-500 ring-1 ring-cyan-500/40"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/20 shadow-md"
                          style={{ backgroundColor: cut.colorHex }}
                        >
                          <Scissors className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-medium">{cut.name}</strong>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30 uppercase">
                              {cut.targetSurface}
                            </span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-300 rounded uppercase">
                              {cut.shapeType}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Depth: {cut.limitCuttingDepth ? `${cut.cuttingDepthM.toFixed(2)}m (Limited)` : "Full Penetration"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProject((prev) => ({
                              ...prev,
                              cutouts: prev.cutouts.map((c) =>
                                c.id === cut.id ? { ...c, isEnabled: !c.isEnabled } : c
                              ),
                            }));
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                            cut.isEnabled
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}
                        >
                          {cut.isEnabled ? "Active" : "Disabled"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProject((prev) => ({
                              ...prev,
                              cutouts: prev.cutouts.filter((c) => c.id !== cut.id),
                            }));
                            toast.info("Deleted cutout element");
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-500 border border-slate-700 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VERTEX COORDINATE TABLE */}
          {activeTab === "vertices" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    <span>Vertex Coordinates & Manipulators</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    DIALux evo Tutorial Part 24: Direct numerical table editing of polygonal cutout coordinates.
                  </p>
                </div>

                {activeCutout ? (
                  <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center text-xs">
                      <strong className="text-white">Polygon Points: {activeCutout.name}</strong>
                      <button
                        onClick={() => {
                          const pts = [...activeCutout.polygonPoints];
                          pts.push({ x: (pts[pts.length - 1]?.x || 0) + 1.0, y: pts[pts.length - 1]?.y || 0 });
                          setProject((prev) => ({
                            ...prev,
                            cutouts: prev.cutouts.map((c) =>
                              c.id === activeCutout.id ? { ...c, polygonPoints: pts } : c
                            ),
                          }));
                          toast.success("Added new polygon vertex");
                        }}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Vertex</span>
                      </button>
                    </div>

                    <table className="w-full text-xs text-left">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3">Index</th>
                          <th className="p-3">X Coordinate (m)</th>
                          <th className="p-3">Y Coordinate (m)</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {activeCutout.polygonPoints.map((pt, i) => (
                          <tr key={i}>
                            <td className="p-3 font-sans text-slate-400">P{i + 1}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                step="0.1"
                                value={pt.x}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const pts = [...activeCutout.polygonPoints];
                                  pts[i] = { ...pts[i], x: val };
                                  setProject((prev) => ({
                                    ...prev,
                                    cutouts: prev.cutouts.map((c) =>
                                      c.id === activeCutout.id ? { ...c, polygonPoints: pts } : c
                                    ),
                                  }));
                                }}
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 w-28"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                step="0.1"
                                value={pt.y}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const pts = [...activeCutout.polygonPoints];
                                  pts[i] = { ...pts[i], y: val };
                                  setProject((prev) => ({
                                    ...prev,
                                    cutouts: prev.cutouts.map((c) =>
                                      c.id === activeCutout.id ? { ...c, polygonPoints: pts } : c
                                    ),
                                  }));
                                }}
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 w-28"
                              />
                            </td>
                            <td className="p-3 text-right font-sans">
                              {activeCutout.polygonPoints.length > 3 && (
                                <button
                                  onClick={() => {
                                    const pts = activeCutout.polygonPoints.filter((_, idx) => idx !== i);
                                    setProject((prev) => ({
                                      ...prev,
                                      cutouts: prev.cutouts.map((c) =>
                                        c.id === activeCutout.id ? { ...c, polygonPoints: pts } : c
                                      ),
                                    }));
                                  }}
                                  className="text-rose-400 hover:text-rose-300 text-xs"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Select a cutout first</span>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ROOF WINGS & INTERSECTIONS */}
          {activeTab === "roofs" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <span>Roof Wings & Geometry Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Manage main roof wings, pitch angles, eave heights, and valley intersections.
                  </p>
                </div>

                <div className="space-y-4">
                  {project.roofs.map((roof) => (
                    <div
                      key={roof.id}
                      className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-sm text-white font-medium">{roof.name}</strong>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded uppercase">
                          {roof.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-1">Length (m)</span>
                          <input
                            type="number"
                            step="0.5"
                            value={roof.lengthM}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setProject((prev) => ({
                                ...prev,
                                roofs: prev.roofs.map((r) => (r.id === roof.id ? { ...r, lengthM: val } : r)),
                              }));
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono"
                          />
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-1">Width (m)</span>
                          <input
                            type="number"
                            step="0.5"
                            value={roof.widthM}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setProject((prev) => ({
                                ...prev,
                                roofs: prev.roofs.map((r) => (r.id === roof.id ? { ...r, widthM: val } : r)),
                              }));
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono"
                          />
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-1">Pitch Angle (°)</span>
                          <input
                            type="number"
                            step="1"
                            value={roof.pitchDegrees}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setProject((prev) => ({
                                ...prev,
                                roofs: prev.roofs.map((r) => (r.id === roof.id ? { ...r, pitchDegrees: val } : r)),
                              }));
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono"
                          />
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-1">Ridge Height (m)</span>
                          <input
                            type="number"
                            step="0.1"
                            value={roof.ridgeHeightM}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setProject((prev) => ({
                                ...prev,
                                roofs: prev.roofs.map((r) => (r.id === roof.id ? { ...r, ridgeHeightM: val } : r)),
                              }));
                            }}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NET AREAS & ENCLOSED VOLUME */}
          {activeTab === "quantities" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Box className="w-5 h-5 text-emerald-400" />
                    <span>Architectural Quantity Takeoff & Daylight Apertures</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Net surface areas, gross vs net volume, and daylight penetration aperture calculation.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <strong className="text-xs font-bold text-cyan-300 uppercase tracking-wider block">
                      Roof Cladding Quantities
                    </strong>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gross Pitch Surface Area:</span>
                        <strong className="text-white font-mono">{metrics.grossRoofAreaM2} m²</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Deducted Cutout Voids:</span>
                        <strong className="text-amber-400 font-mono">-{metrics.totalCutoutAreaM2} m²</strong>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-800">
                        <span className="text-slate-300 font-semibold">Net Pitch Surface Area:</span>
                        <strong className="text-cyan-300 font-mono text-base font-bold">
                          {metrics.netRoofAreaM2} m²
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <strong className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                      Building Volume & Daylighting
                    </strong>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Gross Building Volume:</span>
                        <strong className="text-white font-mono">{metrics.enclosedVolumeGrossM3} m³</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Net Enclosed Volume:</span>
                        <strong className="text-emerald-300 font-mono text-base font-bold">
                          {metrics.enclosedVolumeNetM3} m³
                        </strong>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-800">
                        <span className="text-slate-300 font-semibold">Daylight Aperture Area:</span>
                        <strong className="text-yellow-400 font-mono">
                          {metrics.daylightOpeningAreaM2} m² (+{metrics.estimatedDaylightFactorBoostPercent}% DF)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            FOOTER ACTIONS
        ========================================================================= */}
        <div className="px-5 py-3 bg-[#141b2d] border-t border-cyan-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Active Project: <strong className="text-slate-200">{project.name}</strong></span>
            <span>•</span>
            <span>{project.cutouts.length} Active Cutout Elements</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onApplyToSimulation) {
                  onApplyToSimulation(project);
                  toast.success("Applied cutout geometry to main simulation!");
                }
                onClose();
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Main Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
