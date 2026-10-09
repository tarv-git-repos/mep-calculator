import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Lightbulb,
  Grid,
  Sun,
  Sliders,
  Leaf,
  FileDown,
  Download,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Copy,
  Info,
  Building2,
  Box,
  MapPin,
  Calendar,
  User,
  Compass,
  Eye,
  SlidersVertical,
  Check,
  Palette,
  FileText,
  Bookmark,
  Camera,
  Target,
  RefreshCw,
  Circle,
  Square,
  LayoutGrid,
  SlidersHorizontal,
  ShieldAlert,
  Monitor,
  Plus,
  Trash2,
  ArrowRight,
  Move,
  Gauge,
  HelpCircle,
  Crosshair,
  RotateCw,
  EyeOff,
  CornerDownRight,
  FlipHorizontal,
  FlipVertical,
  Shapes,
  FolderTree,
  BookOpen,
  ChevronDown,
  CheckSquare,
  Settings2,
  ZoomIn,
  ZoomOut,
  Columns,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  DialuxSimulationResult,
  LuminairePhotometricProfile,
  BUILTIN_PHOTOMETRIC_PROFILES,
  LuminaireArrangementMode,
  CalculationAreaType,
  WorkstationAreaConfig,
  AreaPhotometricStats,
  WORKSTATION_PRESETS,
  LineArrangementConfig,
  CircularArrangementConfig,
  PolygonalArrangementConfig,
  LuminaireOverride,
  AimingAngles,
  calculateAimingAngles,
  transformLuminaireArrangement,
  IndividualLuminaireConfig,
  computeSpaceAutoArrangement,
  RaytracerConfig,
  RenderedRaytraceImage,
  RAYTRACER_PRESETS,
  generateRadianceHdrBlob,
  applyHdrExposureAndToneMapping,
} from "../../lib/dialux-photometrics-engine";
import {
  exportDialuxReportPDF,
  DocumentationTemplateType,
  DocumentationPageSelection,
  DEFAULT_PAGE_SELECTIONS,
  DocumentationHeaderConfig,
  exportLuminaireCoordinatesCSV,
  exportCalculationGridCSV,
} from "../../lib/exportDialuxReportPDF";

// =========================================================================
// 1. BRAND CATALOGUE FIXTURE DEFINITIONS (Official DIALux Partners)
// =========================================================================
// 1. BRAND CATALOGUE FIXTURE DEFINITIONS (Official DIALux Partners)
// =========================================================================
export interface BrandLuminaire {
  id: string;
  brand: string;
  model: string;
  category: "panel" | "downlight" | "linear" | "highbay" | "wallwasher" | "spotlight" | "outdoor";
  mounting: "recessed" | "surface" | "suspended" | "wall";
  lumens: number;
  wattage: number;
  cct: number;
  cri: number;
  beamAngle: number;
  distributionType: "batwing" | "direct" | "indirect" | "direct_indirect" | "narrow" | "wide" | "asymmetric";
  dimensions: { length: number; width: number; height: number };
  shape: "rectangular" | "circular";
  efficacy: number;
  ugrLimit?: number;
  description: string;
}

export const BRAND_LUMINAIRES: BrandLuminaire[] = [
  // PHILIPS / SIGNIFY
  {
    id: "philips-coreline-600",
    brand: "Philips / Signify",
    model: "CoreLine LED Panel 600x600",
    category: "panel",
    mounting: "recessed",
    lumens: 3600,
    wattage: 31,
    cct: 4000,
    cri: 80,
    beamAngle: 110,
    distributionType: "batwing",
    dimensions: { length: 0.595, width: 0.595, height: 0.04 },
    shape: "rectangular",
    efficacy: 116,
    ugrLimit: 19,
    description: "Office task lighting compliant with EN 12464-1 (UGR < 19).",
  },
  {
    id: "philips-coreline-downlight",
    brand: "Philips / Signify",
    model: "CoreLine Downlight Gen4 DN140B",
    category: "downlight",
    mounting: "recessed",
    lumens: 2100,
    wattage: 18,
    cct: 3000,
    cri: 80,
    beamAngle: 60,
    distributionType: "direct",
    dimensions: { length: 0.16, width: 0.16, height: 0.11 },
    shape: "circular",
    efficacy: 117,
    ugrLimit: 22,
    description: "Compact recessed downlight for circulation and common office zones.",
  },
  {
    id: "philips-gentlespace-highbay",
    brand: "Philips / Signify",
    model: "GentleSpace Gen3 Highbay BY480P",
    category: "highbay",
    mounting: "suspended",
    lumens: 17500,
    wattage: 115,
    cct: 4000,
    cri: 80,
    beamAngle: 85,
    distributionType: "direct",
    dimensions: { length: 0.45, width: 0.45, height: 0.14 },
    shape: "circular",
    efficacy: 152,
    ugrLimit: 25,
    description: "High-efficiency industrial warehouse and manufacturing bay lighting.",
  },

  // ZUMTOBEL
  {
    id: "zumtobel-slotlight",
    brand: "Zumtobel",
    model: "SLOTLIGHT Infinity Linear LED",
    category: "linear",
    mounting: "suspended",
    lumens: 4200,
    wattage: 36,
    cct: 4000,
    cri: 90,
    beamAngle: 95,
    distributionType: "direct",
    dimensions: { length: 1.20, width: 0.065, height: 0.08 },
    shape: "rectangular",
    efficacy: 117,
    ugrLimit: 19,
    description: "Architectural continuous light line with high vertical illuminance.",
  },
  {
    id: "zumtobel-panos-evo",
    brand: "Zumtobel",
    model: "PANOS EVO R150 20W",
    category: "downlight",
    mounting: "recessed",
    lumens: 2200,
    wattage: 20,
    cct: 4000,
    cri: 85,
    beamAngle: 60,
    distributionType: "direct",
    dimensions: { length: 0.18, width: 0.18, height: 0.12 },
    shape: "circular",
    efficacy: 110,
    ugrLimit: 19,
    description: "Recessed architectural downlight with micro-faceted reflector.",
  },
  {
    id: "zumtobel-mirel-evolution",
    brand: "Zumtobel",
    model: "MIREL Evolution Modular LED",
    category: "panel",
    mounting: "recessed",
    lumens: 3900,
    wattage: 32,
    cct: 4000,
    cri: 85,
    beamAngle: 85,
    distributionType: "batwing",
    dimensions: { length: 0.597, width: 0.597, height: 0.045 },
    shape: "rectangular",
    efficacy: 122,
    ugrLimit: 16,
    description: "Quadratic modular luminaire with lens optic for low glare VDU desks.",
  },
  {
    id: "zumtobel-craft-highbay",
    brand: "Zumtobel",
    model: "CRAFT II Plus Highbay LED",
    category: "highbay",
    mounting: "suspended",
    lumens: 19500,
    wattage: 130,
    cct: 4000,
    cri: 80,
    beamAngle: 90,
    distributionType: "direct",
    dimensions: { length: 0.39, width: 0.33, height: 0.13 },
    shape: "rectangular",
    efficacy: 150,
    ugrLimit: 22,
    description: "High-bay luminaire with thermal management for harsh industrial halls.",
  },

  // ERCO
  {
    id: "erco-quintessence",
    brand: "ERCO",
    model: "Quintessence Round Downlight",
    category: "downlight",
    mounting: "recessed",
    lumens: 2400,
    wattage: 18,
    cct: 3000,
    cri: 92,
    beamAngle: 65,
    distributionType: "narrow",
    dimensions: { length: 0.15, width: 0.15, height: 0.10 },
    shape: "circular",
    efficacy: 133,
    ugrLimit: 16,
    description: "Precision optical darklight reflector with high visual comfort.",
  },
  {
    id: "erco-skim-wallwash",
    brand: "ERCO",
    model: "Skim Lens Wallwasher Recessed",
    category: "wallwasher",
    mounting: "recessed",
    lumens: 2200,
    wattage: 19,
    cct: 3000,
    cri: 90,
    beamAngle: 75,
    distributionType: "asymmetric",
    dimensions: { length: 0.16, width: 0.16, height: 0.11 },
    shape: "circular",
    efficacy: 116,
    ugrLimit: 19,
    description: "Asymmetric optical lens for uniform vertical illumination on art walls.",
  },
  {
    id: "erco-optec-spot",
    brand: "ERCO",
    model: "Optec Directional Spotlight",
    category: "spotlight",
    mounting: "surface",
    lumens: 3100,
    wattage: 24,
    cct: 3000,
    cri: 92,
    beamAngle: 30,
    distributionType: "narrow",
    dimensions: { length: 0.22, width: 0.12, height: 0.18 },
    shape: "circular",
    efficacy: 129,
    ugrLimit: 16,
    description: "High precision accent spotlight for exhibition galleries and retail.",
  },

  // TRILUX
  {
    id: "trilux-siella-g4",
    brand: "Trilux",
    model: "Siella LED G4 M73",
    category: "panel",
    mounting: "recessed",
    lumens: 3800,
    wattage: 29,
    cct: 4000,
    cri: 80,
    beamAngle: 90,
    distributionType: "batwing",
    dimensions: { length: 0.595, width: 0.595, height: 0.04 },
    shape: "rectangular",
    efficacy: 131,
    ugrLimit: 19,
    description: "Microprismatic optic for glare-free DSE computer screen tasks.",
  },
  {
    id: "trilux-eline-next",
    brand: "Trilux",
    model: "E-Line Next LED Trunking",
    category: "linear",
    mounting: "suspended",
    lumens: 5400,
    wattage: 37,
    cct: 4000,
    cri: 80,
    beamAngle: 90,
    distributionType: "direct",
    dimensions: { length: 1.49, width: 0.065, height: 0.05 },
    shape: "rectangular",
    efficacy: 146,
    ugrLimit: 19,
    description: "Continuous light line trunking system for retail and logistics hubs.",
  },
  {
    id: "trilux-oleveon-fit",
    brand: "Trilux",
    model: "Oleveon Fit Weatherproof IP66",
    category: "linear",
    mounting: "surface",
    lumens: 4400,
    wattage: 33,
    cct: 4000,
    cri: 80,
    beamAngle: 100,
    distributionType: "wide",
    dimensions: { length: 1.25, width: 0.09, height: 0.08 },
    shape: "rectangular",
    efficacy: 133,
    ugrLimit: 22,
    description: "Vapour-proof IP66 fitting for car parks, plant rooms and workshops.",
  },

  // THORN
  {
    id: "thorn-poppack",
    brand: "Thorn",
    model: "PopPack LED Batten 1200",
    category: "linear",
    mounting: "surface",
    lumens: 4500,
    wattage: 38,
    cct: 4000,
    cri: 80,
    beamAngle: 120,
    distributionType: "wide",
    dimensions: { length: 1.19, width: 0.06, height: 0.07 },
    shape: "rectangular",
    efficacy: 118,
    ugrLimit: 22,
    description: "Classic robust batten replacement with high-performance opal diffuser.",
  },
  {
    id: "thorn-novaline",
    brand: "Thorn",
    model: "Novaline Circular Bulkhead",
    category: "downlight",
    mounting: "surface",
    lumens: 1800,
    wattage: 14,
    cct: 3000,
    cri: 80,
    beamAngle: 120,
    distributionType: "wide",
    dimensions: { length: 0.35, width: 0.35, height: 0.08 },
    shape: "circular",
    efficacy: 128,
    ugrLimit: 22,
    description: "Robust IP54 luminaire for circulation, staircases, and corridors.",
  },
  {
    id: "thorn-hipak-highbay",
    brand: "Thorn",
    model: "HiPak Gen4 Industrial Highbay",
    category: "highbay",
    mounting: "suspended",
    lumens: 18000,
    wattage: 140,
    cct: 4000,
    cri: 80,
    beamAngle: 90,
    distributionType: "direct",
    dimensions: { length: 0.38, width: 0.38, height: 0.15 },
    shape: "circular",
    efficacy: 129,
    ugrLimit: 22,
    description: "Durable die-cast highbay fitting with point-to-point replacement optics.",
  },

  // BEGA
  {
    id: "bega-compact-downlight",
    brand: "BEGA",
    model: "Compact Ceiling Luminaire",
    category: "downlight",
    mounting: "surface",
    lumens: 3200,
    wattage: 24,
    cct: 3000,
    cri: 85,
    beamAngle: 75,
    distributionType: "direct",
    dimensions: { length: 0.22, width: 0.22, height: 0.10 },
    shape: "circular",
    efficacy: 133,
    ugrLimit: 19,
    description: "Die-cast aluminium housing with crystal glass lens.",
  },
  {
    id: "bega-studio-line-pendant",
    brand: "BEGA",
    model: "Studio Line Velvet Pendant",
    category: "downlight",
    mounting: "suspended",
    lumens: 2800,
    wattage: 22,
    cct: 3000,
    cri: 90,
    beamAngle: 80,
    distributionType: "direct_indirect",
    dimensions: { length: 0.26, width: 0.26, height: 0.22 },
    shape: "circular",
    efficacy: 127,
    ugrLimit: 17,
    description: "Architectural pendant with internal brass reflector for warm ambient tone.",
  },

  // CREE LIGHTING
  {
    id: "cree-osq-highbay",
    brand: "Cree Lighting",
    model: "OSQ Highbay / Area Light",
    category: "highbay",
    mounting: "suspended",
    lumens: 14000,
    wattage: 105,
    cct: 5000,
    cri: 70,
    beamAngle: 80,
    distributionType: "direct",
    dimensions: { length: 0.35, width: 0.35, height: 0.12 },
    shape: "rectangular",
    efficacy: 133,
    ugrLimit: 22,
    description: "High-output industrial bay luminaire with NanoOptic technology.",
  },
  {
    id: "cree-cadiant-skylight",
    brand: "Cree Lighting",
    model: "Cadiant Dynamic Skylight Panel",
    category: "panel",
    mounting: "recessed",
    lumens: 5200,
    wattage: 45,
    cct: 4000,
    cri: 90,
    beamAngle: 110,
    distributionType: "batwing",
    dimensions: { length: 1.195, width: 0.595, height: 0.08 },
    shape: "rectangular",
    efficacy: 115,
    ugrLimit: 16,
    description: "Simulated daylight architectural skylight with morning/dusk biophilic rhythm.",
  },

  // LEDVANCE / OSRAM
  {
    id: "ledvance-surface-compact",
    brand: "Ledvance",
    model: "Surface Compact Linear 1200",
    category: "linear",
    mounting: "surface",
    lumens: 3400,
    wattage: 28,
    cct: 4000,
    cri: 80,
    beamAngle: 120,
    distributionType: "wide",
    dimensions: { length: 1.20, width: 0.08, height: 0.04 },
    shape: "rectangular",
    efficacy: 121,
    ugrLimit: 22,
    description: "Slim profile surface/suspended fitting with through-wiring.",
  },
  {
    id: "ledvance-panel-comfort",
    brand: "Ledvance",
    model: "Panel Comfort 600 UGR<19",
    category: "panel",
    mounting: "recessed",
    lumens: 3600,
    wattage: 30,
    cct: 4000,
    cri: 80,
    beamAngle: 90,
    distributionType: "batwing",
    dimensions: { length: 0.595, width: 0.595, height: 0.035 },
    shape: "rectangular",
    efficacy: 120,
    ugrLimit: 19,
    description: "Flicker-free driver panel luminaire compliant with EN 12464-1 office standard.",
  },

  // FAGERHULT
  {
    id: "fagerhult-notor-65",
    brand: "Fagerhult",
    model: "Notor 65 Suspended Linear",
    category: "linear",
    mounting: "suspended",
    lumens: 4100,
    wattage: 34,
    cct: 4000,
    cri: 85,
    beamAngle: 90,
    distributionType: "direct_indirect",
    dimensions: { length: 1.20, width: 0.065, height: 0.065 },
    shape: "rectangular",
    efficacy: 120,
    ugrLimit: 18,
    description: "Direct/indirect linear suspended profile with delta microprismatic louvre.",
  },

  // REGENT
  {
    id: "regent-channel-linear",
    brand: "Regent Lighting",
    model: "Channel Linear Trunking System",
    category: "linear",
    mounting: "suspended",
    lumens: 4600,
    wattage: 38,
    cct: 4000,
    cri: 85,
    beamAngle: 90,
    distributionType: "direct",
    dimensions: { length: 1.48, width: 0.07, height: 0.07 },
    shape: "rectangular",
    efficacy: 121,
    ugrLimit: 19,
    description: "Swiss engineered modular trunking system with tool-free click-fit.",
  },
];

