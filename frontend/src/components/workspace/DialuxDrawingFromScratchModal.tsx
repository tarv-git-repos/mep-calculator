import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
  Layers,
  Ruler,
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
  Trash2,
  Eye,
  DoorOpen,
  CircleDot,
  Copy,
  Building,
  MousePointer,
  Square,
  HelpCircle,
  Move,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Point2D,
  HelpLine,
  WallAperture,
  ApertureType,
  ScratchRoom,
  ScratchStorey,
  ScratchBuilding,
  PRESET_SCRATCH_BUILDINGS,
  findHelpLineIntersection,
  snapToGuidesAndGrid,
  calculateAreaShoelace,
  calculatePerimeter,
  duplicateStoreyUpwards,
} from "@/lib/dialux-scratch-engine";

export interface DialuxDrawingFromScratchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBuildingToScene?: (building: ScratchBuilding) => void;
  projectName?: string;
}

export function DialuxDrawingFromScratchModal({
  isOpen,
  onClose,
  onApplyBuildingToScene,
  projectName = "New Architectural Project",
}: DialuxDrawingFromScratchModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"helplines" | "rooms" | "apertures" | "storeys" | "scene">("helplines");

  // Building Model State
  const [building, setBuilding] = useState<ScratchBuilding>(PRESET_SCRATCH_BUILDINGS[0]);
  const activeStorey = useMemo(() => {
    return building.storeys.find((s) => s.id === building.activeStoreyId) || building.storeys[0];
  }, [building]);

  // Selected Room & Wall
  const [selectedRoomId, setSelectedRoomId] = useState<string>(activeStorey.rooms[0]?.id || "");
  const selectedRoom = useMemo(() => {
    return activeStorey.rooms.find((r) => r.id === selectedRoomId) || activeStorey.rooms[0];
  }, [activeStorey, selectedRoomId]);

  const [selectedWallIndex, setSelectedWallIndex] = useState<number>(0);

  // Snapping & Drawing Configuration
  const [gridStep, setGridStep] = useState<number>(0.25);
  const [snapToHelplines, setSnapToHelplines] = useState<boolean>(true);
  const [drawingMode, setDrawingMode] = useState<"select" | "draw_room" | "add_helpline">("select");

  // Temporary In-Progress Room Polygon
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [cursorPos, setCursorPos] = useState<Point2D>({ x: 0, y: 0 });
  const [snapFeedback, setSnapFeedback] = useState<string>("");

  // New Help Line Modal Input
  const [newHelpLineType, setNewHelpLineType] = useState<"horizontal" | "vertical">("horizontal");
  const [newHelpLineCoord, setNewHelpLineCoord] = useState<number>(5.0);

  // Viewport Settings
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [cameraView, setCameraView] = useState<"3d_orbit" | "top" | "walkthrough">("3d_orbit");

  // Three.js Canvas Reference
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);

  // Load Preset
  const handleSelectPreset = (presetId: string) => {
    const found = PRESET_SCRATCH_BUILDINGS.find((b) => b.id === presetId);
    if (found) {
      setBuilding(JSON.parse(JSON.stringify(found)));
      setSelectedRoomId(found.storeys[0]?.rooms[0]?.id || "");
      toast.info(`Loaded architecture: ${found.name}`);
    }
  };

  // Add Help Line
  const handleAddHelpLine = () => {
    const id = `hl-${Date.now()}`;
    const newLine: HelpLine = {
      id,
      name: `${newHelpLineType === "horizontal" ? "Y" : "X"} = ${newHelpLineCoord}m Guide`,
      type: newHelpLineType,
      x1: newHelpLineType === "horizontal" ? 0 : newHelpLineCoord,
      y1: newHelpLineType === "horizontal" ? newHelpLineCoord : 0,
      x2: newHelpLineType === "horizontal" ? 15 : newHelpLineCoord,
      y2: newHelpLineType === "horizontal" ? newHelpLineCoord : 12,
      offsetDistance: newHelpLineCoord,
      color: newHelpLineType === "horizontal" ? "#f59e0b" : "#3b82f6",
      visible: true,
    };
    setBuilding((prev) => ({
      ...prev,
      helpLines: [...prev.helpLines, newLine],
    }));
    toast.success(`Created help line at ${newHelpLineCoord}m`);
  };

  // Delete Help Line
  const handleDeleteHelpLine = (id: string) => {
    setBuilding((prev) => ({
      ...prev,
      helpLines: prev.helpLines.filter((l) => l.id !== id),
    }));
  };

  // Add Aperture (Circular Window, Rectangular Window, Door)
  const handleAddAperture = (type: ApertureType) => {
    if (!selectedRoom) return;

    const id = `ap-${Date.now()}`;
    let newAp: WallAperture;

    if (type === "circular_window") {
      newAp = {
        id,
        name: "Architectural Circular Window (Tutorial 18)",
        type: "circular_window",
        wallIndex: selectedWallIndex,
        positionRatio: 0.5,
        widthM: 1.4,
        heightM: 1.4,
        diameterM: 1.4,
        centerHeightM: 1.6,
        sillHeightM: 0.9,
        frameWidthM: 0.08,
        glassColor: "#67e8f9",
      };
      toast.success("Added Circular Window to selected wall!");
    } else if (type === "rectangular_window") {
      newAp = {
        id,
        name: "Daylight Ribbon Window",
        type: "rectangular_window",
        wallIndex: selectedWallIndex,
        positionRatio: 0.5,
        widthM: 2.0,
        heightM: 1.4,
        sillHeightM: 0.9,
        frameWidthM: 0.06,
        glassColor: "#93c5fd",
      };
      toast.success("Added Rectangular Window to selected wall");
    } else if (type === "door") {
      newAp = {
        id,
        name: "Interior Passage Door",
        type: "door",
        wallIndex: selectedWallIndex,
        positionRatio: 0.5,
        widthM: 0.9,
        heightM: 2.1,
        sillHeightM: 0.0,
        frameWidthM: 0.05,
      };
      toast.success("Added Passage Door to selected wall");
    } else {
      newAp = {
        id,
        name: "Entrance Double Door",
        type: "double_door",
        wallIndex: selectedWallIndex,
        positionRatio: 0.5,
        widthM: 1.8,
        heightM: 2.2,
        sillHeightM: 0.0,
        frameWidthM: 0.06,
      };
      toast.success("Added Double Door to selected wall");
    }

    setBuilding((prev) => ({
      ...prev,
      storeys: prev.storeys.map((st) =>
        st.id === activeStorey.id
          ? {
              ...st,
              rooms: st.rooms.map((rm) =>
                rm.id === selectedRoom.id
                  ? { ...rm, apertures: [...rm.apertures, newAp] }
                  : rm
              ),
            }
          : st
      ),
    }));
  };

  // Duplicate Storey
  const handleDuplicateStorey = () => {
    const updated = duplicateStoreyUpwards(building, activeStorey.id);
    setBuilding(updated);
    toast.success(`Duplicated ${activeStorey.name} upwards! New level created.`);
  };

  // 2D Canvas Drawing & Cursor Snapping
  useEffect(() => {
    if (viewMode !== "2d" || !canvas2DRef.current) return;
    const canvas = canvas2DRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Coordinate Transform: 1m = 40 pixels, margin = 40px
    const scale = 36;
    const offsetX = 50;
    const offsetY = height - 50;

    const toCanvasX = (x: number) => offsetX + x * scale;
    const toCanvasY = (y: number) => offsetY - y * scale;

    // 1. Draw Grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 16; x += 1) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), toCanvasY(0));
      ctx.lineTo(toCanvasX(x), toCanvasY(12));
      ctx.stroke();
    }
    for (let y = 0; y <= 12; y += 1) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), toCanvasY(y));
      ctx.lineTo(toCanvasX(16), toCanvasY(y));
      ctx.stroke();
    }

    // 2. Draw Help Lines (Dashed Guide Lines)
    building.helpLines.forEach((hl) => {
      if (!hl.visible) return;
      ctx.strokeStyle = hl.color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      ctx.moveTo(toCanvasX(hl.x1), toCanvasY(hl.y1));
      ctx.lineTo(toCanvasX(hl.x2), toCanvasY(hl.y2));
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = hl.color;
      ctx.font = "10px monospace";
      ctx.fillText(hl.name, toCanvasX(hl.x1) + 4, toCanvasY(hl.y1) - 4);
    });

    // 3. Draw Rooms in Active Storey
    activeStorey.rooms.forEach((rm) => {
      const isSel = rm.id === selectedRoom?.id;
      const pts = rm.polygon;
      if (pts.length < 3) return;

      // Fill Room Area
      ctx.fillStyle = isSel ? "rgba(59, 130, 246, 0.25)" : "rgba(30, 41, 59, 0.6)";
      ctx.beginPath();
      ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y));
      }
      ctx.closePath();
      ctx.fill();

      // Stroke Room Walls
      ctx.strokeStyle = isSel ? "#60a5fa" : "#94a3b8";
      ctx.lineWidth = isSel ? 3.0 : 2.0;
      ctx.stroke();

      // Room Name & Area Tag
      const cx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const cy = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(rm.name, toCanvasX(cx), toCanvasY(cy) - 6);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${rm.areaM2.toFixed(1)} m²`, toCanvasX(cx), toCanvasY(cy) + 8);
      ctx.textAlign = "left";

      // Draw Apertures (Windows & Doors) on Walls
      rm.apertures.forEach((ap) => {
        const p1 = pts[ap.wallIndex];
        const p2 = pts[(ap.wallIndex + 1) % pts.length];
        if (!p1 || !p2) return;

        const ax = p1.x + (p2.x - p1.x) * ap.positionRatio;
        const ay = p1.y + (p2.y - p1.y) * ap.positionRatio;

        const cAx = toCanvasX(ax);
        const cAy = toCanvasY(ay);

        if (ap.type === "circular_window") {
          // Circular Window symbol: Cyan circle with central cross
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cAx, cAy, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(6, 182, 212, 0.5)";
          ctx.fill();
        } else if (ap.type === "rectangular_window") {
          // Rectangular Window: Double blue line
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cAx, cAy, 4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Door: Amber entrance square
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(cAx - 5, cAy - 5, 10, 10);
        }
      });
    });

    // 4. Draw In-Progress Draft Points
    if (draftPoints.length > 0) {
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(draftPoints[0].x), toCanvasY(draftPoints[0].y));
      for (let i = 1; i < draftPoints.length; i++) {
        ctx.lineTo(toCanvasX(draftPoints[i].x), toCanvasY(draftPoints[i].y));
      }
      ctx.lineTo(toCanvasX(cursorPos.x), toCanvasY(cursorPos.y));
      ctx.stroke();

      // Highlight vertices
      draftPoints.forEach((p) => {
        ctx.fillStyle = "#ec4899";
        ctx.beginPath();
        ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 5. Snapping Cursor Reticle
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    const curCx = toCanvasX(cursorPos.x);
    const curCy = toCanvasY(cursorPos.y);
    ctx.strokeRect(curCx - 5, curCy - 5, 10, 10);
  }, [viewMode, building, activeStorey, selectedRoom, draftPoints, cursorPos]);

  // Handle 2D Canvas Mouse Move & Click
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvas2DRef.current) return;
    const rect = canvas2DRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const scale = 36;
    const offsetX = 50;
    const offsetY = canvas2DRef.current.height - 50;

    const rawX = (px - offsetX) / scale;
    const rawY = (offsetY - py) / scale;

    const { point, snappedTo, label } = snapToGuidesAndGrid(
      rawX,
      rawY,
      snapToHelplines ? building.helpLines : [],
      gridStep
    );

    setCursorPos(point);
    setSnapFeedback(label || "");
  };

  const handleCanvasClick = () => {
    if (drawingMode === "draw_room") {
      // Check if closing polygon near start point
      if (draftPoints.length >= 3) {
        const d = Math.hypot(cursorPos.x - draftPoints[0].x, cursorPos.y - draftPoints[0].y);
        if (d < 0.4) {
          // Close room!
          const area = calculateAreaShoelace(draftPoints);
          const perim = calculatePerimeter(draftPoints);
          const newRoom: ScratchRoom = {
            id: `room-${Date.now()}`,
            name: `New Room ${activeStorey.rooms.length + 1}`,
            polygon: draftPoints,
            wallThickness: 0.25,
            height: activeStorey.heightM,
            targetLux: 500,
            applicationProfile: "Offices - Writing, typing, reading data",
            color: "#3b82f6",
            areaM2: Number(area.toFixed(1)),
            perimeterM: Number(perim.toFixed(1)),
            apertures: [],
          };

          setBuilding((prev) => ({
            ...prev,
            storeys: prev.storeys.map((st) =>
              st.id === activeStorey.id ? { ...st, rooms: [...st.rooms, newRoom] } : st
            ),
          }));

          setDraftPoints([]);
          setDrawingMode("select");
          setSelectedRoomId(newRoom.id);
          toast.success(`Completed room polygon (${area.toFixed(1)} m²)!`);
          return;
        }
      }

      setDraftPoints((prev) => [...prev, cursorPos]);
    }
  };

  // 3D Scene Initialization
  useEffect(() => {
    if (!isOpen || viewMode !== "3d" || !mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    cameraRef.current = camera;
    camera.position.set(16, -18, 16);
    camera.up.set(0, 0, 1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    mountRef.current.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(6, 4, 1.5);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(20, 15, 30);
    scene.add(sun);

    // Build 3D Building Meshes (Walls, Slabs, Circular & Rectangular Windows)
    build3DScratchBuilding(scene, building);

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
  }, [isOpen, viewMode, building]);

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
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                  DIALux evo Drawing from Scratch Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Tutorial 18
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  No CAD Underlay Required
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Help lines, coordinate snapping, wall thicknesses, circular & rectangular windows, and storey stacking
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
              { id: "helplines", label: "Help Lines & Snapping", icon: Ruler },
              { id: "rooms", label: "Rooms & Walls Builder", icon: Layers },
              { id: "apertures", label: "Windows (Circular/Rect) & Doors", icon: CircleDot },
              { id: "storeys", label: "Storeys & Levels", icon: Copy },
              { id: "scene", label: "Synchronize to 3D Scene", icon: CheckCircle2 },
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

          {/* Quick Storey & Room Badge */}
          <div className="hidden lg:flex items-center gap-3 py-1">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300">
              Active: <span className="font-bold text-amber-400">{activeStorey.name}</span>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-300">
              Total Rooms: <span className="font-bold text-slate-100">{activeStorey.rooms.length}</span>
            </span>
          </div>
        </div>

        {/* ================= MAIN SPLIT CONTENT ================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: Controls & Inspector Panels */}
          <div className="w-full lg:w-[480px] xl:w-[500px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-slate-900/60 overflow-y-auto p-5 space-y-6">
            {/* TAB 1: HELP LINES & SNAPPING */}
            {activeTab === "helplines" && (
              <div className="space-y-5">
                {/* Architectural Preset Selection */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Drawing from Scratch Archetypes
                  </span>
                  <select
                    value={building.id}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  >
                    {PRESET_SCRATCH_BUILDINGS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add Help Line Builder */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Add Help Line / Construction Guide
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setNewHelpLineType("horizontal")}
                      className={`p-2 rounded-lg text-xs font-semibold border text-center transition ${
                        newHelpLineType === "horizontal"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                      }`}
                    >
                      Horizontal Line (Y)
                    </button>
                    <button
                      onClick={() => setNewHelpLineType("vertical")}
                      className={`p-2 rounded-lg text-xs font-semibold border text-center transition ${
                        newHelpLineType === "vertical"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
                          : "bg-slate-900 text-slate-400 border-slate-700"
                      }`}
                    >
                      Vertical Line (X)
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-400 block mb-1">
                        Coordinate Offset Distance (m)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={newHelpLineCoord}
                        onChange={(e) => setNewHelpLineCoord(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleAddHelpLine}
                        className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:brightness-110 transition h-[33px]"
                      >
                        Add Guide
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Help Lines List */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Active Help Lines ({building.helpLines.length})
                  </span>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {building.helpLines.map((hl) => (
                      <div
                        key={hl.id}
                        className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: hl.color }}
                          />
                          <span className="font-semibold text-slate-200">{hl.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteHelpLine(hl.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                          title="Delete guide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Snapping Options */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Precision Snapping Controls
                  </span>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">Snap to Help Lines & Intersections</span>
                    <input
                      type="checkbox"
                      checked={snapToHelplines}
                      onChange={(e) => setSnapToHelplines(e.target.checked)}
                      className="accent-amber-500 w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/60">
                    <span className="text-slate-300">Grid Snap Resolution</span>
                    <select
                      value={gridStep}
                      onChange={(e) => setGridStep(parseFloat(e.target.value))}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    >
                      <option value={0.1}>0.10 m (High precision)</option>
                      <option value={0.25}>0.25 m (Standard)</option>
                      <option value={0.5}>0.50 m (Coarse)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ROOMS & WALLS BUILDER */}
            {activeTab === "rooms" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Interactive Room Polygon Drawing
                    </span>
                    <button
                      onClick={() => {
                        setDrawingMode(drawingMode === "draw_room" ? "select" : "draw_room");
                        setDraftPoints([]);
                      }}
                      className={`px-3 py-1 text-xs rounded-md font-bold transition ${
                        drawingMode === "draw_room"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-amber-500 text-slate-950 hover:brightness-110"
                      }`}
                    >
                      {drawingMode === "draw_room" ? "Cancel Drawing" : "Draw New Room Polygon"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {drawingMode === "draw_room"
                      ? "Click on canvas to place room corners. Cursor automatically snaps to help line intersections! Click first point to close polygon."
                      : "Select a room from the list below to inspect its area, wall thicknesses, and apertures."}
                  </p>
                </div>

                {/* Rooms List */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Rooms on {activeStorey.name} ({activeStorey.rooms.length})
                  </span>

                  {activeStorey.rooms.map((rm) => (
                    <div
                      key={rm.id}
                      onClick={() => setSelectedRoomId(rm.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        selectedRoom?.id === rm.id
                          ? "bg-amber-500/10 border-amber-500/50 text-slate-100"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{rm.name}</span>
                        <span className="text-amber-400">{rm.areaM2} m²</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Perimeter: {rm.perimeterM} m</span>
                        <span>Wall Thk: {rm.wallThickness} m</span>
                        <span>Apertures: {rm.apertures.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: WINDOWS & DOORS (CIRCULAR WINDOW FEATURE) */}
            {activeTab === "apertures" && (
              <div className="space-y-5">
                {/* Target Wall Selection */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Place Openings in: {selectedRoom?.name}
                  </span>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Select Target Wall</label>
                    <select
                      value={selectedWallIndex}
                      onChange={(e) => setSelectedWallIndex(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                    >
                      {selectedRoom?.polygon.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Wall Segment {idx + 1} (between Vertex {idx + 1} & Vertex{" "}
                          {((idx + 1) % selectedRoom.polygon.length) + 1})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Aperture Action Buttons */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Insert Aperture / Opening
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* CIRCULAR WINDOW BUTTON (TUTORIAL 18 FEATURE) */}
                    <button
                      onClick={() => handleAddAperture("circular_window")}
                      className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-500/50 hover:bg-cyan-900/60 text-cyan-300 font-semibold flex flex-col items-center gap-1.5 transition text-center shadow-sm"
                    >
                      <CircleDot className="w-5 h-5 text-cyan-400" />
                      <span>Circular Window (Tutorial 18)</span>
                    </button>

                    <button
                      onClick={() => handleAddAperture("rectangular_window")}
                      className="p-3 rounded-lg bg-blue-950/60 border border-blue-500/50 hover:bg-blue-900/60 text-blue-300 font-semibold flex flex-col items-center gap-1.5 transition text-center shadow-sm"
                    >
                      <Box className="w-5 h-5 text-blue-400" />
                      <span>Rectangular Window</span>
                    </button>

                    <button
                      onClick={() => handleAddAperture("door")}
                      className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/50 hover:bg-amber-900/60 text-amber-300 font-semibold flex flex-col items-center gap-1.5 transition text-center shadow-sm"
                    >
                      <DoorOpen className="w-5 h-5 text-amber-400" />
                      <span>Passage Door</span>
                    </button>

                    <button
                      onClick={() => handleAddAperture("double_door")}
                      className="p-3 rounded-lg bg-purple-950/60 border border-purple-500/50 hover:bg-purple-900/60 text-purple-300 font-semibold flex flex-col items-center gap-1.5 transition text-center shadow-sm"
                    >
                      <DoorOpen className="w-5 h-5 text-purple-400" />
                      <span>Double Entrance Door</span>
                    </button>
                  </div>
                </div>

                {/* Existing Openings on Room */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Placed Openings ({selectedRoom?.apertures.length || 0})
                  </span>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
                    {selectedRoom?.apertures.map((ap) => (
                      <div
                        key={ap.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{ap.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Wall {ap.wallIndex + 1} •{" "}
                            {ap.type === "circular_window"
                              ? `Ø ${ap.diameterM}m (center ${ap.centerHeightM}m)`
                              : `${ap.widthM}m x ${ap.heightM}m`}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setBuilding((prev) => ({
                              ...prev,
                              storeys: prev.storeys.map((st) =>
                                st.id === activeStorey.id
                                  ? {
                                      ...st,
                                      rooms: st.rooms.map((rm) =>
                                        rm.id === selectedRoom.id
                                          ? {
                                              ...rm,
                                              apertures: rm.apertures.filter((a) => a.id !== ap.id),
                                            }
                                          : rm
                                      ),
                                    }
                                  : st
                              ),
                            }));
                            toast.info("Removed opening");
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STOREYS & LEVELS */}
            {activeTab === "storeys" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Storey Duplication (Tutorial 18)
                  </span>
                  <p className="text-xs text-slate-400">
                    Once a floor plan is completed from scratch, use "Duplicate Storey Upwards" to automatically stack the next floor level at the exact ceiling elevation.
                  </p>

                  <button
                    onClick={handleDuplicateStorey}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Duplicate Storey Upwards</span>
                  </button>
                </div>

                {/* Storey List */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    Building Storeys ({building.storeys.length})
                  </span>

                  {building.storeys.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setBuilding((prev) => ({ ...prev, activeStoreyId: st.id }))}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        activeStorey.id === st.id
                          ? "bg-amber-500/10 border-amber-500/50 text-slate-100"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{st.name}</span>
                        <span className="text-amber-400">Elevation: {st.elevationM} m</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Height: {st.heightM} m • Rooms: {st.rooms.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: SYNCHRONIZE SCENE */}
            {activeTab === "scene" && (
              <div className="space-y-5">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                    Apply Building to DIALux Engine
                  </span>
                  <p className="text-xs text-slate-400">
                    Synchronize your scratch-drawn building geometry, wall dimensions, storeys, and window cutouts into the main 3D lighting simulation workspace.
                  </p>

                  <button
                    onClick={() => {
                      if (onApplyBuildingToScene) {
                        onApplyBuildingToScene(building);
                      }
                      toast.success("Synchronized scratch building to lighting scene!");
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Synchronize to Lighting Scene</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: 2D CAD Canvas / 3D Three.js Viewport */}
          <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
            {/* Viewport Top Bar */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs">
                <button
                  onClick={() => setViewMode("2d")}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === "2d" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  2D CAD Plan
                </button>
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-2.5 py-1 rounded font-medium transition ${
                    viewMode === "3d" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  3D Extrusion View
                </button>
              </div>

              {/* Snap status readout */}
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-lg text-xs text-slate-300">
                {snapFeedback ? (
                  <span className="text-amber-400 font-mono">{snapFeedback}</span>
                ) : (
                  <span className="text-slate-400 font-mono">
                    ({cursorPos.x.toFixed(2)}m, {cursorPos.y.toFixed(2)}m)
                  </span>
                )}
              </div>
            </div>

            {/* Viewport Canvas Render */}
            {viewMode === "2d" ? (
              <div className="w-full h-full flex items-center justify-center p-4 bg-slate-950 overflow-hidden cursor-crosshair">
                <canvas
                  ref={canvas2DRef}
                  width={850}
                  height={550}
                  onMouseMove={handleCanvasMouseMove}
                  onClick={handleCanvasClick}
                  className="rounded-xl border border-slate-800 shadow-2xl bg-slate-950"
                />
              </div>
            ) : (
              <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 5. 3D WEBGL BUILDING BUILDER (THREE.JS)
// =========================================================================

function build3DScratchBuilding(scene: any, building: ScratchBuilding) {
  // Clear previous meshes
  const toRemove: any[] = [];
  scene.children.forEach((obj: any) => {
    if (obj.name && obj.name.startsWith("scratch_")) toRemove.push(obj);
  });
  toRemove.forEach((obj: any) => scene.remove(obj));

  const root = new THREE.Group();
  root.name = "scratch_root";

  // Build each storey
  building.storeys.forEach((storey) => {
    const storeyGroup = new THREE.Group();
    const zBase = storey.elevationM;
    const h = storey.heightM;

    // Floor Slab
    const slabGeo = new THREE.BoxGeometry(16, 12, storey.floorThicknessM);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.set(7, 5, zBase - storey.floorThicknessM / 2);
    storeyGroup.add(slabMesh);

    // Build Rooms
    storey.rooms.forEach((rm) => {
      const pts = rm.polygon;
      if (pts.length < 3) return;

      // Extrude Walls
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const wallLen = Math.hypot(dx, dy);
        const wallAngle = Math.atan2(dy, dx);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Wall segment
        const wallGeo = new THREE.BoxGeometry(wallLen, rm.wallThickness, h);
        const wallMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.6,
        });
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(midX, midY, zBase + h / 2);
        wallMesh.rotation.z = wallAngle;
        storeyGroup.add(wallMesh);

        // Find apertures on this wall
        const wallApertures = rm.apertures.filter((a) => a.wallIndex === i);
        wallApertures.forEach((ap) => {
          const apX = p1.x + dx * ap.positionRatio;
          const apY = p1.y + dy * ap.positionRatio;

          if (ap.type === "circular_window") {
            // 3D CIRCULAR WINDOW (TUTORIAL 18 FEATURE)
            const d = ap.diameterM || 1.2;
            const cz = zBase + (ap.centerHeightM || 1.5);

            // Frame Ring
            const ringGeo = new THREE.TorusGeometry(d / 2, ap.frameWidthM / 2, 16, 32);
            ringGeo.rotateY(Math.PI / 2);
            const ringMat = new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              metalness: 0.8,
              roughness: 0.2,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.set(apX, apY, cz);
            ringMesh.rotation.z = wallAngle;
            storeyGroup.add(ringMesh);

            // Glass Disc
            const glassGeo = new THREE.CylinderGeometry(d / 2, d / 2, 0.02, 32);
            glassGeo.rotateZ(Math.PI / 2);
            const glassMat = new THREE.MeshStandardMaterial({
              color: 0x67e8f9,
              transparent: true,
              opacity: 0.45,
              roughness: 0.1,
            });
            const glassMesh = new THREE.Mesh(glassGeo, glassMat);
            glassMesh.position.set(apX, apY, cz);
            glassMesh.rotation.z = wallAngle;
            storeyGroup.add(glassMesh);
          } else if (ap.type === "rectangular_window") {
            // Rectangular Window Glass Pane
            const wZ = zBase + ap.sillHeightM + ap.heightM / 2;
            const winGeo = new THREE.BoxGeometry(ap.widthM, rm.wallThickness * 1.1, ap.heightM);
            const winMat = new THREE.MeshStandardMaterial({
              color: 0x93c5fd,
              transparent: true,
              opacity: 0.4,
            });
            const winMesh = new THREE.Mesh(winGeo, winMat);
            winMesh.position.set(apX, apY, wZ);
            winMesh.rotation.z = wallAngle;
            storeyGroup.add(winMesh);
          } else {
            // Door Frame & Panel
            const dZ = zBase + ap.heightM / 2;
            const doorGeo = new THREE.BoxGeometry(ap.widthM, rm.wallThickness * 1.1, ap.heightM);
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f }); // wood
            const doorMesh = new THREE.Mesh(doorGeo, doorMat);
            doorMesh.position.set(apX, apY, dZ);
            doorMesh.rotation.z = wallAngle;
            storeyGroup.add(doorMesh);
          }
        });
      }
    });

    root.add(storeyGroup);
  });

  scene.add(root);
}
