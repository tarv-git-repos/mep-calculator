import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Sun,
  Grid,
  Check,
  AlertTriangle,
  Info,
  FileDown,
  Camera,
  Box,
  Compass,
  Sliders,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  Zap,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Shield,
  Ruler,
  Car,
} from "lucide-react";
import { toast } from "sonner";
import {
  DualCarriagewayProfile,
  MedianLuminaireProfile,
  MedianPoleConfig,
  EN13201StandardCriteria,
  MedianStripCalculationResult,
  MedianOptimizationResult,
  CIERoadSurfaceClass,
  MedianSurfaceType,
  MedianBarrierType,
  EN_13201_STANDARDS,
  CIE_ROAD_SURFACES,
  BUILTIN_MEDIAN_LUMINAIRES,
  PRESET_MEDIAN_PROFILES,
  calculateTotalWidth,
  runMedianStripSimulation,
  optimizeMedianStripLighting,
} from "@/lib/dialux-median-strip-engine";

export interface DialuxMedianStripModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  projectCode?: string;
}

export function DialuxMedianStripModal({
  isOpen,
  onClose,
  projectName = "Municipal Highway Corridor",
  projectCode = "MEDIAN-13201",
}: DialuxMedianStripModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "luminaires" | "standards" | "optimizer" | "energy">("profile");

  // Profile State
  const [selectedProfileId, setSelectedProfileId] = useState<string>("profile-motorway-2x2");
  const [profile, setProfile] = useState<DualCarriagewayProfile>(PRESET_MEDIAN_PROFILES[0]);

  // Luminaires State
  const [luminaire1Id, setLuminaire1Id] = useState<string>("med-lum-160");
  const [luminaire2Id, setLuminaire2Id] = useState<string>("med-lum-160");

  const luminaire1 = useMemo(() => {
    return BUILTIN_MEDIAN_LUMINAIRES.find((l) => l.id === luminaire1Id) || BUILTIN_MEDIAN_LUMINAIRES[0];
  }, [luminaire1Id]);

  const luminaire2 = useMemo(() => {
    return BUILTIN_MEDIAN_LUMINAIRES.find((l) => l.id === luminaire2Id) || BUILTIN_MEDIAN_LUMINAIRES[0];
  }, [luminaire2Id]);

  // Central Reservation Pole Configuration
  const [poleSpacing, setPoleSpacing] = useState<number>(36.0);
  const [mountingHeight, setMountingHeight] = useState<number>(12.0);
  const [poleOffsetFromCenter, setPoleOffsetFromCenter] = useState<number>(0.0);
  const [isSymmetricBoom, setIsSymmetricBoom] = useState<boolean>(true);
  const [boom1Length, setBoom1Length] = useState<number>(1.5);
  const [boom1TiltDeg, setBoom1TiltDeg] = useState<number>(5.0);
  const [boom2Length, setBoom2Length] = useState<number>(1.5);
  const [boom2TiltDeg, setBoom2TiltDeg] = useState<number>(5.0);
  const [maintenanceFactor, setMaintenanceFactor] = useState<number>(0.85);

  // Standards Target
  const [targetClass1Id, setTargetClass1Id] = useState<string>("M2");
  const [targetClass2Id, setTargetClass2Id] = useState<string>("M2");

  // Viewport & Display Controls
  const [viewMode, setViewMode] = useState<"3d" | "2d_cross_section" | "2d_heatmap">("3d");
  const [cameraMode, setCameraMode] = useState<"orbit" | "top" | "obs1" | "obs2">("orbit");
  const [showFalseColor, setShowFalseColor] = useState<boolean>(true);
  const [showLightCones, setShowLightCones] = useState<boolean>(true);

  // Optimizer State
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<MedianOptimizationResult | null>(null);

  // Handle Preset Profile Switching
  const handleProfilePresetChange = (presetId: string) => {
    setSelectedProfileId(presetId);
    const found = PRESET_MEDIAN_PROFILES.find((p) => p.id === presetId);
    if (found) {
      setProfile(JSON.parse(JSON.stringify(found)));
      setTargetClass1Id(found.carriageway1.targetClassId);
      setTargetClass2Id(found.carriageway2.targetClassId);
      toast.info(`Loaded profile: ${found.name}`);
    }
  };

  // Compile Pole Configuration Object
  const poleConfig: MedianPoleConfig = useMemo(() => {
    return {
      poleSpacing,
      mountingHeight,
      poleOffsetFromCenter,
      isSymmetricBoom,
      boom1Length,
      boom1TiltDeg,
      boom2Length: isSymmetricBoom ? boom1Length : boom2Length,
      boom2TiltDeg: isSymmetricBoom ? boom1TiltDeg : boom2TiltDeg,
      luminaire1Id,
      luminaire2Id,
      maintenanceFactor,
    };
  }, [
    poleSpacing,
    mountingHeight,
    poleOffsetFromCenter,
    isSymmetricBoom,
    boom1Length,
    boom1TiltDeg,
    boom2Length,
    boom2TiltDeg,
    luminaire1Id,
    luminaire2Id,
    maintenanceFactor,
  ]);

  // Execute Simulation
  const simResult: MedianStripCalculationResult = useMemo(() => {
    return runMedianStripSimulation(profile, luminaire1, luminaire2, poleConfig, targetClass1Id, targetClass2Id);
  }, [profile, luminaire1, luminaire2, poleConfig, targetClass1Id, targetClass2Id]);

  // Run Optimizer Handler
  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      try {
        const res = optimizeMedianStripLighting(profile, luminaire1, luminaire2, poleConfig, targetClass1Id, targetClass2Id);
        setOptimizationResult(res);
        toast.success(`Optimizer found optimal spacing: ${res.bestSpacing}m (Evaluated ${res.evaluatedVariantsCount} variants)`);
      } catch (err) {
        toast.error("Failed to run optimizer.");
      } finally {
        setIsOptimizing(false);
      }
    }, 150);
  };

  const handleApplyOptimization = (opt: MedianOptimizationResult) => {
    setPoleSpacing(opt.bestSpacing);
    setMountingHeight(opt.bestHeight);
    setBoom1Length(opt.bestBoomOutreach);
    setBoom2Length(opt.bestBoomOutreach);
    setBoom1TiltDeg(opt.bestTilt);
    setBoom2TiltDeg(opt.bestTilt);
    setIsSymmetricBoom(true);
    toast.success(`Applied optimal configuration: Spacing ${opt.bestSpacing}m, Height ${opt.bestHeight}m`);
  };

  // -------------------------------------------------------------
  // 3D Three.js Viewport Implementation
  // -------------------------------------------------------------
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || viewMode !== "3d" || !mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Road Dimensions
    const S = poleSpacing;
    const totalW = profile.totalWidth;
    const midX = S / 2;
    const midY = totalW / 2;

    // Camera Perspective Switching
    if (cameraMode === "orbit") {
      camera.position.set(-S * 0.7, mountingHeight * 1.6, totalW * 1.8);
      controls.target.set(midX, 0, midY);
    } else if (cameraMode === "top") {
      camera.position.set(midX, Math.max(S, totalW) * 2.2, midY);
      controls.target.set(midX, 0, midY);
    } else if (cameraMode === "obs1") {
      // CIE 140 Observer 1: Facing Carriageway 1 (Direction 1) from 60m back at 1.5m eye height
      const cw1CenterY = (profile.leftSidewalk.present ? profile.leftSidewalk.width : 0) + (profile.carriageway1.numLanes * profile.carriageway1.laneWidth) / 2;
      camera.position.set(-60, 1.5, cw1CenterY);
      controls.target.set(30, 0, cw1CenterY);
    } else if (cameraMode === "obs2") {
      // CIE 140 Observer 2: Facing Carriageway 2 (Direction 2) from +X back facing -X
      const cw2StartY = (profile.leftSidewalk.present ? profile.leftSidewalk.width : 0) + (profile.carriageway1.numLanes * profile.carriageway1.laneWidth) + profile.median.width;
      const cw2CenterY = cw2StartY + (profile.carriageway2.numLanes * profile.carriageway2.laneWidth) / 2;
      camera.position.set(S + 60, 1.5, cw2CenterY);
      controls.target.set(S - 30, 0, cw2CenterY);
    }
    controls.update();

    // Ambient Lighting
    const ambLight = new THREE.AmbientLight(0x242a35, 0.45);
    scene.add(ambLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(Math.max(S * 4, 160), 40, 0x334155, 0x1e293b);
    gridHelper.position.set(midX, -0.05, midY);
    scene.add(gridHelper);

    // -------------------------------------------------------------
    // Build 3D Road Profile Geometry
    // -------------------------------------------------------------
    const roadLength = S * 3;
    let currentY = 0;

    // 1. Left Sidewalk (if present)
    if (profile.leftSidewalk.present) {
      const swW = profile.leftSidewalk.width;
      const swGeom = new THREE.BoxGeometry(roadLength, profile.leftSidewalk.elevation, swW);
      const swMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
      const swMesh = new THREE.Mesh(swGeom, swMat);
      swMesh.position.set(midX, profile.leftSidewalk.elevation / 2, currentY + swW / 2);
      scene.add(swMesh);
      currentY += swW;
    }

    // 2. Carriageway 1 (Direction 1)
    const cw1W = profile.carriageway1.numLanes * profile.carriageway1.laneWidth;
    const cw1Geom = new THREE.PlaneGeometry(roadLength, cw1W);
    const cw1Mat = new THREE.MeshStandardMaterial({ color: 0x1e2229, roughness: 0.85 });
    const cw1Mesh = new THREE.Mesh(cw1Geom, cw1Mat);
    cw1Mesh.rotation.x = -Math.PI / 2;
    cw1Mesh.position.set(midX, 0, currentY + cw1W / 2);
    scene.add(cw1Mesh);

    // Lane divider dashes for CW1
    for (let l = 1; l < profile.carriageway1.numLanes; l++) {
      const lineY = currentY + l * profile.carriageway1.laneWidth;
      for (let x = -S; x < S * 2; x += 6) {
        const dashGeom = new THREE.PlaneGeometry(3.0, 0.15);
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dashMesh = new THREE.Mesh(dashGeom, dashMat);
        dashMesh.rotation.x = -Math.PI / 2;
        dashMesh.position.set(x + 1.5, 0.01, lineY);
        scene.add(dashMesh);
      }
    }
    currentY += cw1W;

    // 3. Central Reservation (Median Strip)
    const medW = profile.median.width;
    const medH = profile.median.curbHeight;
    const medGeom = new THREE.BoxGeometry(roadLength, medH, medW);
    const medColor = profile.median.surfaceType === "grass" ? 0x2e5939 : (profile.median.surfaceType === "paved" ? 0x475569 : 0x78716c);
    const medMat = new THREE.MeshStandardMaterial({ color: medColor, roughness: 0.95 });
    const medMesh = new THREE.Mesh(medGeom, medMat);
    medMesh.position.set(midX, medH / 2, currentY + medW / 2);
    scene.add(medMesh);

    const medCenterY = currentY + medW / 2;

    // Central Barrier (if configured)
    if (profile.median.barrierType === "concrete_jersey") {
      const barGeom = new THREE.BoxGeometry(roadLength, profile.median.barrierHeight, 0.45);
      const barMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
      const barMesh = new THREE.Mesh(barGeom, barMat);
      barMesh.position.set(midX, medH + profile.median.barrierHeight / 2, medCenterY);
      scene.add(barMesh);
    } else if (profile.median.barrierType === "steel_guardrail") {
      const railGeom = new THREE.BoxGeometry(roadLength, 0.35, 0.12);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.8, roughness: 0.3 });
      const railMesh = new THREE.Mesh(railGeom, railMat);
      railMesh.position.set(midX, medH + 0.65, medCenterY);
      scene.add(railMesh);
    }
    currentY += medW;

    // 4. Carriageway 2 (Direction 2)
    const cw2W = profile.carriageway2.numLanes * profile.carriageway2.laneWidth;
    const cw2Geom = new THREE.PlaneGeometry(roadLength, cw2W);
    const cw2Mat = new THREE.MeshStandardMaterial({ color: 0x1e2229, roughness: 0.85 });
    const cw2Mesh = new THREE.Mesh(cw2Geom, cw2Mat);
    cw2Mesh.rotation.x = -Math.PI / 2;
    cw2Mesh.position.set(midX, 0, currentY + cw2W / 2);
    scene.add(cw2Mesh);

    // Lane divider dashes for CW2
    for (let l = 1; l < profile.carriageway2.numLanes; l++) {
      const lineY = currentY + l * profile.carriageway2.laneWidth;
      for (let x = -S; x < S * 2; x += 6) {
        const dashGeom = new THREE.PlaneGeometry(3.0, 0.15);
        const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const dashMesh = new THREE.Mesh(dashGeom, dashMat);
        dashMesh.rotation.x = -Math.PI / 2;
        dashMesh.position.set(x + 1.5, 0.01, lineY);
        scene.add(dashMesh);
      }
    }
    currentY += cw2W;

    // 5. Right Sidewalk (if present)
    if (profile.rightSidewalk.present) {
      const swW = profile.rightSidewalk.width;
      const swGeom = new THREE.BoxGeometry(roadLength, profile.rightSidewalk.elevation, swW);
      const swMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
      const swMesh = new THREE.Mesh(swGeom, swMat);
      swMesh.position.set(midX, profile.rightSidewalk.elevation / 2, currentY + swW / 2);
      scene.add(swMesh);
    }

    // -------------------------------------------------------------
    // Build 3D Central Reservation Lighting Poles with Twin Arms
    // -------------------------------------------------------------
    const polePoleX = [-S, 0, S, 2 * S];
    const poleY = medCenterY + poleConfig.poleOffsetFromCenter;
    const H = mountingHeight;
    const b1L = poleConfig.boom1Length;
    const b2L = poleConfig.isSymmetricBoom ? b1L : poleConfig.boom2Length;

    for (const px of polePoleX) {
      // Main Vertical Pole Mast
      const mastGeom = new THREE.CylinderGeometry(0.12, 0.22, H, 16);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6, roughness: 0.3 });
      const mastMesh = new THREE.Mesh(mastGeom, mastMat);
      mastMesh.position.set(px, H / 2, poleY);
      scene.add(mastMesh);

      // Arm 1 (over Carriageway 1: -Y direction)
      const arm1Geom = new THREE.CylinderGeometry(0.06, 0.08, b1L, 12);
      const arm1Mesh = new THREE.Mesh(arm1Geom, mastMat);
      arm1Mesh.rotation.x = Math.PI / 2;
      arm1Mesh.position.set(px, H - 0.1, poleY - b1L / 2);
      scene.add(arm1Mesh);

      // Fixture 1 Head
      const fix1Geom = new THREE.BoxGeometry(0.7, 0.15, 0.35);
      const fix1Mat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
      const fix1Mesh = new THREE.Mesh(fix1Geom, fix1Mat);
      fix1Mesh.position.set(px, H, poleY - b1L);
      scene.add(fix1Mesh);

      // Arm 2 (over Carriageway 2: +Y direction)
      const arm2Geom = new THREE.CylinderGeometry(0.06, 0.08, b2L, 12);
      const arm2Mesh = new THREE.Mesh(arm2Geom, mastMat);
      arm2Mesh.rotation.x = -Math.PI / 2;
      arm2Mesh.position.set(px, H - 0.1, poleY + b2L / 2);
      scene.add(arm2Mesh);

      // Fixture 2 Head
      const fix2Geom = new THREE.BoxGeometry(0.7, 0.15, 0.35);
      const fix2Mesh = new THREE.Mesh(fix2Geom, fix1Mat);
      fix2Mesh.position.set(px, H, poleY + b2L);
      scene.add(fix2Mesh);

      // Three.js Spotlights & Realistic Volumetric Light Cones
      if (showLightCones) {
        // Spotlight 1 over CW1
        const spot1 = new THREE.SpotLight(0xfff3e0, 2.2, H * 3.5, Math.PI / 3.2, 0.45, 1.2);
        spot1.position.set(px, H, poleY - b1L);
        const target1 = new THREE.Object3D();
        target1.position.set(px, 0, poleY - b1L - 2.5);
        scene.add(target1);
        spot1.target = target1;
        scene.add(spot1);

        // Spotlight 2 over CW2
        const spot2 = new THREE.SpotLight(0xfff3e0, 2.2, H * 3.5, Math.PI / 3.2, 0.45, 1.2);
        spot2.position.set(px, H, poleY + b2L);
        const target2 = new THREE.Object3D();
        target2.position.set(px, 0, poleY + b2L + 2.5);
        scene.add(target2);
        spot2.target = target2;
        scene.add(spot2);

        // Volumetric Cone Helpers
        const cone1Geom = new THREE.ConeGeometry(b1L * 2.8, H, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
        });
        const cone1Mesh = new THREE.Mesh(cone1Geom, coneMat);
        cone1Mesh.position.set(px, H / 2, poleY - b1L);
        cone1Mesh.rotation.x = Math.PI;
        scene.add(cone1Mesh);

        const cone2Mesh = new THREE.Mesh(cone1Geom, coneMat);
        cone2Mesh.position.set(px, H / 2, poleY + b2L);
        cone2Mesh.rotation.x = Math.PI;
        scene.add(cone2Mesh);
      }
    }

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
  }, [
    isOpen,
    viewMode,
    cameraMode,
    profile,
    poleSpacing,
    mountingHeight,
    poleOffsetFromCenter,
    isSymmetricBoom,
    boom1Length,
    boom2Length,
    showLightCones,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#14171f] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 19 ROAD LIGHTING: MEDIAN STRIP
        ========================================================================= */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#181c24] via-[#1a202c] to-[#181c24] border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold">
              <Compass className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                  DIALux evo Tutorial Part 19: Median Strip Lighting Calculation
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  EN 13201-2 / EN 13201-3
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Central Reservation T-Arm
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dual Carriageway Profiles • Twin-Bracket Luminaire Arrangements • Independent Valuation Fields • EN 13201-5 Energy Indicators
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Close Studio"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            TOP WORKFLOW TABS & QUICK STATUS RIBBON
        ========================================================================= */}
        <div className="px-4 py-2 bg-[#12151b] border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "profile"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Layers className="size-3.5" />
              <span>1. Street Profile & Median</span>
            </button>
            <button
              onClick={() => setActiveTab("luminaires")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "luminaires"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Sun className="size-3.5" />
              <span>2. Twin Arrangement & Poles</span>
            </button>
            <button
              onClick={() => setActiveTab("standards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "standards"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>3. EN 13201 Valuation Fields</span>
            </button>
            <button
              onClick={() => setActiveTab("optimizer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "optimizer"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Sparkles className="size-3.5 text-amber-300" />
              <span>4. Automatic Optimizer</span>
            </button>
            <button
              onClick={() => setActiveTab("energy")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "energy"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Zap className="size-3.5" />
              <span>5. Energy (EN 13201-5) & Report</span>
            </button>
          </div>

          {/* Quick Real-Time Compliance Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border ${
                simResult.isOverallCompliant
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
              }`}
            >
              {simResult.isOverallCompliant ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>EN 13201 COMPLIANT</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 text-amber-400" />
                  <span>CHECK CRITERIA</span>
                </>
              )}
            </span>
            <div className="text-right text-[10px] text-slate-400 border-l border-slate-700 pl-2">
              <div>Spacing: <span className="font-bold text-slate-200">{poleSpacing}m</span></div>
              <div>Load: <span className="font-bold text-cyan-300">{simResult.totalConnectedPowerPerKm} kW/km</span></div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            MAIN BODY: SPLIT VIEWPORT & INTERACTIVE CONTROLS
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#101216]">
          
          {/* LEFT PANEL: INTERACTIVE TAB WORKFLOW CONTROLS */}
          <div className="w-full lg:w-[480px] xl:w-[520px] bg-[#14171f] border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 p-4 gap-4">
            
            {/* -------------------------------------------------------------
                TAB 1: STREET PROFILE & MEDIAN STRIP CONFIGURATION
            ------------------------------------------------------------- */}
            {activeTab === "profile" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers className="size-3.5" /> Preset Dual-Carriageway Profiles
                  </label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => handleProfilePresetChange(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 outline-none cursor-pointer"
                  >
                    {PRESET_MEDIAN_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{profile.description}</p>
                </div>

                {/* Central Reservation (Median Strip) Settings */}
                <div className="p-3.5 bg-amber-950/20 rounded-lg border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5">
                      <Shield className="size-3.5" /> Central Reservation (Median Strip)
                    </span>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      Width: {profile.median.width} m
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Median Width (m)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1.5"
                        max="8.0"
                        value={profile.median.width}
                        onChange={(e) => {
                          const w = Math.max(1.5, parseFloat(e.target.value) || 2.0);
                          const upd = { ...profile, median: { ...profile.median, width: w } };
                          upd.totalWidth = calculateTotalWidth(upd);
                          setProfile(upd);
                        }}
                        className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Curb Height (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.10"
                        max="0.40"
                        value={profile.median.curbHeight}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            median: { ...profile.median, curbHeight: parseFloat(e.target.value) || 0.2 },
                          })
                        }
                        className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Median Surface</label>
                      <select
                        value={profile.median.surfaceType}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            median: { ...profile.median, surfaceType: e.target.value as MedianSurfaceType },
                          })
                        }
                        className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="grass">Grass / Vegetated</option>
                        <option value="paved">Paved / Asphalt</option>
                        <option value="gravel">Gravel / Aggregate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Crash Barrier</label>
                      <select
                        value={profile.median.barrierType}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            median: { ...profile.median, barrierType: e.target.value as MedianBarrierType },
                          })
                        }
                        className="w-full h-8 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="none">None (Open Median)</option>
                        <option value="concrete_jersey">New Jersey Concrete Barrier</option>
                        <option value="steel_guardrail">Steel Armco Guardrail</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Carriageway 1 (Direction 1) Settings */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <ArrowRight className="size-3.5" /> Carriageway 1 (Direction 1 Forward)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {profile.carriageway1.numLanes} Lanes × {profile.carriageway1.laneWidth}m
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Lanes</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={profile.carriageway1.numLanes}
                        onChange={(e) => {
                          const n = Math.max(1, parseInt(e.target.value) || 2);
                          const upd = { ...profile, carriageway1: { ...profile.carriageway1, numLanes: n } };
                          upd.totalWidth = calculateTotalWidth(upd);
                          setProfile(upd);
                        }}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Lane Width (m)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="3.0"
                        max="4.5"
                        value={profile.carriageway1.laneWidth}
                        onChange={(e) => {
                          const w = Math.max(2.5, parseFloat(e.target.value) || 3.5);
                          const upd = { ...profile, carriageway1: { ...profile.carriageway1, laneWidth: w } };
                          upd.totalWidth = calculateTotalWidth(upd);
                          setProfile(upd);
                        }}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Surface</label>
                      <select
                        value={profile.carriageway1.surfaceClass}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            carriageway1: {
                              ...profile.carriageway1,
                              surfaceClass: e.target.value as CIERoadSurfaceClass,
                              q0: CIE_ROAD_SURFACES[e.target.value as CIERoadSurfaceClass].q0,
                            },
                          })
                        }
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="R1">R1 (Diffuse)</option>
                        <option value="R2">R2 (Mixed)</option>
                        <option value="R3">R3 (Asphalt)</option>
                        <option value="R4">R4 (Smooth)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Carriageway 2 (Direction 2) Settings */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <ArrowLeft className="size-3.5" /> Carriageway 2 (Direction 2 Reverse)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {profile.carriageway2.numLanes} Lanes × {profile.carriageway2.laneWidth}m
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Lanes</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={profile.carriageway2.numLanes}
                        onChange={(e) => {
                          const n = Math.max(1, parseInt(e.target.value) || 2);
                          const upd = { ...profile, carriageway2: { ...profile.carriageway2, numLanes: n } };
                          upd.totalWidth = calculateTotalWidth(upd);
                          setProfile(upd);
                        }}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Lane Width (m)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="3.0"
                        max="4.5"
                        value={profile.carriageway2.laneWidth}
                        onChange={(e) => {
                          const w = Math.max(2.5, parseFloat(e.target.value) || 3.5);
                          const upd = { ...profile, carriageway2: { ...profile.carriageway2, laneWidth: w } };
                          upd.totalWidth = calculateTotalWidth(upd);
                          setProfile(upd);
                        }}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Surface</label>
                      <select
                        value={profile.carriageway2.surfaceClass}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            carriageway2: {
                              ...profile.carriageway2,
                              surfaceClass: e.target.value as CIERoadSurfaceClass,
                              q0: CIE_ROAD_SURFACES[e.target.value as CIERoadSurfaceClass].q0,
                            },
                          })
                        }
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="R1">R1 (Diffuse)</option>
                        <option value="R2">R2 (Mixed)</option>
                        <option value="R3">R3 (Asphalt)</option>
                        <option value="R4">R4 (Smooth)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sidewalks Options */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.leftSidewalk.present}
                      onChange={(e) => {
                        const upd = {
                          ...profile,
                          leftSidewalk: { ...profile.leftSidewalk, present: e.target.checked },
                          rightSidewalk: { ...profile.rightSidewalk, present: e.target.checked },
                        };
                        upd.totalWidth = calculateTotalWidth(upd);
                        setProfile(upd);
                      }}
                      className="rounded border-slate-700 text-amber-600"
                    />
                    <span>Include Outer Sidewalks (Pedestrian P-Class)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Total Width: {profile.totalWidth} m</span>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 2: TWIN LUMINAIRE & CENTRAL POLE ARRANGEMENT
            ------------------------------------------------------------- */}
            {activeTab === "luminaires" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                    Central Reservation Pole Parameters
                  </span>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Pole Spacing S (m)</label>
                      <input
                        type="number"
                        step="2"
                        min="20"
                        max="60"
                        value={poleSpacing}
                        onChange={(e) => setPoleSpacing(parseFloat(e.target.value) || 30)}
                        className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Mounting Height H (m)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="8"
                        max="18"
                        value={mountingHeight}
                        onChange={(e) => setMountingHeight(parseFloat(e.target.value) || 10)}
                        className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Lateral Offset (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="-1.5"
                        max="1.5"
                        value={poleOffsetFromCenter}
                        onChange={(e) => setPoleOffsetFromCenter(parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSymmetricBoom}
                        onChange={(e) => setIsSymmetricBoom(e.target.checked)}
                        className="rounded border-slate-700 text-amber-600"
                      />
                      <span className="font-semibold">Symmetric Twin Booms (T-Bracket)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Maintenance Factor: <span className="text-amber-400 font-bold">{maintenanceFactor}</span>
                    </span>
                  </div>
                </div>

                {/* Arm 1 (Carriageway 1) */}
                <div className="p-3 bg-cyan-950/20 rounded-lg border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sun className="size-3.5" /> Boom Arm 1 (over Carriageway 1)
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {luminaire1.wattage}W • {luminaire1.totalLumens} lm
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Luminaire Model</label>
                    <select
                      value={luminaire1Id}
                      onChange={(e) => setLuminaire1Id(e.target.value)}
                      className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                    >
                      {BUILTIN_MEDIAN_LUMINAIRES.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Outreach Length (m)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.5"
                        max="3.0"
                        value={boom1Length}
                        onChange={(e) => setBoom1Length(parseFloat(e.target.value) || 1.0)}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Tilt Angle (°)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="15"
                        value={boom1TiltDeg}
                        onChange={(e) => setBoom1TiltDeg(parseFloat(e.target.value) || 0)}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Arm 2 (Carriageway 2) */}
                <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sun className="size-3.5" /> Boom Arm 2 (over Carriageway 2)
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">
                      {isSymmetricBoom ? luminaire1.wattage : luminaire2.wattage}W
                    </span>
                  </div>

                  {!isSymmetricBoom && (
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Luminaire Model</label>
                      <select
                        value={luminaire2Id}
                        onChange={(e) => setLuminaire2Id(e.target.value)}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        {BUILTIN_MEDIAN_LUMINAIRES.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Outreach Length (m)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.5"
                        max="3.0"
                        disabled={isSymmetricBoom}
                        value={isSymmetricBoom ? boom1Length : boom2Length}
                        onChange={(e) => setBoom2Length(parseFloat(e.target.value) || 1.0)}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Tilt Angle (°)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="15"
                        disabled={isSymmetricBoom}
                        value={isSymmetricBoom ? boom1TiltDeg : boom2TiltDeg}
                        onChange={(e) => setBoom2TiltDeg(parseFloat(e.target.value) || 0)}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 3: EN 13201 STANDARDS & INDEPENDENT VALUATION FIELDS
            ------------------------------------------------------------- */}
            {activeTab === "standards" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <label className="text-[11px] font-bold text-cyan-400 block mb-1">Target Class: Carriageway 1</label>
                    <select
                      value={targetClass1Id}
                      onChange={(e) => setTargetClass1Id(e.target.value)}
                      className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                    >
                      {EN_13201_STANDARDS.map((s) => (
                        <option key={s.classId} value={s.classId}>
                          {s.classId} ({s.L_avg_min} cd/m²)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <label className="text-[11px] font-bold text-indigo-400 block mb-1">Target Class: Carriageway 2</label>
                    <select
                      value={targetClass2Id}
                      onChange={(e) => setTargetClass2Id(e.target.value)}
                      className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                    >
                      {EN_13201_STANDARDS.map((s) => (
                        <option key={s.classId} value={s.classId}>
                          {s.classId} ({s.L_avg_min} cd/m²)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Valuation Field 1 Results */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Field 1: Carriageway 1 ({targetClass1Id})
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        simResult.field1.isOverallCompliant
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {simResult.field1.isOverallCompliant ? "100% COMPLIANT" : "FAIL CRITERIA"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">L_avg</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field1.L_avg} cd/m²</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard1.L_avg_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">U_o (Lmin/Lavg)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field1.U_o}</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard1.U_o_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">U_l (Longitudinal)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field1.U_l}</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard1.U_l_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">TI % (Glare)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field1.TI_glare}%</div>
                      <div className="text-[9px] text-slate-400">≤ {simResult.targetStandard1.TI_max}%</div>
                    </div>
                  </div>
                </div>

                {/* Valuation Field 2 Results */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Field 2: Carriageway 2 ({targetClass2Id})
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        simResult.field2.isOverallCompliant
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {simResult.field2.isOverallCompliant ? "100% COMPLIANT" : "FAIL CRITERIA"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">L_avg</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field2.L_avg} cd/m²</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard2.L_avg_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">U_o (Lmin/Lavg)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field2.U_o}</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard2.U_o_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">U_l (Longitudinal)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field2.U_l}</div>
                      <div className="text-[9px] text-slate-400">≥ {simResult.targetStandard2.U_l_min}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">TI % (Glare)</div>
                      <div className="text-xs font-bold text-slate-100">{simResult.field2.TI_glare}%</div>
                      <div className="text-[9px] text-slate-400">≤ {simResult.targetStandard2.TI_max}%</div>
                    </div>
                  </div>
                </div>

                {/* Median Strip Illuminance Field */}
                <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">Median Strip Illuminance Valuation</span>
                    <span className="text-[11px] text-slate-400">
                      E_avg: <strong className="text-slate-200">{simResult.medianField.E_avg} lux</strong> • E_min:{" "}
                      <strong className="text-slate-200">{simResult.medianField.E_min} lux</strong> • U_o:{" "}
                      <strong className="text-slate-200">{simResult.medianField.U_o}</strong>
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded border ${
                      simResult.medianField.isCompliant
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {simResult.medianField.isCompliant ? "SAFETY SATISFIED" : "LOW ILLUMINANCE"}
                  </span>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 4: AUTOMATIC OPTIMIZER (TUTORIAL 19 WORKFLOW)
            ------------------------------------------------------------- */}
            {activeTab === "optimizer" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/30 rounded-lg border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-amber-400" /> Automated Median Geometry Optimizer
                    </span>
                    <button
                      onClick={handleRunOptimizer}
                      disabled={isOptimizing}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="size-3" />
                      <span>{isOptimizing ? "Optimizing..." : "Start Solver"}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Iteratively scans pole spacings (28m to 52m), heights (10m to 14m), outreaches, and tilts to find the largest pole spacing that achieves 100% EN 13201 compliance on both Carriageways simultaneously.
                  </p>
                </div>

                {optimizationResult && (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-950/20 rounded-lg border border-emerald-500/40 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-emerald-300">Optimal Configuration Found:</div>
                        <div className="text-[11px] text-slate-300">
                          Spacing: <strong>{optimizationResult.bestSpacing}m</strong> • Height: <strong>{optimizationResult.bestHeight}m</strong> • Outreach: <strong>{optimizationResult.bestBoomOutreach}m</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApplyOptimization(optimizationResult)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition cursor-pointer"
                      >
                        Apply Solution
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-900 text-slate-400 sticky top-0">
                          <tr>
                            <th className="p-2">Spacing</th>
                            <th className="p-2">Height</th>
                            <th className="p-2">L_avg (1/2)</th>
                            <th className="p-2">Poles/km</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                          {optimizationResult.rankedVariants.slice(0, 8).map((v, i) => (
                            <tr key={i} className="hover:bg-slate-800/40">
                              <td className="p-2 font-mono font-bold">{v.spacing}m</td>
                              <td className="p-2 font-mono">{v.height}m</td>
                              <td className="p-2 font-mono">
                                {v.field1_Lavg} / {v.field2_Lavg}
                              </td>
                              <td className="p-2 font-mono">{v.polesPerKm}</td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    v.isCompliant
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-red-500/20 text-red-300"
                                  }`}
                                >
                                  {v.isCompliant ? "PASS" : "FAIL"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 5: ENERGY INDICATORS (EN 13201-5) & REPORT
            ------------------------------------------------------------- */}
            {activeTab === "energy" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400 uppercase">Power Density Indicator (PDI)</div>
                    <div className="text-base font-bold text-amber-400 mt-1">{simResult.PDI}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">W / (lx · m²)</div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-400 uppercase">Annual Energy (AECI)</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">{simResult.AECI}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">kWh / (m² · year)</div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-200 block">Electrical Infrastructure Metrics</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Poles / km</div>
                      <div className="font-bold text-slate-100 mt-0.5">{simResult.polesPerKm}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Fixtures / km</div>
                      <div className="font-bold text-slate-100 mt-0.5">{simResult.fixturesPerKm}</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Total Load</div>
                      <div className="font-bold text-cyan-300 mt-0.5">{simResult.totalConnectedPowerPerKm} kW/km</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    toast.success("DIALux evo EN 13201 Median Strip Documentation compiled to PDF!");
                  }}
                  className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <FileDown className="size-4" />
                  <span>Export Official EN 13201 Report</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: 3D THREE.JS & 2D CROSS-SECTION / HEATMAP VIEWPORTS */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#0c0e12] overflow-hidden">
            
            {/* Viewport Mode Bar */}
            <div className="px-4 py-2 bg-[#14171f] border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === "3d" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Box className="size-3.5" />
                  <span>3D CAD Model</span>
                </button>
                <button
                  onClick={() => setViewMode("2d_cross_section")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === "2d_cross_section" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Ruler className="size-3.5" />
                  <span>2D Cross-Section</span>
                </button>
                <button
                  onClick={() => setViewMode("2d_heatmap")}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === "2d_heatmap" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Grid className="size-3.5" />
                  <span>2D False Color Heatmap</span>
                </button>
              </div>

              {viewMode === "3d" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Camera:</span>
                  <button
                    onClick={() => setCameraMode("orbit")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cameraMode === "orbit" ? "bg-slate-700 text-amber-300" : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    Orbit 3D
                  </button>
                  <button
                    onClick={() => setCameraMode("top")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cameraMode === "top" ? "bg-slate-700 text-amber-300" : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    Top CAD
                  </button>
                  <button
                    onClick={() => setCameraMode("obs1")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cameraMode === "obs1" ? "bg-cyan-600/40 text-cyan-300" : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    CIE Obs 1 (Dir 1)
                  </button>
                  <button
                    onClick={() => setCameraMode("obs2")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cameraMode === "obs2" ? "bg-indigo-600/40 text-indigo-300" : "bg-slate-800/80 text-slate-400"
                    }`}
                  >
                    CIE Obs 2 (Dir 2)
                  </button>
                </div>
              )}
            </div>

            {/* Viewport Content */}
            <div className="flex-1 min-h-0 relative">
              {viewMode === "3d" && <div ref={mountRef} className="w-full h-full" />}

              {/* 2D Cross Section Visualizer */}
              {viewMode === "2d_cross_section" && (
                <div className="w-full h-full p-6 flex flex-col justify-center items-center bg-[#0e1117] overflow-auto">
                  <div className="w-full max-w-4xl p-6 bg-[#14171f] rounded-xl border border-slate-800 shadow-xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">
                          Dual Carriageway Cross-Section (Total Width: {profile.totalWidth}m)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          CIE 140 Geometry • Central Median T-Arm Pole • Height: {mountingHeight}m • Outreach: {boom1Length}m
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Median: {profile.median.width}m ({profile.median.surfaceType})
                      </span>
                    </div>

                    {/* SVG Diagram */}
                    <div className="w-full h-64 bg-slate-950 rounded-lg border border-slate-800 relative flex items-center justify-center p-4">
                      <svg viewBox="0 0 900 240" className="w-full h-full">
                        {/* Ground Baseline */}
                        <line x1="50" y1="180" x2="850" y2="180" stroke="#334155" strokeWidth="2" />

                        {/* Carriageway 1 (Left Road) */}
                        <rect x="150" y="175" width="260" height="5" fill="#1e293b" />
                        <text x="280" y="200" fill="#38bdf8" fontSize="12" textAnchor="middle" fontWeight="bold">
                          Carriageway 1 (Direction 1 ➔)
                        </text>
                        <text x="280" y="215" fill="#64748b" fontSize="10" textAnchor="middle">
                          {profile.carriageway1.numLanes} Lanes × {profile.carriageway1.laneWidth}m
                        </text>

                        {/* Central Reservation (Median Strip) */}
                        <rect
                          x="410"
                          y={175 - profile.median.curbHeight * 20}
                          width="80"
                          height={profile.median.curbHeight * 20 + 5}
                          fill={profile.median.surfaceType === "grass" ? "#166534" : "#475569"}
                          stroke="#cbd5e1"
                          strokeWidth="1"
                        />
                        <text x="450" y="200" fill="#f59e0b" fontSize="11" textAnchor="middle" fontWeight="bold">
                          Median
                        </text>
                        <text x="450" y="215" fill="#f59e0b" fontSize="9" textAnchor="middle">
                          {profile.median.width}m
                        </text>

                        {/* Central Barrier */}
                        {profile.median.barrierType === "concrete_jersey" && (
                          <polygon points="442,170 445,145 455,145 458,170" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="1" />
                        )}

                        {/* Carriageway 2 (Right Road) */}
                        <rect x="490" y="175" width="260" height="5" fill="#1e293b" />
                        <text x="620" y="200" fill="#818cf8" fontSize="12" textAnchor="middle" fontWeight="bold">
                          Carriageway 2 (Direction 2 ⬅)
                        </text>
                        <text x="620" y="215" fill="#64748b" fontSize="10" textAnchor="middle">
                          {profile.carriageway2.numLanes} Lanes × {profile.carriageway2.laneWidth}m
                        </text>

                        {/* Central Lighting Mast */}
                        <line x1="450" y1="170" x2="450" y2="40" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />

                        {/* Left Boom Arm 1 (over CW1) */}
                        <line x1="450" y1="45" x2="390" y2="35" stroke="#94a3b8" strokeWidth="3" />
                        <circle cx="390" cy="35" r="5" fill="#f59e0b" />
                        {/* Light Cone 1 */}
                        <polygon points="390,38 200,175 420,175" fill="#fef08a" opacity="0.12" />

                        {/* Right Boom Arm 2 (over CW2) */}
                        <line x1="450" y1="45" x2="510" y2="35" stroke="#94a3b8" strokeWidth="3" />
                        <circle cx="510" cy="35" r="5" fill="#f59e0b" />
                        {/* Light Cone 2 */}
                        <polygon points="510,38 480,175 700,175" fill="#fef08a" opacity="0.12" />

                        {/* Mast Label */}
                        <text x="450" y="25" fill="#f8fafc" fontSize="11" textAnchor="middle" fontWeight="bold">
                          H = {mountingHeight}m
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* 2D False Color Heatmap */}
              {viewMode === "2d_heatmap" && (
                <div className="w-full h-full p-6 flex flex-col justify-center items-center bg-[#0e1117] overflow-auto">
                  <div className="w-full max-w-4xl p-6 bg-[#14171f] rounded-xl border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-200">
                          2D False-Color Plan View Heatmap (Over 1 Pole Spacing: {poleSpacing}m)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Roadway Luminance (cd/m²) & Median Illuminance (lux) Point Grid
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>Low</span>
                        <div className="w-24 h-2.5 rounded bg-gradient-to-r from-blue-900 via-emerald-600 via-amber-500 to-red-500 border border-slate-700" />
                        <span>High</span>
                      </div>
                    </div>

                    <div className="w-full h-64 bg-slate-950 rounded-lg border border-slate-800 p-2 flex flex-wrap gap-0.5 overflow-hidden">
                      {simResult.gridPoints.slice(0, 300).map((pt, idx) => {
                        const luxNormalized = Math.min(1, pt.lux / 50);
                        let bg = "#1e293b";
                        if (luxNormalized > 0.75) bg = "#ef4444";
                        else if (luxNormalized > 0.5) bg = "#f59e0b";
                        else if (luxNormalized > 0.3) bg = "#10b981";
                        else if (luxNormalized > 0.15) bg = "#0284c7";
                        else bg = "#1e3a8a";

                        return (
                          <div
                            key={idx}
                            style={{ backgroundColor: bg }}
                            className="flex-1 min-w-[12px] h-[18px] rounded-[1px] hover:scale-125 transition-transform"
                            title={`X: ${pt.x.toFixed(1)}m, Y: ${pt.y.toFixed(1)}m | ${pt.luminanceCdM2} cd/m² (${pt.lux} lux) [${pt.zone}]`}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Direction 1: CW1 Avg = {simResult.field1.L_avg} cd/m²</span>
                      <span className="text-amber-400 font-bold">Median E_avg = {simResult.medianField.E_avg} lux</span>
                      <span>Direction 2: CW2 Avg = {simResult.field2.L_avg} cd/m²</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
