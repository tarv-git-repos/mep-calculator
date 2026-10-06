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
} from "lucide-react";
import { toast } from "sonner";
import {
  StreetProfile,
  StreetLuminaireProfile,
  PoleArrangementConfig,
  EN13201StandardCriteria,
  StreetCalculationResult,
  StreetOptimizationResult,
  RoadElement,
  CIERoadSurfaceClass,
  StreetArrangementType,
  EN_13201_STANDARDS,
  CIE_ROAD_SURFACES,
  BUILTIN_STREET_LUMINAIRES,
  PRESET_STREET_PROFILES,
  runStreetLightingSimulation,
  optimizeStreetLighting,
} from "@/lib/dialux-street-engine";

export interface DialuxStreetLightingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  projectCode?: string;
}

export function DialuxStreetLightingModal({
  isOpen,
  onClose,
  projectName = "Municipal Road Infrastructure",
  projectCode = "ST-13201",
}: DialuxStreetLightingModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "luminaires" | "standards" | "optimizer" | "energy">("profile");

  // Active Street Profile
  const [selectedProfileId, setSelectedProfileId] = useState<string>("profile-urban-main");
  const [activeProfile, setActiveProfile] = useState<StreetProfile>(PRESET_STREET_PROFILES[0]);

  // Active Luminaire Profile
  const [selectedLuminaireId, setSelectedLuminaireId] = useState<string>("lum-st-1");
  const activeLuminaire = useMemo(() => {
    return BUILTIN_STREET_LUMINAIRES.find((l) => l.id === selectedLuminaireId) || BUILTIN_STREET_LUMINAIRES[0];
  }, [selectedLuminaireId]);

  // Pole & Arrangement Geometry
  const [arrangementType, setArrangementType] = useState<StreetArrangementType>("single_sided_left");
  const [poleSpacing, setPoleSpacing] = useState<number>(30.0);
  const [mountingHeight, setMountingHeight] = useState<number>(8.0);
  const [boomLength, setBoomLength] = useState<number>(0.8);
  const [boomTiltDeg, setBoomTiltDeg] = useState<number>(5.0);
  const [setbackDistance, setSetbackDistance] = useState<number>(0.8);
  const [maintenanceFactor, setMaintenanceFactor] = useState<number>(0.85);

  // Target Standards
  const [targetClassId, setTargetClassId] = useState<string>("M3");
  const [surfaceClass, setSurfaceClass] = useState<CIERoadSurfaceClass>("R3");

  // 3D Viewport Controls
  const [cameraMode, setCameraMode] = useState<"3d" | "top" | "observer">("3d");
  const [showFalseColor, setShowFalseColor] = useState<boolean>(true);
  const [showIsolux, setShowIsolux] = useState<boolean>(true);
  const [showLightCones, setShowLightCones] = useState<boolean>(true);
  const [showLuminanceGrid, setShowLuminanceGrid] = useState<boolean>(true);

  // Optimizer State
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<StreetOptimizationResult | null>(null);

  // 2. Synchronize Profile Selection
  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    const found = PRESET_STREET_PROFILES.find((p) => p.id === profileId);
    if (found) {
      setActiveProfile(JSON.parse(JSON.stringify(found)));
      toast.info(`Loaded street profile: ${found.name}`);
    }
  };

  // 3. Compute Real-time Simulation
  const poleConfig: PoleArrangementConfig = useMemo(
    () => ({
      arrangementType,
      poleSpacing,
      mountingHeight,
      boomLength,
      boomTiltDeg,
      setbackDistance,
      maintenanceFactor,
    }),
    [arrangementType, poleSpacing, mountingHeight, boomLength, boomTiltDeg, setbackDistance, maintenanceFactor]
  );

  const simulationResult: StreetCalculationResult = useMemo(() => {
    return runStreetLightingSimulation(activeProfile, activeLuminaire, poleConfig, targetClassId);
  }, [activeProfile, activeLuminaire, poleConfig, targetClassId]);

  // 4. Three.js 3D Viewport Setup
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1218);
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

    // Apply Camera Perspective
    const totalW = activeProfile.totalWidth;
    const midX = poleSpacing / 2;
    const midY = totalW / 2;

    if (cameraMode === "3d") {
      camera.position.set(-poleSpacing * 0.7, mountingHeight * 1.8, totalW * 1.9);
      controls.target.set(midX, 0, midY);
    } else if (cameraMode === "top") {
      camera.position.set(midX, Math.max(poleSpacing, totalW) * 2.2, midY);
      controls.target.set(midX, 0, midY);
    } else if (cameraMode === "observer") {
      // Standard CIE 140 Observer Position (60m back, 1.5m eye height, looking 1° down along driving lane)
      camera.position.set(-60, 1.5, midY);
      controls.target.set(30, 0, midY);
    }
    controls.update();

    // Ambient & Directional Night Lighting
    const ambLight = new THREE.AmbientLight(0x222630, 0.5);
    scene.add(ambLight);

    const moonLight = new THREE.DirectionalLight(0x38bdf8, 0.25);
    moonLight.position.set(-20, 40, -20);
    scene.add(moonLight);

    // =========================================================================
    // 3D ROAD CROSS-SECTION & SURFACE GENERATION
    // =========================================================================
    const streetLength = poleSpacing * 4; // Render 4 spans for realistic visual continuity
    const startX = -poleSpacing * 1.5;

    let currentZ = 0;
    activeProfile.elements.forEach((el) => {
      const elW = el.width;
      const elH = el.heightOffset || 0;

      // Color and material based on road element type
      let matColor = 0x1e2430; // default asphalt
      let roughness = 0.85;

      if (el.type === "carriageway") {
        matColor = 0x181c24; // dark asphalt
        roughness = 0.75;
      } else if (el.type === "sidewalk") {
        matColor = 0x475569; // concrete paving
        roughness = 0.9;
      } else if (el.type === "cyclepath") {
        matColor = 0x991b1b; // red asphalt cycle track
        roughness = 0.8;
      } else if (el.type === "grass_verge") {
        matColor = 0x166534; // green turf
        roughness = 0.95;
      } else if (el.type === "median") {
        matColor = 0x334155; // raised concrete median
        roughness = 0.85;
      } else if (el.type === "parking_lane") {
        matColor = 0x242c38;
      }

      // Slab Geometry
      const slabGeo = new THREE.BoxGeometry(streetLength, Math.max(0.04, elH), elW);
      const slabMat = new THREE.MeshStandardMaterial({ color: matColor, roughness });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(startX + streetLength / 2, elH / 2, currentZ + elW / 2);
      scene.add(slabMesh);

      // Carriageway Lane Markings (White dashed dividers & solid curb lines)
      if (el.type === "carriageway") {
        const numL = el.numLanes || 2;
        const laneW = elW / numL;

        // Solid Outer Curb Edge Markings
        const edgeLineGeo = new THREE.PlaneGeometry(streetLength, 0.15);
        edgeLineGeo.rotateX(-Math.PI / 2);
        const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

        const leftEdge = new THREE.Mesh(edgeLineGeo, edgeMat);
        leftEdge.position.set(startX + streetLength / 2, 0.025, currentZ + 0.12);
        scene.add(leftEdge);

        const rightEdge = new THREE.Mesh(edgeLineGeo, edgeMat);
        rightEdge.position.set(startX + streetLength / 2, 0.025, currentZ + elW - 0.12);
        scene.add(rightEdge);

        // Dashed Lane Dividers
        for (let l = 1; l < numL; l++) {
          const dashZ = currentZ + l * laneW;
          const dashGroup = new THREE.Group();
          const dashLen = 3.0;
          const gapLen = 6.0;
          const cycle = dashLen + gapLen;

          for (let x = startX; x < startX + streetLength; x += cycle) {
            const dashMesh = new THREE.Mesh(new THREE.PlaneGeometry(dashLen, 0.12), edgeMat);
            dashMesh.rotateX(-Math.PI / 2);
            dashMesh.position.set(x + dashLen / 2, 0.025, dashZ);
            dashGroup.add(dashMesh);
          }
          scene.add(dashGroup);
        }
      }

      // Concrete Curb step for elevated sidewalks
      if (elH > 0.05) {
        const curbGeo = new THREE.BoxGeometry(streetLength, elH, 0.15);
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
        const curbMesh = new THREE.Mesh(curbGeo, curbMat);
        curbMesh.position.set(startX + streetLength / 2, elH / 2, currentZ);
        scene.add(curbMesh);
      }

      currentZ += elW;
    });

    // =========================================================================
    // FALSE-COLOR ROAD LUMINANCE / ILLUMINANCE HEATMAP OVERLAY
    // =========================================================================
    if (showFalseColor && simulationResult.gridPoints.length > 0) {
      const resCols = simulationResult.gridCols;
      const resRows = simulationResult.gridRows;

      const canvas = document.createElement("canvas");
      canvas.width = resCols * 16;
      canvas.height = resRows * 16;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const targetL = simulationResult.targetStandard.L_avg_min || 1.0;

        // Color mapping for luminance (0 to 2.5 * target)
        const getStreetFalseColor = (val: number, maxVal: number) => {
          const ratio = Math.max(0, Math.min(1.0, val / maxVal));
          if (ratio < 0.2) return "#1e1b4b"; // deep blue
          if (ratio < 0.4) return "#0284c7"; // light blue
          if (ratio < 0.6) return "#10b981"; // green (target compliant)
          if (ratio < 0.8) return "#f59e0b"; // amber
          return "#ef4444"; // red
        };

        simulationResult.gridPoints.forEach((pt) => {
          const normX = pt.x / poleSpacing;
          const normY = pt.y / totalW;
          const px = normX * canvas.width;
          const py = normY * canvas.height;

          const color = getStreetFalseColor(pt.luminanceCdM2, targetL * 2.0);
          const rad = Math.max(10, (canvas.width / resCols) * 0.95);

          const grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
          grad.addColorStop(0, color);
          grad.addColorStop(1, "transparent");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, 2 * Math.PI);
          ctx.fill();
        });

        // Numeric Luminance Sample Badges
        if (showLuminanceGrid) {
          ctx.font = "bold 9px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const sampleStep = Math.max(1, Math.round(resCols / 6));

          simulationResult.gridPoints.forEach((pt, idx) => {
            const r = Math.floor(idx / resCols);
            const c = idx % resCols;
            if (r % 2 === 0 && c % sampleStep === 0) {
              const px = (pt.x / poleSpacing) * canvas.width;
              const py = (pt.y / totalW) * canvas.height;
              ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
              ctx.fillRect(px - 14, py - 6, 28, 12);
              ctx.fillStyle = "#ffffff";
              ctx.fillText(`${pt.luminanceCdM2}`, px, py);
            }
          });
        }

        const texture = new THREE.CanvasTexture(canvas);
        const heatGeo = new THREE.PlaneGeometry(poleSpacing, totalW);
        heatGeo.rotateX(-Math.PI / 2);
        heatGeo.translate(poleSpacing / 2, 0.035, totalW / 2);

        const heatMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
        });
        const heatMesh = new THREE.Mesh(heatGeo, heatMat);
        scene.add(heatMesh);

        // Evaluation Field Perimeter Border (EN 13201-3 Standard Grid box)
        const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(poleSpacing, totalW));
        borderGeo.rotateX(-Math.PI / 2);
        borderGeo.translate(poleSpacing / 2, 0.04, totalW / 2);
        const borderMesh = new THREE.LineSegments(
          borderGeo,
          new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 })
        );
        scene.add(borderMesh);
      }
    }

    // =========================================================================
    // 3D LIGHT POLES, BRACKET BOOMS & LUMINAIRE FIXTURES
    // =========================================================================
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    const lumMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    });

    const create3DPole = (poleX: number, poleZ: number, pointsTowardsPositiveZ: boolean) => {
      const poleGroup = new THREE.Group();

      // 1. Base Plate & Foundation
      const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.30, 0.15, 16), poleMat);
      baseMesh.position.set(0, 0.075, 0);
      poleGroup.add(baseMesh);

      // 2. Main Vertical Mast Column
      const mastH = mountingHeight - 0.6;
      const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, mastH, 16), poleMat);
      mastMesh.position.set(0, mastH / 2, 0);
      poleGroup.add(mastMesh);

      // 3. Curved Outreach Boom Arm
      const boomDir = pointsTowardsPositiveZ ? 1 : -1;
      const boomCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, mastH, 0),
        new THREE.Vector3(0, mountingHeight - 0.1, boomDir * (boomLength * 0.4)),
        new THREE.Vector3(0, mountingHeight, boomDir * boomLength),
      ]);
      const boomGeo = new THREE.TubeGeometry(boomCurve, 12, 0.045, 8, false);
      const boomMesh = new THREE.Mesh(boomGeo, poleMat);
      poleGroup.add(boomMesh);

      // 4. Modern Aerodynamic LED Street Luminaire Head
      const lumHeadGeo = new THREE.BoxGeometry(0.35, 0.08, 0.70);
      const lumHead = new THREE.Mesh(lumHeadGeo, lumMat);
      lumHead.position.set(0, mountingHeight, boomDir * boomLength);
      lumHead.rotation.x = (boomDir * boomTiltDeg * Math.PI) / 180;
      poleGroup.add(lumHead);

      // 5. Dynamic SpotLight Casting Down on Road Pavement
      const spot = new THREE.SpotLight(0xfffbeb, 2.5);
      spot.position.set(0, mountingHeight, boomDir * boomLength);
      spot.target.position.set(0, 0, boomDir * (boomLength + 1.5));
      spot.angle = (65 * Math.PI) / 180;
      spot.penumbra = 0.6;
      spot.distance = mountingHeight * 3.5;
      spot.decay = 1.3;
      poleGroup.add(spot);
      poleGroup.add(spot.target);

      // 6. Photometric Batwing Roadway Light Cone
      if (showLightCones) {
        const coneHeight = mountingHeight;
        const coneRadius = Math.tan((60 * Math.PI) / 180) * coneHeight * 0.7;
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
        coneGeo.translate(0, -coneHeight / 2, 0);

        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.10,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.set(0, mountingHeight, boomDir * boomLength);
        poleGroup.add(coneMesh);
      }

      poleGroup.position.set(poleX, 0, poleZ);
      return poleGroup;
    };

    // Position poles based on arrangement type
    const roadEdgeLeftZ = 0 - setbackDistance;
    const roadEdgeRightZ = totalW + setbackDistance;

    for (let k = -1; k <= 3; k++) {
      const pX = k * poleSpacing;

      if (arrangementType === "single_sided_left") {
        scene.add(create3DPole(pX, roadEdgeLeftZ, true));
      } else if (arrangementType === "single_sided_right") {
        scene.add(create3DPole(pX, roadEdgeRightZ, false));
      } else if (arrangementType === "two_sided_opposite") {
        scene.add(create3DPole(pX, roadEdgeLeftZ, true));
        scene.add(create3DPole(pX, roadEdgeRightZ, false));
      } else if (arrangementType === "two_sided_staggered") {
        scene.add(create3DPole(pX, roadEdgeLeftZ, true));
        scene.add(create3DPole(pX + poleSpacing / 2, roadEdgeRightZ, false));
      } else if (arrangementType === "median") {
        const medianZ = totalW / 2;
        scene.add(create3DPole(pX, medianZ, true));
        scene.add(create3DPole(pX, medianZ, false));
      }
    }

    // 7. CIE 140 60m Observer Visual Marker (Blue human marker at X = -60m)
    const obsMarkerGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.7, 12);
    const obsMarkerMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    const obsMarker = new THREE.Mesh(obsMarkerGeo, obsMarkerMat);
    obsMarker.position.set(-60, 0.85, totalW / 2);
    scene.add(obsMarker);

    // Sightline from observer to calculation field center
    const sightGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-60, 1.5, totalW / 2),
      new THREE.Vector3(poleSpacing / 2, 0, totalW / 2),
    ]);
    const sightLine = new THREE.Line(
      sightGeo,
      new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 2, gapSize: 1 })
    );
    sightLine.computeLineDistances();
    scene.add(sightLine);

    // Render loop
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
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      controls.dispose();
    };
  }, [
    isOpen,
    activeProfile,
    poleConfig,
    activeLuminaire,
    cameraMode,
    showFalseColor,
    showIsolux,
    showLightCones,
    showLuminanceGrid,
    poleSpacing,
    mountingHeight,
    boomLength,
    boomTiltDeg,
    setbackDistance,
    arrangementType,
    simulationResult,
  ]);

  // 5. Automatic Street Optimizer Handler (Tutorial #10)
  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    toast.info("Running DIALux evo Street Lighting Optimizer...");

    setTimeout(() => {
      try {
        const res = optimizeStreetLighting(activeProfile, activeLuminaire, poleConfig, targetClassId);
        setOptimizationResult(res);
        setIsOptimizing(false);
        toast.success(
          `Optimization complete! Best pole spacing: ${res.bestSpacing}m (Evaluated ${res.evaluatedVariantsCount} variants)`
        );
      } catch (err) {
        setIsOptimizing(false);
        toast.error("Optimization failed.");
      }
    }, 400);
  };

  const handleApplyOptimalVariant = (v: StreetOptimizationResult["rankedVariants"][0]) => {
    setPoleSpacing(v.spacing);
    setMountingHeight(v.height);
    setBoomTiltDeg(v.tilt);
    toast.success(`Applied optimal parameters: Spacing ${v.spacing}m, Height ${v.height}m, Tilt ${v.tilt}°`);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md ${
        isFullscreen ? "p-0" : "p-1 sm:p-2"
      } select-none animate-in fade-in-50`}
    >
      <div
        className={`bg-[#181b22] border border-slate-700/80 ${
          isFullscreen ? "rounded-none h-full w-full" : "rounded-xl shadow-2xl w-full h-[98vh]"
        } flex flex-col text-slate-100 overflow-hidden font-sans relative`}
      >
        {/* =========================================================================
            HEADER BAR
        ========================================================================= */}
        <div className="h-10 bg-[#13161c] border-b border-slate-800 flex items-center justify-between px-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Compass className="size-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wide">
                DIALux evo Road Lighting Design (EN 13201 / CIE 115)
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] border border-blue-500/30">
                {activeProfile.name}
              </span>
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                  simulationResult.isOverallCompliant
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                }`}
              >
                {simulationResult.isOverallCompliant
                  ? `✓ COMPLIANT (${simulationResult.targetStandard.classId})`
                  : `✕ NON-COMPLIANT (${simulationResult.targetStandard.classId})`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-rose-600 transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN WORKSPACE: LEFT INSPECTOR DOCK + CENTER 3D CAD VIEWPORT
        ========================================================================= */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT SIDEBAR: PROFILE, LUMINAIRES, STANDARDS, OPTIMIZER, ENERGY */}
          <div className="w-96 bg-[#1f232c] border-r border-slate-800 flex flex-col shrink-0">
            {/* Navigation Tabs */}
            <div className="h-9 bg-[#171a21] border-b border-slate-800 flex items-center justify-around px-1 text-[11px] font-medium text-slate-300">
              {[
                { id: "profile", label: "Street Profile", icon: Box },
                { id: "luminaires", label: "Luminaires & Poles", icon: Sun },
                { id: "standards", label: "EN 13201", icon: CheckCircle2 },
                { id: "optimizer", label: "Optimizer", icon: Sparkles },
                { id: "energy", label: "Energy", icon: Zap },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`h-full px-2 flex items-center gap-1 transition cursor-pointer border-b-2 ${
                      isActive
                        ? "text-amber-400 border-amber-400 font-bold bg-slate-800/40"
                        : "border-transparent hover:text-white"
                    }`}
                  >
                    <Icon className="size-3" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT CONTAINER */}
            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-4">
              {/* TAB 1: STREET PROFILE & CROSS-SECTION */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                      Select Road Profile Preset
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => handleSelectProfile(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {PRESET_STREET_PROFILES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.totalWidth}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2D Cross Section SVG Preview */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 block mb-2">
                      Road Cross-Section Profile ({activeProfile.totalWidth.toFixed(1)}m total)
                    </span>
                    <div className="h-16 w-full bg-slate-950 rounded flex items-center overflow-hidden border border-slate-800">
                      {activeProfile.elements.map((el) => {
                        const pct = (el.width / activeProfile.totalWidth) * 100;
                        let bg = "bg-slate-700";
                        if (el.type === "carriageway") bg = "bg-slate-900 border-x border-slate-600";
                        if (el.type === "sidewalk") bg = "bg-slate-600";
                        if (el.type === "cyclepath") bg = "bg-red-900/60";
                        if (el.type === "grass_verge") bg = "bg-emerald-900/60";
                        if (el.type === "median") bg = "bg-amber-900/50";

                        return (
                          <div
                            key={el.id}
                            style={{ width: `${pct}%` }}
                            className={`h-full ${bg} flex flex-col items-center justify-center text-[9px] p-0.5 text-center font-mono`}
                            title={`${el.name} (${el.width}m)`}
                          >
                            <span className="truncate w-full text-slate-200">{el.name.split(" ")[0]}</span>
                            <span className="text-slate-400 text-[8px]">{el.width}m</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Road Surface Class (CIE R-Tables) */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      CIE Road Surface Reflectance Table (EN 13201-3)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["R1", "R2", "R3", "R4"] as CIERoadSurfaceClass[]).map((rKey) => (
                        <button
                          key={rKey}
                          onClick={() => setSurfaceClass(rKey)}
                          className={`p-2 rounded-lg text-left border cursor-pointer transition ${
                            surfaceClass === rKey
                              ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                              : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          <div className="font-mono text-xs">{rKey}</div>
                          <div className="text-[10px] text-slate-400">{CIE_ROAD_SURFACES[rKey].name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Elements List */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-300 block">Roadway Elements</span>
                    {activeProfile.elements.map((el, idx) => (
                      <div
                        key={el.id}
                        className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-white">{el.name}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">
                            {el.type === "carriageway" ? `${el.numLanes || 2} Lanes` : el.type}
                          </span>
                        </div>
                        <span className="font-mono text-amber-400 font-bold">{el.width.toFixed(2)} m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: LUMINAIRE & POLE GEOMETRY */}
              {activeTab === "luminaires" && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                      Street Luminaire Model
                    </label>
                    <select
                      value={selectedLuminaireId}
                      onChange={(e) => setSelectedLuminaireId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {BUILTIN_STREET_LUMINAIRES.map((lum) => (
                        <option key={lum.id} value={lum.id}>
                          {lum.name} ({lum.wattage}W, {lum.totalLumens} lm)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Arrangement Scheme */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                      Arrangement Scheme
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "single_sided_left", label: "Single-sided (Left)" },
                        { id: "single_sided_right", label: "Single-sided (Right)" },
                        { id: "two_sided_opposite", label: "Two-sided Opposite" },
                        { id: "two_sided_staggered", label: "Two-sided Staggered" },
                        { id: "median", label: "Central Median" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setArrangementType(item.id as any)}
                          className={`p-1.5 rounded-lg text-xs cursor-pointer border text-left transition ${
                            arrangementType === item.id
                              ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                              : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pole Geometry Sliders */}
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">Pole Spacing (S):</span>
                        <span className="font-mono text-amber-400 font-bold">{poleSpacing.toFixed(1)} m</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="55"
                        step="1"
                        value={poleSpacing}
                        onChange={(e) => setPoleSpacing(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">Mounting Height (H):</span>
                        <span className="font-mono text-amber-400 font-bold">{mountingHeight.toFixed(1)} m</span>
                      </div>
                      <input
                        type="range"
                        min="6.0"
                        max="14.0"
                        step="0.5"
                        value={mountingHeight}
                        onChange={(e) => setMountingHeight(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">Boom Outreach / Overhang:</span>
                        <span className="font-mono text-amber-400 font-bold">{boomLength.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min="-0.5"
                        max="2.0"
                        step="0.1"
                        value={boomLength}
                        onChange={(e) => setBoomLength(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">Boom Tilt Angle (α):</span>
                        <span className="font-mono text-amber-400 font-bold">{boomTiltDeg.toFixed(1)}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="1"
                        value={boomTiltDeg}
                        onChange={(e) => setBoomTiltDeg(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">Distance to Curb (Setback):</span>
                        <span className="font-mono text-amber-400 font-bold">{setbackDistance.toFixed(2)} m</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="2.5"
                        step="0.1"
                        value={setbackDistance}
                        onChange={(e) => setSetbackDistance(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EN 13201 STANDARDS COMPLIANCE TABLE */}
              {activeTab === "standards" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1 block">
                      Target EN 13201 Lighting Class
                    </label>
                    <select
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {EN_13201_STANDARDS.map((s) => (
                        <option key={s.classId} value={s.classId}>
                          {s.classId} — {s.name} ({s.description.slice(0, 35)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Real-time Compliance Evaluation Table */}
                  <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden">
                    <div className="p-2.5 bg-slate-800/60 font-bold text-xs flex items-center justify-between border-b border-slate-700/60">
                      <span>EN 13201 Evaluation Criteria</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          simulationResult.isOverallCompliant
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {simulationResult.isOverallCompliant ? "ALL PASS" : "FAIL"}
                      </span>
                    </div>

                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                          <th className="p-2">Metric</th>
                          <th className="p-2">Calculated</th>
                          <th className="p-2">Target</th>
                          <th className="p-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        <tr>
                          <td className="p-2 text-slate-300">L_avg (cd/m²)</td>
                          <td className="p-2 font-bold text-white">{simulationResult.L_avg.toFixed(2)}</td>
                          <td className="p-2 text-slate-400">≥ {simulationResult.targetStandard.L_avg_min ?? "-"}</td>
                          <td className="p-2 text-right font-bold">
                            {simulationResult.isLAvgCompliant ? (
                              <span className="text-emerald-400">✓ Pass</span>
                            ) : (
                              <span className="text-rose-400">✕ Fail</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 text-slate-300">U_o (Overall)</td>
                          <td className="p-2 font-bold text-white">{simulationResult.U_o.toFixed(2)}</td>
                          <td className="p-2 text-slate-400">≥ {simulationResult.targetStandard.U_o_min ?? "-"}</td>
                          <td className="p-2 text-right font-bold">
                            {simulationResult.isUoCompliant ? (
                              <span className="text-emerald-400">✓ Pass</span>
                            ) : (
                              <span className="text-rose-400">✕ Fail</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 text-slate-300">U_l (Longitudinal)</td>
                          <td className="p-2 font-bold text-white">{simulationResult.U_l.toFixed(2)}</td>
                          <td className="p-2 text-slate-400">≥ {simulationResult.targetStandard.U_l_min ?? "-"}</td>
                          <td className="p-2 text-right font-bold">
                            {simulationResult.isUlCompliant ? (
                              <span className="text-emerald-400">✓ Pass</span>
                            ) : (
                              <span className="text-rose-400">✕ Fail</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 text-slate-300">TI Glare (%)</td>
                          <td className="p-2 font-bold text-white">{simulationResult.TI_glare.toFixed(1)}%</td>
                          <td className="p-2 text-slate-400">≤ {simulationResult.targetStandard.TI_max ?? "-"}%</td>
                          <td className="p-2 text-right font-bold">
                            {simulationResult.isTICompliant ? (
                              <span className="text-emerald-400">✓ Pass</span>
                            ) : (
                              <span className="text-rose-400">✕ Fail</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 text-slate-300">EIR / SR</td>
                          <td className="p-2 font-bold text-white">{simulationResult.EIR.toFixed(2)}</td>
                          <td className="p-2 text-slate-400">≥ {simulationResult.targetStandard.EIR_min ?? "-"}</td>
                          <td className="p-2 text-right font-bold">
                            {simulationResult.isEIRCompliant ? (
                              <span className="text-emerald-400">✓ Pass</span>
                            ) : (
                              <span className="text-rose-400">✕ Fail</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1">
                    <span className="text-slate-400">Average Road Illuminance:</span>
                    <span className="text-amber-400 font-mono font-bold ml-2">
                      {simulationResult.E_avg_road.toFixed(1)} lx (E_min: {simulationResult.E_min_road.toFixed(1)} lx)
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 4: AUTOMATIC STREET OPTIMIZER */}
              {activeTab === "optimizer" && (
                <div className="space-y-3.5">
                  <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-3 rounded-xl border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-1.5 text-amber-400 font-bold">
                      <Sparkles className="size-4" />
                      <span>DIALux evo Street Optimizer</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                      Automatically iterates through pole spacings, heights, and tilt angles to find the{" "}
                      <strong>maximum compliant pole distance</strong> to minimize installation and energy costs per
                      kilometer.
                    </p>

                    <button
                      onClick={handleRunOptimizer}
                      disabled={isOptimizing}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sparkles className="size-3.5" />
                      <span>{isOptimizing ? "Optimizing Layout..." : "Run Optimizer for Class " + targetClassId}</span>
                    </button>
                  </div>

                  {/* Results Ranking Table */}
                  {optimizationResult && (
                    <div className="space-y-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                            Optimal Configuration
                          </span>
                          <span className="font-mono text-white text-xs">
                            Spacing: <strong>{optimizationResult.bestSpacing}m</strong> | Height:{" "}
                            <strong>{optimizationResult.bestHeight}m</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => handleApplyOptimalVariant(optimizationResult.rankedVariants[0])}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                        {optimizationResult.rankedVariants.map((v, i) => (
                          <div
                            key={i}
                            className={`p-1.5 rounded flex items-center justify-between border ${
                              v.isCompliant
                                ? "bg-slate-900 border-slate-800 text-slate-200"
                                : "bg-slate-900/50 border-rose-950/40 text-slate-500"
                            }`}
                          >
                            <span>
                              #{i + 1} S: {v.spacing}m | H: {v.height}m | {v.tilt}°
                            </span>
                            <span>L: {v.L_avg.toFixed(2)} cd/m²</span>
                            <span className={v.isCompliant ? "text-emerald-400 font-bold" : "text-rose-400"}>
                              {v.isCompliant ? "✓ Pass" : "✕ Fail"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ENERGY EFFICIENCY (EN 13201-5) */}
              {activeTab === "energy" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-slate-400">Power Density (PDI)</span>
                      <span className="text-amber-400 font-mono font-bold text-sm">
                        {simulationResult.PDI.toFixed(3)} W/(lx·m²)
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-slate-400">Annual Energy (AECI)</span>
                      <span className="text-cyan-400 font-mono font-bold text-sm">
                        {simulationResult.AECI.toFixed(1)} kWh/m²/a
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-slate-400">Connected Power</span>
                      <span className="text-emerald-400 font-mono font-bold text-sm">
                        {simulationResult.connectedPowerPerKm.toFixed(1)} kW / km
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                      <span className="text-slate-400">Poles per Kilometer</span>
                      <span className="text-purple-400 font-mono font-bold text-sm">
                        {simulationResult.polesPerKm} poles / km
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <span className="font-bold text-slate-300 block">EN 13201-5 Energy Evaluation</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Calculated on 4,000 annual burning hours. Power density indicator complies with modern EU green
                      procurement directives.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CENTER: 3D CAD THREE.JS VIEWPORT & FLOATING TOOLBAR */}
          <div className="flex-1 flex flex-col relative bg-[#0f1218]">
            {/* Top Viewport Navigation Controls */}
            <div className="h-9 bg-[#191d26] border-b border-slate-800 flex items-center justify-between px-3 text-xs z-20">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCameraMode("3d")}
                  className={`px-2 py-1 rounded cursor-pointer transition flex items-center gap-1 ${
                    cameraMode === "3d" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Box className="size-3" />
                  <span>3D Orbit</span>
                </button>
                <button
                  onClick={() => setCameraMode("top")}
                  className={`px-2 py-1 rounded cursor-pointer transition flex items-center gap-1 ${
                    cameraMode === "top" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Grid className="size-3" />
                  <span>2D Top Plan</span>
                </button>
                <button
                  onClick={() => setCameraMode("observer")}
                  className={`px-2 py-1 rounded cursor-pointer transition flex items-center gap-1 ${
                    cameraMode === "observer" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title="CIE 140 Observer Viewpoint (Driver eye at 60m looking down at 1°)"
                >
                  <Camera className="size-3" />
                  <span>CIE 60m Observer View</span>
                </button>
              </div>

              {/* Display Aids Toggles */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={() => setShowFalseColor(!showFalseColor)}
                  className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition border ${
                    showFalseColor
                      ? "bg-purple-600/30 text-purple-300 border-purple-500/50"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  <Layers className="size-3" />
                  <span>False Color</span>
                </button>
                <button
                  onClick={() => setShowLightCones(!showLightCones)}
                  className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition border ${
                    showLightCones
                      ? "bg-amber-600/30 text-amber-300 border-amber-500/50"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  <Sun className="size-3" />
                  <span>Light Cones</span>
                </button>
                <button
                  onClick={() => setShowLuminanceGrid(!showLuminanceGrid)}
                  className={`px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition border ${
                    showLuminanceGrid
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500/50"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  <Grid className="size-3" />
                  <span>Values Grid</span>
                </button>
              </div>
            </div>

            {/* Canvas Mount Container */}
            <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
              <div ref={mountRef} className="w-full h-full" />

              {/* False Color Legend Bar (Bottom Left) */}
              {showFalseColor && (
                <div className="absolute bottom-3 left-3 bg-[#191c22]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-lg text-[10.5px] z-10 flex flex-col gap-1.5 pointer-events-none">
                  <span className="font-semibold text-slate-300">
                    Road Luminance Scale ({simulationResult.targetStandard.classId})
                  </span>
                  <div
                    className="h-3 w-48 rounded"
                    style={{
                      background: "linear-gradient(to right, #1e1b4b, #0284c7, #10b981, #f59e0b, #ef4444)",
                    }}
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono w-48">
                    <span>0.0 cd/m²</span>
                    <span className="text-emerald-400 font-bold">
                      {simulationResult.targetStandard.L_avg_min ?? 1.0} cd/m²
                    </span>
                    <span>&gt;{((simulationResult.targetStandard.L_avg_min ?? 1.0) * 2.0).toFixed(1)} cd/m²</span>
                  </div>
                </div>
              )}

              {/* Floating Performance Indicator HUD (Top Right) */}
              <div className="absolute top-3 right-3 bg-[#191c22]/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-2xl text-[11px] z-10 flex items-center gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Avg Luminance L_avg</span>
                  <strong className="text-amber-400 font-mono text-sm">
                    {simulationResult.L_avg.toFixed(2)} cd/m²
                  </strong>
                </div>
                <div className="border-l border-slate-700 pl-3">
                  <span className="text-slate-400 block text-[10px]">Overall Uniformity U_o</span>
                  <strong className="text-white font-mono text-sm">{simulationResult.U_o.toFixed(2)}</strong>
                </div>
                <div className="border-l border-slate-700 pl-3">
                  <span className="text-slate-400 block text-[10px]">Longitudinal U_l</span>
                  <strong className="text-white font-mono text-sm">{simulationResult.U_l.toFixed(2)}</strong>
                </div>
                <div className="border-l border-slate-700 pl-3">
                  <span className="text-slate-400 block text-[10px]">Threshold Inc. TI</span>
                  <strong className="text-cyan-400 font-mono text-sm">{simulationResult.TI_glare.toFixed(1)}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
