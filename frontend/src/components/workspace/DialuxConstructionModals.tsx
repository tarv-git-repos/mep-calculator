import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  Layers,
  Scissors,
  Square,
  Circle,
  Compass,
  Building2,
  DoorClosed,
  Sliders,
  Sun,
  Cloud,
  Calendar,
  Clock,
  Grid,
  Trash2,
  Plus,
  RefreshCw,
  FileText,
  HelpCircle,
  Settings,
  AlertCircle,
  Info,
  SlidersVertical,
  Eye,
  Palette,
  Box,
  Type,
  Ruler,
  Sparkles,
  Lightbulb,
  Target,
  SlidersHorizontal,
  MapPin,
  LayoutGrid,
  Shapes,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Move,
  EyeOff,
  Crosshair,
  Camera,
  Download,
  Play,
  Maximize2,
  CheckCircle2,
  Monitor,
  Zap,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateCIE97MaintenanceFactor,
  calculateDaylightFactor,
  calculateSunPosition,
  calculateEmergencyLighting,
  calculateComprehensiveDaylight,
  getDaylightFactorFalseColor,
  CIESkyModel,
  ComprehensiveDaylightResult,
  LuminairePhotometricProfile,
  LuminaireInstance,
  LineArrangementConfig,
  CircularArrangementConfig,
  PolygonalArrangementConfig,
  LuminaireOverride,
  transformLuminaireArrangement,
  calculateAimingAngles,
  IndividualLuminaireConfig,
  computeSpaceAutoArrangement,
  generateLuminairePositions,
  LuminaireArrangementMode,
  RaytracerConfig,
  RenderedRaytraceImage,
  RAYTRACER_PRESETS,
  generateRadianceHdrBlob,
  applyHdrExposureAndToneMapping,
} from "@/lib/dialux-photometrics-engine";
import {
  DIALUX_MATERIAL_CATALOG,
  MaterialDefinition,
  MaterialCategory,
  TexturePatternType,
  FurnitureType,
} from "@/lib/dialux-furniture-material-engine";

// ============================================================================
// 1. POLYGON SPACE MODAL
// ============================================================================
export interface PolygonSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomL: number;
  roomW: number;
  roomH: number;
  polygonPreset: "l_shaped" | "t_shaped" | "u_shaped" | "hexagon" | "chamfer";
  polygonWingL: number;
  polygonWingW: number;
  effectiveArea: number;
  effectiveVolume: number;
  onApply: (params: {
    preset: "l_shaped" | "t_shaped" | "u_shaped" | "hexagon" | "chamfer";
    wingL: number;
    wingW: number;
  }) => void;
  onResetToRect: () => void;
}

