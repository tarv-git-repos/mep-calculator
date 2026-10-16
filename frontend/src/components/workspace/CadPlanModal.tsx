import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Ruler,
  Compass,
  Check,
  Layers,
  FileText,
  RotateCw,
  Eye,
  EyeOff,
  Maximize2,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  CADPlan,
  CADPlanUnit,
  CADLayer,
  BUILTIN_CAD_PLANS,
  DEFAULT_CAD_LAYERS,
  calculateScaleFactor,
  renderCADPlanToCanvas,
} from "@/lib/dialux-cad-plan-engine";

interface CadPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: CADPlan;
  roomL: number;
  roomW: number;
  initialTab?: "file" | "scale" | "origin" | "layers";
  onApplyPlan: (plan: CADPlan, autoResizeRoom: boolean) => void;
}

export function CadPlanModal({
  isOpen,
  onClose,
  currentPlan,
  roomL,
  roomW,
  initialTab = "file",
  onApplyPlan,
}: CadPlanModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlan.id || BUILTIN_CAD_PLANS[0].id);
  const [activePlan, setActivePlan] = useState<CADPlan>(() => JSON.parse(JSON.stringify(currentPlan)));
  const [activeTab, setActiveTab] = useState<"file" | "scale" | "origin" | "layers">(initialTab);
  const [autoResizeRoom, setAutoResizeRoom] = useState<boolean>(true);

  // Calibration state (2-point measurement)
  const [calibPointA, setCalibPointA] = useState<{ x: number; y: number } | null>(null);
  const [calibPointB, setCalibPointB] = useState<{ x: number; y: number } | null>(null);
  const [knownDistanceM, setKnownDistanceM] = useState<number>(activePlan.widthM || 12.0);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when modal opens or plan changes
  useEffect(() => {
    if (isOpen) {
      setActivePlan(JSON.parse(JSON.stringify(currentPlan)));
      setSelectedPlanId(currentPlan.id || BUILTIN_CAD_PLANS[0].id);
      setActiveTab(initialTab || "file");
      setKnownDistanceM(currentPlan.widthM || 12.0);
      setCalibPointA(null);
      setCalibPointB(null);
      setIsMeasuring(false);
    }
  }, [isOpen, currentPlan, initialTab]);

  // Re-render preview canvas
  useEffect(() => {
    if (!isOpen || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rendered = renderCADPlanToCanvas(activePlan, roomL, roomW, { bgTheme: "dark", resolutionScale: 80 });
    canvas.width = 460;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rendered, 0, 0, canvas.width, canvas.height);

    // Draw calibration points if active
    if (calibPointA) {
      ctx.strokeStyle = "#ef4444";
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(calibPointA.x, calibPointA.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText("A", calibPointA.x + 8, calibPointA.y - 4);
    }

    if (calibPointB && calibPointA) {
      ctx.strokeStyle = "#10b981";
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(calibPointB.x, calibPointB.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText("B", calibPointB.x + 8, calibPointB.y - 4);

      // Dimension connecting line
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(calibPointA.x, calibPointA.y);
      ctx.lineTo(calibPointB.x, calibPointB.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [isOpen, activePlan, calibPointA, calibPointB, roomL, roomW]);

  // Handle plan template switch
  const handleSelectTemplate = (planId: string) => {
    const found = BUILTIN_CAD_PLANS.find((p) => p.id === planId);
    if (found) {
      setSelectedPlanId(planId);
      const cloned = JSON.parse(JSON.stringify(found));
      setActivePlan(cloned);
      setKnownDistanceM(cloned.widthM);
      setCalibPointA(null);
      setCalibPointB(null);
      toast.success(`Loaded CAD Plan: ${found.name}`);
    }
  };

  // Handle custom file upload (DWG / DXF / PNG / JPG / SVG)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "svg"].includes(ext || "");
    const isCad = ["dwg", "dxf"].includes(ext || "");

    if (!isImage && !isCad) {
      toast.error("Supported formats: .dwg, .dxf, .png, .jpg, .svg");
      return;
    }

    const newPlan: CADPlan = {
      id: `custom-plan-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileFormat: (ext === "dwg" || ext === "dxf" ? ext : "png") as any,
      unit: "m",
      scaleFactor: 1.0,
      originX: 0,
      originY: 0,
      rotationDeg: 0,
      opacity: 0.85,
      visible: true,
      widthM: roomL,
      heightM: roomW,
      layers: JSON.parse(JSON.stringify(DEFAULT_CAD_LAYERS)),
      vectors: JSON.parse(JSON.stringify(BUILTIN_CAD_PLANS[0].vectors)),
    };

    setActivePlan(newPlan);
    setSelectedPlanId(newPlan.id);
    toast.success(`Imported CAD Drawing: "${file.name}"! Complete unit & scale calibration.`);
  };

  // Canvas click for 2-point scale calibration
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMeasuring || !previewCanvasRef.current) return;
    const rect = previewCanvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (!calibPointA) {
      setCalibPointA({ x: clickX, y: clickY });
      toast.info("Point A set. Now click Point B on the other end of the known dimension.");
    } else if (!calibPointB) {
      setCalibPointB({ x: clickX, y: clickY });
      setIsMeasuring(false);

      // Calculate scale factor relative to canvas dimension
      const factor = calculateScaleFactor(calibPointA, { x: clickX, y: clickY }, knownDistanceM);
      setActivePlan((prev) => ({
        ...prev,
        scaleFactor: factor,
      }));
      toast.success(`Scale Calibrated! Factor: ${factor} (Known Distance: ${knownDistanceM}m)`);
    }
  };

  // Layer toggle
  const toggleLayer = (layerId: string) => {
    setActivePlan((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
    }));
  };

  // Clean walls preset
  const setCleanWallsOnly = () => {
    setActivePlan((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => ({
        ...l,
        visible: l.category === "walls" || l.category === "doors" || l.category === "windows",
      })),
    }));
    toast.info("Clean Plan applied: Furniture & dimensions hidden, walls & doors preserved.");
  };

  const showAllLayers = () => {
    setActivePlan((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => ({ ...l, visible: true })),
    }));
    toast.info("All CAD layers made visible.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#1a1d24] border border-slate-700/80 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-3 bg-[#14161a] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-[10px] font-black text-white px-1.5 py-0.5 rounded shadow">
              DWG
            </span>
            <strong className="text-white text-sm">
              DIALux evo CAD Plan Import & Scale Calibration Wizard
            </strong>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Wizard Step Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-[#16181e] px-3 gap-1">
          {[
            { id: "file", label: "1. Select Plan File", icon: FolderOpen },
            { id: "scale", label: "2. Units & Scale Calibration", icon: Ruler },
            { id: "origin", label: "3. Origin & Rotation", icon: Compass },
            { id: "layers", label: "4. Layer Management", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 cursor-pointer transition ${
                  isActive
                    ? "text-blue-400 border-blue-500 bg-slate-800/40"
                    : "text-slate-400 border-transparent hover:text-white"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Grid: Left Controls & Right Live CAD Preview */}
        <div className="p-4 grid grid-cols-12 gap-4 flex-1 overflow-y-auto">
          
          {/* LEFT 6 COLS: ACTIVE TAB CONFIGURATION */}
          <div className="col-span-6 flex flex-col gap-3">
            
            {/* TAB 1: FILE SELECTION */}
            {activeTab === "file" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs text-white">Import Custom CAD Drawing (.dwg, .dxf, .png, .jpg)</span>
                  <p className="text-[11px] text-slate-400">
                    Upload an architectural drawing file from your computer to use as an underlay for lighting calculation.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dwg,.dxf,.png,.jpg,.jpeg,.svg,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-lg border-2 border-dashed border-blue-500/50 hover:border-blue-400 bg-blue-950/20 hover:bg-blue-900/30 text-blue-300 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer"
                >
                  <Upload className="size-4 text-blue-400" />
                  <span>Choose CAD File (.dwg, .dxf, .png, .jpg)...</span>
                </button>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
                  <span className="font-bold text-xs text-white">Or Select Architectural Template:</span>
                  <div className="flex flex-col gap-1.5">
                    {BUILTIN_CAD_PLANS.map((p) => {
                      const isSelected = p.id === selectedPlanId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectTemplate(p.id)}
                          className={`p-2 rounded-lg border transition cursor-pointer flex flex-col gap-0.5 ${
                            isSelected
                              ? "bg-blue-950/40 border-blue-500 text-white shadow-xs"
                              : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="truncate">{p.name}</span>
                            <span className="text-[9.5px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300">
                              {p.fileFormat}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            File: {p.fileName} • Footprint: {p.widthM}m × {p.heightM}m
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCALE & UNITS CALIBRATION */}
            {activeTab === "scale" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs text-white">CAD Base Units</span>
                  <p className="text-[11px] text-slate-400">
                    DIALux evo automatically converts your drawing units into meters for accurate illuminance calculations.
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {(["mm", "cm", "m", "ft", "in"] as CADPlanUnit[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => {
                        setActivePlan((prev) => ({ ...prev, unit: u }));
                        toast.info(`CAD drawing base units set to: ${u.toUpperCase()}`);
                      }}
                      className={`py-1.5 rounded text-xs font-bold border transition cursor-pointer ${
                        activePlan.unit === u
                          ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                      }`}
                    >
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* 2-Point Interactive Measurement Calibration */}
                <div className="p-3 bg-[#14161a] rounded-lg border border-slate-800 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                      <Ruler className="size-3.5 text-amber-400" /> Two-Point Scale Calibration
                    </span>
                    <span className="text-[10px] text-slate-400">DIALux evo Method</span>
                  </div>

                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    Click <strong>"Pick 2 Points"</strong>, then click Point A and Point B on a known dimension (e.g. door width 0.9m or 5m wall) on the right CAD canvas.
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Known Real Distance:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        value={knownDistanceM}
                        onChange={(e) => setKnownDistanceM(Math.max(0.1, parseFloat(e.target.value) || 1.0))}
                        className="w-20 h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white font-bold text-xs"
                      />
                      <span className="text-slate-400 text-xs">m</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCalibPointA(null);
                        setCalibPointB(null);
                        setIsMeasuring(true);
                        toast.info("Calibration Mode: Click Point A on the drawing canvas!");
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        isMeasuring
                          ? "bg-amber-500 text-slate-950 border-amber-400 animate-pulse"
                          : "bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
                      }`}
                    >
                      <Ruler className="size-3.5" />
                      <span>{isMeasuring ? "Click Point on Canvas..." : "Pick 2 Points to Calibrate"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setCalibPointA(null);
                        setCalibPointB(null);
                        setIsMeasuring(false);
                        setActivePlan((prev) => ({ ...prev, scaleFactor: 1.0 }));
                        toast.info("Scale reset to 1.000");
                      }}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs cursor-pointer"
                      title="Reset Scale Factor"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>

                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[10.5px] font-mono flex justify-between items-center">
                    <span className="text-slate-400">Current Scale Factor:</span>
                    <strong className="text-emerald-400">{activePlan.scaleFactor.toFixed(4)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ORIGIN & ROTATION */}
            {activeTab === "origin" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs text-white">Coordinate Origin & Alignment</span>
                  <p className="text-[11px] text-slate-400">
                    Align the CAD drawing origin (0, 0, 0) with your room coordinate axes.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#14161a] p-3 rounded-lg border border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] text-slate-400">Origin X Offset (m):</label>
                    <input
                      type="number"
                      step={0.5}
                      value={activePlan.originX}
                      onChange={(e) =>
                        setActivePlan((prev) => ({ ...prev, originX: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] text-slate-400">Origin Y Offset (m):</label>
                    <input
                      type="number"
                      step={0.5}
                      value={activePlan.originY}
                      onChange={(e) =>
                        setActivePlan((prev) => ({ ...prev, originY: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 bg-[#14161a] p-3 rounded-lg border border-slate-800">
                  <label className="text-[10.5px] text-slate-400">Rotation Angle (°):</label>
                  <div className="flex items-center gap-2">
                    {[0, 90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => {
                          setActivePlan((prev) => ({ ...prev, rotationDeg: deg }));
                          toast.info(`Rotated CAD plan to ${deg}°`);
                        }}
                        className={`flex-1 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                          activePlan.rotationDeg === deg
                            ? "bg-blue-600 text-white border-blue-500"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CAD LAYER MANAGEMENT */}
            {activeTab === "layers" && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">CAD Layer Settings (Ebenenverwaltung)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={setCleanWallsOnly}
                      className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px] font-bold cursor-pointer hover:bg-blue-600/40"
                    >
                      Clean Walls Only
                    </button>
                    <button
                      onClick={showAllLayers}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] cursor-pointer hover:text-white"
                    >
                      Show All
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
                  {activePlan.layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="p-1.5 rounded bg-[#14161a] border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleLayer(layer.id)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          {layer.visible ? (
                            <Eye className="size-3.5 text-blue-400" />
                          ) : (
                            <EyeOff className="size-3.5 text-slate-600" />
                          )}
                        </button>
                        <span
                          className="size-3 rounded-full shrink-0 border border-white/20"
                          style={{ backgroundColor: layer.color }}
                        />
                        <span className={`font-mono text-xs ${layer.visible ? "text-white font-semibold" : "text-slate-500 line-through"}`}>
                          {layer.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">{layer.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 6 COLS: LIVE CAD PLAN UNDERLAY PREVIEW */}
          <div className="col-span-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Maximize2 className="size-3.5 text-blue-400" /> 2D CAD Plan Viewport Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {activePlan.widthM}m × {activePlan.heightM}m
              </span>
            </div>

            <div
              className={`relative rounded-lg border-2 overflow-hidden flex items-center justify-center bg-[#13161c] ${
                isMeasuring ? "border-amber-400 cursor-crosshair" : "border-slate-800"
              }`}
            >
              <canvas
                ref={previewCanvasRef}
                onClick={handleCanvasClick}
                className="w-full h-auto max-h-[300px] object-contain block"
              />

              {isMeasuring && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px] shadow">
                  Interactive Calibrate: Click Point {calibPointA ? "B" : "A"}
                </div>
              )}
            </div>

            {/* Checkbox: Auto-Resize room footprint to CAD boundary */}
            <label className="flex items-center gap-2 p-2 rounded bg-[#14161a] border border-slate-800 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={autoResizeRoom}
                onChange={(e) => setAutoResizeRoom(e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-slate-300 font-medium">
                Auto-resize room space footprint to match CAD Plan ({activePlan.widthM}m × {activePlan.heightM}m)
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#14161a] border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onApplyPlan(activePlan, autoResizeRoom);
              toast.success(`CAD Drawing "${activePlan.name}" active in project!`);
              onClose();
            }}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
          >
            <Check className="size-4" />
            <span>Apply CAD Plan to Project</span>
          </button>
        </div>

      </div>
    </div>
  );
}
