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
  ChevronDown,
  Zap,
  TrendingUp,
  Ruler,
  Car,
  Footprints,
  Eye,
  Plus,
  Trash2,
  ShieldCheck,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  RoundaboutGeometry,
  RoundaboutArm,
  RoundaboutLuminaireProfile,
  RoundaboutPoleConfig,
  EN13201CClassCriteria,
  RoundaboutCalculationResult,
  RoundaboutOptimizationResult,
  RoundaboutOptimizationVariant,
  RoundaboutArrangementType,
  CentralLandscapingType,
  LuminaireAimingMode,
  ROUNDABOUT_C_STANDARDS,
  BUILTIN_ROUNDABOUT_LUMINAIRES,
  PRESET_ROUNDABOUTS,
  runRoundaboutSimulation,
  optimizeRoundaboutLighting,
  getRoundaboutFalseColor,
} from "@/lib/dialux-roundabout-engine";

export interface DialuxRoundaboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  projectCode?: string;
}

export function DialuxRoundaboutModal({
  isOpen,
  onClose,
  projectName = "Municipal Intersection Infrastructure",
  projectCode = "RB-13201",
}: DialuxRoundaboutModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"geometry" | "luminaires" | "standards" | "optimizer" | "report">("geometry");

  // Geometry State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("rb-suburban-dual");
  const [geometry, setGeometry] = useState<RoundaboutGeometry>(PRESET_ROUNDABOUTS[0]);

  // Tape measure scale tool (DIALux Tutorial 16 verification step)
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurePointA, setMeasurePointA] = useState<{ x: number; y: number } | null>(null);
  const [measurePointB, setMeasurePointB] = useState<{ x: number; y: number } | null>(null);

  // Luminaire Selection
  const [selectedLuminaireId, setSelectedLuminaireId] = useState<string>("lum-rb-1");
  const activeLuminaire = useMemo(() => {
    return BUILTIN_ROUNDABOUT_LUMINAIRES.find((l) => l.id === selectedLuminaireId) || BUILTIN_ROUNDABOUT_LUMINAIRES[0];
  }, [selectedLuminaireId]);

  // Pole Arrangement
  const [poleConfig, setPoleConfig] = useState<RoundaboutPoleConfig>({
    arrangementType: "outer_perimeter",
    poleCount: 8,
    setback: 1.2,
    mountingHeight: 10.0,
    boomLength: 1.2,
    boomTiltDeg: 5.0,
    aimingMode: "tangential",
    maintenanceFactor: 0.85,
    centralMastPoles: 6,
    centralMastHeight: 18.0,
    centralMastTilt: 22.0,
    includeApproachPoles: true,
    approachPoleHeight: 10.0,
  });

  // Target Standard
  const [targetClassId, setTargetClassId] = useState<string>("C2");
  const activeStandard = useMemo(() => {
    return ROUNDABOUT_C_STANDARDS[targetClassId] || ROUNDABOUT_C_STANDARDS.C2;
  }, [targetClassId]);

  // 3D Viewport Controls
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [cameraMode, setCameraMode] = useState<"3d_orbit" | "top_plan" | "driver_approach" | "central_island">("3d_orbit");
  const [driverApproachArm, setDriverApproachArm] = useState<string>("arm-east");
  const [showFalseColor, setShowFalseColor] = useState<boolean>(true);
  const [showIsolux, setShowIsolux] = useState<boolean>(true);
  const [showLightCones, setShowLightCones] = useState<boolean>(true);
  const [showPoles3D, setShowPoles3D] = useState<boolean>(true);

  // Optimizer State
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<RoundaboutOptimizationResult | null>(null);

  // Simulation Calculation Result
  const calculationResult: RoundaboutCalculationResult = useMemo(() => {
    return runRoundaboutSimulation(geometry, activeLuminaire, poleConfig, activeStandard);
  }, [geometry, activeLuminaire, poleConfig, activeStandard]);

  // Synchronize Preset Changes
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = PRESET_ROUNDABOUTS.find((p) => p.id === presetId);
    if (found) {
      setGeometry(JSON.parse(JSON.stringify(found)));
      toast.info(`Loaded preset: ${found.name}`);
    }
  };

  // Run Optimizer
  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      try {
        const res = optimizeRoundaboutLighting(geometry, activeLuminaire, activeStandard);
        setOptimizationResult(res);
        toast.success(`Evaluated ${res.evaluatedCount} variants! Found compliant design.`);
      } catch (err) {
        toast.error("Optimization failed");
      } finally {
        setIsOptimizing(false);
      }
    }, 150);
  };

  const handleApplyVariant = (variant: RoundaboutOptimizationVariant) => {
    setPoleConfig((prev) => ({
      ...prev,
      poleCount: variant.poleCount,
      mountingHeight: variant.height,
      boomTiltDeg: variant.tilt,
      arrangementType: variant.arrangement,
    }));
    toast.success(`Applied variant: ${variant.poleCount} poles @ ${variant.height}m height`);
  };

  // Three.js Canvas Reference
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);

  // Initialize and Render Three.js Scene
  useEffect(() => {
    if (!isOpen || viewMode !== "3d" || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a); // dark slate

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 500);
    cameraRef.current = camera;
    camera.position.set(0, -50, 45);
    camera.up.set(0, 0, 1); // Z is vertical up

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(geometry.center.x, geometry.center.y, 0);

    // Ambient & Directional Sun/Sky Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(30, 40, 60);
    scene.add(dirLight);

    // Build Roundabout 3D Meshes
    build3DRoundabout(scene, geometry, poleConfig, calculationResult, {
      showFalseColor,
      showIsolux,
      showLightCones,
      showPoles3D,
    });

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, [
    isOpen,
    viewMode,
    geometry,
    poleConfig,
    calculationResult,
    showFalseColor,
    showIsolux,
    showLightCones,
    showPoles3D,
  ]);

  // Adjust Camera Preset
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (cameraMode === "3d_orbit") {
      camera.position.set(0, -geometry.outerRoadwayRadius * 2.2, geometry.outerRoadwayRadius * 1.8);
      controls.target.set(0, 0, 0);
    } else if (cameraMode === "top_plan") {
      camera.position.set(0, 0, geometry.outerRoadwayRadius * 3.2);
      controls.target.set(0, 0, 0);
    } else if (cameraMode === "central_island") {
      camera.position.set(0, 0, 2.0);
      camera.lookAt(geometry.outerRoadwayRadius, 0, 0);
      controls.target.set(geometry.outerRoadwayRadius, 0, 0);
    } else if (cameraMode === "driver_approach") {
      const arm = geometry.arms.find((a) => a.id === driverApproachArm) || geometry.arms[0];
      if (arm) {
        const rad = (arm.angleDeg * Math.PI) / 180;
        const appDist = geometry.outerRoadwayRadius + 30.0;
        const driverX = geometry.center.x + appDist * Math.cos(rad);
        const driverY = geometry.center.y + appDist * Math.sin(rad);
        camera.position.set(driverX, driverY, 1.25); // driver eye height
        controls.target.set(0, 0, 0.5);
      }
    }
    controls.update();
  }, [cameraMode, driverApproachArm, geometry]);

  if (!isOpen) return null;

  const currentSpacing = calculationResult.perimeterPoleSpacingM;
  const isSpacingGood = calculationResult.spacingToHeightRatio <= 3.5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-4">
      <div
        className={`flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[94vh]"
        }`}
      >
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  DIALux evo Roundabout Lighting Suite
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Tutorial 16
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  EN 13201-2 (C-Classes)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Parametric intersection geometry, polar circular luminaire array, conflict zone calculation & standards verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title={isFullscreen ? "Restore" : "Maximize"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= WORKFLOW TABS ================= */}
        <div className="flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/90 text-sm">
          <div className="flex gap-1 overflow-x-auto py-2">
            {[
              { id: "geometry", label: "Roundabout Geometry", icon: Layers },
              { id: "luminaires", label: "Luminaires & Poles", icon: Sun },
              { id: "standards", label: "Standards (C0-C5)", icon: ShieldCheck },
              { id: "optimizer", label: "Spacing Optimizer", icon: Sparkles },
              { id: "report", label: "Documentation & Export", icon: FileDown },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                    isActive
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Compliance Badge */}
          <div className="hidden lg:flex items-center gap-3 py-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Class:</span>
              <span className="font-bold text-amber-400">{activeStandard.classId}</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">E_avg:</span>
              <span
                className={`font-bold ${
                  calculationResult.isEAvgCompliant ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {calculationResult.E_avg} lx
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{activeStandard.E_avg_min} lx</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">U_o:</span>
              <span
                className={`font-bold ${
                  calculationResult.isUoCompliant ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {calculationResult.U_o}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                calculationResult.isOverallCompliant
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              }`}
            >
              {calculationResult.isOverallCompliant ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>100% EN 13201 PASS</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>NON-COMPLIANT</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================= MAIN SPLIT CONTENT ================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Controls & Inspector Panels */}
          <div className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: GEOMETRY */}
            {activeTab === "geometry" && (
              <div className="space-y-5">
                {/* Preset Selection */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    Roundabout Archetype Presets
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {PRESET_ROUNDABOUTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-2">{geometry.description}</p>
                </div>

                {/* Parametric Geometry Dimensions */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Circular Dimensions (m)
                    </span>
                    <span className="text-xs text-amber-400 font-medium">
                      Outer Radius: {geometry.outerRoadwayRadius.toFixed(1)} m (Ø{" "}
                      {(geometry.outerRoadwayRadius * 2).toFixed(1)} m)
                    </span>
                  </div>

                  {/* Central Island Radius */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Central Island Radius (R_island)</span>
                      <span className="font-bold text-amber-400">{geometry.islandRadius.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min="6.0"
                      max="35.0"
                      step="0.5"
                      value={geometry.islandRadius}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setGeometry((prev) => ({
                          ...prev,
                          islandRadius: val,
                          outerRoadwayRadius: val + prev.truckApronWidth + prev.circulatoryLanes * prev.laneWidth,
                        }));
                      }}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Truck Apron Width */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Truck Apron Ring Width</span>
                      <span className="font-bold text-amber-400">{geometry.truckApronWidth.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="4.0"
                      step="0.5"
                      value={geometry.truckApronWidth}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setGeometry((prev) => ({
                          ...prev,
                          truckApronWidth: val,
                          outerRoadwayRadius: prev.islandRadius + val + prev.circulatoryLanes * prev.laneWidth,
                        }));
                      }}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Circulatory Lanes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Circulatory Lanes</label>
                      <select
                        value={geometry.circulatoryLanes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setGeometry((prev) => ({
                            ...prev,
                            circulatoryLanes: val,
                            outerRoadwayRadius: prev.islandRadius + prev.truckApronWidth + val * prev.laneWidth,
                          }));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        <option value={1}>1 Lane (Single-Lane)</option>
                        <option value={2}>2 Lanes (Dual-Lane)</option>
                        <option value={3}>3 Lanes (Multi-Lane)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Lane Width (m)</label>
                      <input
                        type="number"
                        min="3.5"
                        max="6.0"
                        step="0.25"
                        value={geometry.laneWidth}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setGeometry((prev) => ({
                            ...prev,
                            laneWidth: val,
                            outerRoadwayRadius: prev.islandRadius + prev.truckApronWidth + prev.circulatoryLanes * val,
                          }));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Central Island Landscaping */}
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Central Island Landscaping</label>
                    <select
                      value={geometry.landscapingType}
                      onChange={(e) =>
                        setGeometry((prev) => ({
                          ...prev,
                          landscapingType: e.target.value as CentralLandscapingType,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="grass_mound">Grass Mound / Berm (Recommended)</option>
                      <option value="low_shrubbery">Low Shrubbery & Groundcover</option>
                      <option value="sculpture_fountain">Civic Monument / Fountain</option>
                      <option value="paved_apron">Fully Paved Decorative Apron</option>
                      <option value="flat_lawn">Flat Green Lawn</option>
                    </select>
                  </div>
                </div>

                {/* Connecting Approaches & Arms */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Connecting Arms ({geometry.arms.length})
                    </span>
                    <button
                      onClick={() => {
                        const newAngle = (geometry.arms.length * 72) % 360;
                        const newArm: RoundaboutArm = {
                          id: `arm-${Date.now()}`,
                          name: `Arm ${geometry.arms.length + 1}`,
                          angleDeg: newAngle,
                          entryLanes: 1,
                          exitLanes: 1,
                          laneWidth: 3.75,
                          length: 35.0,
                          hasSplitterIsland: true,
                          splitterWidth: 2.0,
                          hasCrosswalk: true,
                          crosswalkDistance: 12.0,
                        };
                        setGeometry((prev) => ({ ...prev, arms: [...prev.arms, newArm] }));
                        toast.success("Added connecting approach arm");
                      }}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Arm
                    </button>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {geometry.arms.map((arm, index) => (
                      <div
                        key={arm.id}
                        className="p-2.5 bg-slate-900/80 border border-slate-700/60 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{arm.name}</div>
                          <div className="text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Heading: {arm.angleDeg}°</span>
                            <span>•</span>
                            <span>
                              {arm.entryLanes} in / {arm.exitLanes} out
                            </span>
                            {arm.hasCrosswalk && (
                              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                                <Footprints className="w-3 h-3" /> Crosswalk
                              </span>
                            )}
                          </div>
                        </div>

                        {geometry.arms.length > 3 && (
                          <button
                            onClick={() => {
                              setGeometry((prev) => ({
                                ...prev,
                                arms: prev.arms.filter((a) => a.id !== arm.id),
                              }));
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                            title="Remove Arm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scale Verification Tool (Tutorial 16 Step) */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-3">
                  <Ruler className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-200">Scale Verification Tool (Tutorial 16)</div>
                    <p className="text-slate-400 mt-0.5">
                      Verify scale and dimensions against imported CAD floor plans using the Tape Measure tool. Real diameter:{" "}
                      <span className="text-amber-300 font-bold">{(geometry.outerRoadwayRadius * 2).toFixed(1)} m</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LUMINAIRES & POLES */}
            {activeTab === "luminaires" && (
              <div className="space-y-5">
                {/* Luminaire Selector */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    Roundabout Photometric Luminaire
                  </label>
                  <select
                    value={selectedLuminaireId}
                    onChange={(e) => setSelectedLuminaireId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {BUILTIN_ROUNDABOUT_LUMINAIRES.map((lum) => (
                      <option key={lum.id} value={lum.id}>
                        {lum.name} ({lum.wattage}W, {lum.totalLumens} lm)
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
                    <div className="text-slate-400">
                      Optic: <span className="text-slate-200 font-medium">{activeLuminaire.opticType}</span>
                    </div>
                    <div className="text-slate-400">
                      Color Temp: <span className="text-slate-200 font-medium">{activeLuminaire.colorTemp}K</span>
                    </div>
                    <div className="text-slate-400">
                      Wattage: <span className="text-amber-400 font-bold">{activeLuminaire.wattage} W</span>
                    </div>
                    <div className="text-slate-400">
                      Luminous Flux: <span className="text-amber-400 font-bold">{activeLuminaire.totalLumens} lm</span>
                    </div>
                  </div>
                </div>

                {/* Arrangement Mode */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Pole Placement Architecture
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "outer_perimeter", label: "Outer Perimeter (Polar Array)" },
                      { id: "central_island_mast", label: "Central High Mast" },
                      { id: "combined", label: "Combined Outer + Approaches" },
                      { id: "approach_conflict_pairs", label: "Conflict Entry Pairs" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() =>
                          setPoleConfig((prev) => ({
                            ...prev,
                            arrangementType: mode.id as RoundaboutArrangementType,
                          }))
                        }
                        className={`p-2.5 rounded-lg text-xs font-medium text-left border transition ${
                          poleConfig.arrangementType === mode.id
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-slate-900/80 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Perimeter Poles Configuration */}
                  {(poleConfig.arrangementType === "outer_perimeter" ||
                    poleConfig.arrangementType === "combined") && (
                    <div className="space-y-3 pt-2 border-t border-slate-700/60">
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>Perimeter Pole Count (N)</span>
                          <span className="font-bold text-amber-400">{poleConfig.poleCount} poles</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="16"
                          step="1"
                          value={poleConfig.poleCount}
                          onChange={(e) =>
                            setPoleConfig((prev) => ({
                              ...prev,
                              poleCount: parseInt(e.target.value),
                            }))
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>

                      {/* Pole Spacing Guideline Readout */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg text-xs border border-slate-700/60">
                        <div>
                          <div className="text-slate-400">Perimeter Arc Spacing (s):</div>
                          <div className="font-bold text-slate-200 text-sm">
                            {calculationResult.perimeterPoleSpacingM} m
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-400">Spacing-to-Height (s / H):</div>
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              isSpacingGood
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {calculationResult.spacingToHeightRatio.toFixed(2)} {isSpacingGood ? "(≤ 3.5 ✓)" : "(> 3.5 ⚠)"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mounting Height & Dimensions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Mounting Height (m)</label>
                      <input
                        type="number"
                        min="6.0"
                        max="16.0"
                        step="0.5"
                        value={poleConfig.mountingHeight}
                        onChange={(e) =>
                          setPoleConfig((prev) => ({
                            ...prev,
                            mountingHeight: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Boom Tilt Angle (°)</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="1"
                        value={poleConfig.boomTiltDeg}
                        onChange={(e) =>
                          setPoleConfig((prev) => ({
                            ...prev,
                            boomTiltDeg: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Aiming Vector */}
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">Luminaire Aiming Direction</label>
                    <select
                      value={poleConfig.aimingMode}
                      onChange={(e) =>
                        setPoleConfig((prev) => ({
                          ...prev,
                          aimingMode: e.target.value as LuminaireAimingMode,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                    >
                      <option value="tangential">Tangential with Driving Flow (Standard DIALux)</option>
                      <option value="inward_radial">Inward Radial (Towards Central Island)</option>
                      <option value="forward_drive">Angled Forward Drive (45° Inward Angle)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STANDARDS (C-SERIES) */}
            {activeTab === "standards" && (
              <div className="space-y-5">
                {/* Standard Class Selector */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                    EN 13201-2 Conflict Area Lighting Class
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(ROUNDABOUT_C_STANDARDS).map((std) => (
                      <button
                        key={std.classId}
                        onClick={() => setTargetClassId(std.classId)}
                        className={`p-2.5 rounded-lg border text-center transition ${
                          targetClassId === std.classId
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div className="font-bold text-sm">{std.classId}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{std.E_avg_min} lx req.</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">{activeStandard.description}</p>
                </div>

                {/* Scorecard */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Circulatory Roadway Photometric Results
                  </span>

                  {/* Maintained E_avg */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Maintained Average Illuminance (E_avg)</div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {calculationResult.E_avg} lx
                        <span className="text-xs font-normal text-slate-400 ml-2">
                          (Target: ≥ {activeStandard.E_avg_min} lx)
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        calculationResult.isEAvgCompliant
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {calculationResult.isEAvgCompliant ? "PASS ✓" : "FAIL ✗"}
                    </span>
                  </div>

                  {/* Uniformity U_o */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Overall Uniformity (U_o = E_min / E_avg)</div>
                      <div className="text-base font-bold text-slate-100 mt-0.5">
                        {calculationResult.U_o}
                        <span className="text-xs font-normal text-slate-400 ml-2">
                          (Target: ≥ {activeStandard.U_o_min.toFixed(2)})
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        calculationResult.isUoCompliant
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {calculationResult.isUoCompliant ? "PASS ✓" : "FAIL ✗"}
                    </span>
                  </div>

                  {/* Min / Max / Diversity */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                      <div className="text-slate-400">E_min</div>
                      <div className="font-bold text-slate-200 mt-1">{calculationResult.E_min} lx</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                      <div className="text-slate-400">E_max</div>
                      <div className="font-bold text-slate-200 mt-1">{calculationResult.E_max} lx</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-center">
                      <div className="text-slate-400">Diversity (min/max)</div>
                      <div className="font-bold text-slate-200 mt-1">{calculationResult.U_d}</div>
                    </div>
                  </div>
                </div>

                {/* Energy Efficiency Assessment */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Energy Efficiency Indicators (EN 13201-5)
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Power Density Indicator (PDI)</div>
                      <div className="font-bold text-amber-400 text-sm mt-0.5">
                        {calculationResult.PDI} W/(lx·m²)
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Annual Consumption (AECI)</div>
                      <div className="font-bold text-amber-400 text-sm mt-0.5">
                        {calculationResult.AECI} kWh/m²/yr
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 px-1">
                    <span>Total Connected Power: {calculationResult.totalPowerW} W</span>
                    <span>Lighted Area: {calculationResult.lightedAreaM2} m²</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SPACING OPTIMIZER */}
            {activeTab === "optimizer" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Roundabout Spacing & Layout Optimizer
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Automatically scans pole counts (4 to 16) and mounting heights (8m to 14m) to find the layout that minimizes capital cost and power while achieving 100% EN 13201 compliance.
                  </p>

                  <button
                    onClick={handleRunOptimizer}
                    disabled={isOptimizing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {isOptimizing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Optimizing Roundabout...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Run Spacing Optimization</span>
                      </>
                    )}
                  </button>
                </div>

                {optimizationResult && (
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                        Best Compliant Variant
                      </span>
                      <button
                        onClick={() => handleApplyVariant(optimizationResult.bestVariant)}
                        className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-md font-bold hover:bg-emerald-500/30 transition"
                      >
                        Apply Best
                      </button>
                    </div>

                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pole Count:</span>
                        <span className="font-bold text-slate-100">
                          {optimizationResult.bestVariant.poleCount} poles
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mounting Height:</span>
                        <span className="font-bold text-slate-100">
                          {optimizationResult.bestVariant.height} m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Perimeter Spacing:</span>
                        <span className="font-bold text-slate-100">
                          {optimizationResult.bestVariant.spacingM.toFixed(1)} m (s/H:{" "}
                          {optimizationResult.bestVariant.sToHRatio.toFixed(2)})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">E_avg / U_o:</span>
                        <span className="font-bold text-emerald-400">
                          {optimizationResult.bestVariant.E_avg} lx / {optimizationResult.bestVariant.U_o}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Power:</span>
                        <span className="font-bold text-amber-400">
                          {optimizationResult.bestVariant.totalPowerW} W
                        </span>
                      </div>
                    </div>

                    {/* Ranked Table */}
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mt-3">
                      Alternative Variants
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {optimizationResult.allVariants.slice(0, 8).map((v, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 bg-slate-900/80 rounded border border-slate-800 text-xs hover:border-slate-700"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">
                              {v.poleCount}p @ {v.height}m
                            </span>
                            <span className="text-slate-400 ml-2">
                              {v.E_avg} lx, U_o {v.U_o}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                v.isCompliant
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {v.isCompliant ? "PASS" : "FAIL"}
                            </span>
                            <button
                              onClick={() => handleApplyVariant(v)}
                              className="text-amber-400 hover:text-amber-300 font-medium"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: DOCUMENTATION & REPORT */}
            {activeTab === "report" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Roundabout Photometric Certificate
                    </span>
                    <button
                      onClick={() => {
                        window.print();
                        toast.success("Printing roundabout design summary");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:brightness-110 transition"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Export PDF
                    </button>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                    <div className="text-amber-400 font-bold">PROJECT: {projectName} ({projectCode})</div>
                    <div>STANDARD: {activeStandard.name} (Conflict Area)</div>
                    <div>GEOMETRY: Ø{(geometry.outerRoadwayRadius * 2).toFixed(1)}m, {geometry.circulatoryLanes} Lanes, {geometry.arms.length} Arms</div>
                    <div>LUMINAIRES: {calculationResult.totalPoles}x {activeLuminaire.name}</div>
                    <div>POLE CONFIG: {poleConfig.mountingHeight}m Height, Spacing {calculationResult.perimeterPoleSpacingM}m</div>
                    <div className="text-emerald-400 font-bold pt-1">
                      E_avg = {calculationResult.E_avg} lx (req ≥ {activeStandard.E_avg_min} lx) - {calculationResult.isEAvgCompliant ? "PASSED" : "FAILED"}
                    </div>
                    <div className="text-emerald-400 font-bold">
                      U_o = {calculationResult.U_o} (req ≥ {activeStandard.U_o_min}) - {calculationResult.isUoCompliant ? "PASSED" : "FAILED"}
                    </div>
                    <div>PDI: {calculationResult.PDI} W/(lx·m²) | AECI: {calculationResult.AECI} kWh/m²/yr</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: 3D WebGL / 2D Canvas Viewport */}
          <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
            {/* Top Viewport Toolbar */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs">
                {/* 3D vs 2D Toggle */}
                <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setViewMode("3d")}
                    className={`px-2.5 py-1 rounded font-medium transition ${
                      viewMode === "3d" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    3D View
                  </button>
                  <button
                    onClick={() => setViewMode("2d")}
                    className={`px-2.5 py-1 rounded font-medium transition ${
                      viewMode === "2d" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    2D CAD Plan
                  </button>
                </div>

                {/* Camera Angles (in 3D) */}
                {viewMode === "3d" && (
                  <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                    <button
                      onClick={() => setCameraMode("3d_orbit")}
                      className={`px-2 py-1 rounded transition ${
                        cameraMode === "3d_orbit" ? "bg-slate-700 text-amber-300" : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="3D Orbit View"
                    >
                      Orbit
                    </button>
                    <button
                      onClick={() => setCameraMode("top_plan")}
                      className={`px-2 py-1 rounded transition ${
                        cameraMode === "top_plan" ? "bg-slate-700 text-amber-300" : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Top-down Orthographic"
                    >
                      Top
                    </button>
                    <button
                      onClick={() => setCameraMode("central_island")}
                      className={`px-2 py-1 rounded transition ${
                        cameraMode === "central_island" ? "bg-slate-700 text-amber-300" : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Island View looking out"
                    >
                      Island
                    </button>
                    <button
                      onClick={() => setCameraMode("driver_approach")}
                      className={`px-2 py-1 rounded transition flex items-center gap-1 ${
                        cameraMode === "driver_approach" ? "bg-slate-700 text-amber-300" : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Driver Eye-Level Approach"
                    >
                      <Car className="w-3.5 h-3.5" />
                      <span>Driver</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Visualization Layers */}
              <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs">
                <button
                  onClick={() => setShowFalseColor(!showFalseColor)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 font-medium ${
                    showFalseColor ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>False Color</span>
                </button>
                <button
                  onClick={() => setShowIsolux(!showIsolux)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 font-medium ${
                    showIsolux ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Isolux</span>
                </button>
                <button
                  onClick={() => setShowLightCones(!showLightCones)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 font-medium ${
                    showLightCones ? "bg-purple-500/20 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Cones</span>
                </button>
              </div>
            </div>

            {/* Viewport Content */}
            {viewMode === "3d" ? (
              <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            ) : (
              <Roundabout2DCADPlan
                geometry={geometry}
                poles={calculationResult.polePositions}
                gridPoints={calculationResult.gridPoints}
                showFalseColor={showFalseColor}
                showIsolux={showIsolux}
              />
            )}

            {/* False Color Lux Legend Bar */}
            {showFalseColor && (
              <div className="absolute bottom-4 left-6 right-6 z-10 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Illuminance Scale (lux):</span>
                <div className="flex-1 mx-4 h-3.5 rounded-md overflow-hidden flex shadow-inner">
                  <div className="w-[15%] bg-[rgb(0,20,120)]" />
                  <div className="w-[20%] bg-[rgb(0,180,180)]" />
                  <div className="w-[25%] bg-[rgb(120,220,0)]" />
                  <div className="w-[25%] bg-[rgb(255,180,0)]" />
                  <div className="w-[15%] bg-[rgb(255,70,70)]" />
                </div>
                <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px]">
                  <span>0 lx</span>
                  <span>15 lx</span>
                  <span>30 lx</span>
                  <span>45 lx</span>
                  <span>60+ lx</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 10. 3D WEBGL ROUNDABOUT BUILDER (THREE.JS)
// =========================================================================

function build3DRoundabout(
  scene: any,
  geometry: RoundaboutGeometry,
  config: RoundaboutPoleConfig,
  result: RoundaboutCalculationResult,
  options: {
    showFalseColor: boolean;
    showIsolux: boolean;
    showLightCones: boolean;
    showPoles3D: boolean;
  }
) {
  // 1. Clear previous procedural meshes (keep base lights)
  const toRemove: any[] = [];
  scene.children.forEach((obj: any) => {
    if (obj.name && obj.name.startsWith("rb_")) toRemove.push(obj);
  });
  toRemove.forEach((obj: any) => scene.remove(obj));

  const group = new THREE.Group();
  group.name = "rb_root";

  const innerR = geometry.islandRadius + geometry.truckApronWidth;
  const outerR = geometry.outerRoadwayRadius;

  // Ground plane (grass exterior field)
  const groundGeo = new THREE.PlaneGeometry(outerR * 4.5, outerR * 4.5);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.z = -0.05;
  group.add(groundMesh);

  // 2. Circulatory Roadway Ring (Asphalt)
  const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: options.showFalseColor ? 0x0f172a : 0x1f2937,
    roughness: 0.85,
    metalness: 0.1,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  group.add(ringMesh);

  // Circular Dashed Lane Markings
  if (geometry.circulatoryLanes > 1) {
    for (let lane = 1; lane < geometry.circulatoryLanes; lane++) {
      const laneR = innerR + lane * geometry.laneWidth;
      const laneLineGeo = new THREE.RingGeometry(laneR - 0.08, laneR + 0.08, 64);
      const laneLineMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, opacity: 0.7, transparent: true });
      const laneLineMesh = new THREE.Mesh(laneLineGeo, laneLineMat);
      laneLineMesh.position.z = 0.01;
      group.add(laneLineMesh);
    }
  }

  // 3. Mountable Concrete Truck Apron Ring
  if (geometry.truckApronWidth > 0.1) {
    const apronGeo = new THREE.RingGeometry(geometry.islandRadius, innerR, 64);
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.position.z = geometry.truckApronCurb;
    group.add(apronMesh);
  }

  // 4. Central Island Mound / Landscaping
  const islandGeo = new THREE.CylinderGeometry(
    geometry.islandRadius * 0.95,
    geometry.islandRadius,
    1.2,
    48
  );
  islandGeo.rotateX(Math.PI / 2); // align Z as vertical
  const islandMat = new THREE.MeshStandardMaterial({
    color: geometry.landscapingType === "paved_apron" ? 0x94a3b8 : 0x15803d, // green grass
    roughness: 0.9,
  });
  const islandMesh = new THREE.Mesh(islandGeo, islandMat);
  islandMesh.position.z = 0.6;
  group.add(islandMesh);

  // 5. Approach Arms Roads
  geometry.arms.forEach((arm) => {
    const rad = (arm.angleDeg * Math.PI) / 180;
    const armTotalWidth = (arm.entryLanes + arm.exitLanes) * arm.laneWidth;
    const armLen = arm.length;

    // Road Rectangle
    const roadGeo = new THREE.PlaneGeometry(armLen, armTotalWidth);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);

    // Position arm radiating out from center
    const centerDist = outerR + armLen / 2;
    roadMesh.position.set(centerDist * Math.cos(rad), centerDist * Math.sin(rad), 0.005);
    roadMesh.rotation.z = rad;
    group.add(roadMesh);

    // Splitter Island (Triangular concrete deflection island)
    if (arm.hasSplitterIsland) {
      const splitGeo = new THREE.CylinderGeometry(0.2, arm.splitterWidth, armLen * 0.5, 3);
      splitGeo.rotateX(Math.PI / 2);
      const splitMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
      const splitMesh = new THREE.Mesh(splitGeo, splitMat);
      const splitDist = outerR + armLen * 0.3;
      splitMesh.position.set(splitDist * Math.cos(rad), splitDist * Math.sin(rad), 0.15);
      splitMesh.rotation.z = rad + Math.PI / 2;
      group.add(splitMesh);
    }
  });

  // 6. False Color Heatmap (Colored Grid Points)
  if (options.showFalseColor && result.gridPoints.length > 0) {
    const ptGroup = new THREE.Group();
    result.gridPoints.forEach((pt) => {
      const colorStr = getRoundaboutFalseColor(pt.lux, 55);
      const color = new THREE.Color(colorStr);

      const dotGeo = new THREE.CircleGeometry(0.65, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color, opacity: 0.85, transparent: true });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.set(pt.x, pt.y, 0.03);
      ptGroup.add(dotMesh);
    });
    group.add(ptGroup);
  }

  // 7. 3D Lighting Poles & Luminaire Cones
  if (options.showPoles3D) {
    const poleGroup = new THREE.Group();

    result.polePositions.forEach((p) => {
      // Steel tubular pole
      const mastGeo = new THREE.CylinderGeometry(0.12, 0.2, p.z, 16);
      mastGeo.rotateX(Math.PI / 2);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
      const mastMesh = new THREE.Mesh(mastGeo, mastMat);
      mastMesh.position.set(p.x, p.y, p.z / 2);
      poleGroup.add(mastMesh);

      // Luminaire head
      const headGeo = new THREE.BoxGeometry(0.35, 0.7, 0.15);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      const headMesh = new THREE.Mesh(headGeo, headMat);
      headMesh.position.set(p.x, p.y, p.z);
      headMesh.rotation.z = (p.headingDeg * Math.PI) / 180;
      poleGroup.add(headMesh);

      // Light Cones
      if (options.showLightCones) {
        const coneHeight = p.z;
        const coneRadius = p.z * 1.2;
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
        coneGeo.rotateX(Math.PI);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a, // warm amber light
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
        });
        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.set(p.x, p.y, p.z / 2);
        poleGroup.add(coneMesh);
      }
    });

    group.add(poleGroup);
  }

  scene.add(group);
}

// =========================================================================
// 11. 2D ORTHOGRAPHIC CAD PLAN VIEW (SVG)
// =========================================================================

function Roundabout2DCADPlan({
  geometry,
  poles,
  gridPoints,
  showFalseColor,
  showIsolux,
}: {
  geometry: RoundaboutGeometry;
  poles: any[];
  gridPoints: any[];
  showFalseColor: boolean;
  showIsolux: boolean;
}) {
  const outerR = geometry.outerRoadwayRadius;
  const viewBoxSize = (outerR + 45) * 2;
  const halfView = viewBoxSize / 2;

  return (
    <div className="w-full h-full flex items-center justify-center p-4 bg-slate-950 overflow-hidden">
      <svg
        viewBox={`-${halfView} -${halfView} ${viewBoxSize} ${viewBoxSize}`}
        className="w-full h-full max-h-[85vh] drop-shadow-xl"
      >
        {/* Background Grid */}
        <defs>
          <pattern id="cadGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect x={-halfView} y={-halfView} width={viewBoxSize} height={viewBoxSize} fill="url(#cadGrid)" />

        {/* Approach Roads */}
        {geometry.arms.map((arm) => {
          const rad = (arm.angleDeg * Math.PI) / 180;
          const armTotalWidth = (arm.entryLanes + arm.exitLanes) * arm.laneWidth;
          const armLen = arm.length;
          return (
            <g key={arm.id} transform={`rotate(${arm.angleDeg})`}>
              <rect
                x={outerR}
                y={-armTotalWidth / 2}
                width={armLen}
                height={armTotalWidth}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="0.4"
              />
              {/* Center Line */}
              <line
                x1={outerR}
                y1={0}
                x2={outerR + armLen}
                y2={0}
                stroke="#e2e8f0"
                strokeWidth="0.3"
                strokeDasharray="2,2"
              />
              {/* Splitter Island */}
              {arm.hasSplitterIsland && (
                <polygon
                  points={`${outerR + 2},0 ${outerR + armLen * 0.4},${arm.splitterWidth / 2} ${outerR + armLen * 0.4},${-arm.splitterWidth / 2}`}
                  fill="#64748b"
                  stroke="#94a3b8"
                  strokeWidth="0.3"
                />
              )}
            </g>
          );
        })}

        {/* Circulatory Outer Road Ring */}
        <circle
          cx={0}
          cy={0}
          r={outerR}
          fill="#1e293b"
          stroke="#94a3b8"
          strokeWidth="0.8"
        />

        {/* Circulatory Lane Dividers */}
        {geometry.circulatoryLanes > 1 &&
          Array.from({ length: geometry.circulatoryLanes - 1 }).map((_, idx) => {
            const laneR = geometry.islandRadius + geometry.truckApronWidth + (idx + 1) * geometry.laneWidth;
            return (
              <circle
                key={idx}
                cx={0}
                cy={0}
                r={laneR}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="0.4"
                strokeDasharray="2,3"
              />
            );
          })}

        {/* Truck Apron */}
        {geometry.truckApronWidth > 0.1 && (
          <circle
            cx={0}
            cy={0}
            r={geometry.islandRadius + geometry.truckApronWidth}
            fill="#475569"
            stroke="#64748b"
            strokeWidth="0.6"
          />
        )}

        {/* Central Island */}
        <circle
          cx={0}
          cy={0}
          r={geometry.islandRadius}
          fill="#166534"
          stroke="#22c55e"
          strokeWidth="0.8"
        />

        {/* False Color Sampling Dots */}
        {showFalseColor &&
          gridPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={0.65}
              fill={getRoundaboutFalseColor(pt.lux, 55)}
              opacity={0.8}
            />
          ))}

        {/* Lighting Poles */}
        {poles.map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            {/* Pole Base */}
            <circle cx={0} cy={0} r={1.0} fill="#f59e0b" stroke="#ffffff" strokeWidth="0.4" />
            {/* Heading Aiming Arrow */}
            <line
              x1={0}
              y1={0}
              x2={2.5 * Math.cos((p.headingDeg * Math.PI) / 180)}
              y2={2.5 * Math.sin((p.headingDeg * Math.PI) / 180)}
              stroke="#fbbf24"
              strokeWidth="0.5"
            />
          </g>
        ))}

        {/* Center Reticle */}
        <line x1={-3} y1={0} x2={3} y2={0} stroke="#f59e0b" strokeWidth="0.5" />
        <line x1={0} y1={-3} x2={0} y2={3} stroke="#f59e0b" strokeWidth="0.5" />
      </svg>
    </div>
  );
}
