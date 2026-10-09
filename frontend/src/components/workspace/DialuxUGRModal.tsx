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
  Eye,
  ShieldCheck,
  Lightbulb,
  ArrowUpRight,
  TrendingDown,
  User,
  Table as TableIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  UGRObserver,
  RoomEnvironment,
  Luminaire3DInstance,
  UGRPointResult,
  UGRAreaResult,
  CIE117TableRow,
  EN12464SpaceRequirement,
  EN_12464_UGR_LIMITS,
  calculatePointUGR,
  calculateUGRAreaGrid,
  generateCIE117Table,
} from "@/lib/dialux-ugr-engine";

export interface DialuxUGRModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomLength?: number;
  roomWidth?: number;
  roomHeight?: number;
  roomName?: string;
  projectName?: string;
  workplaneLux?: number;
  ceilingReflectance?: number;
  wallReflectance?: number;
  floorReflectance?: number;
  luminairesCount?: number;
}

export function DialuxUGRModal({
  isOpen,
  onClose,
  roomLength = 8.0,
  roomWidth = 6.0,
  roomHeight = 3.0,
  roomName = "Open-Plan Office 101",
  projectName = "Corporate Headquarters",
  workplaneLux = 520,
  ceilingReflectance = 0.70,
  wallReflectance = 0.50,
  floorReflectance = 0.20,
  luminairesCount = 12,
}: DialuxUGRModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"observer" | "area_grid" | "standards" | "cie_table" | "report">("observer");

  // Room Environment
  const room: RoomEnvironment = useMemo(
    () => ({
      length: roomLength,
      width: roomWidth,
      height: roomHeight,
      ceilingReflectance,
      wallReflectance,
      floorReflectance,
      workplaneLux,
    }),
    [roomLength, roomWidth, roomHeight, ceilingReflectance, wallReflectance, floorReflectance, workplaneLux]
  );

  // Active Standard Space Selection
  const [selectedStandardId, setSelectedStandardId] = useState<string>("office_workstation");
  const activeStandard: EN12464SpaceRequirement = useMemo(() => {
    return EN_12464_UGR_LIMITS.find((s) => s.id === selectedStandardId) || EN_12464_UGR_LIMITS[0];
  }, [selectedStandardId]);

  // Observer Point State (Tutorial 17 Primary Object)
  const [observer, setObserver] = useState<UGRObserver>({
    id: "obs-main",
    name: "Primary Workstation Observer",
    x: roomLength * 0.4,
    y: roomWidth * 0.5,
    z: 1.2, // seated 1.2m
    viewHeadingDeg: 90, // looking North (+Y)
    elevationDeg: 0,
    posture: "seated",
  });

  // Simulated 3D Luminaires in Room
  const luminaires: Luminaire3DInstance[] = useMemo(() => {
    const list: Luminaire3DInstance[] = [];
    // 3 rows x 4 columns grid
    const rows = 3;
    const cols = 4;
    const dx = room.length / (cols + 1);
    const dy = room.width / (rows + 1);
    let count = 0;

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        count++;
        list.push({
          id: `lum-${count}`,
          x: c * dx,
          y: r * dy,
          z: room.height - 0.1, // ceiling recessed / suspended
          wattage: 36,
          lumens: 4200,
          lengthM: 0.6,
          widthM: 0.6,
          beamAngle: 90, // microprismatic office beam
          candela0: 1650, // nadir candela
          cct: 4000,
        });
      }
    }
    return list;
  }, [room.length, room.width, room.height]);

  // Point UGR Calculation Result
  const pointResult: UGRPointResult = useMemo(() => {
    return calculatePointUGR(observer, luminaires, room, activeStandard.ugrLimit, activeStandard.name);
  }, [observer, luminaires, room, activeStandard]);

  // Area Grid Calculation Result
  const [areaCols, setAreaCols] = useState<number>(5);
  const [areaRows, setAreaRows] = useState<number>(4);
  const areaResult: UGRAreaResult = useMemo(() => {
    return calculateUGRAreaGrid(
      room,
      luminaires,
      areaCols,
      areaRows,
      observer.z,
      observer.viewHeadingDeg,
      activeStandard.ugrLimit
    );
  }, [room, luminaires, areaCols, areaRows, observer.z, observer.viewHeadingDeg, activeStandard.ugrLimit]);

  // Standard CIE 117 Reference Table
  const cieTable: CIE117TableRow[] = useMemo(() => {
    return generateCIE117Table(pointResult.ugr, 90);
  }, [pointResult.ugr]);

  // Viewport Settings
  const [viewMode, setViewMode] = useState<"3d" | "cad">("3d");
  const [showRays, setShowRays] = useState<boolean>(true);
  const [showSightCone, setShowSightCone] = useState<boolean>(true);
  const [showLuminaires, setShowLuminaires] = useState<boolean>(true);

  // Three.js References
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);

  // 3D Scene Initialization
  useEffect(() => {
    if (!isOpen || viewMode !== "3d" || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    cameraRef.current = camera;
    camera.position.set(room.length * 1.5, -room.width * 1.4, room.height * 2.0);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    mountRef.current.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(room.length / 2, room.width / 2, room.height / 3);

    // Ambient & Directional Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(room.length, room.width * 2, room.height * 3);
    scene.add(sun);

    // Build Room & Glare Elements
    build3DUGRScene(scene, room, observer, luminaires, pointResult, {
      showRays,
      showSightCone,
      showLuminaires,
    });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
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
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, [isOpen, viewMode, room, observer, luminaires, pointResult, showRays, showSightCone, showLuminaires]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 md:p-4">
      <div
        className={`flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[94vh]"
        }`}
      >
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  DIALux evo Unified Glare Rating Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Tutorial 17
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  CIE 117 / EN 12464-1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Discomfort glare evaluation, Guth position index, 360° Polar Glare Rose, area grids & mitigation
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
              { id: "observer", label: "Observer Point & Glare Rose", icon: User },
              { id: "area_grid", label: "Workstations Area Grid", icon: Grid },
              { id: "standards", label: "EN 12464-1 & Mitigation", icon: ShieldCheck },
              { id: "cie_table", label: "CIE 117 Standard Table", icon: TableIcon },
              { id: "report", label: "Compliance Certificate", icon: FileDown },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition ${
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Glare Score Readout */}
          <div className="hidden lg:flex items-center gap-3 py-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="text-slate-400">Heading:</span>
              <span className="font-bold text-amber-400">{observer.viewHeadingDeg}°</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Active UGR:</span>
              <span
                className={`font-bold ${
                  pointResult.isCompliant ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pointResult.ugr}
              </span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">Limit: {pointResult.limitUGR}</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Worst 360°:</span>
              <span className="font-bold text-orange-400">{pointResult.ugrMax}</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                pointResult.isCompliant
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/40"
              }`}
            >
              {pointResult.isCompliant ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>COMPLIANT (UGR ≤ {pointResult.limitUGR})</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>GLARE VIOLATION ({pointResult.ugr} &gt; {pointResult.limitUGR})</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================= MAIN SPLIT CONTENT ================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Controls & Inspector Panels */}
          <div className="w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: OBSERVER POINT & GLARE ROSE */}
            {activeTab === "observer" && (
              <div className="space-y-5">
                {/* Observer Posture & Eye Position */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Observer Eye Position (Tutorial 17)
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setObserver((prev) => ({ ...prev, z: 1.2, posture: "seated" }))}
                      className={`p-2 rounded-lg text-xs font-semibold border transition text-center ${
                        observer.z === 1.2
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      Seated (1.20 m eye height)
                    </button>
                    <button
                      onClick={() => setObserver((prev) => ({ ...prev, z: 1.65, posture: "standing" }))}
                      className={`p-2 rounded-lg text-xs font-semibold border transition text-center ${
                        observer.z === 1.65
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      Standing (1.65 m eye height)
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">X Pos (m)</label>
                      <input
                        type="number"
                        min="0.5"
                        max={room.length - 0.5}
                        step="0.25"
                        value={observer.x}
                        onChange={(e) =>
                          setObserver((prev) => ({ ...prev, x: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Y Pos (m)</label>
                      <input
                        type="number"
                        min="0.5"
                        max={room.width - 0.5}
                        step="0.25"
                        value={observer.y}
                        onChange={(e) =>
                          setObserver((prev) => ({ ...prev, y: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Z Eye (m)</label>
                      <input
                        type="number"
                        min="0.8"
                        max="2.2"
                        step="0.05"
                        value={observer.z}
                        onChange={(e) =>
                          setObserver((prev) => ({ ...prev, z: parseFloat(e.target.value) || 1.2 }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* View Direction & 360° Slider */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider">
                      Line of Sight Heading
                    </span>
                    <span className="font-bold text-amber-400 text-sm">{observer.viewHeadingDeg}°</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="359"
                    step="5"
                    value={observer.viewHeadingDeg}
                    onChange={(e) =>
                      setObserver((prev) => ({ ...prev, viewHeadingDeg: parseInt(e.target.value) }))
                    }
                    className="w-full accent-indigo-500"
                  />

                  {/* Cardinal Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 text-xs">
                    {[
                      { label: "East (0°)", deg: 0 },
                      { label: "North (90°)", deg: 90 },
                      { label: "West (180°)", deg: 180 },
                      { label: "South (270°)", deg: 270 },
                    ].map((card) => (
                      <button
                        key={card.deg}
                        onClick={() => setObserver((prev) => ({ ...prev, viewHeadingDeg: card.deg }))}
                        className={`py-1 rounded border text-center transition ${
                          observer.viewHeadingDeg === card.deg
                            ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                            : "bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {card.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 360° Polar Glare Rose Diagram (Radar / Rose) */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      360° Polar Glare Rose (Radar)
                    </span>
                    <span className="text-xs text-orange-400 font-medium">
                      Worst Angle: {pointResult.criticalHeadingDeg}° (UGR {pointResult.ugrMax})
                    </span>
                  </div>

                  <div className="h-52 w-full flex items-center justify-center bg-slate-950/80 rounded-lg p-2 border border-slate-800 relative">
                    <PolarGlareRoseSVG
                      steps={pointResult.polarSteps}
                      activeHeading={observer.viewHeadingDeg}
                      criticalHeading={pointResult.criticalHeadingDeg}
                      limitUGR={pointResult.limitUGR}
                      onSelectAngle={(deg) =>
                        setObserver((prev) => ({ ...prev, viewHeadingDeg: deg }))
                      }
                    />
                  </div>
                </div>

                {/* Contributing Luminaires Ranking */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Overhead Glare Contributors ({pointResult.contributions.length})
                  </span>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {pointResult.contributions.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 hover:border-slate-700"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">
                            Luminaire #{c.index}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({c.distance}m dist, Guth p={c.guthPositionIndex})
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Azimuth {c.azimuthDeg}° • Elev {c.elevationDeg}° • L={c.luminanceCdM2} cd/m²
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              c.severity === "critical"
                                ? "bg-rose-500/20 text-rose-300"
                                : c.severity === "high"
                                ? "bg-orange-500/20 text-orange-300"
                                : c.severity === "medium"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {c.percentContribution}% Glare
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WORKSTATIONS AREA GRID */}
            {activeTab === "area_grid" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Workstation Area Grid Configuration
                  </span>
                  <p className="text-xs text-slate-400">
                    Evaluates Unified Glare Rating at every desk across the room to verify visual comfort for all seated workers.
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Columns (along Length)</label>
                      <select
                        value={areaCols}
                        onChange={(e) => setAreaCols(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                      >
                        <option value={3}>3 Desks</option>
                        <option value={4}>4 Desks</option>
                        <option value={5}>5 Desks</option>
                        <option value={6}>6 Desks</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Rows (along Width)</label>
                      <select
                        value={areaRows}
                        onChange={(e) => setAreaRows(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                      >
                        <option value={3}>3 Rows</option>
                        <option value={4}>4 Rows</option>
                        <option value={5}>5 Rows</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grid Scorecard */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-center">
                    <div className="text-slate-400">Average UGR</div>
                    <div className="text-lg font-bold text-slate-100 mt-1">{areaResult.averageUGR}</div>
                  </div>
                  <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-center">
                    <div className="text-slate-400">Worst Workstation</div>
                    <div className="text-lg font-bold text-rose-400 mt-1">{areaResult.maxUGR}</div>
                  </div>
                  <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-center">
                    <div className="text-slate-400">Compliance Rate</div>
                    <div className="text-lg font-bold text-emerald-400 mt-1">
                      {areaResult.percentCompliant}%
                    </div>
                  </div>
                </div>

                {/* Visual Grid Heatmap Matrix */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Workstation UGR Matrix ({areaCols}x{areaRows})
                  </span>

                  <div
                    className="grid gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800"
                    style={{ gridTemplateColumns: `repeat(${areaCols}, minmax(0, 1fr))` }}
                  >
                    {areaResult.points.map((pt, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-center text-xs font-mono border transition ${
                          pt.ugr <= activeStandard.ugrLimit
                            ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-950/40 border-rose-500/30 text-rose-300 font-bold"
                        }`}
                      >
                        <div>{pt.ugr}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {pt.ugr <= activeStandard.ugrLimit ? "✓" : "⚠"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STANDARDS & MITIGATION */}
            {activeTab === "standards" && (
              <div className="space-y-5">
                {/* Standard Task Selector */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    EN 12464-1 Space / Visual Task Category
                  </span>

                  <select
                    value={selectedStandardId}
                    onChange={(e) => setSelectedStandardId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {EN_12464_UGR_LIMITS.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.name} (Limit: UGR ≤ {std.ugrLimit})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400">{activeStandard.description}</p>
                </div>

                {/* Scorecard */}
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Visual Comfort Verdict
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        pointResult.isCompliant
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {pointResult.isCompliant ? "COMPLIANT PASS ✓" : "FAIL (GLARE VIOLATION) ✗"}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Calculated UGR:</span>
                      <span className="font-bold text-slate-100">{pointResult.ugr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Allowable Maximum Limit (UGR_L):</span>
                      <span className="font-bold text-indigo-400">≤ {activeStandard.ugrLimit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Worst-Case 360° Angle:</span>
                      <span className="font-bold text-amber-400">
                        {pointResult.criticalHeadingDeg}° ({pointResult.ugrMax})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Background Luminance (L_b):</span>
                      <span className="font-bold text-slate-100">{pointResult.backgroundLuminance} cd/m²</span>
                    </div>
                  </div>
                </div>

                {/* AI Glare Mitigation Assistant */}
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-indigo-300">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    Glare Mitigation Recommendations
                  </div>

                  <ul className="space-y-2 text-slate-300 list-disc list-inside">
                    <li>
                      <span className="font-medium text-amber-200">Orientation:</span> Align long axis of linear luminaires parallel to the primary sightline.
                    </li>
                    <li>
                      <span className="font-medium text-amber-200">Optics:</span> Select microprismatic diffuser or UGR &lt; 19 optical louvre panels.
                    </li>
                    <li>
                      <span className="font-medium text-amber-200">Background Illuminance:</span> Increase ceiling and upper wall reflectances to boost background luminance L_b.
                    </li>
                    <li>
                      <span className="font-medium text-amber-200">Mounting Height:</span> Raising fixtures 0.2m - 0.4m moves luminaires into higher Guth position angle p.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 4: CIE 117 TABLE */}
            {activeTab === "cie_table" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    CIE 117 Standard Tabular Datasheet
                  </span>
                  <p className="text-xs text-slate-400">
                    Standardized room aspect ratios ($Y$) comparing crosswise vs endwise discomfort ratings across standard surface reflectance combinations.
                  </p>

                  <div className="overflow-x-auto border border-slate-800 rounded-lg">
                    <table className="w-full text-left text-[11px] text-slate-300 font-mono">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="p-2">Room (Y)</th>
                          <th className="p-2">Cross (70/50/20)</th>
                          <th className="p-2">Cross (50/30/20)</th>
                          <th className="p-2">End (70/50/20)</th>
                          <th className="p-2">End (50/30/20)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {cieTable.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="p-2 font-bold text-amber-400">{row.roomDimensionY}</td>
                            <td className="p-2">{row.crosswise70_50_20}</td>
                            <td className="p-2 text-slate-400">{row.crosswise50_30_20}</td>
                            <td className="p-2">{row.endwise70_50_20}</td>
                            <td className="p-2 text-slate-400">{row.endwise50_30_20}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: REPORT & EXPORT */}
            {activeTab === "report" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      UGR Discomfort Glare Certificate
                    </span>
                    <button
                      onClick={() => {
                        window.print();
                        toast.success("Printing UGR calculation summary");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white font-bold rounded-lg text-xs hover:brightness-110 transition"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Export PDF
                    </button>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                    <div className="text-indigo-400 font-bold">PROJECT: {projectName} - {roomName}</div>
                    <div>STANDARD: EN 12464-1 ({activeStandard.name})</div>
                    <div>OBSERVER: ({observer.x}m, {observer.y}m, {observer.z}m) - Heading: {observer.viewHeadingDeg}°</div>
                    <div>ROOM: {room.length}m x {room.width}m x {room.height}m ({room.workplaneLux} lx avg)</div>
                    <div className="text-emerald-400 font-bold pt-1">
                      UGR(θ={observer.viewHeadingDeg}°) = {pointResult.ugr} (Limit ≤ {activeStandard.ugrLimit}) - {pointResult.isCompliant ? "COMPLIANT" : "FAILED"}
                    </div>
                    <div>WORST-CASE 360°: UGR_max = {pointResult.ugrMax} at θ = {pointResult.criticalHeadingDeg}°</div>
                    <div>WORKSTATION GRID: {areaResult.percentCompliant}% desks meeting UGR ≤ {activeStandard.ugrLimit}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: 3D WebGL / 2D Visualizer Viewport */}
          <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
            {/* Top Viewport Controls */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs">
                <button
                  onClick={() => setShowRays(!showRays)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 font-medium ${
                    showRays ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Sight Rays</span>
                </button>
                <button
                  onClick={() => setShowSightCone(!showSightCone)}
                  className={`px-2.5 py-1 rounded transition flex items-center gap-1 font-medium ${
                    showSightCone ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Gaze Cone</span>
                </button>
              </div>

              {/* Viewport Info Badge */}
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Observer Eye: {observer.z}m ({observer.posture})</span>
              </div>
            </div>

            {/* Viewport 3D Canvas */}
            <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Bottom Status Ribbon */}
            <div className="absolute bottom-3 left-6 right-6 z-10 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Luminaires Visible in Guth Field:{" "}
                <span className="text-slate-200 font-bold">
                  {pointResult.contributions.filter((c) => c.isInFieldOfView).length} / {luminaires.length}
                </span>
              </span>
              <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> High Glare
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Safe
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 8. 3D WEBGL ROOM & GLARE SCENE BUILDER (THREE.JS)
// =========================================================================

function build3DUGRScene(
  scene: any,
  room: RoomEnvironment,
  observer: UGRObserver,
  luminaires: Luminaire3DInstance[],
  result: UGRPointResult,
  options: {
    showRays: boolean;
    showSightCone: boolean;
    showLuminaires: boolean;
  }
) {
  // Clear previous procedural meshes
  const toRemove: any[] = [];
  scene.children.forEach((obj: any) => {
    if (obj.name && obj.name.startsWith("ugr_")) toRemove.push(obj);
  });
  toRemove.forEach((obj: any) => scene.remove(obj));

  const root = new THREE.Group();
  root.name = "ugr_root";

  // 1. Room Floor
  const floorGeo = new THREE.PlaneGeometry(room.length, room.width);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(room.length / 2, room.width / 2, 0);
  root.add(floorMesh);

  // Room Wireframe Bounds
  const boxGeo = new THREE.BoxGeometry(room.length, room.width, room.height);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x475569 });
  const boxLines = new THREE.LineSegments(edges, lineMat);
  boxLines.position.set(room.length / 2, room.width / 2, room.height / 2);
  root.add(boxLines);

  // 2. Luminaires in Ceiling
  if (options.showLuminaires) {
    const lumGroup = new THREE.Group();
    luminaires.forEach((lum) => {
      // Find contribution
      const contrib = result.contributions.find((c) => c.id === lum.id);
      let lumColor = 0xe2e8f0; // default white
      if (contrib && contrib.isInFieldOfView) {
        if (contrib.severity === "critical") lumColor = 0xf43f5e; // red
        else if (contrib.severity === "high") lumColor = 0xf97316; // orange
        else if (contrib.severity === "medium") lumColor = 0xfbbf24; // yellow
        else lumColor = 0x34d399; // green
      }

      const lumGeo = new THREE.BoxGeometry(lum.lengthM, lum.widthM, 0.06);
      const lumMat = new THREE.MeshStandardMaterial({
        color: lumColor,
        emissive: lumColor,
        emissiveIntensity: 0.6,
      });
      const lumMesh = new THREE.Mesh(lumGeo, lumMat);
      lumMesh.position.set(lum.x, lum.y, lum.z);
      lumGroup.add(lumMesh);
    });
    root.add(lumGroup);
  }

  // 3. Observer Eye Reticle & Figure
  const obsGroup = new THREE.Group();
  // Seated chair / pedestal
  const chairGeo = new THREE.CylinderGeometry(0.3, 0.35, observer.z * 0.7, 16);
  chairGeo.rotateX(Math.PI / 2);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  const chairMesh = new THREE.Mesh(chairGeo, chairMat);
  chairMesh.position.set(observer.x, observer.y, (observer.z * 0.7) / 2);
  obsGroup.add(chairMesh);

  // Observer Head
  const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x6366f1 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.set(observer.x, observer.y, observer.z);
  obsGroup.add(headMesh);

  // Line of Sight Arrow
  const viewRad = (observer.viewHeadingDeg * Math.PI) / 180;
  const arrowDir = new THREE.Vector3(Math.cos(viewRad), Math.sin(viewRad), 0);
  const arrowOrigin = new THREE.Vector3(observer.x, observer.y, observer.z);
  const arrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, 1.8, 0xf59e0b, 0.35, 0.15);
  obsGroup.add(arrow);

  // 4. Glare Sight Cone (Guth Visual Field Frustum)
  if (options.showSightCone) {
    const coneLen = 3.5;
    const coneRadius = coneLen * Math.tan((53 * Math.PI) / 180); // 53° Guth cutoff
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneLen, 24, 1, true);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(observer.x + (arrowDir.x * coneLen) / 2, observer.y + (arrowDir.y * coneLen) / 2, observer.z);
    coneMesh.rotation.z = viewRad - Math.PI / 2;
    obsGroup.add(coneMesh);
  }

  // 5. Sight Rays connecting eye to visible overhead fixtures
  if (options.showRays) {
    result.contributions.forEach((c) => {
      if (!c.isInFieldOfView) return;

      const pts = [
        new THREE.Vector3(observer.x, observer.y, observer.z),
        new THREE.Vector3(c.x, c.y, c.z),
      ];
      const rayGeo = new THREE.BufferGeometry().setFromPoints(pts);

      let rayColor = 0x34d399; // green safe
      if (c.severity === "critical") rayColor = 0xf43f5e; // red
      else if (c.severity === "high") rayColor = 0xf97316; // orange
      else if (c.severity === "medium") rayColor = 0xfbbf24; // yellow

      const rayMat = new THREE.LineBasicMaterial({
        color: rayColor,
        transparent: true,
        opacity: c.severity === "critical" ? 0.9 : 0.45,
      });
      const line = new THREE.Line(rayGeo, rayMat);
      obsGroup.add(line);
    });
  }

  root.add(obsGroup);
  scene.add(root);
}

// =========================================================================
// 9. POLAR GLARE ROSE SVG RADAR COMPONENT
// =========================================================================

function PolarGlareRoseSVG({
  steps,
  activeHeading,
  criticalHeading,
  limitUGR,
  onSelectAngle,
}: {
  steps: any[];
  activeHeading: number;
  criticalHeading: number;
  limitUGR: number;
  onSelectAngle: (deg: number) => void;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.42;

  // Scale: UGR 10 = center, UGR 30 = maxR
  const getRadius = (ugr: number) => {
    const norm = Math.max(0, Math.min(1, (ugr - 10) / 20));
    return norm * maxR;
  };

  // Build Radar Polygon Points
  const polyPoints = steps
    .map((s) => {
      const rad = ((s.angleDeg - 90) * Math.PI) / 180; // 0° North at top
      const r = getRadius(s.ugr);
      const px = cx + r * Math.cos(rad);
      const py = cy + r * Math.sin(rad);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  // Limit Ring (UGR Limit circle)
  const limitRadius = getRadius(limitUGR);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full select-none">
      {/* Background concentric rings: UGR 16, 19, 22 */}
      {[16, 19, 22].map((ringUgr) => (
        <circle
          key={ringUgr}
          cx={cx}
          cy={cy}
          r={getRadius(ringUgr)}
          fill="none"
          stroke="#334155"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
      ))}

      {/* Axis crosslines */}
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#1e293b" strokeWidth="0.8" />
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#1e293b" strokeWidth="0.8" />

      {/* Cardinal Labels */}
      <text x={cx} y={cy - maxR - 2} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="bold">
        N (90°)
      </text>
      <text x={cx + maxR + 2} y={cy + 2.5} textAnchor="start" fill="#94a3b8" fontSize="7" fontWeight="bold">
        E (0°)
      </text>
      <text x={cx} y={cy + maxR + 8} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="bold">
        S (270°)
      </text>
      <text x={cx - maxR - 2} y={cy + 2.5} textAnchor="end" fill="#94a3b8" fontSize="7" fontWeight="bold">
        W (180°)
      </text>

      {/* Limit Ring Highlight */}
      <circle
        cx={cx}
        cy={cy}
        r={limitRadius}
        fill="none"
        stroke="#ef4444"
        strokeWidth="1.0"
        strokeDasharray="3,3"
      />

      {/* UGR Radar Shape */}
      <polygon
        points={polyPoints}
        fill="rgba(99, 102, 241, 0.25)"
        stroke="#6366f1"
        strokeWidth="1.4"
      />

      {/* Step Clickable Dots */}
      {steps.map((s) => {
        const rad = ((s.angleDeg - 90) * Math.PI) / 180;
        const r = getRadius(s.ugr);
        const px = cx + r * Math.cos(rad);
        const py = cy + r * Math.sin(rad);
        const isCurrent = s.angleDeg === activeHeading;
        const isCritical = s.angleDeg === criticalHeading;

        return (
          <circle
            key={s.angleDeg}
            cx={px}
            cy={py}
            r={isCurrent ? 3.5 : isCritical ? 3.0 : 1.8}
            fill={isCurrent ? "#fbbf24" : isCritical ? "#f43f5e" : s.isCompliant ? "#34d399" : "#ef4444"}
            stroke="#ffffff"
            strokeWidth={isCurrent ? 1.0 : 0.4}
            className="cursor-pointer hover:r-4 transition"
            onClick={() => onSelectAngle(s.angleDeg)}
          >
            <title>{`${s.cardinalLabel}: UGR ${s.ugr}`}</title>
          </circle>
        );
      })}

      {/* Center Pivot */}
      <circle cx={cx} cy={cy} r={2} fill="#94a3b8" />
    </svg>
  );
}