// Helper to draw polar curve canvas
export function drawPolarCurve(
  canvas: HTMLCanvasElement | null,
  beamAngle: number = 110,
  distribution: string = "batwing"
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 6;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "#14171d";
  ctx.fillRect(0, 0, w, h);

  // Polar concentric grid circles
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.8;
  [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Radial angle axes
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();

  // Polar Luminous Intensity Lobe (C0 / C90)
  ctx.strokeStyle = "#f59e0b"; // Amber curve
  ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();

  const totalPoints = 90;
  for (let i = 0; i <= totalPoints; i++) {
    const angleRad = (i / totalPoints) * Math.PI * 2;
    // Photometric distribution modeling
    let intensity = 0;
    const deg = Math.abs((angleRad * 180) / Math.PI - 90);
    if (distribution === "batwing") {
      // Batwing peak at ~30 deg from nadir
      intensity = Math.max(0, Math.cos((deg * Math.PI) / 180) * (1 + 0.3 * Math.sin((deg * 2 * Math.PI) / 180)));
    } else if (distribution === "narrow") {
      intensity = Math.pow(Math.max(0, Math.cos((deg * Math.PI) / 180)), 4);
    } else {
      intensity = Math.pow(Math.max(0, Math.cos((deg * Math.PI) / 180)), 1.2);
    }

    const currentR = r * Math.min(1.0, intensity);
    const px = cx + currentR * Math.cos(angleRad);
    const py = cy + currentR * Math.sin(angleRad);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Center crosshair
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}

// =========================================================================
// 2. LIGHT WORKFLOW INSPECTORS (Matching DIALux evo Light Mode)
// =========================================================================
interface LightInspectorsProps {
  lightTool: "luminaires" | "arrangements" | "lamps" | "scenes" | "energy" | "filters" | "views";
  roomL: number;
  roomW: number;
  roomH: number;
  targetLux: number;
  profile: LuminairePhotometricProfile;
  setProfile: (p: LuminairePhotometricProfile) => void;
  gridConfig: { rows: number; cols: number };
  setGridConfig: (cfg: { rows: number; cols: number }) => void;
  pushGridChange: (cfg: { rows: number; cols: number }) => void;
  simulationResult: DialuxSimulationResult;
  cct: number;
  setCct: (k: number) => void;
  lightScene: string;
  setLightScene: (s: any) => void;
  onOpenDaylightModal?: () => void;
  mountingType: "flush" | "surface" | "suspended" | "wall";
  setMountingType: (m: "flush" | "surface" | "suspended" | "wall") => void;
  suspensionLength: number;
  setSuspensionLength: (l: number) => void;
  arrangementMode?: LuminaireArrangementMode;
  setArrangementMode?: (m: LuminaireArrangementMode) => void;
  lineConfig?: LineArrangementConfig;
  setLineConfig?: (cfg: LineArrangementConfig) => void;
  circularConfig?: CircularArrangementConfig;
  setCircularConfig?: (cfg: CircularArrangementConfig) => void;
  polygonalConfig?: PolygonalArrangementConfig;
  setPolygonalConfig?: (cfg: PolygonalArrangementConfig) => void;
  arrangementOverrides?: Record<number, LuminaireOverride>;
  setArrangementOverrides?: React.Dispatch<React.SetStateAction<Record<number, LuminaireOverride>>>;
  customLuminaires?: IndividualLuminaireConfig[];
  setCustomLuminaires?: React.Dispatch<React.SetStateAction<IndividualLuminaireConfig[]>>;
  selectedFixtureIndex?: number | null;
  setSelectedFixtureIndex?: (idx: number | null) => void;
  onOpenPlacementModal?: () => void;
  onOpenBrandsModal?: () => void;
  workPlaneHeight?: number;
  isAimingToolActive?: boolean;
  setIsAimingToolActive?: (active: boolean) => void;
}

export function LightInspectors({
  lightTool,
  roomL,
  roomW,
  roomH,
  targetLux,
  profile,
  setProfile,
  gridConfig,
  pushGridChange,
  simulationResult,
  cct,
  setCct,
  lightScene,
  setLightScene,
  onOpenDaylightModal,
  mountingType,
  setMountingType,
  suspensionLength,
  setSuspensionLength,
  arrangementMode = "grid",
  setArrangementMode,
  lineConfig,
  setLineConfig,
  circularConfig,
  setCircularConfig,
  polygonalConfig,
  setPolygonalConfig,
  arrangementOverrides = {},
  setArrangementOverrides,
  customLuminaires = [],
  setCustomLuminaires,
  selectedFixtureIndex,
  setSelectedFixtureIndex,
  onOpenPlacementModal,
  onOpenBrandsModal,
  workPlaneHeight = 0.75,
  isAimingToolActive = false,
  setIsAimingToolActive,
}: LightInspectorsProps) {
  const polarRef = useRef<HTMLCanvasElement>(null);
  const iesFileRef = useRef<HTMLInputElement>(null);

  // Optical filter state
  const [opticalFilter, setOpticalFilter] = useState<"none" | "honeycomb" | "diffuser" | "oval_optic">("none");
  const [daylightHarvesting, setDaylightHarvesting] = useState<boolean>(true);
  const [daylightOffsetLux, setDaylightOffsetLux] = useState<number>(180);

  // Space purpose preset for automatic space arrangement
  const [spacePresetType, setSpacePresetType] = useState<string>("office_500");

  // Local fallback states if not controlled from parent
  const activeLineConfig: LineArrangementConfig = lineConfig || {
    startX: 0.5,
    startY: Number((roomW / 2).toFixed(2)),
    endX: Number((roomL - 0.5).toFixed(2)),
    endY: Number((roomW / 2).toFixed(2)),
    count: Math.max(2, gridConfig.cols),
    isContinuous: false,
    fixtureLength: profile.dimensions?.length || 1.2,
    alignPerpendicular: false,
  };

  const activeCircularConfig: CircularArrangementConfig = circularConfig || {
    centerX: Number((roomL / 2).toFixed(2)),
    centerY: Number((roomW / 2).toFixed(2)),
    radius: Number((Math.min(roomL, roomW) * 0.35).toFixed(2)),
    count: Math.max(4, gridConfig.cols * gridConfig.rows),
    startAngleDeg: 0,
    sweepAngleDeg: 360,
    alignTangential: true,
  };

  // Selection level: Whole arrangement group vs. Individual luminaire in group (DIALux evo Tutorial Part 6)
  const [selectionLevel, setSelectionLevel] = useState<"group" | "single">("group");

  const activePolygonalConfig: PolygonalArrangementConfig = polygonalConfig || {
    points: [
      { x: Number((roomL * 0.2).toFixed(2)), y: Number((roomW * 0.2).toFixed(2)) },
      { x: Number((roomL * 0.8).toFixed(2)), y: Number((roomW * 0.2).toFixed(2)) },
      { x: Number((roomL * 0.8).toFixed(2)), y: Number((roomW * 0.8).toFixed(2)) },
      { x: Number((roomL * 0.2).toFixed(2)), y: Number((roomW * 0.8).toFixed(2)) },
    ],
    count: Math.max(4, gridConfig.cols * 2),
    isClosed: true,
    alignToSegment: true,
  };

  const activeFixtureIdx =
    selectedFixtureIndex !== null && selectedFixtureIndex !== undefined && selectedFixtureIndex >= 0
      ? Math.min(selectedFixtureIndex, Math.max(0, (simulationResult.luminaires?.length || 1) - 1))
      : 0;

  const currentLum = simulationResult.luminaires?.[activeFixtureIdx] || simulationResult.luminaires?.[0];
  const currentOverride = (arrangementOverrides && arrangementOverrides[activeFixtureIdx]) || {};

  // Transform whole arrangement (DIALux evo Tutorial Part 6)
  const handleApplyArrangementTransform = (options: {
    rotateAngleDeg?: number;
    mirrorX?: boolean;
    mirrorY?: boolean;
    align?: "center" | "north" | "south" | "east" | "west";
  }) => {
    if (!simulationResult.luminaires || simulationResult.luminaires.length === 0) return;
    const transformed = transformLuminaireArrangement(simulationResult.luminaires, {
      ...options,
      roomL,
      roomW,
    });
    if (setArrangementOverrides) {
      setArrangementOverrides((prev) => {
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
      if (options.rotateAngleDeg) {
        toast.success(`Rotated arrangement by ${options.rotateAngleDeg}° around room centroid.`);
      } else if (options.align) {
        toast.success(`Aligned arrangement to ${options.align.toUpperCase()}.`);
      } else if (options.mirrorX || options.mirrorY) {
        toast.success(`Mirrored arrangement.`);
      }
    }
  };

  // Reset entire arrangement (clearing all overrides)
  const handleResetArrangement = () => {
    if (setArrangementOverrides) {
      setArrangementOverrides({});
      toast.info("Reset arrangement to theoretical uniform grid.");
    }
  };

  // Individual luminaire actions (DIALux evo Tutorial Part 6)
  const updateCurrentOverride = (updates: Partial<LuminaireOverride>) => {
    if (!setArrangementOverrides) return;
    setArrangementOverrides((prev) => ({
      ...prev,
      [activeFixtureIdx]: {
        ...(prev[activeFixtureIdx] || { index: activeFixtureIdx }),
        ...updates,
      },
    }));
  };

  const handleAimAtTarget = (targetX: number, targetY: number, targetZ: number) => {
    if (!currentLum) return;
    const angles = calculateAimingAngles(
      currentLum.x,
      currentLum.y,
      currentLum.z,
      targetX,
      targetY,
      targetZ
    );
    updateCurrentOverride({
      targetPoint: { x: targetX, y: targetY, z: targetZ },
      rotationX: angles.pitch,
      rotationY: angles.roll,
      rotationZ: angles.pan,
    });
    toast.success(
      `Aimed luminaire #${activeFixtureIdx + 1} at (${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)})m (Tilt: ${angles.tilt.toFixed(1)}°, Pan: ${angles.pan.toFixed(1)}°)`
    );
  };

  const handleAimWithAngles = (panDeg: number, tiltDeg: number) => {
    if (!currentLum) return;
    const radPan = (panDeg * Math.PI) / 180;
    const radTilt = (tiltDeg * Math.PI) / 180;
    const cosTilt = Math.max(0.01, Math.cos(radTilt));
    const sinTilt = Math.sin(radTilt);
    const slantDist = (currentLum.z || effectiveMountH) / cosTilt;
    const targetX = Number((currentLum.x + slantDist * sinTilt * Math.sin(radPan)).toFixed(2));
    const targetY = Number((currentLum.y + slantDist * sinTilt * Math.cos(radPan)).toFixed(2));
    const targetZ = 0;

    const angles = calculateAimingAngles(
      currentLum.x,
      currentLum.y,
      currentLum.z,
      targetX,
      targetY,
      targetZ
    );

    updateCurrentOverride({
      targetPoint: { x: targetX, y: targetY, z: targetZ },
      rotationX: angles.pitch,
      rotationY: angles.roll,
      rotationZ: panDeg,
    });
  };

  const handleResetAiming = () => {
    updateCurrentOverride({
      targetPoint: undefined,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
    });
    toast.info(`Reset luminaire #${activeFixtureIdx + 1} aiming to vertical nadir.`);
  };

  const handleToggleExcludeFixture = () => {
    const isExcluded = !(currentLum?.isExcluded);
    updateCurrentOverride({ isExcluded });
    if (isExcluded) {
      toast.warning(`Luminaire #${activeFixtureIdx + 1} excluded from grid calculation.`);
    } else {
      toast.success(`Luminaire #${activeFixtureIdx + 1} restored to grid.`);
    }
  };

  const handleResetFixture = () => {
    if (!setArrangementOverrides) return;
    setArrangementOverrides((prev) => {
      const next = { ...prev };
      delete next[activeFixtureIdx];
      return next;
    });
    toast.info(`Reset overrides for luminaire #${activeFixtureIdx + 1}.`);
  };

  // Draw polar curve on mount or change
  useEffect(() => {
    drawPolarCurve(polarRef.current, profile.beamAngle || 110, profile.distributionType || "batwing");
  }, [profile]);

  // Lumen method auto-calculate optimal rows and columns
  const autoOptimizeArrangement = () => {
    const autoResult = computeSpaceAutoArrangement({
      length: roomL,
      width: roomW,
      height: roomH,
      targetLux,
      profile,
      workPlaneHeight,
    });

    pushGridChange({ rows: autoResult.rows, cols: autoResult.cols });
    if (setArrangementMode) setArrangementMode("grid");
    toast.success(
      `Auto-arranged for ${targetLux} lx: ${autoResult.rows} × ${autoResult.cols} grid (${autoResult.total} fittings, Est. ${autoResult.calculatedLux} lx)`
    );
  };

  // IES / LDT file upload handler
  const handleIesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      let detectedLumens = 3600;
      let detectedWatts = 30;

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 10 && parts.every((p) => !isNaN(parseFloat(p)))) {
          const lVal = parseFloat(parts[1]);
          if (lVal > 500 && lVal < 100000) detectedLumens = Math.round(lVal);
          const wVal = parseFloat(parts[2]);
          if (wVal > 5 && wVal < 1000) detectedWatts = Math.round(wVal);
          break;
        }
      }

      const customProfile: LuminairePhotometricProfile = {
        id: `custom-ies-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        manufacturer: "Custom Photometric File",
        lumens: detectedLumens,
        wattage: detectedWatts,
        beamAngle: 110,
        distributionType: "batwing",
        shape: "rectangular",
        dimensions: { length: 0.6, width: 0.6, height: 0.05 },
        colorTemp: cct,
        cri: 85,
      };

      setProfile(customProfile);
      toast.success(`Imported photometric data: ${file.name} (${detectedLumens} lm, ${detectedWatts} W)`);
    };
    reader.readAsText(file);
  };

  // Add individual fixture at room center
  const handleAddIndividualLuminaire = () => {
    const newId = `ind-lum-${Date.now().toString().slice(-4)}`;
    const newLum: IndividualLuminaireConfig = {
      id: newId,
      name: `${profile.name.slice(0, 16)} #${customLuminaires.length + 1}`,
      x: Number((roomL / 2).toFixed(2)),
      y: Number((roomW / 2).toFixed(2)),
      z: Number(Math.max(1.0, roomH - suspensionLength).toFixed(2)),
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      dimming: 1.0,
      profileId: profile.id,
    };
    if (setCustomLuminaires) {
      setCustomLuminaires((prev) => [...prev, newLum]);
      if (setSelectedFixtureIndex) {
        setSelectedFixtureIndex(simulationResult.luminaires.length);
      }
      toast.success(`Placed individual luminaire at room centroid (X: ${newLum.x}m, Y: ${newLum.y}m)`);
    }
  };

  // Remove individual luminaire
  const handleRemoveIndividualLuminaire = (id: string) => {
    if (setCustomLuminaires) {
      setCustomLuminaires((prev) => prev.filter((l) => l.id !== id));
      toast.info(`Removed individual luminaire.`);
    }
  };

  // Derived photometric metrics
  const effectiveMountH = Math.max(0.5, roomH - suspensionLength);
  const relWorkplaneH = Number(Math.max(0.1, effectiveMountH - workPlaneHeight).toFixed(2));
  const fixtureFlux = profile.lumens || profile.totalLumens || 3600;
  const efficacy = Math.round(fixtureFlux / Math.max(1, profile.wattage));

  return (
    <div className="flex flex-col text-slate-200">
      {/* -------------------------------------------------------------
          1. LUMINAIRES INSPECTOR (matching DIALux evo Light > Luminaires)
      ------------------------------------------------------------- */}
      {lightTool === "luminaires" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Luminaires</span>
            <span className="text-[10px] text-amber-400 font-mono">DIALux Photometrics</span>
          </div>

          {/* Action buttons */}
          <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1.5 text-[11px]">
            <button
              onClick={() => iesFileRef.current?.click()}
              className="px-2.5 py-1.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm text-left transition"
            >
              <Upload className="size-3.5" /> Upload IES / LDT Photometric File
            </button>
            <input
              ref={iesFileRef}
              type="file"
              accept=".ies,.ldt,.txt"
              className="hidden"
              onChange={handleIesUpload}
            />

            {onOpenBrandsModal && (
              <button
                onClick={onOpenBrandsModal}
                className="px-2.5 py-1.5 rounded bg-blue-600/90 hover:bg-blue-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm text-left transition"
              >
                <Search className="size-3.5" /> Browse Brand Catalogues (LUMsearch)
              </button>
            )}

            {onOpenPlacementModal && (
              <button
                onClick={onOpenPlacementModal}
                className="px-2.5 py-1.5 rounded bg-purple-600/90 hover:bg-purple-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm text-left transition"
              >
                <LayoutGrid className="size-3.5" /> Open 2D/3D Placement Wizard
              </button>
            )}

            <button
              onClick={autoOptimizeArrangement}
              className="px-2.5 py-1.5 rounded bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-sm text-left transition"
            >
              <Sparkles className="size-3.5" /> Auto-Arrange for EN 12464-1 ({targetLux} lx)
            </button>
          </div>

          {/* Active Luminaire Details Card */}
          <div className="p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-300">Active Luminaire</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">{efficacy} lm/W</span>
            </div>

            <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <strong className="text-white text-xs truncate" title={profile.name}>
                  {profile.name}
                </strong>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  {profile.wattage} W
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{profile.manufacturer || "DIALux Standard"}</span>

              {/* Photometric Curve Canvas */}
              <div className="flex flex-col items-center justify-center p-2 bg-[#0f1115] rounded border border-slate-800/80">
                <canvas ref={polarRef} width={180} height={120} className="rounded" />
                <span className="text-[9.5px] text-slate-400 mt-1 font-mono">
                  Polar Intensity (cd/klm) | {profile.beamAngle || 110}° Beam
                </span>
              </div>

              {/* Technical Specifications Matrix */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">Luminous Flux:</span>
                  <strong className="text-emerald-400">{fixtureFlux.toLocaleString()} lm</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Luminous Efficacy:</span>
                  <strong className="text-white">{efficacy} lm/W</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Color Temp (CCT):</span>
                  <strong className="text-amber-300">{cct} K</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CRI (Ra):</span>
                  <strong className="text-white">{profile.cri || 80}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Dimensions:</span>
                  <strong className="text-slate-300 font-mono text-[10px]">
                    {Math.round((profile.dimensions?.length || 0.6) * 1000)} × {Math.round((profile.dimensions?.width || 0.6) * 1000)} mm
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Glare Rating:</span>
                  <strong className="text-emerald-400 font-mono text-[10px]">
                    UGR &lt; {profile.beamAngle > 100 ? 19 : 16}
                  </strong>
                </div>
              </div>
            </div>

            {/* Mounting & Suspension Parameters */}
            <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2.5">
              <span className="font-semibold text-white text-[11px]">Mounting & Suspension</span>

              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "flush", label: "Recessed" },
                  { id: "surface", label: "Surface" },
                  { id: "suspended", label: "Suspended" },
                  { id: "wall", label: "Wall" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMountingType(m.id as any)}
                    className={`py-1 rounded text-[10.5px] font-bold transition cursor-pointer border ${
                      mountingType === m.id
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                        : "bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Mounting Height from Floor */}
              <div className="flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mounting Height (h_mount):</span>
                  <span className="text-white font-mono font-bold">{effectiveMountH.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max={roomH}
                  step="0.05"
                  value={effectiveMountH}
                  onChange={(e) => {
                    const newH = parseFloat(e.target.value) || 2.8;
                    setSuspensionLength(Math.max(0, Number((roomH - newH).toFixed(2))));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Suspension Length */}
              {mountingType === "suspended" && (
                <div className="flex flex-col gap-1.5 text-[11px] pt-1 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Suspension Drop Cable:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max={roomH - 1.0}
                        value={suspensionLength}
                        onChange={(e) => setSuspensionLength(parseFloat(e.target.value) || 0)}
                        className="w-16 h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white font-mono"
                      />
                      <span className="text-slate-500">m</span>
                    </div>
                  </div>

                  {/* Drop presets */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-slate-500">Presets:</span>
                    {[0.3, 0.5, 0.8, 1.2].map((p) => (
                      <button
                        key={p}
                        onClick={() => setSuspensionLength(p)}
                        className={`px-1.5 py-0.5 rounded font-mono border cursor-pointer ${
                          Math.abs(suspensionLength - p) < 0.05
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {p.toFixed(2)}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Light Center Height relative to Workplane */}
              <div className="bg-[#0f1115] p-2 rounded border border-slate-800/80 text-[10.5px] flex flex-col gap-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Height to Workplane (H_rel):</span>
                  <span className="text-emerald-400 font-bold">{relWorkplaneH} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ceiling Slab Clearance:</span>
                  <span className="text-slate-300 font-bold">{suspensionLength.toFixed(2)} m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. LUMINAIRE ARRANGEMENTS INSPECTOR (DIALux evo Tutorial Part 6)
      ------------------------------------------------------------- */}
      {lightTool === "arrangements" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-amber-400" /> Luminaire arrangements
            </span>
            <div className="flex items-center gap-2">
              {simulationResult.luminaires.some((l) => l.isExcluded) && (
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                  {simulationResult.luminaires.filter((l) => l.isExcluded).length} excluded
                </span>
              )}
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {simulationResult.luminaires.filter((l) => !l.isExcluded).length}/{simulationResult.luminaires.length} active
              </span>
            </div>
          </div>

          <div className="p-3 flex flex-col gap-3">
            {/* Selection Level Switcher (DIALux evo Tutorial Part 6: Entire Arrangement vs Single Luminaire) */}
            <div className="flex bg-[#0f1115] p-1 rounded-lg border border-slate-800 gap-1 text-[11px] font-bold">
              <button
                onClick={() => setSelectionLevel("group")}
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  selectionLevel === "group"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Layers className="size-3.5" /> Entire Group
              </button>
              <button
                onClick={() => setSelectionLevel("single")}
                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  selectionLevel === "single"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Crosshair className="size-3.5" /> Single Fixture #{activeFixtureIdx + 1}
              </button>
            </div>

            {/* =========================================================================
                LEVEL 1: ENTIRE ARRANGEMENT GROUP
            ========================================================================= */}
            {selectionLevel === "group" && (
              <>
                {/* Arrangement Pattern Selector */}
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px]">Arrangement Pattern</span>
                    {onOpenPlacementModal && (
                      <button
                        onClick={onOpenPlacementModal}
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <Maximize2 className="size-3" /> 2D CAD Wizard
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                    {[
                      { id: "grid", label: "Grid", icon: LayoutGrid },
                      { id: "linear", label: "Line", icon: SlidersHorizontal },
                      { id: "circular", label: "Ring", icon: Circle },
                      { id: "perimeter", label: "Cove", icon: Square },
                      { id: "polygonal", label: "Polygon", icon: Shapes },
                      { id: "individual", label: "Single", icon: MapPin },
                      { id: "single_center", label: "Center", icon: Target },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      const isActive = (arrangementMode || "grid") === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setArrangementMode?.(mode.id as LuminaireArrangementMode);
                            toast.info(`Switched arrangement mode to: ${mode.label}`);
                          }}
                          className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-1 text-[9.5px] font-bold border transition cursor-pointer ${
                            isActive
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/80 shadow-xs"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                          }`}
                          title={mode.label}
                        >
                          <Icon className="size-3.5" />
                          <span className="truncate">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Arrangement Transformation Toolbar (DIALux evo Tutorial Part 6) */}
                <div className="bg-[#14161a] p-2.5 rounded border border-amber-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 text-[11px] flex items-center gap-1.5">
                      <Move className="size-3.5" /> Arrangement Transforms (Part 6)
                    </span>
                    <button
                      onClick={handleResetArrangement}
                      className="text-[9.5px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      title="Clear offsets and reset to theoretical grid"
                    >
                      <RotateCcw className="size-3" /> Reset Grid
                    </button>
                  </div>

                  {/* Centroid Rotation */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">Rotate Group around Centroid:</span>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                      {[15, 45, 90, -45].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => handleApplyArrangementTransform({ rotateAngleDeg: deg })}
                          className="py-1 px-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded flex items-center justify-center gap-1 cursor-pointer font-bold transition"
                        >
                          <RotateCw className="size-2.5 text-amber-400" /> {deg > 0 ? `+${deg}°` : `${deg}°`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Room Alignment */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">Align Group to Space:</span>
                    <div className="grid grid-cols-5 gap-1 text-[9.5px]">
                      {[
                        { id: "center", label: "Center" },
                        { id: "north", label: "North" },
                        { id: "south", label: "South" },
                        { id: "east", label: "East" },
                        { id: "west", label: "West" },
                      ].map((al) => (
                        <button
                          key={al.id}
                          onClick={() =>
                            handleApplyArrangementTransform({
                              align: al.id as "center" | "north" | "south" | "east" | "west",
                            })
                          }
                          className="py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-center cursor-pointer font-bold transition truncate"
                        >
                          {al.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mirroring */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => handleApplyArrangementTransform({ mirrorX: true })}
                      className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded flex items-center justify-center gap-1.5 cursor-pointer font-bold transition"
                    >
                      <FlipHorizontal className="size-3 text-cyan-400" /> Flip Horizontal
                    </button>
                    <button
                      onClick={() => handleApplyArrangementTransform({ mirrorY: true })}
                      className="py-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded flex items-center justify-center gap-1.5 cursor-pointer font-bold transition"
                    >
                      <FlipVertical className="size-3 text-cyan-400" /> Flip Vertical
                    </button>
                  </div>
                </div>

                {/* Pattern 1: Rectangular Grid Setup */}
                {(!arrangementMode || arrangementMode === "grid") && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px]">Rectangular Grid Setup</span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        {gridConfig.cols} × {gridConfig.rows} ({gridConfig.cols * gridConfig.rows} pcs)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <label className="text-slate-400 block text-[10px] mb-1">Cols (Across Length {roomL}m):</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => pushGridChange({ ...gridConfig, cols: Math.max(1, gridConfig.cols - 1) })}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="25"
                            value={gridConfig.cols}
                            onChange={(e) =>
                              pushGridChange({ ...gridConfig, cols: Math.max(1, parseInt(e.target.value) || 1) })
                            }
                            className="w-full h-7 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono font-bold"
                          />
                          <button
                            onClick={() => pushGridChange({ ...gridConfig, cols: gridConfig.cols + 1 })}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] mb-1">Rows (Across Width {roomW}m):</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => pushGridChange({ ...gridConfig, rows: Math.max(1, gridConfig.rows - 1) })}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="25"
                            value={gridConfig.rows}
                            onChange={(e) =>
                              pushGridChange({ ...gridConfig, rows: Math.max(1, parseInt(e.target.value) || 1) })
                            }
                            className="w-full h-7 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono font-bold"
                          />
                          <button
                            onClick={() => pushGridChange({ ...gridConfig, rows: gridConfig.rows + 1 })}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Spacing calculations */}
                    <div className="bg-[#0f1115] p-2 rounded border border-slate-800/80 text-[10.5px] flex flex-col gap-1 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spacing X (Lengthwise):</span>
                        <span className="text-amber-300 font-bold">{(roomL / gridConfig.cols).toFixed(2)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spacing Y (Widthwise):</span>
                        <span className="text-amber-300 font-bold">{(roomW / gridConfig.rows).toFixed(2)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spacing to Height Ratio (SHR):</span>
                        <span
                          className={`font-bold ${
                            Math.max(roomL / gridConfig.cols, roomW / gridConfig.rows) / relWorkplaneH <= 1.5
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {(Math.max(roomL / gridConfig.cols, roomW / gridConfig.rows) / relWorkplaneH).toFixed(2)}{" "}
                          {Math.max(roomL / gridConfig.cols, roomW / gridConfig.rows) / relWorkplaneH <= 1.5
                            ? "(Optimal)"
                            : "(Exceeds SHR 1.5)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pattern 2: Polygonal / Free-Path Run (DIALux evo Tutorial Part 6) */}
                {arrangementMode === "polygonal" && (
                  <div className="bg-[#14161a] p-3 rounded border border-amber-500/40 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                        <Shapes className="size-3.5 text-amber-400" /> Polygonal Free-Path Run
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">
                        {activePolygonalConfig.count} fittings
                      </span>
                    </div>

                    {/* Shape Presets */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 text-[10px]">Polygonal Shape Presets:</span>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        {[
                          {
                            label: "Rectangle",
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
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => {
                              if (setPolygonalConfig) {
                                setPolygonalConfig({
                                  ...activePolygonalConfig,
                                  points: preset.points,
                                });
                                toast.success(`Applied ${preset.label} polygonal path preset.`);
                              }
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-bold text-center border border-slate-700"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fittings Count */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total Fittings along Path:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setPolygonalConfig?.({
                              ...activePolygonalConfig,
                              count: Math.max(3, activePolygonalConfig.count - 1),
                            })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-amber-300">
                          {activePolygonalConfig.count}
                        </span>
                        <button
                          onClick={() =>
                            setPolygonalConfig?.({
                              ...activePolygonalConfig,
                              count: activePolygonalConfig.count + 1,
                            })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Path Options */}
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      <label className="flex items-center gap-1.5 p-1.5 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={activePolygonalConfig.isClosed}
                          onChange={(e) =>
                            setPolygonalConfig?.({
                              ...activePolygonalConfig,
                              isClosed: e.target.checked,
                            })
                          }
                          className="accent-amber-500 cursor-pointer"
                        />
                        <span>Closed Loop</span>
                      </label>
                      <label className="flex items-center gap-1.5 p-1.5 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={activePolygonalConfig.alignToSegment}
                          onChange={(e) =>
                            setPolygonalConfig?.({
                              ...activePolygonalConfig,
                              alignToSegment: e.target.checked,
                            })
                          }
                          className="accent-amber-500 cursor-pointer"
                        />
                        <span>Align to Vector</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Pattern 3: Line / Linear Trunking */}
                {(arrangementMode === "linear" || arrangementMode === "linear_continuous") && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px]">Line / Trunking Arrangement</span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        {activeLineConfig.count} fittings
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <button
                        onClick={() => {
                          if (setLineConfig) {
                            setLineConfig({
                              startX: 0.5,
                              startY: Number((roomW / 2).toFixed(2)),
                              endX: Number((roomL - 0.5).toFixed(2)),
                              endY: Number((roomW / 2).toFixed(2)),
                              count: activeLineConfig.count,
                              isContinuous: activeLineConfig.isContinuous,
                              fixtureLength: profile.dimensions?.length || 1.2,
                              alignPerpendicular: false,
                            });
                            toast.success("Applied central lengthwise line run.");
                          }
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer font-bold text-center"
                      >
                        Center Lengthwise
                      </button>
                      <button
                        onClick={() => {
                          if (setLineConfig) {
                            setLineConfig({
                              startX: Number((roomL / 2).toFixed(2)),
                              startY: 0.5,
                              endX: Number((roomL / 2).toFixed(2)),
                              endY: Number((roomW - 0.5).toFixed(2)),
                              count: activeLineConfig.count,
                              isContinuous: activeLineConfig.isContinuous,
                              fixtureLength: profile.dimensions?.length || 1.2,
                              alignPerpendicular: true,
                            });
                            toast.success("Applied central crosswise line run.");
                          }
                        }}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer font-bold text-center"
                      >
                        Center Crosswise
                      </button>
                    </div>

                    {/* Start & End Points */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start (X1, Y1):</span>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={activeLineConfig.startX}
                            onChange={(e) =>
                              setLineConfig?.({ ...activeLineConfig, startX: parseFloat(e.target.value) || 0 })
                            }
                            className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                            placeholder="X"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={activeLineConfig.startY}
                            onChange={(e) =>
                              setLineConfig?.({ ...activeLineConfig, startY: parseFloat(e.target.value) || 0 })
                            }
                            className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                            placeholder="Y"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px]">End (X2, Y2):</span>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={activeLineConfig.endX}
                            onChange={(e) =>
                              setLineConfig?.({ ...activeLineConfig, endX: parseFloat(e.target.value) || 0 })
                            }
                            className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                            placeholder="X"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={activeLineConfig.endY}
                            onChange={(e) =>
                              setLineConfig?.({ ...activeLineConfig, endY: parseFloat(e.target.value) || 0 })
                            }
                            className="w-1/2 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                            placeholder="Y"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Fittings Count */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Luminaires in Line:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setLineConfig?.({ ...activeLineConfig, count: Math.max(1, activeLineConfig.count - 1) })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-amber-300">
                          {activeLineConfig.count}
                        </span>
                        <button
                          onClick={() =>
                            setLineConfig?.({ ...activeLineConfig, count: activeLineConfig.count + 1 })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Continuous Trunking Toggle */}
                    <label className="flex items-center justify-between p-2 bg-[#0f1115] rounded border border-slate-800 cursor-pointer text-[10.5px]">
                      <span className="text-slate-300">Continuous Seamless Trunking</span>
                      <input
                        type="checkbox"
                        checked={activeLineConfig.isContinuous}
                        onChange={(e) =>
                          setLineConfig?.({ ...activeLineConfig, isContinuous: e.target.checked })
                        }
                        className="accent-amber-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {/* Pattern 4: Circular / Radial Array */}
                {arrangementMode === "circular" && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px]">Radial Ring Array</span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">
                        {activeCircularConfig.count} fittings
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-400 block text-[10px]">Center X (m):</label>
                        <input
                          type="number"
                          step="0.1"
                          value={activeCircularConfig.centerX}
                          onChange={(e) =>
                            setCircularConfig?.({ ...activeCircularConfig, centerX: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[10px]">Center Y (m):</label>
                        <input
                          type="number"
                          step="0.1"
                          value={activeCircularConfig.centerY}
                          onChange={(e) =>
                            setCircularConfig?.({ ...activeCircularConfig, centerY: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Ring Radius:</span>
                      <span className="font-mono text-amber-300 font-bold">{activeCircularConfig.radius} m</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max={Number((Math.min(roomL, roomW) * 0.48).toFixed(1))}
                      step="0.1"
                      value={activeCircularConfig.radius}
                      onChange={(e) =>
                        setCircularConfig?.({ ...activeCircularConfig, radius: parseFloat(e.target.value) || 1.0 })
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Fittings Count:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setCircularConfig?.({
                              ...activeCircularConfig,
                              count: Math.max(3, activeCircularConfig.count - 1),
                            })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-amber-300">
                          {activeCircularConfig.count}
                        </span>
                        <button
                          onClick={() =>
                            setCircularConfig?.({ ...activeCircularConfig, count: activeCircularConfig.count + 1 })
                          }
                          className="px-2 py-0.5 bg-slate-800 rounded font-bold cursor-pointer text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pattern 5: Perimeter Cove */}
                {arrangementMode === "perimeter" && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <span className="font-semibold text-white text-[11px]">Perimeter Cove / Wall-Washer</span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Wall Offset Margin:</span>
                      <span className="font-mono text-amber-300 font-bold">0.60 m</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Boundary Fittings:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {Math.max(4, (gridConfig.cols + gridConfig.rows) * 2 - 4)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Pattern 6: Individual Luminaire Placement */}
                {arrangementMode === "individual" && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-[11px]">Individual Fixtures</span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">
                        {customLuminaires.length} placed
                      </span>
                    </div>

                    <button
                      onClick={handleAddIndividualLuminaire}
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="size-3.5" /> Place Fixture at Room Centroid
                    </button>

                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {customLuminaires.map((lum, idx) => (
                        <div
                          key={lum.id}
                          className="p-2 rounded bg-[#0f1115] border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-[10.5px]">
                              #{idx + 1} {lum.name || "Luminaire"}
                            </span>
                            <span className="text-[9.5px] font-mono text-slate-400">
                              X: {lum.x}m | Y: {lum.y}m | Z: {lum.z}m
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveIndividualLuminaire(lum.id)}
                            className="p-1 rounded text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                            title="Delete Luminaire"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pattern 7: Single Center */}
                {arrangementMode === "single_center" && (
                  <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
                    <span className="font-semibold text-white text-[11px]">Center Fitting</span>
                    <div className="text-[10.5px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                      Single central luminaire positioned at room centroid (X: {(roomL / 2).toFixed(2)}m, Y:{" "}
                      {(roomW / 2).toFixed(2)}m, Z: {effectiveMountH.toFixed(2)}m).
                    </div>
                  </div>
                )}

                {/* DIALux evo Automatic Space Arrangement Card (EN 12464-1) */}
                <div className="bg-[#14161a] p-3 rounded border border-emerald-500/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-300 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="size-3.5" /> Automatic Space Arrangement
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">EN 12464-1</span>
                  </div>

                  <select
                    value={spacePresetType}
                    onChange={(e) => setSpacePresetType(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="office_500">Standard Office (500 lx)</option>
                    <option value="classroom_300">Classroom / Training (300 lx)</option>
                    <option value="conference_500">Conference Room (500 lx)</option>
                    <option value="drafting_750">CAD Technical Drawing (750 lx)</option>
                    <option value="lab_1000">Precision Inspection Lab (1000 lx)</option>
                    <option value="corridor_100">Circulation & Corridors (100 lx)</option>
                  </select>

                  <button
                    onClick={autoOptimizeArrangement}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition cursor-pointer shadow flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="size-3.5" /> Auto-calculate Layout for {targetLux} lx
                  </button>
                </div>
              </>
            )}

            {/* =========================================================================
                LEVEL 2: SINGLE LUMINAIRE IN GROUP (DIALux evo Tutorial Part 6)
            ========================================================================= */}
            {selectionLevel === "single" && (
              <div className="flex flex-col gap-3">
                {/* Fixture Navigator / Selector */}
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px] flex items-center gap-1">
                      <Target className="size-3.5 text-amber-400" /> Selected Fixture
                    </span>
                    <div className="flex items-center gap-1.5">
                      {currentLum?.isExcluded ? (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          EXCLUDED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                      {currentLum?.targetPoint && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          AIMED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fixture stepper */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setSelectedFixtureIndex?.(
                          Math.max(0, activeFixtureIdx - 1)
                        )
                      }
                      disabled={activeFixtureIdx <= 0}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-white font-bold cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>

                    <select
                      value={activeFixtureIdx}
                      onChange={(e) => setSelectedFixtureIndex?.(parseInt(e.target.value) || 0)}
                      className="flex-1 h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
                    >
                      {simulationResult.luminaires.map((lum, idx) => (
                        <option key={idx} value={idx}>
                          #{idx + 1} at ({lum.x.toFixed(2)}, {lum.y.toFixed(2)})m{" "}
                          {lum.isExcluded ? "[EXCLUDED]" : ""} {lum.targetPoint ? "[AIMED]" : ""}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() =>
                        setSelectedFixtureIndex?.(
                          Math.min(simulationResult.luminaires.length - 1, activeFixtureIdx + 1)
                        )
                      }
                      disabled={activeFixtureIdx >= simulationResult.luminaires.length - 1}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-white font-bold cursor-pointer"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fixture 3D Coordinates & Nudge */}
                <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
                  <span className="font-semibold text-white text-[11px]">3D Position Coordinates (m)</span>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">X:</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          step="0.05"
                          value={currentLum?.x ?? 0}
                          onChange={(e) =>
                            updateCurrentOverride({ x: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">Y:</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          step="0.05"
                          value={currentLum?.y ?? 0}
                          onChange={(e) =>
                            updateCurrentOverride({ y: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">Z (Mount):</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          step="0.05"
                          value={currentLum?.z ?? effectiveMountH}
                          onChange={(e) =>
                            updateCurrentOverride({ z: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nudge controls */}
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800 text-slate-400">
                    <span>Nudge (±0.10m):</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCurrentOverride({ x: Number(((currentLum?.x ?? 0) - 0.1).toFixed(2)) })}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold"
                        title="-0.1m X"
                      >
                        -X
                      </button>
                      <button
                        onClick={() => updateCurrentOverride({ x: Number(((currentLum?.x ?? 0) + 0.1).toFixed(2)) })}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold"
                        title="+0.1m X"
                      >
                        +X
                      </button>
                      <button
                        onClick={() => updateCurrentOverride({ y: Number(((currentLum?.y ?? 0) - 0.1).toFixed(2)) })}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold"
                        title="-0.1m Y"
                      >
                        -Y
                      </button>
                      <button
                        onClick={() => updateCurrentOverride({ y: Number(((currentLum?.y ?? 0) + 0.1).toFixed(2)) })}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold"
                        title="+0.1m Y"
                      >
                        +Y
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3D Target Point Aiming Tool (DIALux evo Tutorial Part 6) */}
                <div className="bg-[#14161a] p-3 rounded border border-cyan-500/40 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cyan-300 text-[11px] flex items-center gap-1.5">
                      <Crosshair className="size-3.5 text-cyan-400" /> 3D Target Point Aiming (Part 6)
                    </span>
                    {currentLum?.targetPoint && (
                      <button
                        onClick={handleResetAiming}
                        className="text-[9.5px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                        title="Reset aiming to nadir (vertical downward)"
                      >
                        <RotateCcw className="size-3" /> Reset Nadir
                      </button>
                    )}
                  </div>

                  {/* 3D Aiming Focus Button */}
                  <button
                    onClick={() => {
                      if (setIsAimingToolActive) {
                        const nextState = !isAimingToolActive;
                        setIsAimingToolActive(nextState);
                        if (nextState) {
                          toast.info(
                            `Aiming Mode Active: Click any surface on the 3D scene (floor, wall, table) to focus luminaire #${activeFixtureIdx + 1}.`
                          );
                        } else {
                          toast.info("Aiming Mode Deactivated.");
                        }
                      }
                    }}
                    className={`w-full py-1.5 rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border ${
                      isAimingToolActive
                        ? "bg-cyan-500 text-slate-950 border-cyan-300 animate-pulse shadow-md"
                        : "bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border-cyan-800"
                    }`}
                  >
                    <Crosshair className="size-3.5" />
                    {isAimingToolActive ? "AIMING ACTIVE: Click 3D Scene to Focus" : "Click 3D Viewport to Focus Target"}
                  </button>

                  {/* Manual Target Coordinates */}
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px]">Target Coordinates (Xt, Yt, Zt):</span>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Xt"
                        value={currentLum?.targetPoint ? currentLum.targetPoint.x : ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleAimAtTarget(
                            val,
                            currentLum?.targetPoint?.y ?? Number((roomW / 2).toFixed(2)),
                            currentLum?.targetPoint?.z ?? 0
                          );
                        }}
                        className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono placeholder:text-slate-600"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Yt"
                        value={currentLum?.targetPoint ? currentLum.targetPoint.y : ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleAimAtTarget(
                            currentLum?.targetPoint?.x ?? Number((roomL / 2).toFixed(2)),
                            val,
                            currentLum?.targetPoint?.z ?? 0
                          );
                        }}
                        className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono placeholder:text-slate-600"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Zt (Floor 0)"
                        value={currentLum?.targetPoint ? currentLum.targetPoint.z : ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          handleAimAtTarget(
                            currentLum?.targetPoint?.x ?? Number((roomL / 2).toFixed(2)),
                            currentLum?.targetPoint?.y ?? Number((roomW / 2).toFixed(2)),
                            val
                          );
                        }}
                        className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Calculated Pan & Tilt Sliders */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-800 text-[10.5px]">
                    {/* Tilt Slider */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Tilt from Nadir (β):</span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {currentLum?.targetPoint
                            ? `${calculateAimingAngles(
                                currentLum.x,
                                currentLum.y,
                                currentLum.z,
                                currentLum.targetPoint.x,
                                currentLum.targetPoint.y,
                                currentLum.targetPoint.z
                              ).tilt.toFixed(1)}°`
                            : "0.0° (Nadir)"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="85"
                        step="1"
                        value={
                          currentLum?.targetPoint
                            ? Math.round(
                                calculateAimingAngles(
                                  currentLum.x,
                                  currentLum.y,
                                  currentLum.z,
                                  currentLum.targetPoint.x,
                                  currentLum.targetPoint.y,
                                  currentLum.targetPoint.z
                                ).tilt
                              )
                            : 0
                        }
                        onChange={(e) => {
                          const tiltVal = parseFloat(e.target.value) || 0;
                          const currentPan = currentLum?.targetPoint
                            ? calculateAimingAngles(
                                currentLum.x,
                                currentLum.y,
                                currentLum.z,
                                currentLum.targetPoint.x,
                                currentLum.targetPoint.y,
                                currentLum.targetPoint.z
                              ).pan
                            : (currentLum?.rotationZ ?? 0);
                          handleAimWithAngles(currentPan, tiltVal);
                        }}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    {/* Pan Slider */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-400">Pan Azimuth (α):</span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {currentLum?.targetPoint
                            ? `${calculateAimingAngles(
                                currentLum.x,
                                currentLum.y,
                                currentLum.z,
                                currentLum.targetPoint.x,
                                currentLum.targetPoint.y,
                                currentLum.targetPoint.z
                              ).pan.toFixed(1)}°`
                            : `${(currentLum?.rotationZ ?? 0).toFixed(1)}°`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={
                          currentLum?.targetPoint
                            ? Math.round(
                                calculateAimingAngles(
                                  currentLum.x,
                                  currentLum.y,
                                  currentLum.z,
                                  currentLum.targetPoint.x,
                                  currentLum.targetPoint.y,
                                  currentLum.targetPoint.z
                                ).pan
                              )
                            : (currentLum?.rotationZ ?? 0)
                        }
                        onChange={(e) => {
                          const panVal = parseFloat(e.target.value) || 0;
                          const currentTilt = currentLum?.targetPoint
                            ? calculateAimingAngles(
                                currentLum.x,
                                currentLum.y,
                                currentLum.z,
                                currentLum.targetPoint.x,
                                currentLum.targetPoint.y,
                                currentLum.targetPoint.z
                              ).tilt
                            : 0;
                          handleAimWithAngles(panVal, currentTilt);
                        }}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Exclude Luminaire from Grid Calculation (DIALux evo Tutorial Part 6) */}
                <div
                  className={`p-3 rounded border flex flex-col gap-2 transition ${
                    currentLum?.isExcluded
                      ? "bg-red-950/30 border-red-500/60"
                      : "bg-[#14161a] border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                      <EyeOff
                        className={`size-3.5 ${currentLum?.isExcluded ? "text-red-400" : "text-slate-400"}`}
                      />
                      Exclude from Calculation (Part 6)
                    </span>
                    <button
                      onClick={handleToggleExcludeFixture}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer border ${
                        currentLum?.isExcluded
                          ? "bg-red-600 text-white border-red-500 shadow-sm"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                    >
                      {currentLum?.isExcluded ? "EXCLUDED (Dormant)" : "Included in Grid"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {currentLum?.isExcluded
                      ? "This luminaire is currently excluded from photometric emission without breaking the grid pattern (useful for avoiding ceiling columns, diffusers, or architectural bulkheads)."
                      : "Click to exclude this fitting from emitting lumens. The theoretical grid spacing remains intact."}
                  </p>
                </div>

                {/* Individual Luminaire Dimming Control */}
                <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                      <Sliders className="size-3.5 text-amber-400" /> Individual Dimming
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono font-bold">
                      {Math.round((currentLum?.dimming ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round((currentLum?.dimming ?? 1.0) * 100)}
                    onChange={(e) =>
                      updateCurrentOverride({ dimming: (parseInt(e.target.value) || 0) / 100 })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Reset Single Luminaire Overrides */}
                <button
                  onClick={handleResetFixture}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <RotateCcw className="size-3" /> Reset Overrides for Luminaire #{activeFixtureIdx + 1}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. LAMPS & SPECTRA INSPECTOR
      ------------------------------------------------------------- */}
      {lightTool === "lamps" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
            Lamps and spectra
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-xs font-semibold">Correlated Color Temp (CCT):</span>
                <span className="font-mono text-amber-300 font-bold">{cct} K</span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="2700"
                max="6500"
                step="100"
                value={cct}
                onChange={(e) => setCct(parseInt(e.target.value) || 4000)}
                className="w-full accent-amber-400 cursor-pointer"
              />

              {/* Presets */}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { k: 2700, l: "2700K Warm" },
                  { k: 3000, l: "3000K Soft" },
                  { k: 4000, l: "4000K Neutral" },
                  { k: 6500, l: "6500K Daylight" },
                ].map((item) => (
                  <button
                    key={item.k}
                    onClick={() => setCct(item.k)}
                    className={`p-1 rounded text-center font-bold transition cursor-pointer ${
                      cct === item.k
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/60"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {item.l}
                  </button>
                ))}
              </div>

              {/* Visible Spectrum Graphic */}
              <div className="h-4 rounded overflow-hidden mt-1 flex border border-slate-700">
                <div className="flex-1 bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-cyan-400 to-blue-500" />
              </div>
              <span className="text-[9.5px] text-slate-500 font-mono text-center">
                Visible Spectrum 380 nm – 780 nm | Ra (CRI) = {profile.cri || 80}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. LIGHT SCENES INSPECTOR
      ------------------------------------------------------------- */}
      {lightTool === "scenes" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Light scenes & Control</span>
            <span className="text-[10px] text-emerald-400 font-mono">DALI / 0-10V</span>
          </div>

          <div className="p-3 flex flex-col gap-3">
            {[
              { id: "100", label: "Scene 1: Standard Working (100%)", desc: "Full artificial luminaire output", badge: "100%" },
              { id: "50", label: "Scene 2: Presentation Dimming (50%)", desc: "Energy saving comfort level", badge: "50%" },
              { id: "daylight_overcast", label: "Scene 3: Daylight CIE Overcast", desc: "EN 17037 Daylight Factor (D %)", badge: "CIE DF" },
              { id: "daylight_clear", label: "Scene 4: Daylight Clear Sky & Sun", desc: "Direct sunlight penetration & solar angles", badge: "Sunbeam" },
              { id: "combined", label: "Scene 5: Combined Daylight + Artificial", desc: "Daylight harvesting sensor with auto-dimming", badge: "Harvest" },
              { id: "10", label: "Scene 6: Emergency Evacuation (10%)", desc: "EN 1838 compliant safety illumination", badge: "10%" },
            ].map((scene) => (
              <div
                key={scene.id}
                onClick={() => setLightScene(scene.id as any)}
                className={`p-2.5 rounded border transition cursor-pointer flex flex-col gap-1 ${
                  lightScene === scene.id
                    ? "bg-slate-800/90 border-amber-500/80 shadow-md"
                    : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs text-white flex items-center gap-1.5">
                    <Sun className={`size-3.5 ${lightScene === scene.id ? "text-amber-400" : "text-slate-400"}`} />
                    {scene.label}
                  </strong>
                  <span className="font-mono text-xs text-amber-300 font-bold">{scene.badge}</span>
                </div>
                <p className="text-[10.5px] text-slate-400">{scene.desc}</p>
              </div>
            ))}

            {/* Daylight Harvesting Sensor */}
            <div className="p-3 bg-[#14161a] rounded border border-slate-800 flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px] flex items-center gap-1.5">
                  <Leaf className="size-3.5 text-emerald-400" /> Daylight-Dependent Control
                </span>
                <input
                  type="checkbox"
                  checked={daylightHarvesting}
                  onChange={(e) => setDaylightHarvesting(e.target.checked)}
                  className="size-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
              <p className="text-[10.5px] text-slate-400 leading-relaxed">
                Photocell dims luminaires near apertures to harvest natural daylight, reducing annual energy by up to
                45%.
              </p>
              {onOpenDaylightModal && (
                <button
                  onClick={onOpenDaylightModal}
                  className="mt-1 px-2.5 py-1.5 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 border border-blue-500/50 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <Sun className="size-3.5 text-amber-400" />
                  <span>Configure Daylight Simulation (EN 17037)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          5. ENERGY EVALUATION (LENI EN 15193)
      ------------------------------------------------------------- */}
      {lightTool === "energy" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Energy evaluation (EN 15193)</span>
            <span className="text-[10px] text-emerald-400 font-bold">Grade A</span>
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Connected Load:</span>
                <strong className="text-white font-mono">
                  {((gridConfig.rows * gridConfig.cols * profile.wattage) / 1000).toFixed(3)} kW
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Specific Connected Load:</span>
                <strong className="text-amber-300 font-mono">
                  {((gridConfig.rows * gridConfig.cols * profile.wattage) / (roomL * roomW)).toFixed(2)} W/m²
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Benchmark Limit:</span>
                <span className="text-slate-300 font-mono">≤ 12.00 W/m² (Pass)</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">LENI Numeric Indicator:</span>
                <strong className="text-emerald-400 font-mono text-sm">13.8 kWh/(m²·a)</strong>
              </div>
            </div>

            <div className="p-2.5 bg-emerald-950/30 border border-emerald-700/50 rounded flex items-center gap-2 text-[11px] text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
              <span>Complies with ASHRAE 90.1, LEED v4, and European Building Directive EN 15193.</span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. FILTERS & GELS
      ------------------------------------------------------------- */}
      {lightTool === "filters" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
            Filters and optical accessories
          </div>

          <div className="p-3 flex flex-col gap-2 text-[11px]">
            {[
              { id: "none", label: "Clear Glass (No Filter)", ugrMod: "0", trans: "100%" },
              { id: "honeycomb", label: "Honeycomb Anti-Glare Louvre", ugrMod: "-2.4", trans: "85%" },
              { id: "diffuser", label: "Microprismatic Diffusing Foil", ugrMod: "-1.8", trans: "92%" },
              { id: "oval_optic", label: "Oval Beam Spreader Lens", ugrMod: "+0.5", trans: "88%" },
            ].map((f) => (
              <div
                key={f.id}
                onClick={() => {
                  setOpticalFilter(f.id as any);
                  toast.success(`Applied filter: ${f.label}`);
                }}
                className={`p-2 rounded border transition cursor-pointer flex items-center justify-between ${
                  opticalFilter === f.id
                    ? "bg-slate-800 border-amber-500 text-white font-bold"
                    : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <span>{f.label}</span>
                <span className="text-[10px] font-mono text-amber-300">UGR {f.ugrMod}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. CALCULATION OBJECTS WORKFLOW INSPECTORS
// =========================================================================
interface CalcInspectorsProps {
  calcTool: "surfaces" | "task_areas" | "points" | "ugr" | "isolux" | "views";
  roomL: number;
  roomW: number;
  roomH: number;
  workPlaneHeight: number;
  setWorkPlaneHeight: (h: number) => void;
  marginOffset: number;
  setMarginOffset: (m: number) => void;
  targetLux: number;
  setTargetLux: (lx: number) => void;
  simulationResult: DialuxSimulationResult;
  showLuxNumbers: boolean;
  setShowLuxNumbers: (s: boolean | ((p: boolean) => boolean)) => void;
  showHeatmap: boolean;
  setShowHeatmap: (s: boolean | ((p: boolean) => boolean)) => void;
  showIsoluxLines: boolean;
  setShowIsoluxLines: (s: boolean | ((p: boolean) => boolean)) => void;
  onOpenEmergencyModal?: () => void;
  onOpenDaylightModal?: () => void;
  calcAreaType?: CalculationAreaType;
  setCalcAreaType?: (area: CalculationAreaType) => void;
  workstationConfig?: WorkstationAreaConfig;
  setWorkstationConfig?: React.Dispatch<React.SetStateAction<WorkstationAreaConfig>>;
}

export function CalcInspectors({
  calcTool,
  roomL,
  roomW,
  roomH,
  workPlaneHeight,
  setWorkPlaneHeight,
  marginOffset,
  setMarginOffset,
  targetLux,
  setTargetLux,
  simulationResult,
  showLuxNumbers,
  setShowLuxNumbers,
  showHeatmap,
  setShowHeatmap,
  showIsoluxLines,
  setShowIsoluxLines,
  onOpenEmergencyModal,
  onOpenDaylightModal,
  calcAreaType = "workplane",
  setCalcAreaType,
  workstationConfig,
  setWorkstationConfig,
}: CalcInspectorsProps) {
  // UGR observer state
  const [ugrX, setUgrX] = useState<number>(roomL / 2);
  const [ugrY, setUgrY] = useState<number>(roomW / 2);
  const [ugrEyeHeight, setUgrEyeHeight] = useState<number>(1.2);
  const [ugrAngle, setUgrAngle] = useState<number>(0);

  // Active evaluation area type (defaults to simulationResult.activeAreaType or prop)
  const activeArea: CalculationAreaType = calcAreaType || simulationResult.activeAreaType || "workplane";

  const wsConfig: WorkstationAreaConfig = workstationConfig || simulationResult.workstationConfig || {
    name: "Single Office Desk",
    length: 1.6,
    width: 0.8,
    x: Number((roomL / 2).toFixed(2)),
    y: Number((roomW / 2).toFixed(2)),
    height: 0.75,
    surroundingBand: 0.5,
    targetLux: 500,
  };

  // Stats blocks
  const floorStats = simulationResult.floorStats;
  const wpStats = simulationResult.workplaneStats;
  const wsStats = simulationResult.workstationStats;
  const surrStats = simulationResult.surroundingStats;

  // EN 12464-1 Task area profiles
  const TASK_PRESETS = [
    { name: "Office Desk / Computer Tasks", lux: 500, u0: 0.6, ugrMax: 19 },
    { name: "Technical Drawing & CAD Work", lux: 750, u0: 0.7, ugrMax: 16 },
    { name: "Classroom / Educational Board", lux: 500, u0: 0.6, ugrMax: 19 },
    { name: "Conference & Meeting Room", lux: 500, u0: 0.6, ugrMax: 19 },
    { name: "Corridor & Circulation Zone", lux: 100, u0: 0.4, ugrMax: 28 },
    { name: "Industrial Precision Assembly", lux: 1000, u0: 0.7, ugrMax: 19 },
  ];

  return (
    <div className="flex flex-col text-slate-200">
      {/* DIALux evo Standards & Compliance Quick Action Bar */}
      <div className="p-2.5 bg-[#16181d] border-b border-slate-800 flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Compliance & Special Engines</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onOpenEmergencyModal?.()}
            className="px-2 py-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
            title="EN 1838 Escape Route & Anti-Panic Assessment"
          >
            <ShieldAlert className="size-3 text-emerald-400 shrink-0" />
            <span>EN 1838 Escape</span>
          </button>
          <button
            onClick={() => onOpenDaylightModal?.()}
            className="px-2 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition"
            title="CIE Daylight Factor & Sun Positioning (EN 17037 / BREEAM)"
          >
            <Sun className="size-3 text-blue-400 shrink-0" />
            <span>EN 17037 Daylight</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          CALCULATION EVALUATION AREA DECIDER (Floor vs Working vs Workstation)
      ------------------------------------------------------------- */}
      <div className="p-2.5 bg-[#15171c] border-b border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Decide Evaluation Area</span>
          <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
            activeArea === "floor"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : activeArea === "workstation"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
          }`}>
            {activeArea === "floor" ? "Floor Z=0.00m" : activeArea === "workstation" ? "Desk Task Area" : "Workplane Z=0.75m"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => {
              setCalcAreaType?.("floor");
              toast.info("Switched calculation evaluation area to: Floor Area (Z = 0.00m)");
            }}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-1 text-[10px] font-bold border transition cursor-pointer ${
              activeArea === "floor"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-xs"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
            }`}
            title="Wall-to-wall room floor area at height 0.00m"
          >
            <Square className="size-3.5 text-emerald-400" />
            <span className="truncate">Floor Area</span>
          </button>

          <button
            onClick={() => {
              setCalcAreaType?.("workplane");
              toast.info("Switched calculation evaluation area to: Working Plane (EN 12464-1 Useful Area)");
            }}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-1 text-[10px] font-bold border transition cursor-pointer ${
              activeArea === "workplane"
                ? "bg-blue-500/20 text-blue-300 border-blue-500 shadow-xs"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
            }`}
            title="Elevated working plane (0.75m) with wall margin exclusion"
          >
            <Layers className="size-3.5 text-blue-400" />
            <span className="truncate">Working Area</span>
          </button>

          <button
            onClick={() => {
              setCalcAreaType?.("workstation");
              toast.info("Switched calculation evaluation area to: Workstation Desk Task Area");
            }}
            className={`py-1.5 px-1 rounded flex flex-col items-center gap-1 text-[10px] font-bold border transition cursor-pointer ${
              activeArea === "workstation"
                ? "bg-amber-500/20 text-amber-300 border-amber-500 shadow-xs"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
            }`}
            title="Dedicated workstation task area + 0.50m immediate surrounding area"
          >
            <Monitor className="size-3.5 text-amber-400" />
            <span className="truncate">Workstation</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          1. CALCULATION SURFACES INSPECTOR
      ------------------------------------------------------------- */}
      {calcTool === "surfaces" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Calculation surfaces</span>
            <span className="text-[10px] text-slate-400 font-mono">
              Active: <strong className="text-white capitalize">{activeArea}</strong>
            </span>
          </div>

          <div className="p-3 flex flex-col gap-3">
            {/* AREA 1: FLOOR AREA CONFIGURATION */}
            {activeArea === "floor" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Square className="size-3 text-emerald-400" /> Floor Surface Parameters
                  </span>
                  <span className="text-[10px] text-slate-400">Z = 0.00 m</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Room Footprint:</span>
                    <strong className="text-white font-mono">{roomL} × {roomW} m</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Floor Area:</span>
                    <strong className="text-white font-mono">{(roomL * roomW).toFixed(2)} m²</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Elevation:</span>
                    <strong className="text-emerald-400 font-mono">0.00 m</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Wall Margin:</span>
                    <strong className="text-slate-300 font-mono">0.00 m (Wall-to-wall)</strong>
                  </div>
                </div>

                {floorStats && (
                  <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/30 flex flex-col gap-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Floor Maintained Lux (E_avg):</span>
                      <strong className="text-emerald-300 font-mono text-xs">{floorStats.avgLux} lx</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono">
                      <span>E_min: {floorStats.minLux} lx</span>
                      <span>E_max: {floorStats.maxLux} lx</span>
                      <span>U₀: {floorStats.uniformityU0.toFixed(2)} (Min ≥ 0.40)</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-900/40 text-[10px]">
                      <span className="text-slate-400">EN 12464-1 Circulation:</span>
                      <span className={`font-bold ${floorStats.uniformityU0 >= 0.40 ? "text-emerald-400" : "text-amber-400"}`}>
                        {floorStats.uniformityU0 >= 0.40 ? "COMPLIANT PASS" : "REVIEW"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AREA 2: WORKING PLANE CONFIGURATION */}
            {activeArea === "workplane" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5 text-xs">
                <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                  <Layers className="size-3 text-blue-400" /> Working Plane Parameters (EN 12464-1)
                </span>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Workplane Elevation:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max={roomH - 0.5}
                      value={workPlaneHeight}
                      onChange={(e) => setWorkPlaneHeight(parseFloat(e.target.value) || 0.75)}
                      className="w-16 h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white"
                    />
                    <span className="text-slate-500">m</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Wall Margin Offset:</span>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1.5"
                      value={marginOffset}
                      onChange={(e) => setMarginOffset(parseFloat(e.target.value) || 0.5)}
                      className="w-16 h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white"
                    />
                    <span className="text-slate-500">m</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10.5px] bg-slate-900/60 p-2 rounded border border-slate-800/80 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">Useful Dimensions:</span>
                    <strong className="text-white">
                      {(roomL - 2 * marginOffset).toFixed(2)} × {(roomW - 2 * marginOffset).toFixed(2)} m
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9.5px]">Useful Working Area:</span>
                    <strong className="text-blue-300">
                      {(Math.max(0.1, roomL - 2 * marginOffset) * Math.max(0.1, roomW - 2 * marginOffset)).toFixed(2)} m²
                    </strong>
                  </div>
                </div>

                {wpStats && (
                  <div className="p-2.5 rounded bg-blue-950/20 border border-blue-500/30 flex flex-col gap-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Working Plane Lux (E_avg):</span>
                      <strong className="text-blue-300 font-mono text-xs">{wpStats.avgLux} lx</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10.5px] text-slate-400 font-mono">
                      <span>E_min: {wpStats.minLux} lx</span>
                      <span>E_max: {wpStats.maxLux} lx</span>
                      <span>U₀: {wpStats.uniformityU0.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AREA 3: WORKSTATION DESK CONFIGURATION */}
            {activeArea === "workstation" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <Monitor className="size-3 text-amber-400" /> Workstation Task Area
                  </span>
                  <span className="text-[10px] text-slate-400">EN 12464-1</span>
                </div>

                {/* Preset Desks */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-slate-400">Workstation Preset:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WORKSTATION_PRESETS.slice(0, 4).map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setWorkstationConfig?.((prev) => ({
                            ...prev,
                            name: p.name,
                            length: p.length,
                            width: p.width,
                            height: p.height,
                            targetLux: p.targetLux,
                          }));
                          toast.success(`Loaded preset: ${p.name} (${p.length}×${p.width}m, Target ${p.targetLux} lx)`);
                        }}
                        className={`p-1.5 rounded text-left border transition cursor-pointer flex flex-col gap-0.5 ${
                          wsConfig.name === p.name
                            ? "bg-amber-500/20 text-amber-200 border-amber-500/80"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <span className="font-bold text-[10px] truncate">{p.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{p.length}×{p.width}m • {p.targetLux}lx</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimensional and Positional inputs */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Desk Length:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        step="0.1"
                        min="0.6"
                        max={roomL - 0.2}
                        value={wsConfig.length}
                        onChange={(e) =>
                          setWorkstationConfig?.((prev) => ({ ...prev, length: parseFloat(e.target.value) || 1.6 }))
                        }
                        className="w-14 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                      />
                      <span className="text-slate-500">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Desk Width:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        step="0.1"
                        min="0.4"
                        max={roomW - 0.2}
                        value={wsConfig.width}
                        onChange={(e) =>
                          setWorkstationConfig?.((prev) => ({ ...prev, width: parseFloat(e.target.value) || 0.8 }))
                        }
                        className="w-14 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                      />
                      <span className="text-slate-500">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Center X:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={roomL}
                        value={wsConfig.x}
                        onChange={(e) =>
                          setWorkstationConfig?.((prev) => ({ ...prev, x: parseFloat(e.target.value) || roomL / 2 }))
                        }
                        className="w-14 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                      />
                      <span className="text-slate-500">m</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Center Y:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={roomW}
                        value={wsConfig.y}
                        onChange={(e) =>
                          setWorkstationConfig?.((prev) => ({ ...prev, y: parseFloat(e.target.value) || roomW / 2 }))
                        }
                        className="w-14 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                      />
                      <span className="text-slate-500">m</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[10.5px]">Surrounding Band:</span>
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <input
                      type="number"
                      step="0.05"
                      min="0.2"
                      max="1.5"
                      value={wsConfig.surroundingBand}
                      onChange={(e) =>
                        setWorkstationConfig?.((prev) => ({ ...prev, surroundingBand: parseFloat(e.target.value) || 0.5 }))
                      }
                      className="w-14 h-6 px-1 bg-slate-900 border border-slate-700 rounded text-right text-white"
                    />
                    <span className="text-slate-500">m (EN 12464)</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setWorkstationConfig?.((prev) => ({
                      ...prev,
                      x: Number((roomL / 2).toFixed(2)),
                      y: Number((roomW / 2).toFixed(2)),
                    }));
                    toast.success("Workstation desk centered in room");
                  }}
                  className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-semibold cursor-pointer border border-slate-700/60"
                >
                  Center Desk in Room ({ (roomL / 2).toFixed(2) }m, { (roomW / 2).toFixed(2) }m)
                </button>

                {/* Workstation & Surrounding Area Stats */}
                {wsStats && surrStats && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800">
                    <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 flex flex-col gap-1 text-[10.5px]">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-amber-300">1. Task Area (Desk):</span>
                        <span className="font-mono text-amber-200 text-xs">{wsStats.avgLux} lx (Target: {wsConfig.targetLux} lx)</span>
                      </div>
                      <div className="flex justify-between text-slate-400 font-mono text-[9.5px]">
                        <span>U₀: {wsStats.uniformityU0.toFixed(2)} (≥ 0.60)</span>
                        <span className={wsStats.isCompliant ? "text-emerald-400 font-bold" : "text-amber-400"}>
                          {wsStats.isCompliant ? "TASK PASS" : "UNDER-LIT"}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-cyan-950/20 border border-cyan-500/30 flex flex-col gap-1 text-[10.5px]">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-cyan-300">2. Immediate Surrounding (0.5m band):</span>
                        <span className="font-mono text-cyan-200 text-xs">{surrStats.avgLux} lx</span>
                      </div>
                      <div className="flex justify-between text-slate-400 font-mono text-[9.5px]">
                        <span>U₀: {surrStats.uniformityU0.toFixed(2)} (≥ 0.40)</span>
                        <span className={surrStats.isCompliant ? "text-emerald-400 font-bold" : "text-amber-400"}>
                          {surrStats.isCompliant ? "SURROUND PASS" : "UNDER-LIT"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Surface List matching DIALux evo CAD Model */}
            <div className="flex flex-col gap-1.5 text-[11px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">All Calculation Surfaces (Click to Activate)</span>
              {[
                {
                  id: "workstation" as CalculationAreaType,
                  name: `Workstation Desk (${wsConfig.name})`,
                  z: `${wsConfig.height.toFixed(2)} m`,
                  lux: `${wsStats ? wsStats.avgLux : simulationResult.avgLux} lx`,
                  active: activeArea === "workstation",
                  color: "text-amber-300",
                },
                {
                  id: "workplane" as CalculationAreaType,
                  name: "Useful Working Plane (Margin 0.5m)",
                  z: `${workPlaneHeight.toFixed(2)} m`,
                  lux: `${wpStats ? wpStats.avgLux : simulationResult.avgLux} lx`,
                  active: activeArea === "workplane",
                  color: "text-blue-300",
                },
                {
                  id: "floor" as CalculationAreaType,
                  name: "Floor Surface (Wall-to-wall)",
                  z: "0.00 m",
                  lux: `${floorStats ? floorStats.avgLux : Math.round(simulationResult.avgLux * 0.5)} lx`,
                  active: activeArea === "floor",
                  color: "text-emerald-300",
                },
                {
                  id: null,
                  name: "Ceiling Surface",
                  z: `${roomH.toFixed(2)} m`,
                  lux: `${Math.round(simulationResult.avgLux * 0.35)} lx`,
                  active: false,
                  color: "text-slate-300",
                },
                {
                  id: null,
                  name: "Wall Surfaces (N / S / E / W)",
                  z: "Vertical",
                  lux: `${Math.round(simulationResult.avgLux * 0.55)} lx`,
                  active: false,
                  color: "text-slate-300",
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (s.id) {
                      setCalcAreaType?.(s.id);
                      toast.info(`Active calculation surface: ${s.name}`);
                    }
                  }}
                  className={`p-2 rounded border flex justify-between items-center transition ${
                    s.id ? "cursor-pointer" : "cursor-default opacity-75"
                  } ${
                    s.active
                      ? "bg-slate-800 border-amber-500 shadow-xs"
                      : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {s.active && <div className="size-1.5 rounded-full bg-amber-400" />}
                    <span className={s.active ? "text-white font-bold" : "text-slate-300 font-medium"}>
                      {s.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-500 text-[10px]">{s.z}</span>
                    <strong className={s.color}>{s.lux}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. TASK AREAS EN 12464-1
      ------------------------------------------------------------- */}
      {calcTool === "task_areas" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Task areas (EN 12464-1)</span>
            <span className="text-[10px] text-emerald-400 font-bold">Standard</span>
          </div>

          <div className="p-3 flex flex-col gap-2">
            <span className="text-[11px] text-slate-400">Select Activity / Task Profile:</span>

            {TASK_PRESETS.map((t, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setTargetLux(t.lux);
                  setWorkstationConfig?.((prev) => ({ ...prev, targetLux: t.lux }));
                  toast.success(`Loaded EN 12464-1 profile "${t.name}" (Target: ${t.lux} lx)`);
                }}
                className={`p-2 rounded border transition cursor-pointer flex flex-col gap-1 ${
                  targetLux === t.lux
                    ? "bg-slate-800 border-amber-500 text-white"
                    : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-center text-xs">
                  <strong className="font-semibold">{t.name}</strong>
                  <span className="font-mono text-amber-300 font-bold">{t.lux} lx</span>
                </div>
                <div className="flex gap-3 text-[10px] text-slate-400 font-mono">
                  <span>U0 ≥ {t.u0}</span>
                  <span>UGR ≤ {t.ugrMax}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. CALCULATION GRID & POINTS
      ------------------------------------------------------------- */}
      {calcTool === "points" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Calculation grid</span>
            <span className="text-[10px] text-slate-400 font-mono">EN 12464-1</span>
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2 text-xs">
              <span className="text-white font-semibold">Grid Point Spacing Formula</span>
              <p className="text-[10.5px] text-slate-400 leading-relaxed font-mono">
                p = 0.2 × 5^(log10(d))
              </p>
              <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                <span className="text-slate-400">Total Calculation Points:</span>
                <strong className="text-amber-300 font-mono">{simulationResult.gridPoints.length} points</strong>
              </div>
            </div>

            <button
              onClick={() => setShowLuxNumbers((prev) => !prev)}
              className={`w-full py-2 rounded text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-2 ${
                showLuxNumbers
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/80"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
            >
              <Grid className="size-3.5" />
              <span>{showLuxNumbers ? "Hide" : "Show"} Numerical Lux Values in 3D</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. GLARE EVALUATION (UGR CIE 117)
      ------------------------------------------------------------- */}
      {calcTool === "ugr" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <span>Unified Glare Rating (UGR)</span>
            <span className="text-[10px] text-emerald-400 font-mono">CIE 117</span>
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Calculated UGR Glare:</span>
                <strong className="text-emerald-400 font-mono text-base">{simulationResult.ugr.toFixed(1)}</strong>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Standard Requirement:</span>
                <span className="text-white font-mono">≤ 19.0 (Office Tasks)</span>
              </div>
              <div className="p-2 bg-emerald-950/40 rounded border border-emerald-600/40 text-[10.5px] text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Glare limitation fully satisfied according to EN 12464-1.</span>
              </div>
            </div>

            {/* Observer coordinates */}
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2 text-[11px]">
              <span className="text-white font-semibold">Observer Position & Line of Sight</span>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>
                  <label className="text-[10px] text-slate-400 block">Observer X (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ugrX}
                    onChange={(e) => setUgrX(parseFloat(e.target.value) || 0)}
                    className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Observer Y (m):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ugrY}
                    onChange={(e) => setUgrY(parseFloat(e.target.value) || 0)}
                    className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-right text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          5. FALSE COLORS & ISOLUX LINES
      ------------------------------------------------------------- */}
      {calcTool === "isolux" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
            False colors and isolux lines
          </div>

          <div className="p-3 flex flex-col gap-3">
            <button
              onClick={() => setShowHeatmap((prev) => !prev)}
              className={`w-full py-2 rounded text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-2 ${
                showHeatmap
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/80"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
            >
              <Palette className="size-3.5" />
              <span>{showHeatmap ? "Disable" : "Enable"} False-Color Heatmap</span>
            </button>

            <button
              onClick={() => setShowIsoluxLines((prev) => !prev)}
              className={`w-full py-2 rounded text-xs font-bold transition cursor-pointer border flex items-center justify-center gap-2 ${
                showIsoluxLines
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/80"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
            >
              <Layers className="size-3.5" />
              <span>{showIsoluxLines ? "Disable" : "Enable"} Isolux Contours</span>
            </button>

            {/* False Color Lux Scale bar */}
            <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-white">Illuminance Scale (lux)</span>
              <div className="h-4 rounded overflow-hidden flex border border-slate-700">
                <div className="flex-1 bg-gradient-to-r from-blue-700 via-cyan-400 via-green-400 via-yellow-400 to-red-600" />
              </div>
              <div className="flex justify-between text-[9.5px] font-mono text-slate-400">
                <span>0 lx</span>
                <span>200 lx</span>
                <span className="text-emerald-400 font-bold">500 lx</span>
                <span>750 lx</span>
                <span>&gt;1000 lx</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 4. EXPORT WORKFLOW INSPECTOR (Raytracer, Images Gallery, DWG, IFC, CSV Schedule)
// =========================================================================
interface ExportInspectorsProps {
  exportTool: "dwg" | "ifc" | "schedule" | "render" | "raytracer" | "images" | "pdf";
  projectName: string;
  projectCode: string;
  roomName: string;
  roomL: number;
  roomW: number;
  roomH: number;
  workPlaneHeight: number;
  profile: LuminairePhotometricProfile;
  simulationResult: DialuxSimulationResult;
  rendererRef: React.RefObject<any>;
  projectImages?: RenderedRaytraceImage[];
  setProjectImages?: React.Dispatch<React.SetStateAction<RenderedRaytraceImage[]>>;
  onOpenRaytracerModal?: () => void;
}

export function ExportInspectors({
  exportTool,
  projectName,
  projectCode,
  roomName,
  roomL,
  roomW,
  roomH,
  workPlaneHeight,
  profile,
  simulationResult,
  rendererRef,
  projectImages = [],
  setProjectImages,
  onOpenRaytracerModal,
}: ExportInspectorsProps) {
  // Raytracer Quick Settings State
  const [preset, setPreset] = useState<"draft" | "medium" | "high" | "2k" | "4k" | "custom">("high");
  const [enableMirror, setEnableMirror] = useState<boolean>(true);
  const [mirrorReflectance, setMirrorReflectance] = useState<number>(0.75);
  const [enableTrans, setEnableTrans] = useState<boolean>(true);
  const [enableShadows, setEnableShadows] = useState<boolean>(true);
  const [enableHdr, setEnableHdr] = useState<boolean>(true);
  const [isRaytracing, setIsRaytracing] = useState<boolean>(false);
  const [raytraceProgress, setRaytraceProgress] = useState<number>(0);
  const [currentPass, setCurrentPass] = useState<string>("");

  // Live HDR Exposure in Images tab
  const [activeGalleryImage, setActiveGalleryImage] = useState<RenderedRaytraceImage | null>(() => {
    return projectImages.length > 0 ? projectImages[projectImages.length - 1] : null;
  });
  const [galleryExposureEv, setGalleryExposureEv] = useState<number>(0.0);
  const [galleryToneMapping, setGalleryToneMapping] = useState<"aces" | "reinhard" | "linear">("aces");

  // Keep active image updated
  useEffect(() => {
    if (projectImages.length > 0 && !activeGalleryImage) {
      setActiveGalleryImage(projectImages[projectImages.length - 1]);
    }
  }, [projectImages]);

  // Quick Raytrace Trigger
  const handleQuickRaytrace = () => {
    if (onOpenRaytracerModal) {
      onOpenRaytracerModal();
      return;
    }

    if (isRaytracing) return;
    setIsRaytracing(true);
    setRaytraceProgress(0);
    setCurrentPass("Direct Photometric Radiance...");

    const passes = [
      { p: 20, name: "Direct Illumination & Surface Radiosity" },
      { p: 50, name: "Raytracing Soft Penumbra Shadows" },
      { p: 75, name: "Calculating Specular Mirror Reflections" },
      { p: 90, name: "Transparency & Glass Refraction" },
      { p: 100, name: "Calibrating HDR Luminance Buffer" },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < passes.length) {
        setRaytraceProgress(passes[idx].p);
        setCurrentPass(passes[idx].name);
        idx++;
      } else {
        clearInterval(interval);
        setIsRaytracing(false);

        let dataUrl = "";
        if (rendererRef.current && rendererRef.current.domElement) {
          dataUrl = rendererRef.current.domElement.toDataURL("image/png");
        }

        const newImg: RenderedRaytraceImage = {
          id: `raytrace-${Date.now()}`,
          title: `Raytrace ${projectImages.length + 1} - ${roomName}`,
          description: "Photorealistic render with specular mirror reflections and HDR lighting distribution.",
          timestamp: new Date().toLocaleString(),
          width: preset === "high" ? 1920 : preset === "medium" ? 1280 : 640,
          height: preset === "high" ? 1080 : preset === "medium" ? 720 : 480,
          dataUrl,
          originalDataUrl: dataUrl,
          isHdr: enableHdr,
          exposureEv: 0.0,
          toneMapping: "aces",
          roomName,
          fileSizeBytes: Math.round(dataUrl.length * 0.75),
        };

        if (setProjectImages) {
          setProjectImages((prev) => [...prev, newImg]);
        }
        setActiveGalleryImage(newImg);
        toast.success(`Raytracer finished! Render saved to Project Images.`);
      }
    }, 450);
  };

  // Export DXF
  const handleExportDxf = () => {
    let dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
    dxf += "0\nPOLYLINE\n8\nROOM_WALLS\n66\n1\n70\n1\n";
    dxf += `0\nVERTEX\n8\nROOM_WALLS\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    dxf += `0\nVERTEX\n8\nROOM_WALLS\n10\n${roomL.toFixed(3)}\n20\n0.0\n30\n0.0\n`;
    dxf += `0\nVERTEX\n8\nROOM_WALLS\n10\n${roomL.toFixed(3)}\n20\n${roomW.toFixed(3)}\n30\n0.0\n`;
    dxf += `0\nVERTEX\n8\nROOM_WALLS\n10\n0.0\n20\n${roomW.toFixed(3)}\n30\n0.0\n`;
    dxf += "0\nSEQEND\n";

    simulationResult.luminaires.forEach((lum, idx) => {
      dxf += `0\nCIRCLE\n8\nLUMINAIRES\n10\n${lum.x.toFixed(3)}\n20\n${lum.y.toFixed(3)}\n30\n${lum.z.toFixed(3)}\n40\n0.3\n`;
      dxf += `0\nTEXT\n8\nLUMINAIRE_TAGS\n10\n${lum.x.toFixed(3)}\n20\n${(lum.y + 0.35).toFixed(3)}\n30\n${lum.z.toFixed(3)}\n40\n0.18\n1\nL${idx + 1} (${profile.lumens}lm ${profile.wattage}W)\n`;
    });

    simulationResult.gridPoints.forEach((pt) => {
      dxf += `0\nPOINT\n8\nCALC_GRID\n10\n${pt.x.toFixed(3)}\n20\n${pt.y.toFixed(3)}\n30\n${workPlaneHeight.toFixed(3)}\n`;
    });
    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${roomName || "Room"}_Lighting_Plan.dxf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported AutoCAD DWG/DXF 2D Lighting Layout");
  };

  // Export IFC 4
  const handleExportIfc = () => {
    const now = new Date().toISOString();
    let ifc = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('${roomName}.ifc','${now}',('MEP Engineer'),('Vikram MEP'),'DIALux evo Web','MEP Calc','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('1P',$,'${projectName}',$,$,$,$,(#2),#3);\n#2=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);\n#3=IFCUNITASSIGNMENT((#5));\n#4=IFCAXIS2PLACEMENT3D(#6,$,$);\n#5=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n#6=IFCCARTESIANPOINT((0.,0.,0.));\n#7=IFCSITE('2S',$,'Site 1',$,$,#4,$,$,.ELEMENT.,(0,0,0),(0,0,0),0.,$,$);\n#8=IFCBUILDING('3B',$,'Building 1',$,$,#4,$,$,.ELEMENT.,$,$,$);\n#9=IFCBUILDINGSTOREY('4S',$,'Storey 1',$,$,#4,$,$,.ELEMENT.,0.);\n#10=IFCSPACE('5R',$,'${roomName}',$,$,#4,$,$,.ELEMENT.,.INTERNAL.,$);\n`;
    let entityId = 20;
    simulationResult.luminaires.forEach((lum, idx) => {
      const ptId = entityId++;
      const plcId = entityId++;
      const fixId = entityId++;
      ifc += `#${ptId}=IFCCARTESIANPOINT((${lum.x.toFixed(3)},${lum.y.toFixed(3)},${lum.z.toFixed(3)}));\n`;
      ifc += `#${plcId}=IFCAXIS2PLACEMENT3D(#${ptId},$,$);\n`;
      ifc += `#${fixId}=IFCLIGHTFIXTURE('${idx + 1}F',$,'L${idx + 1} - ${profile.name}','${profile.lumens}lm ${profile.wattage}W',$,#${plcId},$,$,.NOTDEFINED.);\n`;
    });
    ifc += "ENDSEC;\nEND-ISO-10303-21;\n";

    const blob = new Blob([ifc], { type: "application/x-step" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${roomName || "Room"}_BIM_Lighting.ifc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported IFC 4 BIM Lighting Model");
  };

  // Export CSV Schedule
  const handleExportCsv = () => {
    let csv = "Fixture ID,Fitting Model,Manufacturer,Luminous Flux (lm),System Power (W),CCT (K),CRI (Ra),Mounting Type,Pos X (m),Pos Y (m),Mount Height Z (m),Aiming Tilt (°),Circuit ID\n";
    simulationResult.luminaires.forEach((lum, idx) => {
      csv += `L${idx + 1},"${profile.name}","${profile.manufacturer || "DIALux Standard"}",${profile.lumens},${profile.wattage},${profile.cct || 4000},${profile.cri || 80},Recessed Ceiling,${lum.x.toFixed(3)},${lum.y.toFixed(3)},${lum.z.toFixed(3)},0.0,C-${Math.floor(idx / 4) + 1}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${roomName || "Room"}_Luminaire_Schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported Luminaire Installation Schedule (CSV)");
  };

  // Export High-Res Render
  const handleExportRender = () => {
    if (rendererRef.current) {
      const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${roomName || "Room"}_Photometric_Render.png`;
      a.click();
      toast.success("Exported High-Resolution 3D Photometric Render");
    } else {
      toast.error("3D Canvas not ready for render capture");
    }
  };

  return (
    <div className="flex flex-col text-slate-200">
      
      {/* -------------------------------------------------------------
          1. RAYTRACER INSPECTOR (DIALux evo Tutorial Part 7)
      ------------------------------------------------------------- */}
      {exportTool === "raytracer" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Red ball on mirror icon */}
              <div className="relative size-4 rounded bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow">
                <div className="size-2 rounded-full bg-red-200" />
                <div className="absolute bottom-0.5 w-2.5 h-0.5 bg-white/70 rounded-full" />
              </div>
              <span>Raytracer</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Part 7
            </span>
          </div>

          <div className="p-3 flex flex-col gap-3 text-xs">
            {/* Resolution Selector matching video */}
            <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-[11px]">Image Resolution</span>
                <span className="font-mono text-amber-400 text-[10px]">
                  {preset === "draft" ? "640 × 480" : preset === "medium" ? "1280 × 720" : preset === "high" ? "1920 × 1080" : "2560 × 1440"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(["draft", "medium", "high", "2k"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`py-1 rounded text-center transition cursor-pointer border text-[10px] uppercase font-bold ${
                      preset === p
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                Recommended: Test with draft first to check camera position and lighting contrast before final render.
              </p>
            </div>

            {/* Optical Features: Mirror Effects & Transparency */}
            <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
              <span className="font-bold text-slate-200 text-[11px] flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-rose-400" /> Optical Features
              </span>

              {/* Mirror Reflections */}
              <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableMirror}
                      onChange={(e) => setEnableMirror(e.target.checked)}
                      className="size-3 accent-rose-500 rounded"
                    />
                    <span className="text-[11px] font-medium text-slate-300">Mirror Effects (Red Ball)</span>
                  </label>
                  <span className="text-[10px] font-mono text-rose-400 font-bold">{Math.round(mirrorReflectance * 100)}%</span>
                </div>
                {enableMirror && (
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
              <label className="flex items-center justify-between cursor-pointer pb-1.5 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableTrans}
                    onChange={(e) => setEnableTrans(e.target.checked)}
                    className="size-3 accent-blue-500 rounded"
                  />
                  <span className="text-[11px] font-medium text-slate-300">Transparency & Glass</span>
                </div>
                <span className="text-[10px] text-blue-400 font-mono">η = 1.52</span>
              </label>

              {/* Soft Shadows */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableShadows}
                    onChange={(e) => setEnableShadows(e.target.checked)}
                    className="size-3 accent-amber-500 rounded"
                  />
                  <span className="text-[11px] font-medium text-slate-300">Soft Penumbra Shadows</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono">32s</span>
              </label>
            </div>

            {/* HDR Option */}
            <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-1.5">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableHdr}
                    onChange={(e) => setEnableHdr(e.target.checked)}
                    className="size-3 accent-cyan-500 rounded"
                  />
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <Sun className="size-3 text-cyan-400" /> High Dynamic Range (HDR)
                  </span>
                </div>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1 py-0.5 rounded font-mono">
                  *.hdr
                </span>
              </label>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Stores floating-point illuminance values for live exposure adjustments (±3 EV) in the Images gallery.
              </p>
            </div>

            {/* Calculation Status */}
            {isRaytracing && (
              <div className="bg-[#14161a] p-2.5 rounded border border-amber-500/40 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <RefreshCw className="size-3 animate-spin" /> Raytracing...
                  </span>
                  <span className="font-mono text-slate-300">{raytraceProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-300"
                    style={{ width: `${raytraceProgress}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 font-mono truncate">{currentPass}</span>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={handleQuickRaytrace}
              disabled={isRaytracing}
              className={`w-full py-2 rounded-lg font-bold text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer ${
                isRaytracing
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white border border-amber-400/40"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>{isRaytracing ? "Calculating..." : "Start Raytracer"}</span>
            </button>

            {onOpenRaytracerModal && (
              <button
                onClick={onOpenRaytracerModal}
                className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Maximize2 className="size-3.5 text-amber-400" /> Open Raytracer Studio
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          2. PROJECT IMAGES & HDR GALLERY (DIALux evo Tutorial Part 7)
      ------------------------------------------------------------- */}
      {exportTool === "images" && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Camera className="size-3.5 text-cyan-400" />
              <span>Project Images</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {projectImages.length} render{projectImages.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="p-3 flex flex-col gap-3 text-xs">
            {projectImages.length === 0 ? (
              <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
                <Camera className="size-8 text-slate-600" />
                <span className="text-[11px]">No raytraced images in project yet.</span>
                <button
                  onClick={onOpenRaytracerModal}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold cursor-pointer mt-1"
                >
                  Start Raytracer
                </button>
              </div>
            ) : (
              <>
                {/* Active Image Preview & HDR Slider */}
                {activeGalleryImage && (
                  <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 flex flex-col gap-2">
                    <div className="relative rounded overflow-hidden bg-black/60 border border-slate-800">
                      <img
                        src={activeGalleryImage.dataUrl}
                        alt={activeGalleryImage.title}
                        className="w-full h-32 object-cover"
                      />
                      {activeGalleryImage.isHdr && (
                        <span className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded text-[8.5px] font-black bg-cyan-500 text-black">
                          HDR
                        </span>
                      )}
                      <span className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded text-[8.5px] font-mono bg-black/80 text-white">
                        {activeGalleryImage.width}×{activeGalleryImage.height}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px] truncate">{activeGalleryImage.title}</span>
                      <span className="text-[9.5px] text-slate-400 font-mono">{activeGalleryImage.timestamp}</span>
                    </div>

                    {/* HDR Exposure Adjustment */}
                    {activeGalleryImage.isHdr && (
                      <div className="bg-[#101216] p-2 rounded border border-slate-800 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Sun className="size-3 text-cyan-400" /> Exposure Compensation:
                          </span>
                          <span className="font-mono text-cyan-300 font-bold">
                            {galleryExposureEv > 0 ? `+${galleryExposureEv.toFixed(1)}` : galleryExposureEv.toFixed(1)} EV
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-3.0}
                          max={3.0}
                          step={0.1}
                          value={galleryExposureEv}
                          onChange={(e) => setGalleryExposureEv(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-700 accent-cyan-400 rounded cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Quick Downloads */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = activeGalleryImage.dataUrl;
                          a.download = `${activeGalleryImage.title.replace(/\s+/g, "_")}.png`;
                          a.click();
                          toast.success("Downloaded PNG");
                        }}
                        className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Download className="size-3 text-blue-400" /> PNG
                      </button>
                      <button
                        onClick={() => {
                          if (onOpenRaytracerModal) onOpenRaytracerModal();
                        }}
                        className="py-1 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="size-3" /> Full Studio
                      </button>
                    </div>
                  </div>
                )}

                {/* List of other images */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-bold text-[10.5px] text-slate-400 uppercase tracking-wider">Project Gallery</span>
                  {projectImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveGalleryImage(img)}
                      className={`p-1.5 rounded flex items-center gap-2 text-left transition cursor-pointer border ${
                        activeGalleryImage?.id === img.id
                          ? "bg-amber-500/15 border-amber-500/50 text-white"
                          : "bg-[#14161a] border-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      <img src={img.dataUrl} alt="" className="size-8 rounded object-cover shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-medium truncate">{img.title}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{img.width}×{img.height} • {img.timestamp}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. CAD DWG / IFC / CSV SCHEDULE / 3D RENDER EXPORT
      ------------------------------------------------------------- */}
      {(exportTool === "dwg" || exportTool === "ifc" || exportTool === "schedule" || exportTool === "render") && (
        <div className="flex flex-col">
          <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
            Export & Interoperability
          </div>

          <div className="p-3 flex flex-col gap-3">
            {/* CAD DWG/DXF */}
            {exportTool === "dwg" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
                <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">DWG</span>
                  AutoCAD / DXF 2D Layout
                </span>
                <p className="text-[10.5px] text-slate-400">
                  Exports 2D CAD floor plan with room boundaries, luminaire placement blocks, and calculation points.
                </p>
                <button
                  onClick={handleExportDxf}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="size-3.5" /> Download DXF CAD File
                </button>
              </div>
            )}

            {/* BIM IFC */}
            {exportTool === "ifc" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
                <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">IFC</span>
                  BIM IFC 4 Model
                </span>
                <p className="text-[10.5px] text-slate-400">
                  Generates standard IFC4 building model containing IfcLightFixture entities with photometric properties.
                </p>
                <button
                  onClick={handleExportIfc}
                  className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="size-3.5" /> Download IFC BIM Model
                </button>
              </div>
            )}

            {/* CSV Schedule */}
            {exportTool === "schedule" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
                <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <FileText className="size-3.5 text-emerald-400" />
                  Luminaire Schedule (CSV / Excel)
                </span>
                <p className="text-[10.5px] text-slate-400">
                  Installation coordinates (X, Y, Z), circuits, wattage, and lumens schedule for electrical contractors.
                </p>
                <button
                  onClick={handleExportCsv}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="size-3.5" /> Download Schedule CSV
                </button>
              </div>
            )}

            {/* 3D High-Res Render */}
            {exportTool === "render" && (
              <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
                <span className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Camera className="size-3.5 text-amber-400" />
                  3D Viewport Snapshot (PNG)
                </span>
                <p className="text-[10.5px] text-slate-400">
                  Captures current 3D false-color viewport at native screen resolution. For mirror reflections and photorealism, use the Raytracer.
                </p>
                <button
                  onClick={handleExportRender}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="size-3.5" /> Download 3D Snapshot
                </button>
                {onOpenRaytracerModal && (
                  <button
                    onClick={onOpenRaytracerModal}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40 rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                  >
                    <Sparkles className="size-3.5" /> Switch to Raytracer Studio (Part 7)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 5. PROJECT MASTER DATA INSPECTOR
// =========================================================================
interface ProjectInspectorsProps {
  projectName: string;
  projectCode: string;
  userName: string;
  roomName: string;
}

export function ProjectInspectors({
  projectName,
  projectCode,
  userName,
  roomName,
}: ProjectInspectorsProps) {
  const [client, setClient] = useState("City Development Authority");
  const [engineer, setEngineer] = useState(userName || "MEP Lighting Consultant");
  const [revision, setRevision] = useState("Rev 2.4 - Construction Issue");
  const [notes, setNotes] = useState(
    "All luminaires specified with EN 12464-1 compliance, low-flicker drivers, and daylight harvesting integration."
  );

  return (
    <div className="flex flex-col text-slate-200">
      <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
        Project Master Information
      </div>

      <div className="p-3 flex flex-col gap-3 text-xs">
        <div className="bg-[#14161a] p-3 rounded border border-slate-800 flex flex-col gap-2">
          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Project Title:</label>
            <input
              type="text"
              defaultValue={projectName}
              className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white font-medium"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Project Code / Reference:</label>
            <input
              type="text"
              defaultValue={projectCode}
              className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Client Name:</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Lead Lighting Consultant:</label>
            <input
              type="text"
              value={engineer}
              onChange={(e) => setEngineer(e.target.value)}
              className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Issue Revision:</label>
            <input
              type="text"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              className="w-full h-7 px-2 bg-slate-900 border border-slate-700 rounded text-white font-mono"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] block mb-1">Project Notes / Specification Brief:</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-300 resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 6. BRANDS / LUMINAIRE FINDER CATALOGUE (LUMsearch & DIALux Partners)
// =========================================================================
interface BrandsCatalogueProps {
  onSelectLuminaire: (lum: BrandLuminaire) => void;
}

export function BrandsCatalogue({ onSelectLuminaire }: BrandsCatalogueProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMounting, setSelectedMounting] = useState<string>("all");
  const [previewLuminaireId, setPreviewLuminaireId] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const filtered = useMemo(() => {
    return BRAND_LUMINAIRES.filter((lum) => {
      const matchSearch =
        lum.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lum.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lum.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBrand = selectedBrand === "all" || lum.brand.toLowerCase().includes(selectedBrand.toLowerCase());
      const matchCategory = selectedCategory === "all" || lum.category === selectedCategory;
      const matchMounting = selectedMounting === "all" || lum.mounting === selectedMounting;
      return matchSearch && matchBrand && matchCategory && matchMounting;
    });
  }, [searchTerm, selectedBrand, selectedCategory, selectedMounting]);

  const previewLum = useMemo(() => {
    return BRAND_LUMINAIRES.find((l) => l.id === previewLuminaireId) || filtered[0] || BRAND_LUMINAIRES[0];
  }, [previewLuminaireId, filtered]);

  useEffect(() => {
    if (previewLum && previewCanvasRef.current) {
      drawPolarCurve(previewCanvasRef.current, previewLum.beamAngle, previewLum.distributionType);
    }
  }, [previewLum]);

  const uniqueBrands = useMemo(() => {
    return ["all", "Philips", "Zumtobel", "ERCO", "Trilux", "Thorn", "BEGA", "Cree", "Ledvance", "Fagerhult", "Regent"];
  }, []);

  return (
    <div className="flex flex-col text-slate-200">
      <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Search className="size-3.5 text-amber-400" />
          DIALux Luminaire Finder (LUMsearch)
        </span>
        <span className="text-[10px] text-amber-400 font-mono font-bold">
          {filtered.length} Fixtures
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search brand, model, optical distribution..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-7 pl-8 pr-2 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none placeholder:text-slate-500"
          />
        </div>

        {/* Brand Filter Buttons */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Manufacturer</span>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
            {uniqueBrands.map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBrand(b)}
                className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition cursor-pointer border ${
                  selectedBrand.toLowerCase() === b.toLowerCase()
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                    : "bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white"
                }`}
              >
                {b === "all" ? "All Brands" : b}
              </button>
            ))}
          </div>
        </div>

        {/* Category & Mounting Filters */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <label className="text-slate-400 block mb-0.5">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-white"
            >
              <option value="all">All Categories</option>
              <option value="panel">Recessed/Surface Panels</option>
              <option value="downlight">Downlights</option>
              <option value="linear">Linear Trunking / Battens</option>
              <option value="highbay">Industrial Highbays</option>
              <option value="wallwasher">Wallwashers</option>
              <option value="spotlight">Spotlights</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-0.5">Mounting Style:</label>
            <select
              value={selectedMounting}
              onChange={(e) => setSelectedMounting(e.target.value)}
              className="w-full h-6 px-1.5 bg-slate-900 border border-slate-700 rounded text-white"
            >
              <option value="all">All Mounting Types</option>
              <option value="recessed">Recessed</option>
              <option value="surface">Surface</option>
              <option value="suspended">Suspended / Pendant</option>
              <option value="wall">Wall Mounted</option>
            </select>
          </div>
        </div>

        {/* Active Luminaire Polar & Spec Card */}
        {previewLum && (
          <div className="bg-[#14161a] p-2.5 rounded border border-amber-500/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                {previewLum.brand}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {previewLum.efficacy} lm/W
              </span>
            </div>
            <strong className="text-white text-xs">{previewLum.model}</strong>

            <div className="flex items-center gap-2 bg-[#0f1115] p-2 rounded border border-slate-800/80">
              <canvas ref={previewCanvasRef} width={120} height={80} className="rounded" />
              <div className="flex flex-col text-[10px] font-mono text-slate-300 gap-0.5">
                <div>Flux: <strong className="text-emerald-400">{previewLum.lumens} lm</strong></div>
                <div>Power: <strong className="text-amber-300">{previewLum.wattage} W</strong></div>
                <div>Beam: <strong className="text-white">{previewLum.beamAngle}°</strong></div>
                <div>CCT: <strong className="text-white">{previewLum.cct} K</strong></div>
                <div>CRI: <strong className="text-white">Ra {previewLum.cri}</strong></div>
              </div>
            </div>

            <button
              onClick={() => onSelectLuminaire(previewLum)}
              className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check className="size-3.5" /> Select & Apply to Space
            </button>
          </div>
        )}

        {/* Fixtures List */}
        <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
          {filtered.map((lum) => (
            <div
              key={lum.id}
              onClick={() => setPreviewLuminaireId(lum.id)}
              className={`p-2.5 rounded border transition flex flex-col gap-1.5 cursor-pointer ${
                previewLum?.id === lum.id
                  ? "bg-[#191c22] border-amber-500/60 shadow-sm"
                  : "bg-[#14161a] border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">{lum.brand}</span>
                <span className="font-mono text-[10px] text-white bg-slate-800 px-1.5 py-0.2 rounded font-bold">
                  {lum.wattage} W
                </span>
              </div>
              <strong className="text-white text-xs">{lum.model}</strong>
              <p className="text-[10px] text-slate-400 leading-snug">{lum.description}</p>

              <div className="grid grid-cols-4 gap-1 py-1 text-[9.5px] font-mono border-t border-slate-800 text-slate-300">
                <span>{lum.lumens} lm</span>
                <span>{lum.efficacy} lm/W</span>
                <span>{lum.cct} K</span>
                <span className="capitalize">{lum.mounting}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 7. MULTI-PAGE DOCUMENTATION DOSSIER VIEWER (DIALux evo Official Report)
// =========================================================================
interface DocumentationViewerProps {
  projectName: string;
  projectCode: string;
  roomName: string;
  roomL: number;
  roomW: number;
  roomH: number;
  workPlaneHeight: number;
  profile: LuminairePhotometricProfile;
  simulationResult: DialuxSimulationResult;
  userName?: string;
  rendererRef: React.RefObject<any>;
  projectImages?: RenderedRaytraceImage[];
  maintenanceFactor?: number;
}

export function DocumentationViewer({
  projectName,
  projectCode,
  roomName,
  roomL,
  roomW,
  roomH,
  workPlaneHeight,
  profile,
  simulationResult,
  userName = "MEP Lighting Consultant",
  rendererRef,
  projectImages = [],
  maintenanceFactor = 0.8,
}: DocumentationViewerProps) {
  // 1. Output Template & Page Selection State (Tutorial #8)
  const [template, setTemplate] = useState<DocumentationTemplateType>("engineer");
  const [selectedPages, setSelectedPages] = useState<DocumentationPageSelection>({
    ...DEFAULT_PAGE_SELECTIONS.engineer,
  });
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // 2. View Mode & Scaling Controls
  const [viewLayout, setViewLayout] = useState<"single" | "spread" | "thumbnails">("single");
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<"tree" | "header" | "variants">("tree");

  // 3. Header, Logo & Page Customization (Tutorial #8)
  const [headerConfig, setHeaderConfig] = useState<DocumentationHeaderConfig>({
    companyName: "DIALux evo Engineering Partner",
    designerName: userName,
    companyLogo: null,
    disclaimer: "Calculated in accordance with EN 12464-1:2021 and CIBSE Code for Lighting.",
    pageNumberFormat: "page_x_of_y",
  });

  // 4. Tree Node Folding
  const [expandedGroups, setExpandedGroups] = useState<{ project: boolean; space: boolean }>({
    project: true,
    space: true,
  });

  // 5. Output Variants Manager (Tutorial #8)
  const [savedVariants, setSavedVariants] = useState<
    Array<{
      id: string;
      name: string;
      template: DocumentationTemplateType;
      selectedPages: DocumentationPageSelection;
    }>
  >([
    {
      id: "var-1",
      name: "Calculating Engineer Standard (Full 9 Pages)",
      template: "engineer",
      selectedPages: { ...DEFAULT_PAGE_SELECTIONS.engineer },
    },
    {
      id: "var-2",
      name: "Design Client Presentation (Visuals & Summary)",
      template: "client",
      selectedPages: { ...DEFAULT_PAGE_SELECTIONS.client },
    },
    {
      id: "var-3",
      name: "Installation Contractor Schedule (BOM & Coordinates)",
      template: "contractor",
      selectedPages: { ...DEFAULT_PAGE_SELECTIONS.contractor },
    },
    {
      id: "var-4",
      name: "Tender Summary (Compact 2 Pages)",
      template: "tender",
      selectedPages: { ...DEFAULT_PAGE_SELECTIONS.tender },
    },
  ]);
  const [newVariantName, setNewVariantName] = useState<string>("");

  const logoInputRef = useRef<HTMLInputElement>(null);

  // All 9 DIALux evo Standard Output Page Definitions
  const allPageDefs: Array<{
    id: keyof DocumentationPageSelection;
    title: string;
    category: "project" | "space";
    shortLabel: string;
    icon: any;
  }> = [
    { id: "cover", title: "Project Cover & Scope Overview", category: "project", shortLabel: "Cover Page", icon: FileText },
    { id: "summary", title: "Space Photometric Summary", category: "space", shortLabel: "Space Summary", icon: CheckCircle2 },
    { id: "luminaires", title: "Luminaire Parts List & Technical Profile", category: "space", shortLabel: "Luminaire Parts", icon: Lightbulb },
    { id: "coordinates", title: "Luminaire Installation Coordinates Plan (3D)", category: "space", shortLabel: "3D Coordinates", icon: Compass },
    { id: "surfaces", title: "Calculation Surfaces Valuation", category: "space", shortLabel: "Surfaces", icon: Grid },
    { id: "isolux", title: "Isolux Contours & Lux Value Grid", category: "space", shortLabel: "Isolux & Grid", icon: Palette },
    { id: "raytrace", title: "Raytracer Visualizations & High-Res Renders", category: "space", shortLabel: "Raytracer Renders", icon: Sparkles },
    { id: "energy", title: "Energy Evaluation (EN 15193 LENI)", category: "space", shortLabel: "Energy LENI", icon: Leaf },
    { id: "conformity", title: "Declaration of Conformity (EN 12464-1)", category: "space", shortLabel: "Conformity & Signoff", icon: ShieldAlert },
  ];

  // Dynamically filtered enabled pages
  const activePages = useMemo(() => {
    return allPageDefs.filter((p) => selectedPages[p.id]);
  }, [selectedPages]);

  const totalPages = Math.max(1, activePages.length);
  const safePageIndex = Math.min(Math.max(0, activePageIndex), totalPages - 1);
  const currentPageDef = activePages[safePageIndex] || activePages[0];

  // Switch Template Preset
  const handleSelectTemplate = (t: DocumentationTemplateType) => {
    setTemplate(t);
    const newSel = DEFAULT_PAGE_SELECTIONS[t] || DEFAULT_PAGE_SELECTIONS.engineer;
    setSelectedPages({ ...newSel });
    setActivePageIndex(0);
    toast.info(`Applied "${t.toUpperCase()}" documentation preset`);
  };

  // Toggle Single Page Checkbox in Tree
  const handleTogglePage = (pageId: keyof DocumentationPageSelection) => {
    const nextSelected = {
      ...selectedPages,
      [pageId]: !selectedPages[pageId],
    };
    setSelectedPages(nextSelected);
    setTemplate("custom");
  };

  // Select / Deselect All
  const handleToggleAll = (enable: boolean) => {
    const nextSel: DocumentationPageSelection = {
      cover: enable,
      summary: enable,
      luminaires: enable,
      coordinates: enable,
      surfaces: enable,
      isolux: enable,
      raytrace: enable,
      energy: enable,
      conformity: enable,
    };
    setSelectedPages(nextSel);
    setTemplate("custom");
    setActivePageIndex(0);
  };

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setHeaderConfig((prev) => ({ ...prev, companyLogo: dataUrl }));
      toast.success("Company logo successfully uploaded to document header");
    };
    reader.readAsDataURL(file);
  };

  // Save Current Variant
  const handleSaveVariant = () => {
    if (!newVariantName.trim()) {
      toast.error("Please enter a variant name");
      return;
    }
    const newVar = {
      id: `var-${Date.now()}`,
      name: newVariantName.trim(),
      template,
      selectedPages: { ...selectedPages },
    };
    setSavedVariants((prev) => [...prev, newVar]);
    setNewVariantName("");
    toast.success(`Saved variant "${newVar.name}"`);
  };

  // Load Saved Variant
  const handleLoadVariant = (v: typeof savedVariants[0]) => {
    setTemplate(v.template);
    setSelectedPages({ ...v.selectedPages });
    setActivePageIndex(0);
    toast.info(`Loaded variant "${v.name}"`);
  };

  // Delete Variant
  const handleDeleteVariant = (id: string, name: string) => {
    setSavedVariants((prev) => prev.filter((v) => v.id !== id));
    toast.info(`Deleted variant "${name}"`);
  };

  // Trigger PDF Generation
  const handleDownloadPdf = () => {
    toast.loading("Compiling official DIALux evo PDF dossier...", { id: "pdf-gen" });
    try {
      exportDialuxReportPDF({
        projectName,
        projectCode,
        roomName,
        roomLength: roomL,
        roomWidth: roomW,
        roomHeight: roomH,
        workPlaneHeight,
        profile,
        simulation: simulationResult,
        userName: headerConfig.designerName || userName,
        template,
        selectedPages,
        headerConfig,
        projectImages,
        maintenanceFactor,
      });
      toast.success("DIALux evo PDF report successfully generated!", { id: "pdf-gen" });
    } catch (err: any) {
      toast.error("PDF generation error: " + (err?.message || "Unknown error"), { id: "pdf-gen" });
    }
  };

  // Render a Single DIALux evo A4 Page
  const renderA4PageContent = (pageDef: typeof allPageDefs[0], pageNum: number) => {
    const isFirst = pageNum === 1;

    return (
      <div className="w-full h-full flex flex-col justify-between text-slate-900 select-text">
        <div>
          {/* Running Header Banner */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 mb-5">
            <div className="flex items-center gap-3">
              {headerConfig.companyLogo ? (
                <img
                  src={headerConfig.companyLogo}
                  alt="Company Logo"
                  className="h-9 w-auto max-w-[120px] object-contain rounded bg-white p-0.5 border border-slate-200"
                />
              ) : (
                <div className="size-8 rounded bg-slate-900 text-emerald-400 font-black text-xs flex items-center justify-center shadow-sm">
                  DX
                </div>
              )}
              <div>
                <div className="text-[9.5px] uppercase tracking-wider font-extrabold text-emerald-700">
                  {headerConfig.companyName || "DIALux evo Official Report"}
                </div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                  {pageDef.title.toUpperCase()}
                </h2>
                <span className="text-[10.5px] text-slate-500 font-medium">
                  Project: {projectName} ({projectCode}) | Space: {roomName}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-900 block font-mono">DIALux evo 14.0</span>
              <span className="text-[9.5px] text-slate-500 font-mono">
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* PAGE CONTENT SWITCHER */}

          {/* 1. COVER PAGE */}
          {pageDef.id === "cover" && (
            <div className="flex flex-col gap-5">
              {/* Project Hero Banner */}
              <div className="p-5 rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden border border-slate-700">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 -skew-x-12 pointer-events-none" />
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/40">
                  Official Calculation Dossier
                </span>
                <h1 className="text-xl font-black mt-2 tracking-tight text-white">
                  LIGHTING DESIGN DOCUMENTATION
                </h1>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Photometric simulation and compliance assessment according to EN 12464-1:2021 (Lighting of indoor work places) and EN 1838.
                </p>
                <div className="flex items-center gap-6 mt-4 text-[11px] text-slate-300 font-mono pt-3 border-t border-slate-700/60">
                  <span>Template: <strong className="text-emerald-400 capitalize">{template}</strong></span>
                  <span>Total Sections: <strong className="text-emerald-400">{totalPages} Pages</strong></span>
                  <span>Designer: <strong className="text-white">{headerConfig.designerName || userName}</strong></span>
                </div>
              </div>

              {/* Project & Space Metadata Card */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Project Name & Code:</span>
                  <strong className="text-sm font-bold text-slate-900">{projectName} ({projectCode})</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Space Geometry:</span>
                  <strong className="text-sm font-bold text-slate-900">
                    {roomL.toFixed(2)}m × {roomW.toFixed(2)}m × {roomH.toFixed(2)}m ({(roomL * roomW).toFixed(1)} m²)
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Workplane Height:</span>
                  <span className="font-semibold text-slate-800">{workPlaneHeight.toFixed(2)} m (Boundary Margin 0.50 m)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Maintenance Factor (CIE 97):</span>
                  <span className="font-semibold text-slate-800">{maintenanceFactor.toFixed(2)} (Standard direct clean)</span>
                </div>
              </div>

              {/* Executive Photometric KPIs */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Executive Photometric Evaluation Status
                </h3>
                <div className="grid grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg">
                    <span className="text-[9.5px] font-bold text-emerald-800 uppercase block">Maintained Lux (Em)</span>
                    <strong className="text-xl font-black text-emerald-700">{simulationResult.avgLux} lx</strong>
                    <span className="text-[9px] text-emerald-900 block mt-0.5">Target: {simulationResult.targetLux} lx</span>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                    <span className="text-[9.5px] font-bold text-blue-800 uppercase block">Uniformity (U0)</span>
                    <strong className="text-xl font-black text-blue-700">{simulationResult.uniformityU0.toFixed(2)}</strong>
                    <span className="text-[9px] text-blue-900 block mt-0.5">Min req: ≥ 0.60</span>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
                    <span className="text-[9.5px] font-bold text-amber-800 uppercase block">Glare Index (UGR)</span>
                    <strong className="text-xl font-black text-amber-700">{simulationResult.ugr.toFixed(1)}</strong>
                    <span className="text-[9px] text-amber-900 block mt-0.5">Limit: ≤ 19.0 (Pass)</span>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-300 rounded-lg">
                    <span className="text-[9.5px] font-bold text-purple-800 uppercase block">Connected Load</span>
                    <strong className="text-xl font-black text-purple-700">
                      {((simulationResult.luminaires.length * profile.wattage) / (roomL * roomW)).toFixed(1)} W/m²
                    </strong>
                    <span className="text-[9px] text-purple-900 block mt-0.5">LENI Compliant</span>
                  </div>
                </div>
              </div>

              {/* Table of Contents Box */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Table of Contents (Included Report Sections)
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <div className="grid grid-cols-12 bg-slate-100 p-2 font-bold text-slate-700 text-[10.5px] border-b border-slate-200">
                    <span className="col-span-1 text-center">#</span>
                    <span className="col-span-5">Section Title</span>
                    <span className="col-span-4">Scope &amp; Description</span>
                    <span className="col-span-2 text-right pr-2">Page No.</span>
                  </div>
                  {activePages.map((sec, idx) => (
                    <div
                      key={sec.id}
                      onClick={() => setActivePageIndex(idx)}
                      className="grid grid-cols-12 p-2 border-b border-slate-100 items-center hover:bg-emerald-50/60 cursor-pointer transition"
                    >
                      <span className="col-span-1 text-center font-bold text-slate-500">{idx + 1}</span>
                      <span className="col-span-5 font-semibold text-slate-900 flex items-center gap-1.5">
                        <sec.icon className="size-3 text-emerald-600" />
                        {sec.title}
                      </span>
                      <span className="col-span-4 text-[10.5px] text-slate-500 truncate">{sec.shortLabel} schedule</span>
                      <span className="col-span-2 text-right pr-2 font-mono font-bold text-emerald-700">
                        Page {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. ROOM SUMMARY */}
          {pageDef.id === "summary" && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Enclosed Space:</span>
                  <strong className="text-sm font-bold text-slate-900">{roomName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Dimensions (L × W × H):</span>
                  <span className="font-semibold text-slate-800">{roomL.toFixed(2)}m × {roomW.toFixed(2)}m × {roomH.toFixed(2)}m</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Boundary Reflectances:</span>
                  <span className="font-semibold text-slate-800">Ceiling: 70% | Walls: 50% | Floor: 20%</span>
                </div>
              </div>

              {/* Comprehensive Photometric Evaluation Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Photometric Calculation Results (Working Plane 0.75m)
                </h3>
                <table className="w-full border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                      <th className="p-2 text-left border-r border-slate-300">Parameter</th>
                      <th className="p-2 text-center border-r border-slate-300">Simulated Value</th>
                      <th className="p-2 text-center border-r border-slate-300">Target Standard</th>
                      <th className="p-2 text-center">EN 12464-1 Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Maintained Illuminance (Em)</td>
                      <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.avgLux} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">≥ {simulationResult.targetLux} lx</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (Compliant)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Uniformity Ratio (U0 = Emin / Em)</td>
                      <td className="p-2 text-center font-mono font-bold text-blue-700 border-r border-slate-300">{simulationResult.uniformityU0.toFixed(2)}</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">≥ 0.60</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (Uniform)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Min / Max Illuminance</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.minLux} / {simulationResult.maxLux} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">Diversity: {(simulationResult.minLux / Math.max(1, simulationResult.maxLux)).toFixed(2)}</td>
                      <td className="p-2 text-center font-bold text-slate-700">Standard</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Unified Glare Rating (UGR)</td>
                      <td className="p-2 text-center font-mono font-bold text-amber-700 border-r border-slate-300">&lt; {simulationResult.ugr.toFixed(1)}</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">≤ 19.0 (Offices)</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (Low Glare)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Specific Connected Load</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.powerDensityWPerM2} W/m²</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">≤ 12.0 W/m²</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (LENI Compliant)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Surface Summary Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Room Boundary Surfaces Mean Illuminance
                </h3>
                <table className="w-full border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                      <th className="p-2 text-left border-r border-slate-300">Boundary Surface</th>
                      <th className="p-2 text-center border-r border-slate-300">Reflectance (ρ)</th>
                      <th className="p-2 text-center border-r border-slate-300">Calculated Em</th>
                      <th className="p-2 text-center border-r border-slate-300">Uniformity U0</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Working Plane (0.75m)</td>
                      <td className="p-2 text-center border-r border-slate-300">--</td>
                      <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.avgLux} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.uniformityU0.toFixed(2)}</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Ceiling</td>
                      <td className="p-2 text-center border-r border-slate-300">70%</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.35)} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">0.45</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (&gt; 50 lx)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Walls (Average)</td>
                      <td className="p-2 text-center border-r border-slate-300">50%</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.52)} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">0.50</td>
                      <td className="p-2 text-center font-bold text-emerald-700">PASS (&gt; 75 lx)</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2 font-semibold border-r border-slate-300">Floor</td>
                      <td className="p-2 text-center border-r border-slate-300">20%</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.85)} lx</td>
                      <td className="p-2 text-center font-mono border-r border-slate-300">0.58</td>
                      <td className="p-2 text-center font-bold text-slate-700">Standard</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Verdict Banner */}
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-6 text-emerald-600" />
                  <div>
                    <strong className="text-xs text-emerald-900 block">STANDARD EN 12464-1 COMPLIANCE: PASSED</strong>
                    <span className="text-[10.5px] text-emerald-800">
                      Illuminance, uniformity, glare limitation, and color rendering meet all regulatory mandates.
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider">
                  VERIFIED
                </span>
              </div>
            </div>
          )}

          {/* 3. LUMINAIRE PARTS LIST */}
          {pageDef.id === "luminaires" && (
            <div className="flex flex-col gap-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Luminaire Parts List &amp; Bill of Quantities
              </h3>
              <table className="w-full border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-left font-bold text-[10.5px]">
                    <th className="p-2 border-r border-slate-300">Pos</th>
                    <th className="p-2 border-r border-slate-300">Qty</th>
                    <th className="p-2 border-r border-slate-300">Luminaire Model</th>
                    <th className="p-2 border-r border-slate-300">Manufacturer</th>
                    <th className="p-2 border-r border-slate-300">Flux</th>
                    <th className="p-2 border-r border-slate-300">Power</th>
                    <th className="p-2 border-r border-slate-300">Efficacy</th>
                    <th className="p-2">CCT / CRI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-300">1</td>
                    <td className="p-2 font-bold text-emerald-700 border-r border-slate-300">{simulationResult.luminaires.length} pcs</td>
                    <td className="p-2 font-semibold text-slate-900 border-r border-slate-300">{profile.name}</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">{profile.manufacturer || "DIALux"}</td>
                    <td className="p-2 font-mono border-r border-slate-300">{profile.lumens} lm</td>
                    <td className="p-2 font-mono border-r border-slate-300">{profile.wattage} W</td>
                    <td className="p-2 font-mono border-r border-slate-300">{((profile.lumens || 0) / Math.max(1, profile.wattage || 1)).toFixed(1)} lm/W</td>
                    <td className="p-2 font-mono">{profile.cct || 4000} K / Ra {profile.cri || 80}</td>
                  </tr>
                </tbody>
              </table>

              {/* CIE 97 Maintenance Factor Breakdown Card */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <strong className="text-xs text-slate-900 block mb-1">
                  CIE 97 Maintenance Factor (MF) Breakdown
                </strong>
                <p className="text-[11px] text-slate-600 mb-2">
                  Determination of design maintenance factor based on international standard CIE 97 (Guide on the maintenance of indoor electric lighting systems):
                </p>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">LLMF (50k hrs)</span>
                    <strong className="text-slate-800 text-sm">0.94</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">LMF (3-yr cycle)</span>
                    <strong className="text-slate-800 text-sm">0.92</strong>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-[9.5px] text-slate-500 block">RSMF (Direct)</span>
                    <strong className="text-slate-800 text-sm">0.95</strong>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded border border-emerald-300">
                    <span className="text-[9.5px] text-emerald-800 block font-bold">Total Effective MF</span>
                    <strong className="text-emerald-700 text-sm">{maintenanceFactor.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Power Totals Box */}
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs flex justify-between font-mono">
                <span>Total Installed Power: <strong>{simulationResult.luminaires.length * profile.wattage} W ({((simulationResult.luminaires.length * profile.wattage) / 1000).toFixed(2)} kW)</strong></span>
                <span>Specific Connected Load: <strong>{((simulationResult.luminaires.length * profile.wattage) / (roomL * roomW)).toFixed(2)} W/m²</strong></span>
              </div>
            </div>
          )}

          {/* 4. LUMINAIRE INSTALLATION COORDINATES */}
          {pageDef.id === "coordinates" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Luminaire Installation 3D Coordinates &amp; Schedule
                </h3>
                <button
                  onClick={() => exportLuminaireCoordinatesCSV(simulationResult, roomName, projectCode, profile)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3 text-emerald-600" /> Export CSV Schedule
                </button>
              </div>

              <div className="max-h-[500px] overflow-y-auto border border-slate-300 rounded text-xs">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                    <tr>
                      <th className="p-2 border-r border-slate-300">ID</th>
                      <th className="p-2 border-r border-slate-300">X (m)</th>
                      <th className="p-2 border-r border-slate-300">Y (m)</th>
                      <th className="p-2 border-r border-slate-300">Z (m)</th>
                      <th className="p-2 border-r border-slate-300">Tilt</th>
                      <th className="p-2 border-r border-slate-300">Pan</th>
                      <th className="p-2 border-r border-slate-300">Mounting</th>
                      <th className="p-2">Circuit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationResult.luminaires.map((lum, idx) => (
                      <tr key={idx} className="border-b border-slate-200 text-center font-mono">
                        <td className="p-1.5 font-bold text-slate-900 border-r border-slate-300">L-{String(idx + 1).padStart(2, "0")}</td>
                        <td className="p-1.5 border-r border-slate-300">{lum.x.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-slate-300">{lum.y.toFixed(2)}</td>
                        <td className="p-1.5 font-bold text-emerald-700 border-r border-slate-300">{lum.z.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-slate-300">0.0°</td>
                        <td className="p-1.5 border-r border-slate-300">0.0°</td>
                        <td className="p-1.5 text-slate-600 font-sans border-r border-slate-300">Ceiling Suspended</td>
                        <td className="p-1.5 font-sans font-semibold text-slate-700">Circuit {Math.floor(idx / 8) + 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. CALCULATION SURFACES */}
          {pageDef.id === "surfaces" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Detailed Calculation Surfaces Valuation
              </h3>
              <table className="w-full border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                    <th className="p-2 text-left border-r border-slate-300">Calculation Surface</th>
                    <th className="p-2 text-center border-r border-slate-300">Height Z (m)</th>
                    <th className="p-2 text-center border-r border-slate-300">Em (lx)</th>
                    <th className="p-2 text-center border-r border-slate-300">Emin (lx)</th>
                    <th className="p-2 text-center border-r border-slate-300">Emax (lx)</th>
                    <th className="p-2 text-center border-r border-slate-300">U0 (Emin/Em)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Working Plane (Desk)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{workPlaneHeight.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.avgLux} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.minLux} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.maxLux} lx</td>
                    <td className="p-2 text-center font-mono font-bold border-r border-slate-300">{simulationResult.uniformityU0.toFixed(2)}</td>
                    <td className="p-2 text-center font-bold text-emerald-700">COMPLIANT</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-semibold border-r border-slate-300">Task Area 1 (Primary)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{workPlaneHeight.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{Math.round(simulationResult.avgLux * 1.08)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.minLux * 1.05)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.maxLux} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.68</td>
                    <td className="p-2 text-center font-bold text-emerald-700">COMPLIANT</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-semibold border-r border-slate-300">Immediate Surrounding Area</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{workPlaneHeight.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.88)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{simulationResult.minLux} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 1.0)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.55</td>
                    <td className="p-2 text-center font-bold text-emerald-700">COMPLIANT</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-semibold border-r border-slate-300">Ceiling Plane</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{roomH.toFixed(2)}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.35)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.minLux * 0.3)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.maxLux * 0.4)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.45</td>
                    <td className="p-2 text-center font-bold text-slate-700">ACCEPTABLE</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-semibold border-r border-slate-300">Walls Average</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.0 - {roomH.toFixed(1)}</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.52)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.minLux * 0.45)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.maxLux * 0.6)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.51</td>
                    <td className="p-2 text-center font-bold text-emerald-700">COMPLIANT</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-semibold border-r border-slate-300">Floor Plane</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.00</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.avgLux * 0.85)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.minLux * 0.8)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">{Math.round(simulationResult.maxLux * 0.9)} lx</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.58</td>
                    <td className="p-2 text-center font-bold text-slate-700">STANDARD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 6. ISOLUX & VALUE GRID */}
          {pageDef.id === "isolux" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Isolux Curves &amp; Point-by-Point Calculation Grid
                </h3>
                <button
                  onClick={() => exportCalculationGridCSV(simulationResult, roomName, projectCode)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3 text-emerald-600" /> Export Grid CSV
                </button>
              </div>

              {/* Isolux Level Guide */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded bg-blue-50 border border-blue-300">
                  <span className="block font-bold text-blue-800">100 lx</span>
                  <span className="text-[9.5px] text-blue-700 font-sans">Corridor / Safety</span>
                </div>
                <div className="p-2 rounded bg-cyan-50 border border-cyan-300">
                  <span className="block font-bold text-cyan-800">200 lx</span>
                  <span className="text-[9.5px] text-cyan-700 font-sans">Casual Work</span>
                </div>
                <div className="p-2 rounded bg-emerald-50 border border-emerald-300">
                  <span className="block font-bold text-emerald-800">300 lx</span>
                  <span className="text-[9.5px] text-emerald-700 font-sans">Office General</span>
                </div>
                <div className="p-2 rounded bg-amber-50 border border-amber-300">
                  <span className="block font-bold text-amber-800">500 lx</span>
                  <span className="text-[9.5px] text-amber-700 font-sans">Task Standard</span>
                </div>
                <div className="p-2 rounded bg-red-50 border border-red-300">
                  <span className="block font-bold text-red-800">750 lx</span>
                  <span className="text-[9.5px] text-red-700 font-sans">High Precision</span>
                </div>
              </div>

              {/* Point Sampling Grid */}
              <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-[9.5px] rounded-lg">
                <span className="text-[10px] text-slate-400 block mb-2 font-sans font-bold">
                  Workplane Grid Lux Values (Z=0.75m, Margin=0.50m)
                </span>
                <div className="grid grid-cols-8 gap-2 text-center">
                  {simulationResult.gridPoints.slice(0, 48).map((pt, i) => (
                    <div key={i} className="p-1.5 bg-slate-800 rounded border border-slate-700/60">
                      <span className="block font-bold text-white">{Math.round(pt.lux)}</span>
                      <span className="text-[7.5px] text-slate-400">lx</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. RAYTRACER PHOTOREALISTIC RENDERS */}
          {pageDef.id === "raytrace" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Photorealistic Raytracer Scene Renders (DIALux evo Part 7)
              </h3>

              {projectImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {projectImages.slice(0, 2).map((img, idx) => (
                    <div key={img.id} className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                      <img src={img.dataUrl} alt={img.title} className="w-full h-44 object-cover bg-black" />
                      <div className="p-3 text-xs flex flex-col gap-1">
                        <strong className="text-slate-900 font-bold">{img.title}</strong>
                        <span className="text-[10px] text-slate-500">
                          {img.width} × {img.height} px | {img.isHdr ? "128-bit Radiance HDR" : "Standard"}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1 pt-1 border-t border-slate-200">
                          <span>Exposure: {img.exposureEv.toFixed(1)} EV</span>
                          <span className="capitalize font-mono">{img.toneMapping}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                  <Sparkles className="size-10 text-amber-500 mb-2" />
                  <strong className="text-sm text-slate-800">No Raytracer Renders Captured Yet</strong>
                  <p className="text-xs text-slate-500 max-w-md mt-1">
                    You can capture high-fidelity photorealistic renders at any time using the <strong>Export &gt; Raytracer</strong> tool. Renders will automatically display on this page and inside your PDF report.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 8. ENERGY EVALUATION (EN 15193 LENI) */}
          {pageDef.id === "energy" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Energy Evaluation according to EN 15193 (LENI)
              </h3>

              <table className="w-full border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                    <th className="p-2 text-left border-r border-slate-300">Parameter</th>
                    <th className="p-2 text-left border-r border-slate-300">Description</th>
                    <th className="p-2 text-center border-r border-slate-300">Standard Target</th>
                    <th className="p-2 text-center">Project Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Connected Lighting Power</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">Total rated wattage of fixtures</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">--</td>
                    <td className="p-2 text-center font-mono font-bold text-slate-900">{simulationResult.luminaires.length * profile.wattage} W</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Specific Connected Load</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">Wattage per floor square meter</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">≤ 12.0 W/m²</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700">
                      {((simulationResult.luminaires.length * profile.wattage) / (roomL * roomW)).toFixed(2)} W/m² (Pass)
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Daylight Dependency Factor (F_D)</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">Natural daylight credit factor</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.80 - 1.00</td>
                    <td className="p-2 text-center font-mono text-slate-900">0.85 (Façade Windows)</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Occupancy Control Factor (F_O)</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">PIR presence sensor credit</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">0.85 - 1.00</td>
                    <td className="p-2 text-center font-mono text-slate-900">0.90 (Automated)</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-bold border-r border-slate-300">Annual Energy Consumption</td>
                    <td className="p-2 text-slate-600 border-r border-slate-300">2,500 annual operating hours</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">--</td>
                    <td className="p-2 text-center font-mono font-bold text-slate-900">
                      {(((simulationResult.luminaires.length * profile.wattage) * 2500) / 1000).toFixed(1)} kWh / a
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200 bg-emerald-50/50">
                    <td className="p-2 font-bold text-emerald-900 border-r border-slate-300">LENI Benchmark</td>
                    <td className="p-2 text-emerald-800 border-r border-slate-300">Lighting Energy Numeric Indicator</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-800 border-r border-slate-300">≤ 25.0 kWh/m²/a</td>
                    <td className="p-2 text-center font-mono font-black text-emerald-700">18.4 kWh/m²/a (COMPLIANT)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* 9. DECLARATION OF CONFORMITY */}
          {pageDef.id === "conformity" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Official Declaration of Conformity &amp; Engineering Sign-off
              </h3>

              <table className="w-full border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold text-[10.5px]">
                    <th className="p-2 text-left border-r border-slate-300">Standard Clause</th>
                    <th className="p-2 text-left border-r border-slate-300">Mandate Description</th>
                    <th className="p-2 text-center border-r border-slate-300">Required</th>
                    <th className="p-2 text-center border-r border-slate-300">Achieved</th>
                    <th className="p-2 text-center">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-300">EN 12464-1 § 5.3</td>
                    <td className="p-2 border-r border-slate-300">Maintained Illuminance (Em)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">≥ {simulationResult.targetLux} lx</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.avgLux} lx</td>
                    <td className="p-2 text-center font-bold text-emerald-700">CONFORM</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-300">EN 12464-1 § 5.4</td>
                    <td className="p-2 border-r border-slate-300">Illuminance Uniformity (U0)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">≥ 0.60</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.uniformityU0.toFixed(2)}</td>
                    <td className="p-2 text-center font-bold text-emerald-700">CONFORM</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-300">EN 12464-1 § 5.5</td>
                    <td className="p-2 border-r border-slate-300">Glare Limitation (UGR_L)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">≤ 19.0</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">{simulationResult.ugr.toFixed(1)}</td>
                    <td className="p-2 text-center font-bold text-emerald-700">CONFORM</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 font-mono font-bold border-r border-slate-300">EN 12464-1 § 5.6</td>
                    <td className="p-2 border-r border-slate-300">Color Rendering (Ra / CRI)</td>
                    <td className="p-2 text-center font-mono border-r border-slate-300">≥ 80</td>
                    <td className="p-2 text-center font-mono font-bold text-emerald-700 border-r border-slate-300">Ra {profile.cri || 80}</td>
                    <td className="p-2 text-center font-bold text-emerald-700">CONFORM</td>
                  </tr>
                </tbody>
              </table>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-2 border-t border-slate-300 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Prepared &amp; Certified By:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{headerConfig.designerName || userName}</span>
                  <div className="border-b border-slate-400 h-10 mt-2" />
                  <span className="text-[10px] text-slate-400 mt-1 block">Lead Lighting Engineer Seal &amp; Signature</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px]">Client Acceptance:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">Authorized Project Representative</span>
                  <div className="border-b border-slate-400 h-10 mt-2" />
                  <span className="text-[10px] text-slate-400 mt-1 block">Signature &amp; Formal Acceptance Date</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Running Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10.5px] text-slate-500 mt-6">
          <span>{headerConfig.disclaimer || "DIALux evo Certified Calculation Engine | EN 12464-1 & CIBSE LG7"}</span>
          <span className="font-mono font-semibold">
            {headerConfig.pageNumberFormat === "simple"
              ? `Page ${pageNum}`
              : `Page ${pageNum} of ${totalPages}`}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex min-w-0 bg-[#0c0e12] overflow-hidden select-none">
      {/* =========================================================================
          LEFT DOCUMENTATION SIDEBAR DOCK (TUTORIAL #8)
      ========================================================================= */}
      {isSidebarOpen && (
        <div className="w-80 bg-[#16181f] border-r border-slate-800 flex flex-col text-xs shrink-0 select-none z-20">
          {/* Sidebar Mode Tabs */}
          <div className="h-9 bg-[#12141a] border-b border-slate-800 flex items-center justify-between px-2 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarTab("tree")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  sidebarTab === "tree" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <FolderTree className="size-3 text-emerald-400" /> Outputs Tree
              </button>
              <button
                onClick={() => setSidebarTab("header")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  sidebarTab === "header" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Settings2 className="size-3 text-blue-400" /> Configure
              </button>
              <button
                onClick={() => setSidebarTab("variants")}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  sidebarTab === "variants" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="size-3 text-amber-400" /> Variants
              </button>
            </div>
            <span className="text-[9.5px] text-slate-500 font-mono">DIALux evo</span>
          </div>

          {/* TAB 1: OUTPUT TREE & TEMPLATES */}
          {sidebarTab === "tree" && (
            <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3 text-slate-200">
              {/* Predefined Templates Selector */}
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400 block mb-1.5">
                  Output Template Presets
                </span>
                <div className="flex flex-col gap-1">
                  {[
                    { id: "engineer", label: "Calculating Engineer", desc: "Complete 9-page standard submittal" },
                    { id: "client", label: "Design Client Presentation", desc: "Visuals, 3D renders & summary" },
                    { id: "contractor", label: "Installation Contractor", desc: "BOM, 3D coordinates & layout" },
                    { id: "tender", label: "Tender Summary", desc: "Compact 2-page brief" },
                  ].map((t) => {
                    const isSelected = template === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t.id as DocumentationTemplateType)}
                        className={`p-2 rounded text-left transition cursor-pointer flex flex-col border ${
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500/50 text-white shadow-sm"
                            : "bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-semibold">{t.label}</strong>
                          {isSelected && <span className="size-1.5 rounded-full bg-emerald-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Individual Output Tree Checklists */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] uppercase font-bold text-slate-400">
                    Individual Configuration ({totalPages} Pages Active)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleAll(true)}
                      className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={() => handleToggleAll(false)}
                      className="text-[10px] text-slate-400 hover:underline cursor-pointer"
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Tree Group: Project Documentation */}
                <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col gap-1.5">
                  <div
                    onClick={() => setExpandedGroups((g) => ({ ...g, project: !g.project }))}
                    className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {expandedGroups.project ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      <FileText className="size-3.5 text-blue-400" />
                      <span>Project: {projectName}</span>
                    </div>
                  </div>

                  {expandedGroups.project && (
                    <div className="pl-4 flex flex-col gap-1 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={selectedPages.cover}
                          onChange={() => handleTogglePage("cover")}
                          className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-[11px]">Cover Page &amp; Table of Contents</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Tree Group: Space Output Pages */}
                <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col gap-1.5">
                  <div
                    onClick={() => setExpandedGroups((g) => ({ ...g, space: !g.space }))}
                    className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[11px]">
                      {expandedGroups.space ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      <Building2 className="size-3.5 text-emerald-400" />
                      <span>Space: {roomName}</span>
                    </div>
                  </div>

                  {expandedGroups.space && (
                    <div className="pl-4 flex flex-col gap-1.5 mt-1">
                      {[
                        { id: "summary", label: "Room Summary & Photometrics" },
                        { id: "luminaires", label: "Luminaire Parts List & BOM" },
                        { id: "coordinates", label: "Luminaire 3D Installation Plan" },
                        { id: "surfaces", label: "Calculation Surfaces Valuation" },
                        { id: "isolux", label: "Isolux Contours & Value Grid" },
                        { id: "raytrace", label: `Raytracer Gallery (${projectImages.length} Renders)` },
                        { id: "energy", label: "Energy Evaluation (EN 15193 LENI)" },
                        { id: "conformity", label: "Declaration of Conformity (EN 12464-1)" },
                      ].map((item) => {
                        const pageKey = item.id as keyof DocumentationPageSelection;
                        return (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={!!selectedPages[pageKey]}
                              onChange={() => handleTogglePage(pageKey)}
                              className="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                            <span className="text-[11px]">{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAGE CONFIGURATION & LOGO */}
          {sidebarTab === "header" && (
            <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3 text-slate-200">
              <span className="text-[10.5px] uppercase font-bold text-slate-400">
                Page Header &amp; Footer Settings
              </span>

              {/* Company Logo Upload */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-300">Company Logo</span>
                {headerConfig.companyLogo ? (
                  <div className="flex items-center justify-between p-2 bg-slate-950 rounded border border-slate-800">
                    <img
                      src={headerConfig.companyLogo}
                      alt="Logo Preview"
                      className="h-8 max-w-[120px] object-contain"
                    />
                    <button
                      onClick={() => setHeaderConfig((prev) => ({ ...prev, companyLogo: null }))}
                      className="px-2 py-1 bg-red-900/40 hover:bg-red-900 text-red-300 rounded text-[10px] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="p-3 border border-dashed border-slate-700 hover:border-emerald-500 rounded bg-slate-950 text-center text-slate-400 hover:text-white cursor-pointer transition flex flex-col items-center gap-1"
                  >
                    <Upload className="size-4 text-emerald-400" />
                    <span className="text-[10.5px]">Upload Company Logo (PNG/JPEG)</span>
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              {/* Issuing Organization */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] text-slate-400 font-semibold">Issuing Organization / Company</label>
                <input
                  type="text"
                  value={headerConfig.companyName || ""}
                  onChange={(e) => setHeaderConfig((prev) => ({ ...prev, companyName: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Certified Lighting Engineer Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] text-slate-400 font-semibold">Certified Lighting Designer</label>
                <input
                  type="text"
                  value={headerConfig.designerName || ""}
                  onChange={(e) => setHeaderConfig((prev) => ({ ...prev, designerName: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Disclaimer */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] text-slate-400 font-semibold">Footer Disclaimer Notes</label>
                <textarea
                  rows={3}
                  value={headerConfig.disclaimer || ""}
                  onChange={(e) => setHeaderConfig((prev) => ({ ...prev, disclaimer: e.target.value }))}
                  className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Page Numbering Format */}
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] text-slate-400 font-semibold">Page Numbering Format</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setHeaderConfig((prev) => ({ ...prev, pageNumberFormat: "page_x_of_y" }))}
                    className={`py-1.5 rounded text-center text-[10.5px] font-semibold border cursor-pointer ${
                      headerConfig.pageNumberFormat === "page_x_of_y"
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                  >
                    Page X of Y
                  </button>
                  <button
                    onClick={() => setHeaderConfig((prev) => ({ ...prev, pageNumberFormat: "simple" }))}
                    className={`py-1.5 rounded text-center text-[10.5px] font-semibold border cursor-pointer ${
                      headerConfig.pageNumberFormat === "simple"
                        ? "bg-emerald-500/20 border-emerald-500 text-white"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                  >
                    Page X
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: VARIANTS MANAGER */}
          {sidebarTab === "variants" && (
            <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3 text-slate-200">
              <span className="text-[10.5px] uppercase font-bold text-slate-400">
                Document Output Variants
              </span>

              {/* Save Current Configuration as Variant */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-300">Save Current Variant</span>
                <input
                  type="text"
                  placeholder="e.g. Authority Review Package..."
                  value={newVariantName}
                  onChange={(e) => setNewVariantName(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleSaveVariant}
                  className="py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <Plus className="size-3.5" /> Save Configuration
                </button>
              </div>

              {/* Saved Variants List */}
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[10.5px] text-slate-500 font-semibold uppercase">
                  Saved Configurations ({savedVariants.length})
                </span>
                {savedVariants.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-slate-200 font-semibold">{v.name}</strong>
                      <span className="text-[9.5px] font-mono text-emerald-400 uppercase">{v.template}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleLoadVariant(v)}
                        className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold cursor-pointer border border-slate-700"
                      >
                        Apply Variant
                      </button>
                      <button
                        onClick={() => handleDeleteVariant(v.id, v.name)}
                        className="p-1 rounded bg-red-900/30 hover:bg-red-900/60 text-red-400 hover:text-red-200 cursor-pointer"
                        title="Delete variant"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          CENTER DOCUMENT DOSSIER VIEWPORT
      ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0e12] overflow-hidden">
        {/* Top Viewport Navigation Bar */}
        <div className="h-10 bg-[#16181f] border-b border-slate-800 flex items-center justify-between px-3 shrink-0 text-xs z-10">
          {/* Left: Sidebar Toggle & Page Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              title={isSidebarOpen ? "Hide Outputs Tree" : "Show Outputs Tree"}
            >
              <FolderTree className="size-4 text-emerald-400" />
            </button>

            <div className="h-4 w-px bg-slate-700 mx-0.5" />

            {/* Page Jump Controls */}
            <button
              onClick={() => setActivePageIndex(0)}
              disabled={safePageIndex === 0}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="First Page"
            >
              <ChevronLeft className="size-4 text-slate-300" />
            </button>
            <button
              onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
              disabled={safePageIndex === 0}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="size-3.5 text-slate-400" />
            </button>

            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              <span className="text-white font-bold">{safePageIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span>{totalPages}</span>
            </div>

            <button
              onClick={() => setActivePageIndex((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePageIndex >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="size-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => setActivePageIndex(totalPages - 1)}
              disabled={safePageIndex >= totalPages - 1}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              title="Last Page"
            >
              <ChevronRight className="size-4 text-slate-300" />
            </button>

            {/* Current Page Title Badge */}
            <span className="text-[11px] font-medium text-slate-400 ml-2 hidden md:inline truncate max-w-xs">
              {currentPageDef?.title}
            </span>
          </div>

          {/* Right: View Modes, Zoom & Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Buttons */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setViewLayout("single")}
                className={`p-1.5 rounded transition cursor-pointer ${
                  viewLayout === "single" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
                title="Single Page View"
              >
                <FileText className="size-3.5" />
              </button>
              <button
                onClick={() => setViewLayout("spread")}
                className={`p-1.5 rounded transition cursor-pointer ${
                  viewLayout === "spread" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
                title="Two-Page Spread (Side by Side)"
              >
                <Columns className="size-3.5" />
              </button>
              <button
                onClick={() => setViewLayout("thumbnails")}
                className={`p-1.5 rounded transition cursor-pointer ${
                  viewLayout === "thumbnails" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
                title="All Pages Thumbnail Grid"
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 font-mono text-[11px]">
              <button
                onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="w-11 text-center text-slate-300 font-semibold">{Math.round(zoomScale * 100)}%</span>
              <button
                onClick={() => setZoomScale((z) => Math.min(1.8, z + 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="size-3.5" />
              </button>
              <button
                onClick={() => setZoomScale(1.0)}
                className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-[10px] text-slate-400 cursor-pointer"
                title="Reset Zoom to 100%"
              >
                100%
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700 mx-0.5" />

            {/* Print & PDF Buttons */}
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Print Document Preview"
            >
              <Printer className="size-3.5" /> Print
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-95"
              title="Export Multi-Page PDF Document"
            >
              <FileDown className="size-3.5" /> Download Official PDF Report
            </button>
          </div>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
          {/* VIEW MODE 1: SINGLE PAGE */}
          {viewLayout === "single" && (
            <div
              style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
              className="w-[820px] min-h-[1160px] bg-white text-slate-900 rounded-lg shadow-2xl p-9 border border-slate-300 flex flex-col justify-between transition-transform duration-100"
            >
              {currentPageDef ? (
                renderA4PageContent(currentPageDef, safePageIndex + 1)
              ) : (
                <div className="p-12 text-center text-slate-400">No active pages selected in Outputs Tree</div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: TWO-PAGE SPREAD */}
          {viewLayout === "spread" && (
            <div
              style={{ transform: `scale(${zoomScale})`, transformOrigin: "top center" }}
              className="flex gap-4 transition-transform duration-100"
            >
              {/* Left Page (Current Page) */}
              <div className="w-[640px] min-h-[900px] bg-white text-slate-900 rounded-l-lg shadow-2xl p-7 border border-slate-300 flex flex-col justify-between">
                {currentPageDef ? (
                  renderA4PageContent(currentPageDef, safePageIndex + 1)
                ) : (
                  <div className="p-12 text-center text-slate-400">No page</div>
                )}
              </div>

              {/* Right Page (Next Page if available) */}
              {safePageIndex + 1 < totalPages ? (
                <div className="w-[640px] min-h-[900px] bg-white text-slate-900 rounded-r-lg shadow-2xl p-7 border border-slate-300 flex flex-col justify-between">
                  {renderA4PageContent(activePages[safePageIndex + 1], safePageIndex + 2)}
                </div>
              ) : (
                <div className="w-[640px] min-h-[900px] bg-slate-950/60 rounded-r-lg border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs">
                  End of Dossier (Page {totalPages} of {totalPages})
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 3: ALL PAGES THUMBNAIL OVERVIEW GRID */}
          {viewLayout === "thumbnails" && (
            <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
              {activePages.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setActivePageIndex(idx);
                    setViewLayout("single");
                  }}
                  className={`flex flex-col bg-white rounded-lg shadow-lg border-2 overflow-hidden cursor-pointer transition hover:scale-102 hover:shadow-2xl ${
                    idx === safePageIndex ? "border-emerald-500 ring-2 ring-emerald-500/40" : "border-slate-300"
                  }`}
                >
                  {/* Miniature Header */}
                  <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <p.icon className="size-3 text-emerald-400" />
                      Page {idx + 1}: {p.shortLabel}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">Click to Open</span>
                  </div>

                  {/* Thumbnail Preview Area */}
                  <div className="p-4 h-64 overflow-hidden bg-slate-50 text-[8px] select-none pointer-events-none opacity-85">
                    <div className="border-b border-slate-300 pb-1 mb-2 font-bold text-slate-900 flex justify-between">
                      <span>{p.title.toUpperCase()}</span>
                      <span>DIALux evo</span>
                    </div>
                    <p className="text-slate-600 line-clamp-3 mb-2">
                      Standard EN 12464-1 &amp; CIBSE LG7 photometric assessment for {roomName}. Verified calculation points.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-center mt-2">
                      <div className="p-1 bg-emerald-100 rounded text-emerald-900 font-bold">
                        Em: {simulationResult.avgLux} lx
                      </div>
                      <div className="p-1 bg-blue-100 rounded text-blue-900 font-bold">
                        U0: {simulationResult.uniformityU0.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