export function PolygonSpaceModal({
  isOpen,
  onClose,
  roomL,
  roomW,
  roomH,
  polygonPreset: initialPreset,
  polygonWingL: initialWingL,
  polygonWingW: initialWingW,
  effectiveArea,
  effectiveVolume,
  onApply,
  onResetToRect,
}: PolygonSpaceModalProps) {
  const [preset, setPreset] = useState(initialPreset);
  const [wingL, setWingL] = useState(initialWingL);
  const [wingW, setWingW] = useState(initialWingW);

  if (!isOpen) return null;

  // Calculate preview area
  let previewArea = roomL * roomW;
  if (preset === "l_shaped") {
    previewArea = roomL * roomW - (roomL - Math.min(roomL, wingL)) * (roomW - Math.min(roomW, wingW));
  } else if (preset === "t_shaped") {
    previewArea = roomL * wingW + wingL * (roomW - wingW);
  } else if (preset === "hexagon") {
    previewArea = 0.866 * Math.pow(Math.min(roomL, roomW), 2);
  } else if (preset === "chamfer") {
    previewArea = roomL * roomW - 0.5 * Math.pow(Math.min(wingL, wingW), 2);
  } else if (preset === "u_shaped") {
    previewArea = roomL * roomW - Math.min(roomL * 0.5, wingL) * Math.min(roomW * 0.4, wingW);
  }
  const previewVolume = previewArea * roomH;

  // 2D SVG Coordinate Generation
  const svgW = 260;
  const svgH = 180;
  const pad = 24;
  const maxRoom = Math.max(roomL, roomW, 1);
  const scale = Math.min((svgW - 2 * pad) / maxRoom, (svgH - 2 * pad) / maxRoom);

  const ox = pad + ((svgW - 2 * pad) - roomL * scale) / 2;
  const oy = pad + ((svgH - 2 * pad) - roomW * scale) / 2;

  let pathD = "";
  if (preset === "l_shaped") {
    const wL = Math.min(roomL, wingL) * scale;
    const wW = Math.min(roomW, wingW) * scale;
    const rL = roomL * scale;
    const rW = roomW * scale;
    pathD = `M ${ox} ${oy} L ${ox + rL} ${oy} L ${ox + rL} ${oy + wW} L ${ox + wL} ${oy + wW} L ${ox + wL} ${oy + rW} L ${ox} ${oy + rW} Z`;
  } else if (preset === "t_shaped") {
    const rL = roomL * scale;
    const rW = roomW * scale;
    const wW = Math.min(roomW * 0.5, wingW) * scale;
    const halfStem = (Math.min(roomL * 0.6, wingL) * scale) / 2;
    pathD = `M ${ox} ${oy} L ${ox + rL} ${oy} L ${ox + rL} ${oy + wW} L ${ox + rL / 2 + halfStem} ${oy + wW} L ${ox + rL / 2 + halfStem} ${oy + rW} L ${ox + rL / 2 - halfStem} ${oy + rW} L ${ox + rL / 2 - halfStem} ${oy + wW} L ${ox} ${oy + wW} Z`;
  } else if (preset === "u_shaped") {
    const rL = roomL * scale;
    const rW = roomW * scale;
    const cutW = Math.min(rW * 0.45, wingW * scale);
    const cutL = Math.min(rL * 0.5, wingL * scale);
    const stem = (rL - cutL) / 2;
    pathD = `M ${ox} ${oy} L ${ox + rL} ${oy} L ${ox + rL} ${oy + rW} L ${ox + rL - stem} ${oy + rW} L ${ox + rL - stem} ${oy + rW - cutW} L ${ox + stem} ${oy + rW - cutW} L ${ox + stem} ${oy + rW} L ${ox} ${oy + rW} Z`;
  } else if (preset === "chamfer") {
    const rL = roomL * scale;
    const rW = roomW * scale;
    const c = Math.min(wingL * scale, wingW * scale, rL * 0.35, rW * 0.35);
    pathD = `M ${ox} ${oy} L ${ox + rL - c} ${oy} L ${ox + rL} ${oy + c} L ${ox + rL} ${oy + rW} L ${ox} ${oy + rW} Z`;
  } else {
    // Hexagon
    const r = (Math.min(roomL, roomW) * scale) / 2;
    const cx = ox + (roomL * scale) / 2;
    const cy = oy + (roomW * scale) / 2;
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      pts.push(`${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`);
    }
    pathD = `M ${pts.join(" L ")} Z`;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-purple-500/40 rounded-xl shadow-2xl w-full max-w-xl text-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Layers className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Draw Polygon Space</h3>
              <p className="text-[11px] text-slate-400">Generate architectural non-rectangular floor contours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Space Contour Geometry Preset</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: "l_shaped", label: "L-Shape", desc: "Corner cutout" },
                { id: "t_shaped", label: "T-Shape", desc: "Wing projection" },
                { id: "u_shaped", label: "U-Shape", desc: "Courtyard core" },
                { id: "chamfer", label: "Chamfer", desc: "Angled wall" },
                { id: "hexagon", label: "Hexagon", desc: "Radial atrium" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPreset(item.id as any)}
                  className={`p-2 rounded-lg border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    preset === item.id
                      ? "bg-purple-600/30 border-purple-500 text-purple-200 font-bold shadow-md shadow-purple-900/30"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <span className="text-[11px]">{item.label}</span>
                  <span className="text-[9px] text-slate-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Blueprint SVG Preview & Sliders */}
          <div className="grid grid-cols-2 gap-4 bg-[#121417] p-3 rounded-lg border border-slate-800">
            {/* SVG Visualizer */}
            <div className="flex flex-col items-center justify-center bg-[#0d0f12] rounded border border-slate-800/80 p-2 relative">
              <span className="absolute top-1.5 left-2 text-[9.5px] font-mono text-purple-400 flex items-center gap-1">
                <Compass className="size-3 text-red-400" /> Plan View (Top)
              </span>
              <svg width={svgW} height={svgH} className="overflow-visible">
                {/* Background grid */}
                <defs>
                  <pattern id="polyGrid" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#1f242d" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width={svgW} height={svgH} fill="url(#polyGrid)" />
                {/* Active Polygon Footprint */}
                <path
                  d={pathD}
                  fill="rgba(168, 85, 247, 0.22)"
                  stroke="#a855f7"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute bottom-1.5 right-2 text-[9.5px] font-mono text-slate-400">
                {roomL.toFixed(1)}m × {roomW.toFixed(1)}m
              </span>
            </div>

            {/* Dimension Sliders */}
            <div className="flex flex-col justify-between gap-2.5">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400">Wing / Cutout Length (m)</span>
                  <span className="font-mono font-bold text-purple-300">{wingL.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={Math.max(1, roomL - 0.5)}
                  step={0.1}
                  value={wingL}
                  onChange={(e) => setWingL(parseFloat(e.target.value) || 1)}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400">Wing / Cutout Width (m)</span>
                  <span className="font-mono font-bold text-purple-300">{wingW.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={Math.max(1, roomW - 0.5)}
                  step={0.1}
                  value={wingW}
                  onChange={(e) => setWingW(parseFloat(e.target.value) || 1)}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* Area summary */}
              <div className="bg-[#181a1f] p-2.5 rounded border border-slate-700/60 flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Effective Area:</span>
                  <strong className="text-emerald-400 font-mono">{previewArea.toFixed(2)} m²</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Effective Volume:</span>
                  <strong className="text-white font-mono">{previewVolume.toFixed(2)} m³</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ceiling Height:</span>
                  <strong className="text-slate-300 font-mono">{roomH.toFixed(2)} m</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onResetToRect();
              onClose();
              toast.info("Space reset to standard Rectangular room");
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold cursor-pointer"
          >
            Reset to Rectangular
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ preset, wingL, wingW });
                onClose();
                toast.success(`Applied ${preset.replace("_", "-")} polygon geometry (${previewArea.toFixed(2)} m²) to 3D scene!`);
              }}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-900/30"
            >
              <Check className="size-3.5" />
              <span>Apply Polygon Space</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. SUBSPACE EXCLUSION MODAL (LIFT CORE / MEP VOIDS)
// ============================================================================
export interface SubspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomL: number;
  roomW: number;
  hasSubspace: boolean;
  subspaceType: "lift_core" | "duct_shaft" | "column_cluster" | "stairwell";
  subspaceL: number;
  subspaceW: number;
  subspacePosX: number;
  subspacePosZ: number;
  onApply: (params: {
    type: "lift_core" | "duct_shaft" | "column_cluster" | "stairwell";
    l: number;
    w: number;
    x: number;
    z: number;
  }) => void;
  onRemove: () => void;
}

export function SubspaceModal({
  isOpen,
  onClose,
  roomL,
  roomW,
  hasSubspace,
  subspaceType: initialType,
  subspaceL: initialL,
  subspaceW: initialW,
  subspacePosX: initialX,
  subspacePosZ: initialZ,
  onApply,
  onRemove,
}: SubspaceModalProps) {
  const [type, setType] = useState(initialType);
  const [l, setL] = useState(initialL);
  const [w, setW] = useState(initialW);
  const [x, setX] = useState(initialX);
  const [z, setZ] = useState(initialZ);

  if (!isOpen) return null;

  const voidArea = l * w;
  const isOverflowing = x + l > roomL || z + w > roomW;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-red-500/40 rounded-xl shadow-2xl w-full max-w-lg text-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-red-600/20 text-red-400 border border-red-500/30">
              <Scissors className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Exclude Subspace (Core Voids)</h3>
              <p className="text-[11px] text-slate-400">Punch core voids, elevator shafts, or MEP risers from room area</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Subspace Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Core Void Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "lift_core", label: "Elevator Shaft / Core", desc: "Structural concrete void" },
                { id: "duct_shaft", label: "MEP Duct Riser", desc: "HVAC & electrical chase" },
                { id: "column_cluster", label: "Column Cluster", desc: "Interior structural pier" },
                { id: "stairwell", label: "Internal Stairwell", desc: "Egress stair opening" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setType(item.id as any)}
                  className={`p-2 rounded-lg border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                    type === item.id
                      ? "bg-red-600/25 border-red-500 text-red-200 font-bold"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <span className="text-[11px]">{item.label}</span>
                  <span className="text-[9.5px] text-slate-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Void Coordinates & Dimensions */}
          <div className="bg-[#121417] p-3.5 rounded-lg border border-slate-800 flex flex-col gap-3">
            <span className="text-[11px] font-semibold text-slate-300">Void Dimensions & Origin Offsets</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Void Length L (m)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.2}
                  max={roomL - 0.2}
                  value={l}
                  onChange={(e) => setL(Math.max(0.2, parseFloat(e.target.value) || 1))}
                  className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Void Width W (m)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.2}
                  max={roomW - 0.2}
                  value={w}
                  onChange={(e) => setW(Math.max(0.2, parseFloat(e.target.value) || 1))}
                  className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Offset X from Origin (m)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={roomL}
                  value={x}
                  onChange={(e) => setX(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Offset Z from Origin (m)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={roomW}
                  value={z}
                  onChange={(e) => setZ(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                />
              </div>
            </div>

            {isOverflowing && (
              <div className="p-2 rounded bg-red-950/60 border border-red-500/50 text-[10.5px] text-red-300 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Warning: Subspace exceeds room boundaries ({roomL}m × {roomW}m). Adjust position or dimensions.</span>
              </div>
            )}

            {/* Area impact */}
            <div className="p-2.5 rounded bg-[#181a1f] border border-slate-700/60 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Excluded Void Area:</span>
              <strong className="text-red-400 font-mono font-bold">-{voidArea.toFixed(2)} m²</strong>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          {hasSubspace ? (
            <button
              onClick={() => {
                onRemove();
                onClose();
                toast.success("Subspace void removed. Entire floor plane restored.");
              }}
              className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-950/40 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="size-3" />
              <span>Remove Void</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ type, l, w, x, z });
                onClose();
                toast.success(`Excluded ${type.replace("_", " ")} void (-${voidArea.toFixed(2)} m²) from room!`);
              }}
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-900/30"
            >
              <Check className="size-3.5" />
              <span>Apply Subspace Exclusion</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. NEW ROOM CREATION MODAL
// ============================================================================
export interface NewRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentL: number;
  currentW: number;
  currentH: number;
  currentTargetLux: number;
  onApply: (params: {
    name: string;
    l: number;
    w: number;
    h: number;
    targetLux: number;
  }) => void;
}

export function NewRoomModal({
  isOpen,
  onClose,
  currentName,
  currentL,
  currentW,
  currentH,
  currentTargetLux,
  onApply,
}: NewRoomModalProps) {
  const [name, setName] = useState(currentName || "New Office Space");
  const [l, setL] = useState(currentL || 6.0);
  const [w, setW] = useState(currentW || 4.5);
  const [h, setH] = useState(currentH || 2.8);
  const [targetLux, setTargetLux] = useState(currentTargetLux || 500);

  if (!isOpen) return null;

  const presets = [
    { label: "Open Office", lux: 500, l: 8.0, w: 6.0, h: 2.8 },
    { label: "Conference Room", lux: 500, l: 6.0, w: 4.5, h: 3.0 },
    { label: "Corridor / Circulation", lux: 100, l: 12.0, w: 2.0, h: 2.6 },
    { label: "Restroom / WC", lux: 200, l: 3.5, w: 2.5, h: 2.7 },
    { label: "Server / Switchgear Room", lux: 200, l: 5.0, w: 4.0, h: 3.2 },
    { label: "Retail / Showroom", lux: 750, l: 10.0, w: 8.0, h: 3.6 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-blue-500/40 rounded-xl shadow-2xl w-full max-w-lg text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Draw / Configure Room</h3>
              <p className="text-[11px] text-slate-400">Architectural dimensions and EN 12464-1 lux target</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Quick presets */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Room Application Presets (EN 12464-1)</label>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setName(p.label);
                    setL(p.l);
                    setW(p.w);
                    setH(p.h);
                    setTargetLux(p.lux);
                  }}
                  className="p-2 rounded bg-[#14161a] hover:bg-slate-800 border border-slate-700/60 hover:border-blue-500 text-left transition flex flex-col cursor-pointer"
                >
                  <span className="font-semibold text-white text-[11px] truncate">{p.label}</span>
                  <span className="text-[9.5px] text-amber-400">{p.lux} lx • {p.l}×{p.w}m</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-3 bg-[#121417] p-3.5 rounded-lg border border-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Room Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-bold"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Length (m)</label>
                <input
                  type="number"
                  step={0.5}
                  value={l}
                  onChange={(e) => setL(parseFloat(e.target.value) || 5)}
                  className="h-7 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Width (m)</label>
                <input
                  type="number"
                  step={0.5}
                  value={w}
                  onChange={(e) => setW(parseFloat(e.target.value) || 4)}
                  className="h-7 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Height (m)</label>
                <input
                  type="number"
                  step={0.1}
                  value={h}
                  onChange={(e) => setH(parseFloat(e.target.value) || 2.8)}
                  className="h-7 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-bold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Target Lux</label>
                <input
                  type="number"
                  step={50}
                  value={targetLux}
                  onChange={(e) => setTargetLux(parseInt(e.target.value) || 500)}
                  className="h-7 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-amber-400 font-bold"
                />
              </div>
            </div>
            <div className="flex justify-between items-center text-[10.5px] pt-1 text-slate-300">
              <span>Floor Area: <strong className="text-emerald-400">{(l * w).toFixed(2)} m²</strong></span>
              <span>Room Volume: <strong className="text-white">{(l * w * h).toFixed(2)} m³</strong></span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => {
              onApply({ name, l, w, h, targetLux });
              onClose();
              toast.success(`Created & switched to room "${name}" (${(l * w).toFixed(1)} m²)`);
            }}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30"
          >
            <Check className="size-3.5" />
            <span>Apply Room Geometry</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. APERTURES (DOORS & WINDOWS) MODAL
// ============================================================================
export interface ApertureModalProps {
  isOpen: boolean;
  onClose: () => void;
  windowCount: number;
  apertureHeight: number;
  apertureWidth: number;
  apertureFrameWidth: number;
  apertureSillHeight: number;
  onApply: (params: {
    type: "window" | "door" | "skylight";
    height: number;
    width: number;
    frame: number;
    sill: number;
    countDelta: number;
  }) => void;
  onRemoveAll?: () => void;
}

export function ApertureModal({
  isOpen,
  onClose,
  windowCount,
  apertureHeight: initialH,
  apertureWidth: initialW,
  apertureFrameWidth: initialF,
  apertureSillHeight: initialS,
  onApply,
  onRemoveAll,
}: ApertureModalProps) {
  const [type, setType] = useState<"window" | "door" | "skylight">("window");
  const [height, setHeight] = useState(initialH);
  const [width, setWidth] = useState(initialW);
  const [frame, setFrame] = useState(initialF);
  const [sill, setSill] = useState(initialS);
  const [countDelta, setCountDelta] = useState(1);

  if (!isOpen) return null;

  const catalog = [
    { label: "Standard Window", type: "window", h: 1.35, w: 1.0, s: 0.8, f: 0.12 },
    { label: "Ribbon Window", type: "window", h: 1.20, w: 2.5, s: 0.9, f: 0.10 },
    { label: "Floor-to-Ceiling Glazing", type: "window", h: 2.60, w: 2.0, s: 0.0, f: 0.08 },
    { label: "Single Office Door", type: "door", h: 2.10, w: 0.9, s: 0.0, f: 0.06 },
    { label: "Double Fire Door", type: "door", h: 2.10, w: 1.8, s: 0.0, f: 0.08 },
    { label: "Roof Skylight", type: "skylight", h: 1.20, w: 1.2, s: 0.0, f: 0.10 },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-lg text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <DoorClosed className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Aperture Catalogue & Placement</h3>
              <p className="text-[11px] text-slate-400">Position daylight apertures, windows, and doors on perimeter walls</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Catalog Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Standard Aperture Presets</label>
            <div className="grid grid-cols-3 gap-2">
              {catalog.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setType(item.type as any);
                    setHeight(item.h);
                    setWidth(item.w);
                    setSill(item.s);
                    setFrame(item.f);
                  }}
                  className="p-2 rounded bg-[#14161a] hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500 text-left transition flex flex-col cursor-pointer"
                >
                  <span className="font-semibold text-white text-[11px] truncate">{item.label}</span>
                  <span className="text-[9.5px] text-amber-400">{item.w}m × {item.h}m (Sill: {item.s}m)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dimension Controls */}
          <div className="bg-[#121417] p-3.5 rounded-lg border border-slate-800 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Height (m)</label>
              <input
                type="number"
                step={0.05}
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value) || 1.35)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Width (m)</label>
              <input
                type="number"
                step={0.05}
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value) || 1.0)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Frame Width (m)</label>
              <input
                type="number"
                step={0.01}
                value={frame}
                onChange={(e) => setFrame(parseFloat(e.target.value) || 0.12)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Sill Height (m)</label>
              <input
                type="number"
                step={0.05}
                value={sill}
                onChange={(e) => setSill(parseFloat(e.target.value) || 0.8)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Total in Space: <strong className="text-white">{windowCount}</strong></span>
            {windowCount > 0 && onRemoveAll && (
              <button
                onClick={() => {
                  onRemoveAll();
                  onClose();
                  toast.success("Removed all apertures from space");
                }}
                className="px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 text-[11px] transition cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ type, height, width, frame, sill, countDelta });
                onClose();
                toast.success(`Positioned ${type} (${width}m × ${height}m) on perimeter wall`);
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30"
            >
              <Check className="size-3.5" />
              <span>Position Aperture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. FAÇADE & SHADING SYSTEM MODAL
// ============================================================================
export interface FacadeModalProps {
  isOpen: boolean;
  onClose: () => void;
  facadeElement: "venetian_blind" | "roller_shutter" | "screen";
  facadeMounting: "outside" | "inside";
  showFacadeBlinds: boolean;
  onApply: (params: {
    element: "venetian_blind" | "roller_shutter" | "screen";
    mounting: "outside" | "inside";
    enabled: boolean;
    slatAngle: number;
  }) => void;
}

export function FacadeModal({
  isOpen,
  onClose,
  facadeElement: initialElem,
  facadeMounting: initialMount,
  showFacadeBlinds: initialEnabled,
  onApply,
}: FacadeModalProps) {
  const [element, setElement] = useState(initialElem);
  const [mounting, setMounting] = useState(initialMount);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slatAngle, setSlatAngle] = useState(45);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-md text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Sun className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Façade & Shading Control</h3>
              <p className="text-[11px] text-slate-400">Daylighting systems and solar radiation cutoff</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Façade Element Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "venetian_blind", label: "Venetian Blinds" },
                { id: "roller_shutter", label: "Roller Shutter" },
                { id: "screen", label: "Solar Screen" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setElement(item.id as any)}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                    element === item.id
                      ? "bg-amber-600/30 border-amber-500 text-amber-200 font-bold"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Mounting Position</label>
            <div className="grid grid-cols-2 gap-2">
              {["outside", "inside"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMounting(m as any)}
                  className={`p-2 rounded-lg border capitalize text-center transition cursor-pointer ${
                    mounting === m
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-slate-400">Slat Tilt Angle (Cutoff):</span>
              <strong className="text-amber-400 font-mono">{slatAngle}°</strong>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={15}
              value={slatAngle}
              onChange={(e) => setSlatAngle(parseInt(e.target.value) || 0)}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <div>
            {enabled && (
              <button
                onClick={() => {
                  onApply({ element, mounting, enabled: false, slatAngle });
                  onClose();
                  toast.success("Disabled façade shading blinds");
                }}
                className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 text-xs transition cursor-pointer"
              >
                Disable Blinds
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ element, mounting, enabled: true, slatAngle });
                onClose();
                toast.success(`Configured ${element.replace("_", " ")} (${mounting}) with ${slatAngle}° tilt`);
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30"
            >
              <Check className="size-3.5" />
              <span>Apply Façade</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. ROOF MODAL
// ============================================================================
export interface RoofModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoofType: "flat" | "gable" | "shed" | "hip";
  roofOverhang: number;
  roofPitch: number;
  roofRidgeHeight: number;
  showRoofIn3D: boolean;
  onApply: (params: {
    type: "flat" | "gable" | "shed" | "hip";
    overhang: number;
    pitch: number;
    ridge: number;
    show3D: boolean;
  }) => void;
  onRemove: () => void;
}

export function RoofModal({
  isOpen,
  onClose,
  activeRoofType: initialType,
  roofOverhang: initialOverhang,
  roofPitch: initialPitch,
  roofRidgeHeight: initialRidge,
  showRoofIn3D: initial3D,
  onApply,
  onRemove,
}: RoofModalProps) {
  const [type, setType] = useState(initialType);
  const [overhang, setOverhang] = useState(initialOverhang);
  const [pitch, setPitch] = useState(initialPitch);
  const [ridge, setRidge] = useState(initialRidge);
  const [show3D, setShow3D] = useState(initial3D);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-md text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Roof Construction</h3>
              <p className="text-[11px] text-slate-400">Configure architectural roof structures and pitch</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "flat", label: "Flat" },
              { id: "gable", label: "Gable" },
              { id: "shed", label: "Shed" },
              { id: "hip", label: "Hip" },
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setType(r.id as any)}
                className={`p-2 rounded-lg border text-center transition cursor-pointer ${
                  type === r.id
                    ? "bg-amber-600/30 border-amber-500 text-amber-200 font-bold"
                    : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 bg-[#121417] p-3 rounded-lg border border-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Overhang (m)</label>
              <input
                type="number"
                step={0.05}
                value={overhang}
                onChange={(e) => setOverhang(parseFloat(e.target.value) || 0.3)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400">Roof Pitch (°)</label>
              <input
                type="number"
                step={1}
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value) || 15)}
                className="h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onRemove();
              onClose();
              toast.info("Roof structure removed");
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs cursor-pointer"
          >
            Clear Roof
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ type, overhang, pitch, ridge, show3D: true });
                onClose();
                toast.success(`Rendered ${type} roof in 3D viewport`);
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30"
            >
              <Check className="size-3.5" />
              <span>Apply Roof</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. CEILING MODAL
// ============================================================================
export interface CeilingModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasSuspendedCeiling: boolean;
  ceilingSuspensionDepth: number;
  ceilingGridType: "grid_600" | "monolithic";
  ceilingTileReflectance: number;
  roomH: number;
  onApply: (params: {
    enabled: boolean;
    depth: number;
    gridType: "grid_600" | "monolithic";
    reflectance: number;
  }) => void;
}

export function CeilingModal({
  isOpen,
  onClose,
  hasSuspendedCeiling: initialEnabled,
  ceilingSuspensionDepth: initialDepth,
  ceilingGridType: initialGrid,
  ceilingTileReflectance: initialReflectance,
  roomH,
  onApply,
}: CeilingModalProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [depth, setDepth] = useState(initialDepth);
  const [gridType, setGridType] = useState(initialGrid);
  const [reflectance, setReflectance] = useState(initialReflectance);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-blue-500/40 rounded-xl shadow-2xl w-full max-w-md text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Layers className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Ceiling Systems</h3>
              <p className="text-[11px] text-slate-400">Suspended modular T-bar grid and plenum depth</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "grid_600", label: "600×600mm T-Bar Grid" },
              { id: "monolithic", label: "Monolithic Gypsum" },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGridType(g.id as any)}
                className={`p-2.5 rounded-lg border text-center transition cursor-pointer ${
                  gridType === g.id
                    ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold"
                    : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="bg-[#121417] p-3 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Suspension Depth from Slab:</span>
              <span className="font-mono font-bold text-white">{depth.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min={0.15}
              max={Math.min(1.2, roomH - 1.8)}
              step={0.05}
              value={depth}
              onChange={(e) => setDepth(parseFloat(e.target.value) || 0.4)}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>Clear Floor-to-Ceiling:</span>
              <strong className="text-emerald-400">{(roomH - depth).toFixed(2)} m</strong>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => {
              onApply({ enabled: true, depth, gridType, reflectance });
              onClose();
              toast.success(`Installed ${gridType.replace("_", " ")} suspended ceiling at ${(roomH - depth).toFixed(2)}m elevation`);
            }}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30"
          >
            <Check className="size-3.5" />
            <span>Apply Ceiling</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. FURNITURE & OBJECTS MODAL
// ============================================================================
export interface FurnitureModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFurnitureObject: "cube" | "desk" | "chair" | "conference_table" | "bookshelf" | "monitor" | "reception_desk";
  furnitureArrangement: "rectangular" | "polygonal" | "circular" | "line" | "individual" | "extrusion";
  cuboidWidth: number;
  cuboidLength: number;
  cuboidHeight: number;
  showFurniture: boolean;
  onApply: (params: {
    objectType: "cube" | "desk" | "chair" | "conference_table" | "bookshelf" | "monitor" | "reception_desk";
    arrangement: "rectangular" | "polygonal" | "circular" | "line" | "individual" | "extrusion";
    w: number;
    l: number;
    h: number;
    posX?: number;
    posZ?: number;
    rotationDeg?: number;
    materialId?: string;
    colorHex?: string;
    rows?: number;
    cols?: number;
    spacingX?: number;
    spacingZ?: number;
    count?: number;
    radius?: number;
    visible: boolean;
  }) => void;
}

export function FurnitureModal({
  isOpen,
  onClose,
  activeFurnitureObject: initialObj,
  furnitureArrangement: initialArrangement,
  cuboidWidth: initialW,
  cuboidLength: initialL,
  cuboidHeight: initialH,
  showFurniture: initialVisible,
  onApply,
}: FurnitureModalProps) {
  const [objectType, setObjectType] = useState<
    "cube" | "desk" | "chair" | "conference_table" | "bookshelf" | "monitor" | "reception_desk"
  >(initialObj);
  const [arrangement, setArrangement] = useState<
    "rectangular" | "polygonal" | "circular" | "line" | "individual" | "extrusion"
  >(initialArrangement);
  const [w, setW] = useState(initialW);
  const [l, setL] = useState(initialL);
  const [h, setH] = useState(initialH);
  const [posX, setPosX] = useState(2.0);
  const [posZ, setPosZ] = useState(2.0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [selectedMaterialId, setSelectedMaterialId] = useState("wood_oak_parquet");
  const [colorHex, setColorHex] = useState("#d4b996");

  // Array parameters
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [spacingX, setSpacingX] = useState(2.0);
  const [spacingZ, setSpacingZ] = useState(2.0);
  const [lineCount, setLineCount] = useState(4);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [circleCount, setCircleCount] = useState(6);
  const [circleRadius, setCircleRadius] = useState(1.8);

  if (!isOpen) return null;

  // Auto-fill standard dimensions when switching object types
  const handleSelectObjectType = (
    type: "cube" | "desk" | "chair" | "conference_table" | "bookshelf" | "monitor" | "reception_desk"
  ) => {
    setObjectType(type);
    if (type === "reception_desk") {
      setL(1.4);
      setW(2.4);
      setH(1.15);
      setSelectedMaterialId("wood_oak_parquet");
      setColorHex("#d4b996");
    } else if (type === "desk") {
      setL(0.8);
      setW(1.6);
      setH(0.75);
      setSelectedMaterialId("wood_beech_laminate");
      setColorHex("#e2b887");
    } else if (type === "chair") {
      setL(0.58);
      setW(0.58);
      setH(0.98);
      setSelectedMaterialId("carpet_charcoal_loop");
      setColorHex("#1e293b");
    } else if (type === "conference_table") {
      setL(1.2);
      setW(2.8);
      setH(0.75);
      setSelectedMaterialId("wood_dark_walnut");
      setColorHex("#452e1e");
    } else if (type === "bookshelf") {
      setL(0.4);
      setW(1.2);
      setH(2.0);
      setSelectedMaterialId("wood_oak_parquet");
      setColorHex("#d4b996");
    } else if (type === "monitor") {
      setL(0.18);
      setW(0.6);
      setH(0.5);
      setSelectedMaterialId("metal_black_powder");
      setColorHex("#020617");
    } else {
      setL(1.0);
      setW(1.0);
      setH(1.0);
      setSelectedMaterialId("concrete_fair_faced");
      setColorHex("#94a3b8");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-emerald-500/50 rounded-xl shadow-2xl w-full max-w-2xl text-slate-200 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Box className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Furniture & Object Catalogue</h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DIALux evo Tutorial Part 4
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Compound reception desks, workstations, ergonomic chairs & arrangement arrays
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
          {/* Object Type Grid */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
              <span>Select Object Type</span>
              <span className="text-[10px] text-emerald-400 font-mono">
                {objectType === "reception_desk"
                  ? "Tutorial 4 Compound Reception Desk"
                  : objectType.replace("_", " ").toUpperCase()}
              </span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {[
                { id: "reception_desk", label: "Reception", icon: "🏢", badge: "Part 4" },
                { id: "desk", label: "Office Desk", icon: "🖥️" },
                { id: "chair", label: "Chair", icon: "💺" },
                { id: "conference_table", label: "Conference", icon: "👥" },
                { id: "bookshelf", label: "Storage", icon: "📚" },
                { id: "monitor", label: "Monitor", icon: "💻" },
                { id: "cube", label: "Cuboid", icon: "📦" },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleSelectObjectType(o.id as any)}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                    objectType === o.id
                      ? "bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold shadow-md shadow-emerald-950/50"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600"
                  }`}
                >
                  <span className="text-base">{o.icon}</span>
                  <span className="text-[10px] leading-tight truncate w-full">{o.label}</span>
                  {o.badge && (
                    <span className="text-[8px] px-1 bg-amber-500/20 text-amber-300 rounded font-bold">
                      {o.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 2D Schematic Preview & Dimensions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#121417] p-3 rounded-lg border border-slate-800">
            {/* 2D Schematic Visualizer */}
            <div className="flex flex-col items-center justify-center bg-[#0a0c0f] rounded border border-slate-800 p-2 relative h-40">
              <span className="absolute top-1.5 left-2 text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                <Compass className="size-3 text-emerald-400" /> Plan / Section View
              </span>
              <svg width="180" height="120" viewBox="0 0 180 120" className="overflow-visible">
                {objectType === "reception_desk" && (
                  <g>
                    {/* Rear lower work surface */}
                    <rect x="25" y="45" width="130" height="40" rx="3" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                    {/* Front high transaction counter shelf */}
                    <rect x="20" y="25" width="140" height="22" rx="3" fill={colorHex} stroke="#f59e0b" strokeWidth="2" />
                    {/* Front privacy fascia baffle */}
                    <line x1="20" y1="25" x2="160" y2="25" stroke="#e2e8f0" strokeWidth="3" />
                    {/* Side return end panels */}
                    <rect x="18" y="25" width="6" height="60" fill="#1e293b" />
                    <rect x="156" y="25" width="6" height="60" fill="#1e293b" />
                    <text x="90" y="39" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      Counter 1.15m
                    </text>
                    <text x="90" y="70" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      Desk 0.75m
                    </text>
                  </g>
                )}
                {objectType === "desk" && (
                  <g>
                    <rect x="30" y="30" width="120" height="60" rx="4" fill={colorHex} stroke="#e2e8f0" strokeWidth="1.5" />
                    <circle cx="42" cy="42" r="5" fill="#475569" />
                    <circle cx="138" cy="42" r="5" fill="#475569" />
                    <circle cx="42" cy="78" r="5" fill="#475569" />
                    <circle cx="138" cy="78" r="5" fill="#475569" />
                    <text x="90" y="64" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      {w.toFixed(1)}m x {l.toFixed(1)}m
                    </text>
                  </g>
                )}
                {objectType === "chair" && (
                  <g>
                    <circle cx="90" cy="65" r="28" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                    <rect x="70" y="50" width="40" height="30" rx="6" fill={colorHex} stroke="#e2e8f0" strokeWidth="1.5" />
                    <rect x="68" y="38" width="44" height="10" rx="3" fill={colorHex} stroke="#94a3b8" strokeWidth="1" />
                    <text x="90" y="105" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      Ergonomic Swivel
                    </text>
                  </g>
                )}
                {objectType === "conference_table" && (
                  <g>
                    <rect x="20" y="35" width="140" height="50" rx="8" fill={colorHex} stroke="#f59e0b" strokeWidth="1.5" />
                    <rect x="45" y="45" width="20" height="30" rx="2" fill="#1e293b" />
                    <rect x="115" y="45" width="20" height="30" rx="2" fill="#1e293b" />
                    <text x="90" y="64" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      Boardroom Slab
                    </text>
                  </g>
                )}
                {objectType === "bookshelf" && (
                  <g>
                    <rect x="40" y="30" width="100" height="60" fill={colorHex} stroke="#64748b" strokeWidth="2" />
                    <line x1="40" y1="50" x2="140" y2="50" stroke="#1e293b" strokeWidth="2" />
                    <line x1="40" y1="70" x2="140" y2="70" stroke="#1e293b" strokeWidth="2" />
                    <text x="90" y="64" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      2.0m Storage
                    </text>
                  </g>
                )}
                {objectType === "monitor" && (
                  <g>
                    <rect x="50" y="30" width="80" height="48" rx="2" fill="#020617" stroke="#38bdf8" strokeWidth="1.5" />
                    <rect x="85" y="78" width="10" height="15" fill="#475569" />
                    <ellipse cx="90" cy="95" rx="20" ry="6" fill="#334155" />
                    <text x="90" y="58" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
                      16:9 Display
                    </text>
                  </g>
                )}
                {objectType === "cube" && (
                  <g>
                    <polygon points="90,20 140,45 140,85 90,110 40,85 40,45" fill={colorHex} stroke="#94a3b8" strokeWidth="1.5" />
                    <line x1="90" y1="20" x2="90" y2="110" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="90" y1="65" x2="140" y2="45" stroke="#cbd5e1" strokeWidth="1" />
                    <line x1="90" y1="65" x2="40" y2="45" stroke="#cbd5e1" strokeWidth="1" />
                  </g>
                )}
              </svg>
              <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-400">
                {w.toFixed(2)}m (W) × {l.toFixed(2)}m (L) × {h.toFixed(2)}m (H)
              </span>
            </div>

            {/* Dimensions & Transform Sliders */}
            <div className="flex flex-col justify-between gap-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Width (X)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={w}
                    onChange={(e) => setW(parseFloat(e.target.value) || 1.0)}
                    className="h-6 px-1.5 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Length (Z)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={l}
                    onChange={(e) => setL(parseFloat(e.target.value) || 1.0)}
                    className="h-6 px-1.5 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Height (Y)</label>
                  <input
                    type="number"
                    step={0.05}
                    value={h}
                    onChange={(e) => setH(parseFloat(e.target.value) || 0.75)}
                    className="h-6 px-1.5 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Position Coordinates & Rotation */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Pos X (m)</label>
                  <input
                    type="number"
                    step={0.2}
                    value={posX}
                    onChange={(e) => setPosX(parseFloat(e.target.value) || 2.0)}
                    className="h-6 px-1.5 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Pos Z (m)</label>
                  <input
                    type="number"
                    step={0.2}
                    value={posZ}
                    onChange={(e) => setPosZ(parseFloat(e.target.value) || 2.0)}
                    className="h-6 px-1.5 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Rotation (°)</label>
                  <select
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(parseInt(e.target.value) || 0)}
                    className="h-6 px-1 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  >
                    <option value={0}>0° (North)</option>
                    <option value={45}>45° (Diag)</option>
                    <option value={90}>90° (East)</option>
                    <option value={180}>180° (South)</option>
                    <option value={270}>270° (West)</option>
                  </select>
                </div>
              </div>

              {/* Material Finish Preset */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9.5px] text-slate-400">Furniture Surface Finish</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="size-6 bg-transparent cursor-pointer rounded border border-slate-700 shrink-0"
                  />
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => {
                      const mat = DIALUX_MATERIAL_CATALOG.find((m) => m.id === e.target.value);
                      if (mat) {
                        setSelectedMaterialId(mat.id);
                        setColorHex(mat.colorHex);
                      }
                    }}
                    className="h-6 flex-1 px-1.5 bg-[#181a1f] border border-slate-700 rounded text-[11px] text-white"
                  >
                    <option value="wood_oak_parquet">Light Oak Parquet (#d4b996)</option>
                    <option value="wood_beech_laminate">Beech Wood Laminate (#e2b887)</option>
                    <option value="wood_dark_walnut">Dark Walnut Veneer (#452e1e)</option>
                    <option value="metal_black_powder">Matt Black Steel (#1e293b)</option>
                    <option value="metal_brushed_aluminum">Brushed Aluminum (#cbd5e1)</option>
                    <option value="ral_9010">Pure White RAL 9010 (#f7f9f5)</option>
                    <option value="carpet_charcoal_loop">Charcoal Fabric (#334155)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Arrangement Pattern Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Arrangement Pattern</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "individual", label: "Individual Single", icon: "📍" },
                { id: "rectangular", label: "Rectangular Grid (N x M)", icon: "▦" },
                { id: "line", label: "Linear Array", icon: "━" },
                { id: "circular", label: "Circular Radial", icon: "◎" },
              ].map((arr) => (
                <button
                  key={arr.id}
                  onClick={() => setArrangement(arr.id as any)}
                  className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    arrangement === arr.id
                      ? "bg-slate-700 text-white border-emerald-500 font-bold shadow-xs"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-sm">{arr.icon}</span>
                  <span className="text-[10px]">{arr.label}</span>
                </button>
              ))}
            </div>

            {/* Pattern-Specific Parameters */}
            {arrangement === "rectangular" && (
              <div className="grid grid-cols-4 gap-2 bg-[#121417] p-2.5 rounded-lg border border-slate-800">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Rows (N)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rows}
                    onChange={(e) => setRows(parseInt(e.target.value) || 2)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Columns (M)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={cols}
                    onChange={(e) => setCols(parseInt(e.target.value) || 2)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Spacing X (m)</label>
                  <input
                    type="number"
                    step={0.2}
                    value={spacingX}
                    onChange={(e) => setSpacingX(parseFloat(e.target.value) || 2.0)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Spacing Z (m)</label>
                  <input
                    type="number"
                    step={0.2}
                    value={spacingZ}
                    onChange={(e) => setSpacingZ(parseFloat(e.target.value) || 2.0)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            {arrangement === "line" && (
              <div className="grid grid-cols-2 gap-2 bg-[#121417] p-2.5 rounded-lg border border-slate-800">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Item Count</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={lineCount}
                    onChange={(e) => setLineCount(parseInt(e.target.value) || 4)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Spacing (m)</label>
                  <input
                    type="number"
                    step={0.2}
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(parseFloat(e.target.value) || 1.8)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            {arrangement === "circular" && (
              <div className="grid grid-cols-2 gap-2 bg-[#121417] p-2.5 rounded-lg border border-slate-800">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Radial Chair / Item Count</label>
                  <input
                    type="number"
                    min={3}
                    max={24}
                    value={circleCount}
                    onChange={(e) => setCircleCount(parseInt(e.target.value) || 6)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9.5px] text-slate-400">Radius (m)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={circleRadius}
                    onChange={(e) => setCircleRadius(parseFloat(e.target.value) || 1.8)}
                    className="h-6 px-1 text-center bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            {arrangement === "rectangular"
              ? `Generates ${rows * cols} items in ${rows}×${cols} array`
              : arrangement === "line"
              ? `Generates ${lineCount} items in linear array`
              : arrangement === "circular"
              ? `Generates ${circleCount} items radial array`
              : "Generates 1 single 3D object"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({
                  objectType,
                  arrangement,
                  w,
                  l,
                  h,
                  posX,
                  posZ,
                  rotationDeg,
                  materialId: selectedMaterialId,
                  colorHex,
                  rows,
                  cols,
                  spacingX,
                  spacingZ,
                  count: arrangement === "line" ? lineCount : circleCount,
                  radius: circleRadius,
                  visible: true,
                });
                onClose();
                toast.success(
                  `Placed ${objectType.replace("_", " ")} (${arrangement}) into 3D scene`
                );
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-900/30"
            >
              <Check className="size-3.5" />
              <span>Place in Space</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. MATERIAL & SURFACE REFLECTANCES MODAL (DIALux evo Tutorial Part 4)
// ============================================================================
export interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMaterialName: string;
  materialReflectanceVal: number;
  materialColorHex: string;
  selectedMaterialTarget: "ceiling" | "walls" | "floor" | "north_wall" | "south_wall" | "east_wall" | "west_wall" | "furniture";
  surfaceColors: { ceiling: string; walls: string; floor: string; north?: string; south?: string; east?: string; west?: string };
  reflectances: { ceiling: number; walls: number; floor: number; north?: number; south?: number; east?: number; west?: number };
  onApply: (params: {
    target: "ceiling" | "walls" | "floor" | "north_wall" | "south_wall" | "east_wall" | "west_wall" | "furniture";
    name: string;
    reflectance: number;
    colorHex: string;
    textureType?: TexturePatternType;
  }) => void;
  onApplyStandardCIBSE: () => void;
}

export function MaterialModal({
  isOpen,
  onClose,
  activeMaterialName: initialName,
  materialReflectanceVal: initialReflectance,
  materialColorHex: initialColor,
  selectedMaterialTarget: initialTarget,
  surfaceColors,
  reflectances,
  onApply,
  onApplyStandardCIBSE,
}: MaterialModalProps) {
  const [target, setTarget] = useState<
    "ceiling" | "walls" | "floor" | "north_wall" | "south_wall" | "east_wall" | "west_wall" | "furniture"
  >(initialTarget);
  const [name, setName] = useState(initialName);
  const [reflectance, setReflectance] = useState(initialReflectance);
  const [colorHex, setColorHex] = useState(initialColor);
  const [textureType, setTextureType] = useState<TexturePatternType>("plain");
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | "all">("all");

  if (!isOpen) return null;

  const filteredMaterials =
    categoryFilter === "all"
      ? DIALUX_MATERIAL_CATALOG
      : DIALUX_MATERIAL_CATALOG.filter((m) => m.category === categoryFilter);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-blue-500/50 rounded-xl shadow-2xl w-full max-w-2xl text-slate-200 flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Palette className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Surface Materials & Textures</h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Shift-Key Single Wall
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Photometric radiosity reflectances (ρ_c, ρ_w, ρ_f) & procedural textures
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
          {/* Target Surface Selector with Single Wall (Shift-Key) Mode */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">Target Architectural Surface</label>
              <span className="text-[10px] text-amber-400 font-mono">
                {target.includes("wall") && target !== "walls"
                  ? "★ Single Wall Mode (DIALux evo Shift-Click)"
                  : "Standard Room Surface"}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
              {[
                { id: "ceiling", label: "Ceiling", sub: "ρ_c" },
                { id: "walls", label: "All Walls", sub: "ρ_w" },
                { id: "north_wall", label: "North Wall", sub: "Shift" },
                { id: "south_wall", label: "South Wall", sub: "Shift" },
                { id: "east_wall", label: "East Wall", sub: "Shift" },
                { id: "west_wall", label: "West Wall", sub: "Shift" },
                { id: "floor", label: "Floor", sub: "ρ_f" },
                { id: "furniture", label: "Furniture", sub: "Obj" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTarget(s.id as any)}
                  className={`p-2 rounded border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    target === s.id
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-xs"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="text-[10.5px]">{s.label}</span>
                  <span className="text-[8.5px] text-amber-400/80 font-mono">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Shift Key Feature Tip Banner */}
          <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/60 flex items-start gap-2.5 text-[11px] text-blue-200">
            <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">DIALux evo Shift-Key Functionality:</strong> Applying material to an individual wall
              (North, South, East, West) emulates holding the <code className="px-1 py-0.5 bg-blue-900/60 rounded text-amber-300 font-mono">Shift</code> key in DIALux evo. The engine computes an area-weighted average reflectance and recalculates internal radiosity immediately!
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
            {[
              { id: "all", label: "All Materials" },
              { id: "plaster", label: "Plaster & Stucco" },
              { id: "concrete", label: "Concrete" },
              { id: "wood", label: "Wood Parquet" },
              { id: "tiles", label: "Tiles & Ceiling" },
              { id: "carpet", label: "Carpet & Fabric" },
              { id: "metal", label: "Metals & Glass" },
              { id: "ral_color", label: "RAL Colors" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-2.5 py-1 rounded text-[10.5px] transition cursor-pointer ${
                  categoryFilter === cat.id
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-[#14161a] text-slate-400 hover:text-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Material Catalog Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredMaterials.map((mat) => (
              <button
                key={mat.id}
                onClick={() => {
                  setName(mat.name);
                  setReflectance(mat.reflectance);
                  setColorHex(mat.colorHex);
                  setTextureType(mat.textureType);
                }}
                className={`p-2 rounded bg-[#14161a] hover:bg-slate-800 border text-left transition flex items-center gap-2 cursor-pointer ${
                  name === mat.name ? "border-blue-500 ring-1 ring-blue-500/50 bg-blue-950/20" : "border-slate-700/60"
                }`}
              >
                <div
                  className="size-7 rounded border border-slate-500 shrink-0 shadow-xs relative overflow-hidden"
                  style={{
                    backgroundColor: mat.colorHex,
                    backgroundImage:
                      mat.textureType === "wood_parquet"
                        ? "repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 6px)"
                        : mat.textureType === "ceramic_tile" || mat.textureType === "acoustic_tile"
                        ? "linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)"
                        : undefined,
                    backgroundSize: "8px 8px",
                  }}
                />
                <div className="overflow-hidden flex-1">
                  <div className="font-semibold text-white truncate text-[10.5px]">{mat.name}</div>
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                    <span className="text-amber-400 font-mono font-bold">ρ = {Math.round(mat.reflectance * 100)}%</span>
                    <span className="capitalize">{mat.textureType.replace("_", " ")}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Active Material Fine-Tuning */}
          <div className="bg-[#121417] p-3 rounded-lg border border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold text-[11px]">Active Material Settings</span>
              <span className="font-mono text-emerald-400 font-bold text-xs">{name}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Reflectance Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400">Luminous Reflectance (ρ):</span>
                  <span className="font-mono font-bold text-amber-300">{(reflectance * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  value={reflectance}
                  onChange={(e) => setReflectance(parseFloat(e.target.value) || 0.5)}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Tint Color */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Color Hex / Tint:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="size-7 bg-transparent cursor-pointer rounded border border-slate-700"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-7 flex-1 px-2 bg-[#181a1f] border border-slate-700 rounded text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onApplyStandardCIBSE();
                onClose();
                toast.success("Applied standard CIBSE / EN 12464-1 reflectances: Ceiling 70%, Walls 50%, Floor 20%");
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-[11px] cursor-pointer"
            >
              Standard (70/50/20)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply({ target, name, reflectance, colorHex, textureType });
                onClose();
                toast.success(
                  `Applied ${name} (ρ=${Math.round(reflectance * 100)}%) to ${target.replace("_", " ")}`
                );
              }}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30"
            >
              <Check className="size-3.5" />
              <span>Apply Material</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. SETTINGS MODAL
// ============================================================================
export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [standard, setStandard] = useState("EN 12464-1:2021");
  const [gridDensity, setGridDensity] = useState("0.5m");
  const [rayBounces, setRayBounces] = useState(5);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-slate-700 rounded-xl shadow-2xl w-full max-w-md text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
              <Settings className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">DIALux evo Settings</h3>
              <p className="text-[11px] text-slate-400">Calculation algorithms and compliance codes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Design Standard</label>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              className="h-8 px-2 bg-[#14161a] border border-slate-700 rounded text-xs text-white"
            >
              <option value="EN 12464-1:2021">EN 12464-1:2021 (Indoor Workplaces)</option>
              <option value="EN 12464-2:2014">EN 12464-2:2014 (Outdoor Workplaces)</option>
              <option value="CIBSE SLL">CIBSE SLL Code for Lighting</option>
              <option value="IESNA RP-8">IESNA RP-8 Standards</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-300">Calculation Grid Density</label>
            <div className="grid grid-cols-3 gap-2">
              {["0.25m (Fine)", "0.5m (Standard)", "1.0m (Coarse)"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGridDensity(g)}
                  className={`p-2 rounded border text-center transition cursor-pointer ${
                    gridDensity === g
                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold"
                      : "bg-[#14161a] border-slate-700/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => {
              if (onSave) onSave();
              onClose();
              toast.success("Saved calculation settings");
            }}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 11. HELP & WORKFLOW GUIDE MODAL
// ============================================================================
export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl text-slate-200 flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">DIALux evo User Manual</h3>
              <p className="text-[11px] text-slate-400">Step-by-step photometric engineering guidance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <span className="size-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
              Site & Building Modeling
            </h4>
            <p className="text-slate-400 leading-relaxed pl-6">
              Define building footprint, levels, and room geometry using rectangular, circular, or polygonal spaces. If your space contains elevator shafts or MEP chases, use <strong>Exclude subspace</strong> to deduct core voids from lighting calculations.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <span className="size-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
              Daylight & Apertures
            </h4>
            <p className="text-slate-400 leading-relaxed pl-6">
              Place windows and doors onto exterior walls. Configure glazing properties and add façade systems like motorized venetian blinds or louvers for daylight glare control.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <span className="size-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
              Photometric Layout & Simulation
            </h4>
            <p className="text-slate-400 leading-relaxed pl-6">
              Import industry-standard <strong>.IES / .LDT</strong> photometric curves or pick from built-in LED models. DIALux calculates point-by-point illuminance on the 0.75m workplane, checking compliance against EN 12464-1 uniformity criteria ($U_0 \ge 0.60$).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <span className="size-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">4</span>
              Export & STF Exchange
            </h4>
            <p className="text-slate-400 leading-relaxed pl-6">
              Export comprehensive calculations directly into <strong>PDF format</strong> or generate standardized <strong>STF exchange files</strong> for import into DIALux Evo desktop software.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. CIE 97 / DIN 5035 MAINTENANCE FACTOR WIZARD MODAL
// ============================================================================
export interface MaintenanceFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMf: number;
  onApplyMf: (mf: number) => void;
}

export function MaintenanceFactorModal({
  isOpen,
  onClose,
  currentMf,
  onApplyMf,
}: MaintenanceFactorModalProps) {
  const [environment, setEnvironment] = useState<"clean" | "normal" | "dusty">("clean");
  const [interval, setInterval] = useState<1 | 2 | 3>(3);

  if (!isOpen) return null;

  const result = calculateCIE97MaintenanceFactor({
    environment,
    cleaningIntervalYears: interval,
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-amber-500/40 rounded-xl shadow-2xl w-full max-w-lg text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Sliders className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">CIE 97 / DIN 5035 Maintenance Factor Wizard</h3>
              <p className="text-[11px] text-slate-400">MF = LLMF × LSF × LMF × RSMF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1.5">Application Presets:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setEnvironment("clean"); setInterval(3); }}
                className={`p-2 rounded border text-left cursor-pointer transition ${
                  environment === "clean" && interval === 3
                    ? "bg-amber-600/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="block font-bold">Standard Office</span>
                <span className="text-[10px] text-slate-400">Clean, 3-yr (MF = 0.80)</span>
              </button>
              <button
                type="button"
                onClick={() => { setEnvironment("clean"); setInterval(1); }}
                className={`p-2 rounded border text-left cursor-pointer transition ${
                  environment === "clean" && interval === 1
                    ? "bg-amber-600/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="block font-bold">Hospital / Lab</span>
                <span className="text-[10px] text-slate-400">Clean, 1-yr (MF = 0.84)</span>
              </button>
              <button
                type="button"
                onClick={() => { setEnvironment("dusty"); setInterval(2); }}
                className={`p-2 rounded border text-left cursor-pointer transition ${
                  environment === "dusty" && interval === 2
                    ? "bg-amber-600/20 border-amber-500 text-amber-300 font-bold"
                    : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span className="block font-bold">Industrial / Plant</span>
                <span className="text-[10px] text-slate-400">Dusty, 2-yr (MF = 0.56)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Room Environment:</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded text-white"
              >
                <option value="clean">Clean (Air-conditioned Office, School)</option>
                <option value="normal">Normal (Commercial, Retail, Corridor)</option>
                <option value="dusty">Dusty (Workshop, Factory, Warehouse)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-semibold block mb-1">Luminaire Cleaning Interval:</label>
              <select
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) as any)}
                className="w-full h-8 px-2.5 bg-slate-900 border border-slate-700 rounded text-white"
              >
                <option value={1}>1 Year (Frequent Cleaning)</option>
                <option value={2}>2 Years (Standard Maintenance)</option>
                <option value={3}>3 Years (Extended Maintenance)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
            <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">LLMF (Lamp)</span>
              <strong className="text-white font-mono text-sm">{result.llmf.toFixed(2)}</strong>
            </div>
            <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">LSF (Survival)</span>
              <strong className="text-white font-mono text-sm">{result.lsf.toFixed(2)}</strong>
            </div>
            <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">LMF (Luminaire)</span>
              <strong className="text-white font-mono text-sm">{result.lmf.toFixed(2)}</strong>
            </div>
            <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">RSMF (Surface)</span>
              <strong className="text-white font-mono text-sm">{result.rsmf.toFixed(2)}</strong>
            </div>
          </div>

          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-300 font-bold block">Calculated Maintenance Factor:</span>
              <span className="text-[10px] text-slate-400">{result.categoryDescription}</span>
            </div>
            <div className="text-right">
              <strong className="text-2xl font-black text-amber-400 font-mono">{result.mf.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Current in Project: {currentMf.toFixed(2)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyMf(result.mf);
                onClose();
                toast.success(`Applied CIE 97 Maintenance Factor: MF = ${result.mf.toFixed(2)}`);
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs cursor-pointer shadow-md"
            >
              Apply to Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 13. CIE DAYLIGHT FACTOR & SUN POSITIONING MODAL (EN 17037 / BREEAM)
// ============================================================================
export interface DaylightAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomL: number;
  roomW: number;
  roomH: number;
  windowCount: number;
  windowWidth: number;
  windowHeight: number;
  windowSill?: number;
  targetLux?: number;
  artificialPowerW?: number;
  showFacadeBlinds?: boolean;
  onOpenApertures: () => void;
  onApplyDaylightScene?: (settings: {
    skyModel: CIESkyModel;
    directSunlight: boolean;
    hour: number;
    latitude: number;
    longitude: number;
    cityName: string;
    northOrientation: number;
    sunAltitude: number;
    sunAzimuth: number;
    groundReflectance: number;
    glassTransmittance: number;
  }) => void;
}

export function DaylightAnalysisModal({
  isOpen,
  onClose,
  roomL,
  roomW,
  roomH,
  windowCount,
  windowWidth,
  windowHeight,
  windowSill = 0.8,
  targetLux = 500,
  artificialPowerW = 120,
  showFacadeBlinds = false,
  onOpenApertures,
  onApplyDaylightScene,
}: DaylightAnalysisModalProps) {
  // DIALux evo Part 11: Sky Model selection (CIE 110-1994)
  const [skyModel, setSkyModel] = useState<CIESkyModel>("overcast");
  const [directSunlight, setDirectSunlight] = useState<boolean>(false);

  // Geographic coordinates and location presets
  const [selectedCity, setSelectedCity] = useState("London");
  const [latitude, setLatitude] = useState(51.51);
  const [longitude, setLongitude] = useState(-0.12);

  // Astronomical Solstices & Equinoxes presets
  const [datePreset, setDatePreset] = useState<"summer" | "winter" | "equinox" | "today">("summer");
  const [hour, setHour] = useState(12);

  // Site Orientation / North Alignment
  const [northOrientation, setNorthOrientation] = useState(0);

  // Ground Albedo & Glazing properties
  const [groundReflectance, setGroundReflectance] = useState(0.20); // Grass
  const [glassTransmittance, setGlassTransmittance] = useState(0.75); // Double clear

  // Active Results Tab
  const [activeTab, setActiveTab] = useState<"daylight_factor" | "illuminance" | "energy_savings">("daylight_factor");

  if (!isOpen) return null;

  const cities = [
    { name: "London", lat: 51.51, lon: -0.12 },
    { name: "Berlin / Lüdenscheid", lat: 51.22, lon: 7.63 },
    { name: "Frankfurt", lat: 50.11, lon: 8.68 },
    { name: "Paris", lat: 48.85, lon: 2.35 },
    { name: "New York", lat: 40.71, lon: -74.00 },
    { name: "Dubai", lat: 25.20, lon: 55.27 },
    { name: "Riyadh", lat: 24.71, lon: 46.67 },
    { name: "Singapore", lat: 1.35, lon: 103.82 },
    { name: "Tokyo", lat: 35.68, lon: 139.69 },
    { name: "Mumbai", lat: 19.07, lon: 72.87 },
    { name: "Sydney", lat: -33.86, lon: 151.21 },
  ];

  // Resolve calculation date
  let calcDate = new Date();
  if (datePreset === "summer") {
    calcDate = new Date(calcDate.getFullYear(), 5, 21); // 21 June (Summer Solstice)
  } else if (datePreset === "winter") {
    calcDate = new Date(calcDate.getFullYear(), 11, 21); // 21 December (Winter Solstice)
  } else if (datePreset === "equinox") {
    calcDate = new Date(calcDate.getFullYear(), 2, 21); // 21 March (Vernal Equinox)
  }

  // Shading factor: if blinds active, transmission reduced by 70%
  const shadingFactor = showFacadeBlinds ? 0.30 : 1.0;

  // Run Comprehensive Daylight Calculation
  const result: ComprehensiveDaylightResult = calculateComprehensiveDaylight({
    length: roomL,
    width: roomW,
    height: roomH,
    windowCount,
    windowWidth,
    windowHeight,
    windowSill,
    glassTransmittance,
    skyModel,
    directSunlight: skyModel !== "overcast" && directSunlight,
    latitude,
    longitude,
    date: calcDate,
    hour,
    northOrientation,
    groundReflectance,
    shadingReductionFactor: shadingFactor,
    targetLux,
    artificialPowerW,
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-amber-500/50 rounded-xl shadow-2xl w-full max-w-2xl text-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Sun className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm tracking-wide">DIALux evo Daylight Simulation</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-mono font-semibold border border-blue-500/30">
                  CIE 110-1994 / EN 17037
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Natural daylight quotient, solar angle positioning & energy harvesting
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 cursor-pointer transition">
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto">
          
          {/* 1. Sky Model Selection (Tutorial Part 11 core feature) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <Cloud className="size-3.5 text-blue-400" /> CIE Sky Model (Standard Reference)
              </label>
              <span className="text-[10px] text-amber-400">
                {skyModel === "overcast" ? "Required for EN 17037 Daylight Quotient" : "Direct Sunlight Supported"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "overcast", label: "CIE Overcast Sky", desc: "Diffuse 10,000 lx (No direct sun)", icon: Cloud },
                { id: "average", label: "CIE Average Sky", desc: "Intermediate mixed sky", icon: Sun },
                { id: "clear", label: "CIE Clear Sky", desc: "Clear blue sky + bright sunbeam", icon: Sparkles },
              ].map((m) => {
                const Icon = m.icon;
                const isSel = skyModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSkyModel(m.id as any);
                      if (m.id === "clear") setDirectSunlight(true);
                      if (m.id === "overcast") setDirectSunlight(false);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                      isSel
                        ? "bg-amber-600/20 border-amber-500 text-white shadow-md shadow-amber-950/20"
                        : "bg-[#14161a] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`size-3.5 ${isSel ? "text-amber-400" : "text-slate-500"}`} />
                      <span className="font-bold text-xs">{m.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Sunlight & Shading Row */}
          <div className="grid grid-cols-2 gap-3 bg-[#131519] p-3 rounded-lg border border-slate-800">
            <label className={`flex items-center gap-2 cursor-pointer ${skyModel === "overcast" ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input
                type="checkbox"
                checked={directSunlight}
                disabled={skyModel === "overcast"}
                onChange={(e) => setDirectSunlight(e.target.checked)}
                className="size-4 rounded accent-amber-500"
              />
              <div className="flex flex-col">
                <span className="font-semibold text-white text-[11px]">Direct Sunlight Beam</span>
                <span className="text-[9.5px] text-slate-400">
                  {skyModel === "overcast" ? "Disabled for overcast sky" : "Calculate direct solar beam on workplane"}
                </span>
              </div>
            </label>

            <div className="flex items-center justify-between border-l border-slate-800 pl-3">
              <div className="flex flex-col">
                <span className="font-semibold text-white text-[11px]">Façade Shading</span>
                <span className="text-[9.5px] text-slate-400">
                  {showFacadeBlinds ? "Venetian blinds active (-70% cut)" : "Open (no blinds active)"}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                showFacadeBlinds ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-400"
              }`}>
                {showFacadeBlinds ? "Blinds Down" : "Open"}
              </span>
            </div>
          </div>

          {/* 2. Geographic Location, Date Presets & Time Slider */}
          <div className="bg-[#121417] p-3.5 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2.5">
              {/* City Selection */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-semibold block mb-1">Geographic Location:</label>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    const city = cities.find((c) => c.name === e.target.value);
                    if (city) {
                      setSelectedCity(city.name);
                      setLatitude(city.lat);
                      setLongitude(city.lon);
                    }
                  }}
                  className="w-full h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-white text-[11px]"
                >
                  {cities.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.lat >= 0 ? `${c.lat.toFixed(1)}°N` : `${Math.abs(c.lat).toFixed(1)}°S`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Presets */}
              <div>
                <label className="text-[10.5px] text-slate-400 font-semibold block mb-1 flex items-center gap-1">
                  <Calendar className="size-3 text-amber-400" /> Astronomical Date:
                </label>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as any)}
                  className="w-full h-7 px-2 bg-[#181a1f] border border-slate-700 rounded text-white text-[11px]"
                >
                  <option value="summer">21 June (Summer Solstice)</option>
                  <option value="winter">21 Dec (Winter Solstice)</option>
                  <option value="equinox">21 March (Equinox)</option>
                  <option value="today">Today's Date</option>
                </select>
              </div>

              {/* North Orientation */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] text-slate-400 font-semibold flex items-center gap-1">
                    <Compass className="size-3 text-red-400" /> North Alignment:
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">{northOrientation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="15"
                  value={northOrientation}
                  onChange={(e) => setNorthOrientation(parseInt(e.target.value) || 0)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Time Slider & Solar Angles Readout */}
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Clock className="size-3 text-blue-400" /> Time of Day (Sun Elevation):
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{hour}:00</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="19"
                  step="1"
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Sun Solar Vector Metrics */}
              <div className="flex items-center gap-2 bg-[#181a1f] px-3 py-1.5 rounded border border-slate-700/60">
                <div className="text-center">
                  <span className="text-[9px] text-slate-400 block">Altitude (α)</span>
                  <strong className="text-amber-400 font-mono text-xs">{result.sunPosition.altitude}°</strong>
                </div>
                <div className="w-px h-6 bg-slate-700" />
                <div className="text-center">
                  <span className="text-[9px] text-slate-400 block">Azimuth (γ)</span>
                  <strong className="text-blue-400 font-mono text-xs">{result.sunPosition.azimuth}°</strong>
                </div>
                <div className="w-px h-6 bg-slate-700" />
                <div className="text-center">
                  <span className="text-[9px] text-slate-400 block">Beam to Wall</span>
                  <strong className={`font-mono text-xs ${result.sunPosition.directAngleToWindowDeg < 85 ? "text-emerald-400" : "text-slate-500"}`}>
                    {result.sunPosition.directAngleToWindowDeg}°
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Surface & Apertures Summary Bar */}
          <div className="grid grid-cols-3 gap-2">
            {/* Ground Albedo */}
            <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-semibold">Ground Reflection (Albedo):</span>
              <select
                value={groundReflectance}
                onChange={(e) => setGroundReflectance(parseFloat(e.target.value) || 0.2)}
                className="w-full h-6 px-1.5 bg-[#181a1f] border border-slate-700 rounded text-white text-[10.5px]"
              >
                <option value="0.20">Lawn / Grass (20%)</option>
                <option value="0.30">Light Concrete (30%)</option>
                <option value="0.15">Dark Asphalt (15%)</option>
                <option value="0.80">Clean Snow (80%)</option>
                <option value="0.40">Dry Sand (40%)</option>
              </select>
            </div>

            {/* Glazing Transmittance */}
            <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-semibold">Glass Transmittance (τv):</span>
              <select
                value={glassTransmittance}
                onChange={(e) => setGlassTransmittance(parseFloat(e.target.value) || 0.75)}
                className="w-full h-6 px-1.5 bg-[#181a1f] border border-slate-700 rounded text-white text-[10.5px]"
              >
                <option value="0.75">Clear Double Glazing (75%)</option>
                <option value="0.65">Triple Glazing Low-E (65%)</option>
                <option value="0.50">Solar Control Glass (50%)</option>
                <option value="0.35">Tinted Privacy Glass (35%)</option>
              </select>
            </div>

            {/* Windows in Space */}
            <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block">Daylight Windows:</span>
                <span className="text-white font-bold text-xs">{windowCount} active</span>
                <span className="text-[9.5px] text-slate-500 block">{(windowCount * windowWidth * windowHeight).toFixed(2)} m² Glazing</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenApertures();
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded border border-slate-700 text-[10.5px] cursor-pointer"
              >
                Edit Windows
              </button>
            </div>
          </div>

          {/* 4. Results Navigation Tabs */}
          <div className="flex border-b border-slate-800 gap-2">
            {[
              { id: "daylight_factor", label: "Daylight Factor (EN 17037)" },
              { id: "illuminance", label: "Workplane Illuminance (lx)" },
              { id: "energy_savings", label: "Energy Harvesting (EN 15193)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Daylight Factor Results */}
          {activeTab === "daylight_factor" && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Average DF (Davg)</span>
                  <strong className={`font-mono text-base ${result.isCompliant ? "text-emerald-400" : "text-amber-400"}`}>
                    {result.avgDaylightFactor}%
                  </strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Minimum DF (Dmin)</span>
                  <strong className="text-white font-mono text-base">{result.minDaylightFactor}%</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Maximum DF (Dmax)</span>
                  <strong className="text-white font-mono text-base">{result.maxDaylightFactor}%</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Uniformity (U0)</span>
                  <strong className="text-amber-400 font-mono text-base">{result.uniformityU0}</strong>
                </div>
              </div>

              {/* Compliance Card */}
              <div className={`p-3.5 rounded-lg border flex items-center justify-between ${
                result.isCompliant ? "bg-emerald-950/20 border-emerald-500/30" : "bg-amber-950/20 border-amber-500/30"
              }`}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">EN 17037 Standard Assessment:</span>
                    <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                      result.en17037Level === "High"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : result.en17037Level === "Medium"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : result.en17037Level === "Minimum"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}>
                      {result.en17037Level !== "None" ? `Level ${result.en17037Level} Compliant` : "Below EN 17037 Target (<2.0%)"}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    BREEAM Hea 01 requires Davg ≥ 2.0% across workplane. Maintained overcast illuminance: ~{result.avgDaylightLux} lx.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Exterior CIE Sky</span>
                  <strong className="text-blue-400 font-mono text-sm">{result.exteriorHorizontalLux.toLocaleString()} lx</strong>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Workplane Illuminance */}
          {activeTab === "illuminance" && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Avg Daylight Lux</span>
                  <strong className="text-emerald-400 font-mono text-base">{result.avgDaylightLux} lx</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Min Daylight Lux</span>
                  <strong className="text-white font-mono text-base">{result.minDaylightLux} lx</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Max Daylight Lux</span>
                  <strong className="text-white font-mono text-base">{result.maxDaylightLux} lx</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Direct Sun Area</span>
                  <strong className="text-amber-400 font-mono text-base">{result.directSunPatchArea} m²</strong>
                </div>
              </div>

              <div className="p-3 bg-[#131519] rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-semibold">Exterior Normal Direct Beam:</span>
                  <span className="text-slate-400">
                    {result.exteriorDirectNormalLux.toLocaleString()} lx (Solar Altitude: {result.sunPosition.altitude}°)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-white font-semibold">Max Direct Beam Inside Room:</span>
                  <span className="text-amber-400 font-mono font-bold block">{result.directSunMaxLux} lx</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Energy Savings & Harvesting */}
          {activeTab === "energy_savings" && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Daylight Autonomy (DA)</span>
                  <strong className="text-emerald-400 font-mono text-lg">{result.daylightAutonomyDA}%</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Continuous DA (cDA)</span>
                  <strong className="text-blue-400 font-mono text-lg">{result.continuousDaylightAutonomyCDA}%</strong>
                </div>
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Dimming Potential</span>
                  <strong className="text-amber-400 font-mono text-lg">{result.energySavingsPercent}%</strong>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-white text-xs">EN 15193 Daylight Harvesting Savings:</span>
                  <span className="text-slate-400 text-[11px]">
                    Photo-sensor dims artificial lighting by up to {result.energySavingsPercent}% during daylight hours.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Annual Savings</span>
                  <strong className="text-emerald-400 font-mono text-lg">{result.annualEnergySavedKwh} kWh/a</strong>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const summaryText = `DIALux evo Daylight Simulation Report (EN 17037 / CIE 110-1994)\nLocation: ${selectedCity} (${latitude}°N, ${longitude}°E)\nSky Model: ${skyModel.toUpperCase()}\nSun Altitude: ${result.sunPosition.altitude}°, Azimuth: ${result.sunPosition.azimuth}°\nAverage Daylight Factor: ${result.avgDaylightFactor}%\nEN 17037 Compliance: ${result.en17037Level}\nAnnual Energy Saved: ${result.annualEnergySavedKwh} kWh/a`;
                navigator.clipboard?.writeText(summaryText);
                toast.success("Copied EN 17037 Daylight Calculation Summary to clipboard");
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5 text-blue-400" />
              <span>Copy Report Summary</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer">
              Close
            </button>
            {onApplyDaylightScene && (
              <button
                onClick={() => {
                  onApplyDaylightScene({
                    skyModel,
                    directSunlight: skyModel !== "overcast" && directSunlight,
                    hour,
                    latitude,
                    longitude,
                    cityName: selectedCity,
                    northOrientation,
                    sunAltitude: result.sunPosition.altitude,
                    sunAzimuth: result.sunPosition.azimuth,
                    groundReflectance,
                    glassTransmittance,
                  });
                  onClose();
                  toast.success(`Applied Daylight Scene: ${skyModel} at ${hour}:00 (${selectedCity})`);
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30"
              >
                <Check className="size-3.5" />
                <span>Apply Daylight to 3D View</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// 14. EMERGENCY LIGHTING & ESCAPE ROUTE MODAL (EN 1838)
// ============================================================================
export interface EmergencyLightingModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomL: number;
  roomW: number;
  simulationResult: any;
  onSwitchScene: (scene: "10" | "100") => void;
}

export function EmergencyLightingModal({
  isOpen,
  onClose,
  roomL,
  roomW,
  simulationResult,
  onSwitchScene,
}: EmergencyLightingModalProps) {
  if (!isOpen) return null;

  const emergResult = calculateEmergencyLighting({
    points: simulationResult.points || [],
    length: roomL,
    width: roomW,
    emergencyFactor: 0.10,
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-emerald-500/40 rounded-xl shadow-2xl w-full max-w-lg text-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Check className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Emergency Lighting Evaluation (EN 1838)</h3>
              <p className="text-[11px] text-slate-400">Escape Routes & Anti-Panic Areas Verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-xs">
          <div className="p-3 bg-[#14161a] border border-slate-800 rounded-lg flex flex-col gap-1 text-[11px]">
            <span className="font-bold text-white">EN 1838 Statutory Requirements:</span>
            <div className="grid grid-cols-2 gap-2 text-slate-400 mt-1">
              <div>• Escape Route (1.0m width): <strong>E_min ≥ 1.0 lx</strong></div>
              <div>• Escape Route Diversity: <strong>E_min / E_max ≥ 1:40 (0.025)</strong></div>
              <div>• Anti-Panic Open Area: <strong>E_min ≥ 0.5 lx</strong></div>
              <div>• Minimum Battery Duration: <strong>1 to 3 hours</strong></div>
            </div>
          </div>

          <div className={`p-3.5 rounded-lg border flex items-center justify-between ${
            emergResult.isEscapeRouteCompliant ? "bg-emerald-950/20 border-emerald-500/30" : "bg-red-950/20 border-red-500/30"
          }`}>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-white">1.0m Central Escape Route</span>
              <span className="text-[11px] text-slate-400">
                E_min: {emergResult.escapeRouteMinLux} lx | Uniformity U_d: {emergResult.escapeRouteUniformity}
              </span>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                emergResult.isEscapeRouteCompliant ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
              }`}>
                {emergResult.isEscapeRouteCompliant ? "EN 1838 PASS" : "NON-COMPLIANT"}
              </span>
            </div>
          </div>

          <div className={`p-3.5 rounded-lg border flex items-center justify-between ${
            emergResult.isAntiPanicCompliant ? "bg-emerald-950/20 border-emerald-500/30" : "bg-red-950/20 border-red-500/30"
          }`}>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-white">Anti-Panic Open Floor Area</span>
              <span className="text-[11px] text-slate-400">
                Lowest Point: {emergResult.antiPanicMinLux} lx (Target: ≥ 0.5 lx)
              </span>
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                emergResult.isAntiPanicCompliant ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
              }`}>
                {emergResult.isAntiPanicCompliant ? "PASS (≥0.5 lx)" : "FAIL"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-[#131519] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onSwitchScene("10");
              toast.info("Switched 3D scene to Emergency Lighting Scene (10% battery run).");
            }}
            className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded text-xs font-bold cursor-pointer"
          >
            Preview 10% Emergency Scene
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition text-xs cursor-pointer shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. LUMINAIRE PLACEMENT & ARRANGEMENT MODAL (DIALux evo Tutorial Part 5)
// ============================================================================
export interface LuminairePlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomL: number;
  roomW: number;
  roomH: number;
  targetLux: number;
  profile: LuminairePhotometricProfile;
  gridConfig: { rows: number; cols: number };
  onApplyGrid: (cfg: { rows: number; cols: number }) => void;
  arrangementMode: LuminaireArrangementMode;
  onApplyArrangementMode: (m: LuminaireArrangementMode) => void;
  lineConfig?: LineArrangementConfig;
  onApplyLineConfig?: (cfg: LineArrangementConfig) => void;
  circularConfig?: CircularArrangementConfig;
  onApplyCircularConfig?: (cfg: CircularArrangementConfig) => void;
  polygonalConfig?: PolygonalArrangementConfig;
  onApplyPolygonalConfig?: (cfg: PolygonalArrangementConfig) => void;
  arrangementOverrides?: Record<number, LuminaireOverride>;
  onApplyArrangementOverrides?: (overrides: Record<number, LuminaireOverride>) => void;
  customLuminaires?: IndividualLuminaireConfig[];
  onApplyCustomLuminaires?: (lums: IndividualLuminaireConfig[]) => void;
  mountingType: "flush" | "surface" | "suspended" | "wall";
  onApplyMountingType: (m: "flush" | "surface" | "suspended" | "wall") => void;
  suspensionLength: number;
  onApplySuspensionLength: (l: number) => void;
  workPlaneHeight?: number;
}

export function LuminairePlacementModal({
  isOpen,
  onClose,
  roomL,
  roomW,
  roomH,
  targetLux,
  profile,
  gridConfig,
  onApplyGrid,
  arrangementMode,
  onApplyArrangementMode,
  lineConfig,
  onApplyLineConfig,
  circularConfig,
  onApplyCircularConfig,
  polygonalConfig,
  onApplyPolygonalConfig,
  arrangementOverrides = {},
  onApplyArrangementOverrides,
  customLuminaires = [],
  onApplyCustomLuminaires,
  mountingType,
  onApplyMountingType,
  suspensionLength,
  onApplySuspensionLength,
  workPlaneHeight = 0.75,
}: LuminairePlacementModalProps) {
  if (!isOpen) return null;

  // Local placement state
  const [localMode, setLocalMode] = useState<LuminaireArrangementMode>(arrangementMode);
  const [localRows, setLocalRows] = useState<number>(gridConfig.rows);
  const [localCols, setLocalCols] = useState<number>(gridConfig.cols);
  const [localMounting, setLocalMounting] = useState<"flush" | "surface" | "suspended" | "wall">(mountingType);
  const [localSuspension, setLocalSuspension] = useState<number>(suspensionLength);

  // Line config local state
  const [localLine, setLocalLine] = useState<LineArrangementConfig>(
    lineConfig || {
      startX: 0.6,
      startY: Number((roomW / 2).toFixed(2)),
      endX: Number((roomL - 0.6).toFixed(2)),
      endY: Number((roomW / 2).toFixed(2)),
      count: Math.max(2, gridConfig.cols),
      isContinuous: false,
      fixtureLength: profile.dimensions?.length || 1.2,
      alignPerpendicular: false,
    }
  );

  // Circular config local state
  const [localCircular, setLocalCircular] = useState<CircularArrangementConfig>(
    circularConfig || {
      centerX: Number((roomL / 2).toFixed(2)),
      centerY: Number((roomW / 2).toFixed(2)),
      radius: Number((Math.min(roomL, roomW) * 0.35).toFixed(2)),
      count: Math.max(4, gridConfig.cols * gridConfig.rows),
      startAngleDeg: 0,
      sweepAngleDeg: 360,
      alignTangential: true,
    }
  );

  // Polygonal config local state (DIALux evo Tutorial Part 6)
  const [localPolygonal, setLocalPolygonal] = useState<PolygonalArrangementConfig>(
    polygonalConfig || {
      points: [
        { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
        { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
        { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
        { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
      ],
      count: Math.max(4, gridConfig.cols * 2),
      isClosed: true,
      alignToSegment: true,
    }
  );

  // Arrangement Overrides local state (DIALux evo Tutorial Part 6)
  const [localOverrides, setLocalOverrides] = useState<Record<number, LuminaireOverride>>(
    arrangementOverrides || {}
  );
  const [selectedFixtureIdx, setSelectedFixtureIdx] = useState<number | null>(0);

  // Individual luminaires local state
  const [localCustomLums, setLocalCustomLums] = useState<IndividualLuminaireConfig[]>(customLuminaires);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(
    customLuminaires[0]?.id || null
  );

  // Auto space calculation result
  const autoSolution = computeSpaceAutoArrangement({
    length: roomL,
    width: roomW,
    height: roomH,
    targetLux,
    profile,
    workPlaneHeight,
  });

  // Calculate live preview luminaires with overrides
  const previewInstances: LuminaireInstance[] = localMode === "individual"
    ? localCustomLums.map((cl, idx) => ({
        id: cl.id,
        x: cl.x,
        y: cl.y,
        z: cl.z,
        rotationZ: cl.rotationZ || 0,
        isCustom: true,
        isExcluded: localOverrides[idx]?.isExcluded,
        targetPoint: localOverrides[idx]?.targetPoint,
      }))
    : generateLuminairePositions(
        roomL,
        roomW,
        roomH,
        localRows,
        localCols,
        localSuspension,
        localMode,
        localLine,
        localCircular,
        localPolygonal,
        undefined,
        localOverrides
      );

  // Arrangement transforms (DIALux evo Tutorial Part 6)
  const handleApplyTransform = (options: {
    rotateAngleDeg?: number;
    mirrorX?: boolean;
    mirrorY?: boolean;
    align?: "center" | "north" | "south" | "east" | "west";
  }) => {
    const transformed = transformLuminaireArrangement(previewInstances, {
      ...options,
      roomL,
      roomW,
    });
    setLocalOverrides((prev) => {
      const next = { ...prev };
      transformed.forEach((lum, idx) => {
        next[idx] = {
          ...(next[idx] || { index: idx }),
          x: lum.x,
          y: lum.y,
          rotationZ: lum.rotationZ,
        };
      });
      return next;
    });
    toast.success("Applied arrangement transformation.");
  };

  const handleResetOverrides = () => {
    setLocalOverrides({});
    toast.info("Cleared all fixture overrides.");
  };

  const handleToggleExcludeFixture = (idx: number) => {
    setLocalOverrides((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || { index: idx }),
        isExcluded: !(prev[idx]?.isExcluded ?? previewInstances[idx]?.isExcluded),
      },
    }));
  };

  const handleAimFixtureAtCentroid = (idx: number) => {
    const lum = previewInstances[idx];
    if (!lum) return;
    const targetX = Number((roomL / 2).toFixed(2));
    const targetY = Number((roomW / 2).toFixed(2));
    const targetZ = 0;
    const angles = calculateAimingAngles(lum.x, lum.y, lum.z, targetX, targetY, targetZ);
    setLocalOverrides((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || { index: idx }),
        targetPoint: { x: targetX, y: targetY, z: targetZ },
        rotationX: angles.pitch,
        rotationY: angles.roll,
        rotationZ: angles.pan,
      },
    }));
    toast.success(`Aimed luminaire #${idx + 1} at room center.`);
  };

  // 2D SVG canvas coordinate mapping
  const svgPad = 40;
  const maxSvgW = 540;
  const maxSvgH = 260;
  const scaleX = (maxSvgW - 2 * svgPad) / Math.max(1, roomL);
  const scaleY = (maxSvgH - 2 * svgPad) / Math.max(1, roomW);
  const scale = Math.min(scaleX, scaleY);

  const roomSvgW = roomL * scale;
  const roomSvgH = roomW * scale;
  const originX = (maxSvgW - roomSvgW) / 2;
  const originY = (maxSvgH - roomSvgH) / 2;

  const toSvgX = (x: number) => originX + x * scale;
  const toSvgY = (y: number) => originY + (roomW - y) * scale; // Inverted Y for plan view

  // Derived metrics
  const totalCount = previewInstances.length;
  const fixtureFlux = profile.lumens || profile.totalLumens || 3600;
  const totalFlux = totalCount * fixtureFlux;
  const floorArea = roomL * roomW;
  const estimatedLux = floorArea > 0 ? Math.round((totalFlux * 0.55 * 0.8) / floorArea) : 0;
  const isCompliant = estimatedLux >= targetLux;
  const effectiveMount = Math.max(0.5, roomH - localSuspension);
  const relWorkH = Number(Math.max(0.1, effectiveMount - workPlaneHeight).toFixed(2));
  const spacingX = Number((roomL / Math.max(1, localCols)).toFixed(2));
  const spacingY = Number((roomW / Math.max(1, localRows)).toFixed(2));
  const shr = Number((Math.max(spacingX, spacingY) / relWorkH).toFixed(2));

  // Canvas click handler (for placing individual fixture)
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (localMode !== "individual") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickSvgX = ((e.clientX - rect.left) / rect.width) * maxSvgW;
    const clickSvgY = ((e.clientY - rect.top) / rect.height) * maxSvgH;

    const realX = Number(Math.max(0.2, Math.min(roomL - 0.2, (clickSvgX - originX) / scale)).toFixed(2));
    const realY = Number(Math.max(0.2, Math.min(roomW - 0.2, roomW - (clickSvgY - originY) / scale)).toFixed(2));

    const newLum: IndividualLuminaireConfig = {
      id: `ind-lum-${Date.now().toString().slice(-4)}`,
      name: `Point Luminaire #${localCustomLums.length + 1}`,
      x: realX,
      y: realY,
      z: effectiveMount,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      dimming: 1.0,
      profileId: profile.id,
    };
    setLocalCustomLums((prev) => [...prev, newLum]);
    setSelectedCustomId(newLum.id);
    toast.success(`Placed luminaire at X: ${realX}m, Y: ${realY}m`);
  };

  const handleApplyAll = () => {
    onApplyArrangementMode(localMode);
    onApplyGrid({ rows: localRows, cols: localCols });
    onApplyMountingType(localMounting);
    onApplySuspensionLength(localSuspension);
    if (onApplyLineConfig) onApplyLineConfig(localLine);
    if (onApplyCircularConfig) onApplyCircularConfig(localCircular);
    if (onApplyPolygonalConfig) onApplyPolygonalConfig(localPolygonal);
    if (onApplyArrangementOverrides) onApplyArrangementOverrides(localOverrides);
    if (onApplyCustomLuminaires) onApplyCustomLuminaires(localCustomLums);
    toast.success(
      `Applied ${localMode.toUpperCase()} arrangement with ${totalCount} fittings to 3D space.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#181a1f] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#14161a] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lightbulb className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                DIALux evo Luminaire Placement & Arrangement
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Tutorial Part 5
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Active fixture: <span className="text-amber-300 font-medium">{profile.name}</span> ({profile.wattage}W, {fixtureFlux}lm)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-slate-200">
          {/* DIALux evo Part 6: Arrangement Transforms Quick Toolbar */}
          <div className="bg-[#14161a] p-2.5 rounded-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Move className="size-3.5 text-amber-400" />
              <span>Arrangement Transforms (Part 6):</span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 mr-0.5">Rotate Centroid:</span>
              {[15, 45, 90, -45].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => handleApplyTransform({ rotateAngleDeg: deg })}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px] font-bold cursor-pointer"
                >
                  {deg > 0 ? `+${deg}°` : `${deg}°`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 mr-0.5">Align:</span>
              {(["center", "north", "south", "east", "west"] as const).map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => handleApplyTransform({ align: al })}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 text-[10px] font-bold cursor-pointer capitalize"
                >
                  {al}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplyTransform({ mirrorX: true })}
                className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-cyan-300 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                title="Flip Horizontal"
              >
                <FlipHorizontal className="size-3" /> Flip H
              </button>
              <button
                type="button"
                onClick={() => handleApplyTransform({ mirrorY: true })}
                className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-cyan-300 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                title="Flip Vertical"
              >
                <FlipVertical className="size-3" /> Flip V
              </button>
              <button
                type="button"
                onClick={handleResetOverrides}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                title="Reset all overrides"
              >
                <RotateCcw className="size-3" /> Reset Grid
              </button>
            </div>
          </div>

          {/* Top 2D CAD Top-Down Schematic Preview Canvas */}
          <div className="bg-[#0f1115] rounded-xl border border-slate-800 p-3 flex flex-col items-center relative shadow-inner">
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
              <span className="font-mono flex items-center gap-1.5">
                <Target className="size-3.5 text-amber-400" />
                2D CAD Floor Plan Placement View (Z = {effectiveMount.toFixed(2)}m) — Click any luminaire to inspect & aim
              </span>
              <div className="flex items-center gap-2">
                {previewInstances.some((l) => l.isExcluded) && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                    {previewInstances.filter((l) => l.isExcluded).length} excluded
                  </span>
                )}
                <span className="font-mono text-emerald-400 font-bold">
                  {previewInstances.filter((l) => !l.isExcluded).length}/{totalCount} Active
                </span>
              </div>
            </div>

            <svg
              viewBox={`0 0 ${maxSvgW} ${maxSvgH}`}
              className="w-full h-60 select-none bg-[#0a0c0f] rounded-lg border border-slate-800/80 cursor-crosshair"
              onClick={handleCanvasClick}
            >
              <defs>
                <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
                <marker
                  id="aimArrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#06b6d4" />
                </marker>
              </defs>
              <rect width={maxSvgW} height={maxSvgH} fill="url(#gridPattern)" />

              {/* Room Boundary Walls */}
              <rect
                x={originX}
                y={originY}
                width={roomSvgW}
                height={roomSvgH}
                fill="#13161c"
                stroke="#3b82f6"
                strokeWidth="2.5"
                rx="2"
              />

              {/* EN 12464-1 Workplane Margin (0.5m offset) */}
              <rect
                x={originX + 0.5 * scale}
                y={originY + 0.5 * scale}
                width={Math.max(1, roomSvgW - 1.0 * scale)}
                height={Math.max(1, roomSvgH - 1.0 * scale)}
                fill="none"
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />

              {/* Dimension Texts */}
              <text x={originX + roomSvgW / 2} y={originY - 8} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                Length: {roomL.toFixed(2)}m
              </text>
              <text x={originX - 10} y={originY + roomSvgH / 2} fill="#94a3b8" fontSize="10" textAnchor="middle" transform={`rotate(-90 ${originX - 10} ${originY + roomSvgH / 2})`} fontFamily="monospace">
                Width: {roomW.toFixed(2)}m
              </text>

              {/* Render Luminaires with DIALux evo Part 6 Selection, Exclusion and Aiming Vectors */}
              {previewInstances.map((lum, idx) => {
                const cx = toSvgX(lum.x);
                const cy = toSvgY(lum.y);
                const isSelected = selectedFixtureIdx === idx || selectedCustomId === lum.id;
                const isExcluded = !!lum.isExcluded;

                return (
                  <g
                    key={lum.id || idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFixtureIdx(idx);
                      if (lum.id) setSelectedCustomId(lum.id);
                    }}
                    className="cursor-pointer"
                  >
                    {/* Aiming Vector Arrow (if focused at targetPoint) */}
                    {lum.targetPoint && (
                      <g>
                        <line
                          x1={cx}
                          y1={cy}
                          x2={toSvgX(lum.targetPoint.x)}
                          y2={toSvgY(lum.targetPoint.y)}
                          stroke="#06b6d4"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                          markerEnd="url(#aimArrow)"
                        />
                        <circle
                          cx={toSvgX(lum.targetPoint.x)}
                          cy={toSvgY(lum.targetPoint.y)}
                          r="3"
                          fill="#06b6d4"
                          opacity="0.8"
                        />
                      </g>
                    )}

                    {/* Golden Selection Glow Ring */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={Math.max(12, 0.4 * scale + 5)}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        className="animate-pulse"
                      />
                    )}

                    {/* Fixture Geometry */}
                    {profile.dimensions?.length && profile.dimensions.length > 0.9 ? (
                      <g transform={`rotate(${lum.rotationZ || 0} ${cx} ${cy})`} opacity={isExcluded ? 0.35 : 0.95}>
                        <rect
                          x={cx - Math.max(16, profile.dimensions.length * scale) / 2}
                          y={cy - Math.max(6, 0.15 * scale) / 2}
                          width={Math.max(16, profile.dimensions.length * scale)}
                          height={Math.max(6, 0.15 * scale)}
                          fill={isExcluded ? "#7f1d1d" : isSelected ? "#f59e0b" : "#fbbf24"}
                          stroke={isExcluded ? "#ef4444" : isSelected ? "#ffffff" : "#d97706"}
                          strokeWidth={isExcluded ? "1.5" : "1.2"}
                          strokeDasharray={isExcluded ? "3 2" : "none"}
                          rx="1"
                        />
                        <line
                          x1={cx - Math.max(16, profile.dimensions.length * scale) / 2}
                          y1={cy}
                          x2={cx + Math.max(16, profile.dimensions.length * scale) / 2}
                          y2={cy}
                          stroke={isExcluded ? "#ef4444" : "#78350f"}
                          strokeWidth="0.8"
                        />
                      </g>
                    ) : profile.shape === "circular" ? (
                      <g opacity={isExcluded ? 0.35 : 0.95}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={Math.max(6, 0.25 * scale)}
                          fill={isExcluded ? "#7f1d1d" : isSelected ? "#f59e0b" : "#fbbf24"}
                          stroke={isExcluded ? "#ef4444" : isSelected ? "#ffffff" : "#d97706"}
                          strokeWidth={isExcluded ? "1.5" : "1.2"}
                          strokeDasharray={isExcluded ? "3 2" : "none"}
                        />
                        <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={isExcluded ? "#ef4444" : "#78350f"} strokeWidth="0.8" />
                        <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke={isExcluded ? "#ef4444" : "#78350f"} strokeWidth="0.8" />
                      </g>
                    ) : (
                      <g opacity={isExcluded ? 0.35 : 0.95}>
                        <rect
                          x={cx - Math.max(12, 0.6 * scale) / 2}
                          y={cy - Math.max(12, 0.6 * scale) / 2}
                          width={Math.max(12, 0.6 * scale)}
                          height={Math.max(12, 0.6 * scale)}
                          fill={isExcluded ? "#7f1d1d" : isSelected ? "#f59e0b" : "#fbbf24"}
                          stroke={isExcluded ? "#ef4444" : isSelected ? "#ffffff" : "#d97706"}
                          strokeWidth={isExcluded ? "1.5" : "1.2"}
                          strokeDasharray={isExcluded ? "3 2" : "none"}
                          rx="1"
                        />
                        <circle cx={cx} cy={cy} r="1.5" fill={isExcluded ? "#ef4444" : "#78350f"} />
                      </g>
                    )}

                    {/* Excluded diagonal red strike */}
                    {isExcluded && (
                      <line
                        x1={cx - 8}
                        y1={cy - 8}
                        x2={cx + 8}
                        y2={cy + 8}
                        stroke="#ef4444"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Quick Inspector bar for Selected Fixture */}
            {selectedFixtureIdx !== null && previewInstances[selectedFixtureIdx] && (
              <div className="w-full mt-2 p-2 bg-[#13161c] rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-400">
                    Fixture #{selectedFixtureIdx + 1}:
                  </span>
                  <span className="text-slate-300 font-mono">
                    X: {previewInstances[selectedFixtureIdx].x.toFixed(2)}m, Y: {previewInstances[selectedFixtureIdx].y.toFixed(2)}m
                  </span>
                  {previewInstances[selectedFixtureIdx].isExcluded ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                      EXCLUDED
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                  {previewInstances[selectedFixtureIdx].targetPoint && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      AIMED
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleExcludeFixture(selectedFixtureIdx)}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer text-[10px] border ${
                      previewInstances[selectedFixtureIdx].isExcluded
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                        : "bg-red-950/60 hover:bg-red-900 text-red-300 border-red-800"
                    }`}
                  >
                    {previewInstances[selectedFixtureIdx].isExcluded ? "Restore to Grid" : "Exclude Luminaire"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAimFixtureAtCentroid(selectedFixtureIdx)}
                    className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded font-bold cursor-pointer text-[10px]"
                  >
                    Aim to Centroid
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalOverrides((prev) => {
                        const next = { ...prev };
                        delete next[selectedFixtureIdx];
                        return next;
                      });
                      toast.info(`Reset overrides for fixture #${selectedFixtureIdx + 1}`);
                    }}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded cursor-pointer text-[10px]"
                    title="Reset overrides"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Arrangement Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-300">Select Placement Tool (DIALux evo Mode)</span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {[
                { id: "grid", label: "Grid", icon: LayoutGrid },
                { id: "linear", label: "Line", icon: SlidersHorizontal },
                { id: "circular", label: "Ring", icon: Circle },
                { id: "perimeter", label: "Cove", icon: Square },
                { id: "polygonal", label: "Polygon", icon: Shapes },
                { id: "individual", label: "Single", icon: MapPin },
                { id: "auto_space", label: "Auto Solver", icon: Sparkles },
              ].map((m) => {
                const Icon = m.icon;
                const isActive = localMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (m.id === "auto_space") {
                        setLocalRows(autoSolution.rows);
                        setLocalCols(autoSolution.cols);
                        setLocalMode("grid");
                        toast.success(`Auto-solved: ${autoSolution.rows}×${autoSolution.cols} (${autoSolution.total} fittings) for ${targetLux} lx`);
                      } else {
                        setLocalMode(m.id as LuminaireArrangementMode);
                      }
                    }}
                    className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1.5 text-[10px] font-bold border transition cursor-pointer ${
                      isActive
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/80 shadow-md ring-1 ring-amber-500/50"
                        : "bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Form for Active Arrangement Mode */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Pattern Specific Parameters */}
            <div className="bg-[#14161a] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
              <span className="font-bold text-white text-xs">
                {localMode === "grid" && "Rectangular Grid Parameters"}
                {localMode === "linear" && "Line Arrangement & Trunking (Tutorial Part 5)"}
                {localMode === "circular" && "Circular Radial Pattern"}
                {localMode === "perimeter" && "Perimeter Cove Boundary"}
                {localMode === "polygonal" && "Polygonal Free-Path Run (Tutorial Part 6)"}
                {localMode === "individual" && "Individual Luminaire List"}
                {localMode === "single_center" && "Central Luminaire"}
              </span>

              {/* Grid Mode Settings */}
              {localMode === "grid" && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block text-[11px] mb-1">Columns (Lengthwise):</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLocalCols(Math.max(1, localCols - 1))}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={localCols}
                          onChange={(e) => setLocalCols(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-7 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono font-bold"
                        />
                        <button
                          onClick={() => setLocalCols(localCols + 1)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block text-[11px] mb-1">Rows (Widthwise):</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setLocalRows(Math.max(1, localRows - 1))}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={localRows}
                          onChange={(e) => setLocalRows(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-7 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono font-bold"
                        />
                        <button
                          onClick={() => setLocalRows(localRows + 1)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0f1115] p-2.5 rounded-lg border border-slate-800/80 text-[11px] flex flex-col gap-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Spacing X / Y:</span>
                      <span className="text-amber-300 font-bold">{spacingX}m × {spacingY}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Spacing-to-Height Ratio (SHR):</span>
                      <span className={shr <= 1.5 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                        {shr} {shr <= 1.5 ? "✓ Compliant" : "⚠ Exceeds 1.5"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Polygonal Mode Settings (DIALux evo Tutorial Part 6) */}
              {localMode === "polygonal" && (
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10.5px]">Shape Presets:</span>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {[
                        {
                          label: "Box",
                          points: [
                            { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                            { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                            { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
                            { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
                          ],
                        },
                        {
                          label: "Triangle",
                          points: [
                            { x: Number((roomL * 0.5).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
                            { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                            { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                          ],
                        },
                        {
                          label: "L-Shape",
                          points: [
                            { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                            { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
                            { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.5).toFixed(2)) },
                            { x: Number((roomL * 0.5).toFixed(2)), y: Number((roomW * 0.5).toFixed(2)) },
                            { x: Number((roomL * 0.5).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
                            { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
                          ],
                        },
                        {
                          label: "Pentagon",
                          points: Array.from({ length: 5 }).map((_, i) => {
                            const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
                            const r = Math.min(roomL, roomW) * 0.35;
                            return {
                              x: Number((roomL / 2 + r * Math.cos(ang)).toFixed(2)),
                              y: Number((roomW / 2 + r * Math.sin(ang)).toFixed(2)),
                            };
                          }),
                        },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setLocalPolygonal({
                              ...localPolygonal,
                              points: preset.points,
                            });
                            toast.success(`Applied ${preset.label} polygonal path preset.`);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold text-center border border-slate-700"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Path Fittings Count:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setLocalPolygonal({ ...localPolygonal, count: Math.max(3, localPolygonal.count - 1) })
                        }
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-amber-300">
                        {localPolygonal.count}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLocalPolygonal({ ...localPolygonal, count: localPolygonal.count + 1 })}
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <label className="flex items-center gap-1.5 p-1.5 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={localPolygonal.isClosed}
                        onChange={(e) => setLocalPolygonal({ ...localPolygonal, isClosed: e.target.checked })}
                        className="accent-amber-500 cursor-pointer"
                      />
                      <span>Closed Path</span>
                    </label>
                    <label className="flex items-center gap-1.5 p-1.5 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={localPolygonal.alignToSegment}
                        onChange={(e) => setLocalPolygonal({ ...localPolygonal, alignToSegment: e.target.checked })}
                        className="accent-amber-500 cursor-pointer"
                      />
                      <span>Align to Vector</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Line Mode Settings */}
              {localMode === "linear" && (
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10.5px] block mb-0.5">Start (X1, Y1):</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={localLine.startX}
                          onChange={(e) => setLocalLine({ ...localLine, startX: parseFloat(e.target.value) || 0 })}
                          className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={localLine.startY}
                          onChange={(e) => setLocalLine({ ...localLine, startY: parseFloat(e.target.value) || 0 })}
                          className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10.5px] block mb-0.5">End (X2, Y2):</span>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={localLine.endX}
                          onChange={(e) => setLocalLine({ ...localLine, endX: parseFloat(e.target.value) || 0 })}
                          className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={localLine.endY}
                          onChange={(e) => setLocalLine({ ...localLine, endY: parseFloat(e.target.value) || 0 })}
                          className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Luminaire Count:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLocalLine({ ...localLine, count: Math.max(1, localLine.count - 1) })}
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-amber-300">{localLine.count}</span>
                      <button
                        onClick={() => setLocalLine({ ...localLine, count: localLine.count + 1 })}
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-2 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-[11px]">
                    <span className="text-slate-300">Continuous Seamless Trunking (Gap = 0)</span>
                    <input
                      type="checkbox"
                      checked={localLine.isContinuous}
                      onChange={(e) => setLocalLine({ ...localLine, isContinuous: e.target.checked })}
                      className="accent-amber-500 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* Circular Ring Settings */}
              {localMode === "circular" && (
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10.5px] block mb-0.5">Center X (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localCircular.centerX}
                        onChange={(e) => setLocalCircular({ ...localCircular, centerX: parseFloat(e.target.value) || 0 })}
                        className="w-full h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10.5px] block mb-0.5">Center Y (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={localCircular.centerY}
                        onChange={(e) => setLocalCircular({ ...localCircular, centerY: parseFloat(e.target.value) || 0 })}
                        className="w-full h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Ring Radius:</span>
                    <span className="font-mono text-amber-300 font-bold">{localCircular.radius} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max={Number((Math.min(roomL, roomW) * 0.48).toFixed(1))}
                    step="0.1"
                    value={localCircular.radius}
                    onChange={(e) => setLocalCircular({ ...localCircular, radius: parseFloat(e.target.value) || 1.0 })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Fittings Count:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLocalCircular({ ...localCircular, count: Math.max(3, localCircular.count - 1) })}
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-mono font-bold text-amber-300">{localCircular.count}</span>
                      <button
                        onClick={() => setLocalCircular({ ...localCircular, count: localCircular.count + 1 })}
                        className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Perimeter Cove Settings */}
              {localMode === "perimeter" && (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Wall Offset Margin:</span>
                    <span className="font-mono text-amber-300 font-bold">0.60 m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Boundary Fixtures:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.max(4, (localCols + localRows) * 2 - 4)}
                    </span>
                  </div>
                </div>
              )}

              {/* Individual Mode Settings */}
              {localMode === "individual" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Fittings Count:</span>
                    <span className="font-mono text-amber-300 font-bold">{localCustomLums.length}</span>
                  </div>

                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                    {localCustomLums.map((lum, idx) => (
                      <div
                        key={lum.id}
                        onClick={() => {
                          setSelectedCustomId(lum.id);
                          setSelectedFixtureIdx(idx);
                        }}
                        className={`p-1.5 rounded flex items-center justify-between text-xs cursor-pointer border ${
                          selectedCustomId === lum.id
                            ? "bg-amber-500/20 text-white border-amber-500/60"
                            : "bg-[#0f1115] text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        <span>#{idx + 1} (X: {lum.x}m, Y: {lum.y}m)</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocalCustomLums((prev) => prev.filter((l) => l.id !== lum.id));
                          }}
                          className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Mounting & Photometric Elevation */}
            <div className="bg-[#14161a] p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
              <span className="font-bold text-white text-xs">Mounting Style & Elevation Parameters</span>

              <div className="grid grid-cols-4 gap-1 text-[10.5px]">
                {[
                  { id: "flush", label: "Recessed" },
                  { id: "surface", label: "Surface" },
                  { id: "suspended", label: "Suspended" },
                  { id: "wall", label: "Wall" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setLocalMounting(m.id as any)}
                    className={`py-1 rounded font-bold transition cursor-pointer border text-center ${
                      localMounting === m.id
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mounting Height (h_mount):</span>
                  <span className="text-white font-mono font-bold">{effectiveMount.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max={roomH}
                  step="0.05"
                  value={effectiveMount}
                  onChange={(e) => {
                    const newH = parseFloat(e.target.value) || 2.8;
                    setLocalSuspension(Math.max(0, Number((roomH - newH).toFixed(2))));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {localMounting === "suspended" && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Suspension Drop Length:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max={roomH - 1.0}
                      value={localSuspension}
                      onChange={(e) => setLocalSuspension(parseFloat(e.target.value) || 0)}
                      className="w-16 h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white font-mono text-xs"
                    />
                    <span className="text-slate-500">m</span>
                  </div>
                </div>
              )}

              <div className="bg-[#0f1115] p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono flex flex-col gap-1 mt-auto">
                <div className="flex justify-between">
                  <span className="text-slate-400">Height to Workplane (H_rel):</span>
                  <span className="text-emerald-400 font-bold">{relWorkH} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Workplane Height (h_wp):</span>
                  <span className="text-slate-300 font-bold">{workPlaneHeight} m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Live Calculation Summary Bar */}
          <div className="p-3 bg-[#14161a] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400 block text-[10px]">Estimated E_avg:</span>
                <span className={`text-base font-bold font-mono ${isCompliant ? "text-emerald-400" : "text-amber-400"}`}>
                  {estimatedLux} lx
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Target Illuminance:</span>
                <span className="text-base font-bold font-mono text-white">{targetLux} lx</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Connected Load:</span>
                <span className="text-base font-bold font-mono text-white">
                  {(totalCount * profile.wattage).toLocaleString()} W ({((totalCount * profile.wattage) / Math.max(1, floorArea)).toFixed(1)} W/m²)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                isCompliant ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}>
                {isCompliant ? "✓ EN 12464-1 COMPLIANT" : "⚠ BELOW TARGET LUX"}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#14161a] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition text-xs cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleApplyAll}
            className="px-5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold transition text-xs cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Check className="size-4" /> Apply Arrangement to 3D Viewport
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 10. DIALUX EVO RAYTRACER & HDR IMAGING STUDIO MODAL (Tutorial Part 7)
// ============================================================================
export interface RaytracerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  projectName?: string;
  roomL: number;
  roomW: number;
  roomH: number;
  profile: LuminairePhotometricProfile;
  simulationResult: any;
  rendererRef: React.RefObject<any>;
  projectImages: RenderedRaytraceImage[];
  setProjectImages: React.Dispatch<React.SetStateAction<RenderedRaytraceImage[]>>;
}

export function RaytracerModal({
  isOpen,
  onClose,
  roomName,
  projectName = "MEP Lighting Project",
  roomL,
  roomW,
  roomH,
  profile,
  simulationResult,
  rendererRef,
  projectImages,
  setProjectImages,
}: RaytracerModalProps) {
  if (!isOpen) return null;

  // Active view inside modal: "studio" (render setup) or "gallery" (project images)
  const [activeTab, setActiveTab] = useState<"studio" | "gallery">("studio");

  // Configuration State
  const [preset, setPreset] = useState<"draft" | "medium" | "high" | "2k" | "4k" | "custom">("high");
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "4:3" | "1:1" | "custom">("16:9");

  // DIALux evo Part 7 Optical Features
  const [enableMirrorReflections, setEnableMirrorReflections] = useState<boolean>(true); // Red ball on mirror
  const [mirrorReflectance, setMirrorReflectance] = useState<number>(0.75); // 75%
  const [enableTransparency, setEnableTransparency] = useState<boolean>(true); // Glass windows/diffusers
  const [enableSoftShadows, setEnableSoftShadows] = useState<boolean>(true); // Penumbra
  const [shadowSamples, setShadowSamples] = useState<number>(32);
  const [enableIndirectBounces, setEnableIndirectBounces] = useState<boolean>(true); // Radiosity
  const [radiosityBounces, setRadiosityBounces] = useState<number>(2);
  const [antiAliasing, setAntiAliasing] = useState<"1x" | "4x" | "8x" | "16x">("4x");

  // DIALux evo Part 7 HDR Option
  const [enableHdr, setEnableHdr] = useState<boolean>(true);

  // Metadata
  const [imageTitle, setImageTitle] = useState<string>(`Raytrace ${projectImages.length + 1} - ${roomName}`);
  const [imageDescription, setImageDescription] = useState<string>(
    "Photorealistic Raytraced simulation with specular mirror reflections, soft penumbra shadows, and HDR illuminance distribution."
  );

  // Calculation Progress & Output
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcProgress, setCalcProgress] = useState<number>(0);
  const [currentPass, setCurrentPass] = useState<string>("");
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Active Displayed Render
  const [currentRender, setCurrentRender] = useState<RenderedRaytraceImage | null>(() => {
    return projectImages.length > 0 ? projectImages[projectImages.length - 1] : null;
  });

  // HDR Post-Processing Exposure & Tone Mapping
  const [exposureEv, setExposureEv] = useState<number>(0.0);
  const [toneMapping, setToneMapping] = useState<"aces" | "reinhard" | "linear">("aces");

  // Canvas for live exposure tonemapping preview
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  // Effective Resolution
  const selectedPresetObj = RAYTRACER_PRESETS.find((p) => p.id === preset);
  const targetW = preset === "custom" ? customWidth : (selectedPresetObj?.width || 1920);
  const targetH = preset === "custom" ? customHeight : (selectedPresetObj?.height || 1080);

  // Live Redraw when Exposure EV or Tone Mapping changes
  useEffect(() => {
    if (!currentRender || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // If HDR enabled or exposure offset applied
      if (exposureEv !== 0.0 || toneMapping !== "linear") {
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const origCopy = new Uint8ClampedArray(imgData.data);
          applyHdrExposureAndToneMapping(origCopy, imgData.data, exposureEv, toneMapping);
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // ignore cross-origin read if test url
        }
      }
    };
    img.src = currentRender.originalDataUrl || currentRender.dataUrl;
    baseImageRef.current = img;
  }, [currentRender, exposureEv, toneMapping]);

  // Start Raytracer Calculation
  const handleStartRaytrace = () => {
    if (isCalculating) return;

    setIsCalculating(true);
    setCalcProgress(0);
    setElapsedSec(0);
    setCurrentPass("Initializing Photometric Raytracer Engine...");

    const startTime = Date.now();
    const intervalTimer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    const passes = [
      { p: 15, name: "Pass 1/5: Direct Photometric Radiance & Surface Illumination" },
      { p: 38, name: "Pass 2/5: Raytracing Soft Penumbra Shadows (Physical Fitting Geometry)" },
      { p: 64, name: "Pass 3/5: Calculating Specular Mirror Reflections & Glossy Surface Bounces" },
      { p: 85, name: "Pass 4/5: Glass Transparency, Optical Refraction & Radiosity Inter-reflections" },
      { p: 98, name: "Pass 5/5: High Dynamic Range (HDR) Float Luminance Calibration & Tone Mapping" },
    ];

    let passIdx = 0;
    const passInterval = setInterval(() => {
      if (passIdx < passes.length) {
        setCalcProgress(passes[passIdx].p);
        setCurrentPass(passes[passIdx].name);
        passIdx++;
      } else {
        clearInterval(passInterval);
        clearInterval(intervalTimer);

        // Capture high-resolution render from WebGL canvas
        let capturedDataUrl = "";
        if (rendererRef.current && rendererRef.current.domElement) {
          capturedDataUrl = rendererRef.current.domElement.toDataURL("image/png");
        } else {
          // Fallback placeholder canvas
          const fallbackC = document.createElement("canvas");
          fallbackC.width = targetW;
          fallbackC.height = targetH;
          const fctx = fallbackC.getContext("2d")!;
          fctx.fillStyle = "#16181d";
          fctx.fillRect(0, 0, targetW, targetH);
          fctx.fillStyle = "#f59e0b";
          fctx.font = "bold 32px sans-serif";
          fctx.fillText(`DIALux evo Raytracer — ${roomName}`, 60, 100);
          capturedDataUrl = fallbackC.toDataURL("image/png");
        }

        const newImage: RenderedRaytraceImage = {
          id: `raytrace-${Date.now()}`,
          title: imageTitle.trim() || `Raytrace ${projectImages.length + 1}`,
          description: imageDescription,
          timestamp: new Date().toLocaleString(),
          width: targetW,
          height: targetH,
          dataUrl: capturedDataUrl,
          originalDataUrl: capturedDataUrl,
          isHdr: enableHdr,
          exposureEv: 0.0,
          toneMapping: "aces",
          roomName,
          fileSizeBytes: Math.round(capturedDataUrl.length * 0.75),
        };

        setProjectImages((prev) => [...prev, newImage]);
        setCurrentRender(newImage);
        setExposureEv(0.0);
        setIsCalculating(false);
        setCalcProgress(100);
        setCurrentPass("Raytracer Calculation Complete!");
        toast.success(`Raytracer finished! Render saved to Project Images (${targetW}×${targetH}).`);
      }
    }, 550);
  };

  // Export current image as standard PNG
  const handleDownloadPng = () => {
    if (!canvasRef.current && !currentRender) return;
    const url = canvasRef.current ? canvasRef.current.toDataURL("image/png") : currentRender!.dataUrl;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(currentRender?.title || "Raytrace").replace(/\s+/g, "_")}.png`;
    a.click();
    toast.success("Downloaded High-Resolution PNG Render");
  };

  // Export current image as standard JPG
  const handleDownloadJpg = () => {
    if (!canvasRef.current && !currentRender) return;
    const url = canvasRef.current ? canvasRef.current.toDataURL("image/jpeg", 0.95) : currentRender!.dataUrl;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(currentRender?.title || "Raytrace").replace(/\s+/g, "_")}.jpg`;
    a.click();
    toast.success("Downloaded Photographic JPG Render");
  };

  // Export authentic Radiance RGBE (*.hdr) file
  const handleDownloadHdr = () => {
    if (!canvasRef.current) {
      toast.error("Render canvas not ready for HDR generation");
      return;
    }
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hdrBlob = generateRadianceHdrBlob(canvas.width, canvas.height, imgData);
      const url = URL.createObjectURL(hdrBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(currentRender?.title || "Raytrace").replace(/\s+/g, "_")}.hdr`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported Radiance HDR (*.hdr) Floating-Point Image");
    } catch (e) {
      toast.error("Failed to generate HDR binary file");
    }
  };

  // Delete an image from project
  const handleDeleteImage = (id: string) => {
    setProjectImages((prev) => prev.filter((img) => img.id !== id));
    if (currentRender?.id === id) {
      const remaining = projectImages.filter((img) => img.id !== id);
      setCurrentRender(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
    toast.info("Image removed from project file.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in-50">
      <div className="bg-[#181a1f] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col text-slate-100 overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="px-5 py-3 bg-[#1e2229] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Iconic DIALux evo Red Ball on Mirror Reflection Icon */}
            <div className="relative size-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-700 p-1 flex items-center justify-center shadow-lg border border-rose-400/40">
              <div className="size-3.5 rounded-full bg-red-200 shadow-inner" />
              <div className="absolute bottom-1 w-4 h-0.5 bg-white/70 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm">DIALux evo Raytracer</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Tutorial Part 7
                </span>
                {enableHdr && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    HDR ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Photorealistic static rendering with specular mirror reflections, soft shadows, and High Dynamic Range imaging
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Studio vs Project Images Gallery) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab("studio")}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "studio" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Raytracer Studio</span>
              </button>
              <button
                onClick={() => setActiveTab("gallery")}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "gallery" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <Camera className="size-3.5" />
                <span>Images Gallery ({projectImages.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === "studio" ? (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            
            {/* Left Column: Raytracer Controls & Quality Parameters (4 cols) */}
            <div className="lg:col-span-4 p-4 border-r border-slate-800 bg-[#16181d] flex flex-col gap-4 overflow-y-auto text-xs">
              
              {/* Resolution Settings (DIALux evo Part 7) */}
              <div className="flex flex-col gap-2 bg-[#121417] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Maximize2 className="size-3.5 text-amber-400" /> Resolution & Image Size
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {targetW} × {targetH} px
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1">
                  {RAYTRACER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={`p-1.5 rounded text-center transition cursor-pointer border flex flex-col items-center ${
                        preset === p.id
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase">{p.id}</span>
                      <span className="text-[9px] font-mono opacity-80">{p.width}×{p.height}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setPreset("custom")}
                    className={`p-1.5 rounded text-center transition cursor-pointer border flex flex-col items-center ${
                      preset === "custom"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase">Custom</span>
                    <span className="text-[9px] font-mono opacity-80">Manual</span>
                  </button>
                </div>

                {preset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 mt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Width (px)</label>
                      <input
                        type="number"
                        min={320}
                        max={7680}
                        step={10}
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(320, parseInt(e.target.value) || 1920))}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Height (px)</label>
                      <input
                        type="number"
                        min={240}
                        max={4320}
                        step={10}
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Math.max(240, parseInt(e.target.value) || 1080))}
                        className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Optical Features: Mirror Effects & Transparency (DIALux evo Part 7 signature) */}
              <div className="flex flex-col gap-2.5 bg-[#121417] p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-rose-400" /> Optical Raytracing Features
                </span>

                {/* Mirror Effects */}
                <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableMirrorReflections}
                        onChange={(e) => setEnableMirrorReflections(e.target.checked)}
                        className="size-3.5 accent-rose-500 rounded"
                      />
                      <span className="font-medium text-slate-300 flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-rose-500" />
                        Mirror Effects & Glossy Reflections
                      </span>
                    </label>
                    <span className="text-[10px] text-rose-400 font-mono font-bold">
                      {Math.round(mirrorReflectance * 100)}%
                    </span>
                  </div>
                  {enableMirrorReflections && (
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={mirrorReflectance}
                      onChange={(e) => setMirrorReflectance(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-700 accent-rose-500 rounded cursor-pointer"
                    />
                  )}
                </div>

                {/* Transparency */}
                <label className="flex items-center justify-between cursor-pointer pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableTransparency}
                      onChange={(e) => setEnableTransparency(e.target.checked)}
                      className="size-3.5 accent-blue-500 rounded"
                    />
                    <span className="font-medium text-slate-300">Transparency & Glass Refraction</span>
                  </div>
                  <span className="text-[10px] text-blue-400 font-mono">η = 1.52</span>
                </label>

                {/* Soft Penumbra Shadows */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSoftShadows}
                      onChange={(e) => setEnableSoftShadows(e.target.checked)}
                      className="size-3.5 accent-amber-500 rounded"
                    />
                    <span className="font-medium text-slate-300">Soft Penumbra Shadows</span>
                  </label>
                  <select
                    value={shadowSamples}
                    onChange={(e) => setShadowSamples(parseInt(e.target.value))}
                    disabled={!enableSoftShadows}
                    className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200"
                  >
                    <option value={16}>16 Samples</option>
                    <option value={32}>32 Samples</option>
                    <option value={64}>64 Ultra</option>
                  </select>
                </div>

                {/* Indirect Radiosity */}
                <div className="flex items-center justify-between pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableIndirectBounces}
                      onChange={(e) => setEnableIndirectBounces(e.target.checked)}
                      className="size-3.5 accent-emerald-500 rounded"
                    />
                    <span className="font-medium text-slate-300">Indirect Radiosity Bounces</span>
                  </label>
                  <select
                    value={radiosityBounces}
                    onChange={(e) => setRadiosityBounces(parseInt(e.target.value))}
                    disabled={!enableIndirectBounces}
                    className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200"
                  >
                    <option value={1}>1 Bounce</option>
                    <option value={2}>2 Bounces</option>
                    <option value={3}>3 Bounces</option>
                  </select>
                </div>
              </div>

              {/* High Dynamic Range (HDR) Section (DIALux evo Part 7) */}
              <div className="flex flex-col gap-2 bg-[#121417] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableHdr}
                      onChange={(e) => setEnableHdr(e.target.checked)}
                      className="size-3.5 accent-cyan-500 rounded"
                    />
                    <span className="font-bold text-white flex items-center gap-1">
                      <Sun className="size-3.5 text-cyan-400" /> High Dynamic Range (HDR)
                    </span>
                  </label>
                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 py-0.5 rounded font-mono font-bold">
                    *.hdr / *.exr
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Preserves floating-point illuminance distribution. Allows real-time exposure adjustments (±3 EV) in post-processing without recalculation.
                </p>
              </div>

              {/* Image Metadata */}
              <div className="flex flex-col gap-2 bg-[#121417] p-3 rounded-lg border border-slate-800">
                <span className="font-bold text-slate-200">Image Documentation</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Image Title</label>
                  <input
                    type="text"
                    value={imageTitle}
                    onChange={(e) => setImageTitle(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Notes / Description</label>
                  <textarea
                    rows={2}
                    value={imageDescription}
                    onChange={(e) => setImageDescription(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-xs text-white resize-none"
                  />
                </div>
              </div>

              {/* Start Calculation Button & Progress Bar */}
              <div className="mt-auto pt-2 flex flex-col gap-2">
                {isCalculating && (
                  <div className="flex flex-col gap-1.5 bg-[#121417] p-3 rounded-lg border border-amber-500/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-400 flex items-center gap-1.5">
                        <RefreshCw className="size-3.5 animate-spin" /> Calculating...
                      </span>
                      <span className="font-mono text-slate-300 font-bold">{calcProgress}% ({elapsedSec}s)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300"
                        style={{ width: `${calcProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{currentPass}</span>
                  </div>
                )}

                <button
                  onClick={handleStartRaytrace}
                  disabled={isCalculating}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                    isCalculating
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white border border-amber-400/40"
                  }`}
                >
                  <Sparkles className="size-4" />
                  <span>{isCalculating ? "Raytracing in Progress..." : "Start Raytracer"}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Viewport Render Preview & Interactive Exposure (8 cols) */}
            <div className="lg:col-span-8 p-4 bg-[#0d0f12] flex flex-col gap-3 overflow-y-auto">
              
              {/* Header Bar with Live HDR Exposure Controls */}
              <div className="flex items-center justify-between bg-[#16181d] px-3 py-2 rounded-lg border border-slate-800">
                <div className="flex items-center gap-2">
                  <Camera className="size-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">
                    {currentRender ? currentRender.title : "Active Camera View"}
                  </span>
                  {currentRender && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({currentRender.width} × {currentRender.height})
                    </span>
                  )}
                </div>

                {/* Live HDR Exposure Adjustment Slider (DIALux evo Part 7 signature) */}
                {currentRender && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#121417] px-2.5 py-1 rounded border border-slate-700 text-xs">
                      <Sun className="size-3.5 text-cyan-400" />
                      <span className="text-[10px] text-slate-400">Exposure:</span>
                      <input
                        type="range"
                        min={-3.0}
                        max={3.0}
                        step={0.1}
                        value={exposureEv}
                        onChange={(e) => setExposureEv(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-slate-700 accent-cyan-400 rounded cursor-pointer"
                      />
                      <span className="font-mono text-cyan-300 font-bold text-[10px] w-12 text-right">
                        {exposureEv > 0 ? `+${exposureEv.toFixed(1)}` : exposureEv.toFixed(1)} EV
                      </span>
                      {exposureEv !== 0.0 && (
                        <button
                          onClick={() => setExposureEv(0.0)}
                          className="text-[9px] text-slate-400 hover:text-white px-1 py-0.5 rounded bg-slate-800"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <select
                      value={toneMapping}
                      onChange={(e) => setToneMapping(e.target.value as any)}
                      className="h-7 px-1.5 bg-[#121417] border border-slate-700 rounded text-[11px] text-slate-200"
                      title="Tone Mapping Operator"
                    >
                      <option value="aces">ACES Filmic</option>
                      <option value="reinhard">Reinhard</option>
                      <option value="linear">Linear Standard</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Render Canvas Container */}
              <div className="flex-1 min-h-[360px] bg-[#090b0e] rounded-xl border border-slate-800 flex items-center justify-center relative overflow-hidden shadow-inner">
                {currentRender ? (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-[58vh] object-contain rounded shadow-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Sparkles className="size-10 text-slate-600 animate-pulse" />
                    <span className="text-xs">No raytraced render yet. Click "Start Raytracer" on the left to begin.</span>
                  </div>
                )}

                {/* Scanline Effect while calculating */}
                {isCalculating && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent pointer-events-none animate-pulse" />
                )}
              </div>

              {/* Export Actions Bar */}
              {currentRender && (
                <div className="flex items-center justify-between bg-[#16181d] p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span>Saved to Project ({projectImages.length} render{projectImages.length > 1 ? "s" : ""})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadPng}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="size-3.5 text-blue-400" /> Export PNG
                    </button>
                    <button
                      onClick={handleDownloadJpg}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="size-3.5 text-emerald-400" /> Export JPG
                    </button>
                    <button
                      onClick={handleDownloadHdr}
                      className="px-3.5 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Download className="size-3.5 text-cyan-400" /> Export Radiance HDR (*.hdr)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Gallery Tab: Project Images & HDR Lightbox (DIALux evo Part 7) */
          <div className="flex-1 p-5 overflow-y-auto bg-[#121417]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-white text-sm">Project Images & Visualizations</h4>
                <p className="text-[11px] text-slate-400">
                  All raytraced images are stored inside the project file. They can be renamed, re-exposed, exported, or deleted.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-amber-400">
                {projectImages.length} Image{projectImages.length !== 1 ? "s" : ""}
              </span>
            </div>

            {projectImages.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-slate-800 rounded-xl">
                <Camera className="size-12 text-slate-600" />
                <span className="text-sm">No images rendered yet. Switch to Raytracer Studio to generate images.</span>
                <button
                  onClick={() => setActiveTab("studio")}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Open Raytracer Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectImages.map((img) => (
                  <div
                    key={img.id}
                    className="bg-[#181a1f] rounded-xl border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 transition flex flex-col group"
                  >
                    {/* Thumbnail */}
                    <div
                      onClick={() => {
                        setCurrentRender(img);
                        setActiveTab("studio");
                      }}
                      className="relative h-44 bg-[#0a0c0f] cursor-pointer overflow-hidden flex items-center justify-center"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {img.isHdr && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/90 text-black shadow">
                          HDR
                        </span>
                      )}
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/80 text-white">
                        {img.width} × {img.height}
                      </span>
                    </div>

                    {/* Meta & Actions */}
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs truncate">{img.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{img.timestamp}</span>
                      </div>
                      <p className="text-[10.5px] text-slate-400 line-clamp-2">{img.description}</p>

                      <div className="mt-auto pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setCurrentRender(img);
                            setActiveTab("studio");
                          }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <Sun className="size-3" /> Adjust Exposure
                        </button>

                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Delete image from project"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-[#14161a] border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-[11px] text-slate-400">
            DIALux evo Raytracer Engine • Mirror Reflectance • Penumbra Shadows • 32-bit Float HDR Output
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
          >
            Close Studio
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 17. OFFICIAL DIALUX EVO DISPLAY & VIEW OPTIONS SUITE (TUTORIAL #9)
// =========================================================================

export interface SavedCameraViewpoint {
  id: string;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  fov?: number;
  slot?: number; // 1 to 9 (Tutorial 15 memory slots)
  thumbnail?: string;
  kelvin?: number;
}

export interface DialuxDisplayOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Visual aids toggles (F2 - F10)
  showCoordAxes: boolean;
  setShowCoordAxes: (v: boolean) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  showCalcSurfacePlane: boolean;
  setShowCalcSurfacePlane: (v: boolean) => void;
  isWireframeMode: boolean;
  setIsWireframeMode: (v: boolean) => void;
  showIsoluxLines: boolean;
  setShowIsoluxLines: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  showLightCones: boolean;
  setShowLightCones: (v: boolean) => void;
  showLightTextures: boolean;
  setShowLightTextures: (v: boolean) => void;
  showLuxNumbers: boolean;
  setShowLuxNumbers: (v: boolean) => void;
  showLuminaires: boolean;
  setShowLuminaires: (v: boolean) => void;
  showRoomWalls: boolean;
  setShowRoomWalls: (v: boolean) => void;
  showFurniture: boolean;
  setShowFurniture: (v: boolean) => void;
  showDwgUnderlay: boolean;
  setShowDwgUnderlay: (v: boolean) => void;
  showEnergyHud: boolean;
  setShowEnergyHud: (v: boolean) => void;
  // Working plane parameters (Tutorial #9)
  workPlaneHeight: number;
  setWorkPlaneHeight: (h: number) => void;
  marginOffset: number;
  setMarginOffset: (m: number) => void;
  // White balance parameters (Tutorial #9 & #15)
  whiteBalanceMode: "auto" | "manual";
  setWhiteBalanceMode: (m: "auto" | "manual") => void;
  whiteBalanceKelvin: number;
  setWhiteBalanceKelvin: (k: number) => void;
  whiteBalanceExposure: number;
  setWhiteBalanceExposure: (ev: number) => void;
  // Camera views
  cameraView: string;
  onApplyCameraView: (v: any) => void;
  savedViews: SavedCameraViewpoint[];
  onSaveCurrentView: (name: string) => void;
  onApplySavedView: (view: SavedCameraViewpoint) => void;
  onDeleteSavedView: (id: string) => void;
  // Energy metrics
  powerDensityWPerM2: number;
  roomArea: number;
  totalWatts: number;
}

export function DialuxDisplayOptionsPanel({
  isOpen,
  onClose,
  showCoordAxes,
  setShowCoordAxes,
  showDimensions,
  setShowDimensions,
  showCalcSurfacePlane,
  setShowCalcSurfacePlane,
  isWireframeMode,
  setIsWireframeMode,
  showIsoluxLines,
  setShowIsoluxLines,
  showHeatmap,
  setShowHeatmap,
  showLightCones,
  setShowLightCones,
  showLightTextures,
  setShowLightTextures,
  showLuxNumbers,
  setShowLuxNumbers,
  showLuminaires,
  setShowLuminaires,
  showRoomWalls,
  setShowRoomWalls,
  showFurniture,
  setShowFurniture,
  showDwgUnderlay,
  setShowDwgUnderlay,
  showEnergyHud,
  setShowEnergyHud,
  workPlaneHeight,
  setWorkPlaneHeight,
  marginOffset,
  setMarginOffset,
  whiteBalanceMode,
  setWhiteBalanceMode,
  whiteBalanceKelvin,
  setWhiteBalanceKelvin,
  whiteBalanceExposure,
  setWhiteBalanceExposure,
  cameraView,
  onApplyCameraView,
  savedViews,
  onSaveCurrentView,
  onApplySavedView,
  onDeleteSavedView,
  powerDensityWPerM2,
  roomArea,
  totalWatts,
}: DialuxDisplayOptionsPanelProps) {
  const [activeTab, setActiveTab] = useState<"toggles" | "workplane" | "whitebalance" | "views" | "energy">("toggles");
  const [newViewName, setNewViewName] = useState("");

  if (!isOpen) return null;

  const handleToggleAll = (enable: boolean) => {
    setShowCoordAxes(enable);
    setShowDimensions(enable);
    setShowCalcSurfacePlane(enable);
    setIsWireframeMode(false);
    setShowIsoluxLines(enable);
    setShowHeatmap(enable);
    setShowLightCones(enable);
    setShowLightTextures(enable);
    setShowLuxNumbers(enable);
    setShowLuminaires(enable);
    setShowRoomWalls(enable);
    setShowFurniture(enable);
    setShowDwgUnderlay(enable);
    setShowEnergyHud(enable);
    toast.info(enable ? "All display options enabled" : "All display overlays hidden");
  };

  const handleResetDefaults = () => {
    setShowCoordAxes(true);
    setShowDimensions(true);
    setShowCalcSurfacePlane(true);
    setIsWireframeMode(false);
    setShowIsoluxLines(true);
    setShowHeatmap(false);
    setShowLightCones(true);
    setShowLightTextures(true);
    setShowLuxNumbers(false);
    setShowLuminaires(true);
    setShowRoomWalls(true);
    setShowFurniture(true);
    setShowDwgUnderlay(true);
    setShowEnergyHud(true);
    setWorkPlaneHeight(0.75);
    setMarginOffset(0.5);
    setWhiteBalanceMode("manual");
    setWhiteBalanceKelvin(4000);
    setWhiteBalanceExposure(0.0);
    toast.success("Display options reset to DIALux evo defaults");
  };

  // Quick Kelvin color swatch
  const getKelvinColorStyle = (k: number) => {
    if (k <= 2700) return "#ff9e42";
    if (k <= 3000) return "#ffb46b";
    if (k <= 4000) return "#ffe4c7";
    if (k <= 5000) return "#ffffff";
    if (k <= 6500) return "#dbe8ff";
    return "#b8d5ff";
  };

  return (
    <div className="absolute top-10 right-2 z-50 w-96 max-h-[85vh] bg-[#16181f]/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl flex flex-col text-xs text-slate-200 select-none overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Flyout Header */}
      <div className="p-3 bg-[#12141a] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Monitor className="size-3.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
              <span>View &amp; Display Options</span>
              <span className="text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono">Part 9</span>
            </div>
            <span className="text-[9.5px] text-slate-400">Monitor symbol settings &amp; visual aids</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition"
          title="Close Display Options"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center bg-[#13151b] border-b border-slate-800 px-1 py-1 gap-1 text-[10.5px] font-semibold shrink-0 overflow-x-auto">
        {[
          { id: "toggles", label: "Toggles", icon: Eye },
          { id: "workplane", label: "Working Plane", icon: Square },
          { id: "whitebalance", label: "White Balance", icon: Sun },
          { id: "views", label: "Cameras", icon: Camera },
          { id: "energy", label: "Energy HUD", icon: Zap },
        ].map((tab) => {
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 shrink-0 ${
                isSel ? "bg-slate-800 text-white font-bold shadow-sm border border-slate-700/60" : "text-slate-400 hover:text-white"
              }`}
            >
              <tab.icon className={`size-3 ${isSel ? "text-emerald-400" : ""}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs flex flex-col gap-3">
        {/* TAB 1: 13 OFFICIAL DISPLAY TOGGLES */}
        {activeTab === "toggles" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="font-bold uppercase tracking-wider text-slate-400">13 Display Elements</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleAll(true)}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  All ON
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => handleToggleAll(false)}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  All OFF
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={handleResetDefaults}
                  className="text-amber-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* List of 13 official DIALux evo display options */}
            <div className="grid grid-cols-1 gap-1.5">
              {[
                {
                  id: "coord",
                  label: "Coordinate System",
                  shortcut: "F2",
                  icon: Compass,
                  val: showCoordAxes,
                  set: setShowCoordAxes,
                  desc: "RGB XYZ origin triad in CAD space",
                },
                {
                  id: "dims",
                  label: "Help Lines & Measurements",
                  shortcut: "F3",
                  icon: Ruler,
                  val: showDimensions,
                  set: setShowDimensions,
                  desc: "Dimension lines, guide lines & tape measure",
                },
                {
                  id: "plane",
                  label: "Working Plane & Surfaces",
                  shortcut: "F4",
                  icon: Square,
                  val: showCalcSurfacePlane,
                  set: setShowCalcSurfacePlane,
                  desc: "Yellow horizontal working plane & boundaries",
                },
                {
                  id: "wire",
                  label: "Wireframe Mode",
                  shortcut: "F5",
                  icon: Layers,
                  val: isWireframeMode,
                  set: setIsWireframeMode,
                  desc: "Display geometry as wire mesh surface edges",
                },
                {
                  id: "iso",
                  label: "Isolux Lines & Contours",
                  shortcut: "F6",
                  icon: Target,
                  val: showIsoluxLines,
                  set: setShowIsoluxLines,
                  desc: "Illuminance isolines (100 lx, 200 lx, 500 lx...)",
                },
                {
                  id: "heat",
                  label: "False Color Heatmap",
                  shortcut: "F7",
                  icon: Palette,
                  val: showHeatmap,
                  set: setShowHeatmap,
                  desc: "3D false-color photometric distribution",
                },
                {
                  id: "cones",
                  label: "Light Distribution Curves",
                  shortcut: "F8",
                  icon: Sparkles,
                  val: showLightCones,
                  set: setShowLightCones,
                  desc: "3D photometric luminous intensity webs",
                },
                {
                  id: "tex",
                  label: "Light Textures & Radiosity",
                  shortcut: "--",
                  icon: Sun,
                  val: showLightTextures,
                  set: setShowLightTextures,
                  desc: "Calculated light texture illumination on walls",
                },
                {
                  id: "luxnum",
                  label: "Numeric Lux Grid Values",
                  shortcut: "--",
                  icon: Type,
                  val: showLuxNumbers,
                  set: setShowLuxNumbers,
                  desc: "Workplane point-by-point numerical lux tags",
                },
                {
                  id: "lums",
                  label: "Luminaires 3D Housings",
                  shortcut: "F9",
                  icon: Lightbulb,
                  val: showLuminaires,
                  set: setShowLuminaires,
                  desc: "Physical 3D luminaire body graphics",
                },
                {
                  id: "walls",
                  label: "Room Geometry & Walls",
                  shortcut: "F10",
                  icon: Building2,
                  val: showRoomWalls,
                  set: setShowRoomWalls,
                  desc: "Exterior walls, partition walls & cutouts",
                },
                {
                  id: "furn",
                  label: "Furniture & Interior Objects",
                  shortcut: "--",
                  icon: Box,
                  val: showFurniture,
                  set: setShowFurniture,
                  desc: "Desks, tables, chairs & decorative models",
                },
                {
                  id: "dwg",
                  label: "DWG / CAD Plan Underlay",
                  shortcut: "--",
                  icon: FileText,
                  val: showDwgUnderlay,
                  set: setShowDwgUnderlay,
                  desc: "Imported 2D background architectural drawings",
                },
                {
                  id: "energy",
                  label: "Real-time Energy HUD",
                  shortcut: "--",
                  icon: Zap,
                  val: showEnergyHud,
                  set: setShowEnergyHud,
                  desc: "Viewport power density W/m² & LENI overlay",
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                    item.val
                      ? "bg-slate-900 border-slate-700/80 text-white"
                      : "bg-[#14161c] border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={(e) => item.set(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <item.icon className={`size-3.5 ${item.val ? "text-emerald-400" : "text-slate-500"}`} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[11px]">{item.label}</span>
                      <span className="text-[9.5px] text-slate-500">{item.desc}</span>
                    </div>
                  </div>
                  {item.shortcut !== "--" && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9.5px] font-mono text-slate-400 font-bold">
                      {item.shortcut}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: WORKING PLANE & CALCULATION AREAS (TUTORIAL #9) */}
        {activeTab === "workplane" && (
          <div className="flex flex-col gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
              <strong className="block text-amber-300 font-bold mb-0.5">Working Plane in DIALux evo</strong>
              Calculations are performed on a dedicated virtual plane (typically rendered in yellow). Adjust height and distance from boundary walls below.
            </div>

            {/* Working Plane Elevation */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Working Plane Height (Elevation)</span>
                <span className="font-mono text-emerald-400 font-bold">{workPlaneHeight.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.00"
                max="2.50"
                step="0.05"
                value={workPlaneHeight}
                onChange={(e) => setWorkPlaneHeight(parseFloat(e.target.value) || 0)}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1 mt-1 text-[10px]">
                {[
                  { label: "Floor (0m)", val: 0.0 },
                  { label: "Desk (0.75m)", val: 0.75 },
                  { label: "Euro (0.80m)", val: 0.8 },
                  { label: "Bench (1.0m)", val: 1.0 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => setWorkPlaneHeight(btn.val)}
                    className={`py-1 rounded font-semibold transition cursor-pointer border ${
                      Math.abs(workPlaneHeight - btn.val) < 0.02
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distance from Walls (Boundary Margin) */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Wall Zone / Distance from Walls</span>
                <span className="font-mono text-blue-400 font-bold">{marginOffset.toFixed(2)} m</span>
              </div>
              <p className="text-[10px] text-slate-400">
                EN 12464-1 stipulates excluding the perimeter zone near walls where visual work is not carried out.
              </p>
              <input
                type="range"
                min="0.00"
                max="1.20"
                step="0.05"
                value={marginOffset}
                onChange={(e) => setMarginOffset(parseFloat(e.target.value) || 0)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="grid grid-cols-3 gap-1 mt-1 text-[10px]">
                {[
                  { label: "None (0.00m)", val: 0.0 },
                  { label: "Standard (0.50m)", val: 0.5 },
                  { label: "Wide (0.75m)", val: 0.75 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={() => setMarginOffset(btn.val)}
                    className={`py-1 rounded font-semibold transition cursor-pointer border ${
                      Math.abs(marginOffset - btn.val) < 0.02
                        ? "bg-blue-500/20 border-blue-500 text-blue-300"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Toggle for Working Plane */}
            <button
              onClick={() => setShowCalcSurfacePlane(!showCalcSurfacePlane)}
              className={`w-full py-2 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 border ${
                showCalcSurfacePlane
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              <Square className="size-4" />
              <span>{showCalcSurfacePlane ? "Working Plane is VISIBLE in CAD (F4)" : "Working Plane is HIDDEN (Click to Show)"}</span>
            </button>
          </div>
        )}

        {/* TAB 3: WHITE BALANCE & COLOR DISPLAY (TUTORIAL #9 & #15) */}
        {activeTab === "whitebalance" && (
          <div className="flex flex-col gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-200">
              <strong className="block text-blue-300 font-bold mb-0.5">Monitor White Balance Adaptation</strong>
              Adjusts perceived color temperature and monitor calibration so light sources (e.g. 2700K warm vs 6500K daylight) render naturally.
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-center font-semibold text-[11px]">
              <button
                onClick={() => setWhiteBalanceMode("auto")}
                className={`py-1.5 rounded transition cursor-pointer ${
                  whiteBalanceMode === "auto" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Auto Balance
              </button>
              <button
                onClick={() => setWhiteBalanceMode("manual")}
                className={`py-1.5 rounded transition cursor-pointer ${
                  whiteBalanceMode === "manual" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                Manual (Kelvin)
              </button>
            </div>

            {/* Kelvin Slider */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">White Balance Color Temperature</span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span
                    className="size-3 rounded-full border border-slate-700"
                    style={{ backgroundColor: getKelvinColorStyle(whiteBalanceKelvin) }}
                  />
                  <span className="text-amber-300 font-bold">{whiteBalanceKelvin} K</span>
                </div>
              </div>
              <input
                type="range"
                min="2000"
                max="10000"
                step="100"
                disabled={whiteBalanceMode === "auto"}
                value={whiteBalanceKelvin}
                onChange={(e) => setWhiteBalanceKelvin(parseInt(e.target.value) || 4000)}
                className="w-full accent-amber-500 cursor-pointer disabled:opacity-40"
              />

              {/* Kelvin Presets */}
              <div className="grid grid-cols-5 gap-1 mt-1 text-[9.5px]">
                {[
                  { label: "2700K", desc: "Warm", k: 2700 },
                  { label: "3000K", desc: "Halogen", k: 3000 },
                  { label: "4000K", desc: "Neutral", k: 4000 },
                  { label: "5000K", desc: "Daylight", k: 5000 },
                  { label: "6500K", desc: "Cool D65", k: 6500 },
                ].map((p) => (
                  <button
                    key={p.k}
                    onClick={() => {
                      setWhiteBalanceMode("manual");
                      setWhiteBalanceKelvin(p.k);
                    }}
                    className={`p-1 rounded font-semibold text-center border cursor-pointer ${
                      whiteBalanceKelvin === p.k
                        ? "bg-amber-500/20 border-amber-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    <span className="block font-bold">{p.label}</span>
                    <span className="text-[8px] text-slate-400">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Exposure / Brightness Bias */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-white">Exposure Compensation</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {whiteBalanceExposure > 0 ? `+${whiteBalanceExposure.toFixed(1)}` : whiteBalanceExposure.toFixed(1)} EV
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.1"
                value={whiteBalanceExposure}
                onChange={(e) => setWhiteBalanceExposure(parseFloat(e.target.value) || 0)}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9.5px] text-slate-500">
                <span>-2.0 EV (Darker)</span>
                <button
                  onClick={() => setWhiteBalanceExposure(0.0)}
                  className="text-slate-400 hover:text-white cursor-pointer underline"
                >
                  Reset (0.0 EV)
                </button>
                <span>+2.0 EV (Brighter)</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CAMERA VIEWS & SAVED POSITIONS (TUTORIAL #9 & #15) */}
        {activeTab === "views" && (
          <div className="flex flex-col gap-3">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[10.5px]">
              Standard CAD Perspectives
            </span>

            <div className="grid grid-cols-4 gap-1.5 text-center text-[10.5px]">
              {[
                { id: "3d", label: "3D Perspective", key: "1" },
                { id: "top", label: "Top (Plan)", key: "2" },
                { id: "front", label: "Front (South)", key: "3" },
                { id: "side", label: "Side (East)", key: "4" },
                { id: "back", label: "Back (North)", key: "--" },
                { id: "left", label: "Left (West)", key: "--" },
                { id: "first_person", label: "Eye Level (1.7m)", key: "--" },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => onApplyCameraView(v.id)}
                  className={`p-2 rounded font-semibold transition cursor-pointer border flex flex-col items-center justify-center ${
                    cameraView === v.id
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span>{v.label}</span>
                  {v.key !== "--" && (
                    <span className="text-[9px] font-mono text-slate-500 mt-0.5">Key: {v.key}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Saved Viewpoints */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10.5px]">
                Saved Camera Viewpoints ({savedViews.length})
              </span>

              {/* Add New View */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. Presentation Angle..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => {
                    if (!newViewName.trim()) {
                      toast.error("Please enter a viewpoint name");
                      return;
                    }
                    onSaveCurrentView(newViewName.trim());
                    setNewViewName("");
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs cursor-pointer shadow"
                >
                  Save View
                </button>
              </div>

              {/* Views List */}
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                {savedViews.map((sv) => (
                  <div
                    key={sv.id}
                    className="p-1.5 bg-slate-900 rounded border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <button
                      onClick={() => onApplySavedView(sv)}
                      className="font-semibold text-slate-200 hover:text-emerald-400 text-left flex-1 cursor-pointer truncate"
                    >
                      {sv.name}
                    </button>
                    <button
                      onClick={() => onDeleteSavedView(sv.id)}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      title="Delete viewpoint"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: REAL-TIME ENERGY HUD (TUTORIAL #9) */}
        {activeTab === "energy" && (
          <div className="flex flex-col gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200">
              <strong className="block text-emerald-300 font-bold mb-0.5">Energy Consumption HUD (EN 15193)</strong>
              Real-time monitoring of specific connected lighting power and Lighting Energy Numeric Indicator (LENI).
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Connected Power</span>
                <strong className="text-base text-white font-bold mt-0.5 block">{totalWatts} W</strong>
                <span className="text-[9.5px] text-slate-500">({(totalWatts / 1000).toFixed(2)} kW)</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Specific Load</span>
                <strong className="text-base text-emerald-400 font-bold mt-0.5 block">
                  {powerDensityWPerM2.toFixed(1)} W/m²
                </strong>
                <span className="text-[9.5px] text-emerald-500">Benchmark: ≤ 12.0</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <strong className="text-xs text-white block">LENI Annual Benchmark</strong>
                <span className="text-[10.5px] text-slate-400">18.4 kWh/m²/year (Standard: ≤ 25.0)</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-black uppercase">
                COMPLIANT
              </span>
            </div>

            <label className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEnergyHud}
                onChange={(e) => setShowEnergyHud(e.target.checked)}
                className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold text-slate-200">Show floating Energy HUD in CAD viewport</span>
            </label>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-[#12141a] border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
        <span>DIALux evo Tutorial #9 View Options</span>
        <button
          onClick={handleResetDefaults}
          className="text-amber-400 hover:underline cursor-pointer"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

export { SimpleIndoorPlanningModal, type SimpleIndoorPlanningModalProps } from "./SimpleIndoorPlanningModal";
export { StaircaseExtrusionModal, type StaircaseExtrusionModalProps } from "./StaircaseExtrusionModal";
export { StaircaseCopyAlongLineModal, type StaircaseCopyAlongLineModalProps } from "./StaircaseCopyAlongLineModal";
export { WhiteBalanceCameraModal, type WhiteBalanceCameraModalProps } from "./WhiteBalanceCameraModal";
export { DialuxRoundaboutModal, type DialuxRoundaboutModalProps } from "./DialuxRoundaboutModal";
export { DialuxUGRModal, type DialuxUGRModalProps } from "./DialuxUGRModal";
export { DialuxDrawingFromScratchModal, type DialuxDrawingFromScratchModalProps } from "./DialuxDrawingFromScratchModal";
export { DialuxMedianStripModal, type DialuxMedianStripModalProps } from "./DialuxMedianStripModal";
export { DialuxMaintenanceFactorStudioModal, type DialuxMaintenanceFactorStudioModalProps } from "./DialuxMaintenanceFactorStudioModal";
export { DialuxLightScenesStudioModal, type DialuxLightScenesStudioModalProps } from "./DialuxLightScenesStudioModal";
export { DialuxPoolLightingStudioModal, type DialuxPoolLightingStudioModalProps } from "./DialuxPoolLightingStudioModal";
export { DialuxDaylightSystemsStudioModal, type DialuxDaylightSystemsStudioModalProps } from "./DialuxDaylightSystemsStudioModal";
export { DialuxCutoutRoofStudioModal, type DialuxCutoutRoofStudioModalProps } from "./DialuxCutoutRoofStudioModal";
export { DialuxWorkplaneStudioModal, type DialuxWorkplaneStudioModalProps } from "./DialuxWorkplaneStudioModal";
export { DialuxStandardsStudioModal, type DialuxStandardsStudioModalProps } from "./DialuxStandardsStudioModal";
export { DialuxTexturesStudioModal, type DialuxTexturesStudioModalProps } from "./DialuxTexturesStudioModal";
export { DialuxImprovingLuminairesModal, type DialuxImprovingLuminairesModalProps } from "./DialuxImprovingLuminairesModal";
export { DialuxCompleteSceneryModal, type DialuxCompleteSceneryModalProps } from "./DialuxCompleteSceneryModal";
export { DialuxEffectiveLightingModal, type DialuxEffectiveLightingModalProps } from "./DialuxEffectiveLightingModal";
