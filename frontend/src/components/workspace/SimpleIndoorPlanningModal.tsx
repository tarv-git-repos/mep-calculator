import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Zap,
  Building,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  Sliders,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Compass,
  ArrowRight,
  Info,
  ChevronRight,
  Grid,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  LuminairePhotometricProfile,
  BUILTIN_PHOTOMETRIC_PROFILES,
  computeSpaceAutoArrangement,
  runPointByPointSimulation,
  DialuxSimulationResult,
  SurfaceReflectances,
  STANDARD_REFLECTANCE_PRESETS,
} from "@/lib/dialux-photometrics-engine";
import { exportSimpleIndoorPlanningPDF } from "@/lib/exportDialuxReportPDF";

export interface SimpleIndoorPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoomName?: string;
  initialLength?: number;
  initialWidth?: number;
  initialHeight?: number;
  initialTargetLux?: number;
  initialMf?: number;
  projectName?: string;
  projectCode?: string;
  userName?: string;
  onApplyTo3DView?: (settings: {
    roomName: string;
    length: number;
    width: number;
    height: number;
    workPlaneHeight: number;
    marginOffset: number;
    targetLux: number;
    profile: LuminairePhotometricProfile;
    rows: number;
    cols: number;
    mf: number;
    reflectances: SurfaceReflectances;
  }) => void;
  onApplyToSchedule?: (result: {
    quantity: number;
    rows: number;
    cols: number;
    achievedLux: number;
    targetLux: number;
    uniformityU0: number;
    powerW: number;
    lightType: string;
    remarks: string;
  }) => void;
}

// EN 12464-1 Utilization Profiles matching DIALux evo Tutorial Part 12
export interface UsageProfileOption {
  id: string;
  category: string;
  name: string;
  targetLux: number;
  minU0: number;
  workPlaneHeight: number;
  wallZoneMargin: number;
  recommendedLuminaireIdx: number;
  defaultOperatingCondition: "rather_dirty" | "clean" | "very_dirty";
  description: string;
}

export const USAGE_PROFILES: UsageProfileOption[] = [
  {
    id: "vehicle_repair",
    category: "Workshops & Craft Businesses",
    name: "Vehicle repair, testing & inspection",
    targetLux: 300,
    minU0: 0.60,
    workPlaneHeight: 0.80,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 4, // Trilux Nextrema IP65 Batten
    defaultOperatingCondition: "rather_dirty",
    description: "Standard workshop for vehicle maintenance, pits, and general mechanical repair.",
  },
  {
    id: "vehicle_bodywork",
    category: "Workshops & Craft Businesses",
    name: "Vehicle body work and painting",
    targetLux: 500,
    minU0: 0.60,
    workPlaneHeight: 0.80,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 4,
    defaultOperatingCondition: "rather_dirty",
    description: "Precision spray painting, inspection, welding and body repair.",
  },
  {
    id: "storage_manned",
    category: "Warehouses & Logistics",
    name: "Storage bays: Continuously manned",
    targetLux: 200,
    minU0: 0.40,
    workPlaneHeight: 0.75,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 2, // Thorn Linear Batten
    defaultOperatingCondition: "rather_dirty",
    description: "Active warehouse bays, packing tables, and forklift loading aisles.",
  },
  {
    id: "storage_racks",
    category: "Warehouses & Logistics",
    name: "Store rooms & Stock bays (Unmanned)",
    targetLux: 100,
    minU0: 0.40,
    workPlaneHeight: 0.00,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 2,
    defaultOperatingCondition: "rather_dirty",
    description: "Occasional access inventory storage, archive racks, and equipment storage.",
  },
  {
    id: "office_standard",
    category: "Offices & Administration",
    name: "Writing, typing, reading & data processing",
    targetLux: 500,
    minU0: 0.60,
    workPlaneHeight: 0.75,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 0, // Philips CoreLine 600x600
    defaultOperatingCondition: "clean",
    description: "EN 12464-1 standard office environment with computer monitors and paper reading.",
  },
  {
    id: "office_meeting",
    category: "Offices & Administration",
    name: "Conference & Meeting rooms",
    targetLux: 500,
    minU0: 0.60,
    workPlaneHeight: 0.75,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 0,
    defaultOperatingCondition: "clean",
    description: "Meeting spaces, executive conference rooms, and presentations.",
  },
  {
    id: "classroom",
    category: "Educational Buildings",
    name: "Classrooms & Tutorial rooms",
    targetLux: 500,
    minU0: 0.60,
    workPlaneHeight: 0.75,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 0,
    defaultOperatingCondition: "clean",
    description: "General school classrooms, blackboard lighting, and university seminar rooms.",
  },
  {
    id: "corridor",
    category: "Circulation & Corridors",
    name: "Corridors & Circulation areas",
    targetLux: 100,
    minU0: 0.40,
    workPlaneHeight: 0.00,
    wallZoneMargin: 0.30,
    recommendedLuminaireIdx: 1, // Zumtobel Downlight
    defaultOperatingCondition: "clean",
    description: "Building circulation paths, exit corridors, and lobbies.",
  },
  {
    id: "plant_room",
    category: "Technical Services",
    name: "Plant rooms, boiler houses & switchgear",
    targetLux: 200,
    minU0: 0.40,
    workPlaneHeight: 0.00,
    wallZoneMargin: 0.50,
    recommendedLuminaireIdx: 4,
    defaultOperatingCondition: "rather_dirty",
    description: "MEP electrical equipment rooms, pump rooms, and mechanical plants.",
  },
];

