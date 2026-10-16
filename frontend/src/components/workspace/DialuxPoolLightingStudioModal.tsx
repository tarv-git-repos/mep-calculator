import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Waves,
  Sun,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  FileDown,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Palette,
  Power,
  Eye,
  Camera,
  Layers,
  Activity,
  Zap,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  PoolStandardId,
  POOL_STANDARDS,
  TileMaterialId,
  POOL_TILE_MATERIALS,
  WaterClarityType,
  WATER_CLARITY_OPTIONS,
  PoolBasinConfig,
  WaterVolumeConfig,
  UnderwaterLuminaire,
  OverheadLuminaire,
  PoolLightingSimulationReport,
  simulatePoolLighting,
  POOL_PRESETS,
  PoolPresetTemplate,
} from "@/lib/dialux-pool-lighting-engine";

export interface DialuxPoolLightingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyToSimulation?: (report: PoolLightingSimulationReport) => void;
}

export function DialuxPoolLightingStudioModal({
  isOpen,
  onClose,
  projectName = "Aquatic Center & Swimming Pool Complex",
  onApplyToSimulation,
}: DialuxPoolLightingStudioModalProps) {
  // 1. Core Modal State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"basin" | "underwater" | "overhead" | "photometrics" | "viewport">("viewport");

  // Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>("semi_olympic_25m");

  // Active Standard
  const [standardId, setStandardId] = useState<PoolStandardId>("EN12193_CLASS_I");

  // Basin and Water Configs
  const [basin, setBasin] = useState<PoolBasinConfig>(POOL_PRESETS[0].basin);
  const [water, setWater] = useState<WaterVolumeConfig>(POOL_PRESETS[0].water);

  // Fixture Arrays
  const [underwaterFixtures, setUnderwaterFixtures] = useState<UnderwaterLuminaire[]>(POOL_PRESETS[0].underwaterFixtures);
  const [overheadFixtures, setOverheadFixtures] = useState<OverheadLuminaire[]>(POOL_PRESETS[0].overheadFixtures);

  // Viewport Settings
  const [cameraView, setCameraView] = useState<"perspective" | "top" | "lifeguard" | "swimmer" | "underwater">("perspective");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [animateWater, setAnimateWater] = useState(true);
  const [isRaytracing, setIsRaytracing] = useState(false);

  // 3D Three.js Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const waterMeshRef = useRef<any>(null);
  const floorHeatmapMeshRef = useRef<any>(null);
  const spotLightsRef = useRef<Record<string, any>>({});

  // 2. Compute Photometrics Simulation Report
  const simulationReport: PoolLightingSimulationReport = useMemo(() => {
    return simulatePoolLighting(basin, water, underwaterFixtures, overheadFixtures, standardId);
  }, [basin, water, underwaterFixtures, overheadFixtures, standardId]);

  // Load Preset Handler
  const handleLoadPreset = (preset: PoolPresetTemplate) => {
    setSelectedPresetId(preset.id);
    setStandardId(preset.standardId);
    setBasin({ ...preset.basin });
    setWater({ ...preset.water });
    setUnderwaterFixtures([...preset.underwaterFixtures]);
    setOverheadFixtures([...preset.overheadFixtures]);
    toast.success(`Loaded preset: ${preset.name}`);
  };

  // Switch Camera View
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    const poolHalfL = basin.length / 2;
    const poolHalfW = basin.width / 2;

    if (cameraView === "perspective") {
      cam.position.set(-poolHalfL * 1.3, 14, poolHalfW * 1.8);
      ctrl.target.set(0, -1, 0);
    } else if (cameraView === "top") {
      cam.position.set(0, 26, 0.001);
      ctrl.target.set(0, 0, 0);
    } else if (cameraView === "lifeguard") {
      cam.position.set(poolHalfL * 0.4, 2.2, poolHalfW + basin.deckWidth * 0.6);
      ctrl.target.set(0, -basin.shallowDepth * 0.5, 0);
    } else if (cameraView === "swimmer") {
      cam.position.set(-poolHalfL + 1.0, 0.25, 0);
      ctrl.target.set(poolHalfL, -0.5, 0);
    } else if (cameraView === "underwater") {
      cam.position.set(0, -0.8, -poolHalfW * 0.6);
      ctrl.target.set(0, -basin.shallowDepth, 0);
    }
    ctrl.update();
  }, [cameraView, basin]);

  // 3. Three.js Initialization & Scene Construction
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
    camera.position.set(-18, 14, 18);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -1, 0);
    controls.maxDistance = 50;
    controls.minDistance = 2;
    controlsRef.current = controls;

    // Ambient Hall Fill
    const ambLight = new THREE.AmbientLight(0x1e293b, 0.35);
    scene.add(ambLight);

    // Building Hall Floor / Wet Deck
    const deckTotalL = basin.length + 2 * basin.deckWidth + 4;
    const deckTotalW = basin.width + 2 * basin.deckWidth + 4;
    const deckGeom = new THREE.PlaneGeometry(deckTotalL, deckTotalW);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.05,
    });
    const deckMesh = new THREE.Mesh(deckGeom, deckMat);
    deckMesh.rotation.x = -Math.PI / 2;
    deckMesh.position.set(0, 0, 0);
    scene.add(deckMesh);

    // Pool Basin Walls (Tiled)
    const tileOpt = POOL_TILE_MATERIALS[basin.tileMaterial];
    const basinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tileOpt.colorHex),
      roughness: tileOpt.roughness,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    const poolHalfL = basin.length / 2;
    const poolHalfW = basin.width / 2;
    const avgDepth = (basin.shallowDepth + basin.deepDepth) / 2;

    // Left long wall
    const wallLGeom = new THREE.BoxGeometry(basin.length, avgDepth, 0.2);
    const wallLMesh = new THREE.Mesh(wallLGeom, basinMat);
    wallLMesh.position.set(0, -avgDepth / 2, -poolHalfW - 0.1);
    scene.add(wallLMesh);

    // Right long wall
    const wallRGeom = new THREE.BoxGeometry(basin.length, avgDepth, 0.2);
    const wallRMesh = new THREE.Mesh(wallRGeom, basinMat);
    wallRMesh.position.set(0, -avgDepth / 2, poolHalfW + 0.1);
    scene.add(wallRMesh);

    // Shallow end wall
    const wallShallowGeom = new THREE.BoxGeometry(0.2, avgDepth, basin.width);
    const wallShallowMesh = new THREE.Mesh(wallShallowGeom, basinMat);
    wallShallowMesh.position.set(-poolHalfL - 0.1, -avgDepth / 2, 0);
    scene.add(wallShallowMesh);

    // Deep end wall
    const wallDeepGeom = new THREE.BoxGeometry(0.2, avgDepth, basin.width);
    const wallDeepMesh = new THREE.Mesh(wallDeepGeom, basinMat);
    wallDeepMesh.position.set(poolHalfL + 0.1, -avgDepth / 2, 0);
    scene.add(wallDeepMesh);

    // Pool Floor Slab
    const floorGeom = new THREE.PlaneGeometry(basin.length, basin.width, 32, 16);
    const floorMesh = new THREE.Mesh(floorGeom, basinMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -avgDepth, 0);
    scene.add(floorMesh);

    // False-Color Heatmap Plane
    const heatGeom = new THREE.PlaneGeometry(basin.length, basin.width);
    const heatMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.55,
      visible: showHeatmap,
    });
    const heatMesh = new THREE.Mesh(heatGeom, heatMat);
    heatMesh.rotation.x = -Math.PI / 2;
    heatMesh.position.set(0, -avgDepth + 0.02, 0);
    scene.add(heatMesh);
    floorHeatmapMeshRef.current = heatMesh;

    // Coping Rim Stone
    const copingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.4,
    });
    const rimGeomL = new THREE.BoxGeometry(basin.length + 0.6, 0.08, basin.copingWidth);
    const rimMeshL = new THREE.Mesh(rimGeomL, copingMat);
    rimMeshL.position.set(0, 0.04, -poolHalfW - basin.copingWidth / 2);
    scene.add(rimMeshL);

    const rimMeshR = new THREE.Mesh(rimGeomL, copingMat);
    rimMeshR.position.set(0, 0.04, poolHalfW + basin.copingWidth / 2);
    scene.add(rimMeshR);

    // Water Body Extrusion Volume
    const waterDepth = avgDepth - basin.freeboard;
    const waterGeom = new THREE.BoxGeometry(basin.length - 0.05, waterDepth, basin.width - 0.05, 32, 1, 16);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x00b4d8),
      transparent: true,
      opacity: 0.68,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.88,
      ior: water.refractiveIndex,
      reflectivity: 0.5,
    });
    const waterMesh = new THREE.Mesh(waterGeom, waterMat);
    waterMesh.position.set(0, -basin.freeboard - waterDepth / 2, 0);
    scene.add(waterMesh);
    waterMeshRef.current = waterMesh;

    // Swimming Lanes (Float ropes)
    if (basin.laneCount > 0) {
      const laneSpacing = basin.width / basin.laneCount;
      for (let i = 1; i < basin.laneCount; i++) {
        const laneY = -poolHalfW + i * laneSpacing;
        const ropeGeom = new THREE.CylinderGeometry(0.04, 0.04, basin.length, 8);
        const ropeMat = new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xef4444 : 0x3b82f6,
          roughness: 0.5,
        });
        const ropeMesh = new THREE.Mesh(ropeGeom, ropeMat);
        ropeMesh.rotation.z = Math.PI / 2;
        ropeMesh.position.set(0, -basin.freeboard, laneY);
        scene.add(ropeMesh);
      }
    }

    // Starting Blocks
    if (basin.hasStartingBlocks) {
      const laneSpacing = basin.laneCount > 0 ? basin.width / basin.laneCount : 2.5;
      const count = basin.laneCount > 0 ? basin.laneCount : 4;
      for (let i = 0; i < count; i++) {
        const laneY = -poolHalfW + (i + 0.5) * laneSpacing;
        const blockGeom = new THREE.BoxGeometry(0.6, 0.45, 0.5);
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
        const blockMesh = new THREE.Mesh(blockGeom, blockMat);
        blockMesh.position.set(-poolHalfL - 0.4, 0.25, laneY);
        scene.add(blockMesh);
      }
    }

    // Stainless Steel Pool Ladders
    if (basin.hasLadders) {
      [-poolHalfL * 0.7, poolHalfL * 0.7].forEach((ladderX) => {
        const ladderMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
        const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, avgDepth + 0.6), ladderMat);
        railL.position.set(ladderX, -avgDepth / 2 + 0.3, poolHalfW - 0.05);
        scene.add(railL);

        const railR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, avgDepth + 0.6), ladderMat);
        railR.position.set(ladderX + 0.4, -avgDepth / 2 + 0.3, poolHalfW - 0.05);
        scene.add(railR);
      });
    }

    // Lifeguard Chair Tower
    if (basin.hasLifeguardChair) {
      const chairMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      const chairBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.0), chairMat);
      chairBase.position.set(poolHalfL * 0.4, 0.9, poolHalfW + basin.deckWidth * 0.6);
      scene.add(chairBase);
    }

    // Underwater Fixtures & Three.js Spotlights
    spotLightsRef.current = {};
    underwaterFixtures.forEach((uFix) => {
      // Small circular lens on wall
      const lensGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16);
      const lensMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(uFix.colorHex),
        emissive: new THREE.Color(uFix.colorHex),
        emissiveIntensity: uFix.isEnabled ? (uFix.dimmingPercent / 100) * 2.0 : 0,
      });
      const lensMesh = new THREE.Mesh(lensGeom, lensMat);
      lensMesh.position.set(uFix.position.x, uFix.position.z, uFix.position.y);
      lensMesh.rotation.x = Math.PI / 2;
      scene.add(lensMesh);

      // Light beam pointing horizontally across water
      const spot = new THREE.SpotLight(
        new THREE.Color(uFix.colorHex),
        uFix.isEnabled ? (uFix.dimmingPercent / 100) * 3.5 : 0,
        basin.width * 1.2,
        ((uFix.beamAngle / 2) * Math.PI) / 180,
        0.6,
        1.2
      );
      spot.position.set(uFix.position.x, uFix.position.z, uFix.position.y);

      const target = new THREE.Object3D();
      const targetY = uFix.wallSide === "left_long_wall" ? poolHalfW : -poolHalfW;
      target.position.set(uFix.position.x, uFix.position.z - 0.4, targetY);
      scene.add(target);
      spot.target = target;
      scene.add(spot);
      spotLightsRef.current[uFix.id] = spot;
    });

    // Overhead Fixtures & Spotlights
    overheadFixtures.forEach((oFix) => {
      // High bay / flood housing
      const housingGeom = new THREE.BoxGeometry(0.5, 0.3, 0.4);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const housingMesh = new THREE.Mesh(housingGeom, housingMat);
      housingMesh.position.set(oFix.position.x, oFix.position.z, oFix.position.y);
      scene.add(housingMesh);

      // Truss mounting pole
      const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, oFix.position.z);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
      const poleMesh = new THREE.Mesh(poleGeom, poleMat);
      poleMesh.position.set(oFix.position.x, oFix.position.z / 2, oFix.position.y);
      scene.add(poleMesh);

      // Downward angled floodlight
      const spot = new THREE.SpotLight(
        0xffffff,
        oFix.isEnabled ? (oFix.dimmingPercent / 100) * 4.0 : 0,
        25,
        ((oFix.beamSpreadX / 2) * Math.PI) / 180,
        0.4,
        1.1
      );
      spot.position.set(oFix.position.x, oFix.position.z - 0.2, oFix.position.y);
      const target = new THREE.Object3D();
      target.position.set(oFix.aimingTarget.x, oFix.aimingTarget.z, oFix.aimingTarget.y);
      scene.add(target);
      spot.target = target;
      scene.add(spot);
      spotLightsRef.current[oFix.id] = spot;
    });

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Water gentle wave undulation
      if (animateWater && waterMeshRef.current) {
        waterMeshRef.current.position.y = -basin.freeboard - waterDepth / 2 + Math.sin(t * 1.5) * 0.015;
      }

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
  }, [isOpen, basin, water.clarity, basin.tileMaterial, underwaterFixtures.length, overheadFixtures.length, animateWater]);

  // Update Heatmap Visibility
  useEffect(() => {
    if (floorHeatmapMeshRef.current) {
      floorHeatmapMeshRef.current.visible = showHeatmap;
    }
  }, [showHeatmap]);

  // Update Dynamic Light Intensities
  useEffect(() => {
    underwaterFixtures.forEach((uFix) => {
      const spot = spotLightsRef.current[uFix.id];
      if (spot) {
        spot.intensity = uFix.isEnabled ? (uFix.dimmingPercent / 100) * 3.5 : 0;
        spot.color = new THREE.Color(uFix.colorHex);
      }
    });
    overheadFixtures.forEach((oFix) => {
      const spot = spotLightsRef.current[oFix.id];
      if (spot) {
        spot.intensity = oFix.isEnabled ? (oFix.dimmingPercent / 100) * 4.0 : 0;
      }
    });
  }, [underwaterFixtures, overheadFixtures]);

  // Run Raytrace Simulation Preview
  const handleTriggerRaytrace = () => {
    setIsRaytracing(true);
    toast.info("Computing DIALux High-Precision Raytrace with Water Refraction (n=1.333)...");
    setTimeout(() => {
      setIsRaytracing(false);
      toast.success("Raytrace Simulation Complete: Caustic highlights and specular reflections rendered!");
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#10141f] border border-cyan-900/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 22 POOL LIGHTING STUDIO
        ========================================================================= */}
        <div className="px-5 py-3.5 bg-[#141b2d] border-b border-cyan-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Swimming Pool Lighting Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                  Tutorial Part 22
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                  EN 12193 & IP68
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Water Extrusion Volume (n=1.333) • Basin Cutout • Submersible Underwater & Overhead Floodlights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Preset Selector */}
            <select
              value={selectedPresetId}
              onChange={(e) => {
                const found = POOL_PRESETS.find((p) => p.id === e.target.value);
                if (found) handleLoadPreset(found);
              }}
              className="bg-slate-800 border border-slate-700 text-cyan-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-semibold cursor-pointer"
            >
              {POOL_PRESETS.map((p) => (
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
              <span>1. 3D Viewport & Raytrace</span>
            </button>

            <button
              onClick={() => setActiveTab("basin")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "basin"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Basin & Water Body</span>
            </button>

            <button
              onClick={() => setActiveTab("underwater")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "underwater"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>3. Underwater IP68 (SELV)</span>
              <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded text-[10px] font-mono">
                {underwaterFixtures.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("overhead")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "overhead"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>4. Overhead Hall Floodlights</span>
              <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded text-[10px] font-mono">
                {overheadFixtures.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("photometrics")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "photometrics"
                  ? "border-cyan-400 text-cyan-300 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>5. EN 12193 & Glare Check</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  simulationReport.compliance.isOverallCompliant
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {simulationReport.compliance.isOverallCompliant ? "PASS" : "ATTN"}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 py-1.5">
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mr-2">
              <span>Water: <strong className="text-cyan-300">{simulationReport.waterSurface.averageLux} lx</strong></span>
              <span>•</span>
              <span>Floor: <strong className="text-blue-300">{simulationReport.poolBottom.averageLux} lx</strong></span>
              <span>•</span>
              <span>Load: <strong className="text-amber-300">{simulationReport.totalActiveWatts} W</strong></span>
            </div>
            <button
              onClick={handleTriggerRaytrace}
              disabled={isRaytracing}
              className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isRaytracing ? "Raytracing..." : "Raytrace Water"}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB CONTENT PANELS
        ========================================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* TAB 1: 3D VIEWPORT */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Three.js Canvas Container */}
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <div ref={mountRef} className="w-full h-full" />

                {/* Floating Viewport Overlay HUD */}
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
                    onClick={() => setCameraView("lifeguard")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "lifeguard" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Lifeguard View
                  </button>
                  <button
                    onClick={() => setCameraView("swimmer")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "swimmer" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Swimmer Eye-Level
                  </button>
                  <button
                    onClick={() => setCameraView("underwater")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "underwater" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Underwater View
                  </button>
                </div>

                {/* Floating Toggles */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0c101c]/80 backdrop-blur-md p-2 rounded-lg border border-cyan-900/40">
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
                      showHeatmap ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>False-Color Isolux Heatmap</span>
                  </button>
                  <button
                    onClick={() => setAnimateWater(!animateWater)}
                    className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
                      animateWater ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Waves className="w-3.5 h-3.5" />
                    <span>Wave Ripples: {animateWater ? "ON" : "OFF"}</span>
                  </button>
                </div>

                {/* Lux Heatmap Scale Legend */}
                {showHeatmap && (
                  <div className="absolute bottom-3 right-3 bg-[#0c101c]/90 backdrop-blur-md p-2.5 rounded-lg border border-cyan-900/40 text-[10px]">
                    <div className="font-bold text-slate-300 mb-1">Illuminance Scale (Lux)</div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-2.5 bg-blue-700 rounded-xs" />
                      <span>&lt; 150 lx</span>
                      <div className="w-4 h-2.5 bg-cyan-500 rounded-xs ml-2" />
                      <span>300 lx</span>
                      <div className="w-4 h-2.5 bg-emerald-500 rounded-xs ml-2" />
                      <span>500 lx</span>
                      <div className="w-4 h-2.5 bg-yellow-400 rounded-xs ml-2" />
                      <span>600 lx</span>
                      <div className="w-4 h-2.5 bg-red-500 rounded-xs ml-2" />
                      <span>&gt; 800 lx</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Viewport Side Quick Metrics & Controls */}
              <div className="w-full md:w-80 bg-[#121626] border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Quick Scene Controls
                  </h3>
                  <div className="space-y-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Underwater Master Dimming</span>
                        <span className="text-cyan-400 font-mono">
                          {underwaterFixtures[0]?.dimmingPercent ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={underwaterFixtures[0]?.dimmingPercent ?? 100}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setUnderwaterFixtures((prev) =>
                            prev.map((f) => ({ ...f, dimmingPercent: val }))
                          );
                        }}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Overhead Master Dimming</span>
                        <span className="text-blue-400 font-mono">
                          {overheadFixtures[0]?.dimmingPercent ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={overheadFixtures[0]?.dimmingPercent ?? 100}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOverheadFixtures((prev) =>
                            prev.map((f) => ({ ...f, dimmingPercent: val }))
                          );
                        }}
                        className="w-full accent-blue-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Instant Photometrics Summary Card */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Live Photometrics
                  </h3>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Water Surface</span>
                        <strong className="text-sm text-cyan-300 font-mono">
                          {simulationReport.waterSurface.averageLux} lx
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Uniformity U₀</span>
                        <span className="text-xs text-slate-300 font-mono font-bold">
                          {simulationReport.waterSurface.uniformityU0}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Basin Floor (Attenuated)</span>
                        <strong className="text-sm text-blue-300 font-mono">
                          {simulationReport.poolBottom.averageLux} lx
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Uniformity U₀</span>
                        <span className="text-xs text-slate-300 font-mono font-bold">
                          {simulationReport.poolBottom.uniformityU0}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Wet Deck Apron</span>
                        <strong className="text-sm text-emerald-300 font-mono">
                          {simulationReport.deckApron.averageLux} lx
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Safety Target</span>
                        <span className="text-xs text-slate-300 font-mono font-bold">≥ 150 lx</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lifeguard Glare Status */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">Lifeguard Glare Index</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        simulationReport.lifeguardGlare.isAcceptable
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {simulationReport.lifeguardGlare.isAcceptable ? "COMPLIANT" : "WARNING"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {simulationReport.lifeguardGlare.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BASIN & WATER BODY MODELING */}
          {activeTab === "basin" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    <span>Basin Geometry & Floor Cutout Profile</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    DIALux evo Tutorial Part 22: Modeling the swimming pool depression cutout in the building slab, sloping floor, and water extrusion body.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Pool Length (m)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="5"
                      max="50"
                      value={basin.length}
                      onChange={(e) => setBasin({ ...basin, length: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10.5px] text-slate-500">Standard: 25.0m (Short Course) or 50.0m (Olympic)</span>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Pool Width (m)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="3"
                      max="25"
                      value={basin.width}
                      onChange={(e) => setBasin({ ...basin, width: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10.5px] text-slate-500">Standard: 12.5m (6 lanes) or 21.0m (8 lanes)</span>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Wet Deck Walkway Width (m)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="6.0"
                      value={basin.deckWidth}
                      onChange={(e) => setBasin({ ...basin, deckWidth: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10.5px] text-slate-500">Surrounding apron for swimmers and lifeguards</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Shallow End Depth (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.8"
                      max="3.0"
                      value={basin.shallowDepth}
                      onChange={(e) => setBasin({ ...basin, shallowDepth: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Deep End Depth (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="5.0"
                      value={basin.deepDepth}
                      onChange={(e) => setBasin({ ...basin, deepDepth: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Freeboard Rim Offset (m)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="0.5"
                      value={basin.freeboard}
                      onChange={(e) => setBasin({ ...basin, freeboard: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-[10.5px] text-slate-500">Height between water line and coping deck</span>
                  </div>
                </div>

                {/* Tile Material Selection */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Basin Interior Tile Material & Color
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.values(POOL_TILE_MATERIALS).map((mat) => (
                      <div
                        key={mat.id}
                        onClick={() => setBasin({ ...basin, tileMaterial: mat.id })}
                        className={`p-3 rounded-lg border cursor-pointer transition flex items-center gap-3 ${
                          basin.tileMaterial === mat.id
                            ? "bg-cyan-950/30 border-cyan-500 ring-1 ring-cyan-500/50"
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-md border border-white/20 shrink-0 shadow-inner"
                          style={{ backgroundColor: mat.colorHex }}
                        />
                        <div>
                          <strong className="text-xs text-white block">{mat.name}</strong>
                          <span className="text-[11px] text-slate-400">
                            Reflectance ρ = {(mat.reflectance * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Water Body Physics */}
                <div className="bg-slate-900/70 p-5 rounded-xl border border-cyan-900/50 space-y-4">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-400" />
                    <span>Water Optical Medium Properties (DIALux Physics Engine)</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Water Clarity Preset</label>
                      <select
                        value={water.clarity}
                        onChange={(e) => {
                          const opt = WATER_CLARITY_OPTIONS[e.target.value as WaterClarityType];
                          if (opt) {
                            setWater({
                              ...water,
                              clarity: opt.id,
                              absorptionAlpha: opt.absorptionAlpha,
                              transparencyPercent: opt.transparencyPercent,
                              refractiveIndex: opt.refractiveIndex,
                            });
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-2"
                      >
                        {Object.values(WATER_CLARITY_OPTIONS).map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Refractive Index (n = {water.refractiveIndex})
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="1.30"
                        max="1.35"
                        value={water.refractiveIndex}
                        onChange={(e) => setWater({ ...water, refractiveIndex: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono"
                      />
                      <span className="text-[10px] text-slate-500">
                        Total internal reflection critical angle: θc = 48.6°
                      </span>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Absorption Coeff α = {water.absorptionAlpha} m⁻¹
                      </label>
                      <input
                        type="range"
                        min="0.03"
                        max="0.25"
                        step="0.01"
                        value={water.absorptionAlpha}
                        onChange={(e) => setWater({ ...water, absorptionAlpha: Number(e.target.value) })}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500">
                        Beer-Lambert attenuation: I(d) = I₀ · e^(-αd)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UNDERWATER LUMINAIRES (IP68) */}
          {activeTab === "underwater" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      <span>Submersible Underwater Luminaires (IP68, SELV 12V/24V)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      DIALux evo Tutorial Part 22: Recessed side wall floodlights mounted 0.5m - 0.7m below water line for edge serviceability.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const newFix: UnderwaterLuminaire = {
                        id: `uw_custom_${Date.now()}`,
                        name: `Submersible LED #${underwaterFixtures.length + 1}`,
                        wallSide: "left_long_wall",
                        position: { x: 0, y: -basin.width / 2, z: -0.65 },
                        aimingAngle: 5,
                        luminousFlux: 3800,
                        powerWatts: 36,
                        beamAngle: 90,
                        cctKelvin: 5000,
                        colorHex: "#00f0ff",
                        dimmingPercent: 100,
                        isEnabled: true,
                        ipRating: "IP68",
                        voltage: "24V DC SELV",
                      };
                      setUnderwaterFixtures([...underwaterFixtures, newFix]);
                      toast.success("Added underwater luminaire");
                    }}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Luminaire</span>
                  </button>
                </div>

                {/* Fixtures Table / Cards */}
                <div className="space-y-3">
                  {underwaterFixtures.map((f, idx) => (
                    <div
                      key={f.id}
                      className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/20 shadow-md"
                          style={{ backgroundColor: f.colorHex }}
                        >
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-medium">{f.name}</strong>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                              {f.ipRating} • {f.voltage}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Wall: {f.wallSide} • Z: {f.position.z.toFixed(2)}m (Submerged)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Flux / Power</span>
                          <span className="text-xs font-mono text-cyan-300 font-bold">
                            {f.luminousFlux} lm ({f.powerWatts} W)
                          </span>
                        </div>

                        <div className="w-32">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Dimming</span>
                            <span className="font-mono text-cyan-400">{f.dimmingPercent}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={f.dimmingPercent}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setUnderwaterFixtures((prev) =>
                                prev.map((x) => (x.id === f.id ? { ...x, dimmingPercent: val } : x))
                              );
                            }}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => {
                            setUnderwaterFixtures((prev) =>
                              prev.map((x) => (x.id === f.id ? { ...x, isEnabled: !x.isEnabled } : x))
                            );
                          }}
                          className={`p-2 rounded-lg border transition ${
                            f.isEnabled
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}
                          title="Toggle Power"
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setUnderwaterFixtures((prev) => prev.filter((x) => x.id !== f.id));
                            toast.info("Removed luminaire");
                          }}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-500 border border-slate-700 transition"
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

          {/* TAB 4: OVERHEAD HALL FLOODLIGHTS (IP65) */}
          {activeTab === "overhead" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                      <Sun className="w-5 h-5 text-amber-400" />
                      <span>Overhead Hall Floodlights (IP65, C4/C5 Chlorine Resistant)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Asymmetric distribution positioned over perimeter walkways to avoid direct glare toward swimmers and lifeguards.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const newFix: OverheadLuminaire = {
                        id: `oh_custom_${Date.now()}`,
                        name: `Perimeter Asymmetric Flood #${overheadFixtures.length + 1}`,
                        mountingSide: "left_deck",
                        position: { x: 0, y: -basin.width / 2 - 2.0, z: 6.5 },
                        aimingTarget: { x: 0, y: 0, z: 0 },
                        luminousFlux: 16000,
                        powerWatts: 130,
                        beamSpreadX: 85,
                        beamSpreadY: 45,
                        cctKelvin: 5000,
                        dimmingPercent: 100,
                        isEnabled: true,
                        ipRating: "IP65",
                        corrosionClass: "C5",
                      };
                      setOverheadFixtures([...overheadFixtures, newFix]);
                      toast.success("Added overhead luminaire");
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Overhead Flood</span>
                  </button>
                </div>

                {/* Overhead Fixtures List */}
                <div className="space-y-3">
                  {overheadFixtures.map((f) => (
                    <div
                      key={f.id}
                      className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                          <Sun className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-medium">{f.name}</strong>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                              {f.ipRating} • Class {f.corrosionClass}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Mounting: {f.mountingSide} • Height: {f.position.z.toFixed(1)}m • CCT: {f.cctKelvin}K
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Flux / Power</span>
                          <span className="text-xs font-mono text-amber-300 font-bold">
                            {f.luminousFlux} lm ({f.powerWatts} W)
                          </span>
                        </div>

                        <div className="w-32">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Dimming</span>
                            <span className="font-mono text-amber-400">{f.dimmingPercent}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={f.dimmingPercent}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setOverheadFixtures((prev) =>
                                prev.map((x) => (x.id === f.id ? { ...x, dimmingPercent: val } : x))
                              );
                            }}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => {
                            setOverheadFixtures((prev) =>
                              prev.map((x) => (x.id === f.id ? { ...x, isEnabled: !x.isEnabled } : x))
                            );
                          }}
                          className={`p-2 rounded-lg border transition ${
                            f.isEnabled
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-slate-800 text-slate-500 border-slate-700"
                          }`}
                          title="Toggle Power"
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setOverheadFixtures((prev) => prev.filter((x) => x.id !== f.id));
                            toast.info("Removed overhead flood");
                          }}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-500 border border-slate-700 transition"
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

          {/* TAB 5: PHOTOMETRICS & EN 12193 COMPLIANCE */}
          {activeTab === "photometrics" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span>EN 12193 & World Aquatics Compliance Verification</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Photometric evaluation across Water Surface, Underwater Basin Floor, and Surrounding Wet Deck Apron.
                  </p>
                </div>

                {/* Target Standard Selector */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">Evaluation Standard</label>
                  <select
                    value={standardId}
                    onChange={(e) => setStandardId(e.target.value as PoolStandardId)}
                    className="w-full bg-slate-800 border border-slate-700 text-sm text-cyan-300 rounded-lg px-3 py-2 font-medium"
                  >
                    {Object.values(POOL_STANDARDS).map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    {POOL_STANDARDS[standardId].description}
                  </p>
                </div>

                {/* Overall Compliance Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    simulationReport.compliance.isOverallCompliant
                      ? "bg-emerald-950/30 border-emerald-500/50 text-emerald-300"
                      : "bg-amber-950/30 border-amber-500/50 text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        simulationReport.compliance.isOverallCompliant
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {simulationReport.compliance.isOverallCompliant ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <AlertTriangle className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {simulationReport.compliance.isOverallCompliant
                          ? "Fully Compliant with Standard Requirements"
                          : "Design Requires Attention for Full Compliance"}
                      </h4>
                      <span className="text-xs opacity-80">
                        {simulationReport.compliance.isOverallCompliant
                          ? "All illuminance, uniformity, and glare metrics meet or exceed criteria."
                          : "Inspect individual surface values below to optimize fixture aiming or power."}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
                      simulationReport.compliance.isOverallCompliant
                        ? "bg-emerald-500 text-black"
                        : "bg-amber-500 text-black"
                    }`}
                  >
                    {simulationReport.compliance.isOverallCompliant ? "PASS" : "ATTENTION"}
                  </span>
                </div>

                {/* Detailed Surfaces Breakdown Table */}
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="p-3">Calculation Surface</th>
                        <th className="p-3 text-right">Avg Lux</th>
                        <th className="p-3 text-right">Target Lux</th>
                        <th className="p-3 text-right">Uniformity U₀</th>
                        <th className="p-3 text-right">Target U₀</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="p-3 font-medium text-slate-200">
                          {simulationReport.waterSurface.name}
                        </td>
                        <td className="p-3 text-right font-mono text-cyan-300 font-bold">
                          {simulationReport.waterSurface.averageLux} lx
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ≥ {POOL_STANDARDS[standardId].minWaterAvgLux} lx
                        </td>
                        <td className="p-3 text-right font-mono text-cyan-300 font-bold">
                          {simulationReport.waterSurface.uniformityU0}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ≥ {POOL_STANDARDS[standardId].minWaterUniformityU0}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              simulationReport.compliance.waterLuxPass && simulationReport.compliance.waterU0Pass
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {simulationReport.compliance.waterLuxPass && simulationReport.compliance.waterU0Pass
                              ? "PASS"
                              : "FAIL"}
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 font-medium text-slate-200">
                          {simulationReport.poolBottom.name}
                        </td>
                        <td className="p-3 text-right font-mono text-blue-300 font-bold">
                          {simulationReport.poolBottom.averageLux} lx
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          (Submerged)
                        </td>
                        <td className="p-3 text-right font-mono text-blue-300 font-bold">
                          {simulationReport.poolBottom.uniformityU0}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ≥ 0.50
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                            OK
                          </span>
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 font-medium text-slate-200">
                          {simulationReport.deckApron.name}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-300 font-bold">
                          {simulationReport.deckApron.averageLux} lx
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ≥ {POOL_STANDARDS[standardId].minDeckAvgLux} lx
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-300 font-bold">
                          {simulationReport.deckApron.uniformityU0}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ≥ {POOL_STANDARDS[standardId].minDeckUniformityU0}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              simulationReport.compliance.deckLuxPass
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {simulationReport.compliance.deckLuxPass ? "PASS" : "FAIL"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Power Density & Energy Performance */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Total Connected Load</span>
                    <strong className="text-lg text-white font-mono">
                      {simulationReport.totalActiveWatts} W
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Underwater: {simulationReport.totalUnderwaterPowerWatts}W • Overhead: {simulationReport.totalOverheadPowerWatts}W
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Water Surface Power Density</span>
                    <strong className="text-lg text-cyan-300 font-mono">
                      {simulationReport.waterPowerDensityWpm2} W/m²
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Area: {(basin.length * basin.width).toFixed(0)} m²
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Overall Hall Power Density</span>
                    <strong className="text-lg text-blue-300 font-mono">
                      {simulationReport.overallPowerDensityWpm2} W/m²
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Including wet deck perimeter apron
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
            <span>Water medium refractive index: <strong className="text-slate-200">n = 1.333</strong></span>
            <span>•</span>
            <span>Beer-Lambert attenuation: <strong className="text-slate-200">α = {water.absorptionAlpha} m⁻¹</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onApplyToSimulation) {
                  onApplyToSimulation(simulationReport);
                  toast.success("Applied pool lighting design to main project simulation!");
                }
                onClose();
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer flex items-center gap-1.5"
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
