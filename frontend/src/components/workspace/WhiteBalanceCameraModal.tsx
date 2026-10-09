import React, { useState, useMemo } from "react";
import {
  X,
  Sun,
  Camera,
  Crosshair,
  Sliders,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  Trash2,
  Compass,
  Pipette,
  Eye,
  Bookmark,
  Keyboard,
  Layers,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { SavedCameraViewpoint } from "./DialuxConstructionModals";

export interface WhiteBalanceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  whiteBalanceMode: "auto" | "manual";
  setWhiteBalanceMode: (m: "auto" | "manual") => void;
  whiteBalanceKelvin: number;
  setWhiteBalanceKelvin: (k: number) => void;
  whiteBalanceExposure: number;
  setWhiteBalanceExposure: (ev: number) => void;
  whiteBalanceTint?: number;
  setWhiteBalanceTint?: (tint: number) => void;
  savedViews: SavedCameraViewpoint[];
  onSaveSlot: (slot: number, name?: string) => void;
  onApplySlot: (slot: number) => void;
  onDeleteView: (id: string) => void;
  onSaveCurrentView: (name: string) => void;
  onApplySavedView: (view: SavedCameraViewpoint) => void;
  cameraView: string;
  onApplyCameraView: (v: string) => void;
  currentPivot: { x: number; y: number; z: number };
  onSetPivot: (x: number, y: number, z: number) => void;
  isPickingPivot: boolean;
  setIsPickingPivot: (v: boolean) => void;
  isPickingWhitePoint: boolean;
  setIsPickingWhitePoint: (v: boolean) => void;
  roomLength: number;
  roomWidth: number;
  roomHeight: number;
}

export const KELVIN_PRESETS: Array<{
  kelvin: number;
  label: string;
  category: string;
  colorHex: string;
  description: string;
}> = [
  {
    kelvin: 1900,
    label: "1900K Candlelight",
    category: "Flame",
    colorHex: "#ff8912",
    description: "Atmospheric flame, ultra-warm decorative glow",
  },
  {
    kelvin: 2700,
    label: "2700K Incandescent",
    category: "Residential",
    colorHex: "#ffa757",
    description: "Standard warm domestic incandescent and soft LED",
  },
  {
    kelvin: 3000,
    label: "3000K Warm White",
    category: "Hospitality",
    colorHex: "#ffc184",
    description: "Commercial warm LED, hotel rooms, dining areas",
  },
  {
    kelvin: 3200,
    label: "3200K Halogen",
    category: "Studio",
    colorHex: "#ffc993",
    description: "Tungsten halogen studio floodlight",
  },
  {
    kelvin: 4000,
    label: "4000K Neutral White",
    category: "Commercial",
    colorHex: "#ffe3cb",
    description: "Office, retail and educational standard neutral",
  },
  {
    kelvin: 5000,
    label: "5000K Daylight White",
    category: "Industrial",
    colorHex: "#fbf3ff",
    description: "Crisp daylight illumination for healthcare & cleanrooms",
  },
  {
    kelvin: 6500,
    label: "6500K Overcast D65",
    category: "CIE Standard",
    colorHex: "#dbe8ff",
    description: "Standard midday overcast daylight reference white",
  },
  {
    kelvin: 9000,
    label: "9000K Clear Blue Sky",
    category: "Atmospheric",
    colorHex: "#a6c8ff",
    description: "Deep north sky ambient light with strong blue component",
  },
];

