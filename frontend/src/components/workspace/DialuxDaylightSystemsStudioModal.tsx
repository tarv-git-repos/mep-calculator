import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Sun,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Eye,
  Camera,
  Activity,
  Zap,
  TrendingDown,
  Clock,
  Compass,
  FileDown,
  Check,
  RotateCcw,
  Info,
  Shield,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DaylightSystemType,
  LouvreControlStrategy,
  CIESkyType,
  DaylightingSystemItem,
  RoomDaylightEnvironment,
  SolarPosition,
  DaylightSimulationResult,
  calculateSolarGeometry,
  simulateDaylightingSystem,
  ODLS_DAYLIGHT_CATALOG,
} from "@/lib/dialux-daylight-systems-engine";

export interface DialuxDaylightSystemsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyToSimulation?: (result: DaylightSimulationResult) => void;
}

export function DialuxDaylightSystemsStudioModal({
  isOpen,
  onClose,
  projectName = "Educational & Office Daylight Planning",
  onApplyToSimulation,
}: DialuxDaylightSystemsStudioModalProps) {
  // 1. Core Modal State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"viewport" | "slats" | "en17037" | "redirection" | "catalog" | "energy">("viewport");

  // Selected Daylighting System
  const [selectedSystem, setSelectedSystem] = useState<DaylightingSystemItem>(ODLS_DAYLIGHT_CATALOG[0]);

  // Geographical & Solar Parameters
  const [cityName, setCityName] = useState<string>("Berlin (52.5°N, 13.4°E)");
  const [latitude, setLatitude] = useState<number>(52.5);
  const [longitude, setLongitude] = useState<number>(13.4);
  const [dayOfYear, setDayOfYear] = useState<number>(80); // March 21 Equinox
  const [hourOfDay, setHourOfDay] = useState<number>(12.0); // 12:00 Solar Noon
  const [skyType, setSkyType] = useState<CIESkyType>("cie_clear_sun");

  // Room Environment (Classroom / Deep Office Model)
  const [room, setRoom] = useState<RoomDaylightEnvironment>({
    lengthM: 8.0, // depth from window
    widthM: 6.0,
    heightM: 3.2,
    windowWidthM: 5.0,
    windowHeightM: 2.2,
    windowSillHeightM: 0.85,
    facadeAzimuthDegrees: 180, // South facing
    ceilingReflectance: 0.80, // High-reflectance white ceiling
    wallReflectance: 0.50,
    floorReflectance: 0.20,
    workplaneHeightM: 0.75,
    artificialLightingWatts: 280,
    targetIlluminanceLux: 500,
  });

  // Dynamic Slat Adjustments
  const [slatTiltDegrees, setSlatTiltDegrees] = useState<number>(
    selectedSystem.louvre?.slatTiltDegrees ?? 45
  );
  const [deploymentPercent, setDeploymentPercent] = useState<number>(
    selectedSystem.louvre?.deploymentPercent ?? 100
  );
  const [controlStrategy, setControlStrategy] = useState<LouvreControlStrategy>(
    selectedSystem.louvre?.controlStrategy ?? "sun_tracking_cutoff"
  );

  // Viewport Settings
  const [cameraView, setCameraView] = useState<"perspective" | "top" | "workstation" | "window">("perspective");
  const [showHeatmap, setShowHeatmap] = useState(false);

  // 3D Three.js Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const sunLightRef = useRef<any>(null);
  const slatMeshesRef = useRef<any[]>([]);
  const heatmapMeshRef = useRef<any>(null);

  // 2. Solar Position Calculation
  const solarPosition: SolarPosition = useMemo(() => {
    return calculateSolarGeometry(latitude, longitude, dayOfYear, hourOfDay, room.facadeAzimuthDegrees, skyType);
  }, [latitude, longitude, dayOfYear, hourOfDay, room.facadeAzimuthDegrees, skyType]);

  // Synchronize System Config with local slider states
  const activeSystemConfig: DaylightingSystemItem = useMemo(() => {
    const copy = JSON.parse(JSON.stringify(selectedSystem)) as DaylightingSystemItem;
    if (copy.louvre) {
      copy.louvre.slatTiltDegrees = slatTiltDegrees;
      copy.louvre.deploymentPercent = deploymentPercent;
      copy.louvre.controlStrategy = controlStrategy;
    }
    return copy;
  }, [selectedSystem, slatTiltDegrees, deploymentPercent, controlStrategy]);

  // 3. Compute Daylight Simulation Result
  const simulationResult: DaylightSimulationResult = useMemo(() => {
    return simulateDaylightingSystem(activeSystemConfig, room, solarPosition, skyType);
  }, [activeSystemConfig, room, solarPosition, skyType]);

  // Automated Cut-off Angle Tracking
  useEffect(() => {
    if (controlStrategy === "sun_tracking_cutoff" && solarPosition.altitudeDegrees > 0) {
      // Set slat angle to just cut off direct beam
      const autoAngle = Math.min(80, Math.max(15, Math.round(90 - solarPosition.altitudeDegrees * 0.8)));
      setSlatTiltDegrees(autoAngle);
    } else if (controlStrategy === "light_redirecting_ceiling") {
      setSlatTiltDegrees(30); // 30 deg upwards bounce
    } else if (controlStrategy === "full_closed_glare") {
      setSlatTiltDegrees(85);
    }
  }, [controlStrategy, solarPosition.altitudeDegrees]);

  // Switch Camera Viewpoints
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    if (cameraView === "perspective") {
      cam.position.set(-6, 5, 8);
      ctrl.target.set(room.lengthM / 2, 1.2, room.widthM / 2);
    } else if (cameraView === "top") {
      cam.position.set(room.lengthM / 2, 11, room.widthM / 2 + 0.001);
      ctrl.target.set(room.lengthM / 2, 0, room.widthM / 2);
    } else if (cameraView === "workstation") {
      cam.position.set(2.5, 1.2, room.widthM / 2);
      ctrl.target.set(0, 1.6, room.widthM / 2);
    } else if (cameraView === "window") {
      cam.position.set(0.6, 1.6, room.widthM / 2);
      ctrl.target.set(room.lengthM, 1.2, room.widthM / 2);
    }
    ctrl.update();
  }, [cameraView, room]);

  // 4. Three.js Scene Setup
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
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(-6, 5, 8);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(room.lengthM / 2, 1.2, room.widthM / 2);
    controlsRef.current = controls;

    // Ambient Sky Fill
    const ambLight = new THREE.AmbientLight(0x94a3b8, skyType === "cie_overcast" ? 0.7 : 0.3);
    scene.add(ambLight);

    // Direct Sunbeam Light
    const sunLight = new THREE.DirectionalLight(0xfffbeb, skyType === "cie_overcast" ? 0.1 : 2.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Room Envelope Geometry
    // Floor
    const floorGeom = new THREE.PlaneGeometry(room.lengthM, room.widthM);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(room.lengthM / 2, 0, room.widthM / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Ceiling (Light Reflecting Surface, rho = 0.80)
    const ceilingGeom = new THREE.PlaneGeometry(room.lengthM, room.widthM);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.05,
    });
    const ceilingMesh = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(room.lengthM / 2, room.heightM, room.widthM / 2);
    scene.add(ceilingMesh);

    // Back Wall
    const wallBack = new THREE.Mesh(
      new THREE.PlaneGeometry(room.widthM, room.heightM),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
    );
    wallBack.rotation.y = -Math.PI / 2;
    wallBack.position.set(room.lengthM, room.heightM / 2, room.widthM / 2);
    scene.add(wallBack);

    // Left Wall
    const wallLeft = new THREE.Mesh(
      new THREE.PlaneGeometry(room.lengthM, room.heightM),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
    );
    wallLeft.position.set(room.lengthM / 2, room.heightM / 2, 0);
    scene.add(wallLeft);

    // Right Wall
    const wallRight = new THREE.Mesh(
      new THREE.PlaneGeometry(room.lengthM, room.heightM),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
    );
    wallRight.rotation.y = Math.PI;
    wallRight.position.set(room.lengthM / 2, room.heightM / 2, room.widthM);
    scene.add(wallRight);

    // Window Facade (Front wall with window opening)
    // Sill wall section below window
    const sillMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, room.windowSillHeightM, room.widthM),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
    );
    sillMesh.position.set(0.1, room.windowSillHeightM / 2, room.widthM / 2);
    scene.add(sillMesh);

    // Lintel section above window
    const lintelH = room.heightM - (room.windowSillHeightM + room.windowHeightM);
    if (lintelH > 0) {
      const lintelMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, lintelH, room.widthM),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
      );
      lintelMesh.position.set(0.1, room.heightM - lintelH / 2, room.widthM / 2);
      scene.add(lintelMesh);
    }

    // Window Glass Glazing
    const glassGeom = new THREE.PlaneGeometry(room.windowWidthM, room.windowHeightM);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      transmission: 0.85,
      ior: 1.52,
    });
    const glassMesh = new THREE.Mesh(glassGeom, glassMat);
    glassMesh.rotation.y = Math.PI / 2;
    glassMesh.position.set(0.1, room.windowSillHeightM + room.windowHeightM / 2, room.widthM / 2);
    scene.add(glassMesh);

    // 3D Louvre Slats Array
    slatMeshesRef.current = [];
    const slatCount = 18;
    const slatHSpacing = room.windowHeightM / slatCount;
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.65,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < slatCount; i++) {
      const slatGeom = new THREE.PlaneGeometry(0.12, room.windowWidthM);
      const slatMesh = new THREE.Mesh(slatGeom, slatMat);
      slatMesh.castShadow = true;
      slatMesh.receiveShadow = true;

      // Position along window height
      const yPos = room.windowSillHeightM + (i + 0.5) * slatHSpacing;
      slatMesh.position.set(0.04, yPos, room.widthM / 2);
      slatMesh.rotation.y = Math.PI / 2;
      slatMesh.rotation.x = (slatTiltDegrees * Math.PI) / 180;

      scene.add(slatMesh);
      slatMeshesRef.current.push(slatMesh);
    }

    // Light Shelf Element (if active)
    if (selectedSystem.type === "light_shelf") {
      const shelfGeom = new THREE.BoxGeometry(0.65, 0.04, room.windowWidthM);
      const shelfMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.85,
        roughness: 0.1,
      });
      const shelfMesh = new THREE.Mesh(shelfGeom, shelfMat);
      shelfMesh.position.set(0.35, room.windowSillHeightM + 1.4, room.widthM / 2);
      scene.add(shelfMesh);
    }

    // False-Color Heatmap Plane (at workplane z = 0.75m)
    const heatGeom = new THREE.PlaneGeometry(room.lengthM, room.widthM);
    const heatMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6,
      visible: showHeatmap,
    });
    const heatMesh = new THREE.Mesh(heatGeom, heatMat);
    heatMesh.rotation.x = -Math.PI / 2;
    heatMesh.position.set(room.lengthM / 2, room.workplaneHeightM + 0.02, room.widthM / 2);
    scene.add(heatMesh);
    heatmapMeshRef.current = heatMesh;

    // Desks / Workstation Layout
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    [1.8, 4.5].forEach((dX) => {
      [1.5, 4.2].forEach((dY) => {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.8), deskMat);
        desk.position.set(dX, 0.375, dY);
        desk.castShadow = true;
        desk.receiveShadow = true;
        scene.add(desk);
      });
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
  }, [isOpen, room, selectedSystem.type]);

  // Update Dynamic Slat Rotations in real time
  useEffect(() => {
    slatMeshesRef.current.forEach((mesh) => {
      if (mesh) {
        mesh.rotation.x = (slatTiltDegrees * Math.PI) / 180;
      }
    });
  }, [slatTiltDegrees]);

  // Update Sun Direction & Intensity
  useEffect(() => {
    if (sunLightRef.current) {
      const altRad = (solarPosition.altitudeDegrees * Math.PI) / 180;
      const azRad = (solarPosition.azimuthDegrees * Math.PI) / 180;

      // Position sun in 3D relative to room window facade
      const sunDist = 18;
      const sunX = -sunDist * Math.cos(altRad) * Math.sin(azRad);
      const sunY = Math.max(1, sunDist * Math.sin(altRad));
      const sunZ = sunDist * Math.cos(altRad) * Math.cos(azRad);

      sunLightRef.current.position.set(sunX, sunY, sunZ);
      sunLightRef.current.intensity = skyType === "cie_overcast" ? 0.2 : 2.8;
    }
  }, [solarPosition, skyType]);

  // Update Heatmap Visibility
  useEffect(() => {
    if (heatmapMeshRef.current) {
      heatmapMeshRef.current.visible = showHeatmap;
    }
  }, [showHeatmap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#10141f] border border-amber-900/60 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 23 DAYLIGHTING SYSTEMS
        ========================================================================= */}
        <div className="px-5 py-3.5 bg-[#181d2e] border-b border-amber-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sun className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Daylighting Systems Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  Tutorial Part 23
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                  EN 17037 & ODLS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Louvre Blinds (Raffstore) • Light Shelves • Ceiling Redirection • Glare Protection (DGP)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Catalog Selector */}
            <select
              value={selectedSystem.id}
              onChange={(e) => {
                const found = ODLS_DAYLIGHT_CATALOG.find((s) => s.id === e.target.value);
                if (found) {
                  setSelectedSystem(found);
                  if (found.louvre) {
                    setSlatTiltDegrees(found.louvre.slatTiltDegrees);
                    setDeploymentPercent(found.louvre.deploymentPercent);
                    setControlStrategy(found.louvre.controlStrategy);
                  }
                  toast.success(`Loaded daylight system: ${found.name}`);
                }
              }}
              className="bg-slate-800 border border-slate-700 text-amber-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-semibold cursor-pointer max-w-xs truncate"
            >
              {ODLS_DAYLIGHT_CATALOG.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>1. 3D Viewport & Slat Control</span>
            </button>

            <button
              onClick={() => setActiveTab("slats")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "slats"
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>2. Louvre & Glazing Config</span>
            </button>

            <button
              onClick={() => setActiveTab("en17037")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "en17037"
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>3. EN 17037 & Glare (DGP)</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  simulationResult.en17037.isProvisionCompliant
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {simulationResult.en17037.daylightProvisionLevel}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("redirection")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "redirection"
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>4. Ceiling Redirection (Lichtlenkung)</span>
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "catalog"
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>5. ODLS Product Catalog</span>
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                {ODLS_DAYLIGHT_CATALOG.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("energy")}
              className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition ${
                activeTab === "energy"
                  ? "border-amber-400 text-amber-300 bg-amber-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>6. LENI Energy Harvesting</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono">
                -{simulationResult.harvesting.daylightAutonomyPercent}%
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 py-1.5 text-xs">
            <span className="text-slate-400">
              Sun Alt: <strong className="text-amber-300">{solarPosition.altitudeDegrees}°</strong>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Avg DF: <strong className="text-cyan-300">{simulationResult.averageDaylightFactor}%</strong>
            </span>
            <span>•</span>
            <span className="text-slate-400">
              Avg Lux: <strong className="text-white">{simulationResult.averageIlluminanceLux} lx</strong>
            </span>
          </div>
        </div>

        {/* =========================================================================
            TAB CONTENT PANELS
        ========================================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* TAB 1: 3D VIEWPORT & SLAT CONTROL */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
              {/* Three.js Viewport */}
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <div ref={mountRef} className="w-full h-full" />

                {/* Floating Camera View HUD */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-[#0c101c]/80 backdrop-blur-md p-2 rounded-lg border border-amber-900/40">
                  <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider mr-1">Camera:</span>
                  <button
                    onClick={() => setCameraView("perspective")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "perspective" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Perspective 3D
                  </button>
                  <button
                    onClick={() => setCameraView("top")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "top" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Top Plan 2D
                  </button>
                  <button
                    onClick={() => setCameraView("workstation")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "workstation" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Desk Eye-Level
                  </button>
                  <button
                    onClick={() => setCameraView("window")}
                    className={`px-2 py-1 text-xs rounded font-medium transition ${
                      cameraView === "window" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Interior Looking In
                  </button>
                </div>

                {/* Floating Heatmap Toggle */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0c101c]/80 backdrop-blur-md p-2 rounded-lg border border-amber-900/40">
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition ${
                      showHeatmap ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Workplane Lux Heatmap</span>
                  </button>
                </div>

                {/* Slat Tilt Angle Display Banner */}
                <div className="absolute top-3 right-3 bg-[#0c101c]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-amber-900/40 text-xs">
                  <span className="text-slate-400">Slat Tilt Angle: </span>
                  <strong className="text-amber-300 font-mono text-sm">{slatTiltDegrees}°</strong>
                </div>
              </div>

              {/* Viewport Side Controls */}
              <div className="w-full md:w-84 bg-[#121626] border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
                {/* Real-time Slat Rotation Slider */}
                <div>
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Louvre Slat Tilt Angle (β)</span>
                    <span className="font-mono text-white text-sm">{slatTiltDegrees}°</span>
                  </h3>
                  <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="1"
                      value={slatTiltDegrees}
                      onChange={(e) => setSlatTiltDegrees(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0° (Horizontal)</span>
                      <span>45° (Cut-off)</span>
                      <span>90° (Closed)</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Control Mode</span>
                      <select
                        value={controlStrategy}
                        onChange={(e) => setControlStrategy(e.target.value as LouvreControlStrategy)}
                        className="bg-slate-800 border border-slate-700 text-xs text-amber-300 rounded px-2 py-1"
                      >
                        <option value="sun_tracking_cutoff">Cut-Off Sun Tracking</option>
                        <option value="light_redirecting_ceiling">Ceiling Redirection</option>
                        <option value="manual_fixed">Manual Fixed Angle</option>
                        <option value="full_closed_glare">Full Closed (Anti-Glare)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sun & Sky Controller */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Sun & Sky Parameters
                  </h3>
                  <div className="space-y-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Hour of Day (Solar Time)</span>
                        <span className="text-amber-400 font-mono">{hourOfDay.toFixed(1)}:00</span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="18"
                        step="0.5"
                        value={hourOfDay}
                        onChange={(e) => setHourOfDay(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">CIE Sky Model</label>
                      <select
                        value={skyType}
                        onChange={(e) => setSkyType(e.target.value as CIESkyType)}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1.5"
                      >
                        <option value="cie_clear_sun">CIE Clear Sky with Sunbeam</option>
                        <option value="cie_overcast">CIE Standard Overcast Sky (DF %)</option>
                        <option value="cie_intermediate">CIE Intermediate Sky</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-slate-500 block">Altitude</span>
                        <strong className="text-amber-300 font-mono">{solarPosition.altitudeDegrees}°</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Profile Angle</span>
                        <strong className="text-cyan-300 font-mono">{solarPosition.incidentProfileAngleDegrees}°</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Daylight Metrics */}
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Average Daylight Factor</span>
                      <strong className="text-sm text-cyan-300 font-mono font-bold">
                        {simulationResult.averageDaylightFactor}%
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">EN 17037 Target</span>
                      <span className="text-xs text-slate-300 font-mono">≥ 2.0%</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Average Workplane Lux</span>
                      <strong className="text-sm text-white font-mono font-bold">
                        {simulationResult.averageIlluminanceLux} lx
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Uniformity U₀</span>
                      <span className="text-xs text-slate-300 font-mono">{simulationResult.uniformityU0}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Daylight Glare (DGP)</span>
                      <strong className="text-sm text-amber-300 font-mono font-bold">
                        {simulationResult.en17037.dgpGlaredRating}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Category</span>
                      <span
                        className={`text-xs font-bold ${
                          simulationResult.en17037.isGlareCompliant
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {simulationResult.en17037.glareCategory}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOUVRE & GLAZING CONFIG */}
          {activeTab === "slats" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <span>Louvre Geometry & Glazing Layer Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure slat dimensions, slat spacing, surface reflectance, and glazing thermal/visual properties.
                  </p>
                </div>

                {/* Slat Geometry */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Slat Width (mm)</label>
                    <input
                      type="number"
                      step="5"
                      min="50"
                      max="150"
                      value={activeSystemConfig.louvre?.slatWidthMm ?? 80}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSelectedSystem((prev) => ({
                          ...prev,
                          louvre: prev.louvre ? { ...prev.louvre, slatWidthMm: val } : undefined,
                        }));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono"
                    />
                    <span className="text-[10.5px] text-slate-500">Standard: 80mm beaded or 90mm Z-slat</span>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Slat Spacing / Pitch (mm)</label>
                    <input
                      type="number"
                      step="5"
                      min="40"
                      max="120"
                      value={activeSystemConfig.louvre?.slatSpacingMm ?? 70}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSelectedSystem((prev) => ({
                          ...prev,
                          louvre: prev.louvre ? { ...prev.louvre, slatSpacingMm: val } : undefined,
                        }));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono"
                    />
                    <span className="text-[10.5px] text-slate-500">Distance between adjacent louvre slats</span>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold text-slate-300 block">Slat Surface Reflectance (ρ)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      max="0.95"
                      value={activeSystemConfig.louvre?.slatReflectance ?? 0.82}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSelectedSystem((prev) => ({
                          ...prev,
                          louvre: prev.louvre ? { ...prev.louvre, slatReflectance: val } : undefined,
                        }));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-300 font-mono"
                    />
                    <span className="text-[10.5px] text-slate-500">0.82 silver metallic, 0.88 high-specular</span>
                  </div>
                </div>

                {/* Glazing Properties */}
                <div className="bg-slate-900/70 p-5 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Window Glazing Thermal & Visual Properties
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Visual Transmittance (τv)</label>
                      <input
                        type="number"
                        step="0.02"
                        min="0.4"
                        max="0.9"
                        value={selectedSystem.glazing.visualTransmittanceTauV}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSelectedSystem((prev) => ({
                            ...prev,
                            glazing: { ...prev.glazing, visualTransmittanceTauV: val },
                          }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Solar Heat Gain (g-value)</label>
                      <input
                        type="number"
                        step="0.02"
                        min="0.2"
                        max="0.8"
                        value={selectedSystem.glazing.solarFactorG}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSelectedSystem((prev) => ({
                            ...prev,
                            glazing: { ...prev.glazing, solarFactorG: val },
                          }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Thermal Transmittance (U-value)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.6"
                        max="2.8"
                        value={selectedSystem.glazing.uValueWpm2K}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSelectedSystem((prev) => ({
                            ...prev,
                            glazing: { ...prev.glazing, uValueWpm2K: val },
                          }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EN 17037 & GLARE (DGP) */}
          {activeTab === "en17037" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span>European Standard EN 17037: Daylight in Buildings</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive assessment across the 4 core pillars: Daylight Provision, Glare Protection (DGP), View Out, and Exposure to Sunlight.
                  </p>
                </div>

                {/* 4 Pillars Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pillar 1: Daylight Provision */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        1. Daylight Provision
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                        {simulationResult.en17037.daylightProvisionLevel}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">50% Space Median DF:</span>
                        <strong className="text-white font-mono">
                          {simulationResult.en17037.achievedSpace50PercentDF}% (Target: ≥ 2.0%)
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">95% Space Minimum DF:</span>
                        <strong className="text-white font-mono">
                          {simulationResult.en17037.achievedSpace95PercentDF}% (Target: ≥ 0.7%)
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      Standard EN 17037 mandates that at least 50% of the room receives daylight factor D ≥ 2.0% for minimum compliance.
                    </p>
                  </div>

                  {/* Pillar 2: Glare Protection (DGP) */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        2. Glare Protection (DGP)
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          simulationResult.en17037.isGlareCompliant
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {simulationResult.en17037.glareCategory}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daylight Glare Probability:</span>
                        <strong className="text-amber-300 font-mono text-sm">
                          {simulationResult.en17037.dgpGlaredRating}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Permissible Threshold:</span>
                        <strong className="text-slate-300 font-mono">DGP ≤ 0.38</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      Evaluated at a workstation desk situated 1.8m from the facade facing the visual task.
                    </p>
                  </div>

                  {/* Pillar 3: View Out */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        3. View Out Quality
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        {simulationResult.en17037.viewOutRating}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                      <div>Horizontal Sight Angle: <strong>&gt; 54° (Wide aperture)</strong></div>
                      <div>Outside Distance: <strong>&gt; 25m to opposite structure</strong></div>
                      <div>Visual Layers: <strong>3 Layers (Ground, Landscape, Sky)</strong></div>
                    </div>
                  </div>

                  {/* Pillar 4: Sunlight Exposure */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
                        4. Sunlight Exposure
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300">
                        Level 2 (Medium)
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                      <div>Equinox Sunlight Duration: <strong>{simulationResult.en17037.sunlightHoursEquinox} Hours</strong></div>
                      <div>Requirement (March 21): <strong>≥ 1.5 Hours for Classrooms</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CEILING REDIRECTION (LICHTLENKUNG) */}
          {activeTab === "redirection" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Deep Room Daylight Redirection (Lichtlenk-Prinzip)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    DIALux evo Tutorial Part 23 demonstrates how daylight redirecting louvres bounce sunlight onto the room ceiling, illuminating deep spaces while preventing window glare.
                  </p>
                </div>

                {/* Point-by-point Room Depth Illuminance Table */}
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-3 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center text-xs">
                    <strong className="text-white">Illuminance Profile across Room Depth (Window to Back Wall)</strong>
                    <span className="text-slate-400">Ceiling Reflectance: ρ = {(room.ceilingReflectance * 100).toFixed(0)}%</span>
                  </div>
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Distance from Window</th>
                        <th className="p-3 text-right">Daylight Factor</th>
                        <th className="p-3 text-right">Workplane Lux</th>
                        <th className="p-3 text-right">Direct Sun</th>
                        <th className="p-3 text-right">Diffuse Sky</th>
                        <th className="p-3 text-right">Ceiling Bounce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {simulationResult.gridPoints.slice(0, 8).map((pt, i) => (
                        <tr key={i} className="hover:bg-slate-800/40">
                          <td className="p-3 text-slate-300 font-sans font-medium">
                            {pt.x.toFixed(1)} meters
                          </td>
                          <td className="p-3 text-right text-cyan-300 font-bold">
                            {pt.daylightFactorPercent}%
                          </td>
                          <td className="p-3 text-right text-white font-bold">
                            {pt.illuminanceLux} lx
                          </td>
                          <td className="p-3 text-right text-amber-400">
                            {pt.directSunlightLux} lx
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            {pt.diffuseSkyLux} lx
                          </td>
                          <td className="p-3 text-right text-emerald-400">
                            +{pt.reflectedCeilingLux} lx
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ODLS PRODUCT CATALOG */}
          {activeTab === "catalog" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Layers className="w-5 h-5 text-amber-400" />
                    <span>Open Daylight System (ODLS) Certified Product Catalog</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Electronic database of manufacturer-tested daylight systems and BSDF angular transmission datasets.
                  </p>
                </div>

                <div className="space-y-3">
                  {ODLS_DAYLIGHT_CATALOG.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedSystem(cat);
                        if (cat.louvre) {
                          setSlatTiltDegrees(cat.louvre.slatTiltDegrees);
                          setDeploymentPercent(cat.louvre.deploymentPercent);
                          setControlStrategy(cat.louvre.controlStrategy);
                        }
                        toast.success(`Selected: ${cat.name}`);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition flex flex-wrap items-center justify-between gap-4 ${
                        selectedSystem.id === cat.id
                          ? "bg-amber-950/20 border-amber-500 ring-1 ring-amber-500/40"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                          <Sun className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-white font-medium">{cat.name}</strong>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                              ODLS CERTIFIED
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Manufacturer: {cat.manufacturer} • Model: {cat.model}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Glazing τv</span>
                          <span className="font-mono text-cyan-300 font-bold">
                            {(cat.glazing.visualTransmittanceTauV * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Solar Factor g</span>
                          <span className="font-mono text-amber-300 font-bold">
                            {cat.glazing.solarFactorG}
                          </span>
                        </div>
                        <button
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            selectedSystem.id === cat.id
                              ? "bg-amber-500 text-black font-bold"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {selectedSystem.id === cat.id ? "Active System" : "Select"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LENI ENERGY HARVESTING */}
          {activeTab === "energy" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    <span>LENI & Artificial Lighting Daylight Harvesting (EN 15193)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evaluates active artificial lighting dimming linked to daylight availability, calculating electrical load reduction and annual carbon savings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Daylight Autonomy</span>
                    <strong className="text-2xl text-emerald-400 font-mono">
                      {simulationResult.harvesting.daylightAutonomyPercent}%
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Percentage of operational hours with &gt; 500 lx natural daylight
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Active Electrical Load</span>
                    <strong className="text-2xl text-amber-300 font-mono">
                      {simulationResult.harvesting.activeArtificialWatts} W
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Reduced from {room.artificialLightingWatts}W installed (-{simulationResult.harvesting.powerReductionWatts}W)
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">Annual Energy Savings</span>
                    <strong className="text-2xl text-cyan-300 font-mono">
                      {simulationResult.harvesting.annualEnergySavedKwh} kWh/a
                    </strong>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Avoids ~{simulationResult.harvesting.co2ReductionKg} kg CO₂/year
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
        <div className="px-5 py-3 bg-[#181d2e] border-t border-amber-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Active Location: <strong className="text-slate-200">{cityName}</strong></span>
            <span>•</span>
            <span>Solar Noon Equinox</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onApplyToSimulation) {
                  onApplyToSimulation(simulationResult);
                  toast.success("Applied daylighting system to main project simulation!");
                }
                onClose();
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer flex items-center gap-1.5"
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
