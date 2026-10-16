import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Trash2,
  Box,
  Sliders,
  Check,
  Eye,
  Info,
  Maximize2,
  ArrowUpRight,
  Shield,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  FurnitureItem,
  StaircaseParameters,
  ExtrusionPolygonPoint,
  createStaircaseItem,
  calculateStaircaseBlondel,
  calculateStaircaseLighting,
  DIALUX_MATERIAL_CATALOG,
} from "@/lib/dialux-furniture-material-engine";

export interface StaircaseExtrusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomLength: number;
  roomWidth: number;
  roomHeight: number;
  luminaires?: Array<{ x: number; y: number; z: number; lumens?: number; wattage?: number; isExcluded?: boolean }>;
  mf?: number;
  onAddStaircase: (item: FurnitureItem) => void;
}

export const STAIRCASE_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  type: "straight" | "with_landing" | "quarter_turn" | "half_turn" | "compact";
  stepCount: number;
  riserHeight: number;
  treadDepth: number;
  stairWidth: number;
  hasTopLanding: boolean;
  topLandingLength: number;
  hasHandrail: boolean;
  materialId: string;
  colorHex: string;
  targetLux: number;
}> = [
  {
    id: "straight_standard",
    name: "Standard Straight Flight (10 Steps)",
    description: "Classic straight run staircase for commercial, residential and industrial halls.",
    type: "straight",
    stepCount: 10,
    riserHeight: 0.17,
    treadDepth: 0.28,
    stairWidth: 1.20,
    hasTopLanding: false,
    topLandingLength: 1.20,
    hasHandrail: true,
    materialId: "concrete_fair_faced",
    colorHex: "#94a3b8",
    targetLux: 100,
  },
  {
    id: "flight_with_landing",
    name: "Straight Flight with Top Landing (12 Steps)",
    description: "Connects ground level to first floor mezzanine with a 1.2m upper landing platform.",
    type: "with_landing",
    stepCount: 12,
    riserHeight: 0.17,
    treadDepth: 0.28,
    stairWidth: 1.20,
    hasTopLanding: true,
    topLandingLength: 1.20,
    hasHandrail: true,
    materialId: "wood_oak_parquet",
    colorHex: "#d4b996",
    targetLux: 150,
  },
  {
    id: "industrial_steel",
    name: "Industrial Metal Grating Stairs (14 Steps)",
    description: "High-pitch industrial staircase with steel stringers and safety handrail.",
    type: "straight",
    stepCount: 14,
    riserHeight: 0.19,
    treadDepth: 0.25,
    stairWidth: 1.00,
    hasTopLanding: true,
    topLandingLength: 1.00,
    hasHandrail: true,
    materialId: "metal_aluminum_brushed",
    colorHex: "#64748b",
    targetLux: 150,
  },
  {
    id: "compact_service",
    name: "Compact Plantroom Access Steps (5 Steps)",
    description: "Short transition steps for equipment plenums, pump rooms, and raised access floors.",
    type: "compact",
    stepCount: 5,
    riserHeight: 0.18,
    treadDepth: 0.26,
    stairWidth: 0.90,
    hasTopLanding: false,
    topLandingLength: 0.80,
    hasHandrail: true,
    materialId: "concrete_rough_cast",
    colorHex: "#64748b",
    targetLux: 100,
  },
  {
    id: "luxury_marble",
    name: "Architectural Marble Grand Stairs (8 Steps)",
    description: "Wide prestigious staircase for entrance lobbies and corporate atriums.",
    type: "straight",
    stepCount: 8,
    riserHeight: 0.16,
    treadDepth: 0.32,
    stairWidth: 2.00,
    hasTopLanding: true,
    topLandingLength: 1.50,
    hasHandrail: true,
    materialId: "tiles_marble_carrara",
    colorHex: "#e2e8f0",
    targetLux: 200,
  },
];