export function WhiteBalanceCameraModal({
  isOpen,
  onClose,
  whiteBalanceMode,
  setWhiteBalanceMode,
  whiteBalanceKelvin,
  setWhiteBalanceKelvin,
  whiteBalanceExposure,
  setWhiteBalanceExposure,
  whiteBalanceTint = 0,
  setWhiteBalanceTint,
  savedViews,
  onSaveSlot,
  onApplySlot,
  onDeleteView,
  onSaveCurrentView,
  onApplySavedView,
  cameraView,
  onApplyCameraView,
  currentPivot,
  onSetPivot,
  isPickingPivot,
  setIsPickingPivot,
  isPickingWhitePoint,
  setIsPickingWhitePoint,
  roomLength,
  roomWidth,
  roomHeight,
}: WhiteBalanceCameraModalProps) {
  const [activeTab, setActiveTab] = useState<"whitebalance" | "slots" | "pivot" | "shortcuts">("whitebalance");
  const [customViewName, setCustomViewName] = useState("");

  if (!isOpen) return null;

  // Build slot lookup map (slots 1 to 9)
  const slotMap = useMemo(() => {
    const map = new Map<number, SavedCameraViewpoint>();
    savedViews.forEach((v) => {
      if (v.slot && v.slot >= 1 && v.slot <= 9) {
        map.set(v.slot, v);
      }
    });
    return map;
  }, [savedViews]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[85vh] bg-[#14161a] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-[#1b1f26] border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400">
              <Camera className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                DIALux evo Tutorial Part 15: White Balance, Camera Positions & Pivoting Point
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                  Workflow Mastery
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kelvin chromatic adaptation, Ctrl/Alt [1-9] camera memory slots, WASD walkthrough, and interactive pivot point targeting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-5 bg-[#171a20] border-b border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("whitebalance")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "whitebalance"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sun className="size-3.5" />
            1. White Balance & Exposure
          </button>
          <button
            onClick={() => setActiveTab("slots")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "slots"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bookmark className="size-3.5" />
            2. Camera Positions (Ctrl+1..9)
          </button>
          <button
            onClick={() => setActiveTab("pivot")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "pivot"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Crosshair className="size-3.5" />
            3. Pivoting Point & Center of Rotation
          </button>
          <button
            onClick={() => setActiveTab("shortcuts")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "shortcuts"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Keyboard className="size-3.5" />
            4. Keyboard Navigation Cheatsheet
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* =============================================================== */}
          {/* TAB 1: WHITE BALANCE & EXPOSURE                                 */}
          {/* =============================================================== */}
          {activeTab === "whitebalance" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Controls */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                  <Info className="size-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Why White Balance matters in DIALux evo (Tutorial 15):</strong> Scenes lit with warm 2700K lamps can appear excessively orange on computer screens, while daylight can look overly blue. Adjusting the white balance neutralizes the dominant illuminant, displaying surfaces as true architectural white.
                  </p>
                </div>

                {/* Mode Selector */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-amber-400" /> Adaptation Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setWhiteBalanceMode("auto")}
                      className={`py-2 rounded border font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                        whiteBalanceMode === "auto"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-700/50"
                      }`}
                    >
                      <Sparkles className="size-3.5 text-amber-400" />
                      Automatic (D65 Neutral 6500K)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhiteBalanceMode("manual")}
                      className={`py-2 rounded border font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                        whiteBalanceMode === "manual"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-700/50"
                      }`}
                    >
                      <Sliders className="size-3.5 text-amber-400" />
                      Manual Kelvin Tuning
                    </button>
                  </div>
                </div>

                {/* Kelvin Slider & Eyedropper Pipette */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sun className="size-3.5 text-amber-400" /> Color Temperature (Kelvin)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-mono font-bold text-amber-400">
                        {whiteBalanceKelvin} K
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPickingWhitePoint(!isPickingWhitePoint);
                          if (!isPickingWhitePoint) {
                            toast.info("Click any surface in the 3D viewport to sample as white point");
                            onClose();
                          }
                        }}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                          isPickingWhitePoint
                            ? "bg-red-600 text-white border-red-500 animate-pulse"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                        }`}
                      >
                        <Pipette className="size-3 text-amber-400" />
                        {isPickingWhitePoint ? "Cancel Picker" : "Pipette (Pick Surface)"}
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={2000}
                    max={10000}
                    step={100}
                    disabled={whiteBalanceMode === "auto"}
                    value={whiteBalanceKelvin}
                    onChange={(e) => {
                      setWhiteBalanceMode("manual");
                      setWhiteBalanceKelvin(parseInt(e.target.value) || 4000);
                    }}
                    className="w-full accent-amber-500 cursor-pointer disabled:opacity-40"
                  />

                  {/* Kelvin Presets Grid */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 text-xs">
                    {KELVIN_PRESETS.map((p) => {
                      const isSelected = whiteBalanceKelvin === p.kelvin && whiteBalanceMode === "manual";
                      return (
                        <button
                          key={p.kelvin}
                          type="button"
                          onClick={() => {
                            setWhiteBalanceMode("manual");
                            setWhiteBalanceKelvin(p.kelvin);
                          }}
                          className={`p-1.5 rounded border text-left cursor-pointer transition ${
                            isSelected
                              ? "bg-amber-600/30 border-amber-500 text-white font-bold"
                              : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-semibold">{p.kelvin}K</span>
                            <span
                              className="size-2 rounded-full border border-slate-700"
                              style={{ backgroundColor: p.colorHex }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 block truncate">{p.category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exposure Compensation */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sun className="size-3.5 text-cyan-400" /> Exposure Compensation (EV)
                    </span>
                    <span className="text-sm font-mono font-bold text-cyan-400">
                      {whiteBalanceExposure > 0 ? `+${whiteBalanceExposure.toFixed(1)}` : whiteBalanceExposure.toFixed(1)} EV
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-3.0}
                    max={3.0}
                    step={0.1}
                    value={whiteBalanceExposure}
                    onChange={(e) => setWhiteBalanceExposure(parseFloat(e.target.value) || 0)}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>-3.0 EV (Darker)</span>
                    <button
                      type="button"
                      onClick={() => setWhiteBalanceExposure(0.0)}
                      className="text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Reset to 0.0 EV
                    </button>
                    <span>+3.0 EV (Brighter)</span>
                  </div>
                </div>

                {/* Tint Balance (Green - Magenta) */}
                {setWhiteBalanceTint && (
                  <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        Color Tint Balance (Green - Magenta)
                      </span>
                      <span className="text-xs font-mono font-bold text-purple-400">
                        {whiteBalanceTint > 0 ? `+${whiteBalanceTint}` : whiteBalanceTint}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={1}
                      value={whiteBalanceTint}
                      onChange={(e) => setWhiteBalanceTint(parseInt(e.target.value) || 0)}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Educational Reference Swatches */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-300">Kelvin Temperature Scale Guide</span>
                <div className="flex flex-col gap-2 bg-[#191c22] border border-slate-800 rounded-lg p-3">
                  {KELVIN_PRESETS.map((p) => (
                    <div key={p.kelvin} className="flex items-center gap-2.5 text-xs py-1 border-b border-slate-800/60 last:border-0">
                      <div
                        className="size-6 rounded-md border border-slate-700/80 shrink-0 shadow-xs"
                        style={{ backgroundColor: p.colorHex }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{p.label}</span>
                          <span className="text-[10px] text-slate-400">{p.category}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">{p.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs flex flex-col gap-1.5">
                  <span className="font-bold text-emerald-400">Tutorial 15 Pro-Tip:</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Set the white balance to match your luminaires' CCT. When lighting a space with 3000K warm fixtures, setting white balance to 3000K ensures your white walls render as clean white while colored furniture retains natural saturation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: CAMERA POSITION MEMORY SLOTS (1-9)                       */}
          {/* =============================================================== */}
          {activeTab === "slots" && (
            <div className="flex flex-col gap-5">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300 flex items-start gap-2.5">
                <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Quick Keyboard Memory Slots (Tutorial 15):</strong> Save the current view to any slot with <strong>Ctrl + [1-9]</strong>. Recall that viewpoint at any time by pressing <strong>Alt + [1-9]</strong>.
                </p>
              </div>

              {/* 9 Memory Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slotNum) => {
                  const saved = slotMap.get(slotNum);
                  return (
                    <div
                      key={slotNum}
                      className={`p-3 rounded-lg border flex flex-col justify-between gap-2.5 transition ${
                        saved
                          ? "bg-slate-900 border-amber-600/50 shadow-md"
                          : "bg-[#181a20] border-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-6 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold text-xs flex items-center justify-center">
                            {slotNum}
                          </span>
                          <div>
                            <span className="font-semibold text-xs text-white block">
                              {saved ? saved.name : `Empty Slot ${slotNum}`}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {saved
                                ? `(${saved.posX.toFixed(1)}, ${saved.posY.toFixed(1)}, ${saved.posZ.toFixed(1)})`
                                : "Unassigned"}
                            </span>
                          </div>
                        </div>
                        {saved && (
                          <button
                            type="button"
                            onClick={() => onDeleteView(saved.id)}
                            className="text-slate-500 hover:text-red-400 cursor-pointer p-1"
                            title="Clear slot"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSaveSlot(slotNum, `Camera View ${slotNum}`);
                            toast.success(`Saved camera position to Slot ${slotNum} (Ctrl+${slotNum})`);
                          }}
                          className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Bookmark className="size-3 text-amber-400" />
                          Save (Ctrl+{slotNum})
                        </button>
                        <button
                          type="button"
                          disabled={!saved}
                          onClick={() => {
                            onApplySlot(slotNum);
                            toast.info(`Switched to Camera Slot ${slotNum} (Alt+${slotNum})`);
                            onClose();
                          }}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                            saved
                              ? "bg-amber-600 hover:bg-amber-500 text-white font-bold"
                              : "bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed"
                          }`}
                        >
                          <Eye className="size-3" />
                          Recall (Alt+{slotNum})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Predefined Architectural Views */}
              <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="size-3.5 text-amber-400" /> Standard Architectural Orthographic Views
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  {[
                    { id: "top", label: "Top (Plan)", sub: "Alt+7" },
                    { id: "front", label: "Front (South)", sub: "Alt+1" },
                    { id: "side", label: "Side (East)", sub: "Alt+3" },
                    { id: "back", label: "Back (North)", sub: "Elevation" },
                    { id: "left", label: "Left (West)", sub: "Elevation" },
                    { id: "first_person", label: "Eye-Level (1.7m)", sub: "Walkthrough" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onApplyCameraView(v.id);
                        onClose();
                      }}
                      className={`p-2 rounded border text-center cursor-pointer transition ${
                        cameraView === v.id
                          ? "bg-amber-600/30 border-amber-500 text-white font-bold"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span className="block font-semibold text-[11px]">{v.label}</span>
                      <span className="text-[9.5px] text-slate-400">{v.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: PIVOTING POINT & ROTATION CENTER                         */}
          {/* =============================================================== */}
          {activeTab === "pivot" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                  <Info className="size-4 text-amber-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Pivoting Point in DIALux evo (Tutorial 15):</strong> By default, the 3D camera orbits around the geometric center of the room. Holding <strong>Ctrl</strong> and clicking or using the mouse wheel on any surface sets that exact point as the new pivoting center of rotation.
                  </p>
                </div>

                {/* Current Pivot Coordinates */}
                <div className="p-4 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Crosshair className="size-4 text-amber-400" /> Current Pivot Target Point
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPickingPivot(true);
                        toast.info("Click anywhere in the 3D scene to place the new rotation pivot point");
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Crosshair className="size-3.5" />
                      Pick Pivot Point (Ctrl+Click)
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-400 block">Pivot X (East-West)</span>
                      <span className="text-base font-mono font-bold text-white mt-0.5 block">
                        {currentPivot.x.toFixed(2)} m
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-400 block">Pivot Y (Elevation)</span>
                      <span className="text-base font-mono font-bold text-emerald-400 mt-0.5 block">
                        {currentPivot.y.toFixed(2)} m
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-400 block">Pivot Z (North-South)</span>
                      <span className="text-base font-mono font-bold text-blue-400 mt-0.5 block">
                        {currentPivot.z.toFixed(2)} m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Presets for Pivot */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Quick Center Presets
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onSetPivot(roomLength / 2, roomHeight / 2, roomWidth / 2);
                        toast.success("Pivot set to Room Centroid");
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 cursor-pointer text-left"
                    >
                      <span className="block font-semibold">Room Centroid</span>
                      <span className="text-[10px] text-slate-400">Center of volume</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetPivot(roomLength / 2, 0.75, roomWidth / 2);
                        toast.success("Pivot set to Workplane Center (0.75m)");
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 cursor-pointer text-left"
                    >
                      <span className="block font-semibold">Workplane Center</span>
                      <span className="text-[10px] text-slate-400">Desk level 0.75m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetPivot(0, 0, 0);
                        toast.success("Pivot set to World Origin (0, 0, 0)");
                      }}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 cursor-pointer text-left"
                    >
                      <span className="block font-semibold">World Origin (0,0)</span>
                      <span className="text-[10px] text-slate-400">Corner datum</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Visual Pivot Illustration */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-300">How to use the Pivot Point</span>
                <div className="p-4 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-3 text-xs text-slate-400 leading-relaxed">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                      1
                    </div>
                    <div>
                      <strong className="text-white block">Hold Ctrl + Mouse Click:</strong>
                      Click on any desk, step, wall, or light fixture in the CAD view to immediately center your camera rotation on it.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                      2
                    </div>
                    <div>
                      <strong className="text-white block">Orbit Orbit Orbit:</strong>
                      Left-drag with your mouse will now tumble smoothly around that targeted inspection point without drifting away.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: KEYBOARD SHORTCUTS CHEATSHEET                             */}
          {/* =============================================================== */}
          {activeTab === "shortcuts" && (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                <Keyboard className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Full keyboard navigation shortcuts supported across our 3D engine, strictly matching the official DIALux evo specification.
                </p>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#191c22]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#12141a] text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 w-48">Shortcut</th>
                      <th className="p-2.5">Function</th>
                      <th className="p-2.5">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-amber-400">Ctrl + [1 - 9]</td>
                      <td className="p-2.5 font-semibold text-white">Save Camera View to Slot 1 - 9</td>
                      <td className="p-2.5 text-slate-400">Memory Slots</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-amber-400">Alt + [1 - 9]</td>
                      <td className="p-2.5 font-semibold text-white">Recall Camera View from Slot 1 - 9</td>
                      <td className="p-2.5 text-slate-400">Memory Slots</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-emerald-400">Ctrl + Click / Wheel</td>
                      <td className="p-2.5">Set Center of Rotation (Pivoting Point)</td>
                      <td className="p-2.5 text-slate-400">Pivot Control</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-cyan-400">W / S</td>
                      <td className="p-2.5">Walk Forward / Backward</td>
                      <td className="p-2.5 text-slate-400">Walkthrough</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-cyan-400">A / D</td>
                      <td className="p-2.5">Strafe Left / Right</td>
                      <td className="p-2.5 text-slate-400">Walkthrough</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-cyan-400">Q / E</td>
                      <td className="p-2.5">Elevation Down / Up</td>
                      <td className="p-2.5 text-slate-400">Walkthrough</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-blue-400">Shift + WASD</td>
                      <td className="p-2.5">Sprint / 2.5x Walk Speed</td>
                      <td className="p-2.5 text-slate-400">Walkthrough</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono font-bold text-purple-400">F2 - F10</td>
                      <td className="p-2.5">Toggle Visual Aids (Axes, Working Plane, Wireframe, Heatmap)</td>
                      <td className="p-2.5 text-slate-400">Display Options</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 bg-[#1b1f26] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">DIALux evo Tutorial Part 15</span>
            <span>•</span>
            <span>White Balance, Camera Positions & Pivoting Point</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