export const OPERATING_CONDITIONS = [
  {
    id: "clean",
    name: "Clean (Offices, Schools, Retail)",
    mf: 0.80,
    badge: "MF = 0.80",
    description: "Standard clean indoor environments with regular maintenance intervals.",
  },
  {
    id: "rather_dirty",
    name: "Rather Dirty (Workshops, Garages, Light Industry)",
    mf: 0.67,
    badge: "MF = 0.67",
    description: "Workshops, automotive garages, and light industrial halls per Tutorial Part 12.",
  },
  {
    id: "very_dirty",
    name: "Very Dirty (Heavy Industry, Foundries, Dusty Mills)",
    mf: 0.57,
    badge: "MF = 0.57",
    description: "Harsh environments with airborne dust, oil mist, or heavy soot accumulation.",
  },
  {
    id: "very_clean",
    name: "Very Clean (Cleanrooms, Medical Laboratories)",
    mf: 0.85,
    badge: "MF = 0.85",
    description: "HEPA-filtered cleanrooms and pharmaceutical manufacturing facilities.",
  },
];

export function SimpleIndoorPlanningModal({
  isOpen,
  onClose,
  initialRoomName = "Garage / Workshop",
  initialLength = 10,
  initialWidth = 6,
  initialHeight = 3.2,
  initialTargetLux = 300,
  initialMf = 0.67,
  projectName = "MEP Lighting Project",
  projectCode = "PRJ-001",
  userName = "Lighting Designer",
  onApplyTo3DView,
  onApplyToSchedule,
}: SimpleIndoorPlanningModalProps) {
  // Step navigation
  const [activeStep, setActiveStep] = useState<"geometry" | "profile" | "surfaces" | "luminaire" | "results">("geometry");

  // Room geometry
  const [roomName, setRoomName] = useState(initialRoomName);
  const [roomLength, setRoomLength] = useState(initialLength);
  const [roomWidth, setRoomWidth] = useState(initialWidth);
  const [roomHeight, setRoomHeight] = useState(initialHeight);

  // Task & Working Plane (DIALux evo Tutorial Part 12 standard values)
  const [workPlaneHeight, setWorkPlaneHeight] = useState(0.80); // 80 cm per video
  const [wallZoneMargin, setWallZoneMargin] = useState(0.50); // 50 cm per video

  // Profile & Standards
  const [selectedProfileId, setSelectedProfileId] = useState("vehicle_repair");
  const [targetLux, setTargetLux] = useState(initialTargetLux);

  // Surfaces Reflectances
  const [reflectancePreset, setReflectancePreset] = useState("Standard Office (70% / 50% / 20%)");
  const [rhoCeiling, setRhoCeiling] = useState(0.70);
  const [rhoWalls, setRhoWalls] = useState(0.50);
  const [rhoFloor, setRhoFloor] = useState(0.20);

  // Operating condition & Maintenance Factor
  const [operatingCondition, setOperatingCondition] = useState<"clean" | "rather_dirty" | "very_dirty" | "very_clean">("rather_dirty");
  const [mf, setMf] = useState(initialMf);
  const [isCustomMf, setIsCustomMf] = useState(false);

  // Luminaire selection
  // Default to Vapour Proof IP65 Batten (Index 4) matching the tutorial video garage example
  const [selectedProfile, setSelectedProfile] = useState<LuminairePhotometricProfile>(
    BUILTIN_PHOTOMETRIC_PROFILES[4] || BUILTIN_PHOTOMETRIC_PROFILES[0]
  );

  // Grid Layout
  const [gridRows, setGridRows] = useState(4);
  const [gridCols, setGridCols] = useState(4);
  const [suspensionLength, setSuspensionLength] = useState(0);

  // Canvas visual preview reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state when props change
  useEffect(() => {
    if (isOpen) {
      setRoomName(initialRoomName);
      setRoomLength(initialLength);
      setRoomWidth(initialWidth);
      setRoomHeight(initialHeight);
      setTargetLux(initialTargetLux);
      setMf(initialMf);
    }
  }, [isOpen, initialRoomName, initialLength, initialWidth, initialHeight, initialTargetLux, initialMf]);

  // Handle Usage Profile change
  const handleProfileSelect = (p: UsageProfileOption) => {
    setSelectedProfileId(p.id);
    setTargetLux(p.targetLux);
    setWorkPlaneHeight(p.workPlaneHeight);
    setWallZoneMargin(p.wallZoneMargin);
    setOperatingCondition(p.defaultOperatingCondition);

    const cond = OPERATING_CONDITIONS.find((c) => c.id === p.defaultOperatingCondition);
    if (cond) {
      setMf(cond.mf);
      setIsCustomMf(false);
    }

    if (BUILTIN_PHOTOMETRIC_PROFILES[p.recommendedLuminaireIdx]) {
      setSelectedProfile(BUILTIN_PHOTOMETRIC_PROFILES[p.recommendedLuminaireIdx]);
    }
  };

  // Surface reflectances preset handler
  const handleReflectancePreset = (presetName: string) => {
    setReflectancePreset(presetName);
    const p = STANDARD_REFLECTANCE_PRESETS.find((x) => x.name === presetName);
    if (p) {
      setRhoCeiling(p.ceiling);
      setRhoWalls(p.walls);
      setRhoFloor(p.floor);
    }
  };

  // Maintenance condition handler
  const handleConditionSelect = (condId: "clean" | "rather_dirty" | "very_dirty" | "very_clean") => {
    setOperatingCondition(condId);
    const cond = OPERATING_CONDITIONS.find((c) => c.id === condId);
    if (cond) {
      setMf(cond.mf);
      setIsCustomMf(false);
    }
  };

  // Automatic arrangement solver
  const solveAutomaticArrangement = () => {
    const arrangement = computeSpaceAutoArrangement({
      length: roomLength,
      width: roomWidth,
      height: roomHeight,
      targetLux,
      profile: selectedProfile,
      mf,
      reflectances: { ceiling: rhoCeiling, walls: rhoWalls, floor: rhoFloor },
      workPlaneHeight,
    });

    setGridRows(arrangement.rows);
    setGridCols(arrangement.cols);
    toast.success(`Calculated optimal arrangement: ${arrangement.rows} × ${arrangement.cols} (${arrangement.total} luminaires)`);
  };

  // Point-by-point calculation result
  const simulationResult: DialuxSimulationResult = useMemo(() => {
    return runPointByPointSimulation({
      length: roomLength,
      width: roomWidth,
      height: roomHeight,
      targetLux,
      rows: gridRows,
      cols: gridCols,
      profile: selectedProfile,
      mf,
      workPlaneHeight,
      suspensionLength,
      reflectances: { ceiling: rhoCeiling, walls: rhoWalls, floor: rhoFloor },
      marginOffset: wallZoneMargin,
      arrangementMode: "grid",
      calcAreaType: "workplane",
    });
  }, [
    roomLength,
    roomWidth,
    roomHeight,
    targetLux,
    gridRows,
    gridCols,
    selectedProfile,
    mf,
    workPlaneHeight,
    suspensionLength,
    rhoCeiling,
    rhoWalls,
    rhoFloor,
    wallZoneMargin,
  ]);

  // Geometric details
  const floorArea = roomLength * roomWidth;
  const usefulL = Math.max(0.1, roomLength - 2 * wallZoneMargin);
  const usefulW = Math.max(0.1, roomWidth - 2 * wallZoneMargin);
  const usefulArea = usefulL * usefulW;
  const spacingX = Number((roomLength / gridCols).toFixed(2));
  const spacingY = Number((roomWidth / gridRows).toFixed(2));
  const mountingH = Math.max(0.2, roomHeight - suspensionLength - workPlaneHeight);
  const shr = Number((Math.max(spacingX, spacingY) / mountingH).toFixed(2));
  const totalPowerW = simulationResult.connectedPowerW || gridRows * gridCols * selectedProfile.wattage;
  const powerDensityW = floorArea > 0 ? totalPowerW / floorArea : 0;
  const isCompliant = simulationResult.isLuxCompliant && simulationResult.isUniformityCompliant;

  // Active usage profile reference
  const currentUsageProfile = USAGE_PROFILES.find((u) => u.id === selectedProfileId) || USAGE_PROFILES[0];

  // Draw 2D schematic plan on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Padding & Scale
    const pad = 36;
    const availW = width - 2 * pad;
    const availH = height - 2 * pad;
    const scale = Math.min(availW / roomLength, availH / roomWidth);

    const roomDrawW = roomLength * scale;
    const roomDrawH = roomWidth * scale;
    const originX = pad + (availW - roomDrawW) / 2;
    const originY = pad + (availH - roomDrawH) / 2;

    // 1. Room Floor background
    ctx.fillStyle = "#1e222b";
    ctx.fillRect(originX, originY, roomDrawW, roomDrawH);

    // 2. Useful Workplane Area (margin exclusion boundary)
    const marginDrawX = wallZoneMargin * scale;
    const marginDrawY = wallZoneMargin * scale;
    const usefulDrawW = Math.max(2, roomDrawW - 2 * marginDrawX);
    const usefulDrawH = Math.max(2, roomDrawH - 2 * marginDrawY);

    ctx.fillStyle = "rgba(14, 165, 233, 0.08)";
    ctx.fillRect(originX + marginDrawX, originY + marginDrawY, usefulDrawW, usefulDrawH);

    // Useful area dashed border
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(originX + marginDrawX, originY + marginDrawY, usefulDrawW, usefulDrawH);
    ctx.restore();

    // 3. Corner Registration Crosses (+)
    const crossLen = 6;
    const corners = [
      [originX + marginDrawX, originY + marginDrawY],
      [originX + marginDrawX + usefulDrawW, originY + marginDrawY],
      [originX + marginDrawX, originY + marginDrawY + usefulDrawH],
      [originX + marginDrawX + usefulDrawW, originY + marginDrawY + usefulDrawH],
    ];
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.2;
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.moveTo(cx - crossLen, cy);
      ctx.lineTo(cx + crossLen, cy);
      ctx.moveTo(cx, cy - crossLen);
      ctx.lineTo(cx, cy + crossLen);
      ctx.stroke();
    });

    // 4. Outer Walls Border
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(originX, originY, roomDrawW, roomDrawH);

    // 5. Luminaires Grid Placement
    const lumStepX = roomDrawW / gridCols;
    const lumStepY = roomDrawH / gridRows;

    for (let r = 0; r < gridRows; r++) {
      const ly = originY + (r + 0.5) * lumStepY;
      for (let c = 0; c < gridCols; c++) {
        const lx = originX + (c + 0.5) * lumStepX;

        // Light cone glow
        const glowGrad = ctx.createRadialGradient(lx, ly, 2, lx, ly, Math.min(lumStepX, lumStepY) * 0.45);
        glowGrad.addColorStop(0, "rgba(250, 204, 21, 0.35)");
        glowGrad.addColorStop(1, "rgba(250, 204, 21, 0.0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, Math.min(lumStepX, lumStepY) * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Luminaire Symbol
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 6. Dimension Annotations
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${roomLength.toFixed(1)} m`, originX + roomDrawW / 2, originY - 10);

    ctx.save();
    ctx.translate(originX - 10, originY + roomDrawH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${roomWidth.toFixed(1)} m`, 0, 0);
    ctx.restore();

    // Wall zone callout
    ctx.fillStyle = "#38bdf8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Wall Zone: ${wallZoneMargin}m margin (EN 12464-1)`, originX + 6, originY + roomDrawH - 8);
  }, [roomLength, roomWidth, wallZoneMargin, gridRows, gridCols]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 select-none animate-in fade-in-50">
      <div className="bg-[#181a20] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col text-slate-100 overflow-hidden font-sans">
        {/* =========================================================================
            HEADER BAR
        ========================================================================= */}
        <div className="h-14 px-4 bg-[#12141a] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  DIALux evo — Simple Indoor Planning
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  evo easy
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Tutorial Part 12
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Rapid standard-compliant room planning for garages, workshops, storage & offices per EN 12464-1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={solveAutomaticArrangement}
              className="h-8 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              title="Automatically calculate layout to achieve target illuminance"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto Arrangement</span>
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
            STEP TABS NAVIGATION
        ========================================================================= */}
        <div className="h-10 px-4 bg-[#14161d] border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto shrink-0">
          {[
            { id: "geometry", label: "1. Room Geometry & Plane", icon: Building },
            { id: "profile", label: "2. Usage Profile & Standards", icon: Sliders },
            { id: "surfaces", label: "3. Surfaces & Maintenance", icon: Layers },
            { id: "luminaire", label: "4. Luminaire & Arrangement", icon: Grid },
            { id: "results", label: "5. Results Overview", icon: CheckCircle2 },
          ].map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id as any)}
                className={`h-7 px-3 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-700 text-emerald-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            MAIN CONTENT AREA
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-[#181a20]">
          {/* LEFT CONFIGURATION PANEL */}
          <div className="w-full md:w-[58%] h-full overflow-y-auto p-4 border-r border-slate-800 space-y-4">
            {/* STEP 1: ROOM GEOMETRY & WORKING PLANE */}
            {activeStep === "geometry" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-emerald-400" />
                    Room Identification & Dimensions
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Room Name</label>
                      <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g. Garage / Workshop"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Floor Area</label>
                      <div className="h-8 px-2.5 bg-slate-800/80 rounded border border-slate-700/60 flex items-center justify-between text-xs font-mono font-bold text-emerald-400">
                        <span>{floorArea.toFixed(2)} m²</span>
                        <span className="text-[10px] text-slate-400 font-normal">({roomLength}m × {roomWidth}m)</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Length L (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={100}
                        value={roomLength}
                        onChange={(e) => setRoomLength(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Width W (m)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={100}
                        value={roomWidth}
                        onChange={(e) => setRoomWidth(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Room Height H (m)</label>
                      <input
                        type="number"
                        step={0.1}
                        min={2}
                        max={30}
                        value={roomHeight}
                        onChange={(e) => setRoomHeight(Math.max(2, parseFloat(e.target.value) || 2))}
                        className="w-full h-8 px-2.5 bg-[#14161c] border border-slate-700 rounded text-xs text-white focus:border-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* WORKING PLANE & WALL ZONE PER TUTORIAL PART 12 */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Grid className="h-4 w-4 text-blue-400" />
                      Working Plane & Wall Zone (EN 12464-1)
                    </h3>
                    <span className="text-[10px] text-blue-400 font-mono">
                      Useful Area: {usefulArea.toFixed(2)} m²
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                    Per DIALux evo Tutorial Part 12, the working plane for tables/workbenches is typically set at{" "}
                    <strong className="text-slate-200">0.80 m (80 cm)</strong> and the wall zone is set at{" "}
                    <strong className="text-slate-200">0.50 m (50 cm)</strong> to exclude boundary strips where tasks are not performed.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                        Working Plane Height: {workPlaneHeight} m
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          max={2}
                          value={workPlaneHeight}
                          onChange={(e) => setWorkPlaneHeight(parseFloat(e.target.value) || 0.8)}
                          className="h-8 w-20 px-2 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setWorkPlaneHeight(0.80)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              workPlaneHeight === 0.80 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.80m (Bench)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkPlaneHeight(0.75)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              workPlaneHeight === 0.75 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.75m (Desk)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkPlaneHeight(0.00)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              workPlaneHeight === 0.00 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.00m (Floor)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                        Wall Zone Margin: {wallZoneMargin} m
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={2}
                          value={wallZoneMargin}
                          onChange={(e) => setWallZoneMargin(parseFloat(e.target.value) || 0.5)}
                          className="h-8 w-20 px-2 bg-[#14161c] border border-slate-700 rounded text-xs text-white font-mono"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setWallZoneMargin(0.50)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              wallZoneMargin === 0.50 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.50m (Std)
                          </button>
                          <button
                            type="button"
                            onClick={() => setWallZoneMargin(0.30)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              wallZoneMargin === 0.30 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.30m
                          </button>
                          <button
                            type="button"
                            onClick={() => setWallZoneMargin(0.00)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              wallZoneMargin === 0.00 ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            0.00m
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-200 flex items-center justify-between">
                    <span>
                      Effective Evaluated Plane:{" "}
                      <strong>
                        {usefulL.toFixed(2)} m × {usefulW.toFixed(2)} m
                      </strong>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {usefulArea.toFixed(2)} m² ({Math.round((usefulArea / floorArea) * 100)}% of room)
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveStep("profile")}
                    className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Next: Usage Profile</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: USAGE PROFILE & STANDARDS */}
            {activeStep === "profile" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    Select Utilization Profile (EN 12464-1 Standards)
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Automatically configures target maintained lux ($E_m$), minimum uniformity ($U_0$), and task plane elevation.
                  </p>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {USAGE_PROFILES.map((p) => {
                      const isSelected = selectedProfileId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleProfileSelect(p)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-950/40 border-emerald-500 text-white shadow"
                              : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  isSelected ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {isSelected ? "✓" : ""}
                              </span>
                              <div>
                                <strong className="text-xs font-semibold block">{p.name}</strong>
                                <span className="text-[10px] text-slate-400">{p.category}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-bold text-emerald-400 block">
                                {p.targetLux} lx
                              </span>
                              <span className="text-[9.5px] text-slate-400">
                                U0 ≥ {p.minU0.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block mb-0.5">Target Maintained Illuminance</label>
                    <span className="text-[11px] text-slate-400">Manual override if project specification differs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={50}
                      min={50}
                      max={2000}
                      value={targetLux}
                      onChange={(e) => setTargetLux(Math.max(50, parseInt(e.target.value) || 300))}
                      className="h-8 w-24 text-center bg-[#14161c] border border-slate-700 rounded text-xs font-mono font-bold text-white"
                    />
                    <span className="text-xs text-slate-400">lx</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep("geometry")}
                    className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setActiveStep("surfaces")}
                    className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Next: Surfaces & MF</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SURFACES & MAINTENANCE FACTOR */}
            {activeStep === "surfaces" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                {/* Surface Reflectances */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-400" />
                      Surface Reflectance Values (ρ)
                    </h3>
                    <select
                      value={reflectancePreset}
                      onChange={(e) => handleReflectancePreset(e.target.value)}
                      className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200"
                    >
                      {STANDARD_REFLECTANCE_PRESETS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">Ceiling (ρ_c)</span>
                      <strong className="text-sm font-mono text-emerald-400 block mb-1">
                        {Math.round(rhoCeiling * 100)} %
                      </strong>
                      <input
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={rhoCeiling}
                        onChange={(e) => setRhoCeiling(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">Walls (ρ_w)</span>
                      <strong className="text-sm font-mono text-emerald-400 block mb-1">
                        {Math.round(rhoWalls * 100)} %
                      </strong>
                      <input
                        type="range"
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={rhoWalls}
                        onChange={(e) => setRhoWalls(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block mb-1">Floor (ρ_f)</span>
                      <strong className="text-sm font-mono text-emerald-400 block mb-1">
                        {Math.round(rhoFloor * 100)} %
                      </strong>
                      <input
                        type="range"
                        min={0.05}
                        max={0.6}
                        step={0.05}
                        value={rhoFloor}
                        onChange={(e) => setRhoFloor(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Operating Conditions & Maintenance Factor (Tutorial 12 emphasis) */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Operating Condition & Maintenance Factor (CIE 97)
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">
                    As emphasized in Tutorial Part 12, garages and workshops are categorized as{" "}
                    <strong className="text-amber-300">Rather Dirty</strong> (MF = 0.67) or{" "}
                    <strong className="text-amber-300">Very Dirty</strong> (MF = 0.57).
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {OPERATING_CONDITIONS.map((cond) => {
                      const isSelected = operatingCondition === cond.id;
                      return (
                        <div
                          key={cond.id}
                          onClick={() => handleConditionSelect(cond.id as any)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-amber-950/40 border-amber-500 text-white"
                              : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-xs font-semibold">{cond.name.split("(")[0]}</strong>
                            <span className="text-[10px] font-mono font-bold text-amber-400">{cond.badge}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-400 block leading-tight">{cond.description}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isCustomMf}
                        onChange={(e) => setIsCustomMf(e.target.checked)}
                        className="rounded accent-emerald-500 cursor-pointer"
                        id="customMfCheck"
                      />
                      <label htmlFor="customMfCheck" className="text-xs font-semibold text-slate-200 cursor-pointer">
                        Custom MF value override
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={0.01}
                        min={0.4}
                        max={0.95}
                        disabled={!isCustomMf}
                        value={mf}
                        onChange={(e) => setMf(parseFloat(e.target.value) || 0.8)}
                        className={`h-7 w-20 text-center rounded text-xs font-mono font-bold ${
                          isCustomMf ? "bg-[#14161c] border border-amber-500 text-white" : "bg-slate-900 text-slate-500"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep("profile")}
                    className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setActiveStep("luminaire")}
                    className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Next: Luminaire & Layout</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: LUMINAIRE & ARRANGEMENT */}
            {activeStep === "luminaire" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Grid className="h-4 w-4 text-emerald-400" />
                      Select Luminaire Model
                    </h3>
                    <select
                      value={selectedProfile.name}
                      onChange={(e) => {
                        const prof = BUILTIN_PHOTOMETRIC_PROFILES.find((p) => p.name === e.target.value);
                        if (prof) setSelectedProfile(prof);
                      }}
                      className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-200"
                    >
                      {BUILTIN_PHOTOMETRIC_PROFILES.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {BUILTIN_PHOTOMETRIC_PROFILES.slice(0, 5).map((lum, idx) => {
                      const isSelected = selectedProfile.name === lum.name;
                      return (
                        <div
                          key={lum.name}
                          onClick={() => setSelectedProfile(lum)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-950/40 border-emerald-500 text-white shadow"
                              : "bg-[#14161c] border-slate-800 hover:border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-[11px] font-semibold truncate">{lum.name}</strong>
                            <span className="text-[10px] font-mono text-emerald-400">{lum.wattage}W</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>{lum.totalLumens || lum.lumens || 4000} lm</span>
                            <span>{lum.beamAngle}°</span>
                            <span>{((lum.totalLumens || lum.lumens || 4000) / Math.max(1, lum.wattage)).toFixed(0)} lm/W</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Arrangement Controls */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-emerald-400" />
                      Grid Arrangement & Spacing
                    </h3>
                    <button
                      onClick={solveAutomaticArrangement}
                      className="h-6 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      Solve to {targetLux} lx
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Rows (Along Width)</span>
                        <strong className="text-sm font-mono text-white">{gridRows}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setGridRows(Math.max(1, gridRows - 1))}
                          className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={() => setGridRows(gridRows + 1)}
                          className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#14161c] border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Columns (Along Length)</span>
                        <strong className="text-sm font-mono text-white">{gridCols}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setGridCols(Math.max(1, gridCols - 1))}
                          className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={() => setGridCols(gridCols + 1)}
                          className="h-6 w-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block">Quantity</span>
                      <strong className="text-emerald-400 text-xs">{gridRows * gridCols} pcs</strong>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block">Spacing Sx</span>
                      <strong className="text-slate-200 text-xs">{spacingX} m</strong>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block">Spacing Sy</span>
                      <strong className="text-slate-200 text-xs">{spacingY} m</strong>
                    </div>
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-500 block">S / H Ratio</span>
                      <strong className={`text-xs ${shr <= 1.5 ? "text-emerald-400" : "text-amber-400"}`}>
                        {shr} {shr <= 1.5 ? "✓" : "⚠"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep("surfaces")}
                    className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setActiveStep("results")}
                    className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>View Results Overview</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: RESULTS OVERVIEW (DIALUX EVO RESULTS OVERVIEW TABLE) */}
            {activeStep === "results" && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      DIALux evo Results Overview (EN 12464-1)
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-black uppercase tracking-wider ${
                        isCompliant
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {isCompliant ? "CONFORM" : "NON-CONFORM"}
                    </span>
                  </div>

                  <table className="w-full text-xs text-left border-collapse border border-slate-800 mb-3">
                    <thead>
                      <tr className="bg-slate-800/80 text-[10px] text-slate-300 uppercase">
                        <th className="p-2 border-r border-slate-700">Plane</th>
                        <th className="p-2 border-r border-slate-700 text-center">Target Em</th>
                        <th className="p-2 border-r border-slate-700 text-center">Achieved Em</th>
                        <th className="p-2 border-r border-slate-700 text-center">Emin</th>
                        <th className="p-2 border-r border-slate-700 text-center">Emax</th>
                        <th className="p-2 border-r border-slate-700 text-center">U0 (Emin/Em)</th>
                        <th className="p-2 text-center">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-800 bg-slate-950/40 font-mono">
                        <td className="p-2 font-sans font-semibold text-white border-r border-slate-800">
                          Working Plane ({usefulArea.toFixed(1)} m²)
                        </td>
                        <td className="p-2 text-center text-slate-300 border-r border-slate-800">
                          ≥ {targetLux} lx
                        </td>
                        <td className="p-2 text-center font-bold text-emerald-400 border-r border-slate-800">
                          {simulationResult.avgLux} lx
                        </td>
                        <td className="p-2 text-center text-slate-300 border-r border-slate-800">
                          {simulationResult.minLux} lx
                        </td>
                        <td className="p-2 text-center text-slate-300 border-r border-slate-800">
                          {simulationResult.maxLux} lx
                        </td>
                        <td className="p-2 text-center font-bold text-emerald-400 border-r border-slate-800">
                          {simulationResult.uniformityU0.toFixed(2)}
                        </td>
                        <td className="p-2 text-center font-bold">
                          {isCompliant ? (
                            <span className="text-emerald-400">PASS</span>
                          ) : (
                            <span className="text-amber-400">FAIL</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Connected Power</span>
                      <strong className="text-white text-xs">{totalPowerW} W</strong>
                    </div>
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Specific Load</span>
                      <strong className="text-emerald-400 text-xs">{powerDensityW.toFixed(1)} W/m²</strong>
                    </div>
                    <div className="p-2 rounded bg-[#14161c] border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Load per 100 lx</span>
                      <strong className="text-emerald-400 text-xs">
                        {simulationResult.avgLux > 0 ? ((powerDensityW / simulationResult.avgLux) * 100).toFixed(2) : 0} W/m²/100lx
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Compliance Statement Box */}
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    isCompliant
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                      : "bg-amber-950/20 border-amber-500/40 text-amber-200"
                  }`}
                >
                  <strong className="block font-bold mb-1">
                    {isCompliant ? "✓ EN 12464-1 STANDARD CONFORMITY SATISFIED" : "⚠ LIGHTING CRITERIA REQUIRES ADJUSTMENT"}
                  </strong>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {isCompliant
                      ? `Achieved maintained illuminance (${simulationResult.avgLux} lx) and uniformity (${simulationResult.uniformityU0.toFixed(2)}) satisfy all lighting criteria for "${currentUsageProfile.name}" with a 50cm wall zone exclusion.`
                      : `Achieved ${simulationResult.avgLux} lx / uniformity ${simulationResult.uniformityU0.toFixed(2)} does not meet target ${targetLux} lx. Click "Auto Arrangement" to recalculate.`}
                  </p>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep("luminaire")}
                    className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      exportSimpleIndoorPlanningPDF({
                        projectName,
                        projectCode,
                        roomName,
                        usageProfile: currentUsageProfile.name,
                        roomLength,
                        roomWidth,
                        roomHeight,
                        workPlaneHeight,
                        wallZoneMargin,
                        reflectances: { ceiling: rhoCeiling, walls: rhoWalls, floor: rhoFloor },
                        operatingCondition: OPERATING_CONDITIONS.find((c) => c.id === operatingCondition)?.name || "Rather Dirty",
                        maintenanceFactor: mf,
                        profile: selectedProfile,
                        simulation: simulationResult,
                        rows: gridRows,
                        cols: gridCols,
                        spacingX,
                        spacingY,
                        userName,
                      });
                      toast.success("Downloaded DIALux Simple Planning PDF Report");
                    }}
                    className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Summary PDF</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT VISUAL PREVIEW: 2D SCHEMATIC WITH WALL ZONE */}
          <div className="w-full md:w-[42%] h-full flex flex-col p-4 bg-[#121419] overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-blue-400" />
                2D Room Layout & Task Area
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {gridRows} × {gridCols} Grid ({gridRows * gridCols} Luminaires)
              </span>
            </div>

            <div className="flex-1 min-h-0 bg-[#0d0f13] rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden p-2">
              <canvas
                ref={canvasRef}
                width={360}
                height={320}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Quick Metrics Bar below canvas */}
            <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 grid grid-cols-3 gap-2 text-center font-mono">
              <div>
                <span className="text-[9.5px] text-slate-500 block">Achieved Lux</span>
                <strong className="text-xs text-emerald-400 font-bold">{simulationResult.avgLux} lx</strong>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block">Uniformity U0</span>
                <strong className="text-xs text-emerald-400 font-bold">{simulationResult.uniformityU0.toFixed(2)}</strong>
              </div>
              <div>
                <span className="text-[9.5px] text-slate-500 block">Power Density</span>
                <strong className="text-xs text-slate-300 font-bold">{powerDensityW.toFixed(1)} W/m²</strong>
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
              Configured: {roomLength}m × {roomWidth}m, {gridRows * gridCols} × {selectedProfile.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onApplyToSchedule && (
              <button
                onClick={() => {
                  onApplyToSchedule({
                    quantity: gridRows * gridCols,
                    rows: gridRows,
                    cols: gridCols,
                    achievedLux: simulationResult.avgLux,
                    targetLux,
                    uniformityU0: simulationResult.uniformityU0,
                    powerW: totalPowerW,
                    lightType: selectedProfile.name,
                    remarks: `DIALux Simple Indoor Plan: ${gridRows * gridCols} fixtures (${gridRows}x${gridCols}) - ${simulationResult.avgLux} lx, U0: ${simulationResult.uniformityU0}`,
                  });
                  toast.success("Applied layout to MEP Project Schedule");
                }}
                className="h-8 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Apply to MEP Schedule
              </button>
            )}

            <button
              onClick={() => {
                exportSimpleIndoorPlanningPDF({
                  projectName,
                  projectCode,
                  roomName,
                  usageProfile: currentUsageProfile.name,
                  roomLength,
                  roomWidth,
                  roomHeight,
                  workPlaneHeight,
                  wallZoneMargin,
                  reflectances: { ceiling: rhoCeiling, walls: rhoWalls, floor: rhoFloor },
                  operatingCondition: OPERATING_CONDITIONS.find((c) => c.id === operatingCondition)?.name || "Rather Dirty",
                  maintenanceFactor: mf,
                  profile: selectedProfile,
                  simulation: simulationResult,
                  rows: gridRows,
                  cols: gridCols,
                  spacingX,
                  spacingY,
                  userName,
                });
                toast.success("Downloaded DIALux Simple Planning PDF");
              }}
              className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export PDF</span>
            </button>

            {onApplyTo3DView && (
              <button
                onClick={() => {
                  onApplyTo3DView({
                    roomName,
                    length: roomLength,
                    width: roomWidth,
                    height: roomHeight,
                    workPlaneHeight,
                    marginOffset: wallZoneMargin,
                    targetLux,
                    profile: selectedProfile,
                    rows: gridRows,
                    cols: gridCols,
                    mf,
                    reflectances: { ceiling: rhoCeiling, walls: rhoWalls, floor: rhoFloor },
                  });
                  onClose();
                  toast.success("Synchronized Simple Indoor Planning into 3D CAD Viewport!");
                }}
                className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Apply & View in 3D CAD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