export function StaircaseExtrusionModal({
  isOpen,
  onClose,
  roomLength,
  roomWidth,
  roomHeight,
  luminaires = [],
  mf = 0.8,
  onAddStaircase,
}: StaircaseExtrusionModalProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<"presets" | "geometry" | "profile" | "placement" | "lighting">("geometry");

  // Staircase parameters
  const [stairType, setStairType] = useState<"straight" | "with_landing" | "quarter_turn" | "half_turn" | "compact">("straight");
  const [stepCount, setStepCount] = useState<number>(10);
  const [riserHeight, setRiserHeight] = useState<number>(0.17); // 17 cm
  const [treadDepth, setTreadDepth] = useState<number>(0.28);   // 28 cm
  const [stairWidth, setStairWidth] = useState<number>(1.20);   // Extrusion depth
  const [waistThickness, setWaistThickness] = useState<number>(0.15);
  const [hasTopLanding, setHasTopLanding] = useState<boolean>(false);
  const [topLandingLength, setTopLandingLength] = useState<number>(1.20);
  const [hasHandrail, setHasHandrail] = useState<boolean>(true);
  const [handrailSide, setHandrailSide] = useState<"left" | "right" | "both">("right");

  // Material & Color
  const [materialId, setMaterialId] = useState<string>("concrete_fair_faced");
  const [colorHex, setColorHex] = useState<string>("#94a3b8");

  // 3D Placement in room
  const [posX, setPosX] = useState<number>(Number((roomLength / 2).toFixed(2)));
  const [posZ, setPosZ] = useState<number>(Number((roomWidth / 2).toFixed(2)));
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  // Lighting standard requirements
  const [targetLux, setTargetLux] = useState<number>(100); // 100 lx for EN 12464-1 general stairs

  // 2D Profile Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync default position on open
  useEffect(() => {
    if (isOpen) {
      setPosX(Number((roomLength * 0.35).toFixed(2)));
      setPosZ(Number((roomWidth * 0.5).toFixed(2)));
    }
  }, [isOpen, roomLength, roomWidth]);

  // Handle Preset selection
  const handleApplyPreset = (preset: typeof STAIRCASE_PRESETS[0]) => {
    setStairType(preset.type);
    setStepCount(preset.stepCount);
    setRiserHeight(preset.riserHeight);
    setTreadDepth(preset.treadDepth);
    setStairWidth(preset.stairWidth);
    setHasTopLanding(preset.hasTopLanding);
    setTopLandingLength(preset.topLandingLength);
    setHasHandrail(preset.hasHandrail);
    setMaterialId(preset.materialId);
    setColorHex(preset.colorHex);
    setTargetLux(preset.targetLux);
    toast.success(`Loaded preset: ${preset.name}`);
  };

  // Blondel comfort calculation
  const blondel = useMemo(() => {
    return calculateStaircaseBlondel(riserHeight, treadDepth);
  }, [riserHeight, treadDepth]);

  // Geometric totals
  const totalRun = stepCount * treadDepth + (hasTopLanding ? topLandingLength : 0);
  const totalHeight = stepCount * riserHeight;

  // Build temporary staircase item for preview & photometric calculation
  const currentStairItem: FurnitureItem = useMemo(() => {
    return createStaircaseItem("preview_stair", posX, posZ, rotationDeg, {
      type: stairType,
      stepCount,
      riserHeight,
      treadDepth,
      stairWidth,
      waistThickness,
      hasTopLanding,
      topLandingLength,
      hasHandrail,
      handrailSide,
      materialId,
      colorHex,
      calcSurfaceEnabled: true,
      targetLux,
    });
  }, [
    posX,
    posZ,
    rotationDeg,
    stairType,
    stepCount,
    riserHeight,
    treadDepth,
    stairWidth,
    waistThickness,
    hasTopLanding,
    topLandingLength,
    hasHandrail,
    handrailSide,
    materialId,
    colorHex,
    targetLux,
  ]);

  // Lighting evaluation on the staircase treads
  const lightingResult = useMemo(() => {
    return calculateStaircaseLighting({
      stair: currentStairItem,
      luminaires,
      mf,
    });
  }, [currentStairItem, luminaires, mf]);

  // Draw 2D Side Profile on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Coordinate transformation
    const pad = 40;
    const availW = width - 2 * pad;
    const availH = height - 2 * pad;
    const scale = Math.min(availW / Math.max(0.1, totalRun), availH / Math.max(0.1, totalHeight + 1.0));

    const originX = pad;
    const originY = height - pad;

    // Draw grid background lines
    ctx.strokeStyle = "#272a34";
    ctx.lineWidth = 1;
    for (let x = originX; x <= originX + totalRun * scale; x += 0.5 * scale) {
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, originY);
      ctx.stroke();
    }
    for (let y = originY; y >= originY - totalHeight * scale; y -= 0.5 * scale) {
      ctx.beginPath();
      ctx.moveTo(originX, y);
      ctx.lineTo(originX + totalRun * scale, y);
      ctx.stroke();
    }

    // Floor baseline
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, originY);
    ctx.lineTo(width - 10, originY);
    ctx.stroke();

    // 1. Draw Stepped Extrusion Polygon (Tutorial 13)
    ctx.beginPath();
    ctx.moveTo(originX, originY);

    let curX = originX;
    let curY = originY;

    // Stepped profile
    for (let i = 0; i < stepCount; i++) {
      // Riser up
      curY -= riserHeight * scale;
      ctx.lineTo(curX, curY);

      // Tread right
      curX += treadDepth * scale;
      ctx.lineTo(curX, curY);
    }

    // Top landing if present
    if (hasTopLanding) {
      curX += topLandingLength * scale;
      ctx.lineTo(curX, curY);
    }

    // Down to bottom / waist bottom
    const topX = curX;
    const topY = curY;
    const waistBottomY = topY + waistThickness * scale;
    ctx.lineTo(topX, waistBottomY);

    // Sloped bottom soffit
    const bottomSoffitX = originX + treadDepth * scale;
    const bottomSoffitY = originY;
    ctx.lineTo(bottomSoffitX, bottomSoffitY);
    ctx.lineTo(originX, originY);
    ctx.closePath();

    // Fill stepped extrusion body
    ctx.fillStyle = colorHex + "dd";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Draw Handrail & Balusters (if enabled)
    if (hasHandrail) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;

      const railHeightPx = 0.90 * scale;
      ctx.beginPath();
      ctx.moveTo(originX + treadDepth * scale * 0.5, originY - riserHeight * scale - railHeightPx);
      ctx.lineTo(topX - (hasTopLanding ? topLandingLength * scale * 0.5 : 0), topY - railHeightPx);
      ctx.stroke();

      // Posts
      const postCount = Math.max(3, Math.min(6, Math.floor(stepCount / 2)));
      for (let p = 0; p <= postCount; p++) {
        const stepIdx = Math.min(stepCount - 1, Math.floor((p / postCount) * (stepCount - 1)));
        const px = originX + (stepIdx + 0.5) * treadDepth * scale;
        const py = originY - (stepIdx + 1) * riserHeight * scale;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - railHeightPx);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 3. Inclined Calculation Plane (dashed yellow line with measurement points)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY - riserHeight * scale);
    ctx.lineTo(originX + stepCount * treadDepth * scale, originY - totalHeight * scale);
    ctx.stroke();
    ctx.restore();

    // Measurement point circles on treads
    for (let i = 0; i < stepCount; i++) {
      const mx = originX + (i + 0.5) * treadDepth * scale;
      const my = originY - (i + 1) * riserHeight * scale;
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Dimension Callouts
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Total Run: ${totalRun.toFixed(2)} m`, originX + (totalRun * scale) / 2, originY + 22);

    ctx.save();
    ctx.translate(originX - 16, originY - (totalHeight * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Rise: ${totalHeight.toFixed(2)} m`, 0, 0);
    ctx.restore();

    // Pitch Angle Callout
    ctx.fillStyle = "#38bdf8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Pitch: ${blondel.pitchDeg}°`, originX + 20, originY - 10);
  }, [totalRun, totalHeight, stepCount, riserHeight, treadDepth, hasTopLanding, topLandingLength, waistThickness, hasHandrail, colorHex, blondel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 select-none animate-in fade-in-50">
      <div className="bg-[#181a20] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col text-slate-100 overflow-hidden font-sans">
        {/* =========================================================================
            HEADER BAR
        ========================================================================= */}
        <div className="h-14 px-4 bg-[#12141a] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  DIALux evo — Staircases & Extrusion Objects
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Extrusion Body
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Tutorial Part 13
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Handling of extrusion polygon profiles, architectural flights, landings & EN 12464-1 stair lighting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onAddStaircase(currentStairItem);
                onClose();
                toast.success("Inserted Staircase Extrusion Object into 3D CAD scene!");
              }}
              className="h-8 px-3.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Insert into 3D CAD</span>
            </button>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            NAVIGATION TABS
        ========================================================================= */}
        <div className="h-10 px-4 bg-[#14161d] border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto shrink-0">
          {[
            { id: "presets", label: "Staircase Presets", icon: Sparkles },
            { id: "geometry", label: "Geometry & Steps", icon: Sliders },
            { id: "placement", label: "3D Placement & Material", icon: Box },
            { id: "lighting", label: "Lighting & EN 12464-1", icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-7 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-700 text-amber-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            MAIN CONTENT AREA
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#181a20]">
          {/* LEFT CONTROLS PANEL */}
          <div className="w-full md:w-[55%] h-full overflow-y-auto p-4 border-r border-slate-800 space-y-4">
            {/* TAB: PRESETS */}
            {activeTab === "presets" && (
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-1.5">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Standard Staircase Library Presets
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Quickly insert pre-engineered architectural stairs or load as a template for custom extrusion edits.
                  </p>

                  <div className="space-y-2">
                    {STAIRCASE_PRESETS.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className="p-3 rounded-lg bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-xs font-semibold text-white block mb-0.5">
                            {preset.name}
                          </strong>
                          <span className="text-[11px] text-slate-400 block mb-1">
                            {preset.description}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono">
                            <span>{preset.stepCount} Steps</span>
                            <span>•</span>
                            <span>Riser {preset.riserHeight * 100}cm</span>
                            <span>•</span>
                            <span>Tread {preset.treadDepth * 100}cm</span>
                            <span>•</span>
                            <span>Width {preset.stairWidth}m</span>
                          </div>
                        </div>
                        <button className="h-6 px-2.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-bold">
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GEOMETRY & STEPS */}
            {activeTab === "geometry" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    Extrusion Flight Parameters (Profile Polygon)
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Number of Steps (N)</label>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={stepCount}
                        onChange={(e) => setStepCount(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Stair Width W (Extrusion Depth)</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.5}
                        max={5}
                        value={stairWidth}
                        onChange={(e) => setStairWidth(parseFloat(e.target.value) || 1.2)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Riser Height h (m)</label>
                      <input
                        type="number"
                        step={0.01}
                        min={0.10}
                        max={0.25}
                        value={riserHeight}
                        onChange={(e) => setRiserHeight(parseFloat(e.target.value) || 0.17)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-0.5">
                        Current: {(riserHeight * 100).toFixed(1)} cm (Std: 16-18 cm)
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Tread Depth d (m)</label>
                      <input
                        type="number"
                        step={0.01}
                        min={0.20}
                        max={0.45}
                        value={treadDepth}
                        onChange={(e) => setTreadDepth(parseFloat(e.target.value) || 0.28)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                      <span className="text-[9.5px] text-slate-400 block mt-0.5">
                        Current: {(treadDepth * 100).toFixed(1)} cm (Std: 26-30 cm)
                      </span>
                    </div>
                  </div>

                  {/* Blondel Rule Evaluation */}
                  <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10.5px] text-slate-400 block">
                        Blondel's Comfort Formula (2s + a):
                      </span>
                      <strong className={`font-mono ${blondel.isComfortable ? "text-emerald-400" : "text-amber-400"}`}>
                        {blondel.blondelValueCm} cm ({blondel.verdict})
                      </strong>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      Pitch {blondel.pitchDeg}°
                    </span>
                  </div>
                </div>

                {/* Top Landing & Handrail Options */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-400" />
                    Landings & Balustrade Options
                  </h3>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasTopLanding}
                        onChange={(e) => setHasTopLanding(e.target.checked)}
                        className="rounded accent-emerald-500 cursor-pointer"
                      />
                      <span>Include Top Landing Platform</span>
                    </label>
                    {hasTopLanding && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Length:</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0.6}
                          max={3.0}
                          value={topLandingLength}
                          onChange={(e) => setTopLandingLength(parseFloat(e.target.value) || 1.2)}
                          className="h-7 w-16 text-center bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                        />
                        <span className="text-[10px] text-slate-400">m</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasHandrail}
                        onChange={(e) => setHasHandrail(e.target.checked)}
                        className="rounded accent-emerald-500 cursor-pointer"
                      />
                      <span>Include Safety Handrail (0.90 m height)</span>
                    </label>

                    {hasHandrail && (
                      <select
                        value={handrailSide}
                        onChange={(e) => setHandrailSide(e.target.value as any)}
                        className="h-7 px-2 bg-[#14161c] border border-slate-700 rounded text-[11px] text-slate-200"
                      >
                        <option value="right">Right Side</option>
                        <option value="left">Left Side</option>
                        <option value="both">Both Sides</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: 3D PLACEMENT & MATERIAL */}
            {activeTab === "placement" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                    <Box className="h-4 w-4 text-emerald-400" />
                    Position & 3D Orientation in Room
                  </h3>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Position X (m)</label>
                      <input
                        type="number"
                        step={0.2}
                        min={0}
                        max={roomLength}
                        value={posX}
                        onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Position Z (m)</label>
                      <input
                        type="number"
                        step={0.2}
                        min={0}
                        max={roomWidth}
                        value={posZ}
                        onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Rotation (°)</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step={45}
                          min={0}
                          max={360}
                          value={rotationDeg}
                          onChange={(e) => setRotationDeg(parseFloat(e.target.value) || 0)}
                          className="w-full h-8 px-2 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono text-center"
                        />
                        <button
                          onClick={() => setRotationDeg((prev) => (prev + 90) % 360)}
                          className="h-8 px-2 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300 cursor-pointer"
                          title="Rotate 90° clockwise"
                        >
                          <RotateCw className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Surface Material Selection */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-purple-400" />
                    Staircase Tread & Stringer Material
                  </h3>

                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {DIALUX_MATERIAL_CATALOG.filter((m) =>
                      ["concrete", "wood", "tiles", "metal"].includes(m.category)
                    ).map((mat) => {
                      const isSel = materialId === mat.id;
                      return (
                        <div
                          key={mat.id}
                          onClick={() => {
                            setMaterialId(mat.id);
                            setColorHex(mat.colorHex);
                          }}
                          className={`p-2 rounded border transition-all cursor-pointer flex items-center gap-2 ${
                            isSel
                              ? "bg-purple-950/40 border-purple-500 text-white"
                              : "bg-[#14161c] border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div
                            className="h-5 w-5 rounded border border-slate-700 shrink-0"
                            style={{ backgroundColor: mat.colorHex }}
                          />
                          <div className="truncate">
                            <strong className="text-[11px] block truncate">{mat.name}</strong>
                            <span className="text-[9.5px] text-slate-400 font-mono">
                              ρ = {Math.round(mat.reflectance * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LIGHTING & EN 12464-1 */}
            {activeTab === "lighting" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      EN 12464-1 Staircase Lighting Evaluation
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        lightingResult.isCompliant
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {lightingResult.isCompliant ? "CONFORM" : "NON-CONFORM"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Per EN 12464-1 § 5.3, staircases require maintained illuminance on treads of at least{" "}
                    <strong className="text-slate-200">{targetLux} lx</strong> with uniformity $U_0 \ge 0.40$ to prevent tripping and glare shadows.
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono mb-3">
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Maintained Tread Lux</span>
                      <strong className="text-sm font-bold text-emerald-400">{lightingResult.avgLux} lx</strong>
                      <span className="text-[9px] text-slate-500">Req: ≥ {targetLux} lx</span>
                    </div>
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Min Tread Lux</span>
                      <strong className="text-sm font-bold text-slate-200">{lightingResult.minLux} lx</strong>
                    </div>
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Uniformity U0</span>
                      <strong className="text-sm font-bold text-emerald-400">{lightingResult.uniformityU0.toFixed(2)}</strong>
                      <span className="text-[9px] text-slate-500">Req: ≥ 0.40</span>
                    </div>
                  </div>

                  {/* Step-by-step tread lux table */}
                  <div className="border border-slate-800 rounded overflow-hidden">
                    <div className="bg-slate-800/80 px-2.5 py-1 text-[10.5px] font-bold text-slate-200 flex justify-between">
                      <span>Step Number</span>
                      <span>Coordinates (X, Y, Z)</span>
                      <span>Maintained Lux</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 text-[10px] font-mono">
                      {lightingResult.stepPoints.map((pt) => (
                        <div key={pt.stepNumber} className="px-2.5 py-1 flex justify-between bg-slate-900/40">
                          <span className="text-slate-300 font-semibold">Step {pt.stepNumber}</span>
                          <span className="text-slate-400">({pt.x}m, {pt.y}m, {pt.z}m)</span>
                          <span className="font-bold text-emerald-400">{pt.lux} lx</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT VISUAL PREVIEW: 2D PROFILE ELEVATION CANVAS */}
          <div className="w-full md:w-[45%] h-full flex flex-col p-4 bg-[#121419] overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-amber-400" />
                2D Extrusion Side Profile & Lighting Grid
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {stepCount} Steps • Rise {totalHeight.toFixed(2)}m
              </span>
            </div>

            <div className="flex-1 min-h-0 bg-[#0d0f13] rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden p-2">
              <canvas
                ref={canvasRef}
                width={400}
                height={320}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Quick Metrics */}
            <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 grid grid-cols-3 gap-2 text-center font-mono">
              <div>
                <span className="text-[9.5px] text-slate-500 block">Total Rise</span>
                <strong className="text-xs text-white font-bold">{totalHeight.toFixed(2)} m</strong>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block">Total Run</span>
                <strong className="text-xs text-white font-bold">{totalRun.toFixed(2)} m</strong>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block">Avg Tread Lux</span>
                <strong className="text-xs text-emerald-400 font-bold">{lightingResult.avgLux} lx</strong>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BOTTOM ACTIONS TOOLBAR
        ========================================================================= */}
        <div className="h-14 px-4 bg-[#12141a] border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="h-4 w-4 text-slate-500" />
            <span>
              Staircase Extrusion ({stepCount} Steps, {stairWidth}m wide, at X: {posX}m, Z: {posZ}m)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                onAddStaircase(currentStairItem);
                onClose();
                toast.success("Added Staircase Extrusion Body into 3D Scene!");
              }}
              className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Insert into 3D CAD</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
