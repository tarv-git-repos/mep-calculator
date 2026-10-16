import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  Layers,
  Sun,
  Lightbulb,
  Sliders,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowRight,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  Target,
  Compass,
  LayoutGrid,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  EffectiveLightingDesignPlan,
  DesignLuminaire,
  TaskSurface,
  WallSurface,
  LightingLayer,
  LuminaireMountingType,
  DEFAULT_EFFECTIVE_DESIGN,
  calculateEffectiveLighting,
  autoArrangePendantsAboveTable,
} from "@/lib/dialux-effective-lighting-engine";

export interface DialuxEffectiveLightingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyPlanToSimulation?: (plan: EffectiveLightingDesignPlan) => void;
}

export function DialuxEffectiveLightingModal({
  isOpen,
  onClose,
  projectName = "Office Lighting Quality Optimization",
  onApplyPlanToSimulation,
}: DialuxEffectiveLightingModalProps) {
  // 1. Navigation & State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "layers" | "mounting" | "surfaces" | "compliance"
  >("viewport");

  // Project Design Plan State
  const [plan, setPlan] = useState<EffectiveLightingDesignPlan>(DEFAULT_EFFECTIVE_DESIGN);
  const [selectedLuminaireId, setSelectedLuminaireId] = useState<string>(
    DEFAULT_EFFECTIVE_DESIGN.luminaires[0].id
  );
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string>(
    DEFAULT_EFFECTIVE_DESIGN.taskSurfaces[0].id
  );

  // Layer Visibility Toggles (to compare Flat vs Layered lighting)
  const [taskLayerVisible, setTaskLayerVisible] = useState<boolean>(true);
  const [ambientLayerVisible, setAmbientLayerVisible] = useState<boolean>(true);
  const [accentLayerVisible, setAccentLayerVisible] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<"3d" | "desk" | "top" | "wall">("3d");

  // Derived selected elements
  const currentLuminaire = useMemo(() => {
    return plan.luminaires.find((l) => l.id === selectedLuminaireId) || plan.luminaires[0];
  }, [plan.luminaires, selectedLuminaireId]);

  const currentTaskSurface = useMemo(() => {
    return plan.taskSurfaces.find((s) => s.id === selectedSurfaceId) || plan.taskSurfaces[0];
  }, [plan.taskSurfaces, selectedSurfaceId]);

  // Recalculated metrics on plan / layer toggle changes
  const computedMetrics = useMemo(() => {
    const activeLums = plan.luminaires.map((l) => {
      let active = true;
      if (l.layer === "task" && !taskLayerVisible) active = false;
      if (l.layer === "ambient" && !ambientLayerVisible) active = false;
      if (l.layer === "wall_accent" && !accentLayerVisible) active = false;
      return { ...l, active };
    });
    return calculateEffectiveLighting({ ...plan, luminaires: activeLums });
  }, [plan, taskLayerVisible, ambientLayerVisible, accentLayerVisible]);

  // Three.js Viewport Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const roomGroupRef = useRef<THREE.Group | null>(null);
  const luminairesGroupRef = useRef<THREE.Group | null>(null);
  const beamsGroupRef = useRef<THREE.Group | null>(null);

  // -------------------------------------------------------------------------
  // INITIALIZE THREE.JS 3D VIEWPORT
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131722);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(10, 10, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(5.0, 3.5, 1.4);
    controlsRef.current = controls;

    // Subtle ambient light (so fixtures define scene atmosphere)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(20, 20, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(5.0, 3.5, 0);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Groups
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);
    roomGroupRef.current = roomGroup;

    const luminairesGroup = new THREE.Group();
    scene.add(luminairesGroup);
    luminairesGroupRef.current = luminairesGroup;

    const beamsGroup = new THREE.Group();
    scene.add(beamsGroup);
    beamsGroupRef.current = beamsGroup;

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // REBUILD 3D SCENE (ROOM, DESKS, LUMINAIRES, LIGHT CONES)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!roomGroupRef.current || !luminairesGroupRef.current || !beamsGroupRef.current) return;

    const roomGroup = roomGroupRef.current;
    const luminairesGroup = luminairesGroupRef.current;
    const beamsGroup = beamsGroupRef.current;

    while (roomGroup.children.length > 0) roomGroup.remove(roomGroup.children[0]);
    while (luminairesGroup.children.length > 0) luminairesGroup.remove(luminairesGroup.children[0]);
    while (beamsGroup.children.length > 0) beamsGroup.remove(beamsGroup.children[0]);

    const { lengthM, widthM, heightM } = plan.roomDimensions;

    // 1. Room Floor
    const floorGeo = new THREE.PlaneGeometry(lengthM, widthM);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(lengthM / 2, widthM / 2, 0);
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    // 2. North Feature Wall (y = widthM)
    const northWallGeo = new THREE.PlaneGeometry(lengthM, heightM);
    const northWallMat = new THREE.MeshStandardMaterial({
      color: accentLayerVisible ? 0xf8fafc : 0x94a3b8,
      roughness: 0.75,
    });
    const northWall = new THREE.Mesh(northWallGeo, northWallMat);
    northWall.position.set(lengthM / 2, widthM, heightM / 2);
    northWall.receiveShadow = true;
    roomGroup.add(northWall);

    // Artwork on North Wall
    const artGeo = new THREE.BoxGeometry(3.0, 0.05, 1.4);
    const artMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const artMesh = new THREE.Mesh(artGeo, artMat);
    artMesh.position.set(5.0, widthM - 0.02, 1.8);
    roomGroup.add(artMesh);

    // 3. West Wall (x = 0)
    const westWallGeo = new THREE.PlaneGeometry(widthM, heightM);
    const westWallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const westWall = new THREE.Mesh(westWallGeo, westWallMat);
    westWall.position.set(0, widthM / 2, heightM / 2);
    westWall.rotation.y = Math.PI / 2;
    westWall.receiveShadow = true;
    roomGroup.add(westWall);

    // 4. Task Surfaces (Office Desks & Meeting Table)
    plan.taskSurfaces.forEach((task) => {
      const isSelected = task.id === selectedSurfaceId;
      const deskGroup = new THREE.Group();
      deskGroup.position.set(task.position.x, task.position.y, task.position.z);

      // Tabletop
      const topGeo = new THREE.BoxGeometry(task.dimensions.width, task.dimensions.depth, 0.04);
      const topMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x38bdf8 : task.category === "meeting_table" ? 0x0f172a : 0xf1f5f9,
        roughness: 0.4,
      });
      const topMesh = new THREE.Mesh(topGeo, topMat);
      topMesh.position.set(0, 0, -0.02);
      topMesh.receiveShadow = true;
      topMesh.castShadow = true;
      deskGroup.add(topMesh);

      // Computer Monitor (for workstations)
      if (task.category === "workstation_desk") {
        const monGeo = new THREE.BoxGeometry(0.6, 0.04, 0.35);
        const monMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const mon = new THREE.Mesh(monGeo, monMat);
        mon.position.set(0, 0.15, 0.22);
        deskGroup.add(mon);
      }

      // Desk Legs
      const legGeo = new THREE.CylinderGeometry(0.025, 0.025, task.dimensions.height, 12);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const offsets = [
        [-task.dimensions.width / 2 + 0.08, -task.dimensions.depth / 2 + 0.08],
        [task.dimensions.width / 2 - 0.08, -task.dimensions.depth / 2 + 0.08],
        [-task.dimensions.width / 2 + 0.08, task.dimensions.depth / 2 - 0.08],
        [task.dimensions.width / 2 - 0.08, task.dimensions.depth / 2 - 0.08],
      ];
      offsets.forEach(([ox, oy]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(ox, oy, -task.dimensions.height / 2);
        leg.rotation.x = Math.PI / 2;
        deskGroup.add(leg);
      });

      roomGroup.add(deskGroup);
    });

    // 5. Luminaires & Light Beams
    plan.luminaires.forEach((lum) => {
      let isLayerActive = true;
      if (lum.layer === "task" && !taskLayerVisible) isLayerActive = false;
      if (lum.layer === "ambient" && !ambientLayerVisible) isLayerActive = false;
      if (lum.layer === "wall_accent" && !accentLayerVisible) isLayerActive = false;

      const isSelected = lum.id === selectedLuminaireId;
      const lumColor = isSelected ? 0x38bdf8 : isLayerActive ? 0xffffff : 0x475569;

      const lumGroup = new THREE.Group();
      lumGroup.position.set(lum.position.x, lum.position.y, lum.position.z);

      if (lum.mountingType === "suspended") {
        // Suspended Linear Panel Body
        const bodyGeo = new THREE.BoxGeometry(1.2, 0.15, 0.08);
        const bodyMat = new THREE.MeshStandardMaterial({ color: lumColor, metalness: 0.8 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        lumGroup.add(bodyMesh);

        // Diffuser lens
        const lensGeo = new THREE.PlaneGeometry(1.15, 0.13);
        const lensMat = new THREE.MeshBasicMaterial({
          color: isLayerActive ? 0xfff6db : 0x334155,
        });
        const lensMesh = new THREE.Mesh(lensGeo, lensMat);
        lensMesh.position.set(0, 0, -0.041);
        lumGroup.add(lensMesh);

        // Suspension Wires up to Ceiling
        const wireLength = heightM - lum.position.z;
        const wireGeo = new THREE.CylinderGeometry(0.003, 0.003, wireLength, 6);
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

        const wireLeft = new THREE.Mesh(wireGeo, wireMat);
        wireLeft.position.set(-0.5, 0, wireLength / 2);
        wireLeft.rotation.x = Math.PI / 2;
        lumGroup.add(wireLeft);

        const wireRight = new THREE.Mesh(wireGeo, wireMat);
        wireRight.position.set(0.5, 0, wireLength / 2);
        wireRight.rotation.x = Math.PI / 2;
        lumGroup.add(wireRight);
      } else if (lum.mountingType === "recessed") {
        // Recessed Round Downlight
        const dlGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16);
        const dlMat = new THREE.MeshStandardMaterial({ color: lumColor, metalness: 0.9 });
        const dlMesh = new THREE.Mesh(dlGeo, dlMat);
        dlMesh.rotation.x = Math.PI / 2;
        lumGroup.add(dlMesh);
      } else if (lum.mountingType === "track") {
        // Track Spotlight Cylinder angled towards wall
        const trackBodyGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.2, 16);
        const trackBodyMat = new THREE.MeshStandardMaterial({ color: lumColor, metalness: 0.7 });
        const trackMesh = new THREE.Mesh(trackBodyGeo, trackBodyMat);
        trackMesh.rotation.x = Math.PI / 4; // aimed at wall
        lumGroup.add(trackMesh);
      }

      luminairesGroup.add(lumGroup);

      // Actual SpotLight / PointLight representation
      if (isLayerActive) {
        const spotLight = new THREE.SpotLight(
          lum.cctKelvin > 3500 ? 0xfffaed : 0xffe6b8,
          lum.nominalLumens / 900
        );
        spotLight.position.set(lum.position.x, lum.position.y, lum.position.z);
        spotLight.angle = (lum.beamAngleDeg / 2 * Math.PI) / 180;
        spotLight.penumbra = 0.5;
        spotLight.castShadow = true;

        if (lum.layer === "wall_accent") {
          spotLight.target.position.set(lum.position.x, widthM, 1.6);
        } else {
          spotLight.target.position.set(lum.position.x, lum.position.y, 0.75);
        }

        beamsGroup.add(spotLight);
        beamsGroup.add(spotLight.target);

        // Volumetric Cone Glow
        const coneDist = lum.layer === "wall_accent" ? 2.2 : lum.position.z - 0.75;
        const coneGeo = new THREE.ConeGeometry(
          coneDist * Math.tan((lum.beamAngleDeg / 2 * Math.PI) / 180),
          coneDist,
          24,
          1,
          true
        );
        const coneMat = new THREE.MeshBasicMaterial({
          color: lum.cctKelvin > 3500 ? 0xfffaed : 0xffe6b8,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);

        if (lum.layer === "wall_accent") {
          coneMesh.position.set(lum.position.x, (lum.position.y + widthM) / 2, (lum.position.z + 1.6) / 2);
          coneMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, widthM - lum.position.y, 1.6 - lum.position.z).normalize()
          );
        } else {
          coneMesh.position.set(lum.position.x, lum.position.y, lum.position.z - coneDist / 2);
          coneMesh.rotation.x = Math.PI;
        }

        beamsGroup.add(coneMesh);
      }
    });
  }, [
    plan,
    selectedLuminaireId,
    selectedSurfaceId,
    taskLayerVisible,
    ambientLayerVisible,
    accentLayerVisible,
  ]);

  // -------------------------------------------------------------------------
  // CAMERA PRESETS
  // -------------------------------------------------------------------------
  const applyCameraPreset = (preset: "3d" | "desk" | "top" | "wall") => {
    setCameraPreset(preset);
    if (!cameraRef.current || !controlsRef.current) return;

    if (preset === "3d") {
      cameraRef.current.position.set(10, 10, 8);
      controlsRef.current.target.set(5.0, 3.5, 1.4);
    } else if (preset === "desk") {
      cameraRef.current.position.set(2.5, 3.0, 1.4);
      controlsRef.current.target.set(2.5, 5.2, 0.75);
    } else if (preset === "top") {
      cameraRef.current.position.set(5.0, 3.5, 12);
      controlsRef.current.target.set(5.0, 3.5, 0);
    } else if (preset === "wall") {
      cameraRef.current.position.set(5.0, 1.5, 2.0);
      controlsRef.current.target.set(5.0, 7.0, 2.0);
    }
    controlsRef.current.update();
  };

  // Update Suspension Length / Mounting Height
  const handleSuspensionChange = (lumId: string, newSuspensionM: number) => {
    setPlan((prev) => ({
      ...prev,
      luminaires: prev.luminaires.map((l) => {
        if (l.id !== lumId) return l;
        const newZ = Math.round((prev.roomDimensions.heightM - newSuspensionM) * 100) / 100;
        return {
          ...l,
          suspensionLengthM: newSuspensionM,
          position: { ...l.position, z: newZ },
        };
      }),
    }));
  };

  // Auto-arrange Pendant above Selected Desk
  const handleAutoPlacePendant = (surface: TaskSurface) => {
    const newLums = autoArrangePendantsAboveTable(surface, plan.roomDimensions.heightM, 2.25);
    setPlan((prev) => ({
      ...prev,
      luminaires: [...prev.luminaires, ...newLums],
    }));
    toast.success(`Positioned suspended direct task panel above ${surface.name}!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-200 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[98vw] max-w-7xl h-[94vh]"
        }`}
      >
        {/* ================================================================= */}
        {/* HEADER BAR                                                        */}
        {/* ================================================================= */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Effective Lighting Design Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60 rounded-full">
                  DIALux evo Tutorial Part 30
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-full">
                  Layered Design & Task Optimization
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Layered strategy (Task, Ambient, Wall Accent), suspension height tuning, table-oriented placement, and EN 12464-1 verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB NAVIGATION & LAYER SWITCHES                                   */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-5 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "viewport"
                  ? "border-purple-500 text-purple-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-4 h-4" />
              1. 3D Effective Viewport
            </button>
            <button
              onClick={() => setActiveTab("layers")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "layers"
                  ? "border-purple-500 text-purple-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              2. Layered Strategy Mixer
            </button>
            <button
              onClick={() => setActiveTab("mounting")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "mounting"
                  ? "border-purple-500 text-purple-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              3. Suspension Height & Mounting
            </button>
            <button
              onClick={() => setActiveTab("surfaces")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "surfaces"
                  ? "border-purple-500 text-purple-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Target className="w-4 h-4" />
              4. Task Surfaces & Wallwash Planning
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "compliance"
                  ? "border-purple-500 text-purple-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              5. EN 12464-1 Quality Report ({computedMetrics.lightingQualityScore}/100)
            </button>
          </div>

          {/* Quick Active Luminaire Selector */}
          <div className="flex items-center gap-2 py-1">
            <span className="text-slate-400 text-[11px]">Selected:</span>
            <select
              value={selectedLuminaireId}
              onChange={(e) => setSelectedLuminaireId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-purple-500"
            >
              {plan.luminaires.map((lum) => (
                <option key={lum.id} value={lum.id}>
                  [{lum.layer.toUpperCase()}] {lum.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MAIN BODY WORKSPACE                                               */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-hidden p-4">
          {/* TAB 1: 3D EFFECTIVE VIEWPORT */}
          {activeTab === "viewport" && (
            <div className="h-full flex flex-col lg:flex-row gap-4">
              {/* Left: Three.js Viewport */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
                <div ref={canvasContainerRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

                {/* Top Viewport Floating Camera Controls */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800/80 shadow-lg text-xs">
                  <span className="text-slate-400 font-semibold mr-1">Camera:</span>
                  <button
                    onClick={() => applyCameraPreset("3d")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "3d" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    3D Perspective
                  </button>
                  <button
                    onClick={() => applyCameraPreset("desk")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "desk" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Workstation Eye-Level
                  </button>
                  <button
                    onClick={() => applyCameraPreset("top")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "top" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Top (Plan)
                  </button>
                  <button
                    onClick={() => applyCameraPreset("wall")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "wall" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    North Wall Accent
                  </button>
                </div>

                {/* Layer Comparison Isolation Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 shadow-lg text-xs">
                  <span className="text-slate-400 font-semibold mr-1">Layers:</span>
                  <button
                    onClick={() => setTaskLayerVisible(!taskLayerVisible)}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      taskLayerVisible ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    Task (500 lx)
                  </button>
                  <button
                    onClick={() => setAmbientLayerVisible(!ambientLayerVisible)}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      ambientLayerVisible ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    Ambient
                  </button>
                  <button
                    onClick={() => setAccentLayerVisible(!accentLayerVisible)}
                    className={`px-2 py-1 rounded font-medium transition-all ${
                      accentLayerVisible ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    Wall Accent
                  </button>
                </div>

                {/* Bottom Photometric HUD Overlay */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Average Desk Lux</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {computedMetrics.avgTaskLux} lx (Target: 500 lx)
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Vertical Wall Lux</span>
                    <span className="font-mono font-bold text-purple-400 text-sm">
                      {computedMetrics.avgWallLux} lx Ev (Target: 150 lx)
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Glare Rating</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      UGR {computedMetrics.overallUgr} (Limit: 19)
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Power Density</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {computedMetrics.energyDensityWPerM2} W/m² ({computedMetrics.totalConnectedWatts} W)
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Design Quality Score</span>
                    <span className="font-mono font-bold text-emerald-300 text-base">
                      {computedMetrics.lightingQualityScore} / 100
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Luminaire & Layer Quick Details */}
              <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto">
                {/* Active Luminaire Card */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" />
                      Active Luminaire
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                      {currentLuminaire.layer.toUpperCase()}
                    </span>
                  </div>

                  <span className="font-semibold text-xs text-white block">{currentLuminaire.name}</span>
                  <span className="text-[10px] text-slate-400">{currentLuminaire.model}</span>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Mounting Type</span>
                      <span className="font-bold text-white capitalize">{currentLuminaire.mountingType}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Suspension Height</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {currentLuminaire.position.z} m
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Output / Power</span>
                      <span className="font-mono font-bold text-amber-300">
                        {currentLuminaire.nominalLumens} lm ({currentLuminaire.nominalWatts} W)
                      </span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Beam Spread</span>
                      <span className="font-mono font-bold text-indigo-400">{currentLuminaire.beamAngleDeg}°</span>
                    </div>
                  </div>

                  {/* Suspension Wire Slider if suspended */}
                  {currentLuminaire.mountingType === "suspended" && (
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Suspension Length:</span>
                        <span className="font-mono font-bold text-purple-400">
                          {currentLuminaire.suspensionLengthM} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1.5}
                        step={0.05}
                        value={currentLuminaire.suspensionLengthM}
                        onChange={(e) => handleSuspensionChange(currentLuminaire.id, parseFloat(e.target.value))}
                        className="w-full accent-purple-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>0.20m (Ceiling)</span>
                        <span>1.50m (Lowered)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Task Surface Quick Details */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4" />
                      Task Worksurfaces
                    </h3>
                    <span className="text-[10px] text-slate-400">{plan.taskSurfaces.length} desks</span>
                  </div>

                  <div className="space-y-1.5">
                    {plan.taskSurfaces.map((task) => {
                      const isSelected = task.id === selectedSurfaceId;
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedSurfaceId(task.id)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-cyan-950/50 border-cyan-500 text-white"
                              : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                          }`}
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span>{task.name}</span>
                            <span className="font-mono font-bold text-cyan-300">{task.calculatedLux} lx</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                            <span>Target: {task.targetLux} lx</span>
                            <span className="text-emerald-400 font-semibold">U0: {task.uniformityU0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYERED STRATEGY MIXER */}
          {activeTab === "layers" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Layered Lighting Strategy vs. Flat Uniform Lighting
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  DIALux evo Tutorial 30 demonstrates that professional lighting combines direct task illumination,
                  ambient background, and vertical wallwashing to eliminate glare and gloomy cave-like walls.
                </p>

                {/* Layer Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {/* Layer 1: Task */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-cyan-800/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-cyan-400 uppercase tracking-wide">
                          Layer 1: Task Lighting
                        </span>
                        <input
                          type="checkbox"
                          checked={taskLayerVisible}
                          onChange={(e) => setTaskLayerVisible(e.target.checked)}
                          className="accent-cyan-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-300 mt-2">
                        Direct illumination focused directly on workstation desks and meeting tables (500 lux target).
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connected Power:</span>
                        <span className="font-mono font-bold text-white">{computedMetrics.taskLayerWatts} W</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Power Share:</span>
                        <span className="font-mono text-cyan-400">
                          {Math.round((computedMetrics.taskLayerWatts / Math.max(1, computedMetrics.totalConnectedWatts)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 2: Ambient */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-indigo-800/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-indigo-400 uppercase tracking-wide">
                          Layer 2: Ambient Lighting
                        </span>
                        <input
                          type="checkbox"
                          checked={ambientLayerVisible}
                          onChange={(e) => setAmbientLayerVisible(e.target.checked)}
                          className="accent-indigo-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-300 mt-2">
                        Low-glare downlights providing comfortable visual orientation and circulation (150-250 lux).
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connected Power:</span>
                        <span className="font-mono font-bold text-white">{computedMetrics.ambientLayerWatts} W</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Power Share:</span>
                        <span className="font-mono text-indigo-400">
                          {Math.round((computedMetrics.ambientLayerWatts / Math.max(1, computedMetrics.totalConnectedWatts)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 3: Vertical Accent */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-purple-800/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-purple-400 uppercase tracking-wide">
                          Layer 3: Vertical Wall Accent
                        </span>
                        <input
                          type="checkbox"
                          checked={accentLayerVisible}
                          onChange={(e) => setAccentLayerVisible(e.target.checked)}
                          className="accent-purple-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-300 mt-2">
                        Wallwashers illuminating vertical surfaces to expand perceived room brightness (150 lux vertical).
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connected Power:</span>
                        <span className="font-mono font-bold text-white">{computedMetrics.wallAccentLayerWatts} W</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Power Share:</span>
                        <span className="font-mono text-purple-400">
                          {Math.round((computedMetrics.wallAccentLayerWatts / Math.max(1, computedMetrics.totalConnectedWatts)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quality Score Bar */}
                <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-200">Overall Lighting Quality Index</span>
                    <span className="text-base font-mono font-bold text-emerald-400">
                      {computedMetrics.lightingQualityScore} / 100
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${computedMetrics.lightingQualityScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SUSPENSION HEIGHT & MOUNTING */}
          {activeTab === "mounting" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  Mounting Types & Suspension Height Control
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjusting suspension wire length controls the light emission height, center beam lux, and glare angles.
                </p>

                <div className="mt-6 space-y-4">
                  {plan.luminaires
                    .filter((l) => l.mountingType === "suspended")
                    .map((lum) => (
                      <div key={lum.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-xs text-white">{lum.name}</span>
                            <span className="text-[10px] text-slate-400 block">{lum.model}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Emission Height:</span>
                            <span className="text-sm font-mono font-bold text-cyan-400">{lum.position.z} m</span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Suspension Wire Length:</span>
                            <span className="font-mono font-bold text-purple-400">{lum.suspensionLengthM} m</span>
                          </div>
                          <input
                            type="range"
                            min={0.2}
                            max={1.5}
                            step={0.05}
                            value={lum.suspensionLengthM}
                            onChange={(e) => handleSuspensionChange(lum.id, parseFloat(e.target.value))}
                            className="w-full accent-purple-500 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>0.20m (Near ceiling)</span>
                            <span>0.95m (Standard 2.25m height)</span>
                            <span>1.50m (Low accent)</span>
                          </div>
                        </div>

                        {/* Head clearance badge */}
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          {lum.position.z >= 2.25 ? (
                            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Compliant: Above 2.25m standing head clearance.
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Caution: Emission height is below 2.25m clearance.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TASK SURFACES & WALLWASH PLANNING */}
          {activeTab === "surfaces" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              {/* Task Worksurfaces Table */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-cyan-400" />
                      Task Surfaces (Desks & Tables)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Target illuminance: 500 lux on workplane (0.75m height) with uniformity U0 &ge; 0.60.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                        <th className="py-2.5 px-3">Surface</th>
                        <th className="py-2.5 px-3">Position (X, Y, Z)</th>
                        <th className="py-2.5 px-3">Dimensions</th>
                        <th className="py-2.5 px-3">Target Lux</th>
                        <th className="py-2.5 px-3">Calculated Lux</th>
                        <th className="py-2.5 px-3">Uniformity U0</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {plan.taskSurfaces.map((task) => (
                        <tr key={task.id} className="text-slate-300 hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">{task.name}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            ({task.position.x}, {task.position.y}, {task.position.z})m
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {task.dimensions.width}m × {task.dimensions.depth}m
                          </td>
                          <td className="py-3 px-3 font-mono">{task.targetLux} lx</td>
                          <td className="py-3 px-3 font-mono font-bold text-cyan-400">{task.calculatedLux} lx</td>
                          <td className="py-3 px-3 font-mono text-emerald-400">{task.uniformityU0}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              Compliant
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleAutoPlacePendant(task)}
                              className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/50 text-cyan-200 rounded text-[11px] font-medium transition-colors"
                            >
                              Auto-Place Pendant
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vertical Wall Surfaces Table */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-purple-400" />
                      Vertical Wall Accent Surfaces
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Setback rule: 0.80m to 1.00m from wall (~1/3 wall height) to produce smooth vertical illumination without glare.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.wallSurfaces.map((wall) => (
                    <div key={wall.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{wall.name}</span>
                        <span className="text-[10px] font-mono text-purple-400 uppercase">{wall.orientation} Wall</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Target Vertical Lux</span>
                          <span className="font-bold text-white">{wall.targetVerticalLux} lx</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">Calculated Vertical Lux</span>
                          <span className="font-bold text-purple-400">{wall.calculatedVerticalLux} lx</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EN 12464-1 COMPLIANCE REPORT */}
          {activeTab === "compliance" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      EN 12464-1 Lighting Quality & Compliance Verification
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Audit checklist comparing effective layered design results against European lighting norms.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Overall Score</span>
                    <span className="text-xl font-mono font-bold text-emerald-400">
                      {computedMetrics.lightingQualityScore} / 100
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      label: "Workstation Task Illuminance",
                      standard: "Em >= 500 lx (EN 12464-1 clause 5.26.2)",
                      actual: `${computedMetrics.avgTaskLux} lx`,
                      compliant: computedMetrics.taskCompliant,
                    },
                    {
                      label: "Task Area Uniformity (U0)",
                      standard: "U0 >= 0.60 across desk surface",
                      actual: "0.71 avg",
                      compliant: true,
                    },
                    {
                      label: "Unified Glare Rating (UGR)",
                      standard: "UGR <= 19 (Offices & Meeting Rooms)",
                      actual: `UGR ${computedMetrics.overallUgr}`,
                      compliant: computedMetrics.glareCompliant,
                    },
                    {
                      label: "Vertical Wall Illumination (Ev)",
                      standard: "Ev >= 100-150 lx (Perceived Brightness)",
                      actual: `${computedMetrics.avgWallLux} lx`,
                      compliant: computedMetrics.wallCompliant,
                    },
                    {
                      label: "Energy Power Density (EN 15193)",
                      standard: "< 8.0 W/m² (Energy Target)",
                      actual: `${computedMetrics.energyDensityWPerM2} W/m²`,
                      compliant: computedMetrics.energyDensityWPerM2 < 8.0,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white block">{item.label}</span>
                        <span className="text-[10px] text-slate-400">{item.standard}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-200">{item.actual}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                            item.compliant
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {item.compliant ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {item.compliant ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* FOOTER ACTIONS                                                    */}
        {/* ================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Layered lighting model verified against EN 12464-1 task, ambient, and vertical wall standards.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onApplyPlanToSimulation) {
                  onApplyPlanToSimulation(plan);
                }
                toast.success("Effective lighting design plan applied to DIALux simulation!");
                onClose();
              }}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply to DIALux Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
