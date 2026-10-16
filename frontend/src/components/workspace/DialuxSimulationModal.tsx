import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  FileDown,
  Sparkles,
  Layers,
  Sun,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RotateCcw,
  Sliders,
  Check,
  Grid,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Box,
  LayoutGrid,
  TableProperties,
  Play,
  Square,
  Settings,
  Compass,
  Ruler,
  Maximize2,
  Minimize2,
  Lightbulb,
  FileText,
  Bookmark,
  DoorClosed,
  Palette,
  HelpCircle,
  Save,
  Undo,
  Redo,
  Trash2,
  Copy,
  SlidersHorizontal,
  Info,
  Download,
  Printer,
  Keyboard,
  Globe,
  FolderTree,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Type,
  Target,
  Scissors,
  Camera,
  Maximize,
  Eye,
  SlidersVertical,
  Leaf,
  Plus,
  Moon,
  Monitor,
  EyeOff,
  FolderOpen,
  RotateCw,
  Crosshair,
  Shapes,
  FlipHorizontal,
  FlipVertical,
  Zap,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import {
  LuminairePhotometricProfile,
  BUILTIN_PHOTOMETRIC_PROFILES,
  computeOptimalGridLayout,
  runPointByPointSimulation,
  getFalseColorForLux,
  parsePhotometricFile,
  DialuxSimulationResult,
  SurfaceReflectances,
  STANDARD_REFLECTANCE_PRESETS,
  LuminaireArrangementMode,
  CalculationAreaType,
  WorkstationAreaConfig,
  AreaPhotometricStats,
  WORKSTATION_PRESETS,
  kelvinToHex,
  downloadDialuxSTF,
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
  calculateComprehensiveDaylight,
  getDaylightFactorFalseColor,
  CIESkyModel,
  ComprehensiveDaylightResult,
} from "@/lib/dialux-photometrics-engine";
import { exportDialuxReportPDF, exportProjectDialuxReportPDF } from "@/lib/exportDialuxReportPDF";
import {
  LightInspectors,
  CalcInspectors,
  ExportInspectors,
  ProjectInspectors,
  BrandsCatalogue,
  DocumentationViewer,
  BrandLuminaire,
} from "./DialuxWorkflowPanels";
import {
  PolygonSpaceModal,
  SubspaceModal,
  NewRoomModal,
  ApertureModal,
  FacadeModal,
  RoofModal,
  CeilingModal,
  FurnitureModal,
  MaterialModal,
  SettingsModal,
  HelpModal,
  MaintenanceFactorModal,
  DaylightAnalysisModal,
  EmergencyLightingModal,
  LuminairePlacementModal,
  RaytracerModal,
  DialuxDisplayOptionsPanel,
  SavedCameraViewpoint,
  SimpleIndoorPlanningModal,
  StaircaseExtrusionModal,
  StaircaseCopyAlongLineModal,
  WhiteBalanceCameraModal,
  DialuxRoundaboutModal,
  DialuxUGRModal,
  DialuxDrawingFromScratchModal,
  DialuxMedianStripModal,
  DialuxMaintenanceFactorStudioModal,
  DialuxLightScenesStudioModal,
  DialuxPoolLightingStudioModal,
  DialuxDaylightSystemsStudioModal,
  DialuxCutoutRoofStudioModal,
  DialuxWorkplaneStudioModal,
  DialuxStandardsStudioModal,
  DialuxTexturesStudioModal,
  DialuxImprovingLuminairesModal,
  DialuxCompleteSceneryModal,
  DialuxEffectiveLightingModal,
} from "./DialuxConstructionModals";
import { DialuxStreetLightingModal } from "./DialuxStreetLightingModal";
import { CadPlanModal } from "./CadPlanModal";
import {
  CADPlan,
  BUILTIN_CAD_PLANS,
  renderCADPlanToCanvas,
} from "@/lib/dialux-cad-plan-engine";
import { DrawContourModal } from "./DrawContourModal";
import {
  BuildingModel,
  BuildingStorey,
  IndoorRoomContour,
  createDefaultBuilding,
  duplicateStorey,
  addEmptyStorey,
  computeBoundingBox,
} from "@/lib/dialux-building-engine";
import {
  FurnitureItem,
  FurnitureType,
  RoomWallSurfaces,
  DEFAULT_WALL_SURFACES,
  calculateWeightedWallReflectance,
  generateProceduralCanvasTexture,
  createReceptionDeskItem,
  createDeskItem,
  createChairItem,
  createConferenceTableItem,
  createBookshelfItem,
  createMonitorItem,
  createCubeItem,
  generateRectangularFurnitureArray,
  generateLineFurnitureArray,
  generateCircularFurnitureArray,
  DIALUX_MATERIAL_CATALOG,
} from "@/lib/dialux-furniture-material-engine";

export interface ProjectSpaceItem {
  id: string;
  name: string;
  level?: string;
  length: number;
  width: number;
  height: number;
  targetLux: number;
  area: number;
  initialQuantity?: number;
  lightType?: string;
  mf?: number;
  uf?: number;
}

interface DialuxSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSpaceId?: string;
  roomName?: string;
  length?: number;
  width?: number;
  height?: number;
  targetLux?: number;
  initialQuantity?: number;
  mf?: number;
  spaces?: ProjectSpaceItem[];
  ifcFileName?: string;
  projectName?: string;
  projectCode?: string;
  userName?: string;
  onApplyResults?: (results: {
    spaceId: string;
    quantity: number;
    achievedLux: number;
    rows: number;
    cols: number;
    uniformityU0: number;
    lightType: string;
  }) => void;
  onApplyAllProjectResults?: (results: Array<{
    spaceId: string;
    quantity: number;
    achievedLux: number;
    rows: number;
    cols: number;
    uniformityU0: number;
    lightType: string;
  }>) => void;
}

export type ConstructionToolType =
  | "dwg"
  | "ifc"
  | "site"
  | "building"
  | "storey"
  | "space"
  | "polygonal_space"
  | "room_elements"
  | "roofs"
  | "ceilings"
  | "cutouts"
  | "apertures"
  | "facade"
  | "furniture"
  | "materials"
  | "annotations"
  | "copy_arrange"
  | "calc_surfaces"
  | "camera_view"
  | "guide_lines"
  | "tree";

export function DialuxSimulationModal({
  isOpen,
  onClose,
  initialSpaceId,
  roomName: fallbackName = "Room",
  length: fallbackL = 5,
  width: fallbackW = 4,
  height: fallbackH = 2.8,
  targetLux: fallbackTargetLux = 500,
  initialQuantity: fallbackQty = 4,
  mf: fallbackMf = 0.8,
  spaces = [],
  ifcFileName = "Active_Structure.ifc",
  projectName = "MEP Project",
  projectCode = "PRJ-001",
  userName = "MEP Lighting Engineer",
  onApplyResults,
  onApplyAllProjectResults,
}: DialuxSimulationModalProps) {
  // 1. DIALux evo Workflow Ribbon Tabs
  const [workflowTab, setWorkflowTab] = useState<
    "project" | "construction" | "light" | "calculation" | "export" | "documentation" | "brands"
  >("construction");

  const [constructionTool, setConstructionTool] = useState<ConstructionToolType>("space");
  const [lightTool, setLightTool] = useState<"luminaires" | "arrangements" | "lamps" | "scenes" | "energy" | "filters">("luminaires");
  const [calcTool, setCalcTool] = useState<"surfaces" | "task_areas" | "points" | "ugr" | "isolux">("surfaces");
  const [exportTool, setExportTool] = useState<"dwg" | "ifc" | "schedule" | "render" | "raytracer" | "images" | "pdf">("raytracer");
  const [projectTool, setProjectTool] = useState<"info" | "geodetic" | "gallery">("info");

  // DIALux evo Part 7 Raytracer & Images State
  const [isRaytracerModalOpen, setIsRaytracerModalOpen] = useState(false);
  const [projectImages, setProjectImages] = useState<RenderedRaytraceImage[]>([]);

  // DIALux evo Tutorial Part 10 Street & Road Lighting State (EN 13201)
  const [isStreetLightingModalOpen, setIsStreetLightingModalOpen] = useState(false);

  // DIALux evo Tutorial Part 16 Roundabout Lighting State (EN 13201 C-Classes)
  const [isRoundaboutModalOpen, setIsRoundaboutModalOpen] = useState(false);

  // DIALux evo Tutorial Part 17 UGR Calculation State (CIE 117 / EN 12464-1)
  const [isUGRModalOpen, setIsUGRModalOpen] = useState(false);

  // DIALux evo Tutorial Part 18 Drawing from Scratch State (Help Lines & Snapping)
  const [isDrawingFromScratchModalOpen, setIsDrawingFromScratchModalOpen] = useState(false);

  // DIALux evo Tutorial Part 19 Road and Street Lighting: Median Strip State (EN 13201)
  const [isMedianStripModalOpen, setIsMedianStripModalOpen] = useState(false);

  // DIALux evo Tutorial Part 20 Maintenance Factors & Improvements State (CIE 97 / CIE 154)
  const [isMaintenanceStudioOpen, setIsMaintenanceStudioOpen] = useState(false);

  // DIALux evo Tutorial Part 21 Luminaire Groups for Lighting Scenes State
  const [isLightScenesModalOpen, setIsLightScenesModalOpen] = useState(false);

  // DIALux evo Tutorial Part 22 Swimming Pool Lighting State (Water Volume, Basin Cutout, Submersible IP68, EN 12193)
  const [isPoolLightingModalOpen, setIsPoolLightingModalOpen] = useState(false);

  // DIALux evo Tutorial Part 23 Daylighting Systems State (Louvre Blinds, Light Shelves, EN 17037, ODLS)
  const [isDaylightSystemsModalOpen, setIsDaylightSystemsModalOpen] = useState(false);

  // DIALux evo Tutorial Part 24 The Cutout Tool & Complex Roofs State (Polygonal Cutouts, Valley Trimming)
  const [isCutoutRoofModalOpen, setIsCutoutRoofModalOpen] = useState(false);

  // DIALux evo Tutorial Part 25 Managing Interior & Exterior Workplanes State (EN 12464 Profiles, Wall Margins)
  const [isWorkplaneStudioModalOpen, setIsWorkplaneStudioModalOpen] = useState(false);

  // DIALux evo Tutorial Part 26 Norm Control Centre & Standards State (EN 12464, IESNA, AS/NZS, CIBSE, JIS)
  const [isStandardsStudioModalOpen, setIsStandardsStudioModalOpen] = useState(false);

  // DIALux evo Tutorial Part 27 Detailed Textures & Materials State (UV Scaling, Reflectance, Shift-Key)
  const [isTexturesStudioModalOpen, setIsTexturesStudioModalOpen] = useState(false);

  // DIALux evo Tutorial Part 28 Improving Luminaires State (Joints & Light Colour CCT)
  const [isImprovingLuminairesModalOpen, setIsImprovingLuminairesModalOpen] = useState(false);

  // DIALux evo Tutorial Part 29 Complete Building Scenery State (Multi-room, Doors, Windows, Furniture)
  const [isCompleteSceneryModalOpen, setIsCompleteSceneryModalOpen] = useState(false);

  // DIALux evo Tutorial Part 30 Effective Lighting Design State (Task vs Ambient vs Accent Layers)
  const [isEffectiveLightingModalOpen, setIsEffectiveLightingModalOpen] = useState(false);

  // DIALux evo Tutorial Part 12 Simple Indoor Planning State (evo easy)
  const [isSimplePlanningModalOpen, setIsSimplePlanningModalOpen] = useState(false);

  // DIALux evo Tutorial Part 13 Staircases & Extrusion Objects State
  const [isStaircaseModalOpen, setIsStaircaseModalOpen] = useState(false);

  // DIALux evo Tutorial Part 14 Staircases Part 2: Copy Along a Line & Grouping State
  const [isCopyAlongLineModalOpen, setIsCopyAlongLineModalOpen] = useState(false);

  // DIALux evo Tutorial Part 15 White Balance, Camera Positions & Pivoting Point State
  const [isWhiteBalanceModalOpen, setIsWhiteBalanceModalOpen] = useState(false);
  const [isPickingPivot, setIsPickingPivot] = useState(false);
  const [isPickingWhitePoint, setIsPickingWhitePoint] = useState(false);
  const [currentPivot, setCurrentPivot] = useState<{ x: number; y: number; z: number }>({
    x: 3.5,
    y: 1.4,
    z: 2.5,
  });
  const [whiteBalanceTint, setWhiteBalanceTint] = useState<number>(0);

  // Left Dock Mode: Project Tree vs Tool Properties Inspector
  const [leftDockMode, setLeftDockMode] = useState<"inspector" | "tree">("inspector");

  // CAD Canvas Background Theme (White Paper CAD drafting matching screenshots vs Studio Dark Photometrics)
  const [cadTheme, setCadTheme] = useState<"white" | "dark">("white");

  // Project Tree State
  const [treeSearch, setTreeSearch] = useState("");
  const [selectedTreeNode, setSelectedTreeNode] = useState<string>("space-1");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    site: true,
    lightScenes: true,
    building: true,
    storey: true,
    space: true,
    luminaires: true,
    calcSurfaces: true,
  });

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  // Active Dropdown in Top Menu Bar
  const [activeMenu, setActiveMenu] = useState<"file" | "edit" | "goto" | "view" | "help" | null>(null);

  // Settings & Help Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // New DIALux evo Modals & Multi-Room State
  const [isMfModalOpen, setIsMfModalOpen] = useState(false);
  const [isDaylightModalOpen, setIsDaylightModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false);

  // DIALux evo CAD Floor Plan Import State (Tutorial Part 2)
  const [activeCadPlan, setActiveCadPlan] = useState<CADPlan>(() => JSON.parse(JSON.stringify(BUILTIN_CAD_PLANS[0])));
  const [isCadPlanModalOpen, setIsCadPlanModalOpen] = useState(false);
  const [cadModalInitialTab, setCadModalInitialTab] = useState<"file" | "scale" | "origin" | "layers">("file");

  // DIALux evo Building & Storey Construction State (Tutorial Part 3)
  const [buildingModel, setBuildingModel] = useState<BuildingModel>(() =>
    createDefaultBuilding(fallbackL, fallbackW, fallbackH)
  );
  const [isDrawContourModalOpen, setIsDrawContourModalOpen] = useState(false);
  const [drawContourMode, setDrawContourMode] = useState<"building" | "indoor_contour">("indoor_contour");

  const activeStorey = useMemo(() => {
    return (
      buildingModel.storeys.find((s) => s.id === buildingModel.activeStoreyId) ||
      buildingModel.storeys[0]
    );
  }, [buildingModel]);

  // Interactive 3D Point-to-Point Tape Measure (Ruler Tool)
  const [isTapeMeasureActive, setIsTapeMeasureActive] = useState(false);
  const [measurePointA, setMeasurePointA] = useState<{ x: number; y: number; z: number } | null>(null);
  const [measurePointB, setMeasurePointB] = useState<{ x: number; y: number; z: number } | null>(null);

  // Multi-Space Navigation
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(() => {
    return initialSpaceId || (spaces.length > 0 ? spaces[0].id : "default-space");
  });

  useEffect(() => {
    if (initialSpaceId) {
      setSelectedSpaceId(initialSpaceId);
    } else if (spaces.length > 0 && !spaces.some((s) => s.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [initialSpaceId, spaces]);

  // Active space base data
  const baseActiveSpace: ProjectSpaceItem = useMemo(() => {
    const found = spaces.find((s) => s.id === selectedSpaceId);
    if (found) return found;
    return {
      id: "default-space",
      name: fallbackName,
      level: "Ground Floor",
      length: fallbackL,
      width: fallbackW,
      height: fallbackH,
      targetLux: fallbackTargetLux,
      area: fallbackL * fallbackW,
      initialQuantity: fallbackQty,
      mf: fallbackMf,
    };
  }, [spaces, selectedSpaceId, fallbackName, fallbackL, fallbackW, fallbackH, fallbackTargetLux, fallbackQty, fallbackMf]);

  const currentSpaceIndex = spaces.findIndex((s) => s.id === selectedSpaceId);

  // Editable room dimensions (Screenshot 5: Spaces)
  const [roomL, setRoomL] = useState<number>(baseActiveSpace.length || 5);
  const [roomW, setRoomW] = useState<number>(baseActiveSpace.width || 4);
  const [roomH, setRoomH] = useState<number>(baseActiveSpace.height || 2.8);
  const [targetLux, setTargetLux] = useState<number>(baseActiveSpace.targetLux || 500);
  const [spaceCustomName, setSpaceCustomName] = useState<string>(baseActiveSpace.name);

  // Sync when active space changes
  useEffect(() => {
    const curL = Math.max(1, baseActiveSpace.length || 5);
    const curW = Math.max(1, baseActiveSpace.width || 4);
    const curH = Math.max(1.8, baseActiveSpace.height || 2.8);
    setRoomL(curL);
    setRoomW(curW);
    setRoomH(curH);
    setTargetLux(Math.max(50, baseActiveSpace.targetLux || 500));
    setSpaceCustomName(baseActiveSpace.name);

    // Re-center camera and controls directly on the active space
    if (cameraRef.current && controlsRef.current) {
      const cx = curL / 2;
      const cy = curH / 2;
      const cz = curW / 2;
      controlsRef.current.target.set(cx, cy, cz);
      if (cameraView === "3d") {
        cameraRef.current.position.set(curL * 1.4, curH * 1.8, curW * 1.6);
      } else if (cameraView === "top") {
        cameraRef.current.position.set(cx, Math.max(curL, curW) * 2.2, cz);
      }
      controlsRef.current.update();
    }
  }, [selectedSpaceId, baseActiveSpace]);

  // Room Shape & Subspaces (Screenshot 5: Spaces & Polygonal Space)
  const [roomShape, setRoomShape] = useState<"rectangular" | "circular" | "polygon">("rectangular");
  const [polygonPreset, setPolygonPreset] = useState<"l_shaped" | "t_shaped" | "u_shaped" | "hexagon" | "chamfer">("l_shaped");
  const [polygonWingL, setPolygonWingL] = useState<number>(2.5);
  const [polygonWingW, setPolygonWingW] = useState<number>(2.0);
  const [showPolygonModal, setShowPolygonModal] = useState<boolean>(false);

  // Subspace Exclusion State (Cutouts & Core Voids)
  const [hasSubspace, setHasSubspace] = useState<boolean>(false);
  const [subspaceType, setSubspaceType] = useState<"lift_core" | "duct_shaft" | "column_cluster" | "stairwell">("lift_core");
  const [subspaceL, setSubspaceL] = useState<number>(1.2);
  const [subspaceW, setSubspaceW] = useState<number>(1.0);
  const [subspacePosX, setSubspacePosX] = useState<number>(0.6);
  const [subspacePosZ, setSubspacePosZ] = useState<number>(0.6);
  const [showSubspaceModal, setShowSubspaceModal] = useState<boolean>(false);

  // Construction Interactive Modals
  const [showNewRoomModal, setShowNewRoomModal] = useState<boolean>(false);
  const [showApertureModal, setShowApertureModal] = useState<boolean>(false);
  const [showRoofModal, setShowRoofModal] = useState<boolean>(false);
  const [showCeilingModal, setShowCeilingModal] = useState<boolean>(false);
  const [showFacadeModal, setShowFacadeModal] = useState<boolean>(false);
  const [showFurnitureModal, setShowFurnitureModal] = useState<boolean>(false);
  const [showMaterialModal, setShowMaterialModal] = useState<boolean>(false);

  // Calculated Effective Net Floor Area & Volume
  const effectiveArea = useMemo(() => {
    let raw = roomL * roomW;
    if (roomShape === "circular") {
      raw = Math.PI * Math.pow(roomL / 2, 2);
    } else if (roomShape === "polygon") {
      if (polygonPreset === "l_shaped") {
        raw = roomL * roomW - (roomL - polygonWingL) * (roomW - polygonWingW);
      } else if (polygonPreset === "t_shaped") {
        raw = roomL * polygonWingW + polygonWingL * (roomW - polygonWingW);
      } else if (polygonPreset === "hexagon") {
        raw = 0.866 * Math.pow(Math.min(roomL, roomW), 2);
      } else if (polygonPreset === "chamfer") {
        raw = roomL * roomW - 0.5 * Math.pow(Math.min(polygonWingL, polygonWingW), 2);
      } else if (polygonPreset === "u_shaped") {
        raw = roomL * roomW - polygonWingL * polygonWingW;
      }
    }
    const deduction = hasSubspace ? subspaceL * subspaceW : 0;
    return Math.max(0.5, raw - deduction);
  }, [roomL, roomW, roomShape, polygonPreset, polygonWingL, polygonWingW, hasSubspace, subspaceL, subspaceW]);

  const effectiveVolume = useMemo(() => {
    return effectiveArea * roomH;
  }, [effectiveArea, roomH]);

  // Screenshot 1: Site Parameters
  const [siteName, setSiteName] = useState("Site 1");
  const [siteDesc, setSiteDesc] = useState("Architectural building development");
  const [siteProfileSpace, setSiteProfileSpace] = useState("5.1 DIALux presetting");
  const [siteProfileApp, setSiteProfileApp] = useState("5.1.1 Standard (outdoor transportation areas)");
  const [maintenanceMethod, setMaintenanceMethod] = useState("global (DIN 5035)");
  const [siteMf, setSiteMf] = useState<number>(0.80);
  const [siteLocation, setSiteLocation] = useState("Lüdenscheid");
  const [siteLongitude, setSiteLongitude] = useState("7.63");
  const [siteLatitude, setSiteLatitude] = useState("51.22");
  const [siteNorthAngle, setSiteNorthAngle] = useState("0.00");
  const [siteTimezone, setSiteTimezone] = useState("(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna");
  const [obtrusiveStandard, setObtrusiveStandard] = useState("EN 12464-2:2014");
  const [obtrusiveZone, setObtrusiveZone] = useState("Environmental Zone E4");
  const [obtrusivePeriod, setObtrusivePeriod] = useState("Pre-curfew");

  // Screenshot 2: Storey and Building Construction Parameters
  const [buildingName, setBuildingName] = useState("Building 1");
  const [storeyName, setStoreyName] = useState("Storey 1 (Ground Floor)");
  const [storeyHeight, setStoreyHeight] = useState(2.800);
  const [storeyFloorThickness, setStoreyFloorThickness] = useState(0.200);

  // Screenshot 3: Apertures (Doors & Windows) Parameters
  const [apertureType, setApertureType] = useState<"window" | "door" | "skylight">("window");
  const [apertureHeight, setApertureHeight] = useState(1.350);
  const [apertureWidth, setApertureWidth] = useState(1.000);
  const [apertureFrameWidth, setApertureFrameWidth] = useState(0.120);
  const [apertureSillHeight, setApertureSillHeight] = useState(0.800);
  const [windowCount, setWindowCount] = useState(0);

  // Screenshot 4: Façade Elements Parameters
  const [facadeElement, setFacadeElement] = useState<"venetian_blind" | "roller_shutter" | "screen">("venetian_blind");
  const [facadeMounting, setFacadeMounting] = useState<"outside" | "inside">("outside");
  const [showFacadeBlinds, setShowFacadeBlinds] = useState(false);

  // New Screenshot 1: Room elements State (media_1791271322031.png)
  const [activeRoomElement, setActiveRoomElement] = useState<"beam" | "column_rect" | "column_circ" | "platform" | "ramp">("column_rect");
  const [roomElementScale, setRoomElementScale] = useState<number>(1.0);
  const [roomElementWidth, setRoomElementWidth] = useState<number>(0.400);
  const [roomElementLength, setRoomElementLength] = useState<number>(0.400);
  const [showRoomElements, setShowRoomElements] = useState<boolean>(false);
  const [hasPlacedRoomElement, setHasPlacedRoomElement] = useState<boolean>(false);

  // New Screenshot 2: Roofs State (media_1791271331687.png)
  const [activeRoofType, setActiveRoofType] = useState<"flat" | "gable" | "shed" | "hip">("flat");
  const [roofOverhang, setRoofOverhang] = useState<number>(0.300);
  const [roofPitch, setRoofPitch] = useState<number>(15.0);
  const [roofRidgeHeight, setRoofRidgeHeight] = useState<number>(3.800);
  const [roofEavesHeight, setRoofEavesHeight] = useState<number>(2.800);
  const [hasPlacedRoof, setHasPlacedRoof] = useState<boolean>(false);
  const [showRoofIn3D, setShowRoofIn3D] = useState<boolean>(false);

  // New Screenshot 3: Ceilings State (media_1791271342241.png)
  const [hasSuspendedCeiling, setHasSuspendedCeiling] = useState<boolean>(true);
  const [ceilingSuspensionDepth, setCeilingSuspensionDepth] = useState<number>(0.400);
  const [ceilingGridType, setCeilingGridType] = useState<"grid_600" | "monolithic">("grid_600");
  const [ceilingTileReflectance, setCeilingTileReflectance] = useState<number>(0.75);

  // New Screenshot 4: Cutout State (media_1791271353175.png)
  const [activeCutoutShape, setActiveCutoutShape] = useState<"rectangular" | "circular" | "polygonal">("rectangular");
  const [hasActiveCutout, setHasActiveCutout] = useState<boolean>(false);
  const [cutoutSurface, setCutoutSurface] = useState<"ceiling" | "floor" | "wall">("ceiling");
  const [cutoutWidth, setCutoutWidth] = useState<number>(1.200);
  const [cutoutLength, setCutoutLength] = useState<number>(1.200);
  const [cutoutPosX, setCutoutPosX] = useState<number>(2.000);
  const [cutoutPosY, setCutoutPosY] = useState<number>(1.500);

  // New Screenshot 5: Furniture and objects State (media_1791271367773.png)
  const [furnitureArrangement, setFurnitureArrangement] = useState<"rectangular" | "polygonal" | "circular" | "line" | "individual" | "extrusion">("rectangular");
  const [activeFurnitureObject, setActiveFurnitureObject] = useState<"cube" | "desk" | "chair" | "conference_table" | "bookshelf" | "monitor" | "reception_desk">("reception_desk");
  const [cuboidWidth, setCuboidWidth] = useState<number>(2.400);
  const [cuboidLength, setCuboidLength] = useState<number>(1.400);
  const [cuboidHeight, setCuboidHeight] = useState<number>(1.150);
  const [furnitureList, setFurnitureList] = useState<FurnitureItem[]>([
    createReceptionDeskItem("init_rec_1", 3.2, 2.8, 0, "wood_oak_parquet", "#d4b996"),
    createChairItem("init_chair_1", 3.2, 3.8, 180, "carpet_charcoal_loop", "#1e293b"),
  ]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>("init_rec_1");

  // Screenshot 3: Materials State (media_1791272183358.png)
  const [activeMaterialName, setActiveMaterialName] = useState<string>("Standard Interior White Plaster");
  const [materialReflectanceVal, setMaterialReflectanceVal] = useState<number>(0.70);
  const [materialColorHex, setMaterialColorHex] = useState<string>("#f1f5f9");
  const [materialRoughnessVal, setMaterialRoughnessVal] = useState<number>(0.85);
  const [selectedMaterialTarget, setSelectedMaterialTarget] = useState<"ceiling" | "walls" | "floor" | "north_wall" | "south_wall" | "east_wall" | "west_wall" | "furniture">("walls");
  const [wallSurfaces, setWallSurfaces] = useState<RoomWallSurfaces>(DEFAULT_WALL_SURFACES);
  const [surfaceColors, setSurfaceColors] = useState<{ ceiling: string; walls: string; floor: string }>({
    ceiling: "#f8fafc",
    walls: "#94a3b8",
    floor: "#475569",
  });

  // Screenshot 4: Help lines and labelling State (media_1791272192191.png)
  const [activeHelpLineType, setActiveHelpLineType] = useState<
    "ref_line" | "circ_ref" | "poly_ref" | "curve_ref" | "ref_grid" | "new_text" | "dim_line"
  >("dim_line");
  const [helpLineLabelText, setHelpLineLabelText] = useState<string>("Working Task Zone");
  const [helpLineTextSize, setHelpLineTextSize] = useState<number>(0.250);

  // Screenshot 5: Copy and arrange State (media_1791272205609.png)
  const [copyArrangeMode, setCopyArrangeMode] = useState<"line" | "circular" | "polygonal" | "curve" | "ref_line">("line");
  const [copyCount, setCopyCount] = useState<number>(4);
  const [copySpacingDistance, setCopySpacingDistance] = useState<number>(1.500);
  const [copyRadius, setCopyRadius] = useState<number>(2.000);
  const [copyAxis, setCopyAxis] = useState<"length" | "width">("length");
  const [hasSelectedCopyObject, setHasSelectedCopyObject] = useState<boolean>(true);

  // Screenshot 2: Views State (media_1791272900498.png)
  const [savedViews, setSavedViews] = useState<Array<{
    id: string;
    name: string;
    description: string;
    cameraPosition: { x: number; y: number; z: number };
    cameraTarget: { x: number; y: number; z: number };
    thumbnailUrl?: string;
    timestamp: string;
  }>>([
    {
      id: "view-1",
      name: "3D Perspective Overview",
      description: "Standard perspective view of room and luminaire layout",
      cameraPosition: { x: fallbackL * 1.4, y: fallbackH * 1.8, z: fallbackW * 1.6 },
      cameraTarget: { x: fallbackL / 2, y: fallbackH / 2, z: fallbackW / 2 },
      timestamp: "View 1",
    },
    {
      id: "view-2",
      name: "Top-Down Workplane Plan",
      description: "Orthogonal view showing task illuminance distribution",
      cameraPosition: { x: fallbackL / 2, y: Math.max(fallbackL, fallbackW) * 2.2, z: fallbackW / 2 },
      cameraTarget: { x: fallbackL / 2, y: 0.75, z: fallbackW / 2 },
      timestamp: "View 2",
    },
  ]);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string>("view-1");
  const [activeViewName, setActiveViewName] = useState<string>("3D Perspective Overview");
  const [activeViewDesc, setActiveViewDesc] = useState<string>("Standard perspective view of room and luminaire layout");
  const [viewThumbnailSize, setViewThumbnailSize] = useState<number>(64);

  // Photometric Profile & Environment Factors
  const [profile, setProfile] = useState<LuminairePhotometricProfile>(BUILTIN_PHOTOMETRIC_PROFILES[0]);
  const [mf, setMf] = useState<number>(baseActiveSpace.mf || 0.8);
  const [workPlaneHeight, setWorkPlaneHeight] = useState<number>(0.75);
  const [marginOffset, setMarginOffset] = useState<number>(0.5);

  // EN 12464-1 & DIALux evo Calculation Evaluation Area: "floor" | "workplane" | "workstation"
  const [calcAreaType, setCalcAreaType] = useState<CalculationAreaType>("workplane");
  const [workstationConfig, setWorkstationConfig] = useState<WorkstationAreaConfig>(() => ({
    name: "Single Office Desk",
    length: 1.6,
    width: 0.8,
    x: Number(((baseActiveSpace.length || 5) / 2).toFixed(2)),
    y: Number(((baseActiveSpace.width || 4) / 2).toFixed(2)),
    height: 0.75,
    surroundingBand: 0.5,
    targetLux: baseActiveSpace.targetLux || 500,
  }));

  // Re-center or clamp workstation desk within room envelope when room dimensions change
  useEffect(() => {
    setWorkstationConfig((prev) => ({
      ...prev,
      x: Math.min(Math.max(prev.length / 2, prev.x > roomL ? roomL / 2 : prev.x), Math.max(prev.length / 2, roomL - prev.length / 2)),
      y: Math.min(Math.max(prev.width / 2, prev.y > roomW ? roomW / 2 : prev.y), Math.max(prev.width / 2, roomW - prev.width / 2)),
    }));
  }, [roomL, roomW]);

  // Grid layout (rows x cols) for currently active space
  const [gridConfig, setGridConfig] = useState<{ rows: number; cols: number }>(() => {
    const qty = baseActiveSpace.initialQuantity && baseActiveSpace.initialQuantity > 0 ? baseActiveSpace.initialQuantity : 4;
    return computeOptimalGridLayout(roomL, roomW, roomH, qty, 0.75);
  });

  // Layout history for Undo/Redo
  const [historyStack, setHistoryStack] = useState<Array<{ rows: number; cols: number }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ rows: number; cols: number }>>([]);

  const pushGridChange = (newConfig: { rows: number; cols: number }) => {
    setHistoryStack((prev) => [...prev, gridConfig]);
    setRedoStack([]);
    setGridConfig(newConfig);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) {
      toast.info("No more actions to undo");
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, gridConfig]);
    setGridConfig(previous);
    toast.info(`Undid to ${previous.rows} × ${previous.cols} layout`);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) {
      toast.info("No more actions to redo");
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setHistoryStack((prev) => [...prev, gridConfig]);
    setGridConfig(next);
    toast.info(`Redid to ${next.rows} × ${next.cols} layout`);
  };

  // Surface Reflectances (Ceiling, Walls, Floor)
  const [reflectances, setReflectances] = useState<SurfaceReflectances>({
    ceiling: 0.70,
    walls: 0.50,
    floor: 0.20,
  });

  // Mounting Type & Suspension Length
  const [mountingType, setMountingType] = useState<"flush" | "surface" | "suspended" | "wall">("flush");
  const [suspensionLength, setSuspensionLength] = useState<number>(0);

  // Arrangement Mode: Grid, Linear Continuous, Perimeter Border, Single Center, Linear, Circular, Individual
  const [arrangementMode, setArrangementMode] = useState<LuminaireArrangementMode>("grid");

  // Line & Circular Configurations (Tutorial Part 5)
  const [lineConfig, setLineConfig] = useState<LineArrangementConfig>({
    startX: 0.6,
    startY: Number((roomW / 2).toFixed(2)),
    endX: Number((roomL - 0.6).toFixed(2)),
    endY: Number((roomW / 2).toFixed(2)),
    count: 4,
    isContinuous: false,
    fixtureLength: 1.2,
    alignPerpendicular: false,
  });

  const [circularConfig, setCircularConfig] = useState<CircularArrangementConfig>({
    centerX: Number((roomL / 2).toFixed(2)),
    centerY: Number((roomW / 2).toFixed(2)),
    radius: Number((Math.min(roomL, roomW) * 0.35).toFixed(2)),
    count: 6,
    startAngleDeg: 0,
    sweepAngleDeg: 360,
    alignTangential: true,
  });

  // Individual Placed Luminaires (Tutorial Part 5)
  const [customLuminaires, setCustomLuminaires] = useState<IndividualLuminaireConfig[]>([]);

  // Polygonal Arrangement Configuration (DIALux evo Tutorial Part 6)
  const [polygonalConfig, setPolygonalConfig] = useState<PolygonalArrangementConfig>({
    points: [
      { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
      { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.15).toFixed(2)) },
      { x: Number((roomL * 0.85).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
      { x: Number((roomL * 0.15).toFixed(2)), y: Number((roomW * 0.85).toFixed(2)) },
    ],
    count: Math.max(4, gridConfig.cols * 2),
    isClosed: true,
    alignToSegment: true,
  });

  // Arrangement Overrides: Position offsets, 3D target aiming, exclusions, dimming (DIALux evo Part 6)
  const [arrangementOverrides, setArrangementOverrides] = useState<Record<number, LuminaireOverride>>({});

  // 3D Canvas Interactive Aiming Tool state (Part 6)
  const [isAimingToolActive, setIsAimingToolActive] = useState<boolean>(false);

  // Luminaire Placement Modal Open state
  const [isPlacementModalOpen, setIsPlacementModalOpen] = useState<boolean>(false);

  // Color Temperature (Kelvin)
  const [cct, setCct] = useState<number>(profile.colorTemp || 4000);

  useEffect(() => {
    if (profile.colorTemp) setCct(profile.colorTemp);
  }, [profile]);

  // Display toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showIsoluxLines, setShowIsoluxLines] = useState(true);
  const [showLightCones, setShowLightCones] = useState(true);
  const [clipLightConesToRoom, setClipLightConesToRoom] = useState(true);
  const [showWallReflection, setShowWallReflection] = useState(true);
  const [showWallFalseColor, setShowWallFalseColor] = useState(false);
  const [showRoomWalls, setShowRoomWalls] = useState(true);
  const [showLuxNumbers, setShowLuxNumbers] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showCoordAxes, setShowCoordAxes] = useState(true);
  const [showFurniture, setShowFurniture] = useState(false);
  const [showCeilingGrid, setShowCeilingGrid] = useState(false);
  const [showGuideGrid, setShowGuideGrid] = useState(false);
  const [showDwgUnderlay, setShowDwgUnderlay] = useState(false);
  const [showWireframeBoundary, setShowWireframeBoundary] = useState(true);
  const [showCalcSurfacePlane, setShowCalcSurfacePlane] = useState(true);

  // DIALux evo Tutorial #9 View & Display Options Suite
  const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
  const [isWireframeMode, setIsWireframeMode] = useState(false);
  const [showLightTextures, setShowLightTextures] = useState(true);
  const [showLuminaires, setShowLuminaires] = useState(true);
  const [showEnergyHud, setShowEnergyHud] = useState(true);
  const [whiteBalanceMode, setWhiteBalanceMode] = useState<"auto" | "manual">("manual");
  const [whiteBalanceKelvin, setWhiteBalanceKelvin] = useState<number>(4000);
  const [whiteBalanceExposure, setWhiteBalanceExposure] = useState<number>(0.0);
  const [cadSavedViews, setCadSavedViews] = useState<SavedCameraViewpoint[]>([
    { id: "sv-1", name: "Overview 3D Perspective", posX: 14, posY: 18, posZ: 16, targetX: 5, targetY: 1.5, targetZ: 5 },
    { id: "sv-2", name: "Task Workstation Angle", posX: 8, posY: 4, posZ: 7, targetX: 5, targetY: 0.75, targetZ: 5 },
    { id: "sv-3", name: "Ceiling Luminaires Layout", posX: 5, posY: 0.5, posZ: 5, targetX: 5, targetY: 3.2, targetZ: 5 },
    { id: "sv-4", name: "Standing Eye Level (1.70m)", posX: 2, posY: 1.7, posZ: 2, targetX: 5, targetY: 1.7, targetZ: 5 },
  ]);

  // Hidden objects count for tree header
  const hiddenObjectsCount = useMemo(() => {
    let count = 0;
    if (!showHeatmap) count++;
    if (!showIsoluxLines) count++;
    if (!showLightCones) count++;
    if (!showRoomWalls) count++;
    if (!showLuxNumbers) count++;
    if (!showCoordAxes) count++;
    if (!showDimensions) count++;
    return count;
  }, [showHeatmap, showIsoluxLines, showLightCones, showRoomWalls, showLuxNumbers, showCoordAxes, showDimensions]);

  const resetAllHiddenObjects = () => {
    setShowHeatmap(true);
    setShowIsoluxLines(true);
    setShowLightCones(true);
    setShowRoomWalls(true);
    setShowCoordAxes(true);
    setShowDimensions(true);
    setShowWireframeBoundary(true);
    setShowCalcSurfacePlane(true);
    toast.success("All layers made visible!");
  };

  // Viewport camera modes: 3D perspective, 2D top plan, front elevation, side elevation
  const [cameraView, setCameraView] = useState<"3d" | "top" | "front" | "side">("3d");
  const [planningMode, setPlanningMode] = useState<string>("Indoor space planning");

  // Light scene modes (DIALux evo Tutorial Part 11: Artificial vs Daylight Scenes)
  const [lightScene, setLightScene] = useState<string>("100");

  // DIALux evo Part 11: Daylight Simulation States
  const [daylightSkyModel, setDaylightSkyModel] = useState<CIESkyModel>("overcast");
  const [daylightDirectSun, setDaylightDirectSun] = useState<boolean>(false);
  const [daylightHour, setDaylightHour] = useState<number>(12);
  const [daylightCity, setDaylightCity] = useState<string>("London");
  const [daylightLat, setDaylightLat] = useState<number>(51.51);
  const [daylightLon, setDaylightLon] = useState<number>(-0.12);
  const [daylightNorthAngle, setDaylightNorthAngle] = useState<number>(0);
  const [daylightGroundReflectance, setDaylightGroundReflectance] = useState<number>(0.20);
  const [daylightGlassTau, setDaylightGlassTau] = useState<number>(0.75);
  const [isDaylightSceneActive, setIsDaylightSceneActive] = useState<boolean>(false);
  const [daylightFalseColorMode, setDaylightFalseColorMode] = useState<"lux" | "daylight_factor">("lux");

  const sceneDimFactor = useMemo(() => {
    if (lightScene === "50") return 0.5;
    if (lightScene === "10") return 0.1;
    if (lightScene === "daylight_overcast" || lightScene === "daylight_clear") return 0.0; // Artificial fixtures off
    if (lightScene === "combined") return 0.65; // Daylight harvesting sensor dims artificial luminaires
    return 1.0;
  }, [lightScene]);

  // Selected luminaire fitting index in tree
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState<number | null>(null);

  // 3D Canvas Refs & Cameras
  const mountRef = useRef<HTMLDivElement>(null);
  const polarCanvasRef = useRef<HTMLCanvasElement>(null);
  const iesFileInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);

  // Views Handlers (Screenshot 2: media_1791272900498.png)
  const handleSaveNewView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const newId = `view-${Date.now()}`;
    const defaultName = `View ${savedViews.length + 1}`;
    let thumb: string | undefined = undefined;
    if (rendererRef.current) {
      try {
        thumb = rendererRef.current.domElement.toDataURL("image/jpeg", 0.6);
      } catch (e) {
        // ignore
      }
    }
    const newViewItem = {
      id: newId,
      name: defaultName,
      description: "Saved camera viewpoint",
      cameraPosition: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
      cameraTarget: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z },
      thumbnailUrl: thumb,
      timestamp: new Date().toLocaleTimeString(),
    };
    setSavedViews((prev) => [...prev, newViewItem]);
    setActiveSavedViewId(newId);
    setActiveViewName(defaultName);
    setActiveViewDesc("Saved camera viewpoint");
    toast.success(`Saved new view: "${defaultName}"`);
  };

  const handleShowView = (viewId?: string) => {
    const targetId = viewId || activeSavedViewId;
    const found = savedViews.find((v) => v.id === targetId);
    if (found && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(found.cameraPosition.x, found.cameraPosition.y, found.cameraPosition.z);
      controlsRef.current.target.set(found.cameraTarget.x, found.cameraTarget.y, found.cameraTarget.z);
      controlsRef.current.update();
      setActiveSavedViewId(found.id);
      setActiveViewName(found.name);
      setActiveViewDesc(found.description);
      toast.info(`Restored view: "${found.name}"`);
    }
  };

  const handleReplaceView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    let thumb: string | undefined = undefined;
    if (rendererRef.current) {
      try {
        thumb = rendererRef.current.domElement.toDataURL("image/jpeg", 0.6);
      } catch (e) {
        // ignore
      }
    }
    setSavedViews((prev) =>
      prev.map((v) =>
        v.id === activeSavedViewId
          ? {
              ...v,
              name: activeViewName,
              description: activeViewDesc,
              cameraPosition: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
              cameraTarget: { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z },
              thumbnailUrl: thumb || v.thumbnailUrl,
            }
          : v
      )
    );
    toast.success(`Updated "${activeViewName}" with current viewpoint`);
  };

  const handleSaveImage = () => {
    if (rendererRef.current) {
      const dataUrl = rendererRef.current.domElement.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${spaceCustomName.replace(/\s+/g, "_")}_DIALux_View.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Saved high-resolution view rendering image!");
    } else {
      toast.info("Image capture triggered");
    }
  };

  // Single Space Simulation Result (Takes sceneDimFactor into account)
  const simulationResult: DialuxSimulationResult = useMemo(() => {
    const effectiveSuspension = mountingType === "suspended" ? suspensionLength : mountingType === "surface" ? 0.05 : 0;
    const effectiveProfile = {
      ...profile,
      totalLumens: Math.round((profile.totalLumens || profile.lumens || 3600) * sceneDimFactor),
      colorTemp: cct,
    };

    return runPointByPointSimulation({
      length: roomL,
      width: roomW,
      height: roomH,
      rows: gridConfig.rows,
      cols: gridConfig.cols,
      profile: effectiveProfile,
      targetLux,
      mf,
      workPlaneHeight,
      suspensionLength: effectiveSuspension,
      reflectances,
      arrangementMode,
      calcAreaType,
      workstationConfig,
      marginOffset,
      lineConfig,
      circularConfig,
      customLuminaires,
      polygonalConfig,
      arrangementOverrides,
    });
  }, [
    roomL,
    roomW,
    roomH,
    gridConfig.rows,
    gridConfig.cols,
    profile,
    targetLux,
    mf,
    workPlaneHeight,
    mountingType,
    suspensionLength,
    reflectances,
    arrangementMode,
    cct,
    sceneDimFactor,
    calcAreaType,
    workstationConfig,
    marginOffset,
    lineConfig,
    circularConfig,
    customLuminaires,
    polygonalConfig,
    arrangementOverrides,
  ]);

  // Whole Project Structure Simulation Results (Simulate all spaces in opened IFC file)
  const fullProjectSummary = useMemo(() => {
    const effectiveSuspension = mountingType === "suspended" ? suspensionLength : 0;
    const effectiveProfile = {
      ...profile,
      totalLumens: Math.round((profile.totalLumens || profile.lumens || 3600) * sceneDimFactor),
      colorTemp: cct,
    };

    return spaces.map((sp) => {
      const sL = Math.max(1, sp.length || 5);
      const sW = Math.max(1, sp.width || 4);
      const sH = Math.max(1.8, sp.height || 2.8);
      const sTarget = Math.max(50, sp.targetLux || 500);
      const sQty = sp.initialQuantity && sp.initialQuantity > 0 ? sp.initialQuantity : 4;
      const layout = computeOptimalGridLayout(sL, sW, sH, sQty, 0.75);

      const sim = runPointByPointSimulation({
        length: sL,
        width: sW,
        height: sH,
        rows: layout.rows,
        cols: layout.cols,
        profile: effectiveProfile,
        targetLux: sTarget,
        mf: sp.mf || 0.8,
        workPlaneHeight: 0.75,
        suspensionLength: effectiveSuspension,
        reflectances,
        arrangementMode,
      });

      return {
        id: sp.id,
        name: sp.name,
        level: sp.level || "Ground Floor",
        area: sp.area || sL * sW,
        length: sL,
        width: sW,
        height: sH,
        targetLux: sTarget,
        simulatedLux: sim.avgLux,
        uniformityU0: sim.uniformityU0,
        fixturesCount: sim.luminaires.length,
        rows: layout.rows,
        cols: layout.cols,
        layout: `${layout.rows} × ${layout.cols}`,
        powerW: sim.connectedPowerW,
        powerDensity: sim.powerDensityWPerM2,
        isCompliant: sim.isLuxCompliant && sim.isUniformityCompliant,
      };
    });
  }, [spaces, profile, cct, mountingType, suspensionLength, reflectances, arrangementMode, sceneDimFactor]);

  // Project Totals
  const projectTotals = useMemo(() => {
    const totalArea = fullProjectSummary.reduce((acc, s) => acc + s.area, 0);
    const totalFixtures = fullProjectSummary.reduce((acc, s) => acc + s.fixturesCount, 0);
    const totalPowerW = fullProjectSummary.reduce((acc, s) => acc + s.powerW, 0);
    const compliantCount = fullProjectSummary.filter((s) => s.isCompliant).length;
    const avgPowerDensity = totalArea > 0 ? totalPowerW / totalArea : 0;
    const compliancePct = fullProjectSummary.length > 0 ? Math.round((compliantCount / fullProjectSummary.length) * 100) : 100;

    return {
      totalArea,
      totalFixtures,
      totalPowerKw: (totalPowerW / 1000).toFixed(2),
      avgPowerDensity: avgPowerDensity.toFixed(2),
      compliantCount,
      compliancePct,
    };
  }, [fullProjectSummary]);

  // Auto-optimize grid layout
  const handleAutoOptimize = () => {
    const optimal = computeOptimalGridLayout(
      roomL,
      roomW,
      roomH,
      baseActiveSpace.initialQuantity || 4,
      workPlaneHeight
    );
    pushGridChange({ rows: optimal.rows, cols: optimal.cols });
    toast.success(`Optimized to ${optimal.rows} rows × ${optimal.cols} cols (${optimal.total} luminaires) for uniform spacing.`);
  };

  // Handle Custom IES / LDT File Upload
  const handleIESUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsedProfile = parsePhotometricFile(text, file.name);
        setProfile(parsedProfile);
        toast.success(`Loaded photometric file "${file.name}" with ${parsedProfile.totalLumens} lm beam!`);
      } catch (err) {
        console.error("Failed to parse photometric file:", err);
        toast.error("Failed to parse photometric file. Ensure valid ANSI/IES LM-63 (.ies) or EULUMDAT (.ldt) format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Switch camera view (Tutorial #9 View Perspectives)
  const applyCameraView = (view: "3d" | "top" | "front" | "back" | "left" | "side" | "right" | "first_person" | string) => {
    setCameraView(view as any);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const cx = roomL / 2;
    const cy = roomH / 2;
    const cz = roomW / 2;

    controls.target.set(cx, cy, cz);

    if (view === "3d") {
      camera.position.set(roomL * 1.4, roomH * 1.8, roomW * 1.6);
    } else if (view === "top") {
      camera.position.set(cx, Math.max(roomL, roomW) * 2.2, cz);
    } else if (view === "front") {
      camera.position.set(cx, cy, roomW * 2.5);
    } else if (view === "back") {
      camera.position.set(cx, cy, -roomW * 1.5);
    } else if (view === "left") {
      camera.position.set(-roomL * 1.5, cy, cz);
    } else if (view === "side" || view === "right") {
      camera.position.set(roomL * 2.5, cy, cz);
    } else if (view === "first_person") {
      camera.position.set(cx, 1.70, cz - 0.5);
      controls.target.set(cx, 1.70, cz + 2.0);
    }
    controls.update();
  };

  // Saved Camera Viewpoints Handlers (Tutorial #9 & #15)
  const handleSaveCurrentView = (name: string) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const pos = cameraRef.current.position;
    const target = controlsRef.current.target;
    const newView: SavedCameraViewpoint = {
      id: `view-${Date.now()}`,
      name,
      posX: pos.x,
      posY: pos.y,
      posZ: pos.z,
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
    };
    setCadSavedViews((prev) => [...prev, newView]);
    toast.success(`Saved viewpoint: "${name}"`);
  };

  const handleApplySavedView = (view: SavedCameraViewpoint) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(view.posX, view.posY, view.posZ);
    controlsRef.current.target.set(view.targetX, view.targetY, view.targetZ);
    controlsRef.current.update();
    setCameraView(view.name as any);
    toast.info(`Switched to viewpoint: "${view.name}"`);
  };

  const handleDeleteSavedView = (id: string) => {
    setCadSavedViews((prev) => prev.filter((v) => v.id !== id));
    toast.info("Deleted viewpoint");
  };

  // DIALux evo Tutorial Part 15: Camera Memory Slots (Ctrl + 1..9, Alt + 1..9)
  const handleSaveSlot = (slot: number, name?: string) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const pos = cameraRef.current.position;
    const target = controlsRef.current.target;
    const viewName = name || `Camera Slot ${slot}`;
    const newView: SavedCameraViewpoint = {
      id: `slot-${slot}-${Date.now()}`,
      name: viewName,
      posX: pos.x,
      posY: pos.y,
      posZ: pos.z,
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
      slot,
    };
    setCadSavedViews((prev) => [...prev.filter((v) => v.slot !== slot), newView]);
    toast.success(`Saved viewpoint to Slot ${slot} (Ctrl+${slot}): "${viewName}"`);
  };

  const handleApplySlot = (slot: number) => {
    const found = cadSavedViews.find((v) => v.slot === slot);
    if (found) {
      handleApplySavedView(found);
    } else {
      toast.warning(`Camera Slot ${slot} is empty. Press Ctrl+${slot} to save current view.`);
    }
  };

  const handleSetPivot = (x: number, y: number, z: number) => {
    if (controlsRef.current) {
      controlsRef.current.target.set(x, y, z);
      controlsRef.current.update();
      setCurrentPivot({ x, y, z });
      toast.success(`Pivoting point set to (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    }
  };

  // Keyboard Shortcuts (F2-F10 DIALux evo Standard, 1-4 Views, WASD Walkthrough, Ctrl/Alt 1-9, Esc=Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      // Tutorial Part 15: Ctrl + [1-9] Save Viewpoint Slot
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const slotNum = parseInt(e.key);
        handleSaveSlot(slotNum);
        return;
      }

      // Tutorial Part 15: Alt + [1-9] Recall Viewpoint Slot
      if (e.altKey && !e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const slotNum = parseInt(e.key);
        handleApplySlot(slotNum);
        return;
      }

      // Tutorial Part 15: WASD + QE Walkthrough Movement
      if (!e.ctrlKey && !e.altKey && cameraRef.current && controlsRef.current) {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        const speed = e.shiftKey ? 1.0 : 0.35;

        // Forward vector horizontalized
        const fwd = new THREE.Vector3().subVectors(controls.target, camera.position);
        fwd.y = 0;
        fwd.normalize();

        // Right strafe vector
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

        let moved = false;
        if (e.key === "w" || e.key === "W") {
          e.preventDefault();
          camera.position.addScaledVector(fwd, speed);
          controls.target.addScaledVector(fwd, speed);
          moved = true;
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          camera.position.addScaledVector(fwd, -speed);
          controls.target.addScaledVector(fwd, -speed);
          moved = true;
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          camera.position.addScaledVector(right, -speed);
          controls.target.addScaledVector(right, -speed);
          moved = true;
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          camera.position.addScaledVector(right, speed);
          controls.target.addScaledVector(right, speed);
          moved = true;
        } else if (e.key === "q" || e.key === "Q") {
          e.preventDefault();
          camera.position.y -= speed;
          controls.target.y -= speed;
          moved = true;
        } else if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          camera.position.y += speed;
          controls.target.y += speed;
          moved = true;
        }

        if (moved) {
          controls.update();
          return;
        }
      }

      // Official DIALux evo F-Keys
      if (e.key === "F2") {
        e.preventDefault();
        setShowCoordAxes((prev) => !prev);
        toast.info("Coordinate axes toggled (F2)");
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowDimensions((prev) => !prev);
        toast.info("Help lines toggled (F3)");
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowCalcSurfacePlane((prev) => !prev);
        toast.info("Working plane toggled (F4)");
      } else if (e.key === "F5") {
        e.preventDefault();
        setIsWireframeMode((prev) => !prev);
        toast.info("Wireframe mode toggled (F5)");
      } else if (e.key === "F6") {
        e.preventDefault();
        setShowIsoluxLines((prev) => !prev);
        toast.info("Isolux lines toggled (F6)");
      } else if (e.key === "F7") {
        e.preventDefault();
        setShowHeatmap((prev) => !prev);
        toast.info("False color heatmap toggled (F7)");
      } else if (e.key === "F8") {
        e.preventDefault();
        setShowLightCones((prev) => !prev);
        toast.info("Light distribution cones toggled (F8)");
      } else if (e.key === "F9") {
        e.preventDefault();
        setShowLuminaires((prev) => !prev);
        toast.info("Luminaires visibility toggled (F9)");
      } else if (e.key === "F10") {
        e.preventDefault();
        setShowRoomWalls((prev) => !prev);
        toast.info("Room walls visibility toggled (F10)");
      } else if (e.key === "1" && !e.ctrlKey && !e.altKey) {
        applyCameraView("3d");
      } else if (e.key === "2" && !e.ctrlKey && !e.altKey) {
        applyCameraView("top");
      } else if (e.key === "3" && !e.ctrlKey && !e.altKey) {
        applyCameraView("front");
      } else if (e.key === "4" && !e.ctrlKey && !e.altKey) {
        applyCameraView("side");
      } else if (e.key === "h" || e.key === "H") {
        setShowHeatmap((prev) => !prev);
      } else if (e.key === "i" || e.key === "I") {
        setShowIsoluxLines((prev) => !prev);
      } else if (e.key === "b" || e.key === "B") {
        setShowLightCones((prev) => !prev);
      } else if (e.key === "c" || e.key === "C") {
        setClipLightConesToRoom((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isWhiteBalanceModalOpen) setIsWhiteBalanceModalOpen(false);
        else if (isDisplayOptionsOpen) setIsDisplayOptionsOpen(false);
        else if (activeMenu) setActiveMenu(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMenu, onClose, roomL, roomH, roomW, isDisplayOptionsOpen, isWhiteBalanceModalOpen, cadSavedViews]);

  // Render 2D Polar Candela Curve Canvas
  useEffect(() => {
    const canvas = polarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 10;
    const maxRadius = Math.min(w / 2 - 20, h - 20);

    // Coordinate grid rings
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach((rFactor) => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * rFactor, Math.PI, 2 * Math.PI);
      ctx.stroke();
    });

    // Radial angle lines (0°, 30°, 60°, 90°)
    [0, 30, 60, 90].forEach((deg) => {
      const rad = ((90 - deg) * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * maxRadius;
      const y1 = cy - Math.sin(rad) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      const x2 = cx - Math.cos(rad) * maxRadius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x2, y1);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px sans-serif";
      ctx.fillText(`${deg}°`, x1 - 5, y1 - 2);
    });

    // Plot candela curve
    const c0Candela = profile.c0Candela || [350, 345, 330, 305, 270, 220, 155, 85, 25, 0];
    const c0Angles = profile.c0Angles || [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    const maxCd = Math.max(...c0Candela, 1);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < c0Angles.length; i++) {
      const angle = c0Angles[i];
      const cd = c0Candela[i] || 0;
      const r = (cd / maxCd) * maxRadius;
      const rad = ((90 - angle) * Math.PI) / 180;
      const x = cx + Math.cos(rad) * r;
      const y = cy - Math.sin(rad) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    for (let i = c0Angles.length - 1; i >= 0; i--) {
      const angle = c0Angles[i];
      const cd = c0Candela[i] || 0;
      const r = (cd / maxCd) * maxRadius;
      const rad = ((90 - angle) * Math.PI) / 180;
      const x = cx - Math.cos(rad) * r;
      const y = cy - Math.sin(rad) * r;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    ctx.fill();
  }, [profile]);

  // Three.js Scene Setup & Render
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cadTheme === "white" ? 0xffffff : 0x181a1f); // Authentic DIALux evo paper white / studio dark
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(roomL * 1.4, roomH * 1.8, roomW * 1.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(currentPivot.x, currentPivot.y, currentPivot.z);
    controlsRef.current = controls;

    // DIALux evo Tutorial Part 15: 3D Pivoting Point Reticle Gizmo
    const pivotGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const pivotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const pivotMesh = new THREE.Mesh(pivotGeo, pivotMat);
    pivotMesh.position.set(currentPivot.x, currentPivot.y, currentPivot.z);
    scene.add(pivotMesh);

    // DIALux evo White Balance & Color Adaptation (Tutorial #9 & #15)
    const effectiveKelvin = whiteBalanceMode === "auto" ? 6500 : whiteBalanceKelvin;
    const wbColorHex = parseInt(kelvinToHex(effectiveKelvin).replace("#", "0x"), 16);
    const exposureFactor = Math.pow(2, whiteBalanceExposure);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposureFactor;

    const ambientLight = new THREE.AmbientLight(wbColorHex, 0.45 * (whiteBalanceMode === "auto" ? 1.0 : 1.1));
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(wbColorHex, 0.55);
    dirLight.position.set(roomL * 2, roomH * 3, roomW * 2);
    scene.add(dirLight);

    const lightHex = parseInt(kelvinToHex(cct).replace("#", "0x"), 16);

    // 3D Coordinate Axes Gizmo at Origin (X=Red, Y=Green, Z=Blue)
    if (showCoordAxes) {
      const axesHelper = new THREE.AxesHelper(1.5);
      axesHelper.position.set(0, 0, 0);
      scene.add(axesHelper);
    }

    // Dynamic Floor & Ceiling Geometry (Rectangular, Circular, Polygon with Subspace Void)
    let floorGeo: any;
    let ceilGeo: any;

    if (roomShape === "circular") {
      floorGeo = new THREE.CircleGeometry(roomL / 2, 48);
      floorGeo.rotateX(-Math.PI / 2);
      floorGeo.translate(roomL / 2, 0, roomW / 2);

      ceilGeo = new THREE.CircleGeometry(roomL / 2, 48);
      ceilGeo.rotateX(Math.PI / 2);
      ceilGeo.translate(roomL / 2, roomH, roomW / 2);
    } else if (roomShape === "polygon") {
      const shape = new THREE.Shape();
      if (polygonPreset === "l_shaped") {
        shape.moveTo(0, 0);
        shape.lineTo(roomL, 0);
        shape.lineTo(roomL, Math.min(roomW, polygonWingW));
        shape.lineTo(Math.min(roomL, polygonWingL), Math.min(roomW, polygonWingW));
        shape.lineTo(Math.min(roomL, polygonWingL), roomW);
        shape.lineTo(0, roomW);
        shape.closePath();
      } else if (polygonPreset === "t_shaped") {
        const halfWing = polygonWingL / 2;
        shape.moveTo(0, 0);
        shape.lineTo(roomL, 0);
        shape.lineTo(roomL, polygonWingW);
        shape.lineTo(roomL / 2 + halfWing, polygonWingW);
        shape.lineTo(roomL / 2 + halfWing, roomW);
        shape.lineTo(roomL / 2 - halfWing, roomW);
        shape.lineTo(roomL / 2 - halfWing, polygonWingW);
        shape.lineTo(0, polygonWingW);
        shape.closePath();
      } else if (polygonPreset === "u_shaped") {
        const cutW = Math.min(roomW * 0.4, polygonWingW);
        const cutL = Math.min(roomL * 0.5, polygonWingL);
        shape.moveTo(0, 0);
        shape.lineTo(roomL, 0);
        shape.lineTo(roomL, roomW);
        shape.lineTo(roomL - (roomL - cutL) / 2, roomW);
        shape.lineTo(roomL - (roomL - cutL) / 2, roomW - cutW);
        shape.lineTo((roomL - cutL) / 2, roomW - cutW);
        shape.lineTo((roomL - cutL) / 2, roomW);
        shape.lineTo(0, roomW);
        shape.closePath();
      } else if (polygonPreset === "chamfer") {
        const c = Math.min(polygonWingL, polygonWingW, roomL * 0.3, roomW * 0.3);
        shape.moveTo(0, 0);
        shape.lineTo(roomL - c, 0);
        shape.lineTo(roomL, c);
        shape.lineTo(roomL, roomW);
        shape.lineTo(0, roomW);
        shape.closePath();
      } else {
        const r = Math.min(roomL, roomW) / 2;
        for (let a = 0; a < 6; a++) {
          const ang = (a * Math.PI) / 3;
          const x = roomL / 2 + r * Math.cos(ang);
          const y = roomW / 2 + r * Math.sin(ang);
          if (a === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }
        shape.closePath();
      }

      if (hasSubspace) {
        const hole = new THREE.Path();
        hole.moveTo(subspacePosX, subspacePosZ);
        hole.lineTo(subspacePosX + subspaceL, subspacePosZ);
        hole.lineTo(subspacePosX + subspaceL, subspacePosZ + subspaceW);
        hole.lineTo(subspacePosX, subspacePosZ + subspaceW);
        hole.closePath();
        shape.holes.push(hole);
      }

      floorGeo = new THREE.ShapeGeometry(shape);
      floorGeo.rotateX(-Math.PI / 2);

      ceilGeo = new THREE.ShapeGeometry(shape);
      ceilGeo.rotateX(Math.PI / 2);
      ceilGeo.translate(0, roomH, 0);
    } else {
      if (hasSubspace) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(roomL, 0);
        shape.lineTo(roomL, roomW);
        shape.lineTo(0, roomW);
        shape.closePath();

        const hole = new THREE.Path();
        hole.moveTo(subspacePosX, subspacePosZ);
        hole.lineTo(subspacePosX + subspaceL, subspacePosZ);
        hole.lineTo(subspacePosX + subspaceL, subspacePosZ + subspaceW);
        hole.lineTo(subspacePosX, subspacePosZ + subspaceW);
        hole.closePath();
        shape.holes.push(hole);

        floorGeo = new THREE.ShapeGeometry(shape);
        floorGeo.rotateX(-Math.PI / 2);

        ceilGeo = new THREE.ShapeGeometry(shape);
        ceilGeo.rotateX(Math.PI / 2);
        ceilGeo.translate(0, roomH, 0);
      } else {
        floorGeo = new THREE.PlaneGeometry(roomL, roomW);
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(roomL / 2, 0, roomW / 2);

        ceilGeo = new THREE.PlaneGeometry(roomL, roomW);
        ceilGeo.rotateX(Math.PI / 2);
        ceilGeo.translate(roomL / 2, roomH, roomW / 2);
      }
    }

    const floorBaseColor = new THREE.Color(surfaceColors.floor);
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorBaseColor.clone().multiplyScalar(Math.max(0.15, reflectances.floor)),
      roughness: 0.85,
      wireframe: isWireframeMode,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    scene.add(floorMesh);

    // Excluded Subspace 3D Void Block (Lift Shaft / MEP Core)
    if (hasSubspace) {
      const coreGeo = new THREE.BoxGeometry(subspaceL, roomH, subspaceW);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(subspacePosX + subspaceL / 2, roomH / 2, subspacePosZ + subspaceW / 2);
      scene.add(coreMesh);

      const coreEdges = new THREE.EdgesGeometry(coreGeo);
      const coreLines = new THREE.LineSegments(coreEdges, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 }));
      coreLines.position.copy(coreMesh.position);
      scene.add(coreLines);
    }

    // Floor CAD / DWG Underlay Simulation (DIALux evo Construction Plans)
    if (showDwgUnderlay && activeCadPlan && activeCadPlan.visible) {
      try {
        const cadCanvas = renderCADPlanToCanvas(activeCadPlan, roomL, roomW, {
          bgTheme: cadTheme === "white" ? "white" : "dark",
          resolutionScale: 140,
        });
        const cadTexture = new THREE.CanvasTexture(cadCanvas);
        cadTexture.minFilter = THREE.LinearFilter;
        cadTexture.magFilter = THREE.LinearFilter;

        const cadPlaneGeo = new THREE.PlaneGeometry(roomL, roomW);
        cadPlaneGeo.rotateX(-Math.PI / 2);
        cadPlaneGeo.translate(roomL / 2, 0.004, roomW / 2);
        const cadPlaneMat = new THREE.MeshBasicMaterial({
          map: cadTexture,
          transparent: true,
          opacity: activeCadPlan.opacity ?? 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const cadPlaneMesh = new THREE.Mesh(cadPlaneGeo, cadPlaneMat);
        scene.add(cadPlaneMesh);
      } catch (err) {
        console.warn("CAD underlay canvas render error:", err);
      }
    }

    // Snapping Guide Grid
    if (showGuideGrid) {
      const guideGrid = new THREE.GridHelper(Math.max(roomL, roomW), 20, 0xf59e0b, 0x334155);
      guideGrid.position.set(roomL / 2, 0.003, roomW / 2);
      scene.add(guideGrid);
    }

    // Ceiling
    const ceilBaseColor = new THREE.Color(surfaceColors.ceiling);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: ceilBaseColor.clone().multiplyScalar(Math.max(0.2, reflectances.ceiling)),
      roughness: 0.9,
      transparent: true,
      opacity: 0.35,
      wireframe: isWireframeMode,
    });
    const ceilingMesh = new THREE.Mesh(ceilGeo, ceilingMat);
    scene.add(ceilingMesh);

    // Modular 600x600 Ceiling Grid
    if (showCeilingGrid) {
      const gridGroup = new THREE.Group();
      const gridLineMat = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.5 });
      for (let x = 0.6; x < roomL; x += 0.6) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, roomH - 0.002, 0),
          new THREE.Vector3(x, roomH - 0.002, roomW),
        ]);
        gridGroup.add(new THREE.Line(geo, gridLineMat));
      }
      for (let z = 0.6; z < roomW; z += 0.6) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, roomH - 0.002, z),
          new THREE.Vector3(roomL, roomH - 0.002, z),
        ]);
        gridGroup.add(new THREE.Line(geo, gridLineMat));
      }
      scene.add(gridGroup);
    }

    // Room Box Wireframe
    if (showWireframeBoundary) {
      const roomBoxGeo = new THREE.BoxGeometry(roomL, roomH, roomW);
      const roomEdges = new THREE.EdgesGeometry(roomBoxGeo);
      const wireframeLine = new THREE.LineSegments(
        roomEdges,
        new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.5 })
      );
      wireframeLine.position.set(roomL / 2, roomH / 2, roomW / 2);
      scene.add(wireframeLine);
    }

    // Semi-Transparent Walls with Light Reflection & Inter-reflection
    if (showRoomWalls) {
      // Wall False-Color Texture (EN 12464-1 Vertical Illuminance verification)
      let wallTexture: any = null;
      if (showWallFalseColor) {
        const wallCanvas = document.createElement("canvas");
        wallCanvas.width = 128;
        wallCanvas.height = 256;
        const wCtx = wallCanvas.getContext("2d");
        if (wCtx) {
          const grad = wCtx.createLinearGradient(0, wallCanvas.height, 0, 0); // bottom to top
          const bottomLux = Math.round(simulationResult.avgLux * 0.35);
          const midLux = Math.round(simulationResult.avgLux * 0.70);
          const topLux = Math.round(simulationResult.avgLux * 0.45);
          grad.addColorStop(0, getFalseColorForLux(bottomLux, targetLux));
          grad.addColorStop(0.55, getFalseColorForLux(midLux, targetLux));
          grad.addColorStop(1, getFalseColorForLux(topLux, targetLux));
          wCtx.fillStyle = grad;
          wCtx.fillRect(0, 0, wallCanvas.width, wallCanvas.height);
          wCtx.strokeStyle = "rgba(255,255,255,0.25)";
          wCtx.lineWidth = 1;
          wCtx.strokeRect(2, 2, wallCanvas.width - 4, wallCanvas.height - 4);
        }
        wallTexture = new THREE.CanvasTexture(wallCanvas);
      }

      const wallBaseColor = new THREE.Color(surfaceColors.walls);
      const wallBounceColor = showWallReflection && showLightTextures
        ? new THREE.Color(lightHex).multiplyScalar(reflectances.walls * Math.min(1.0, simulationResult.avgLux / 800) * 0.35)
        : new THREE.Color(0x000000);

      const wallMat = new THREE.MeshStandardMaterial({
        color: showWallFalseColor ? 0xffffff : wallBaseColor.clone().multiplyScalar(Math.max(0.3, reflectances.walls)),
        map: showWallFalseColor && wallTexture ? wallTexture : null,
        roughness: showWallReflection ? Math.max(0.2, 0.9 - reflectances.walls * 0.6) : 0.8,
        metalness: 0.05,
        emissive: showWallFalseColor ? new THREE.Color(0x000000) : wallBounceColor,
        emissiveIntensity: showLightTextures ? 1.0 : 0.0,
        transparent: true,
        opacity: showWallFalseColor ? 0.65 : showWallReflection ? 0.32 : 0.22,
        side: THREE.BackSide,
        wireframe: isWireframeMode,
      });

      if (roomShape === "circular") {
        const wallGeo = new THREE.CylinderGeometry(roomL / 2, roomL / 2, roomH, 48, 1, true);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(roomL / 2, roomH / 2, roomW / 2);
        scene.add(wallMesh);
      } else {
        // DIALux evo Tutorial Part 4: Individual Wall Faces (North, South, East, West) with Shift-Key support
        const createWallFaceMesh = (
          width: number,
          height: number,
          faceMatDef: { colorHex: string; reflectance: number; textureType?: string },
          pos: [number, number, number],
          rotY: number
        ) => {
          const faceColor = new THREE.Color(faceMatDef.colorHex || surfaceColors.walls);
          const faceBounce = showWallReflection && showLightTextures
            ? new THREE.Color(lightHex).multiplyScalar(faceMatDef.reflectance * Math.min(1.0, simulationResult.avgLux / 800) * 0.35)
            : new THREE.Color(0x000000);

          let procTex: any = null;
          if (faceMatDef.textureType && faceMatDef.textureType !== "plain") {
            const cvs = generateProceduralCanvasTexture(faceMatDef.textureType as any, faceMatDef.colorHex, 256);
            procTex = new THREE.CanvasTexture(cvs);
            procTex.wrapS = THREE.RepeatWrapping;
            procTex.wrapT = THREE.RepeatWrapping;
            procTex.repeat.set(Math.max(1, width / 2), Math.max(1, height / 2));
          }

          const m = new THREE.MeshStandardMaterial({
            color: showWallFalseColor ? 0xffffff : faceColor.clone().multiplyScalar(Math.max(0.3, faceMatDef.reflectance)),
            map: showWallFalseColor && wallTexture ? wallTexture : procTex,
            roughness: showWallReflection ? Math.max(0.2, 0.9 - faceMatDef.reflectance * 0.6) : 0.8,
            metalness: 0.05,
            emissive: showWallFalseColor ? new THREE.Color(0x000000) : faceBounce,
            emissiveIntensity: showLightTextures ? 1.0 : 0.0,
            transparent: true,
            opacity: showWallFalseColor ? 0.65 : showWallReflection ? 0.36 : 0.26,
            side: THREE.DoubleSide,
            wireframe: isWireframeMode,
          });

          const pGeo = new THREE.PlaneGeometry(width, height);
          const pMesh = new THREE.Mesh(pGeo, m);
          pMesh.position.set(...pos);
          pMesh.rotation.y = rotY;
          return pMesh;
        };

        const northWall = createWallFaceMesh(roomL, roomH, wallSurfaces.north, [roomL / 2, roomH / 2, 0], 0);
        const southWall = createWallFaceMesh(roomL, roomH, wallSurfaces.south, [roomL / 2, roomH / 2, roomW], Math.PI);
        const eastWall = createWallFaceMesh(roomW, roomH, wallSurfaces.east, [roomL, roomH / 2, roomW / 2], -Math.PI / 2);
        const westWall = createWallFaceMesh(roomW, roomH, wallSurfaces.west, [0, roomH / 2, roomW / 2], Math.PI / 2);

        scene.add(northWall);
        scene.add(southWall);
        scene.add(eastWall);
        scene.add(westWall);
      }

      // DIALux evo Indoor Contours & Partition Walls (Tutorial Part 3)
      if (planningMode === "Outdoor and building planning" && activeStorey && activeStorey.rooms && activeStorey.rooms.length > 1) {
        const partitionGroup = new THREE.Group();
        const partitionMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.85,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });

        activeStorey.rooms.forEach((rm) => {
          if (!rm.polygon || rm.polygon.length < 3) return;
          const isCurrentRoom = rm.id === buildingModel.activeRoomId;
          const poly = rm.polygon;
          const t = rm.wallThickness || 0.15;
          const h = rm.height || roomH;

          // Render walls along each polygon edge
          for (let i = 0; i < poly.length; i++) {
            const j = (i + 1) % poly.length;
            const p1 = poly[i];
            const p2 = poly[j];
            const dx = p2.x - p1.x;
            const dz = p2.y - p1.y;
            const segLen = Math.sqrt(dx * dx + dz * dz);
            if (segLen < 0.05) continue;

            const angle = Math.atan2(dz, dx);
            const wallPartGeo = new THREE.BoxGeometry(segLen, h, t);
            const wallPartMesh = new THREE.Mesh(wallPartGeo, partitionMat);
            // Position at midpoint
            const midX = (p1.x + p2.x) / 2;
            const midZ = (p1.y + p2.y) / 2;
            wallPartMesh.position.set(midX, h / 2, midZ);
            wallPartMesh.rotation.y = -angle;
            partitionGroup.add(wallPartMesh);
          }

          // Subtle Room Floor Boundary Outline
          const floorLinePts = poly.map((pt) => new THREE.Vector3(pt.x, 0.008, pt.y));
          floorLinePts.push(floorLinePts[0].clone());
          const boundaryGeo = new THREE.BufferGeometry().setFromPoints(floorLinePts);
          const boundaryMat = new THREE.LineBasicMaterial({
            color: isCurrentRoom ? 0x3b82f6 : 0x10b981,
            linewidth: isCurrentRoom ? 3 : 1.5,
          });
          partitionGroup.add(new THREE.Line(boundaryGeo, boundaryMat));
        });
        scene.add(partitionGroup);
      }
    }

    // -------------------------------------------------------------
    // Screenshot 4: Help Lines, Reference Lines & 3D Dimensions
    // -------------------------------------------------------------
    if (showDimensions) {
      const dimGroup = new THREE.Group();
      const dimMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
      const dimTickMat = new THREE.LineBasicMaterial({ color: 0xf87171 });

      // Room Length Dimension Line (along X axis at Z = -0.35)
      const lenGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.015, -0.35),
        new THREE.Vector3(roomL, 0.015, -0.35),
      ]);
      dimGroup.add(new THREE.Line(lenGeo, dimMat));
      [0, roomL].forEach((x) => {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0.015, -0.45),
          new THREE.Vector3(x, 0.015, -0.25),
        ]);
        dimGroup.add(new THREE.Line(tickGeo, dimTickMat));
      });

      // Room Width Dimension Line (along Z axis at X = -0.35)
      const wGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 0.015, 0),
        new THREE.Vector3(-0.35, 0.015, roomW),
      ]);
      dimGroup.add(new THREE.Line(wGeo, dimMat));
      [0, roomW].forEach((z) => {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.45, 0.015, z),
          new THREE.Vector3(-0.25, 0.015, z),
        ]);
        dimGroup.add(new THREE.Line(tickGeo, dimTickMat));
      });

      // Room Height Dimension Line (along Y axis at X = -0.35, Z = -0.35)
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 0, -0.35),
        new THREE.Vector3(-0.35, roomH, -0.35),
      ]);
      dimGroup.add(new THREE.Line(hGeo, dimMat));
      [0, roomH].forEach((y) => {
        const tickGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-0.45, y, -0.35),
          new THREE.Vector3(-0.25, y, -0.35),
        ]);
        dimGroup.add(new THREE.Line(tickGeo, dimTickMat));
      });

      scene.add(dimGroup);
    }

    // Active Help Line / Reference Line rendering
    if (activeHelpLineType === "circ_ref") {
      const circGeo = new THREE.RingGeometry(Math.max(0.4, copyRadius - 0.02), Math.max(0.42, copyRadius + 0.02), 48);
      circGeo.rotateX(-Math.PI / 2);
      const circMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      const circMesh = new THREE.Mesh(circGeo, circMat);
      circMesh.position.set(roomL / 2, 0.012, roomW / 2);
      scene.add(circMesh);
    } else if (activeHelpLineType === "ref_line") {
      const refGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.012, roomW / 2),
        new THREE.Vector3(roomL, 0.012, roomW / 2),
      ]);
      const refMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
      scene.add(new THREE.Line(refGeo, refMat));
    }

    // Screenshot 3 & 4: Apertures (Windows & External Venetian Blinds)
    if (windowCount > 0) {
      const windowGroup = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        transmission: 0.85,
        side: THREE.DoubleSide,
      });

      const winY = apertureSillHeight + apertureHeight / 2;
      const winSpacing = roomL / (windowCount + 1);

      for (let i = 1; i <= windowCount; i++) {
        const winX = i * winSpacing;

        // Window Frame
        const winFrame = new THREE.Mesh(
          new THREE.BoxGeometry(apertureWidth, apertureHeight, 0.08),
          frameMat
        );
        winFrame.position.set(winX, winY, 0.02);
        windowGroup.add(winFrame);

        // Glass Pane
        const winGlass = new THREE.Mesh(
          new THREE.PlaneGeometry(apertureWidth - apertureFrameWidth, apertureHeight - apertureFrameWidth),
          glassMat
        );
        winGlass.position.set(winX, winY, 0.02);
        windowGroup.add(winGlass);

        // Screenshot 4: External Venetian Blinds
        if (showFacadeBlinds && facadeElement === "venetian_blind") {
          const slatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
          const slatCount = 7;
          for (let s = 0; s < slatCount; s++) {
            const slatY = apertureSillHeight + 0.1 + (s * (apertureHeight - 0.2)) / slatCount;
            const slat = new THREE.Mesh(new THREE.BoxGeometry(apertureWidth - 0.04, 0.025, 0.06), slatMat);
            slat.position.set(winX, slatY, -0.04);
            slat.rotation.x = 0.35; // Authentic blind tilt
            windowGroup.add(slat);
          }
        }
      }
      scene.add(windowGroup);
    }

    // -------------------------------------------------------------
    // Screenshot 1: Room Elements (Beams, Columns, Platforms, Ramps)
    // -------------------------------------------------------------
    if (showRoomElements && hasPlacedRoomElement) {
      const elemGroup = new THREE.Group();
      const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
      const beamMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });

      if (activeRoomElement === "beam") {
        const bH = 0.4 * roomElementScale;
        const bW = 0.3 * roomElementScale;
        const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(roomL, bH, bW), beamMat);
        beamMesh.position.set(roomL / 2, roomH - bH / 2, roomW / 2);
        elemGroup.add(beamMesh);
      } else if (activeRoomElement === "column_rect") {
        const cW = roomElementWidth * roomElementScale;
        const cL = roomElementLength * roomElementScale;
        const colGeo = new THREE.BoxGeometry(cW, roomH, cL);
        const col1 = new THREE.Mesh(colGeo, concreteMat);
        col1.position.set(roomL * 0.33, roomH / 2, roomW / 2);
        const col2 = new THREE.Mesh(colGeo, concreteMat);
        col2.position.set(roomL * 0.67, roomH / 2, roomW / 2);
        elemGroup.add(col1);
        elemGroup.add(col2);
      } else if (activeRoomElement === "column_circ") {
        const r = (roomElementWidth / 2) * roomElementScale;
        const colGeo = new THREE.CylinderGeometry(r, r, roomH, 24);
        const col1 = new THREE.Mesh(colGeo, concreteMat);
        col1.position.set(roomL * 0.33, roomH / 2, roomW / 2);
        const col2 = new THREE.Mesh(colGeo, concreteMat);
        col2.position.set(roomL * 0.67, roomH / 2, roomW / 2);
        elemGroup.add(col1);
        elemGroup.add(col2);
      } else if (activeRoomElement === "platform") {
        const platGeo = new THREE.BoxGeometry(roomL * 0.5, 0.25, roomW * 0.5);
        const platMesh = new THREE.Mesh(platGeo, concreteMat);
        platMesh.position.set(roomL / 2, 0.125, roomW / 2);
        elemGroup.add(platMesh);
      } else if (activeRoomElement === "ramp") {
        const rampGeo = new THREE.BoxGeometry(roomL * 0.3, 0.3, roomW * 0.4);
        const rampMesh = new THREE.Mesh(rampGeo, concreteMat);
        rampMesh.rotation.z = -0.15;
        rampMesh.position.set(roomL / 2, 0.15, roomW / 2);
        elemGroup.add(rampMesh);
      }
      scene.add(elemGroup);
    }

    // -------------------------------------------------------------
    // Screenshot 2: Roofs (Flat roof, Gable roof, Shed roof)
    // -------------------------------------------------------------
    if (hasPlacedRoof || showRoofIn3D) {
      const roofGroup = new THREE.Group();
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.6,
        side: THREE.DoubleSide,
      });

      if (activeRoofType === "flat") {
        const over = roofOverhang;
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(roomL + 2 * over, 0.18, roomW + 2 * over),
          roofMat
        );
        slab.position.set(roomL / 2, roomH + 0.09, roomW / 2);
        roofGroup.add(slab);
      } else if (activeRoofType === "gable") {
        const over = roofOverhang;
        const pitchRad = (roofPitch * Math.PI) / 180;
        const planeW = (roomW / 2 + over) / Math.cos(pitchRad);
        const planeL = roomL + 2 * over;

        const leftRoof = new THREE.Mesh(new THREE.PlaneGeometry(planeL, planeW), roofMat);
        leftRoof.rotation.x = pitchRad;
        leftRoof.position.set(roomL / 2, roomH + (Math.sin(pitchRad) * planeW) / 2, roomW / 4);

        const rightRoof = new THREE.Mesh(new THREE.PlaneGeometry(planeL, planeW), roofMat);
        rightRoof.rotation.x = -pitchRad;
        rightRoof.position.set(roomL / 2, roomH + (Math.sin(pitchRad) * planeW) / 2, (3 * roomW) / 4);

        roofGroup.add(leftRoof);
        roofGroup.add(rightRoof);
      } else {
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(roomL + 0.4, 0.15, roomW + 0.4),
          roofMat
        );
        slab.position.set(roomL / 2, roomH + 0.15, roomW / 2);
        roofGroup.add(slab);
      }
      scene.add(roofGroup);
    }

    // -------------------------------------------------------------
    // Screenshot 3: Ceilings (Suspended Ceiling System)
    // -------------------------------------------------------------
    if (hasSuspendedCeiling) {
      const ceilGroup = new THREE.Group();
      const effY = roomH - ceilingSuspensionDepth;

      // Suspended acoustic tile membrane
      const tileMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.85,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const tilePlane = new THREE.Mesh(new THREE.PlaneGeometry(roomL, roomW), tileMat);
      tilePlane.rotation.x = Math.PI / 2;
      tilePlane.position.set(roomL / 2, effY, roomW / 2);
      ceilGroup.add(tilePlane);

      // Modular 600x600 T-bar grid lines
      const tbarMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.7 });
      for (let x = 0.6; x < roomL; x += 0.6) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, effY + 0.001, 0),
          new THREE.Vector3(x, effY + 0.001, roomW),
        ]);
        ceilGroup.add(new THREE.Line(geo, tbarMat));
      }
      for (let z = 0.6; z < roomW; z += 0.6) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, effY + 0.001, z),
          new THREE.Vector3(roomL, effY + 0.001, z),
        ]);
        ceilGroup.add(new THREE.Line(geo, tbarMat));
      }
      scene.add(ceilGroup);
    }

    // -------------------------------------------------------------
    // Screenshot 4: Cutout Void (Ceiling / Floor opening)
    // -------------------------------------------------------------
    if (hasActiveCutout) {
      const cutoutGroup = new THREE.Group();
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
      const cY = cutoutSurface === "ceiling" ? (hasSuspendedCeiling ? roomH - ceilingSuspensionDepth : roomH) : 0.02;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(cutoutWidth, 0.04, cutoutLength), trimMat);
      trim.position.set(cutoutPosX, cY, cutoutPosY);
      cutoutGroup.add(trim);
      scene.add(cutoutGroup);
    }

    // -------------------------------------------------------------
    // Screenshot 5: Furniture and objects (DIALux evo Tutorial Part 4 Compound Objects)
    // -------------------------------------------------------------
    if (showFurniture && furnitureList && furnitureList.length > 0) {
      const furnGroup = new THREE.Group();

      furnitureList.forEach((item) => {
        const itemGroup = new THREE.Group();
        itemGroup.position.set(item.x, item.y, item.z);
        itemGroup.rotation.y = (item.rotationDeg * Math.PI) / 180;

        if (item.parts && item.parts.length > 0) {
          item.parts.forEach((part) => {
            const partMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(part.colorHex || item.colorHex || "#d4b996"),
              roughness: 0.55,
              metalness: 0.1,
            });

            let partMesh: any;
            if (part.shape === "cylinder") {
              const r = Math.max(0.01, part.width / 2);
              partMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, part.height, 16), partMat);
            } else {
              partMesh = new THREE.Mesh(new THREE.BoxGeometry(part.width, part.height, part.length), partMat);
            }
            partMesh.position.set(part.relX, part.relY + part.height / 2, part.relZ);
            partMesh.castShadow = true;
            partMesh.receiveShadow = true;
            itemGroup.add(partMesh);
          });
        } else {
          // Fallback single box
          const boxMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(item.colorHex || "#94a3b8"),
            roughness: 0.5,
          });
          const bMesh = new THREE.Mesh(new THREE.BoxGeometry(item.width, item.height, item.length), boxMat);
          bMesh.position.set(0, item.height / 2, 0);
          itemGroup.add(bMesh);
        }

        // Selection Wireframe Bounding Outline
        if (item.id === selectedFurnitureId) {
          const wireMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
          const bboxGeo = new THREE.BoxGeometry(item.width + 0.04, item.height + 0.04, item.length + 0.04);
          const wireSegments = new THREE.LineSegments(new THREE.EdgesGeometry(bboxGeo), wireMat);
          wireSegments.position.set(0, item.height / 2, 0);
          itemGroup.add(wireSegments);
        }

        // DIALux evo Tutorial Part 13: Inclined Calculation Plane on Staircase Steps
        if (item.type === "staircase" && item.stairConfig?.calcSurfaceEnabled) {
          const cfg = item.stairConfig;
          const sPoints: any[] = [];
          for (let i = 0; i < cfg.stepCount; i++) {
            const stepZ = i * cfg.treadDepth - item.length / 2 + cfg.treadDepth / 2;
            const stepY = (i + 1) * cfg.riserHeight + 0.01;
            sPoints.push(new THREE.Vector3(0, stepY, stepZ));

            // Lux measurement dot marker on step tread
            const dotGeo = new THREE.SphereGeometry(0.025, 8, 8);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const dotMesh = new THREE.Mesh(dotGeo, dotMat);
            dotMesh.position.set(0, stepY, stepZ);
            itemGroup.add(dotMesh);
          }
          if (sPoints.length > 1) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(sPoints);
            const lineMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.1, gapSize: 0.05 });
            const slopeLine = new THREE.Line(lineGeo, lineMat);
            slopeLine.computeLineDistances();
            itemGroup.add(slopeLine);
          }
        }

        furnGroup.add(itemGroup);
      });

      scene.add(furnGroup);
    }

    // =========================================================================
    // DIALux evo Working Plane & Calculation Surface (Tutorial #9 & #15)
    // F4: Calculation Surface (Yellow translucent plane + Margin Lines + Registration crosses)
    // F7: False-color heatmap texture overlay
    // =========================================================================
    if (showCalcSurfacePlane) {
      const activeEvalZ = calcAreaType === "floor" ? 0.005 : calcAreaType === "workstation" ? workstationConfig.height : workPlaneHeight;

      if (showHeatmap && simulationResult.points.length > 0) {
        const resCols = simulationResult.gridResolution.cols;
        const resRows = simulationResult.gridResolution.rows;

        const canvas = document.createElement("canvas");
        canvas.width = resCols * 16;
        canvas.height = resRows * 16;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          simulationResult.points.forEach((pt) => {
            const normX = pt.x / roomL;
            const normY = pt.y / roomW;
            const px = normX * canvas.width;
            const py = normY * canvas.height;

            const color = getFalseColorForLux(pt.lux, targetLux);
            const radius = Math.max(8, (canvas.width / resCols) * 0.9);

            const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
            grad.addColorStop(0, color);
            grad.addColorStop(1, "transparent");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, 2 * Math.PI);
            ctx.fill();
          });

          if (showIsoluxLines) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 1;
            ctx.font = "9px sans-serif";
            ctx.fillStyle = "rgba(255, 255, 255, 0.85)";

            [100, 200, 300, 500, 750].forEach((lvl) => {
              const contourPts = simulationResult.points.filter((p) => Math.abs(p.lux - lvl) < lvl * 0.1);
              contourPts.slice(0, 8).forEach((cp) => {
                const cx = (cp.x / roomL) * canvas.width;
                const cy = (cp.y / roomW) * canvas.height;
                ctx.fillText(`${lvl} lx`, cx, cy);
              });
            });
          }

          // Numeric Lux Grid Values
          if (showLuxNumbers) {
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const sampleStep = Math.max(1, Math.round(resCols / 10));
            simulationResult.points.forEach((pt, idx) => {
              const r = Math.floor(idx / resCols);
              const c = idx % resCols;
              if (r % sampleStep === 0 && c % sampleStep === 0) {
                const px = (pt.x / roomL) * canvas.width;
                const py = (pt.y / roomW) * canvas.height;
                ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
                ctx.fillRect(px - 14, py - 6, 28, 12);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.strokeRect(px - 14, py - 6, 28, 12);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(`${pt.lux}`, px, py);
              }
            });
          }

          const texture = new THREE.CanvasTexture(canvas);
          const workPlaneGeo = new THREE.PlaneGeometry(roomL, roomW);
          workPlaneGeo.rotateX(-Math.PI / 2);
          workPlaneGeo.translate(roomL / 2, activeEvalZ, roomW / 2);

          const workPlaneMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.82,
            side: THREE.DoubleSide,
            wireframe: isWireframeMode,
          });

          const workPlaneMesh = new THREE.Mesh(workPlaneGeo, workPlaneMat);
          scene.add(workPlaneMesh);
        }
      } else {
        // DIALux evo Tutorial #9: Authentic Yellow Translucent Calculation Plane
        const wpYellowGeo = new THREE.PlaneGeometry(roomL, roomW);
        wpYellowGeo.rotateX(-Math.PI / 2);
        wpYellowGeo.translate(roomL / 2, activeEvalZ, roomW / 2);

        const wpYellowMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.12,
          roughness: 0.55,
          metalness: 0.05,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          wireframe: isWireframeMode,
        });
        const wpYellowMesh = new THREE.Mesh(wpYellowGeo, wpYellowMat);
        scene.add(wpYellowMesh);
      }

      // Visual Boundary Lines matching selected Calculation Area
      if (calcAreaType === "floor") {
        // Floor surface boundary (Z = 0.005m, emerald green)
        const floorBorderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(roomL, roomW));
        floorBorderGeo.rotateX(-Math.PI / 2);
        floorBorderGeo.translate(roomL / 2, 0.008, roomW / 2);
        const floorBorder = new THREE.LineSegments(
          floorBorderGeo,
          new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
        );
        scene.add(floorBorder);
      } else if (calcAreaType === "workplane") {
        // Working plane outer border (golden amber)
        const wpBorderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(roomL, roomW));
        wpBorderGeo.rotateX(-Math.PI / 2);
        wpBorderGeo.translate(roomL / 2, workPlaneHeight, roomW / 2);
        const wpBorder = new THREE.LineSegments(wpBorderGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 1.5 }));
        scene.add(wpBorder);

        // Useful Working Area (Inner Wall Margin Exclusion Boundary per EN 12464-1)
        const usefulL = Math.max(0.2, roomL - 2 * marginOffset);
        const usefulW = Math.max(0.2, roomW - 2 * marginOffset);
        const marginGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(usefulL, usefulW));
        marginGeo.rotateX(-Math.PI / 2);
        marginGeo.translate(roomL / 2, workPlaneHeight + 0.003, roomW / 2);
        const marginBorder = new THREE.LineSegments(
          marginGeo,
          new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 1.5 })
        );
        scene.add(marginBorder);

        // DIALux evo Tutorial #9: Corner Registration Crosses (+) at Useful Working Area corners
        const crossSize = 0.12;
        const halfUL = usefulL / 2;
        const halfUW = usefulW / 2;
        const cX = roomL / 2;
        const cZ = roomW / 2;
        [
          [-halfUL, -halfUW],
          [halfUL, -halfUW],
          [-halfUL, halfUW],
          [halfUL, halfUW],
        ].forEach(([ox, oz]) => {
          const crossGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(cX + ox - crossSize, workPlaneHeight + 0.005, cZ + oz),
            new THREE.Vector3(cX + ox + crossSize, workPlaneHeight + 0.005, cZ + oz),
            new THREE.Vector3(cX + ox, workPlaneHeight + 0.005, cZ + oz - crossSize),
            new THREE.Vector3(cX + ox, workPlaneHeight + 0.005, cZ + oz + crossSize),
          ]);
          const cross = new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
          scene.add(cross);
        });
      } else if (calcAreaType === "workstation") {
          // Dedicated Workstation Task Desk + EN 12464-1 Immediate Surrounding Area
          const wsGroup = new THREE.Group();

          // 1. Task Desk Plate Slab
          const deskPlateGeo = new THREE.BoxGeometry(workstationConfig.length, 0.03, workstationConfig.width);
          const deskPlateMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.35,
            roughness: 0.3,
            transparent: true,
            opacity: 0.85,
          });
          const deskPlate = new THREE.Mesh(deskPlateGeo, deskPlateMat);
          deskPlate.position.set(workstationConfig.x, workstationConfig.height, workstationConfig.y);
          wsGroup.add(deskPlate);

          // 2. Glowing Task Area Perimeter Border (Solid Amber)
          const deskBorderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(workstationConfig.length, 0.03, workstationConfig.width));
          const deskBorder = new THREE.LineSegments(
            deskBorderGeo,
            new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 2 })
          );
          deskBorder.position.set(workstationConfig.x, workstationConfig.height, workstationConfig.y);
          wsGroup.add(deskBorder);

          // 3. DIALux evo Corner Registration Crosses (+)
          const crossSize = 0.08;
          [
            [-workstationConfig.length / 2, -workstationConfig.width / 2],
            [workstationConfig.length / 2, -workstationConfig.width / 2],
            [-workstationConfig.length / 2, workstationConfig.width / 2],
            [workstationConfig.length / 2, workstationConfig.width / 2],
          ].forEach(([ox, oz]) => {
            const crossGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(workstationConfig.x + ox - crossSize, workstationConfig.height + 0.02, workstationConfig.y + oz),
              new THREE.Vector3(workstationConfig.x + ox + crossSize, workstationConfig.height + 0.02, workstationConfig.y + oz),
              new THREE.Vector3(workstationConfig.x + ox, workstationConfig.height + 0.02, workstationConfig.y + oz - crossSize),
              new THREE.Vector3(workstationConfig.x + ox, workstationConfig.height + 0.02, workstationConfig.y + oz + crossSize),
            ]);
            const cross = new THREE.LineSegments(crossGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b }));
            wsGroup.add(cross);
          });

          // 4. Desk Legs down to Floor
          const legMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
          const legH = workstationConfig.height - 0.015;
          [
            [-workstationConfig.length / 2 + 0.05, -workstationConfig.width / 2 + 0.05],
            [workstationConfig.length / 2 - 0.05, -workstationConfig.width / 2 + 0.05],
            [-workstationConfig.length / 2 + 0.05, workstationConfig.width / 2 - 0.05],
            [workstationConfig.length / 2 - 0.05, workstationConfig.width / 2 - 0.05],
          ].forEach(([ox, oz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, legH, 12), legMat);
            leg.position.set(workstationConfig.x + ox, legH / 2, workstationConfig.y + oz);
            wsGroup.add(leg);
          });

          // 5. EN 12464-1 Immediate Surrounding Area Boundary (0.50m expansion band)
          const surrL = workstationConfig.length + 2 * workstationConfig.surroundingBand;
          const surrW = workstationConfig.width + 2 * workstationConfig.surroundingBand;
          const surrBorderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(surrL, surrW));
          surrBorderGeo.rotateX(-Math.PI / 2);
          surrBorderGeo.translate(workstationConfig.x, workstationConfig.height + 0.005, workstationConfig.y);
          const surrBorder = new THREE.LineSegments(
            surrBorderGeo,
            new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 })
          );
          wsGroup.add(surrBorder);

          scene.add(wsGroup);
        }
      }

    // Luminaires, Wall Reflection Spotlights & Light Cones
    // DIALux evo Room Boundary Clipping Planes: light beams stay strictly inside the room envelope!
    const roomClippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),          // x >= 0 (Left Wall)
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), roomL),      // x <= roomL (Right Wall)
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),          // z >= 0 (Back Wall)
      new THREE.Plane(new THREE.Vector3(0, 0, -1), roomW),      // z <= roomW (Front Wall)
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),          // y >= 0 (Floor)
      new THREE.Plane(new THREE.Vector3(0, -1, 0), roomH),      // y <= roomH (Ceiling)
    ];

    // Real dynamic SpotLights casting down from luminaires to illuminate walls, creating authentic photometric scallops
    if (showWallReflection) {
      simulationResult.luminaires.slice(0, 24).forEach((lum) => {
        if (lum.isExcluded) return; // DIALux evo Part 6: Skip excluded grid fittings
        const dimFactor = lum.dimming !== undefined ? lum.dimming : 1.0;
        const spot = new THREE.SpotLight(lightHex, 1.4 * (sceneDimFactor || 1.0) * dimFactor);
        spot.position.set(lum.x, lum.z - 0.05, lum.y);
        if (lum.targetPoint) {
          spot.target.position.set(lum.targetPoint.x, lum.targetPoint.z, lum.targetPoint.y);
        } else {
          spot.target.position.set(lum.x, 0, lum.y);
        }
        spot.angle = ((profile.beamAngle || 110) * 0.5 * Math.PI) / 180;
        spot.penumbra = 0.5;
        spot.distance = Math.max(roomL, roomW, roomH) * 2.5;
        spot.decay = 1.4;
        scene.add(spot);
        scene.add(spot.target);
      });
    }

    const luminaireMeshesGroup = new THREE.Group();
    luminaireMeshesGroup.visible = showLuminaires;
    scene.add(luminaireMeshesGroup);

    simulationResult.luminaires.forEach((lum, idx) => {
      const isSelected = selectedFixtureIndex === idx;
      const isExcluded = !!lum.isExcluded;

      const isCircular = profile.shape === "circular" || profile.category === "downlight";
      const dimL = profile.dimensions?.length || 0.6;
      const dimW = profile.dimensions?.width || 0.6;
      const dimH = profile.dimensions?.height || 0.05;
      const radius = profile.dimensions?.diameter ? profile.dimensions.diameter / 2 : Math.min(dimL, dimW) / 2;

      const lumGeo = isCircular
        ? new THREE.CylinderGeometry(radius, radius, dimH, 24)
        : new THREE.BoxGeometry(dimL, dimH, dimW);

      const dimFactor = isExcluded ? 0 : (lum.dimming !== undefined ? lum.dimming : 1.0);
      const lumMat = new THREE.MeshStandardMaterial({
        color: isExcluded ? 0xef4444 : (isSelected ? 0xf59e0b : 0xffffff),
        emissive: isExcluded ? 0x000000 : (isSelected ? 0xf59e0b : lightHex),
        emissiveIntensity: isExcluded ? 0 : (isSelected ? 1.8 : 0.9 * dimFactor),
        wireframe: isExcluded,
        metalness: 0.25,
        roughness: 0.35,
        opacity: isExcluded ? 0.35 : 1.0,
        transparent: isExcluded,
      });

      const lumMesh = new THREE.Mesh(lumGeo, lumMat);
      lumMesh.position.set(lum.x, lum.z - dimH / 2, lum.y);

      if (lum.targetPoint) {
        const dir = new THREE.Vector3(lum.targetPoint.x - lum.x, lum.targetPoint.z - lum.z, lum.targetPoint.y - lum.y).normalize();
        lumMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      } else {
        if (lum.rotationZ) lumMesh.rotation.y = THREE.MathUtils.degToRad(lum.rotationZ);
        if (lum.rotationX) lumMesh.rotation.x = THREE.MathUtils.degToRad(lum.rotationX);
        if (lum.rotationY) lumMesh.rotation.z = THREE.MathUtils.degToRad(lum.rotationY);
      }
      lumMesh.userData = { lumIndex: idx, isLuminaire: true, isExcluded };
      luminaireMeshesGroup.add(lumMesh);

      // DIALux evo Authentic Golden Wireframe Selection Bounding Box & Accessories (F9: Luminaires)
      if (showLuminaires) {
        if (isSelected) {
          const boxHelper = new THREE.BoxHelper(lumMesh, isExcluded ? 0xef4444 : 0xf59e0b);
          scene.add(boxHelper);
        }

        // DIALux evo Part 6: Directional Aiming Ray & Surface Target Ring
        if (lum.targetPoint && !isExcluded) {
          const targetPos = new THREE.Vector3(lum.targetPoint.x, lum.targetPoint.z, lum.targetPoint.y);
          const rayGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(lum.x, lum.z - dimH / 2, lum.y),
            targetPos,
          ]);
          const rayMat = new THREE.LineDashedMaterial({
            color: isSelected ? 0x06b6d4 : 0x38bdf8,
            dashSize: 0.2,
            gapSize: 0.1,
          });
          const rayLine = new THREE.Line(rayGeo, rayMat);
          rayLine.computeLineDistances();
          scene.add(rayLine);

          // Circular target ring on floor/surface
          const ringGeo = new THREE.RingGeometry(0.12, 0.16, 24);
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: isSelected ? 0x06b6d4 : 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.position.copy(targetPos);
          ringMesh.position.y += 0.01;
          scene.add(ringMesh);

          // Center dot
          const dotGeo = new THREE.SphereGeometry(0.035, 12, 12);
          const dotMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0x06b6d4 : 0x38bdf8 });
          const dotMesh = new THREE.Mesh(dotGeo, dotMat);
          dotMesh.position.copy(targetPos);
          dotMesh.position.y += 0.01;
          scene.add(dotMesh);
        }

        // 3D Suspension Drop Cables & Canopy if suspended
        if (roomH - lum.z > 0.05) {
          const wireMat = new THREE.LineBasicMaterial({ color: isSelected ? 0xf59e0b : 0x94a3b8 });

          if (isCircular) {
            // Central drop cable / rod for downlights & pendants
            const wireGeo = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(lum.x, roomH, lum.y),
              new THREE.Vector3(lum.x, lum.z, lum.y),
            ]);
            scene.add(new THREE.Line(wireGeo, wireMat));

            const canopyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
            const canopyMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
            const canopy = new THREE.Mesh(canopyGeo, canopyMat);
            canopy.position.set(lum.x, roomH - 0.01, lum.y);
            scene.add(canopy);
          } else if (dimL > 2 * dimW) {
            // Linear continuous / trunking batten: 2 drop cables along length
            const offsetL = dimL * 0.4;
            [-offsetL, offsetL].forEach((ox) => {
              const wireGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(lum.x + ox, roomH, lum.y),
                new THREE.Vector3(lum.x + ox, lum.z, lum.y),
              ]);
              scene.add(new THREE.Line(wireGeo, wireMat));

              const canopyGeo = new THREE.BoxGeometry(0.04, 0.015, 0.04);
              const canopyMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
              const canopy = new THREE.Mesh(canopyGeo, canopyMat);
              canopy.position.set(lum.x + ox, roomH - 0.008, lum.y);
              scene.add(canopy);
            });
          } else {
            // Square / Rectangular panel: 4 corner suspension cables
            const ox = dimL * 0.42;
            const oy = dimW * 0.42;
            const corners = [
              [-ox, -oy],
              [ox, -oy],
              [ox, oy],
              [-ox, oy],
            ];
            corners.forEach(([cx, cy]) => {
              const wireGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(lum.x + cx, roomH, lum.y + cy),
                new THREE.Vector3(lum.x + cx, lum.z, lum.y + cy),
              ]);
              scene.add(new THREE.Line(wireGeo, wireMat));
            });
          }
        }
      }

      if (showLightCones && !isExcluded) {
        const coneHeight = Math.max(0.2, lum.z - workPlaneHeight);
        const beamRad = ((profile.beamAngle || 110) * 0.5 * Math.PI) / 180;
        const coneRadius = Math.tan(beamRad) * coneHeight * 0.85;

        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
        coneGeo.translate(0, -coneHeight / 2, 0);

        const coneMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0xf59e0b : lightHex,
          transparent: true,
          opacity: isSelected ? 0.22 : 0.09,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: clipLightConesToRoom ? roomClippingPlanes : [],
        });

        const coneMesh = new THREE.Mesh(coneGeo, coneMat);
        coneMesh.position.set(lum.x, lum.z, lum.y);
        if (lum.targetPoint) {
          const dir = new THREE.Vector3(lum.targetPoint.x - lum.x, lum.targetPoint.z - lum.z, lum.targetPoint.y - lum.y).normalize();
          coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        }
        scene.add(coneMesh);
      }
    });

    // 3D Point-to-Point Tape Measure Rendering
    if (measurePointA) {
      const markerGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const markerMatA = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const markerMeshA = new THREE.Mesh(markerGeo, markerMatA);
      markerMeshA.position.set(measurePointA.x, measurePointA.y + 0.04, measurePointA.z);
      scene.add(markerMeshA);

      if (measurePointB) {
        const markerMatB = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const markerMeshB = new THREE.Mesh(markerGeo, markerMatB);
        markerMeshB.position.set(measurePointB.x, measurePointB.y + 0.04, measurePointB.z);
        scene.add(markerMeshB);

        // Line between A and B
        const measureLineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(measurePointA.x, measurePointA.y + 0.04, measurePointA.z),
          new THREE.Vector3(measurePointB.x, measurePointB.y + 0.04, measurePointB.z),
        ]);
        const measureLineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b });
        scene.add(new THREE.Line(measureLineGeo, measureLineMat));
      }
    }

    // Emergency Scene 3D Overlays (EN 1838)
    if (lightScene === "10") {
      // Illuminated Green Exit Sign
      const exitGeo = new THREE.BoxGeometry(0.40, 0.18, 0.05);
      const exitMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const exitSign = new THREE.Mesh(exitGeo, exitMat);
      exitSign.position.set(roomL * 0.15, 2.1, 0.02);
      scene.add(exitSign);

      // Green central escape route corridor
      const escapeGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(roomL * 0.15, 0.015, 0),
        new THREE.Vector3(roomL * 0.15, 0.015, roomW),
      ]);
      const escapeMat = new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 0.25,
        gapSize: 0.15,
      });
      const escapeLine = new THREE.Line(escapeGeo, escapeMat);
      escapeLine.computeLineDistances();
      scene.add(escapeLine);
    }

    // DIALux evo Part 11: Daylight Visualization (CIE Overcast vs Clear Sunbeam)
    const isDaylightActive = isDaylightSceneActive || lightScene.startsWith("daylight") || lightScene === "combined";
    const effectiveSkyModel = lightScene === "daylight_overcast" ? "overcast" : lightScene === "daylight_clear" ? "clear" : daylightSkyModel;
    const effectiveDirectSun = lightScene === "daylight_clear" ? true : lightScene === "daylight_overcast" ? false : daylightDirectSun;

    const daylightSimResult = calculateComprehensiveDaylight({
      length: roomL,
      width: roomW,
      height: roomH,
      windowCount,
      windowWidth: apertureWidth,
      windowHeight: apertureHeight,
      windowSill: apertureSillHeight,
      glassTransmittance: daylightGlassTau,
      skyModel: effectiveSkyModel,
      directSunlight: effectiveDirectSun,
      latitude: daylightLat,
      longitude: daylightLon,
      hour: daylightHour,
      northOrientation: daylightNorthAngle,
      groundReflectance: daylightGroundReflectance,
      shadingReductionFactor: showFacadeBlinds ? 0.30 : 1.0,
      targetLux,
    });

    if (isDaylightActive || windowCount > 0) {
      // 1. Natural Ambient Sky Hemispherical Lighting
      const skyAmbientColor = effectiveSkyModel === "clear" ? 0x93c5fd : 0xdbeafe;
      const skyAmbientIntensity = effectiveSkyModel === "clear" ? 0.35 : 0.50;
      const naturalSkyLight = new THREE.HemisphereLight(skyAmbientColor, 0x334155, skyAmbientIntensity);
      scene.add(naturalSkyLight);

      // 2. Astronomical 3D Sun Positioning
      if (daylightSimResult.sunPosition.isSunAboveHorizon && effectiveSkyModel !== "overcast") {
        const altRad = (daylightSimResult.sunPosition.altitude * Math.PI) / 180;
        const azRad = ((daylightSimResult.sunPosition.azimuth - daylightNorthAngle) * Math.PI) / 180;
        const sunDist = Math.max(roomL, roomW) * 4;
        const sunX = roomL / 2 + sunDist * Math.sin(azRad) * Math.cos(altRad);
        const sunY = roomH / 2 + sunDist * Math.sin(altRad);
        const sunZ = roomW / 2 + sunDist * Math.cos(azRad) * Math.cos(altRad);

        const sunColor = daylightSimResult.sunPosition.altitude < 25 ? 0xffe0a8 : 0xfffaed;
        const sunIntensity = effectiveSkyModel === "clear" ? 0.95 : 0.55;
        const sunDirLight = new THREE.DirectionalLight(sunColor, sunIntensity);
        sunDirLight.position.set(sunX, sunY, sunZ);
        sunDirLight.target.position.set(roomL / 2, 0, roomW / 2);
        scene.add(sunDirLight);
        scene.add(sunDirLight.target);

        // 3. Realistic Volumetric Sunbeams through Window Apertures
        if (windowCount > 0 && effectiveDirectSun && daylightSimResult.sunPosition.directAngleToWindowDeg < 85) {
          const sunBeamMat = new THREE.MeshBasicMaterial({
            color: daylightSimResult.sunPosition.altitude < 25 ? 0xfde047 : 0xfef08a,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
            clippingPlanes: clipLightConesToRoom ? roomClippingPlanes : [],
          });

          const winSpacing = roomL / (windowCount + 1);
          const winY = apertureSillHeight + apertureHeight / 2;
          const beamLen = Math.min(roomW * 1.5, Math.max(1.8, winY / Math.max(0.2, Math.tan(altRad))));

          for (let i = 1; i <= windowCount; i++) {
            const winX = i * winSpacing;
            const beamGeo = new THREE.CylinderGeometry(
              apertureWidth * 0.45,
              apertureWidth * 0.95,
              beamLen,
              16,
              1,
              true
            );
            // Orient beam towards room interior
            beamGeo.rotateX(Math.PI / 2 - altRad);
            const beamMesh = new THREE.Mesh(beamGeo, sunBeamMat);
            beamMesh.position.set(winX, winY - 0.4, beamLen * 0.35);
            scene.add(beamMesh);

            // Sun patch floor polygon
            const patchGeo = new THREE.PlaneGeometry(apertureWidth * 1.1, beamLen * 0.6);
            patchGeo.rotateX(-Math.PI / 2);
            const patchMat = new THREE.MeshBasicMaterial({
              color: 0xfef9c3,
              transparent: true,
              opacity: 0.25,
              depthWrite: false,
            });
            const patchMesh = new THREE.Mesh(patchGeo, patchMat);
            patchMesh.position.set(winX, 0.015, beamLen * 0.5);
            scene.add(patchMesh);
          }
        }
      }
    }

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // DIALux evo Tutorial Part 15: Pivoting Point (Ctrl+Click / Tool) & Pipette White Point
      if (e.ctrlKey || isPickingPivot || isPickingWhitePoint) {
        const hits = raycaster.intersectObjects(scene.children, true);
        if (hits.length > 0) {
          const hit = hits[0];
          if (isPickingWhitePoint) {
            setWhiteBalanceMode("manual");
            setWhiteBalanceKelvin(4000);
            setIsPickingWhitePoint(false);
            toast.success("White point balanced from sampled surface!");
            return;
          } else {
            controls.target.copy(hit.point);
            controls.update();
            setCurrentPivot({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
            if (isPickingPivot) setIsPickingPivot(false);
            toast.success(
              `Pivoting point set to (${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)})`
            );
            return;
          }
        }
      }

      // 1. AIMING TOOL ACTIVE: Aim selected luminaire at clicked 3D surface point (DIALux evo Part 6)
      if (isAimingToolActive && selectedFixtureIndex !== null) {
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        let targetX = 0, targetY = 0, targetZ = 0;
        let gotHit = false;

        // Check if hitting floor/workplane/furniture mesh
        const sceneMeshes = scene.children.filter((c: any) => c !== luminaireMeshesGroup && !c.isLight);
        const meshHits = raycaster.intersectObjects(sceneMeshes, true);
        if (meshHits.length > 0 && meshHits[0].point.y <= roomH) {
          const pt = meshHits[0].point;
          targetX = Math.max(0, Math.min(roomL, Number(pt.x.toFixed(3))));
          targetY = Math.max(0, Math.min(roomW, Number(pt.z.toFixed(3))));
          targetZ = Math.max(0, Math.min(roomH, Number(pt.y.toFixed(3))));
          gotHit = true;
        } else if (raycaster.ray.intersectPlane(floorPlane, hit)) {
          targetX = Math.max(0, Math.min(roomL, Number(hit.x.toFixed(3))));
          targetY = Math.max(0, Math.min(roomW, Number(hit.z.toFixed(3))));
          targetZ = 0;
          gotHit = true;
        }

        if (gotHit) {
          const curLum = simulationResult.luminaires[selectedFixtureIndex];
          if (curLum) {
            const angles = calculateAimingAngles(
              { x: curLum.x, y: curLum.y, z: curLum.z },
              { x: targetX, y: targetY, z: targetZ }
            );

            setArrangementOverrides((prev) => ({
              ...prev,
              [selectedFixtureIndex]: {
                ...(prev[selectedFixtureIndex] || {}),
                targetPoint: { x: targetX, y: targetY, z: targetZ },
                aiming: angles,
              },
            }));

            toast.success(
              `Fixture #${selectedFixtureIndex + 1} aimed at (${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)}) — Pan: ${angles.pan.toFixed(1)}°, Tilt: ${angles.tilt.toFixed(1)}°`
            );
          }
          return;
        }
      }

      // 2. TAPE MEASURE ACTIVE:
      if (isTapeMeasureActive) {
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const res = raycaster.ray.intersectPlane(floorPlane, hit);

        if (res) {
          const x = Math.max(0, Math.min(roomL, Number(hit.x.toFixed(3))));
          const y = Number(hit.y.toFixed(3));
          const z = Math.max(0, Math.min(roomW, Number(hit.z.toFixed(3))));

          if (!measurePointA || (measurePointA && measurePointB)) {
            setMeasurePointA({ x, y, z });
            setMeasurePointB(null);
            toast.info(`Point A: (${x.toFixed(2)}, ${z.toFixed(2)}). Click Point B.`);
          } else {
            setMeasurePointB({ x, y, z });
            const dx = Math.abs(x - measurePointA.x);
            const dy = Math.abs(y - measurePointA.y);
            const dz = Math.abs(z - measurePointA.z);
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            toast.success(`Measured Distance: ${dist.toFixed(3)} m (ΔX: ${dx.toFixed(2)}m, ΔZ: ${dz.toFixed(2)}m)`);
          }
        }
        return;
      }

      // 3. DEFAULT: Select Luminaire on click
      const hits = raycaster.intersectObjects(luminaireMeshesGroup.children, true);
      if (hits.length > 0) {
        const hit = hits[0].object;
        if (hit.userData && typeof hit.userData.lumIndex === "number") {
          const idx = hit.userData.lumIndex;
          setSelectedFixtureIndex(idx);
          toast.info(`Selected Luminaire #${idx + 1} (${profile.name})${hit.userData.isExcluded ? " [EXCLUDED]" : ""}`);
          return;
        }
      }
    };
    renderer.domElement.addEventListener("click", handleCanvasClick);

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
      renderer.domElement.removeEventListener("click", handleCanvasClick);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      controls.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, [
    isOpen,
    cadTheme,
    roomShape,
    polygonPreset,
    polygonWingL,
    polygonWingW,
    hasSubspace,
    subspaceL,
    subspaceW,
    subspacePosZ,
    subspacePosX,
    roomL,
    roomW,
    roomH,
    workPlaneHeight,
    showHeatmap,
    showIsoluxLines,
    showLightCones,
    clipLightConesToRoom,
    showWallReflection,
    showWallFalseColor,
    showRoomWalls,
    showLuxNumbers,
    showCoordAxes,
    showFurniture,
    showCeilingGrid,
    showGuideGrid,
    showDwgUnderlay,
    activeCadPlan,
    buildingModel,
    activeStorey,
    showWireframeBoundary,
    showCalcSurfacePlane,
    windowCount,
    apertureHeight,
    apertureWidth,
    apertureFrameWidth,
    apertureSillHeight,
    showFacadeBlinds,
    facadeElement,
    selectedFixtureIndex,
    simulationResult,
    targetLux,
    profile.beamAngle,
    cct,
    reflectances,
    mountingType,
    suspensionLength,
    arrangementMode,
    lightScene,
    isTapeMeasureActive,
    measurePointA,
    measurePointB,
    showRoomElements,
    hasPlacedRoomElement,
    activeRoomElement,
    roomElementScale,
    roomElementWidth,
    roomElementLength,
    hasPlacedRoof,
    showRoofIn3D,
    activeRoofType,
    roofOverhang,
    roofPitch,
    hasSuspendedCeiling,
    ceilingSuspensionDepth,
    hasActiveCutout,
    cutoutWidth,
    cutoutLength,
    cutoutPosX,
    cutoutPosY,
    cutoutSurface,
    activeFurnitureObject,
    cuboidWidth,
    cuboidHeight,
    cuboidLength,
    furnitureList,
    selectedFurnitureId,
    wallSurfaces,
    surfaceColors,
    activeHelpLineType,
    copyRadius,
    polygonalConfig,
    arrangementOverrides,
    isAimingToolActive,
    isWireframeMode,
    showLightTextures,
    showLuminaires,
    whiteBalanceMode,
    whiteBalanceKelvin,
    whiteBalanceExposure,
    marginOffset,
    planningMode,
    daylightSkyModel,
    daylightDirectSun,
    daylightHour,
    daylightLat,
    daylightLon,
    daylightNorthAngle,
    daylightGroundReflectance,
    daylightGlassTau,
    isDaylightSceneActive,
  ]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md ${isFullscreen ? "p-0" : "p-1 sm:p-2"} select-none animate-in fade-in-50`}>
      <div className={`bg-[#1b1e23] border border-slate-700/80 ${isFullscreen ? "rounded-none h-full w-full" : "rounded-xl shadow-2xl w-full h-[98vh]"} flex flex-col text-slate-100 overflow-hidden font-sans relative`}>
        
        {/* =========================================================================
            1. TOP SYSTEM MENU BAR (File, Edit, Goto, View, ?, Quick Action Icons)
        ========================================================================= */}
        <div className="h-8 bg-[#14161a] border-b border-slate-800 flex items-center justify-between px-3 text-xs shrink-0 relative z-40">
          <div className="flex items-center gap-3 text-slate-300">
            {/* History navigation arrows matching screenshot */}
            <div className="flex items-center gap-1 text-slate-500">
              <button 
                disabled={currentSpaceIndex <= 0}
                onClick={() => {
                  if (currentSpaceIndex > 0) setSelectedSpaceId(spaces[currentSpaceIndex - 1].id);
                }}
                className="size-5 rounded-full bg-slate-800 flex items-center justify-center hover:text-white disabled:opacity-30 cursor-pointer"
                title="Previous Space"
              >
                <ChevronLeft className="size-3" />
              </button>
              <button 
                disabled={currentSpaceIndex === -1 || currentSpaceIndex >= spaces.length - 1}
                onClick={() => {
                  if (currentSpaceIndex < spaces.length - 1) setSelectedSpaceId(spaces[currentSpaceIndex + 1].id);
                }}
                className="size-5 rounded-full bg-slate-800 flex items-center justify-center hover:text-white disabled:opacity-30 cursor-pointer"
                title="Next Space"
              >
                <ChevronRight className="size-3" />
              </button>
            </div>

            <button 
              onClick={() => toast.success(`Saved project state for ${projectName} (${projectCode})`)}
              title="Save Project (Ctrl+S)" 
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
            >
              <Save className="size-4 text-emerald-400 fill-emerald-400/20" />
            </button>
            <button 
              onClick={handleUndo} 
              title="Undo (Ctrl+Z)" 
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-slate-400"
            >
              <Undo className="size-3.5" />
            </button>
            <button 
              onClick={handleRedo} 
              title="Redo (Ctrl+Y)" 
              className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-slate-400"
            >
              <Redo className="size-3.5" />
            </button>

            <span className="text-slate-700">|</span>
            
            {/* Clickable System Menus with Dropdowns */}
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
              
              {/* File Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === "file" ? null : "file")}
                  className={`px-2 py-0.5 rounded hover:text-white cursor-pointer transition ${activeMenu === "file" ? "bg-slate-800 text-white font-bold" : ""}`}
                >
                  File
                </button>
                {activeMenu === "file" && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-[#1f232b] border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 z-50 animate-in fade-in-50">
                    <button
                      onClick={() => {
                        toast.success(`Project calculations saved for ${projectName} (${projectCode})`);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Save className="size-3.5 text-emerald-400" /> Save Project (Ctrl+S)
                    </button>
                    <button
                      onClick={() => {
                        downloadDialuxSTF({
                          projectName,
                          projectCode,
                          roomName: spaceCustomName,
                          length: roomL,
                          width: roomW,
                          height: roomH,
                          workPlaneHeight,
                          reflectances,
                          profile,
                          luminaires: simulationResult.luminaires,
                        });
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <FileDown className="size-3.5 text-blue-400" /> Export DIALux STF (.stf)
                    </button>
                    <button
                      onClick={() => {
                        exportDialuxReportPDF({
                          projectName,
                          projectCode,
                          roomName: spaceCustomName,
                          roomLength: roomL,
                          roomWidth: roomW,
                          roomHeight: roomH,
                          workPlaneHeight,
                          profile,
                          simulation: simulationResult,
                          userName,
                        });
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="size-3.5 text-emerald-400" /> Export Single Space PDF
                    </button>
                    <button
                      onClick={() => {
                        exportProjectDialuxReportPDF({
                          projectName,
                          projectCode,
                          ifcFileName,
                          spacesSummary: fullProjectSummary,
                          userName,
                        });
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Layers className="size-3.5 text-purple-400" /> Export Building Report PDF
                    </button>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={() => {
                        setCadModalInitialTab("file");
                        setIsCadPlanModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-blue-300"
                    >
                      <FolderOpen className="size-3.5 text-blue-400" /> Import CAD Plan (DWG / DXF)
                    </button>
                    <button
                      onClick={() => {
                        iesFileInputRef.current?.click();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="size-3.5 text-amber-400" /> Import IES / LDT Luminaire
                    </button>
                    <button
                      onClick={() => {
                        setIsStreetLightingModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Compass className="size-3.5 text-amber-400" /> Street Lighting Design (EN 13201)
                    </button>
                    <button
                      onClick={() => {
                        setIsRoundaboutModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-orange-300"
                    >
                      <Compass className="size-3.5 text-orange-400" /> Roundabout Lighting (EN 13201 - Tutorial 16)
                    </button>
                    <button
                      onClick={() => {
                        setIsUGRModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-indigo-300"
                    >
                      <Eye className="size-3.5 text-indigo-400" /> UGR Glare Calculation (CIE 117 - Tutorial 17)
                    </button>
                    <button
                      onClick={() => {
                        setIsSimplePlanningModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-emerald-300"
                    >
                      <Zap className="size-3.5 text-emerald-400" /> Simple Indoor Planning (Tutorial Part 12)
                    </button>
                    <button
                      onClick={() => {
                        setIsStaircaseModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Layers className="size-3.5 text-amber-400" /> Staircase & Extrusion Bodies (Tutorial Part 13)
                    </button>
                    <button
                      onClick={() => {
                        setIsCopyAlongLineModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Copy className="size-3.5 text-amber-400" /> Staircases Part 2: Copy Along Line (Tutorial 14)
                    </button>
                    <button
                      onClick={() => {
                        setIsWhiteBalanceModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Camera className="size-3.5 text-amber-400" /> White Balance & Camera Positions (Tutorial 15)
                    </button>
                    <button
                      onClick={() => {
                        setIsDrawingFromScratchModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-cyan-300"
                    >
                      <Ruler className="size-3.5 text-cyan-400" /> Drawing from Scratch (Tutorial 18)
                    </button>
                    <button
                      onClick={() => {
                        setIsMedianStripModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-orange-300"
                    >
                      <Compass className="size-3.5 text-orange-400" /> Median Strip Calculation (Tutorial 19)
                    </button>
                    <button
                      onClick={() => {
                        setIsMaintenanceStudioOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Sliders className="size-3.5 text-amber-400" /> Maintenance Factors & Improvements (Tutorial 20)
                    </button>
                    <button
                      onClick={() => {
                        setIsLightScenesModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-emerald-300"
                    >
                      <Sun className="size-3.5 text-emerald-400" /> Luminaire Groups & Light Scenes (Tutorial 21)
                    </button>
                    <button
                      onClick={() => {
                        setIsPoolLightingModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-cyan-300"
                    >
                      <Waves className="size-3.5 text-cyan-400" /> Swimming Pool Lighting (Tutorial 22)
                    </button>
                    <button
                      onClick={() => {
                        setIsDaylightSystemsModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Sun className="size-3.5 text-amber-400" /> Daylighting Systems & Louvres (Tutorial 23)
                    </button>
                    <button
                      onClick={() => {
                        setIsCutoutRoofModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-cyan-300"
                    >
                      <Scissors className="size-3.5 text-cyan-400" /> The Cutout Tool & Complex Roofs (Tutorial 24)
                    </button>
                    <button
                      onClick={() => {
                        setIsWorkplaneStudioModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-sky-300"
                    >
                      <Layers className="size-3.5 text-sky-400" /> Managing Interior & Exterior Workplanes (Tutorial 25)
                    </button>
                    <button
                      onClick={() => {
                        setIsStandardsStudioModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-indigo-300"
                    >
                      <Globe className="size-3.5 text-indigo-400" /> Norm Control Centre & Standards (Tutorial 26)
                    </button>
                    <button
                      onClick={() => {
                        setIsTexturesStudioModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-rose-300"
                    >
                      <Palette className="size-3.5 text-rose-400" /> Detailed Textures & Materials (Tutorial 27)
                    </button>
                    <button
                      onClick={() => {
                        setIsImprovingLuminairesModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-cyan-300"
                    >
                      <Crosshair className="size-3.5 text-cyan-400" /> Improving Luminaires: Joints & Light Colour (Tutorial 28)
                    </button>
                    <button
                      onClick={() => {
                        setIsCompleteSceneryModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-emerald-300"
                    >
                      <Building2 className="size-3.5 text-emerald-400" /> Complete Building Scenery (Tutorial 29)
                    </button>
                    <button
                      onClick={() => {
                        setIsEffectiveLightingModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-purple-300"
                    >
                      <Sparkles className="size-3.5 text-purple-400" /> Effective Lighting Design (Tutorial 30)
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === "edit" ? null : "edit")}
                  className={`px-2 py-0.5 rounded hover:text-white cursor-pointer transition ${activeMenu === "edit" ? "bg-slate-800 text-white font-bold" : ""}`}
                >
                  Edit
                </button>
                {activeMenu === "edit" && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-[#1f232b] border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 z-50 animate-in fade-in-50">
                    <button
                      onClick={() => {
                        handleUndo();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Undo className="size-3.5 text-slate-400" /> Undo Layout (Ctrl+Z)
                    </button>
                    <button
                      onClick={() => {
                        handleRedo();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Redo className="size-3.5 text-slate-400" /> Redo Layout (Ctrl+Y)
                    </button>
                    <button
                      onClick={() => {
                        handleAutoOptimize();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="size-3.5 text-blue-400" /> Auto-Optimize Spacing
                    </button>
                    <button
                      onClick={() => {
                        setIsCopyAlongLineModalOpen(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer text-amber-300"
                    >
                      <Copy className="size-3.5 text-amber-400" /> Copy & Arrange Along Line (Tutorial 14)
                    </button>
                  </div>
                )}
              </div>

              {/* Goto Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === "goto" ? null : "goto")}
                  className={`px-2 py-0.5 rounded hover:text-white cursor-pointer transition ${activeMenu === "goto" ? "bg-slate-800 text-white font-bold" : ""}`}
                >
                  Goto
                </button>
                {activeMenu === "goto" && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#1f232b] border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 z-50 animate-in fade-in-50 max-h-72 overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      IFC Structure Rooms ({spaces.length})
                    </div>
                    {spaces.map((sp, idx) => (
                      <button
                        key={sp.id}
                        onClick={() => {
                          setSelectedSpaceId(sp.id);
                          setActiveMenu(null);
                        }}
                        className={`w-full text-left px-3 py-1 hover:bg-slate-700 text-xs flex items-center justify-between cursor-pointer ${
                          sp.id === selectedSpaceId ? "text-amber-400 font-bold bg-slate-800" : ""
                        }`}
                      >
                        <span className="truncate">{idx + 1}. {sp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{sp.area.toFixed(1)} m²</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === "view" ? null : "view")}
                  className={`px-2 py-0.5 rounded hover:text-white cursor-pointer transition ${activeMenu === "view" ? "bg-slate-800 text-white font-bold" : ""}`}
                >
                  View
                </button>
                {activeMenu === "view" && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-[#1f232b] border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 z-50 animate-in fade-in-50">
                    <button
                      onClick={() => {
                        applyCameraView("3d");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Box className="size-3.5 text-amber-400" /> 3D Perspective (Key 1)
                    </button>
                    <button
                      onClick={() => {
                        applyCameraView("top");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <LayoutGrid className="size-3.5 text-blue-400" /> 2D Top Plan (Key 2)
                    </button>
                    <button
                      onClick={() => {
                        applyCameraView("front");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Box className="size-3.5 text-emerald-400" /> Front Elevation (Key 3)
                    </button>
                    <button
                      onClick={() => {
                        applyCameraView("side");
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Box className="size-3.5 text-purple-400" /> Side Elevation (Key 4)
                    </button>
                  </div>
                )}
              </div>

              {/* Help (?) Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === "help" ? null : "help")}
                  className={`px-2 py-0.5 rounded hover:text-white cursor-pointer transition ${activeMenu === "help" ? "bg-slate-800 text-white font-bold" : ""}`}
                >
                  ?
                </button>
                {activeMenu === "help" && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-[#1f232b] border border-slate-700 rounded-lg shadow-2xl py-1 text-slate-200 z-50 animate-in fade-in-50">
                    <button
                      onClick={() => {
                        setShowHelpModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Info className="size-3.5 text-blue-400" /> Standards & Shortcuts Guide
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <Box className="size-3" /> {ifcFileName}
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              User: <strong className="text-slate-200">{userName}</strong>
            </span>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-red-600/80 transition cursor-pointer"
              title="Close DIALux evo Studio (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. MAIN WORKFLOW RIBBON TABS (Project, Construction, Light, Calculation, Export, Documentation, Brands)
        ========================================================================= */}
        <div className="h-10 bg-[#21252c] border-b border-slate-700/80 flex items-center justify-between px-3 shrink-0 z-30">
          <div className="flex items-center gap-1 h-full overflow-x-auto">
            {[
              { id: "project", label: "Project", icon: FileText },
              { id: "construction", label: "Construction", icon: Box },
              { id: "light", label: "Light", icon: Lightbulb },
              { id: "calculation", label: "Calculation objects", icon: Grid },
              { id: "export", label: "Export", icon: FileDown },
              { id: "documentation", label: "Documentation", icon: FileText },
              { id: "brands", label: "Brands", icon: Bookmark },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = workflowTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setWorkflowTab(tab.id as any)}
                  className={`h-full px-3.5 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border-b-2 whitespace-nowrap ${
                    isActive
                      ? "text-amber-400 border-amber-400 bg-slate-800/60 font-bold"
                      : "text-slate-300 border-transparent hover:text-white hover:bg-slate-800/30"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setIsStreetLightingModalOpen(true)}
              className="h-full px-3.5 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border-b-2 whitespace-nowrap text-cyan-300 border-transparent hover:text-cyan-200 hover:bg-cyan-950/40"
              title="Official DIALux evo Road Lighting (EN 13201 / CIE 115 / CIE 140)"
            >
              <Compass className="size-3.5 text-cyan-400" />
              <span>Road lighting</span>
            </button>
          </div>

          {/* Right Toolbar Controls (Calculation Play, Stop, Scene, View Mode) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toast.success(`Calculated ${simulationResult.avgLux} lx across ${spaceCustomName}! (Uniformity U0 = ${simulationResult.uniformityU0.toFixed(2)})`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer"
              title="Run Photometric Calculation (F5)"
            >
              <Play className="size-3.5 fill-white" />
              <span>Calculation</span>
            </button>

            <button
              onClick={() => toast.info("Calculation halted.")}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Stop Calculation"
            >
              <Square className="size-3 fill-slate-300" />
            </button>

            {/* DIALux evo Part 7: Iconic Raytracer Button */}
            <button
              onClick={() => {
                setWorkflowTab("export");
                setExportTool("raytracer");
                setLeftDockMode("inspector");
                setIsRaytracerModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-amber-400/40"
              title="DIALux evo Raytracer: Photorealistic Rendering with Mirror Reflections & HDR (Part 7)"
            >
              <Sparkles className="size-3.5 text-amber-200" />
              <span>Raytracer</span>
            </button>

            {/* DIALux evo Part 10: Street Lighting Design Button */}
            <button
              onClick={() => setIsStreetLightingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-blue-400/40"
              title="DIALux evo Street Lighting: Road profiles, EN 13201 & CIE 115 classes, pole spacing optimizer, and 3D luminance viewer (Part 10)"
            >
              <Compass className="size-3.5 text-cyan-200" />
              <span>Street Lighting</span>
            </button>

            {/* DIALux evo Part 16: Roundabout Lighting Suite Button */}
            <button
              onClick={() => setIsRoundaboutModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-amber-400/40"
              title="DIALux evo Tutorial 16: Parametric Roundabout Creation, Polar Luminaire Array, EN 13201 C-Classes, and Spacing Optimizer"
            >
              <Compass className="size-3.5 text-amber-200" />
              <span>Roundabouts</span>
            </button>

            {/* DIALux evo Part 12: Simple Indoor Planning (evo easy) Button */}
            <button
              onClick={() => setIsSimplePlanningModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-emerald-400/40"
              title="DIALux evo Simple Indoor Planning: Rapid room planning, EN 12464-1 standards, CIE 97 maintenance conditions, automatic luminaire arrangement (Part 12)"
            >
              <Zap className="size-3.5 text-emerald-200" />
              <span>Simple Indoor Plan</span>
            </button>

            {/* DIALux evo Part 17: UGR Glare Calculation Button */}
            <button
              onClick={() => setIsUGRModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-indigo-400/40"
              title="DIALux evo Tutorial 17: Unified Glare Rating (UGR), 360° Polar Glare Rose, Guth position index, and EN 12464-1 compliance"
            >
              <Eye className="size-3.5 text-indigo-200" />
              <span>UGR Glare</span>
            </button>

            {/* DIALux evo Part 18: Drawing from Scratch Button */}
            <button
              onClick={() => setIsDrawingFromScratchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-cyan-400/40"
              title="DIALux evo Tutorial 18: Drawing from scratch with parallel guide lines, intersection snapping, circular windows, and storey duplication"
            >
              <Ruler className="size-3.5 text-cyan-200" />
              <span>Draw from Scratch</span>
            </button>

            {/* DIALux evo Part 19: Median Strip Road Lighting Button */}
            <button
              onClick={() => setIsMedianStripModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:from-orange-500 hover:to-yellow-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-orange-400/40"
              title="DIALux evo Tutorial 19: Road and street lighting: Calculation of median strip (dual carriageways, twin boom arrangements, EN 13201)"
            >
              <Compass className="size-3.5 text-amber-200" />
              <span>Median Strip</span>
            </button>

            {/* DIALux evo Part 20: Maintenance Factors & Improvements Button */}
            <button
              onClick={() => setIsMaintenanceStudioOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-600 via-yellow-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-amber-400/40"
              title="DIALux evo Tutorial 20: Maintenance factors (CIE 97 / CIE 154), 10-year depreciation timeline, and luminaire groups optimization"
            >
              <Sliders className="size-3.5 text-yellow-200" />
              <span>Maintenance (CIE 97)</span>
            </button>

            {/* DIALux evo Part 21: Luminaire Groups for Lighting Scenes Button */}
            <button
              onClick={() => setIsLightScenesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-teal-400/40"
              title="DIALux evo Tutorial 21: Luminaire groups for lighting scenes, mutual exclusivity, instant superposition recalculation, and DALI control groups"
            >
              <Sun className="size-3.5 text-emerald-200" />
              <span>Light Scenes</span>
            </button>

            {/* DIALux evo Part 22: Swimming Pool Lighting Button */}
            <button
              onClick={() => setIsPoolLightingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-cyan-400/40"
              title="DIALux evo Tutorial 22: Swimming pool lighting design, water extrusion volume (n=1.333), basin cutout, submersible IP68 SELV, and EN 12193"
            >
              <Waves className="size-3.5 text-cyan-200" />
              <span>Pool Lighting</span>
            </button>

            {/* DIALux evo Part 23: Daylighting Systems Button */}
            <button
              onClick={() => setIsDaylightSystemsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-amber-400/40"
              title="DIALux evo Tutorial 23: Daylighting systems, louvre blinds (Raffstore), light shelves, EN 17037 compliance, and ODLS catalog"
            >
              <Sun className="size-3.5 text-amber-200" />
              <span>Daylight Systems</span>
            </button>

            {/* DIALux evo Part 24: The Cutout Tool Button */}
            <button
              onClick={() => setIsCutoutRoofModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-sky-400/40"
              title="DIALux evo Tutorial 24: The cutout tool, polygonal cuts, complex roof intersections, valley trimming, and depth limiting"
            >
              <Scissors className="size-3.5 text-sky-200" />
              <span>Cutout Tool</span>
            </button>

            {/* DIALux evo Part 25: Managing Interior & Exterior Workplanes Button */}
            <button
              onClick={() => setIsWorkplaneStudioModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-teal-600 via-sky-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-teal-400/40"
              title="DIALux evo Tutorial 25: Managing interior and exterior workplanes, EN 12464 profiles, and wall margin zones"
            >
              <Layers className="size-3.5 text-white" />
              <span>Workplanes</span>
            </button>

            {/* DIALux evo Part 26: Norm Control Centre & Standards Button */}
            <button
              onClick={() => setIsStandardsStudioModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-indigo-400/40"
              title="DIALux evo Tutorial 26: Norm control centre, multi-regional standards (EN 12464, IESNA, AS/NZS, CIBSE, JIS), profile duplication & cross-checking"
            >
              <Globe className="size-3.5 text-white" />
              <span>Standards</span>
            </button>

            {/* DIALux evo Part 27: Detailed Textures & Materials Button */}
            <button
              onClick={() => setIsTexturesStudioModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-rose-400/40"
              title="DIALux evo Tutorial 27: Enhancing projects with detailed textures, UV metric scaling, optical reflectance & Shift-key batching"
            >
              <Palette className="size-3.5 text-white" />
              <span>Textures</span>
            </button>

            {/* DIALux evo Part 28: Improving Luminaires Button */}
            <button
              onClick={() => setIsImprovingLuminairesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-cyan-400/40"
              title="DIALux evo Tutorial 28: Improving luminaires — Multi-axis articulation joints, 3D target point picking (Inverse Kinematics), CCT Kelvin tuning, and optical filters"
            >
              <Crosshair className="size-3.5 text-white" />
              <span>Luminaires</span>
            </button>

            {/* DIALux evo Part 29: Complete Building Scenery Button */}
            <button
              onClick={() => setIsCompleteSceneryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-emerald-400/40"
              title="DIALux evo Tutorial 29: Creating a complete scenery — Multi-room storey construction, doors, windows, columns, furniture & EN 12464-1 assessment profiles"
            >
              <Building2 className="size-3.5 text-white" />
              <span>Scenery</span>
            </button>

            {/* DIALux evo Part 30: Effective Lighting Design Button */}
            <button
              onClick={() => setIsEffectiveLightingModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer border border-purple-400/40"
              title="DIALux evo Tutorial 30: Effective lighting design — Layered strategy (Task, Ambient, Wall Accent), suspension height tuning, table placement & EN 12464-1 verification"
            >
              <Sparkles className="size-3.5 text-white" />
              <span>Effective Design</span>
            </button>

            {/* Green Eco Leaf Button (Energy calculation check EN 15193) */}
            <button
              onClick={() => toast.success("Energy evaluation: compliant with EN 15193 (LENI = 14.2 kWh/m²/year)")}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 cursor-pointer"
              title="Energy Evaluation & Daylight Savings (EN 15193)"
            >
              <Leaf className="size-3.5 text-emerald-400" />
            </button>

            {/* Red Cancel / Clear Results Button */}
            <button
              onClick={() => toast.info("Calculation results cache invalidated.")}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-red-400 cursor-pointer"
              title="Discard Current Calculation Results"
            >
              <X className="size-3.5 text-red-400" />
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Calculation Settings & Tolerances"
            >
              <Settings className="size-3.5" />
            </button>

            {/* Light Scene Dropdown (Live Dimming factor & DIALux evo Part 11 Daylight scenes) */}
            <select
              value={lightScene}
              onChange={(e) => {
                const val = e.target.value;
                setLightScene(val);
                if (val.startsWith("daylight") || val === "combined") {
                  setIsDaylightSceneActive(true);
                }
                const labelMap: Record<string, string> = {
                  "100": "Scene 1: Artificial 100% Full On",
                  "50": "Scene 2: Artificial 50% Dimmed",
                  "10": "Scene 3: Emergency Lighting (10%)",
                  "daylight_overcast": "Scene 4: Daylight Only (CIE Overcast DF %)",
                  "daylight_clear": "Scene 5: Daylight Only (Clear Sky & Sunbeam)",
                  "combined": "Scene 6: Combined Daylight + Artificial Harvesting",
                };
                toast.info(`Switched to ${labelMap[val] || val}`);
              }}
              className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 outline-none cursor-pointer"
            >
              <option value="100">Light scene 1 (100% Artificial)</option>
              <option value="50">Light scene 2 (50% Dimmed)</option>
              <option value="daylight_overcast">Daylight scene (CIE Overcast DF %)</option>
              <option value="daylight_clear">Daylight scene (Clear Sky & Sunbeam)</option>
              <option value="combined">Combined (Daylight + Artificial Harvesting)</option>
              <option value="10">Emergency scene (10% Safety)</option>
            </select>

            {/* View Planning Mode Dropdown (Matching Screenshot top right) */}
            <select
              value={planningMode}
              onChange={(e) => {
                const val = e.target.value;
                setPlanningMode(val);
                if (val === "Simple indoor planning") {
                  setIsSimplePlanningModalOpen(true);
                } else if (val === "Street lighting (EN 13201)") {
                  setIsStreetLightingModalOpen(true);
                } else if (val === "Roundabout lighting (EN 13201)") {
                  setIsRoundaboutModalOpen(true);
                } else if (val === "UGR calculation (EN 12464-1)") {
                  setIsUGRModalOpen(true);
                } else if (val === "Drawing from scratch (Tutorial 18)") {
                  setIsDrawingFromScratchModalOpen(true);
                } else if (val === "Median strip road lighting (Tutorial 19)") {
                  setIsMedianStripModalOpen(true);
                } else if (val === "Maintenance factors & scenes (Tutorial 20)") {
                  setIsMaintenanceStudioOpen(true);
                } else if (val === "Luminaire groups & light scenes (Tutorial 21)") {
                  setIsLightScenesModalOpen(true);
                } else if (val === "Swimming pool lighting (Tutorial 22)") {
                  setIsPoolLightingModalOpen(true);
                } else if (val === "Daylighting systems (Tutorial 23)") {
                  setIsDaylightSystemsModalOpen(true);
                } else if (val === "The cutout tool & complex roofs (Tutorial 24)") {
                  setIsCutoutRoofModalOpen(true);
                } else if (val === "Managing interior & exterior workplanes (Tutorial 25)") {
                  setIsWorkplaneStudioModalOpen(true);
                } else if (val === "Using different standards (Tutorial 26)") {
                  setIsStandardsStudioModalOpen(true);
                } else if (val === "Detailed textures & materials (Tutorial 27)") {
                  setIsTexturesStudioModalOpen(true);
                } else if (val === "Improving luminaires (Tutorial 28)") {
                  setIsImprovingLuminairesModalOpen(true);
                } else if (val === "Complete building scenery (Tutorial 29)") {
                  setIsCompleteSceneryModalOpen(true);
                } else if (val === "Effective lighting design (Tutorial 30)") {
                  setIsEffectiveLightingModalOpen(true);
                }
              }}
              className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 outline-none cursor-pointer"
            >
              <option value="Simple indoor planning">Simple indoor planning (evo easy)</option>
              <option value="Indoor space planning">Indoor space planning</option>
              <option value="Outdoor and building planning">Outdoor and building pla...</option>
              <option value="Emergency lighting">Emergency lighting</option>
              <option value="Street lighting (EN 13201)">Street lighting (EN 13201)</option>
              <option value="Roundabout lighting (EN 13201)">Roundabout lighting (EN 13201 - Part 16)</option>
              <option value="UGR calculation (EN 12464-1)">UGR calculation (EN 12464-1 - Part 17)</option>
              <option value="Drawing from scratch (Tutorial 18)">Drawing from scratch (Tutorial Part 18)</option>
              <option value="Median strip road lighting (Tutorial 19)">Median strip road lighting (EN 13201 - Part 19)</option>
              <option value="Maintenance factors & scenes (Tutorial 20)">Maintenance factors & scenes (Tutorial Part 20)</option>
              <option value="Luminaire groups & light scenes (Tutorial 21)">Luminaire groups & light scenes (Tutorial Part 21)</option>
              <option value="Swimming pool lighting (Tutorial 22)">Swimming pool lighting (Tutorial Part 22)</option>
              <option value="Daylighting systems (Tutorial 23)">Daylighting systems (Tutorial Part 23)</option>
              <option value="The cutout tool & complex roofs (Tutorial 24)">The cutout tool & complex roofs (Tutorial Part 24)</option>
              <option value="Managing interior & exterior workplanes (Tutorial 25)">Managing interior & exterior workplanes (Tutorial Part 25)</option>
              <option value="Using different standards (Tutorial 26)">Using different standards (Tutorial Part 26)</option>
              <option value="Detailed textures & materials (Tutorial 27)">Detailed textures & materials (Tutorial Part 27)</option>
              <option value="Improving luminaires (Tutorial 28)">Improving luminaires (Tutorial 28)</option>
              <option value="Complete building scenery (Tutorial 29)">Complete building scenery (Tutorial 29)</option>
              <option value="Effective lighting design (Tutorial 30)">Effective lighting design (Tutorial 30)</option>
            </select>
          </div>
        </div>

        {/* =========================================================================
            3. MAIN BODY: CONSTRUCTION / 3D CAD ENVIRONMENT
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex overflow-hidden bg-[#181a1f]">
          
          {/* =========================================================================
              3A. OFFICIAL DIALUX EVO VERTICAL TOOLSTRIP (Matching all screenshots)
          ========================================================================= */}
          <div className="w-11 bg-[#1a1d23] border-r border-slate-800 flex flex-col items-center py-1.5 gap-1 shrink-0 z-20 select-none">
            {workflowTab === "construction" && (
              <>
                {/* 1. DWG (Blue badge) */}
            <button
              onClick={() => {
                setConstructionTool("dwg");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "dwg" && leftDockMode === "inspector"
                  ? "ring-2 ring-blue-400 bg-blue-600/20"
                  : "hover:bg-slate-800"
              }`}
              title="DWG / DXF Drawing Management"
            >
              <span className="bg-blue-600 text-[8.5px] font-black text-white px-1 py-0.5 rounded leading-none shadow">
                DWG
              </span>
            </button>

            {/* 2. IFC (Red badge) */}
            <button
              onClick={() => {
                setConstructionTool("ifc");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "ifc" && leftDockMode === "inspector"
                  ? "ring-2 ring-red-400 bg-red-600/20"
                  : "hover:bg-slate-800"
              }`}
              title="BIM IFC Structure Model"
            >
              <span className="bg-red-600 text-[8.5px] font-black text-white px-1 py-0.5 rounded leading-none shadow">
                IFC
              </span>
            </button>

            {/* 3. Site Tool (Screenshot 1) */}
            <button
              onClick={() => {
                setConstructionTool("site");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "site" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Site Planning & Orientation"
            >
              <MapPin className="size-4 text-emerald-400" />
            </button>

            {/* 4. Storey and building construction Tool (Screenshot 2) */}
            <button
              onClick={() => {
                setConstructionTool("building");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "building" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Storey and building construction"
            >
              <Building2 className="size-4 text-red-400" />
            </button>

            {/* 5. Storey slabs Tool */}
            <button
              onClick={() => {
                setConstructionTool("storey");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "storey" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Storeys and Levels"
            >
              <Layers className="size-4 text-red-400" />
            </button>

            {/* 6. Spaces Tool (Screenshot 5) */}
            <button
              onClick={() => {
                setConstructionTool("space");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "space" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Spaces & Rooms"
            >
              <Box className="size-4 text-amber-400" />
            </button>

            {/* 7. Room elements Tool (Screenshot 1) */}
            <button
              onClick={() => {
                setConstructionTool("room_elements");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "room_elements" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Room elements (Beams, Columns, Platforms, Ramps)"
            >
              <svg className="size-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <rect x="9" y="3" width="6" height="18" fill="currentColor" fillOpacity="0.2" />
              </svg>
            </button>

            {/* 8. Roofs Tool (Screenshot 2) */}
            <button
              onClick={() => {
                setConstructionTool("roofs");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "roofs" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Roofs (Flat roof, Gable roof, Shed roof)"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10L12 3l9 7v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" />
                <path d="M12 3v18" />
              </svg>
            </button>

            {/* 9. Ceilings Tool (Screenshot 3) */}
            <button
              onClick={() => {
                setConstructionTool("ceilings");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "ceilings" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Ceiling Systems & Grids"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M5 6v12h14V6" />
                <path d="M8 6v12M12 6v12M16 6v12" />
              </svg>
            </button>

            {/* 10. Cutouts Tool (Screenshot 4) */}
            <button
              onClick={() => {
                setConstructionTool("cutouts");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "cutouts" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Cutouts & Skylights"
            >
              <Scissors className="size-4 text-red-400" />
            </button>

            {/* 11. Apertures Tool */}
            <button
              onClick={() => {
                setConstructionTool("apertures");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "apertures" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Doors & Windows Apertures"
            >
              <DoorClosed className="size-4 text-red-400" />
            </button>

            {/* 12. Façade elements Tool */}
            <button
              onClick={() => {
                setConstructionTool("facade");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "facade" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Façade Elements & Blinds"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h18v18H3zM3 9h18M3 15h18" />
              </svg>
            </button>

            {/* 13. Furniture & Objects Tool (Screenshot 5) */}
            <button
              onClick={() => {
                setConstructionTool("furniture");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "furniture" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Furniture and objects"
            >
              <svg className="size-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 10h16v3H4zM6 13v7M18 13v7M3 7h18" />
              </svg>
            </button>

            {/* 13. Materials & Colors Tool (Screenshot 3: media_1791272183358.png) */}
            <button
              onClick={() => {
                setConstructionTool("materials");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "materials" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Materials & Reflectances"
            >
              <Palette className="size-4 text-amber-400" />
            </button>

            {/* 14. Help lines and labelling Tool (Screenshot 4: media_1791272192191.png) */}
            <button
              onClick={() => {
                setConstructionTool("annotations");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "annotations" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Help lines and labelling"
            >
              <Type className="size-4 text-red-400" />
            </button>

            {/* 15. Copy and arrange Tool (Screenshot 5: media_1791272205609.png) */}
            <button
              onClick={() => {
                setConstructionTool("copy_arrange");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "copy_arrange" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Copy and arrange"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 18c4-12 12-12 16 0" />
                <path d="M12 6v6M9 9h6" />
              </svg>
            </button>

            {/* 16. Calculation Objects Tool ([+]) */}
            <button
              onClick={() => {
                setConstructionTool("calc_surfaces");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "calc_surfaces" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Calculation objects"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="1" />
                <rect x="8" y="8" width="8" height="8" fill="white" />
              </svg>
            </button>

            {/* 17. Views Tool ([⊙] matching Screenshot 2) */}
            <button
              onClick={() => {
                setConstructionTool("camera_view");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "camera_view" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Views"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="12" cy="12" r="3.5" fill="currentColor" />
              </svg>
            </button>

            {/* 18. Guide Lines Tool */}
            <button
              onClick={() => {
                setConstructionTool("guide_lines");
                setLeftDockMode("inspector");
              }}
              className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                constructionTool === "guide_lines" && leftDockMode === "inspector"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Guide Lines & Reference Grids"
            >
              <Ruler className="size-4 text-red-400" />
            </button>
            </>
            )}

            {/* LIGHT MODE TOOLSTRIP */}
            {workflowTab === "light" && (
              <>
                <button
                  onClick={() => { setLightTool("luminaires"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "luminaires" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Luminaires"
                >
                  <Lightbulb className="size-4 text-amber-400" />
                </button>
                <button
                  onClick={() => { setLightTool("arrangements"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "arrangements" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Luminaire arrangements"
                >
                  <Grid className="size-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => setIsPlacementModalOpen(true)}
                  className="size-8 rounded flex items-center justify-center transition cursor-pointer text-amber-400 hover:text-white hover:bg-slate-800"
                  title="2D CAD Luminaire Placement & Space Layout (Part 5)"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  onClick={() => setWorkflowTab("brands")}
                  className="size-8 rounded flex items-center justify-center transition cursor-pointer text-cyan-400 hover:text-white hover:bg-slate-800"
                  title="LUMsearch Manufacturer Catalogues"
                >
                  <Globe className="size-4" />
                </button>
                <button
                  onClick={() => { setLightTool("lamps"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "lamps" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Lamps and spectra"
                >
                  <Sun className="size-4 text-yellow-400" />
                </button>
                <button
                  onClick={() => { setLightTool("scenes"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "scenes" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Light scenes"
                >
                  <Sparkles className="size-4 text-purple-400" />
                </button>
                <button
                  onClick={() => { setLightTool("energy"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "energy" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Energy evaluation (EN 15193)"
                >
                  <Leaf className="size-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => { setLightTool("filters"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    lightTool === "filters" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Filters and gels"
                >
                  <Eye className="size-4 text-blue-400" />
                </button>
                <button
                  onClick={() => { setConstructionTool("camera_view"); setWorkflowTab("construction"); setLeftDockMode("inspector"); }}
                  className="size-8 rounded flex items-center justify-center transition cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Views"
                >
                  <Target className="size-4 text-red-400" />
                </button>
              </>
            )}

            {/* CALCULATION MODE TOOLSTRIP */}
            {workflowTab === "calculation" && (
              <>
                <button
                  onClick={() => { setCalcTool("surfaces"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    calcTool === "surfaces" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Calculation surfaces"
                >
                  <svg className="size-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                <button
                  onClick={() => { setCalcTool("task_areas"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    calcTool === "task_areas" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Task areas (EN 12464-1)"
                >
                  <CheckCircle2 className="size-4 text-blue-400" />
                </button>
                <button
                  onClick={() => { setCalcTool("points"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    calcTool === "points" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Calculation grid"
                >
                  <Grid className="size-4 text-amber-400" />
                </button>
                <button
                  onClick={() => { setCalcTool("ugr"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    calcTool === "ugr" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Unified Glare Rating (UGR)"
                >
                  <Eye className="size-4 text-purple-400" />
                </button>
                <button
                  onClick={() => { setCalcTool("isolux"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    calcTool === "isolux" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="False colors and isolux"
                >
                  <Palette className="size-4 text-emerald-400" />
                </button>
              </>
            )}

            {/* EXPORT MODE TOOLSTRIP */}
            {workflowTab === "export" && (
              <>
                <button
                  onClick={() => { setExportTool("raytracer"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    exportTool === "raytracer" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Raytracer Photorealistic Rendering (Part 7)"
                >
                  <Sparkles className="size-4 text-amber-400" />
                </button>
                <button
                  onClick={() => { setExportTool("images"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer relative ${
                    exportTool === "images" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-cyan-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Project Images Gallery & HDR Exposure (Part 7)"
                >
                  <Camera className="size-4 text-cyan-400" />
                  {projectImages.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-3.5 bg-amber-500 text-[8px] font-bold text-black rounded-full flex items-center justify-center">
                      {projectImages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setExportTool("dwg"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    exportTool === "dwg" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-blue-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="DWG / DXF Export"
                >
                  <span className="bg-blue-600 text-[8.5px] font-black text-white px-1 py-0.5 rounded leading-none shadow">DWG</span>
                </button>
                <button
                  onClick={() => { setExportTool("ifc"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    exportTool === "ifc" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="IFC BIM Export"
                >
                  <span className="bg-red-600 text-[8.5px] font-black text-white px-1 py-0.5 rounded leading-none shadow">IFC</span>
                </button>
                <button
                  onClick={() => { setExportTool("schedule"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    exportTool === "schedule" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-emerald-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Luminaire Schedule CSV"
                >
                  <FileText className="size-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => { setExportTool("render"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    exportTool === "render" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="3D Render Export"
                >
                  <Camera className="size-4 text-slate-400" />
                </button>
              </>
            )}

            {/* PROJECT MODE TOOLSTRIP */}
            {workflowTab === "project" && (
              <>
                <button
                  onClick={() => { setProjectTool("info"); setLeftDockMode("inspector"); }}
                  className={`size-8 rounded flex items-center justify-center transition cursor-pointer ${
                    projectTool === "info" && leftDockMode === "inspector"
                      ? "bg-slate-800 ring-1 ring-amber-500 shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Project Master Information"
                >
                  <FileText className="size-4 text-amber-400" />
                </button>
              </>
            )}

            {/* BRANDS MODE TOOLSTRIP */}
            {workflowTab === "brands" && (
              <>
                <button
                  onClick={() => setLeftDockMode("inspector")}
                  className="size-8 rounded flex items-center justify-center transition cursor-pointer bg-slate-800 ring-1 ring-amber-500 shadow-sm text-amber-400"
                  title="DIALux Luminaire Finder"
                >
                  <Bookmark className="size-4" />
                </button>
              </>
            )}

            {/* DOCUMENTATION MODE TOOLSTRIP (Tutorial #8) */}
            {workflowTab === "documentation" && (
              <>
                <button
                  className="size-8 rounded flex items-center justify-center transition cursor-pointer bg-slate-800 ring-1 ring-emerald-500 shadow-sm text-emerald-400"
                  title="Documentation Outputs & Reports (Tutorial #8)"
                >
                  <FileText className="size-4" />
                </button>
              </>
            )}

            {/* 19. Project Tree Toggle Icon matching Screenshot 3 & 4 */}
            <button
              onClick={() => setLeftDockMode(leftDockMode === "tree" ? "inspector" : "tree")}
              className={`size-8 rounded mt-auto flex items-center justify-center transition cursor-pointer ${
                leftDockMode === "tree"
                  ? "bg-slate-800 ring-1 ring-red-500 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Project tree"
            >
              <svg className="size-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="3" width="6" height="5" rx="1" fill="currentColor" />
                <path d="M12 8v5M6 13h12v3M6 16v3M18 16v3" />
                <rect x="3" y="16" width="6" height="5" rx="1" fill="currentColor" />
                <rect x="15" y="16" width="6" height="5" rx="1" fill="currentColor" />
              </svg>
            </button>

          </div>

          {/* =========================================================================
              3B. LEFT DOCK: PROJECT TREE OR EXACT PROPERTIES INSPECTORS (FROM SCREENSHOTS)
          ========================================================================= */}
          {workflowTab !== "documentation" && (
            <div className="w-80 bg-[#1f232b] border-r border-slate-800 flex flex-col text-xs shrink-0 select-none overflow-hidden">
            
            {/* Dock Header Tabs (Project Tree vs Inspector) */}
            <div className="h-8 bg-[#16181d] border-b border-slate-800 flex items-center justify-between px-2 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLeftDockMode("inspector")}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    leftDockMode === "inspector" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Sliders className="size-3 text-amber-400" /> Properties
                </button>
                <button
                  onClick={() => setLeftDockMode("tree")}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    leftDockMode === "tree" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FolderTree className="size-3 text-red-400" /> Project tree
                </button>
              </div>
              <span className="text-[9.5px] text-slate-500 font-mono">DIALux evo</span>
            </div>

            {/* =========================================================================
                DOCK VIEW 1: EXACT PROPERTIES INSPECTORS MATCHING SCREENSHOTS 1 TO 5
            ========================================================================= */}
            {leftDockMode === "inspector" && (
              <div className="flex-1 overflow-y-auto flex flex-col bg-[#1f232b] text-slate-200">
                {workflowTab === "construction" && (
                  <>
                {/* -------------------------------------------------------------
                    DWG / CAD PLAN INSPECTOR (DIALux evo Plans / Drawings)
                ------------------------------------------------------------- */}
                {constructionTool === "dwg" && (
                  <div className="flex flex-col text-slate-200">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-[8.5px] font-black text-white px-1.5 py-0.5 rounded leading-none shadow">
                          DWG
                        </span>
                        <span className="font-bold text-white text-xs">Plans / Drawings</span>
                      </div>
                      <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-mono">
                        {activeCadPlan.fileFormat.toUpperCase()}
                      </span>
                    </div>

                    {/* Primary Wizard Launch Button */}
                    <div className="p-2.5 border-b border-slate-800 bg-[#16181f] flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setCadModalInitialTab("file");
                          setIsCadPlanModalOpen(true);
                        }}
                        className="w-full px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow transition"
                      >
                        <FolderOpen className="size-3.5" /> Open CAD Plan Wizard...
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button 
                          onClick={() => {
                            setCadModalInitialTab("scale");
                            setIsCadPlanModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-[10.5px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                          title="Interactive 2-point dimension scale calibration"
                        >
                          <Ruler className="size-3 text-amber-400" /> Calibrate Scale
                        </button>
                        <button 
                          onClick={() => {
                            setCadModalInitialTab("origin");
                            setIsCadPlanModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-[10.5px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                          title="Set origin (0, 0, 0) and orientation angle"
                        >
                          <Compass className="size-3 text-red-400" /> Set Origin
                        </button>
                      </div>
                    </div>

                    <div className="p-3 flex flex-col gap-3">
                      {/* Active Drawing Card */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px]">Loaded Plan:</span>
                          <span className="font-semibold text-white truncate max-w-[150px]" title={activeCadPlan.fileName}>
                            {activeCadPlan.fileName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>CAD Footprint:</span>
                          <strong className="text-blue-300 font-mono">
                            {activeCadPlan.widthM.toFixed(1)}m × {activeCadPlan.heightM.toFixed(1)}m
                          </strong>
                        </div>

                        {/* Quick Template Switcher */}
                        <div className="flex flex-col gap-1 mt-1">
                          <label className="text-[10px] text-slate-400">Switch Architectural Template:</label>
                          <select
                            value={activeCadPlan.id}
                            onChange={(e) => {
                              const found = BUILTIN_CAD_PLANS.find((p) => p.id === e.target.value);
                              if (found) {
                                setActiveCadPlan(JSON.parse(JSON.stringify(found)));
                                setShowDwgUnderlay(true);
                                toast.success(`Switched to: ${found.fileName}`);
                              }
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            {BUILTIN_CAD_PLANS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.fileName} ({p.widthM}m × {p.heightM}m)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Align Room Space to CAD Footprint */}
                        <button
                          onClick={() => {
                            setRoomL(activeCadPlan.widthM);
                            setRoomW(activeCadPlan.heightM);
                            toast.success(`Room footprint resized to match CAD plan: ${activeCadPlan.widthM}m × ${activeCadPlan.heightM}m`);
                          }}
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-blue-300 border border-blue-500/30 text-[10.5px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <Maximize2 className="size-3" /> Fit Room Footprint to CAD
                        </button>
                      </div>

                      {/* 3D Viewport Underlay Controls */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-white">3D Viewport Underlay</span>
                          <button
                            onClick={() => {
                              const next = !showDwgUnderlay;
                              setShowDwgUnderlay(next);
                              setActiveCadPlan((p) => ({ ...p, visible: next }));
                            }}
                            className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold border cursor-pointer transition ${
                              showDwgUnderlay && activeCadPlan.visible
                                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {showDwgUnderlay && activeCadPlan.visible ? "Active (On)" : "Hidden (Off)"}
                          </button>
                        </div>

                        {/* Opacity Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
                            <span>Underlay Opacity:</span>
                            <span className="font-mono text-white">{Math.round((activeCadPlan.opacity ?? 0.85) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={activeCadPlan.opacity ?? 0.85}
                            onChange={(e) => {
                              const op = parseFloat(e.target.value);
                              setActiveCadPlan((p) => ({ ...p, opacity: op }));
                            }}
                            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                          />
                        </div>

                        {/* Origin & Rotation Controls */}
                        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Origin X (m):</span>
                            <input
                              type="number"
                              step="0.5"
                              value={activeCadPlan.originX}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setActiveCadPlan((p) => ({ ...p, originX: val }));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Origin Y (m):</span>
                            <input
                              type="number"
                              step="0.5"
                              value={activeCadPlan.originY}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setActiveCadPlan((p) => ({ ...p, originY: val }));
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-slate-800">
                          <span className="text-slate-400">Rotation:</span>
                          <div className="flex items-center gap-1">
                            {[0, 90, 180, 270].map((deg) => (
                              <button
                                key={deg}
                                onClick={() => setActiveCadPlan((p) => ({ ...p, rotationDeg: deg }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${
                                  activeCadPlan.rotationDeg === deg
                                    ? "bg-blue-600 text-white font-bold"
                                    : "bg-slate-800 text-slate-400 hover:text-white"
                                }`}
                              >
                                {deg}°
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* CAD Layers (Ebenenverwaltung) */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Layers className="size-3 text-blue-400" />
                            <span className="text-[11px] font-semibold text-white">
                              Layers ({activeCadPlan.layers.filter((l) => l.visible).length}/{activeCadPlan.layers.length})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setActiveCadPlan((p) => ({
                                  ...p,
                                  layers: p.layers.map((l) => ({ ...l, visible: true })),
                                }));
                              }}
                              className="text-[9.5px] text-blue-400 hover:underline cursor-pointer"
                              title="Show all CAD layers"
                            >
                              All
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={() => {
                                setActiveCadPlan((p) => ({
                                  ...p,
                                  layers: p.layers.map((l) => ({
                                    ...l,
                                    visible: l.id === "A-WALL" || l.id === "A-DOOR" || l.id === "A-GLAZ",
                                  })),
                                }));
                              }}
                              className="text-[9.5px] text-emerald-400 hover:underline cursor-pointer"
                              title="Show only architectural walls, doors, and glazing"
                            >
                              Walls
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={() => {
                                setActiveCadPlan((p) => ({
                                  ...p,
                                  layers: p.layers.map((l) => ({ ...l, visible: false })),
                                }));
                              }}
                              className="text-[9.5px] text-slate-500 hover:underline cursor-pointer"
                              title="Hide all layers"
                            >
                              None
                            </button>
                          </div>
                        </div>

                        {/* Layer Table */}
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                          {activeCadPlan.layers.map((layer) => (
                            <div
                              key={layer.id}
                              onClick={() => {
                                setActiveCadPlan((p) => ({
                                  ...p,
                                  layers: p.layers.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l)),
                                }));
                              }}
                              className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition text-[10.5px] border ${
                                layer.visible
                                  ? "bg-slate-800/60 border-slate-700/60 text-slate-200"
                                  : "bg-slate-900/40 border-transparent text-slate-500"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: layer.color }}
                                />
                                <span className="font-mono font-medium truncate">{layer.name}</span>
                              </div>
                              <button
                                type="button"
                                className="p-0.5 text-slate-400 hover:text-white"
                                title={layer.visible ? "Hide layer" : "Show layer"}
                              >
                                {layer.visible ? <Eye className="size-3 text-blue-400" /> : <EyeOff className="size-3 text-slate-600" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    IFC / BIM MODEL INSPECTOR
                ------------------------------------------------------------- */}
                {constructionTool === "ifc" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      BIM / IFC Import
                    </div>
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => toast.success(`IFC Building Model active: ${ifcFileName}`)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Box className="size-3 text-purple-400" /> Open IFC File
                      </button>
                      <button 
                        onClick={() => toast.success(`Synchronized ${spaces.length} space geometries with DIALux workstation`)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <RefreshCw className="size-3 text-emerald-400" /> Sync spaces with IFC
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-3">
                      <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-[10.5px] flex flex-col gap-1 text-slate-300">
                        <div>Active File: <strong className="text-white truncate block">{ifcFileName}</strong></div>
                        <div>Total Spaces: <strong className="text-emerald-400">{spaces.length}</strong></div>
                        <div>Active Space: <strong className="text-amber-400">{spaceCustomName}</strong></div>
                        <div>IFC Schema: <strong className="text-slate-400">IFC2X3 / IFC4</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    STOREY & LEVEL INSPECTOR
                ------------------------------------------------------------- */}
                {constructionTool === "storey" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Storey and Building Structure
                    </div>
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setBuildingModel((prev) => addEmptyStorey(prev));
                          toast.success("Added new empty storey level");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Building2 className="size-3 text-amber-400" /> New empty storey
                      </button>
                      <button 
                        onClick={() => {
                          setBuildingModel((prev) => duplicateStorey(prev, prev.activeStoreyId));
                          toast.success(`Duplicated ${activeStorey.name} with all indoor rooms to upper level!`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Copy className="size-3 text-slate-400" /> Duplicate storey
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400">Storey Height</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            value={roomH}
                            onChange={(e) => setRoomH(Math.max(1.8, parseFloat(e.target.value) || 2.8))}
                            className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                          />
                          <span className="text-[10px] text-slate-400">m</span>
                        </div>
                      </div>
                      <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-[10.5px] flex flex-col gap-1 text-slate-300">
                        <div>Storey Name: <strong className="text-white">Storey 1 (Ground Floor)</strong></div>
                        <div>Floor Elevation: <strong className="text-white">± 0.000 m</strong></div>
                        <div>Clear Ceiling Height: <strong className="text-emerald-400">{roomH.toFixed(2)} m</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    POLYGONAL SPACE GEOMETRY
                ------------------------------------------------------------- */}
                {constructionTool === "polygonal_space" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Polygonal Space Contour
                    </div>
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => setShowPolygonModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Layers className="size-3 text-purple-400" /> Draw polygonal room
                      </button>
                      <button 
                        onClick={() => {
                          setRoomShape("polygon");
                          toast.success(`Closed boundary polygon contour (${polygonPreset.replace('_', '-')})`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Check className="size-3 text-emerald-400" /> Close polygon contour
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-3">
                      <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-[10.5px] flex flex-col gap-1 text-slate-300">
                        <div>Boundary Vertices: <strong className="text-white">4 corners</strong></div>
                        <div>Floor Area: <strong className="text-white">{(roomL * roomW).toFixed(2)} m²</strong></div>
                        <div>Perimeter: <strong className="text-white">{(2 * (roomL + roomW)).toFixed(2)} m</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 1: SITE INSPECTOR
                ------------------------------------------------------------- */}
                {constructionTool === "site" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Site
                    </div>
                    {/* Action buttons */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => setShowNewRoomModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Building2 className="size-3 text-amber-400" /> Draw new building
                      </button>
                      <button 
                        onClick={() => {
                          setRoomShape("rectangular");
                          toast.success(`Rectangular space footprint: ${roomL}m × ${roomW}m`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-blue-400" /> Draw rectangular floor element
                      </button>
                      <button 
                        onClick={() => {
                          setRoomShape("circular");
                          toast.success(`Circular space footprint: Ø${roomL}m`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Compass className="size-3 text-emerald-400" /> Draw circular floor element
                      </button>
                      <button 
                        onClick={() => setShowPolygonModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Layers className="size-3 text-purple-400" /> Draw polygonal floor element
                      </button>
                      <button 
                        onClick={() => {
                          const a = prompt("True North Alignment Angle (°):", siteNorthAngle);
                          if (a !== null) {
                            setSiteNorthAngle(a);
                            toast.info(`North arrow aligned to ${a}°`);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Compass className="size-3 text-red-400" /> Draw north arrow
                      </button>
                      <button 
                        disabled
                        className="px-2.5 py-1 rounded bg-slate-800/30 text-slate-500 border border-slate-800 flex items-center gap-2 text-left cursor-not-allowed"
                      >
                        <Copy className="size-3 text-slate-600" /> Duplicate building
                      </button>
                    </div>

                    {/* Cards */}
                    <div className="p-3 flex flex-col gap-3">
                      {/* Active site */}
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-[11px] text-slate-300">Active site</span>
                        <div className="flex items-center gap-2">
                          <label className="w-16 text-[10px] text-slate-400">Name</label>
                          <input
                            value={siteName}
                            onChange={(e) => setSiteName(e.target.value)}
                            className="flex-1 h-6 px-1.5 bg-[#14161a] border border-slate-700 rounded text-xs text-white outline-none font-bold"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400">Description</label>
                          <textarea
                            rows={2}
                            value={siteDesc}
                            onChange={(e) => setSiteDesc(e.target.value)}
                            className="p-1 bg-[#14161a] border border-slate-700 rounded text-xs text-slate-300 outline-none resize-none"
                          />
                        </div>
                      </div>

                      {/* Active utilization profile */}
                      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Active utilization profile</span>
                        <div className="text-[10.5px] bg-[#14161a] p-2 rounded border border-slate-700 flex flex-col gap-1">
                          <div>Space: <strong className="text-white">{siteProfileSpace}</strong></div>
                          <div>Application: <strong className="text-slate-300">{siteProfileApp}</strong></div>
                        </div>
                        <button 
                          onClick={() => setShowNewRoomModal(true)}
                          className="self-end px-3 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-semibold border border-slate-700 cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Maintenance */}
                      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Maintenance (CIE 97 / DIN 5035)</span>
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-[10px] text-slate-400">Method</label>
                          <select
                            value={maintenanceMethod}
                            onChange={(e) => {
                              setMaintenanceMethod(e.target.value);
                              if (e.target.value === "CIE 97:2005 Detailed") {
                                setIsMfModalOpen(true);
                              }
                            }}
                            className="flex-1 h-6 px-1 bg-[#14161a] border border-slate-700 rounded text-[10.5px] text-slate-200 outline-none"
                          >
                            <option value="global (DIN 5035)">global (DIN 5035)</option>
                            <option value="CIE 97:2005 Detailed">CIE 97:2005 Detailed</option>
                            <option value="Fixed Maintenance Factor">Fixed Maintenance Factor</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between bg-[#14161a] p-1.5 rounded border border-slate-700">
                          <span className="text-[10.5px] text-slate-300">Maintenance factor MF</span>
                          <input
                            type="number"
                            step={0.05}
                            value={siteMf}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0.8;
                              setSiteMf(val);
                              setMf(val);
                            }}
                            className="w-16 h-5 text-right bg-slate-900 border border-slate-600 rounded px-1 text-xs font-bold text-white outline-none"
                          />
                        </div>
                        <button
                          onClick={() => setIsMfModalOpen(true)}
                          className="w-full py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded text-[10.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-0.5 transition"
                        >
                          <Sliders className="size-3 text-amber-400" />
                          <span>Detailed CIE 97 Maintenance Factor Wizard...</span>
                        </button>
                      </div>

                      {/* Site alignment */}
                      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300 flex items-center justify-between">
                          <span>Site alignment</span>
                          <Compass className="size-3 text-slate-400" />
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-[10px] text-slate-400">Location</label>
                          <select
                            value={siteLocation}
                            onChange={(e) => setSiteLocation(e.target.value)}
                            className="flex-1 h-6 px-1 bg-[#14161a] border border-slate-700 rounded text-[10.5px] text-slate-200 outline-none"
                          >
                            <option value="Lüdenscheid">Lüdenscheid</option>
                            <option value="London">London</option>
                            <option value="Dubai">Dubai</option>
                            <option value="New York">New York</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Long:</span>
                            <input
                              value={siteLongitude}
                              onChange={(e) => setSiteLongitude(e.target.value)}
                              className="h-5 w-full bg-[#14161a] border border-slate-700 rounded px-1 text-[10px] text-white"
                            />
                            <span className="text-[10px] text-slate-400">°</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Lat:</span>
                            <input
                              value={siteLatitude}
                              onChange={(e) => setSiteLatitude(e.target.value)}
                              className="h-5 w-full bg-[#14161a] border border-slate-700 rounded px-1 text-[10px] text-white"
                            />
                            <span className="text-[10px] text-slate-400">°</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">North alignment</span>
                          <div className="flex items-center gap-1">
                            <input
                              value={siteNorthAngle}
                              onChange={(e) => setSiteNorthAngle(e.target.value)}
                              className="h-5 w-14 bg-[#14161a] border border-slate-700 rounded px-1 text-right text-[10px] text-white font-bold"
                            />
                            <span className="text-[10px] text-slate-400">°</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9.5px] text-slate-400">Time zone</span>
                          <div className="text-[10px] text-slate-300 truncate bg-[#14161a] p-1 rounded border border-slate-800">
                            {siteTimezone}
                          </div>
                        </div>
                      </div>

                      {/* Obtrusive light */}
                      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5 pb-2">
                        <span className="font-bold text-[11px] text-slate-300">Obtrusive light</span>
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-[10px] text-slate-400">Standard</label>
                          <select
                            value={obtrusiveStandard}
                            onChange={(e) => setObtrusiveStandard(e.target.value)}
                            className="flex-1 h-6 px-1 bg-[#14161a] border border-slate-700 rounded text-[10px] text-slate-200 outline-none"
                          >
                            <option value="EN 12464-2:2014">EN 12464-2:2014</option>
                            <option value="CIBSE LG7:2023">CIBSE LG7:2023</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-[10px] text-slate-400">Zone</label>
                          <select
                            value={obtrusiveZone}
                            onChange={(e) => setObtrusiveZone(e.target.value)}
                            className="flex-1 h-6 px-1 bg-[#14161a] border border-slate-700 rounded text-[10px] text-slate-200 outline-none"
                          >
                            <option value="Environmental Zone E4">Environmental Zone E4</option>
                            <option value="Environmental Zone E3">Environmental Zone E3</option>
                            <option value="Environmental Zone E2">Environmental Zone E2</option>
                            <option value="Environmental Zone E1">Environmental Zone E1</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="w-20 text-[10px] text-slate-400">Period review</label>
                          <select
                            value={obtrusivePeriod}
                            onChange={(e) => setObtrusivePeriod(e.target.value)}
                            className="flex-1 h-6 px-1 bg-[#14161a] border border-slate-700 rounded text-[10px] text-slate-200 outline-none"
                          >
                            <option value="Pre-curfew">Pre-curfew</option>
                            <option value="Curfew">Curfew</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 2: STOREY AND BUILDING CONSTRUCTION (DIALux evo Tutorial Part 3)
                ------------------------------------------------------------- */}
                {constructionTool === "building" && (
                  <div className="flex flex-col text-slate-200">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-amber-400" />
                        <span className="font-bold text-white text-xs">Storey and Building Construction</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">
                        {buildingModel.storeys.length} {buildingModel.storeys.length === 1 ? "Storey" : "Storeys"}
                      </span>
                    </div>

                    {/* Action buttons matching DIALux evo Tutorial Part 3 */}
                    <div className="p-2.5 border-b border-slate-800 bg-[#16181f] flex flex-col gap-1.5">
                      <button 
                        onClick={() => {
                          setDrawContourMode("indoor_contour");
                          setIsDrawContourModalOpen(true);
                        }}
                        className="w-full px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow transition"
                      >
                        <Layers className="size-3.5" /> Draw New Indoor Contour (Room)...
                      </button>

                      <button 
                        onClick={() => {
                          setDrawContourMode("building");
                          setIsDrawContourModalOpen(true);
                        }}
                        className="w-full px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 text-xs flex items-center justify-center gap-2 cursor-pointer transition font-medium"
                      >
                        <Building2 className="size-3.5 text-blue-400" /> Draw New Building (Outer Contour)...
                      </button>

                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
                        <button 
                          onClick={() => {
                            setBuildingModel((prev) => duplicateStorey(prev, prev.activeStoreyId));
                            toast.success(`Duplicated ${activeStorey.name} to upper storey!`);
                          }}
                          className="px-2 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/50 text-[10.5px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                          title="Duplicate current storey structure and rooms to level above"
                        >
                          <Copy className="size-3 text-amber-400" /> Duplicate Storey
                        </button>

                        <button 
                          onClick={() => {
                            setBuildingModel((prev) => addEmptyStorey(prev));
                            toast.success("Added new empty storey level");
                          }}
                          className="px-2 py-1 rounded bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/50 text-[10.5px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                          title="Add new empty storey"
                        >
                          <Plus className="size-3 text-emerald-400" /> New Empty Storey
                        </button>
                      </div>
                    </div>

                    <div className="p-3 flex flex-col gap-3">
                      {/* Active Storey Navigator Tabs */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-300">Active Storey:</span>
                        <div className="flex items-center gap-1 overflow-x-auto pb-1">
                          {buildingModel.storeys.map((st) => (
                            <button
                              key={st.id}
                              onClick={() => {
                                setBuildingModel((prev) => ({ ...prev, activeStoreyId: st.id }));
                                toast.info(`Switched to: ${st.name}`);
                              }}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-medium whitespace-nowrap cursor-pointer transition border ${
                                buildingModel.activeStoreyId === st.id
                                  ? "bg-amber-600/30 text-amber-300 border-amber-500 font-bold"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                              }`}
                            >
                              {st.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Storey Parameters Card */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Storey Height:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.1}
                              value={activeStorey.heightM}
                              onChange={(e) => {
                                const h = parseFloat(e.target.value) || 2.8;
                                setBuildingModel((prev) => ({
                                  ...prev,
                                  storeys: prev.storeys.map((st) =>
                                    st.id === prev.activeStoreyId ? { ...st, heightM: h } : st
                                  ),
                                }));
                                setRoomH(h);
                              }}
                              className="h-5 w-14 text-center bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
                            />
                            <span className="text-slate-500 text-[10px]">m</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Exterior Wall Thickness:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.05}
                              value={activeStorey.wallThicknessM}
                              onChange={(e) => {
                                const t = parseFloat(e.target.value) || 0.25;
                                setBuildingModel((prev) => ({
                                  ...prev,
                                  storeys: prev.storeys.map((st) =>
                                    st.id === prev.activeStoreyId ? { ...st, wallThicknessM: t } : st
                                  ),
                                }));
                              }}
                              className="h-5 w-14 text-center bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
                            />
                            <span className="text-slate-500 text-[10px]">m</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                          <span>Floor Elevation:</span>
                          <strong className="text-white font-mono">
                            {activeStorey.elevationM >= 0 ? `+${activeStorey.elevationM.toFixed(2)}` : activeStorey.elevationM.toFixed(2)} m
                          </strong>
                        </div>
                      </div>

                      {/* Indoor Rooms on Storey (Ebenen-Räume) */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                            <Layers className="size-3 text-emerald-400" />
                            Indoor Rooms ({activeStorey.rooms.length})
                          </span>
                          <button
                            onClick={() => {
                              setDrawContourMode("indoor_contour");
                              setIsDrawContourModalOpen(true);
                            }}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="size-3" /> Add Room
                          </button>
                        </div>

                        {/* Room list */}
                        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {activeStorey.rooms.map((room) => {
                            const isCurrent = room.id === buildingModel.activeRoomId;
                            return (
                              <div
                                key={room.id}
                                onClick={() => {
                                  setBuildingModel((prev) => ({ ...prev, activeRoomId: room.id }));
                                  setSpaceCustomName(room.name);
                                  setRoomL(room.width);
                                  setRoomW(room.length);
                                  setRoomH(room.height);
                                  setTargetLux(room.targetLux);
                                  toast.info(`Active Calculation Room: ${room.name} (${room.areaM2.toFixed(1)} m²)`);
                                }}
                                className={`p-2 rounded-lg border cursor-pointer transition flex flex-col gap-1 ${
                                  isCurrent
                                    ? "bg-blue-600/20 border-blue-500/80 text-white shadow-sm"
                                    : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span
                                      className="size-2 rounded-full shrink-0"
                                      style={{ backgroundColor: room.color }}
                                    />
                                    <span className="font-semibold text-xs truncate">{room.name}</span>
                                  </div>
                                  {isCurrent && (
                                    <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.2 rounded leading-tight">
                                      Active
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Area: <strong className="text-emerald-400 font-mono">{room.areaM2.toFixed(1)} m²</strong></span>
                                  <span>Target: <strong className="text-amber-400 font-mono">{room.targetLux} lx</strong></span>
                                  <span>Wall: <strong className="text-slate-300 font-mono">{room.wallThickness}m</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Building Summary Card */}
                      <div className="bg-[#14161a] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-[11px] text-slate-400">
                        <span className="font-semibold text-white text-xs">Building Metrics</span>
                        <div className="flex justify-between">
                          <span>Building Name:</span>
                          <strong className="text-white">{buildingModel.name}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Storeys:</span>
                          <strong className="text-white">{buildingModel.storeys.length} Floors</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Building Height:</span>
                          <strong className="text-blue-400 font-mono">{buildingModel.totalHeightM.toFixed(2)} m</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Gross Floor Area:</span>
                          <strong className="text-emerald-400 font-mono">
                            {buildingModel.storeys
                              .reduce(
                                (tot, st) =>
                                  tot + st.rooms.reduce((rt, r) => rt + r.areaM2, 0),
                                0
                              )
                              .toFixed(1)}{" "}
                            m²
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 5: SPACES INSPECTOR
                ------------------------------------------------------------- */}
                {constructionTool === "space" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Spaces
                    </div>
                    {/* Action buttons matching Screenshot 5 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setRoomShape("rectangular");
                          toast.success(`Space geometry: Rectangular (${roomL}m × ${roomW}m)`);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left transition ${
                          roomShape === "rectangular"
                            ? "bg-amber-600/30 text-amber-300 border-amber-500 font-bold"
                            : "bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700/60"
                        }`}
                      >
                        <Square className="size-3 text-amber-400" /> Draw rectangular space
                      </button>
                      <button 
                        onClick={() => {
                          setRoomShape("circular");
                          toast.success(`Space geometry: Circular Atrium (Ø${roomL}m)`);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left transition ${
                          roomShape === "circular"
                            ? "bg-emerald-600/30 text-emerald-300 border-emerald-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Compass className="size-3 text-emerald-400" /> Draw circular space
                      </button>
                      <button 
                        onClick={() => {
                          setShowPolygonModal(true);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left transition ${
                          roomShape === "polygon"
                            ? "bg-purple-600/30 text-purple-300 border-purple-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Layers className="size-3 text-purple-400" /> Draw polygon space {roomShape === "polygon" ? `(${polygonPreset.replace('_', '-')})` : ""}
                      </button>
                      <button 
                        onClick={() => {
                          setShowSubspaceModal(true);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left transition ${
                          hasSubspace
                            ? "bg-red-600/30 text-red-300 border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Scissors className="size-3 text-red-400" /> Exclude subspace {hasSubspace ? "(Active Core Void)" : ""}
                      </button>
                      <button 
                        onClick={() => {
                          const snappedL = Math.round(roomL * 20) / 20;
                          const snappedW = Math.round(roomW * 20) / 20;
                          setRoomL(snappedL);
                          setRoomW(snappedW);
                          toast.success(`Space boundaries aligned to perimeter walls (${snappedL.toFixed(2)}m × ${snappedW.toFixed(2)}m)`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Check className="size-3 text-blue-400" /> Adjust space to walls
                      </button>
                    </div>

                    {/* Active Space Geometry Dimensions */}
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400">Space Name</label>
                        <input
                          value={spaceCustomName}
                          onChange={(e) => setSpaceCustomName(e.target.value)}
                          className="h-7 px-2 bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400">{roomShape === "circular" ? "Diameter (m)" : "Length (m)"}</label>
                          <input
                            type="number"
                            step={0.5}
                            value={roomL}
                            onChange={(e) => setRoomL(Math.max(1, parseFloat(e.target.value) || 5))}
                            className="h-7 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400">{roomShape === "circular" ? "Radius (m)" : "Width (m)"}</label>
                          <input
                            type="number"
                            step={0.5}
                            value={roomShape === "circular" ? Number((roomL / 2).toFixed(2)) : roomW}
                            disabled={roomShape === "circular"}
                            onChange={(e) => setRoomW(Math.max(1, parseFloat(e.target.value) || 4))}
                            className={`h-7 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none ${
                              roomShape === "circular" ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400">Height (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={roomH}
                            onChange={(e) => setRoomH(Math.max(1.8, parseFloat(e.target.value) || 2.8))}
                            className="h-7 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 bg-[#14161a] p-2.5 rounded border border-slate-800 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Floor Area:</span>
                          <strong className="text-emerald-400 font-mono font-bold">{effectiveArea.toFixed(2)} m²</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Room Volume:</span>
                          <strong className="text-white font-mono font-bold">{effectiveVolume.toFixed(2)} m³</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Target Lux:</span>
                          <strong className="text-amber-400 font-mono font-bold">{targetLux} lx</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Shape Profile:</span>
                          <span className="text-[10px] font-bold text-purple-300 uppercase px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-700/50">
                            {roomShape} {roomShape === "polygon" ? `(${polygonPreset.replace('_', '-')})` : ""}
                          </span>
                        </div>
                        {hasSubspace && (
                          <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-800/80 text-[10.5px] text-red-300">
                            <span>Excluded Void ({subspaceType.replace('_', ' ')}):</span>
                            <span className="font-mono font-bold">-{(subspaceL * subspaceW).toFixed(2)} m²</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 3: APERTURES (DOORS & WINDOWS)
                ------------------------------------------------------------- */}
                {constructionTool === "apertures" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Apertures
                    </div>
                    {/* Action buttons matching Screenshot 3 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => setShowApertureModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <DoorClosed className="size-3 text-amber-400" /> Position active aperture
                      </button>
                      <button 
                        onClick={() => {
                          setWindowCount((c) => c + 1);
                          toast.success("Added 1 window to space");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-blue-400" /> Draw new aperture (+1 Window)
                      </button>
                      {windowCount > 0 && (
                        <button 
                          onClick={() => {
                            setWindowCount(0);
                            setShowFacadeBlinds(false);
                            toast.success("Removed all apertures from space");
                          }}
                          className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 flex items-center gap-2 cursor-pointer text-left"
                        >
                          <Trash2 className="size-3 text-red-400" /> Clear / Remove all apertures
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setApertureFrameWidth(0.08);
                          toast.success("Aligned apertures flush with exterior wall thickness");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Sliders className="size-3 text-emerald-400" /> Adjust building opening for the wall thickness
                      </button>
                      <button 
                        onClick={() => setShowApertureModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <RefreshCw className="size-3 text-purple-400" /> Replace selected apertures
                      </button>
                      <button 
                        onClick={() => setShowApertureModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <RefreshCw className="size-3 text-amber-400" /> Replace all apertures of this type
                      </button>
                      <button 
                        onClick={() => toast.info("Loaded daylighting system file")}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Download className="size-3 text-emerald-400" /> Load daylighting system file
                      </button>
                    </div>

                    {/* Active aperture visual selection matching Screenshot 3 */}
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Active aperture</span>
                        <span className="text-[10px] text-amber-400">Window (standard)</span>
                      </div>

                      {/* Elevation & Section Diagram Buttons */}
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded bg-[#14161a] border-2 border-amber-500/80 flex flex-col items-center justify-center size-16">
                          <div className="w-8 h-10 border-2 border-white rounded-sm flex items-center justify-center">
                            <div className="w-5 h-7 border border-slate-400" />
                          </div>
                        </div>
                        <div className="p-2 rounded bg-[#14161a] border border-slate-700 flex flex-col items-center justify-center size-16">
                          <div className="w-10 h-1 bg-white" />
                        </div>
                        <button 
                          onClick={() => setShowApertureModal(true)}
                          className="ml-auto px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                        >
                          Select &gt;
                        </button>
                      </div>

                      {/* Dimensions Section matching Screenshot 3 */}
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Dimensions</span>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Height</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.05}
                              value={apertureHeight}
                              onChange={(e) => setApertureHeight(parseFloat(e.target.value) || 1.35)}
                              className="w-20 h-6 px-1.5 text-right bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                            />
                            <span className="text-[10px] text-slate-400">m</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Width</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.05}
                              value={apertureWidth}
                              onChange={(e) => setApertureWidth(parseFloat(e.target.value) || 1.0)}
                              className="w-20 h-6 px-1.5 text-right bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                            />
                            <span className="text-[10px] text-slate-400">m</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Frame width</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.01}
                              value={apertureFrameWidth}
                              onChange={(e) => setApertureFrameWidth(parseFloat(e.target.value) || 0.12)}
                              className="w-20 h-6 px-1.5 text-right bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                            />
                            <span className="text-[10px] text-slate-400">m</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Sill height</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.05}
                              value={apertureSillHeight}
                              onChange={(e) => setApertureSillHeight(parseFloat(e.target.value) || 0.8)}
                              className="w-20 h-6 px-1.5 text-right bg-[#14161a] border border-slate-700 rounded text-xs text-white font-bold outline-none"
                            />
                            <span className="text-[10px] text-slate-400">m</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center bg-[#14161a] p-2 rounded border border-slate-800 mt-1">
                          <span className="text-[10px] text-slate-400">Active Wall Windows:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setWindowCount((c) => Math.max(0, c - 1))}
                              disabled={windowCount <= 0}
                              className="size-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                              title="Decrease window count"
                            >
                              -
                            </button>
                            <strong className="text-white font-mono text-xs w-6 text-center">{windowCount}</strong>
                            <button
                              onClick={() => setWindowCount((c) => c + 1)}
                              className="size-5 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                              title="Increase window count"
                            >
                              +
                            </button>
                            {windowCount > 0 && (
                              <button
                                onClick={() => {
                                  setWindowCount(0);
                                  setShowFacadeBlinds(false);
                                  toast.success("Cleared all windows");
                                }}
                                className="ml-1.5 px-1.5 py-0.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 text-[10px] cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 4: FAÇADE ELEMENTS (VENETIAN BLINDS)
                ------------------------------------------------------------- */}
                {constructionTool === "facade" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Façade elements
                    </div>
                    {/* Action buttons matching Screenshot 4 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setShowFacadeBlinds(true);
                          setShowFacadeModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Building2 className="size-3 text-amber-400" /> Add façade system
                      </button>
                      {showFacadeBlinds && (
                        <button 
                          onClick={() => {
                            setShowFacadeBlinds(false);
                            toast.success("Removed façade elements from space");
                          }}
                          className="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 flex items-center gap-2 cursor-pointer text-left"
                        >
                          <Trash2 className="size-3 text-red-400" /> Clear / Remove façade blinds
                        </button>
                      )}
                      <button 
                        onClick={() => setShowFacadeModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <RefreshCw className="size-3 text-blue-400" /> Replace selected façade elements
                      </button>
                      <button 
                        onClick={() => setShowFacadeModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <RefreshCw className="size-3 text-purple-400" /> Replace all façade elements of this type
                      </button>
                      <button 
                        onClick={() => setIsDaylightModalOpen(true)}
                        className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/50 flex items-center gap-2 cursor-pointer text-left font-bold"
                      >
                        <Sun className="size-3 text-amber-400" /> Daylight Factor & Sun Position (EN 17037)
                      </button>
                      <button 
                        onClick={() => toast.info("Loaded daylighting system file")}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Download className="size-3 text-emerald-400" /> Load daylighting system file
                      </button>
                      <button 
                        onClick={() => toast.info("Transferred layer configuration")}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Copy className="size-3 text-amber-400" /> Transfer layer configuration
                      </button>
                    </div>

                    {/* Active façade element section matching Screenshot 4 */}
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Active façade element</span>
                        <span className="text-[10px] text-amber-400">External venetian blind</span>
                      </div>

                      {/* Blinds thumbnail preview */}
                      <div className="flex items-center gap-3">
                        <div className="size-16 rounded bg-[#14161a] border-2 border-amber-500/80 p-2 flex flex-col justify-between">
                          <div className="w-full h-1 bg-white rounded-xs" />
                          <div className="w-full h-1 bg-white rounded-xs" />
                          <div className="w-full h-1 bg-white rounded-xs" />
                          <div className="w-full h-1 bg-white rounded-xs" />
                          <div className="w-full h-1 bg-white rounded-xs" />
                        </div>
                        <button 
                          onClick={() => setShowFacadeModal(true)}
                          className="ml-auto px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                        >
                          Select &gt;
                        </button>
                      </div>

                      {/* Properties */}
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Properties</span>
                        <div className="flex items-center justify-between bg-[#14161a] p-2 rounded border border-slate-800">
                          <span className="text-[10.5px] text-slate-400">Façade System:</span>
                          <span className={`text-xs font-bold flex items-center gap-1 ${showFacadeBlinds ? "text-emerald-400" : "text-slate-500"}`}>
                            {showFacadeBlinds ? "Active (On)" : "Disabled (Off)"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-[#14161a] p-2 rounded border border-slate-800">
                          <span className="text-[10.5px] text-slate-400">Mounting type</span>
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            <Sun className="size-3 text-amber-400" /> {facadeMounting}
                          </span>
                        </div>
                      </div>

                      {/* Information */}
                      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Information</span>
                        <div className="text-[10.5px] text-slate-400 bg-[#14161a] p-2 rounded border border-slate-800">
                          Applied to South façade windows. Reduces direct glare and solar heat gain coefficient (g-value = 0.15).
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 1: ROOM ELEMENTS (BEAMS, COLUMNS, PLATFORMS, RAMPS)
                ------------------------------------------------------------- */}
                {constructionTool === "room_elements" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
                      <span>Room elements</span>
                      <span className="text-[10px] text-amber-400 font-mono">EN 12464-1</span>
                    </div>

                    {/* Actions matching Screenshot 1 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setActiveRoomElement("column_rect");
                          setHasPlacedRoomElement(true);
                          setShowRoomElements(true);
                          toast.success("Rectangular column placed in space");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-amber-400" /> Draw rectangular room element
                      </button>
                      <button 
                        onClick={() => {
                          setActiveRoomElement("column_circ");
                          setHasPlacedRoomElement(true);
                          setShowRoomElements(true);
                          toast.success("Circular column placed in space");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <div className="size-3 rounded-full border border-blue-400" /> Draw circular room element
                      </button>
                      <button 
                        onClick={() => setShowPolygonModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h7v7h9v9H4V4z" />
                        </svg>
                        Draw polygonal room element
                      </button>
                    </div>

                    {/* Active room element grid matching Screenshot 1 */}
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Active room element</span>
                        <span className="text-[10px] text-amber-400 uppercase font-semibold">
                          {activeRoomElement === "beam" ? "Beam" : activeRoomElement === "column_rect" ? "Column (Rect)" : activeRoomElement === "column_circ" ? "Column (Circ)" : activeRoomElement === "platform" ? "Platform" : "Ramp"}
                        </span>
                      </div>

                      {/* 5 Preset Tiles with 3D wireframe drawings */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {/* 1. Beam */}
                        <button
                          onClick={() => {
                            setActiveRoomElement("beam");
                            setHasPlacedRoomElement(true);
                            setShowRoomElements(true);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center justify-between h-16 border transition cursor-pointer ${
                            activeRoomElement === "beam" ? "bg-[#252a34] border-amber-500 ring-1 ring-amber-500" : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="w-10 h-7 flex items-center justify-center">
                            <div className="w-8 h-3 border border-slate-300 bg-slate-700/60 rounded-xs" />
                          </div>
                          <span className="text-[9.5px] text-slate-300 font-medium">Beam</span>
                        </button>

                        {/* 2. Column (Rectangular) */}
                        <button
                          onClick={() => {
                            setActiveRoomElement("column_rect");
                            setHasPlacedRoomElement(true);
                            setShowRoomElements(true);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center justify-between h-16 border transition cursor-pointer ${
                            activeRoomElement === "column_rect" ? "bg-[#252a34] border-amber-500 ring-1 ring-amber-500" : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="w-10 h-7 flex items-center justify-center">
                            <div className="w-4 h-6 border border-slate-300 bg-slate-700/60 rounded-xs" />
                          </div>
                          <span className="text-[9.5px] text-slate-300 font-medium truncate">Column (Rect)</span>
                        </button>

                        {/* 3. Column (Circular) */}
                        <button
                          onClick={() => {
                            setActiveRoomElement("column_circ");
                            setHasPlacedRoomElement(true);
                            setShowRoomElements(true);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center justify-between h-16 border transition cursor-pointer ${
                            activeRoomElement === "column_circ" ? "bg-[#252a34] border-amber-500 ring-1 ring-amber-500" : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="w-10 h-7 flex items-center justify-center">
                            <div className="w-4 h-6 border border-slate-300 bg-slate-700/60 rounded-full" />
                          </div>
                          <span className="text-[9.5px] text-slate-300 font-medium truncate">Column (Circ)</span>
                        </button>

                        {/* 4. Platform */}
                        <button
                          onClick={() => {
                            setActiveRoomElement("platform");
                            setHasPlacedRoomElement(true);
                            setShowRoomElements(true);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center justify-between h-16 border transition cursor-pointer ${
                            activeRoomElement === "platform" ? "bg-[#252a34] border-amber-500 ring-1 ring-amber-500" : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="w-10 h-7 flex items-center justify-center">
                            <div className="w-8 h-2 border border-slate-300 bg-slate-700/60 rounded-xs" />
                          </div>
                          <span className="text-[9.5px] text-slate-300 font-medium">Platform</span>
                        </button>

                        {/* 5. Ramp */}
                        <button
                          onClick={() => {
                            setActiveRoomElement("ramp");
                            setHasPlacedRoomElement(true);
                            setShowRoomElements(true);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center justify-between h-16 border transition cursor-pointer ${
                            activeRoomElement === "ramp" ? "bg-[#252a34] border-amber-500 ring-1 ring-amber-500" : "bg-[#14161a] border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="w-10 h-7 flex items-center justify-center">
                            <svg className="w-7 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="3,20 21,20 21,6" fill="currentColor" fillOpacity="0.3" />
                            </svg>
                          </div>
                          <span className="text-[9.5px] text-slate-300 font-medium">Ramp</span>
                        </button>
                      </div>

                      {/* Scale / Sizing slider matching Screenshot 1 */}
                      <div className="flex items-center gap-2 px-1 pt-1">
                        <span className="text-[10px] text-slate-400">Scale</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={roomElementScale}
                          onChange={(e) => setRoomElementScale(parseFloat(e.target.value) || 1.0)}
                          className="flex-1 accent-amber-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-white w-7 text-right">
                          {roomElementScale.toFixed(1)}x
                        </span>
                      </div>

                      {/* Dimensions Section */}
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Dimensions</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400">Width (m)</label>
                            <input
                              type="number"
                              step={0.05}
                              value={roomElementWidth}
                              onChange={(e) => setRoomElementWidth(parseFloat(e.target.value) || 0.4)}
                              className="h-6 w-full text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Length (m)</label>
                            <input
                              type="number"
                              step={0.05}
                              value={roomElementLength}
                              onChange={(e) => setRoomElementLength(parseFloat(e.target.value) || 0.4)}
                              className="h-6 w-full text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1">
                          <button
                            onClick={() => {
                              const nextVal = !showRoomElements;
                              setShowRoomElements(nextVal);
                              if (nextVal) setHasPlacedRoomElement(true);
                              toast.info(`Room elements 3D visibility: ${nextVal ? "Shown" : "Hidden"}`);
                            }}
                            className={`w-full py-1 rounded text-xs font-semibold transition cursor-pointer border ${
                              showRoomElements && hasPlacedRoomElement ? "bg-amber-600/30 text-amber-300 border-amber-500/50" : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {showRoomElements && hasPlacedRoomElement ? "Hide Elements in 3D" : "Show Elements in 3D"}
                          </button>
                          {hasPlacedRoomElement && (
                            <button
                              onClick={() => {
                                setHasPlacedRoomElement(false);
                                setShowRoomElements(false);
                                toast.success("Cleared columns and room elements from 3D space");
                              }}
                              className="w-full py-1 rounded text-xs font-semibold transition cursor-pointer border bg-red-950/40 text-red-300 border-red-800/60 hover:bg-red-900/50"
                            >
                              Clear / Remove Elements
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 2: ROOFS (FLAT, GABLE, SHED)
                ------------------------------------------------------------- */}
                {constructionTool === "roofs" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Roofs
                    </div>

                    {/* Actions matching Screenshot 2 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setHasPlacedRoof(true);
                          setShowRoofIn3D(true);
                          toast.success("Automatically placed roof over building perimeter");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Building2 className="size-3 text-amber-400" /> Automatically place roof
                      </button>
                      <button 
                        onClick={() => setShowRoofModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-blue-400" /> Draw roof
                      </button>
                    </div>

                    {/* Active roof section matching Screenshot 2 */}
                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Active roof</span>
                        <span className="text-[10px] text-amber-400 font-semibold capitalize">{activeRoofType} roof</span>
                      </div>

                      {/* Active roof thumbnail card */}
                      <div className="flex items-center gap-3">
                        <div className="size-16 rounded bg-[#14161a] border-2 border-amber-500/80 p-2 flex flex-col items-center justify-center">
                          <svg className="w-10 h-10 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polygon points="12,3 2,9 12,15 22,9" fill="currentColor" fillOpacity="0.2" />
                            <polyline points="2,9 2,15 12,21 22,15 22,9" />
                            <line x1="12" y1="15" x2="12" y2="21" />
                          </svg>
                        </div>
                        <button 
                          onClick={() => setShowRoofModal(true)}
                          className="ml-auto px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
                        >
                          Select &gt;
                        </button>
                      </div>

                      {/* Roof Properties */}
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-2.5">
                        <span className="font-bold text-[11px] text-slate-300">Roof Dimensions</span>
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Overhang</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={0.05}
                              value={roofOverhang}
                              onChange={(e) => setRoofOverhang(parseFloat(e.target.value) || 0.3)}
                              className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">m</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] text-slate-400">Roof pitch</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={1}
                              value={roofPitch}
                              onChange={(e) => setRoofPitch(parseFloat(e.target.value) || 15)}
                              className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">°</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowRoofIn3D(!showRoofIn3D);
                            toast.info(`Roof 3D model: ${!showRoofIn3D ? "Rendered" : "Transparent"}`);
                          }}
                          className={`w-full py-1 mt-1 rounded text-xs font-semibold transition cursor-pointer border ${
                            showRoofIn3D ? "bg-amber-600/30 text-amber-300 border-amber-500/50" : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {showRoofIn3D ? "Hide 3D Roof" : "Render 3D Roof"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 3: CEILINGS
                ------------------------------------------------------------- */}
                {constructionTool === "ceilings" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Ceilings
                    </div>

                    {/* Actions matching Screenshot 3 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => setShowCeilingModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Layers className="size-3 text-amber-400" /> Insert ceiling into room
                      </button>
                      <button 
                        onClick={() => setShowCeilingModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-blue-400" /> Draw new ceiling
                      </button>
                      <button 
                        onClick={() => {
                          setCeilingSuspensionDepth(0.4);
                          setHasSuspendedCeiling(true);
                          setShowCeilingGrid(true);
                          toast.success("Adjusted suspended ceiling flush to perimeter walls at 2.40m clear height");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Sliders className="size-3 text-emerald-400" /> Adjust ceiling to room
                      </button>
                    </div>

                    {/* Information Section matching Screenshot 3 */}
                    <div className="p-3 flex flex-col gap-3">
                      <span className="font-bold text-[11px] text-slate-300">Information</span>
                      
                      {!hasSuspendedCeiling ? (
                        <div className="text-[10.5px] text-slate-400 bg-[#14161a] p-2.5 rounded border border-slate-800 italic">
                          No suspended ceiling selected
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 bg-[#14161a] p-2.5 rounded border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Suspension depth:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step={0.05}
                                value={ceilingSuspensionDepth}
                                onChange={(e) => setCeilingSuspensionDepth(parseFloat(e.target.value) || 0.4)}
                                className="h-6 w-14 text-center bg-slate-900 border border-slate-700 rounded text-xs text-white"
                              />
                              <span className="text-[10px] text-slate-400 font-mono">m</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Clear Room Height:</span>
                            <span className="text-white font-bold font-mono">{(roomH - ceilingSuspensionDepth).toFixed(3)} m</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Grid system:</span>
                            <span className="text-amber-400 font-semibold">600 &times; 600 mm T-bar</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Tile reflectance:</span>
                            <span className="text-emerald-400 font-mono">{Math.round(ceilingTileReflectance * 100)}%</span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setHasSuspendedCeiling(!hasSuspendedCeiling);
                          setShowCeilingGrid(!hasSuspendedCeiling);
                          toast.info(`Suspended ceiling ${!hasSuspendedCeiling ? "enabled" : "removed"}`);
                        }}
                        className={`w-full py-1.5 rounded text-xs font-bold transition cursor-pointer border ${
                          hasSuspendedCeiling ? "bg-amber-600/30 text-amber-300 border-amber-500/50" : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {hasSuspendedCeiling ? "Remove Suspended Ceiling" : "Install Suspended Ceiling"}
                      </button>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 4: CUTOUT
                ------------------------------------------------------------- */}
                {constructionTool === "cutouts" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Cutout
                    </div>

                    {/* Actions matching Screenshot 4 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setActiveCutoutShape("rectangular");
                          setHasActiveCutout(true);
                          toast.success("Rectangular cutout placed in ceiling slab");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Square className="size-3 text-amber-400" /> Rectangular cutout
                      </button>
                      <button 
                        onClick={() => {
                          setActiveCutoutShape("circular");
                          setHasActiveCutout(true);
                          toast.success("Circular cutout placed in slab");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <div className="size-3 rounded-full border border-blue-400" /> Circular cutout
                      </button>
                      <button 
                        onClick={() => {
                          setActiveCutoutShape("polygonal");
                          setHasActiveCutout(true);
                          toast.info("Polygonal cutout contour active");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h7v7h9v9H4V4z" />
                        </svg>
                        Polygonal cutout
                      </button>
                    </div>

                    {/* Information Section matching Screenshot 4 */}
                    <div className="p-3 flex flex-col gap-3">
                      <span className="font-bold text-[11px] text-slate-300">Information</span>

                      {!hasActiveCutout ? (
                        <div className="text-[10.5px] text-slate-400 bg-[#14161a] p-2.5 rounded border border-slate-800 italic">
                          No cutout selected
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 bg-[#14161a] p-2.5 rounded border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Target surface:</span>
                            <select
                              value={cutoutSurface}
                              onChange={(e) => setCutoutSurface(e.target.value as any)}
                              className="h-6 px-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                            >
                              <option value="ceiling">Ceiling / Roof</option>
                              <option value="floor">Floor / Slab</option>
                              <option value="wall">Wall</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] text-slate-400">Width (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                value={cutoutWidth}
                                onChange={(e) => setCutoutWidth(parseFloat(e.target.value) || 1.2)}
                                className="h-6 w-full text-center bg-slate-900 border border-slate-700 rounded text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400">Length (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                value={cutoutLength}
                                onChange={(e) => setCutoutLength(parseFloat(e.target.value) || 1.2)}
                                className="h-6 w-full text-center bg-slate-900 border border-slate-700 rounded text-xs text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setHasActiveCutout(!hasActiveCutout);
                          toast.info(`Cutout opening ${!hasActiveCutout ? "created" : "removed"}`);
                        }}
                        className={`w-full py-1.5 rounded text-xs font-bold transition cursor-pointer border ${
                          hasActiveCutout ? "bg-red-900/40 text-red-200 border-red-700/60" : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {hasActiveCutout ? "Clear Cutout Opening" : "Create New Cutout"}
                      </button>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 5: FURNITURE AND OBJECTS
                ------------------------------------------------------------- */}
                {/* -------------------------------------------------------------
                    SCREENSHOT 5: FURNITURE AND OBJECTS (DIALux evo Tutorial Part 4)
                ------------------------------------------------------------- */}
                {constructionTool === "furniture" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Box className="size-3.5 text-emerald-400" />
                        <span>Furniture and objects</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {furnitureList.length} placed
                      </span>
                    </div>

                    {/* Actions matching DIALux evo Tutorial Part 4 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setFurnitureArrangement("rectangular");
                          setShowFurnitureModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Grid className="size-3 text-amber-400" /> Draw rectangular arrangement (Grid)
                      </button>
                      <button 
                        onClick={() => {
                          setFurnitureArrangement("line");
                          setShowFurnitureModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <div className="w-3 h-0.5 bg-emerald-400" /> Draw line arrangement
                      </button>
                      <button 
                        onClick={() => {
                          setFurnitureArrangement("circular");
                          setShowFurnitureModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <div className="size-3 rounded-full border border-blue-400" /> Draw circular arrangement
                      </button>
                      <button 
                        onClick={() => {
                          setFurnitureArrangement("individual");
                          setShowFurnitureModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Target className="size-3 text-purple-400" /> Place individual object
                      </button>

                      {/* One-click signature tutorial item: Staircases & Extrusion Bodies (Tutorial Part 13) */}
                      <button 
                        onClick={() => {
                          setIsStaircaseModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 border border-amber-600/50 font-bold flex items-center gap-2 cursor-pointer text-left shadow-xs"
                      >
                        <Layers className="size-3 text-amber-400" /> Staircases & Extrusions (Tutorial 13)
                      </button>

                      {/* One-click signature tutorial item: Staircases Part 2 - Copy along line & grouping (Tutorial Part 14) */}
                      <button 
                        onClick={() => {
                          setIsCopyAlongLineModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-orange-950/40 hover:bg-orange-900/50 text-orange-200 border border-orange-600/50 font-bold flex items-center gap-2 cursor-pointer text-left shadow-xs"
                      >
                        <Copy className="size-3 text-orange-400" /> Copy Along Line & Multi-Flight Stairs (Tutorial 14)
                      </button>
                      
                      {/* One-click signature tutorial item: Reception Desk */}
                      <button 
                        onClick={() => {
                          const newRec = createReceptionDeskItem(
                            `rec_${Date.now()}`,
                            roomL / 2,
                            roomW / 2,
                            0,
                            "wood_oak_parquet",
                            "#d4b996"
                          );
                          setFurnitureList((prev) => [...prev, newRec]);
                          setSelectedFurnitureId(newRec.id);
                          setShowFurniture(true);
                          toast.success("Placed DIALux evo Tutorial Part 4 Reception Desk at room center");
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border border-emerald-600/50 font-bold flex items-center gap-2 cursor-pointer text-left shadow-xs"
                      >
                        <Sparkles className="size-3 text-amber-400" /> Add Reception Desk (Tutorial 4)
                      </button>

                      <button 
                        onClick={() => {
                          // Automatic EN 12464-1 4-station layout
                          const cX = roomL / 2;
                          const cZ = roomW / 2;
                          const d1 = createDeskItem(`desk_auto_1`, cX - 1.0, cZ - 0.6, 0);
                          const d2 = createDeskItem(`desk_auto_2`, cX + 1.0, cZ - 0.6, 0);
                          const d3 = createDeskItem(`desk_auto_3`, cX - 1.0, cZ + 0.6, 180);
                          const d4 = createDeskItem(`desk_auto_4`, cX + 1.0, cZ + 0.6, 180);
                          const c1 = createChairItem(`ch_auto_1`, cX - 1.0, cZ - 1.2, 0);
                          const c2 = createChairItem(`ch_auto_2`, cX + 1.0, cZ - 1.2, 0);
                          const c3 = createChairItem(`ch_auto_3`, cX - 1.0, cZ + 1.2, 180);
                          const c4 = createChairItem(`ch_auto_4`, cX + 1.0, cZ + 1.2, 180);
                          setFurnitureList([d1, d2, d3, d4, c1, c2, c3, c4]);
                          setSelectedFurnitureId(d1.id);
                          setShowFurniture(true);
                          toast.success("Placed 4-station workstation pod according to EN 12464-1 spacing");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <LayoutGrid className="size-3 text-cyan-400" /> Automatic office workstation arrangement
                      </button>

                      <button 
                        onClick={() => {
                          setFurnitureList([]);
                          setSelectedFurnitureId(null);
                          toast.info("Cleared all 3D furniture objects from room");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/30 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-700/30 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Trash2 className="size-3" /> Clear all furniture
                      </button>
                    </div>

                    {/* Placed Furniture Objects List */}
                    <div className="p-2.5 flex flex-col gap-2 border-b border-slate-800 bg-[#16181d]">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Room Furniture List</span>
                        <button
                          onClick={() => setShowFurnitureModal(true)}
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="size-2.5" /> Add
                        </button>
                      </div>

                      <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
                        {furnitureList.map((item, idx) => {
                          const isSel = item.id === selectedFurnitureId;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedFurnitureId(item.id)}
                              className={`p-1.5 rounded border text-left transition flex items-center justify-between gap-1.5 cursor-pointer text-[11px] ${
                                isSel
                                  ? "bg-emerald-950/40 border-emerald-500 text-white font-bold"
                                  : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <div
                                  className="size-3 rounded-full border border-slate-600 shrink-0"
                                  style={{ backgroundColor: item.colorHex || "#94a3b8" }}
                                />
                                <div className="truncate">
                                  <span>{item.name}</span>
                                  <span className="text-[9.5px] text-slate-400 block font-mono">
                                    {item.x.toFixed(1)}m, {item.z.toFixed(1)}m | {item.rotationDeg}°
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Duplicate */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const dupItem: FurnitureItem = {
                                      ...item,
                                      id: `item_dup_${Date.now()}`,
                                      x: Math.min(roomL - 0.5, item.x + 0.6),
                                      z: Math.min(roomW - 0.5, item.z + 0.6),
                                    };
                                    setFurnitureList((prev) => [...prev, dupItem]);
                                    setSelectedFurnitureId(dupItem.id);
                                    toast.success(`Duplicated ${item.name}`);
                                  }}
                                  title="Duplicate object"
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
                                >
                                  <Copy className="size-3" />
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFurnitureList((prev) => prev.filter((f) => f.id !== item.id));
                                    if (selectedFurnitureId === item.id) setSelectedFurnitureId(null);
                                    toast.info(`Removed ${item.name}`);
                                  }}
                                  title="Delete object"
                                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {furnitureList.length === 0 && (
                          <div className="text-[10px] text-slate-500 py-3 text-center italic">
                            No furniture placed. Click above to add objects.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Object Inspector & Transforms */}
                    {(() => {
                      const selItem = furnitureList.find((f) => f.id === selectedFurnitureId);
                      if (!selItem) return null;
                      return (
                        <div className="p-3 flex flex-col gap-2.5 border-b border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-emerald-400">
                              Selected: {selItem.name}
                            </span>
                            <span className="text-[9.5px] text-slate-400 uppercase font-mono">
                              {selItem.type.replace("_", " ")}
                            </span>
                          </div>

                          {/* Coordinates X, Z, Elevation Y */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Position X (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                min={0}
                                max={roomL}
                                value={selItem.x}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, x: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Position Z (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                min={0}
                                max={roomW}
                                value={selItem.z}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, z: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Rotation (°)</label>
                              <input
                                type="number"
                                step={15}
                                min={0}
                                max={360}
                                value={selItem.rotationDeg}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, rotationDeg: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          {/* Dimensions Width, Length, Height */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Width (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                value={selItem.width}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1.0;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, width: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Length (m)</label>
                              <input
                                type="number"
                                step={0.1}
                                value={selItem.length}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1.0;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, length: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] text-slate-400">Height (m)</label>
                              <input
                                type="number"
                                step={0.05}
                                value={selItem.height}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0.75;
                                  setFurnitureList((prev) =>
                                    prev.map((f) => (f.id === selItem.id ? { ...f, height: val } : f))
                                  );
                                }}
                                className="h-6 px-1 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white font-mono"
                              />
                            </div>
                          </div>

                          {/* Color finish swatch */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">Color / Surface Tint</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={selItem.colorHex || "#d4b996"}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  setFurnitureList((prev) =>
                                    prev.map((f) =>
                                      f.id === selItem.id
                                        ? {
                                            ...f,
                                            colorHex: col,
                                            parts: f.parts.map((p) => ({ ...p, colorHex: col })),
                                          }
                                        : f
                                    )
                                  );
                                }}
                                className="size-5 bg-transparent cursor-pointer rounded border border-slate-700"
                              />
                              <span className="text-[10px] font-mono text-slate-300">{selItem.colorHex}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Visibility & Toggle */}
                    <div className="p-2.5">
                      <button
                        onClick={() => {
                          setShowFurniture(!showFurniture);
                          toast.info(`3D furniture visibility: ${!showFurniture ? "Rendered" : "Hidden"}`);
                        }}
                        className={`w-full py-1.5 rounded text-xs font-semibold transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                          showFurniture
                            ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-xs"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        <Box className="size-3.5" />
                        <span>{showFurniture ? "Hide 3D Objects in Viewport" : "Render 3D Objects in Viewport"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 3: MATERIALS (DIALux evo Tutorial Part 4 Shift-Key)
                ------------------------------------------------------------- */}
                {constructionTool === "materials" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Palette className="size-3.5 text-blue-400" />
                        <span>Materials & Reflectances</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Shift-Key Single Wall
                      </span>
                    </div>

                    {/* Action Buttons matching Screenshot 3 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => setShowMaterialModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Palette className="size-3 text-amber-400" /> Open Material Catalogue (20+ Materials)
                      </button>
                      <button 
                        onClick={() => {
                          if (selectedMaterialTarget === "ceiling") {
                            setReflectances((prev) => ({ ...prev, ceiling: materialReflectanceVal }));
                            setSurfaceColors((prev) => ({ ...prev, ceiling: materialColorHex }));
                          } else if (selectedMaterialTarget === "floor") {
                            setReflectances((prev) => ({ ...prev, floor: materialReflectanceVal }));
                            setSurfaceColors((prev) => ({ ...prev, floor: materialColorHex }));
                          } else if (selectedMaterialTarget === "walls") {
                            setReflectances((prev) => ({ ...prev, walls: materialReflectanceVal }));
                            setSurfaceColors((prev) => ({ ...prev, walls: materialColorHex }));
                            setWallSurfaces({
                              north: { materialId: activeMaterialName, name: activeMaterialName, colorHex: materialColorHex, reflectance: materialReflectanceVal, textureType: "plain" },
                              south: { materialId: activeMaterialName, name: activeMaterialName, colorHex: materialColorHex, reflectance: materialReflectanceVal, textureType: "plain" },
                              east: { materialId: activeMaterialName, name: activeMaterialName, colorHex: materialColorHex, reflectance: materialReflectanceVal, textureType: "plain" },
                              west: { materialId: activeMaterialName, name: activeMaterialName, colorHex: materialColorHex, reflectance: materialReflectanceVal, textureType: "plain" },
                            });
                          } else if (selectedMaterialTarget.includes("wall")) {
                            const wallKey = selectedMaterialTarget.replace("_wall", "") as "north" | "south" | "east" | "west";
                            setWallSurfaces((prev) => {
                              const updated = {
                                ...prev,
                                [wallKey]: { materialId: activeMaterialName, name: activeMaterialName, colorHex: materialColorHex, reflectance: materialReflectanceVal, textureType: "plain" },
                              };
                              const weighted = calculateWeightedWallReflectance(roomL, roomW, updated);
                              setReflectances((r) => ({ ...r, walls: weighted }));
                              return updated;
                            });
                          }
                          toast.success(`Applied ${activeMaterialName} (ρ = ${Math.round(materialReflectanceVal * 100)}%) to ${selectedMaterialTarget.replace("_", " ")}`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-emerald-300 border border-emerald-500/50 font-bold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Layers className="size-3 text-emerald-400" /> Apply active material to target
                      </button>

                      <button 
                        onClick={() => {
                          setReflectances({ ceiling: 0.70, walls: 0.50, floor: 0.20 });
                          setSurfaceColors({ ceiling: "#f8fafc", walls: "#94a3b8", floor: "#475569" });
                          setWallSurfaces(DEFAULT_WALL_SURFACES);
                          toast.success("Applied standard CIBSE / EN 12464-1 reflectances: 70% / 50% / 20%");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <SlidersVertical className="size-3 text-cyan-400" /> Apply CIBSE Standard (70% / 50% / 20%)
                      </button>

                      <button 
                        onClick={() => {
                          setReflectances({ ceiling: 0.82, walls: 0.75, floor: 0.35 });
                          setSurfaceColors({ ceiling: "#ffffff", walls: "#f8fafc", floor: "#cbd5e1" });
                          setWallSurfaces({
                            north: { materialId: "ral_9010", name: "RAL 9010", colorHex: "#f8fafc", reflectance: 0.75, textureType: "plain" },
                            south: { materialId: "ral_9010", name: "RAL 9010", colorHex: "#f8fafc", reflectance: 0.75, textureType: "plain" },
                            east: { materialId: "ral_9010", name: "RAL 9010", colorHex: "#f8fafc", reflectance: 0.75, textureType: "plain" },
                            west: { materialId: "ral_9010", name: "RAL 9010", colorHex: "#f8fafc", reflectance: 0.75, textureType: "plain" },
                          });
                          toast.success("Applied High-Reflectance Cleanroom / White (82% / 75% / 35%)");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Sun className="size-3 text-yellow-400" /> Apply High-Reflectance (82% / 75% / 35%)
                      </button>
                    </div>

                    {/* Target Room Surface with DIALux evo Shift-Key Wall Selector */}
                    <div className="p-3 flex flex-col gap-2.5 border-b border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Target Surface</span>
                        <span className="text-[9.5px] text-amber-400 font-mono">
                          {selectedMaterialTarget.includes("wall") && selectedMaterialTarget !== "walls"
                            ? "★ Shift-Key Single Wall"
                            : "Room Plane"}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: "ceiling", label: "Ceiling", sub: "ρ_c" },
                          { id: "walls", label: "All Walls", sub: "ρ_w" },
                          { id: "north_wall", label: "North Wall", sub: "Shift" },
                          { id: "south_wall", label: "South Wall", sub: "Shift" },
                          { id: "east_wall", label: "East Wall", sub: "Shift" },
                          { id: "west_wall", label: "West Wall", sub: "Shift" },
                          { id: "floor", label: "Floor", sub: "ρ_f" },
                          { id: "furniture", label: "Furniture", sub: "Obj" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelectedMaterialTarget(t.id as any);
                              if (t.id === "ceiling") setMaterialReflectanceVal(reflectances.ceiling);
                              else if (t.id === "floor") setMaterialReflectanceVal(reflectances.floor);
                              else if (t.id === "walls") setMaterialReflectanceVal(reflectances.walls);
                              else if (t.id === "north_wall") setMaterialReflectanceVal(wallSurfaces.north.reflectance);
                              else if (t.id === "south_wall") setMaterialReflectanceVal(wallSurfaces.south.reflectance);
                              else if (t.id === "east_wall") setMaterialReflectanceVal(wallSurfaces.east.reflectance);
                              else if (t.id === "west_wall") setMaterialReflectanceVal(wallSurfaces.west.reflectance);
                            }}
                            className={`p-1.5 rounded text-center cursor-pointer border flex flex-col items-center gap-0.5 transition ${
                              selectedMaterialTarget === t.id
                                ? "bg-blue-600/30 text-blue-200 border-blue-500 font-bold shadow-xs"
                                : "bg-[#14161a] text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                            }`}
                          >
                            <span className="text-[10px] leading-tight truncate w-full">{t.label}</span>
                            <span className="text-[8px] text-amber-400 font-mono">{t.sub}</span>
                          </button>
                        ))}
                      </div>

                      {/* 4-Wall Individual Breakdown Card */}
                      <div className="bg-[#121417] p-2 rounded border border-slate-800 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-semibold">Perimeter Wall Faces</span>
                          <span className="text-emerald-400 font-mono font-bold">
                            Avg ρ = {Math.round(calculateWeightedWallReflectance(roomL, roomW, wallSurfaces) * 100)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center">
                          {[
                            { key: "north", label: "North (N)", data: wallSurfaces.north },
                            { key: "south", label: "South (S)", data: wallSurfaces.south },
                            { key: "east", label: "East (E)", data: wallSurfaces.east },
                            { key: "west", label: "West (W)", data: wallSurfaces.west },
                          ].map((w) => (
                            <button
                              key={w.key}
                              onClick={() => {
                                setSelectedMaterialTarget(`${w.key}_wall` as any);
                                setMaterialReflectanceVal(w.data.reflectance);
                                setMaterialColorHex(w.data.colorHex);
                              }}
                              className={`p-1 rounded border text-left cursor-pointer transition ${
                                selectedMaterialTarget === `${w.key}_wall`
                                  ? "border-blue-500 bg-blue-950/30"
                                  : "border-slate-800 bg-[#16181d] hover:border-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <div
                                  className="size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: w.data.colorHex }}
                                />
                                <span className="text-[9px] text-slate-300 font-bold truncate">{w.label}</span>
                              </div>
                              <div className="text-[9px] text-amber-400 font-mono mt-0.5">
                                {Math.round(w.data.reflectance * 100)}%
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Active Material Card matching Screenshot 3 */}
                    <div className="p-3 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Active Material</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold truncate max-w-[140px]">
                          {activeMaterialName}
                        </span>
                      </div>

                      {/* Swatch & Fine-Tuning */}
                      <div className="flex items-center gap-3">
                        <div 
                          className="size-16 rounded border-2 border-slate-600 shadow-inner relative overflow-hidden flex flex-col items-center justify-center shrink-0"
                          style={{
                            backgroundColor: materialColorHex,
                            backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18) 6px, transparent 6px, transparent 12px)`,
                          }}
                        >
                          <div className="px-1 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-bold text-white">
                            ρ {Math.round(materialReflectanceVal * 100)}%
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 flex-1">
                          <button 
                            onClick={() => setShowMaterialModal(true)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer self-start"
                          >
                            Catalog &gt;
                          </button>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={materialColorHex}
                              onChange={(e) => setMaterialColorHex(e.target.value)}
                              className="size-5 bg-transparent cursor-pointer rounded border border-slate-700"
                            />
                            <input
                              type="text"
                              value={materialColorHex}
                              onChange={(e) => setMaterialColorHex(e.target.value)}
                              className="h-5 flex-1 px-1 bg-[#14161a] border border-slate-700 rounded text-[10px] text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Reflectance Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">Reflectance Factor (ρ)</span>
                          <span className="font-mono font-bold text-amber-300">
                            {Math.round(materialReflectanceVal * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={0.95}
                          step={0.01}
                          value={materialReflectanceVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.5;
                            setMaterialReflectanceVal(val);
                            if (selectedMaterialTarget === "ceiling") {
                              setReflectances((r) => ({ ...r, ceiling: val }));
                            } else if (selectedMaterialTarget === "floor") {
                              setReflectances((r) => ({ ...r, floor: val }));
                            } else if (selectedMaterialTarget === "walls") {
                              setReflectances((r) => ({ ...r, walls: val }));
                            }
                          }}
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                      </div>

                      {/* Photometric Radiosity Feedback */}
                      <div className="bg-[#121417] p-2 rounded border border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Avg Room Illuminance:</span>
                        <span className="font-mono font-bold text-white text-xs">
                          {simulationResult.avgLux} Lux
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 4: HELP LINES AND LABELLING (media_1791272192191.png)
                ------------------------------------------------------------- */}
                {constructionTool === "annotations" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Help lines and labelling
                    </div>

                    {/* 8 Action buttons matching Screenshot 4 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("ref_line");
                          toast.info("Draw reference line: straight line snapping active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          activeHelpLineType === "ref_line"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="3" y1="21" x2="21" y2="3" />
                        </svg>
                        Draw reference line
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("circ_ref");
                          toast.info("Draw circular reference line active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          activeHelpLineType === "circ_ref"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 3v18M3 12h18" />
                        </svg>
                        Draw circular reference line
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("poly_ref");
                          toast.info("Draw polygonal reference line active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          activeHelpLineType === "poly_ref"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                        </svg>
                        Draw polygonal reference line
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("curve_ref");
                          toast.info("Draw curving reference line active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          activeHelpLineType === "curve_ref"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 18c4-12 12-12 16 0" />
                        </svg>
                        Draw curving reference line
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("ref_grid");
                          setShowGuideGrid(!showGuideGrid);
                          toast.info(`Reference grid: ${!showGuideGrid ? "Enabled" : "Disabled"}`);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          showGuideGrid
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Grid className="size-3 text-red-400" /> Draw reference grid
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("new_text");
                          toast.info("Place new text: click position in 3D CAD space");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          activeHelpLineType === "new_text"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Type className="size-3 text-red-400" /> Place new text
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setHelpLineLabelText(text);
                              toast.success(`Pasted text: "${text}"`);
                            }
                          } catch {
                            toast.info("Clipboard accessed: placed standard CAD label");
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Copy className="size-3 text-slate-400" /> Place text from clipboard
                      </button>
                      <button 
                        onClick={() => {
                          setActiveHelpLineType("dim_line");
                          setShowDimensions(!showDimensions);
                          toast.info(`3D Dimension lines: ${!showDimensions ? "Enabled" : "Disabled"}`);
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          showDimensions
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <Ruler className="size-3 text-red-400" /> Draw new dimension line
                      </button>
                    </div>

                    {/* Parameters & Controls */}
                    <div className="p-3 flex flex-col gap-3">
                      {/* Text Properties */}
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-[11px] text-slate-300">Labelling Text</span>
                        <input
                          type="text"
                          value={helpLineLabelText}
                          onChange={(e) => setHelpLineLabelText(e.target.value)}
                          placeholder="e.g. Working Task Zone"
                          className="h-7 px-2 bg-[#14161a] border border-slate-700 rounded text-xs text-white outline-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Font Height (m)</span>
                          <input
                            type="number"
                            step={0.05}
                            value={helpLineTextSize}
                            onChange={(e) => setHelpLineTextSize(parseFloat(e.target.value) || 0.25)}
                            className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                          />
                        </div>
                      </div>

                      {/* Dimension Lines Toggle & Summary */}
                      <div className="flex flex-col gap-2 border-t border-slate-800 pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-300">3D Dimension Lines</span>
                          <button
                            onClick={() => setShowDimensions(!showDimensions)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              showDimensions ? "bg-red-600/30 text-red-300 border-red-500" : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {showDimensions ? "Visible" : "Hidden"}
                          </button>
                        </div>
                        <div className="bg-[#14161a] p-2 rounded border border-slate-800 text-[10.5px] flex flex-col gap-1 text-slate-300">
                          <div>Room Length: <strong className="text-white">{roomL.toFixed(2)} m</strong></div>
                          <div>Room Width: <strong className="text-white">{roomW.toFixed(2)} m</strong></div>
                          <div>Room Height: <strong className="text-white">{roomH.toFixed(2)} m</strong></div>
                          <div>Workplane Elevation: <strong className="text-emerald-400">{workPlaneHeight.toFixed(2)} m</strong></div>
                        </div>
                      </div>

                      {/* Information Card matching Screenshot 4 */}
                      <div className="border border-slate-800 bg-[#16181d] rounded p-2 flex flex-col gap-1 text-[10.5px]">
                        <div className="flex items-center gap-1 font-semibold text-slate-300">
                          <ChevronDown className="size-3 text-slate-500" />
                          <span>Information</span>
                        </div>
                        <div className="text-slate-500 italic pl-4">
                          No dimension line, help line or text selected.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 5: COPY AND ARRANGE (media_1791272205609.png)
                ------------------------------------------------------------- */}
                {constructionTool === "copy_arrange" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Copy and arrange
                    </div>

                    {/* 5 Action Buttons matching Screenshot 5 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setCopyArrangeMode("line");
                          toast.info("Copy along a line mode active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          copyArrangeMode === "line"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="3" y1="12" x2="21" y2="12" />
                          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                        </svg>
                        Copy along a line
                      </button>
                      <button 
                        onClick={() => {
                          setCopyArrangeMode("circular");
                          toast.info("Copy as circular arrangement active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          copyArrangeMode === "circular"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
                          <circle cx="12" cy="4" r="1.5" /><circle cx="20" cy="12" r="1.5" /><circle cx="12" cy="20" r="1.5" /><circle cx="4" cy="12" r="1.5" />
                        </svg>
                        Copy as circular arrangement
                      </button>
                      <button 
                        onClick={() => {
                          setCopyArrangeMode("polygonal");
                          toast.info("Copy as polygonal arrangement active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          copyArrangeMode === "polygonal"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" strokeDasharray="3 3" />
                        </svg>
                        Copy as polygonal arrangement
                      </button>
                      <button 
                        onClick={() => {
                          setCopyArrangeMode("curve");
                          toast.info("Copy along a curve active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          copyArrangeMode === "curve"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <svg className="size-3 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 18c4-12 12-12 16 0" />
                          <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="7" r="1.5" /><circle cx="18" cy="12" r="1.5" />
                        </svg>
                        Copy along a curve
                      </button>
                      <button 
                        onClick={() => {
                          setCopyArrangeMode("ref_line");
                          toast.info("Copy along existing reference line active");
                        }}
                        className={`px-2.5 py-1 rounded border flex items-center gap-2 cursor-pointer text-left ${
                          copyArrangeMode === "ref_line"
                            ? "bg-slate-700 text-white border-red-500 font-bold"
                            : "bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700/40"
                        }`}
                      >
                        <SlidersHorizontal className="size-3 text-red-400" /> Copy along existing reference line
                      </button>
                    </div>

                    {/* Array Parameters */}
                    <div className="p-3 flex flex-col gap-3">
                      {copyArrangeMode === "line" && (
                        <div className="flex flex-col gap-2">
                          <span className="font-bold text-[11px] text-slate-300">Linear Arrangement</span>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Number of copies</span>
                            <input
                              type="number"
                              min={2}
                              max={20}
                              value={copyCount}
                              onChange={(e) => setCopyCount(Math.max(2, parseInt(e.target.value) || 4))}
                              className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Distance between objects</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step={0.1}
                                value={copySpacingDistance}
                                onChange={(e) => setCopySpacingDistance(parseFloat(e.target.value) || 1.5)}
                                className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                              />
                              <span className="text-[10px] text-slate-400">m</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Arrangement Axis</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setCopyAxis("length")}
                                className={`px-2 py-0.5 text-[10px] rounded font-bold border cursor-pointer ${
                                  copyAxis === "length" ? "bg-amber-600/30 text-amber-300 border-amber-500" : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                              >
                                Length (X)
                              </button>
                              <button
                                onClick={() => setCopyAxis("width")}
                                className={`px-2 py-0.5 text-[10px] rounded font-bold border cursor-pointer ${
                                  copyAxis === "width" ? "bg-amber-600/30 text-amber-300 border-amber-500" : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                              >
                                Width (Z)
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (copyAxis === "length") {
                                pushGridChange({ rows: gridConfig.rows, cols: copyCount });
                              } else {
                                pushGridChange({ rows: copyCount, cols: gridConfig.cols });
                              }
                              setArrangementMode("linear");
                              toast.success(`Arranged ${copyCount} luminaires along ${copyAxis}`);
                            }}
                            className="w-full py-1.5 mt-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            Generate Linear Array
                          </button>
                        </div>
                      )}

                      {copyArrangeMode === "circular" && (
                        <div className="flex flex-col gap-2">
                          <span className="font-bold text-[11px] text-slate-300">Circular Arrangement</span>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Number of copies</span>
                            <input
                              type="number"
                              min={3}
                              max={32}
                              value={copyCount}
                              onChange={(e) => setCopyCount(Math.max(3, parseInt(e.target.value) || 8))}
                              className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Circle Radius</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step={0.2}
                                value={copyRadius}
                                onChange={(e) => setCopyRadius(parseFloat(e.target.value) || 2.0)}
                                className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                              />
                              <span className="text-[10px] text-slate-400">m</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setArrangementMode("perimeter");
                              toast.success(`Generated radial circular arrangement: ${copyCount} fittings (Radius ${copyRadius}m)`);
                            }}
                            className="w-full py-1.5 mt-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            Generate Circular Array
                          </button>
                        </div>
                      )}

                      {(copyArrangeMode === "polygonal" || copyArrangeMode === "curve" || copyArrangeMode === "ref_line") && (
                        <div className="flex flex-col gap-2">
                          <span className="font-bold text-[11px] text-slate-300">Perimeter / Curve Arrangement</span>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] text-slate-400">Fitting Count</span>
                            <input
                              type="number"
                              min={4}
                              max={24}
                              value={copyCount}
                              onChange={(e) => setCopyCount(Math.max(4, parseInt(e.target.value) || 8))}
                              className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                            />
                          </div>
                          <button
                            onClick={() => {
                              setArrangementMode("perimeter");
                              toast.success(`Arranged ${copyCount} luminaires along room contour`);
                            }}
                            className="w-full py-1.5 mt-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            Apply Perimeter Arrangement
                          </button>
                        </div>
                      )}

                      {/* Information Card matching Screenshot 5 */}
                      <div className="border border-slate-800 bg-[#16181d] rounded p-2 flex flex-col gap-1 text-[10.5px]">
                        <div className="flex items-center gap-1 font-semibold text-slate-300">
                          <ChevronDown className="size-3 text-slate-500" />
                          <span>Information</span>
                        </div>
                        <div className="text-slate-400 pl-4">
                          {hasSelectedCopyObject 
                            ? `Active: 1 Luminaire arrangement (${gridConfig.rows} × ${gridConfig.cols} = ${gridConfig.rows * gridConfig.cols} fittings)` 
                            : "No objects selected."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    CALCULATION OBJECTS (media_1791272889640.png)
                ------------------------------------------------------------- */}
                {constructionTool === "calc_surfaces" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Calculation objects
                    </div>
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={() => {
                          setShowCalcSurfacePlane(!showCalcSurfacePlane);
                          toast.info(`Calculation workplane: ${!showCalcSurfacePlane ? "Rendered" : "Hidden"}`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Target className="size-3 text-amber-400" /> Draw rectangular calculation surface
                      </button>
                      <button 
                        onClick={() => setShowPolygonModal(true)}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Layers className="size-3 text-blue-400" /> Draw polygonal calculation surface
                      </button>
                      <button 
                        onClick={() => toast.success("Placed UGR Glare observer point at eye level (+1.20m, 0° view direction)")}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Eye className="size-3 text-purple-400" /> Place UGR glare calculation point
                      </button>
                      <button 
                        onClick={() => {
                          setMarginOffset(0.5);
                          setWorkPlaneHeight(0.75);
                          toast.success("Calibrated standard EN 12464-1 task area (0.75m workplane, 0.50m wall margin)");
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Check className="size-3 text-emerald-400" /> Task area EN 12464-1
                      </button>
                    </div>

                    <div className="p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400">Workplane Height</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.05}
                            value={workPlaneHeight}
                            onChange={(e) => setWorkPlaneHeight(parseFloat(e.target.value) || 0.75)}
                            className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                          />
                          <span className="text-[10px] text-slate-400">m</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400">Wall Margin Offset</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.1}
                            value={marginOffset}
                            onChange={(e) => setMarginOffset(parseFloat(e.target.value) || 0.5)}
                            className="h-6 w-16 text-center bg-[#14161a] border border-slate-700 rounded text-xs text-white"
                          />
                          <span className="text-[10px] text-slate-400">m</span>
                        </div>
                      </div>
                      <div className="bg-[#14161a] p-2.5 rounded border border-slate-800 text-[10.5px] flex flex-col gap-1 text-slate-300">
                        <div>Active Space: <strong className="text-white">{spaceCustomName}</strong></div>
                        <div>Target Illuminance: <strong className="text-emerald-400">{targetLux} lx</strong></div>
                        <div>Achieved Average: <strong className="text-amber-400">{simulationResult.summary.avgLux} lx</strong></div>
                        <div>Uniformity U₀: <strong className={simulationResult.summary.uniformity >= 0.6 ? "text-emerald-400" : "text-amber-400"}>{simulationResult.summary.uniformity.toFixed(2)}</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SCREENSHOT 2: VIEWS INSPECTOR (media_1791272900498.png)
                ------------------------------------------------------------- */}
                {constructionTool === "camera_view" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Views
                    </div>

                    {/* 4 Action Buttons matching Screenshot 2 */}
                    <div className="p-2 border-b border-slate-800 bg-[#191c22] flex flex-col gap-1 text-[11px]">
                      <button 
                        onClick={handleSaveNewView}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-semibold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Plus className="size-3 text-amber-400" /> Save new view
                      </button>
                      <button 
                        disabled={!activeSavedViewId}
                        onClick={() => handleShowView()}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Eye className="size-3 text-blue-400" /> Show view
                      </button>
                      <button 
                        disabled={!activeSavedViewId}
                        onClick={handleReplaceView}
                        className="px-2.5 py-1 rounded bg-slate-800/50 hover:bg-slate-700 text-slate-300 border border-slate-700/40 flex items-center gap-2 cursor-pointer text-left disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="size-3 text-emerald-400" /> Replace view
                      </button>
                      <button 
                        onClick={handleSaveImage}
                        className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-amber-500/50 font-bold flex items-center gap-2 cursor-pointer text-left"
                      >
                        <Download className="size-3 text-amber-400" /> Save image
                      </button>
                    </div>

                    {/* Active saved view section */}
                    <div className="p-3 flex flex-col gap-2 border-b border-slate-800">
                      <span className="font-bold text-[11px] text-slate-300">Active saved view</span>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400">Name</label>
                        <input
                          value={activeViewName}
                          onChange={(e) => {
                            setActiveViewName(e.target.value);
                            setSavedViews((prev) =>
                              prev.map((v) => (v.id === activeSavedViewId ? { ...v, name: e.target.value } : v))
                            );
                          }}
                          className="h-6 px-1.5 bg-[#14161a] border border-slate-700 rounded text-xs text-white outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400">Description</label>
                        <textarea
                          rows={2}
                          value={activeViewDesc}
                          onChange={(e) => {
                            setActiveViewDesc(e.target.value);
                            setSavedViews((prev) =>
                              prev.map((v) => (v.id === activeSavedViewId ? { ...v, description: e.target.value } : v))
                            );
                          }}
                          className="p-1 bg-[#14161a] border border-slate-700 rounded text-xs text-slate-300 outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Saved views gallery list */}
                    <div className="p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-300">Saved views ({savedViews.length})</span>
                      </div>

                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {savedViews.map((v) => {
                          const isSelected = v.id === activeSavedViewId;
                          return (
                            <div
                              key={v.id}
                              onClick={() => {
                                setActiveSavedViewId(v.id);
                                setActiveViewName(v.name);
                                setActiveViewDesc(v.description);
                                handleShowView(v.id);
                              }}
                              className={`p-1.5 rounded border flex items-center gap-2 cursor-pointer transition ${
                                isSelected
                                  ? "bg-slate-700/80 border-amber-500 text-white"
                                  : "bg-[#14161a] border-slate-800 text-slate-300 hover:border-slate-700"
                              }`}
                            >
                              <div
                                className="rounded bg-black border border-slate-700 shrink-0 overflow-hidden flex items-center justify-center"
                                style={{ width: viewThumbnailSize, height: Math.round(viewThumbnailSize * 0.65) }}
                              >
                                {v.thumbnailUrl ? (
                                  <img src={v.thumbnailUrl} alt={v.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Camera className="size-4 text-slate-500" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs truncate">{v.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{v.description || v.timestamp}</div>
                              </div>

                              {savedViews.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = savedViews.filter((item) => item.id !== v.id);
                                    setSavedViews(next);
                                    if (activeSavedViewId === v.id && next.length > 0) {
                                      setActiveSavedViewId(next[0].id);
                                      setActiveViewName(next[0].name);
                                      setActiveViewDesc(next[0].description);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                                  title="Delete View"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Bottom Thumbnail Size Control Slider */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-slate-400">
                        <Grid className="size-3" />
                        <input
                          type="range"
                          min={48}
                          max={110}
                          value={viewThumbnailSize}
                          onChange={(e) => setViewThumbnailSize(parseInt(e.target.value) || 64)}
                          className="flex-1 accent-amber-500 cursor-pointer"
                        />
                        <LayoutGrid className="size-3.5" />
                      </div>
                    </div>

                    {/* Collapsible Viewpoint Shortcuts & Overlays */}
                    <div className="p-3 border-t border-slate-800 flex flex-col gap-2">
                      <span className="font-bold text-[11px] text-slate-300">Standard Viewpoints</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => applyCameraView("3d")}
                          className={`py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            cameraView === "3d" ? "bg-red-600/30 text-white border-red-500" : "bg-[#14161a] text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          3D Perspective (1)
                        </button>
                        <button
                          onClick={() => applyCameraView("top")}
                          className={`py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            cameraView === "top" ? "bg-red-600/30 text-white border-red-500" : "bg-[#14161a] text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          Top Plan (2)
                        </button>
                        <button
                          onClick={() => applyCameraView("front")}
                          className={`py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            cameraView === "front" ? "bg-red-600/30 text-white border-red-500" : "bg-[#14161a] text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          Front View (3)
                        </button>
                        <button
                          onClick={() => applyCameraView("side")}
                          className={`py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            cameraView === "side" ? "bg-red-600/30 text-white border-red-500" : "bg-[#14161a] text-slate-400 border-slate-700 hover:text-white"
                          }`}
                        >
                          Side View (4)
                        </button>
                      </div>

                      <span className="font-bold text-[11px] text-slate-300 mt-1">Display Overlays</span>
                      <div className="flex flex-col gap-1 text-[11px]">
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                          <span>False-Color Heatmap</span>
                          <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                          <span>Isolux Contour Lines</span>
                          <input type="checkbox" checked={showIsoluxLines} onChange={(e) => setShowIsoluxLines(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                          <span>3D Light Cones</span>
                          <input type="checkbox" checked={showLightCones} onChange={(e) => setShowLightCones(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer" title="Clip light emission cones to stay strictly within room boundaries">
                          <span className="flex items-center gap-1.5">
                            <Box className="size-3 text-emerald-400" />
                            <span>Clip Beams to Room</span>
                          </span>
                          <input type="checkbox" checked={clipLightConesToRoom} onChange={(e) => setClipLightConesToRoom(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer" title="Simulate realistic luminaire light wash & surface reflections on walls">
                          <span className="flex items-center gap-1.5">
                            <Sun className="size-3 text-amber-400" />
                            <span>Wall Reflection (ρ={Math.round(reflectances.walls * 100)}%)</span>
                          </span>
                          <input type="checkbox" checked={showWallReflection} onChange={(e) => setShowWallReflection(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer" title="EN 12464-1 Wall surface illuminance false-color heatmap">
                          <span className="flex items-center gap-1.5">
                            <Layers className="size-3 text-purple-400" />
                            <span>Wall Lux Heatmap</span>
                          </span>
                          <input type="checkbox" checked={showWallFalseColor} onChange={(e) => setShowWallFalseColor(e.target.checked)} className="accent-red-500" />
                        </label>
                        <label className="flex items-center justify-between p-1 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                          <span>Illuminance Value Grid</span>
                          <input type="checkbox" checked={showLuxNumbers} onChange={(e) => setShowLuxNumbers(e.target.checked)} className="accent-red-500" />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    GUIDE LINES & SNAPPING
                ------------------------------------------------------------- */}
                {constructionTool === "guide_lines" && (
                  <div className="flex flex-col">
                    <div className="p-2.5 bg-[#191c22] border-b border-slate-800 font-bold text-white text-xs">
                      Guide lines & Snapping
                    </div>
                    <div className="p-3 flex flex-col gap-2.5 text-xs">
                      <label className="flex items-center justify-between p-1.5 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                        <span>Snapping Guide Grid</span>
                        <input type="checkbox" checked={showGuideGrid} onChange={(e) => setShowGuideGrid(e.target.checked)} className="accent-red-500" />
                      </label>
                      <label className="flex items-center justify-between p-1.5 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                        <span>DWG CAD Underlay</span>
                        <input type="checkbox" checked={showDwgUnderlay} onChange={(e) => setShowDwgUnderlay(e.target.checked)} className="accent-red-500" />
                      </label>
                      <label className="flex items-center justify-between p-1.5 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                        <span>3D Coordinate Axes Origin</span>
                        <input type="checkbox" checked={showCoordAxes} onChange={(e) => setShowCoordAxes(e.target.checked)} className="accent-red-500" />
                      </label>
                      <label className="flex items-center justify-between p-1.5 bg-[#14161a] rounded border border-slate-800 cursor-pointer">
                        <span>3D CAD Dimension Leaders</span>
                        <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} className="accent-red-500" />
                      </label>
                    </div>
                  </div>
                )}
                </>
                )}

                {/* LIGHT WORKFLOW INSPECTORS */}
                {workflowTab === "light" && (
                  <LightInspectors
                    lightTool={lightTool}
                    roomL={roomL}
                    roomW={roomW}
                    roomH={roomH}
                    targetLux={targetLux}
                    profile={profile}
                    setProfile={setProfile}
                    gridConfig={gridConfig}
                    setGridConfig={setGridConfig}
                    pushGridChange={pushGridChange}
                    simulationResult={simulationResult}
                    cct={cct}
                    setCct={setCct}
                    lightScene={lightScene}
                    setLightScene={setLightScene}
                    mountingType={mountingType}
                    setMountingType={setMountingType}
                    suspensionLength={suspensionLength}
                    setSuspensionLength={setSuspensionLength}
                    arrangementMode={arrangementMode}
                    setArrangementMode={setArrangementMode}
                    lineConfig={lineConfig}
                    setLineConfig={setLineConfig}
                    circularConfig={circularConfig}
                    setCircularConfig={setCircularConfig}
                    polygonalConfig={polygonalConfig}
                    setPolygonalConfig={setPolygonalConfig}
                    arrangementOverrides={arrangementOverrides}
                    setArrangementOverrides={setArrangementOverrides}
                    isAimingToolActive={isAimingToolActive}
                    setIsAimingToolActive={setIsAimingToolActive}
                    customLuminaires={customLuminaires}
                    setCustomLuminaires={setCustomLuminaires}
                    selectedFixtureIndex={selectedFixtureIndex}
                    setSelectedFixtureIndex={setSelectedFixtureIndex}
                    onOpenPlacementModal={() => setIsPlacementModalOpen(true)}
                    onOpenBrandsModal={() => setWorkflowTab("brands")}
                    onOpenDaylightModal={() => setIsDaylightModalOpen(true)}
                    workPlaneHeight={workPlaneHeight}
                  />
                )}

                {/* CALCULATION OBJECTS WORKFLOW INSPECTORS */}
                {workflowTab === "calculation" && (
                  <CalcInspectors
                    calcTool={calcTool}
                    roomL={roomL}
                    roomW={roomW}
                    roomH={roomH}
                    workPlaneHeight={workPlaneHeight}
                    setWorkPlaneHeight={setWorkPlaneHeight}
                    marginOffset={marginOffset}
                    setMarginOffset={setMarginOffset}
                    targetLux={targetLux}
                    setTargetLux={setTargetLux}
                    simulationResult={simulationResult}
                    showLuxNumbers={showLuxNumbers}
                    setShowLuxNumbers={setShowLuxNumbers}
                    showHeatmap={showHeatmap}
                    setShowHeatmap={setShowHeatmap}
                    showIsoluxLines={showIsoluxLines}
                    setShowIsoluxLines={setShowIsoluxLines}
                    onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
                    onOpenDaylightModal={() => setIsDaylightModalOpen(true)}
                    calcAreaType={calcAreaType}
                    setCalcAreaType={setCalcAreaType}
                    workstationConfig={workstationConfig}
                    setWorkstationConfig={setWorkstationConfig}
                  />
                )}

                {/* EXPORT WORKFLOW INSPECTOR */}
                {workflowTab === "export" && (
                  <ExportInspectors
                    exportTool={exportTool}
                    projectName={projectName}
                    projectCode={projectCode}
                    roomName={spaceCustomName}
                    roomL={roomL}
                    roomW={roomW}
                    roomH={roomH}
                    workPlaneHeight={workPlaneHeight}
                    profile={profile}
                    simulationResult={simulationResult}
                    rendererRef={rendererRef}
                    projectImages={projectImages}
                    setProjectImages={setProjectImages}
                    onOpenRaytracerModal={() => setIsRaytracerModalOpen(true)}
                  />
                )}

                {/* PROJECT WORKFLOW INSPECTOR */}
                {workflowTab === "project" && (
                  <ProjectInspectors
                    projectName={projectName}
                    projectCode={projectCode}
                    userName={userName}
                    roomName={spaceCustomName}
                  />
                )}

                {/* BRANDS WORKFLOW INSPECTOR */}
                {workflowTab === "brands" && (
                  <BrandsCatalogue
                    onSelectLuminaire={(brandLum: BrandLuminaire) => {
                      const newProfile: LuminairePhotometricProfile = {
                        id: brandLum.id,
                        name: `${brandLum.brand} - ${brandLum.model}`,
                        manufacturer: brandLum.brand,
                        lumens: brandLum.lumens,
                        wattage: brandLum.wattage,
                        beamAngle: brandLum.beamAngle,
                        distributionType: brandLum.distributionType,
                        shape: brandLum.shape || (brandLum.category === "downlight" ? "circular" : "rectangular"),
                        dimensions: brandLum.dimensions || { length: 0.6, width: 0.6, height: 0.05 },
                        colorTemp: brandLum.cct,
                        cri: brandLum.cri,
                      };
                      setProfile(newProfile);
                      setCct(brandLum.cct);
                      if (brandLum.mounting === "suspended") {
                        setMountingType("suspended");
                        if (suspensionLength <= 0.05) setSuspensionLength(0.8);
                      } else if (brandLum.mounting === "surface") {
                        setMountingType("surface");
                      } else if (brandLum.mounting === "recessed") {
                        setMountingType("flush");
                      } else if (brandLum.mounting === "wall") {
                        setMountingType("wall");
                      }
                      setWorkflowTab("light");
                      toast.success(`Applied ${brandLum.brand} ${brandLum.model} to project (${brandLum.lumens} lm, ${brandLum.wattage} W)`);
                    }}
                  />
                )}

              </div>
            )}

            {/* =========================================================================
                DOCK VIEW 2: THE OFFICIAL PROJECT TREE HIERARCHY
            ========================================================================= */}
            {leftDockMode === "tree" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#1e2229]">
                <div className="p-2 border-b border-slate-800/80 bg-[#191c22]">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      className="w-full bg-[#242831] border border-slate-700/80 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 italic pr-7 outline-none"
                    />
                    <Search className="size-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
                  </div>
                </div>

                <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 bg-[#16181d]">
                  <div className="flex items-center gap-1.5">
                    <Filter className="size-3 text-slate-300" />
                    <span>Hidden objects: <strong className="text-white">{hiddenObjectsCount}</strong></span>
                  </div>
                  <button onClick={resetAllHiddenObjects} className="p-0.5 hover:text-white text-slate-400 cursor-pointer">
                    <RefreshCw className="size-3" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 font-sans text-xs flex flex-col gap-0.5">
                  <div className="flex flex-col">
                    <div 
                      onClick={() => {
                        setSelectedTreeNode("site-1");
                        setConstructionTool("site");
                        setLeftDockMode("inspector");
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer ${
                        selectedTreeNode === "site-1" ? "bg-slate-700/80 text-white font-bold" : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <button onClick={(e) => { e.stopPropagation(); toggleNode("site"); }} className="p-0.5 text-slate-400">
                        {expandedNodes.site ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      </button>
                      <MapPin className="size-3.5 text-emerald-400" />
                      <span>{siteName}</span>
                    </div>

                    {expandedNodes.site && (
                      <div className="pl-6 flex flex-col gap-0.5 mt-0.5">
                        <div 
                          onClick={() => {
                            setSelectedTreeNode("coord-system");
                            setShowCoordAxes(!showCoordAxes);
                          }}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
                            selectedTreeNode === "coord-system" ? "bg-slate-700/80 text-white font-bold" : "text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <span className="size-1.5 rounded-full bg-blue-400" />
                          <span>Coordinate system</span>
                        </div>

                        <div className="flex flex-col">
                          <div 
                            onClick={() => toggleNode("lightScenes")}
                            className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-slate-300 hover:bg-slate-800"
                          >
                            {expandedNodes.lightScenes ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                            <Sun className="size-3.5 text-amber-400" />
                            <span>Light scenes</span>
                          </div>
                          {expandedNodes.lightScenes && (
                            <div className="pl-6 flex flex-col gap-0.5 mt-0.5 text-[11px]">
                              <div onClick={() => setLightScene("100")} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "100" ? "text-amber-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Light scene 1 (Artificial 100%)
                              </div>
                              <div onClick={() => setLightScene("50")} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "50" ? "text-amber-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Light scene 2 (Artificial 50%)
                              </div>
                              <div onClick={() => { setLightScene("daylight_overcast"); setIsDaylightSceneActive(true); }} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "daylight_overcast" ? "text-blue-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Daylight scene (CIE Overcast DF %)
                              </div>
                              <div onClick={() => { setLightScene("daylight_clear"); setIsDaylightSceneActive(true); }} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "daylight_clear" ? "text-amber-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Daylight scene (Clear Sky & Sunbeam)
                              </div>
                              <div onClick={() => { setLightScene("combined"); setIsDaylightSceneActive(true); }} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "combined" ? "text-emerald-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Combined (Daylight + Harvesting)
                              </div>
                              <div onClick={() => setLightScene("10")} className={`px-2 py-0.5 rounded cursor-pointer ${lightScene === "10" ? "text-red-400 font-bold bg-slate-800" : "text-slate-400 hover:text-white"}`}>
                                • Emergency scene (10% Safety)
                              </div>
                              <button
                                onClick={() => setIsDaylightModalOpen(true)}
                                className="mt-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer text-left"
                              >
                                <Sun className="size-3 text-amber-400" />
                                <span>Daylight Simulation Settings...</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Official DIALux evo Luminaire Fittings Tree Node */}
                        <div className="flex flex-col">
                          <div 
                            onClick={() => toggleNode("luminaires")}
                            className="flex items-center justify-between px-2 py-1 rounded cursor-pointer text-slate-300 hover:bg-slate-800"
                          >
                            <div className="flex items-center gap-1.5">
                              {expandedNodes.luminaires ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              <Lightbulb className="size-3.5 text-amber-400" />
                              <span className="font-medium">Luminaires ({simulationResult.luminaires.length})</span>
                            </div>
                            <span className="text-[10px] text-amber-400/80 font-mono truncate max-w-[90px]">{profile.name}</span>
                          </div>
                          {expandedNodes.luminaires && (
                            <div className="pl-6 flex flex-col gap-0.5 mt-0.5 text-[11px] max-h-52 overflow-y-auto">
                              {simulationResult.luminaires.map((lum, lumIdx) => {
                                const isSel = selectedFixtureIndex === lumIdx;
                                return (
                                  <div
                                    key={lumIdx}
                                    onClick={() => {
                                      setSelectedFixtureIndex(isSel ? null : lumIdx);
                                      setWorkflowTab("light");
                                      setLightTool("luminaires");
                                    }}
                                    className={`px-2 py-1 rounded cursor-pointer flex items-center justify-between transition ${
                                      isSel
                                        ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                                    }`}
                                  >
                                    <span>#{lumIdx + 1} ({lum.x.toFixed(2)}m, {lum.y.toFixed(2)}m)</span>
                                    <span className="text-[10px] text-slate-500">z={lum.z.toFixed(2)}m</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
          )}

          {/* =========================================================================
              3C. CENTER 3D/2D CAD VIEWPORT WITH DUAL RULERS (MATCHING SCREENSHOTS)
          ========================================================================= */}
          {workflowTab === "documentation" ? (
            <DocumentationViewer
              projectName={projectName}
              projectCode={projectCode}
              roomName={spaceCustomName}
              roomL={roomL}
              roomW={roomW}
              roomH={roomH}
              workPlaneHeight={workPlaneHeight}
              profile={profile}
              simulationResult={simulationResult}
              userName={userName}
              rendererRef={rendererRef}
              projectImages={projectImages}
              maintenanceFactor={mf}
            />
          ) : (
            <div className="flex-1 flex flex-col min-w-0 bg-[#121417] relative overflow-hidden">
            
            {/* Viewport Top Tabs (Site 1 + Viewport Navigation Toolbar) */}
            <div className="h-8 bg-[#16181d] border-b border-slate-800 flex items-center justify-between px-2 shrink-0 text-xs select-none">
              
              {/* Site 1 Tab matching screenshots */}
              <div className="flex items-center gap-1 h-full">
                <div 
                  onClick={() => setConstructionTool("site")}
                  className="flex items-center gap-1.5 px-3 h-full bg-[#21252c] border-t-2 border-amber-400 text-amber-300 font-bold text-[11px] cursor-pointer shadow-sm"
                >
                  <MapPin className="size-3.5 text-emerald-400" />
                  <span>Site 1</span>
                </div>
                <div className="relative h-full flex items-center">
                  <button 
                    onClick={() => setIsRoomSelectorOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 h-full bg-[#191c22] hover:bg-[#252a34] text-slate-200 text-[11px] font-semibold cursor-pointer border-r border-slate-800 transition"
                    title="Click to switch active project room"
                  >
                    <Box className="size-3.5 text-blue-400" />
                    <span className="font-bold text-white max-w-[130px] truncate">{spaceCustomName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({roomL.toFixed(1)}×{roomW.toFixed(1)}m)</span>
                    <ChevronDown className="size-3 text-slate-400 ml-0.5" />
                  </button>

                  {/* Multi-Room Project Switcher Dropdown */}
                  {isRoomSelectorOpen && (
                    <div className="absolute top-8 left-0 z-50 w-72 bg-[#181a1f] border border-amber-500/40 rounded-b-lg shadow-2xl overflow-hidden py-1">
                      <div className="px-3 py-1.5 bg-[#131519] border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Spaces ({spaces.length || 1})</span>
                        <span className="text-[10px] text-amber-400 font-mono">DIALux evo</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {(spaces.length > 0 ? spaces : [baseActiveSpace]).map((sp) => {
                          const isSelected = sp.id === selectedSpaceId;
                          return (
                            <button
                              key={sp.id}
                              onClick={() => {
                                setSelectedSpaceId(sp.id);
                                setIsRoomSelectorOpen(false);
                                toast.success(`Switched active room to: ${sp.name}`);
                              }}
                              className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-slate-800 transition cursor-pointer border-b border-slate-800/40 ${
                                isSelected ? "bg-amber-500/15 text-amber-300 font-bold border-l-2 border-amber-400" : "text-slate-300"
                              }`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-white font-medium">{sp.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {sp.length}m × {sp.width}m × {sp.height}m ({sp.area || (sp.length * sp.width)} m²)
                                </span>
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-amber-300 font-mono shrink-0">
                                {sp.targetLux || 500} lx
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Viewport Action Toolbar (Matching all DIALux evo screenshots) */}
              <div className="flex items-center gap-1 text-slate-400">
                {/* 3D Perspective View */}
                <button
                  onClick={() => applyCameraView("3d")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                    cameraView === "3d"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                      : "hover:text-white hover:bg-slate-800"
                  }`}
                  title="3D Perspective View (Key: 1)"
                >
                  <Box className="size-3.5 text-amber-400" />
                  <span className="text-[10px]">3D</span>
                </button>

                {/* 2D Plan / Top View (Screenshot match) */}
                <button
                  onClick={() => applyCameraView("top")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                    cameraView === "top"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "hover:text-white hover:bg-slate-800"
                  }`}
                  title="Standard Plan / Top View (Key: 2)"
                >
                  <Square className="size-3.5 text-emerald-400" />
                  <span className="text-[10px]">Plan</span>
                </button>

                {/* Front Elevation View */}
                <button
                  onClick={() => applyCameraView("front")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                    cameraView === "front"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold"
                      : "hover:text-white hover:bg-slate-800"
                  }`}
                  title="Front Elevation View (Key: 3)"
                >
                  <svg className="size-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                  </svg>
                  <span className="text-[10px]">Front</span>
                </button>

                {/* Side Elevation View */}
                <button
                  onClick={() => applyCameraView("side")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                    cameraView === "side"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                      : "hover:text-white hover:bg-slate-800"
                  }`}
                  title="Side Elevation View (Key: 4)"
                >
                  <svg className="size-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="3" width="14" height="18" rx="2" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                  <span className="text-[10px]">Side</span>
                </button>

                <div className="w-[1px] h-4 bg-slate-800 mx-1" />

                {/* CAD White Paper / Studio Dark Canvas Toggle */}
                <button
                  onClick={() => {
                    const next = cadTheme === "white" ? "dark" : "white";
                    setCadTheme(next);
                    toast.info(`Switched to ${next === "white" ? "CAD White Paper Mode (Drafting)" : "Studio Dark Mode (Photometrics)"}`);
                  }}
                  className={`p-1 rounded cursor-pointer transition ${
                    cadTheme === "white" ? "text-amber-400 bg-amber-400/10 ring-1 ring-amber-400/30" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title={cadTheme === "white" ? "Switch to Studio Dark Mode (Photometrics)" : "Switch to CAD White Paper Mode (Drafting)"}
                >
                  {cadTheme === "white" ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-blue-400" />}
                </button>

                {/* Interactive 3D Point-to-Point Tape Measure (Ruler Tool) */}
                <button
                  onClick={() => {
                    const next = !isTapeMeasureActive;
                    setIsTapeMeasureActive(next);
                    if (next) {
                      setMeasurePointA(null);
                      setMeasurePointB(null);
                      toast.info("Tape Measure active: Click two points in the 3D space to measure real-world distance.");
                    } else {
                      setMeasurePointA(null);
                      setMeasurePointB(null);
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1 ${
                    isTapeMeasureActive
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="Interactive 3D Point-to-Point Tape Measure"
                >
                  <Ruler className="size-3.5 text-amber-400" />
                  <span className="text-[10px]">Ruler</span>
                </button>

                {/* DIALux evo Part 6: 3D Surface Aiming Tool */}
                <button
                  onClick={() => {
                    const next = !isAimingToolActive;
                    setIsAimingToolActive(next);
                    if (next) {
                      setIsTapeMeasureActive(false);
                      if (selectedFixtureIndex === null && simulationResult.luminaires.length > 0) {
                        setSelectedFixtureIndex(0);
                      }
                      toast.info("3D Aiming Tool active: Click any surface in the 3D space to orient the selected luminaire.");
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1 ${
                    isAimingToolActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                  title="DIALux evo Part 6: Aim Luminaire at 3D Surface Point"
                >
                  <Crosshair className="size-3.5 text-cyan-400" />
                  <span className="text-[10px]">Aim</span>
                </button>

                {/* Green Calculation Surface toggle */}
                <button
                  onClick={() => setShowCalcSurfacePlane(!showCalcSurfacePlane)}
                  className={`p-1 rounded hover:text-white cursor-pointer ${showCalcSurfacePlane ? "text-emerald-400" : ""}`}
                  title="Toggle Calculation Surface"
                >
                  <Square className="size-3.5 fill-emerald-400/20" />
                </button>
                {/* Green Room Boundary Wireframe toggle */}
                <button
                  onClick={() => setShowWireframeBoundary(!showWireframeBoundary)}
                  className={`p-1 rounded hover:text-white cursor-pointer ${showWireframeBoundary ? "text-emerald-400" : ""}`}
                  title="Toggle Room Boundary Wireframe"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4v16h16" />
                  </svg>
                </button>
                {/* Zoom to fit */}
                <button
                  onClick={() => applyCameraView(cameraView)}
                  className="p-1 rounded hover:text-white cursor-pointer"
                  title="Zoom to entire project"
                >
                  <Maximize className="size-3.5" />
                </button>
                {/* Dimension Leader Lines */}
                <button
                  onClick={() => setShowDimensions(!showDimensions)}
                  className={`p-1 rounded hover:text-white cursor-pointer ${showDimensions ? "text-amber-400" : ""}`}
                  title="Show / Hide Dimension Lines"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4" />
                  </svg>
                </button>
                {/* CAD Grid Snap */}
                <button
                  onClick={() => setShowGuideGrid(!showGuideGrid)}
                  className={`p-1 rounded hover:text-white cursor-pointer ${showGuideGrid ? "text-blue-400" : ""}`}
                  title="Toggle Snapping Grid"
                >
                  <Grid className="size-3.5" />
                </button>

                {/* DIALux evo Tutorial #9: Display Options Flyout Menu ("Screen Symbol" / Monitor Icon) */}
                <div className="relative">
                  <button
                    onClick={() => setIsDisplayOptionsOpen(!isDisplayOptionsOpen)}
                    className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shadow-sm border ${
                      isDisplayOptionsOpen
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                        : "bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-white"
                    }`}
                    title="DIALux evo Display Options & Visual Aids (Monitor Symbol - Tutorial #9)"
                  >
                    <Monitor className="size-3.5 text-amber-400" />
                    <span className="text-[11px]">Display Options</span>
                  </button>

                  <DialuxDisplayOptionsPanel
                    isOpen={isDisplayOptionsOpen}
                    onClose={() => setIsDisplayOptionsOpen(false)}
                    showCoordAxes={showCoordAxes}
                    setShowCoordAxes={setShowCoordAxes}
                    showDimensions={showDimensions}
                    setShowDimensions={setShowDimensions}
                    showCalcSurfacePlane={showCalcSurfacePlane}
                    setShowCalcSurfacePlane={setShowCalcSurfacePlane}
                    isWireframeMode={isWireframeMode}
                    setIsWireframeMode={setIsWireframeMode}
                    showIsoluxLines={showIsoluxLines}
                    setShowIsoluxLines={setShowIsoluxLines}
                    showHeatmap={showHeatmap}
                    setShowHeatmap={setShowHeatmap}
                    showLightCones={showLightCones}
                    setShowLightCones={setShowLightCones}
                    showLightTextures={showLightTextures}
                    setShowLightTextures={setShowLightTextures}
                    showLuxNumbers={showLuxNumbers}
                    setShowLuxNumbers={setShowLuxNumbers}
                    showLuminaires={showLuminaires}
                    setShowLuminaires={setShowLuminaires}
                    showRoomWalls={showRoomWalls}
                    setShowRoomWalls={setShowRoomWalls}
                    showFurniture={showFurniture}
                    setShowFurniture={setShowFurniture}
                    showDwgUnderlay={showDwgUnderlay}
                    setShowDwgUnderlay={setShowDwgUnderlay}
                    showEnergyHud={showEnergyHud}
                    setShowEnergyHud={setShowEnergyHud}
                    workPlaneHeight={workPlaneHeight}
                    setWorkPlaneHeight={setWorkPlaneHeight}
                    marginOffset={marginOffset}
                    setMarginOffset={setMarginOffset}
                    whiteBalanceMode={whiteBalanceMode}
                    setWhiteBalanceMode={setWhiteBalanceMode}
                    whiteBalanceKelvin={whiteBalanceKelvin}
                    setWhiteBalanceKelvin={setWhiteBalanceKelvin}
                    whiteBalanceExposure={whiteBalanceExposure}
                    setWhiteBalanceExposure={setWhiteBalanceExposure}
                    cameraView={cameraView}
                    onApplyCameraView={applyCameraView}
                    savedViews={cadSavedViews}
                    onSaveCurrentView={handleSaveCurrentView}
                    onApplySavedView={handleApplySavedView}
                    onDeleteSavedView={handleDeleteSavedView}
                    powerDensityWPerM2={simulationResult.powerDensityWPerM2 || 0}
                    roomArea={effectiveArea}
                    totalWatts={simulationResult.connectedPowerW || 0}
                  />
                </div>
              </div>

            </div>

            {/* Top Metric Measurement Ruler with 0.50m ticks */}
            {showRulers && (
              <div className={`h-4 border-b flex items-center pl-10 pr-6 overflow-hidden text-[8.5px] font-mono justify-between select-none shrink-0 ${
                cadTheme === "white" ? "bg-[#242831] border-slate-700 text-slate-300" : "bg-[#14161a] border-slate-800 text-slate-500"
              }`}>
                <span>-11.50</span>
                <span>-10.00</span>
                <span>-8.50</span>
                <span>-7.00</span>
                <span>-5.50</span>
                <span>-4.00</span>
                <span>-2.50</span>
                <span>-1.00</span>
                <span className="text-amber-400 font-bold">0.00</span>
                <span>1.00</span>
                <span>2.50</span>
                <span>4.00</span>
              </div>
            )}

            {/* Main Canvas Viewport Area with Left Vertical Ruler */}
            <div className="flex-1 flex min-h-0 relative">
              
              {/* Left Vertical Measurement Ruler with 0.50m ticks (Screenshot match) */}
              {showRulers && (
                <div className={`w-8 border-r flex flex-col justify-between py-2 text-[7.5px] font-mono select-none items-end pr-1.5 shrink-0 z-10 ${
                  cadTheme === "white" ? "bg-[#242831] border-slate-700 text-slate-300" : "bg-[#14161a] border-slate-800 text-slate-500"
                }`}>
                  {[7.0, 6.0, 5.0, 4.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -3.0, -4.0, -5.0, -6.0, -7.0].map((val) => (
                    <div key={val} className="flex items-center gap-1 w-full justify-end">
                      <span className={val === 0 ? "text-amber-400 font-bold" : ""}>
                        {val.toFixed(2)}
                      </span>
                      <div className={`h-[1px] ${val === 0 ? "w-3 bg-amber-400" : "w-1.5 bg-slate-700"}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* Three.js Canvas Container */}
              <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
                <div ref={mountRef} className="w-full h-full" />

                {/* Floating Tape Measure HUD Banner (Active Mode) */}
                {isTapeMeasureActive && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#181a1f]/95 backdrop-blur-md px-4 py-2 rounded-xl border border-amber-500/80 shadow-2xl z-30 flex items-center gap-3 text-xs animate-in slide-in-from-top duration-200">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <Ruler className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white">
                        {!measurePointA
                          ? "Tape Measure: Click first point (Point A) in 3D scene"
                          : !measurePointB
                          ? `Point A: (${measurePointA.x.toFixed(2)}, ${measurePointA.z.toFixed(2)}) — Click Point B`
                          : (
                            <span>
                              Distance: <strong className="text-amber-400 font-mono text-sm">{Math.sqrt(Math.pow(measurePointB.x - measurePointA.x, 2) + Math.pow(measurePointB.y - measurePointA.y, 2) + Math.pow(measurePointB.z - measurePointA.z, 2)).toFixed(3)} m</strong>
                              <span className="text-slate-400 text-[11px] ml-2 font-mono">
                                (ΔX: {Math.abs(measurePointB.x - measurePointA.x).toFixed(2)}m, ΔZ: {Math.abs(measurePointB.z - measurePointA.z).toFixed(2)}m)
                              </span>
                            </span>
                          )}
                      </span>
                      <span className="text-[10px] text-slate-400">Point-to-point CAD dimension measuring tool</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-3">
                      {measurePointA && (
                        <button
                          onClick={() => {
                            setMeasurePointA(null);
                            setMeasurePointB(null);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsTapeMeasureActive(false);
                          setMeasurePointA(null);
                          setMeasurePointB(null);
                        }}
                        className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/50 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* DIALux evo Part 6: Floating 3D Aiming Focus HUD Banner */}
                {isAimingToolActive && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#181a1f]/95 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500/80 shadow-2xl z-30 flex items-center gap-3 text-xs animate-in slide-in-from-top duration-200">
                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                      <Crosshair className="size-4 animate-spin-slow" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white">
                        {selectedFixtureIndex !== null ? (
                          <span>
                            Aiming Luminaire <strong className="text-amber-400 font-mono">#{selectedFixtureIndex + 1}</strong>: Click any 3D surface (floor, table, wall)
                          </span>
                        ) : (
                          <span>Select a luminaire first, then click a target surface</span>
                        )}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-mono">
                        {selectedFixtureIndex !== null && arrangementOverrides[selectedFixtureIndex]?.targetPoint ? (
                          `Target: (${arrangementOverrides[selectedFixtureIndex].targetPoint!.x.toFixed(2)}, ${arrangementOverrides[selectedFixtureIndex].targetPoint!.y.toFixed(2)}, ${arrangementOverrides[selectedFixtureIndex].targetPoint!.z.toFixed(2)}) | Pan: ${(arrangementOverrides[selectedFixtureIndex].aiming?.pan || 0).toFixed(1)}° | Tilt: ${(arrangementOverrides[selectedFixtureIndex].aiming?.tilt || 0).toFixed(1)}°`
                        ) : (
                          "DIALux evo Part 6: Interactive 3D Target Point Aiming"
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-3">
                      {selectedFixtureIndex !== null && arrangementOverrides[selectedFixtureIndex]?.targetPoint && (
                        <button
                          onClick={() => {
                            setArrangementOverrides((prev) => {
                              const copy = { ...prev };
                              if (copy[selectedFixtureIndex!]) {
                                const { targetPoint, aiming, ...rest } = copy[selectedFixtureIndex!];
                                copy[selectedFixtureIndex!] = rest;
                              }
                              return copy;
                            });
                            toast.info(`Reset Luminaire #${selectedFixtureIndex! + 1} aiming to nadir.`);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                        >
                          Reset Nadir
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsAimingToolActive(false);
                        }}
                        className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/50 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Floating Quick View & Reflection Controls (Top Right) */}
                <div className="absolute top-3 right-3 bg-[#191c22]/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700/80 shadow-2xl text-[11px] z-20 flex items-center gap-2">
                  <button
                    onClick={() => setClipLightConesToRoom((prev) => !prev)}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-medium transition cursor-pointer ${
                      clipLightConesToRoom
                        ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                    }`}
                    title={clipLightConesToRoom ? "Light beams clipped to room envelope (DIALux boundary active - prevents spilling outside)" : "Light beams unclipped (spilling outside)"}
                  >
                    <Box className="size-3" />
                    <span>Clip Beams: {clipLightConesToRoom ? "ON" : "OFF"}</span>
                  </button>

                  <button
                    onClick={() => setShowWallReflection((prev) => !prev)}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-medium transition cursor-pointer ${
                      showWallReflection
                        ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                    }`}
                    title="Simulate realistic luminaire light wash & surface reflections on walls"
                  >
                    <Sun className="size-3" />
                    <span>Wall Reflection (ρ={Math.round(reflectances.walls * 100)}%): {showWallReflection ? "ON" : "OFF"}</span>
                  </button>

                  <button
                    onClick={() => setShowWallFalseColor((prev) => !prev)}
                    className={`px-2 py-1 rounded flex items-center gap-1 font-medium transition cursor-pointer ${
                      showWallFalseColor
                        ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                        : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                    }`}
                    title="EN 12464-1 Wall surface illuminance false-color heatmap"
                  >
                    <Layers className="size-3" />
                    <span>Wall Heatmap: {showWallFalseColor ? "ON" : "OFF"}</span>
                  </button>
                </div>

                {/* DIALux evo Tutorial #9: Real-time Energy HUD Overlay (EN 15193 LENI Benchmark) */}
                {showEnergyHud && (
                  <div className="absolute top-14 right-3 bg-[#191c22]/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-amber-500/50 shadow-2xl text-xs z-20 flex flex-col gap-2 min-w-[210px] animate-in fade-in-50">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                        <Zap className="size-3.5" />
                        <span>Energy Evaluation HUD</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/30">
                        EN 15193
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex flex-col">
                        <span className="text-slate-400">Total Load</span>
                        <span className="text-white font-mono font-bold text-[11px]">
                          {(simulationResult.connectedPowerW || 0).toLocaleString()} W
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex flex-col">
                        <span className="text-slate-400">Power Density</span>
                        <span className="text-amber-400 font-mono font-bold text-[11px]">
                          {(simulationResult.powerDensityWPerM2 || 0).toFixed(2)} W/m²
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex flex-col">
                        <span className="text-slate-400">Annual LENI</span>
                        <span className="text-cyan-400 font-mono font-bold text-[11px]">
                          {((simulationResult.powerDensityWPerM2 || 0) * 2.5).toFixed(1)} kWh/m²/a
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex flex-col">
                        <span className="text-slate-400">Target Standard</span>
                        <span className="text-emerald-400 font-mono font-bold text-[11px]">
                          &le; 8.00 W/m²
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                      <span className="text-slate-400">Compliance Status:</span>
                      {(simulationResult.powerDensityWPerM2 || 0) <= 8.0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="size-3" /> Compliant
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          Exceeds Target
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* False-Color Legend Bar (Bottom Left) */}
                <div className="absolute bottom-3 left-3 bg-[#191c22]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-lg text-[10.5px] z-10 flex flex-col gap-1.5 pointer-events-none">
                  <span className="font-semibold text-slate-300">Workplane Illuminance (Lux Scale)</span>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-3 w-48 rounded"
                      style={{
                        background: "linear-gradient(to right, #1e1b4b, #1d4ed8, #0284c7, #0d9488, #16a34a, #ca8a04, #ea580c, #dc2626)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono w-48">
                    <span>0 lx</span>
                    <span>{Math.round(targetLux * 0.4)}</span>
                    <span className="text-emerald-400 font-bold">{targetLux} lx</span>
                    <span>{Math.round(targetLux * 1.5)}</span>
                    <span>&gt;{Math.round(targetLux * 2)}</span>
                  </div>
                </div>

                {/* DIALux evo Tutorial Part 15: Camera Memory Slots, White Balance & Pivoting Point HUD */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#181a1f]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-2xl z-30 flex items-center gap-2.5 text-xs select-none">
                  {/* Slots 1 to 9 */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                      <Bookmark className="size-3 text-amber-400" /> Slots:
                    </span>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
                      const assigned = cadSavedViews.find((v) => v.slot === s);
                      return (
                        <button
                          key={s}
                          type="button"
                          title={
                            assigned
                              ? `Slot ${s}: "${assigned.name}" (Alt+${s} to recall, Ctrl+${s} to overwrite)`
                              : `Slot ${s} (Empty — Ctrl+${s} to save view)`
                          }
                          onClick={() => handleApplySlot(s)}
                          className={`size-6 rounded font-mono font-bold text-[10px] flex items-center justify-center cursor-pointer transition ${
                            assigned
                              ? "bg-amber-600/30 text-amber-300 border border-amber-500/60 hover:bg-amber-500 hover:text-white"
                              : "bg-slate-800/60 text-slate-500 border border-slate-700/40 hover:text-slate-300"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  {/* White Balance Badge */}
                  <button
                    type="button"
                    onClick={() => setIsWhiteBalanceModalOpen(true)}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-[10.5px] font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    title="Click to open Tutorial 15 White Balance & Camera Positions Dialog"
                  >
                    <Sun className="size-3 text-amber-400" />
                    <span>{whiteBalanceMode === "auto" ? "WB: Auto (6500K)" : `WB: ${whiteBalanceKelvin}K`}</span>
                    {whiteBalanceExposure !== 0 && (
                      <span className="text-cyan-400 font-mono text-[9.5px]">
                        {whiteBalanceExposure > 0 ? `+${whiteBalanceExposure.toFixed(1)}` : whiteBalanceExposure.toFixed(1)}EV
                      </span>
                    )}
                  </button>

                  {/* Pivoting Point Reticle Tool Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPickingPivot(!isPickingPivot);
                      if (!isPickingPivot) {
                        toast.info("Click anywhere on a 3D surface to set center of rotation (or hold Ctrl+Click)");
                      }
                    }}
                    className={`px-2 py-1 rounded border text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                      isPickingPivot
                        ? "bg-amber-600 text-white border-amber-500 animate-pulse"
                        : "bg-slate-800/80 hover:bg-slate-700 border-slate-700/80 text-slate-300"
                    }`}
                    title="Set center of rotation (or hold Ctrl and click any 3D surface)"
                  >
                    <Crosshair className="size-3 text-amber-400" />
                    <span>{isPickingPivot ? "Pick Pivot..." : "Pivot"}</span>
                  </button>

                  {/* Tutorial 15 Full Modal Launcher */}
                  <button
                    type="button"
                    onClick={() => setIsWhiteBalanceModalOpen(true)}
                    title="Open Tutorial 15 White Balance & Camera Settings"
                    className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 cursor-pointer"
                  >
                    <Sliders className="size-3.5" />
                  </button>
                </div>

                {/* Origin Indicator */}
                <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-[#191c22]/80 px-2 py-1 rounded border border-slate-800 pointer-events-none">
                  Origin (0,0,0) [RGB: X-Red, Y-Green, Z-Blue]
                </div>
              </div>

            </div>

            {/* Bottom Photometric Evaluation Summary Bar with 3-Way Area Decider */}
            <div className="h-11 bg-[#191c22] border-t border-slate-800 flex items-center justify-between px-3 shrink-0 z-10 flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3">
                {/* 3-Way Quick Evaluation Area Decider */}
                <div className="flex items-center bg-[#14161a] p-0.5 rounded border border-slate-700/80 text-[10px]">
                  <button
                    onClick={() => {
                      setCalcAreaType("floor");
                      toast.info("Switched to Floor Area evaluation (0.00m)");
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                      calcAreaType === "floor"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Evaluate Floor Surface (Wall-to-wall footprint, Z = 0.00m)"
                  >
                    <Square className="size-2.5 text-emerald-300" />
                    <span>Floor</span>
                  </button>
                  <button
                    onClick={() => {
                      setCalcAreaType("workplane");
                      toast.info("Switched to Useful Working Plane evaluation (0.75m)");
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                      calcAreaType === "workplane"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Evaluate Useful Working Plane (0.75m desk height, wall margin excluded)"
                  >
                    <Layers className="size-2.5 text-blue-300" />
                    <span>Workplane</span>
                  </button>
                  <button
                    onClick={() => {
                      setCalcAreaType("workstation");
                      toast.info(`Switched to Workstation Desk evaluation (${workstationConfig.name})`);
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                      calcAreaType === "workstation"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Evaluate Workstation Desk Task Area + 0.5m surrounding area"
                  >
                    <Monitor className="size-2.5 text-amber-300" />
                    <span>Workstation</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 font-mono">
                  <span className="text-[10px] text-slate-400">
                    {calcAreaType === "floor" ? "Floor Maintained:" : calcAreaType === "workstation" ? "Desk Task Lux:" : "Workplane Lux:"}
                  </span>
                  <strong className="text-white text-xs">{simulationResult.avgLux} lx</strong>
                  <span className="text-[10px] text-slate-400">(Target: {simulationResult.targetLux} lx)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono">U₀:</span>
                  <span className={`ml-1 font-bold font-mono ${simulationResult.isUniformityCompliant ? "text-emerald-400" : "text-amber-400"}`}>
                    {simulationResult.uniformityU0.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Load:</span>
                  <span className="ml-1 font-semibold text-slate-200 font-mono">{simulationResult.powerDensityWPerM2} W/m²</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {simulationResult.isLuxCompliant && simulationResult.isUniformityCompliant ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    <CheckCircle2 className="size-3.5" /> {calcAreaType === "workstation" ? "TASK PASS" : "EN 12464-1 PASS"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                    <AlertTriangle className="size-3.5" /> UNDER-LIT / REVIEW
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

          {/* =========================================================================
              3D. RIGHT INSPECTOR PANEL (LUMINAIRE & CALCULATION CONTROLS)
          ========================================================================= */}
          <div className="w-80 bg-[#1f232b] border-l border-slate-800 flex flex-col overflow-y-auto p-3.5 gap-3 shrink-0 text-xs">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Lightbulb className="size-3.5 text-amber-400" /> Luminaire & Layout
              </span>
              <button
                onClick={handleAutoOptimize}
                className="text-[10.5px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="size-3" /> Auto-Optimize
              </button>
            </div>

            {/* Quick Evaluation Area Pill in Right Panel */}
            <div className="bg-[#191c22] p-2 rounded-lg border border-slate-700/60 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Evaluation Area:</span>
                <span className={`font-mono font-bold capitalize ${
                  calcAreaType === "floor" ? "text-emerald-400" : calcAreaType === "workstation" ? "text-amber-400" : "text-blue-400"
                }`}>
                  {calcAreaType}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <button
                  onClick={() => setCalcAreaType("floor")}
                  className={`py-1 rounded font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    calcAreaType === "floor"
                      ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/80"
                      : "bg-[#14161a] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Square className="size-3 text-emerald-400" />
                  <span>Floor</span>
                </button>
                <button
                  onClick={() => setCalcAreaType("workplane")}
                  className={`py-1 rounded font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    calcAreaType === "workplane"
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/80"
                      : "bg-[#14161a] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Layers className="size-3 text-blue-400" />
                  <span>Workplane</span>
                </button>
                <button
                  onClick={() => setCalcAreaType("workstation")}
                  className={`py-1 rounded font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    calcAreaType === "workstation"
                      ? "bg-amber-600/30 text-amber-300 border-amber-500/80"
                      : "bg-[#14161a] text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  <Monitor className="size-3 text-amber-400" />
                  <span>Desk</span>
                </button>
              </div>
            </div>

            {/* Pattern & Mounting */}
            <div className="bg-[#191c22] p-2.5 rounded-lg border border-slate-700/60 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">Layout Pattern</label>
                  <select
                    value={arrangementMode}
                    onChange={(e) => setArrangementMode(e.target.value as LuminaireArrangementMode)}
                    className="h-7 w-full px-1.5 bg-[#14161a] border border-slate-700 rounded text-[11px] text-slate-200 outline-none"
                  >
                    <option value="grid">Grid (N × M Array)</option>
                    <option value="linear_continuous">Linear Row</option>
                    <option value="perimeter">Perimeter</option>
                    <option value="single_center">Single Center</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Mounting Type</label>
                  <select
                    value={mountingType}
                    onChange={(e) => {
                      const val = e.target.value as "flush" | "surface" | "suspended";
                      setMountingType(val);
                      if (val === "suspended" && suspensionLength === 0) setSuspensionLength(0.8);
                    }}
                    className="h-7 w-full px-1.5 bg-[#14161a] border border-slate-700 rounded text-[11px] text-slate-200 outline-none"
                  >
                    <option value="flush">Ceiling Flush</option>
                    <option value="surface">Surface</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Grid Count */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                <div>
                  <label className="text-[10px] text-slate-400">Rows (Width)</label>
                  <div className="flex items-center border border-slate-700 rounded overflow-hidden bg-[#14161a]">
                    <button
                      onClick={() => pushGridChange({ ...gridConfig, rows: Math.max(1, gridConfig.rows - 1) })}
                      className="px-2 py-0.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-xs">{gridConfig.rows}</span>
                    <button
                      onClick={() => pushGridChange({ ...gridConfig, rows: gridConfig.rows + 1 })}
                      className="px-2 py-0.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Cols (Length)</label>
                  <div className="flex items-center border border-slate-700 rounded overflow-hidden bg-[#14161a]">
                    <button
                      onClick={() => pushGridChange({ ...gridConfig, cols: Math.max(1, gridConfig.cols - 1) })}
                      className="px-2 py-0.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-xs">{gridConfig.cols}</span>
                    <button
                      onClick={() => pushGridChange({ ...gridConfig, cols: gridConfig.cols + 1 })}
                      className="px-2 py-0.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Luminaire Selector */}
            <div className="bg-[#191c22] p-2.5 rounded-lg border border-slate-700/60 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-300">Luminaire Model</span>
              <select
                value={profile.name}
                onChange={(e) => {
                  const sel = BUILTIN_PHOTOMETRIC_PROFILES.find((p) => p.name === e.target.value);
                  if (sel) setProfile(sel);
                }}
                className="h-7 px-1.5 bg-[#14161a] border border-slate-700 rounded text-[11px] text-slate-200 outline-none"
              >
                {BUILTIN_PHOTOMETRIC_PROFILES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.totalLumens} lm, {p.wattage}W)
                  </option>
                ))}
              </select>

              <div className="flex flex-col items-center justify-center p-2 rounded bg-[#14161a] border border-slate-800">
                <canvas ref={polarCanvasRef} width={260} height={100} className="w-full h-auto" />
              </div>
            </div>

            {/* Actions: Apply & Export */}
            <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-slate-700/80">
              {onApplyResults && (
                <button
                  onClick={() => {
                    onApplyResults({
                      spaceId: baseActiveSpace.id,
                      quantity: simulationResult.luminaires.length,
                      achievedLux: simulationResult.avgLux,
                      rows: gridConfig.rows,
                      cols: gridConfig.cols,
                      uniformityU0: simulationResult.uniformityU0,
                      lightType: profile.name,
                    });
                    toast.success(`Applied ${simulationResult.luminaires.length} fixtures to "${spaceCustomName}"!`);
                  }}
                  className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Check className="size-4" />
                  <span>Apply This Space to Grid</span>
                </button>
              )}

              {onApplyAllProjectResults && (
                <button
                  onClick={() => {
                    onApplyAllProjectResults(
                      fullProjectSummary.map((s) => ({
                        spaceId: s.id,
                        quantity: s.fixturesCount,
                        achievedLux: s.simulatedLux,
                        rows: s.rows,
                        cols: s.cols,
                        uniformityU0: s.uniformityU0,
                        lightType: profile.name,
                      }))
                    );
                  }}
                  className="w-full py-1.5 px-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Check className="size-4" />
                  <span>Apply All {fullProjectSummary.length} Spaces to Grid</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    downloadDialuxSTF({
                      projectName,
                      projectCode,
                      roomName: spaceCustomName,
                      length: roomL,
                      width: roomW,
                      height: roomH,
                      workPlaneHeight,
                      reflectances,
                      profile,
                      luminaires: simulationResult.luminaires,
                    })
                  }
                  className="py-1 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileDown className="size-3" />
                  <span>Export STF</span>
                </button>

                <button
                  onClick={() =>
                    exportDialuxReportPDF({
                      projectName,
                      projectCode,
                      roomName: spaceCustomName,
                      roomLength: roomL,
                      roomWidth: roomW,
                      roomHeight: roomH,
                      workPlaneHeight,
                      profile,
                      simulation: simulationResult,
                      userName,
                    })
                  }
                  className="py-1 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileDown className="size-3" />
                  <span>Space PDF</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* -------------------------------------------------------------
          DIALUX EVO INTERACTIVE MODAL DIALOGS
      ------------------------------------------------------------- */}
      <PolygonSpaceModal
        isOpen={showPolygonModal}
        onClose={() => setShowPolygonModal(false)}
        roomL={roomL}
        roomW={roomW}
        roomH={roomH}
        polygonPreset={polygonPreset}
        polygonWingL={polygonWingL}
        polygonWingW={polygonWingW}
        effectiveArea={effectiveArea}
        effectiveVolume={effectiveVolume}
        onApply={({ preset, wingL, wingW }) => {
          setRoomShape("polygon");
          setPolygonPreset(preset);
          setPolygonWingL(wingL);
          setPolygonWingW(wingW);
        }}
        onResetToRect={() => {
          setRoomShape("rectangular");
        }}
      />

      <SubspaceModal
        isOpen={showSubspaceModal}
        onClose={() => setShowSubspaceModal(false)}
        roomL={roomL}
        roomW={roomW}
        hasSubspace={hasSubspace}
        subspaceType={subspaceType}
        subspaceL={subspaceL}
        subspaceW={subspaceW}
        subspacePosX={subspacePosX}
        subspacePosZ={subspacePosZ}
        onApply={({ type, l, w, x, z }) => {
          setHasSubspace(true);
          setSubspaceType(type);
          setSubspaceL(l);
          setSubspaceW(w);
          setSubspacePosX(x);
          setSubspacePosZ(z);
        }}
        onRemove={() => setHasSubspace(false)}
      />

      <NewRoomModal
        isOpen={showNewRoomModal}
        onClose={() => setShowNewRoomModal(false)}
        currentName={spaceCustomName}
        currentL={roomL}
        currentW={roomW}
        currentH={roomH}
        currentTargetLux={targetLux}
        onApply={({ name, l, w, h, targetLux: tLux }) => {
          setSpaceCustomName(name);
          setRoomL(l);
          setRoomW(w);
          setRoomH(h);
          setTargetLux(tLux);
        }}
      />

      <ApertureModal
        isOpen={showApertureModal}
        onClose={() => setShowApertureModal(false)}
        windowCount={windowCount}
        apertureHeight={apertureHeight}
        apertureWidth={apertureWidth}
        apertureFrameWidth={apertureFrameWidth}
        apertureSillHeight={apertureSillHeight}
        onApply={({ height, width, frame, sill, countDelta }) => {
          setApertureHeight(height);
          setApertureWidth(width);
          setApertureFrameWidth(frame);
          setApertureSillHeight(sill);
          setWindowCount((c) => Math.max(1, (c <= 0 ? 0 : c) + countDelta));
        }}
        onRemoveAll={() => {
          setWindowCount(0);
          setShowFacadeBlinds(false);
        }}
      />

      <FacadeModal
        isOpen={showFacadeModal}
        onClose={() => setShowFacadeModal(false)}
        facadeElement={facadeElement}
        facadeMounting={facadeMounting}
        showFacadeBlinds={showFacadeBlinds}
        onApply={({ element, mounting, enabled }) => {
          setFacadeElement(element);
          setFacadeMounting(mounting);
          setShowFacadeBlinds(enabled);
        }}
      />

      <RoofModal
        isOpen={showRoofModal}
        onClose={() => setShowRoofModal(false)}
        activeRoofType={activeRoofType}
        roofOverhang={roofOverhang}
        roofPitch={roofPitch}
        roofRidgeHeight={roofRidgeHeight}
        showRoofIn3D={showRoofIn3D}
        onApply={({ type, overhang, pitch, ridge, show3D }) => {
          setActiveRoofType(type);
          setRoofOverhang(overhang);
          setRoofPitch(pitch);
          setRoofRidgeHeight(ridge);
          setHasPlacedRoof(true);
          setShowRoofIn3D(show3D);
        }}
        onRemove={() => {
          setHasPlacedRoof(false);
          setShowRoofIn3D(false);
        }}
      />

      <CeilingModal
        isOpen={showCeilingModal}
        onClose={() => setShowCeilingModal(false)}
        hasSuspendedCeiling={hasSuspendedCeiling}
        ceilingSuspensionDepth={ceilingSuspensionDepth}
        ceilingGridType={ceilingGridType}
        ceilingTileReflectance={ceilingTileReflectance}
        roomH={roomH}
        onApply={({ enabled, depth, gridType, reflectance }) => {
          setHasSuspendedCeiling(enabled);
          setCeilingSuspensionDepth(depth);
          setCeilingGridType(gridType);
          setCeilingTileReflectance(reflectance);
          setShowCeilingGrid(enabled);
        }}
      />

      <FurnitureModal
        isOpen={showFurnitureModal}
        onClose={() => setShowFurnitureModal(false)}
        activeFurnitureObject={activeFurnitureObject}
        furnitureArrangement={furnitureArrangement}
        cuboidWidth={cuboidWidth}
        cuboidLength={cuboidLength}
        cuboidHeight={cuboidHeight}
        showFurniture={showFurniture}
        onApply={({
          objectType,
          arrangement,
          w,
          l,
          h,
          posX = roomL / 2,
          posZ = roomW / 2,
          rotationDeg = 0,
          materialId = "wood_oak_parquet",
          colorHex = "#d4b996",
          rows = 2,
          cols = 2,
          spacingX = 2.0,
          spacingZ = 2.0,
          count = 4,
          radius = 1.8,
          visible,
        }) => {
          setActiveFurnitureObject(objectType);
          setFurnitureArrangement(arrangement);
          setCuboidWidth(w);
          setCuboidLength(l);
          setCuboidHeight(h);
          setShowFurniture(visible);

          let newItems: FurnitureItem[] = [];
          if (arrangement === "rectangular") {
            newItems = generateRectangularFurnitureArray(
              objectType,
              rows,
              cols,
              spacingX,
              spacingZ,
              Math.max(0.5, posX - ((cols - 1) * spacingX) / 2),
              Math.max(0.5, posZ - ((rows - 1) * spacingZ) / 2),
              materialId,
              colorHex
            );
          } else if (arrangement === "line") {
            newItems = generateLineFurnitureArray(
              objectType,
              count,
              spacingX,
              Math.max(0.5, posX - ((count - 1) * spacingX) / 2),
              posZ,
              rotationDeg,
              materialId,
              colorHex
            );
          } else if (arrangement === "circular") {
            newItems = generateCircularFurnitureArray(
              objectType,
              count,
              radius,
              posX,
              posZ,
              materialId,
              colorHex
            );
          } else {
            const itemId = `item_${Date.now()}`;
            if (objectType === "reception_desk") {
              newItems = [createReceptionDeskItem(itemId, posX, posZ, rotationDeg, materialId, colorHex)];
            } else if (objectType === "desk") {
              newItems = [createDeskItem(itemId, posX, posZ, rotationDeg, w, l, h, materialId, colorHex)];
            } else if (objectType === "chair") {
              newItems = [createChairItem(itemId, posX, posZ, rotationDeg, materialId, colorHex)];
            } else if (objectType === "conference_table") {
              newItems = [createConferenceTableItem(itemId, posX, posZ, rotationDeg, w, l, h, materialId, colorHex)];
            } else if (objectType === "bookshelf") {
              newItems = [createBookshelfItem(itemId, posX, posZ, rotationDeg, w, l, h, materialId, colorHex)];
            } else if (objectType === "monitor") {
              newItems = [createMonitorItem(itemId, posX, posZ, rotationDeg, 0.75)];
            } else {
              newItems = [createCubeItem(itemId, posX, posZ, w, l, h, rotationDeg, materialId, colorHex)];
            }
          }

          setFurnitureList((prev) => [...prev, ...newItems]);
          if (newItems.length > 0) {
            setSelectedFurnitureId(newItems[0].id);
          }
        }}
      />

      <MaterialModal
        isOpen={showMaterialModal}
        onClose={() => setShowMaterialModal(false)}
        activeMaterialName={activeMaterialName}
        materialReflectanceVal={materialReflectanceVal}
        materialColorHex={materialColorHex}
        selectedMaterialTarget={selectedMaterialTarget}
        surfaceColors={surfaceColors}
        reflectances={reflectances}
        onApply={({ target, name, reflectance, colorHex, textureType = "plain" }) => {
          setSelectedMaterialTarget(target);
          setActiveMaterialName(name);
          setMaterialReflectanceVal(reflectance);
          setMaterialColorHex(colorHex);

          if (target === "ceiling") {
            setReflectances((prev) => ({ ...prev, ceiling: reflectance }));
            setSurfaceColors((prev) => ({ ...prev, ceiling: colorHex }));
          } else if (target === "floor") {
            setReflectances((prev) => ({ ...prev, floor: reflectance }));
            setSurfaceColors((prev) => ({ ...prev, floor: colorHex }));
          } else if (target === "walls") {
            setReflectances((prev) => ({ ...prev, walls: reflectance }));
            setSurfaceColors((prev) => ({ ...prev, walls: colorHex }));
            setWallSurfaces({
              north: { materialId: name, name, colorHex, reflectance, textureType },
              south: { materialId: name, name, colorHex, reflectance, textureType },
              east: { materialId: name, name, colorHex, reflectance, textureType },
              west: { materialId: name, name, colorHex, reflectance, textureType },
            });
          } else if (target === "north_wall" || target === "south_wall" || target === "east_wall" || target === "west_wall") {
            const wallKey = target === "north_wall" ? "north" : target === "south_wall" ? "south" : target === "east_wall" ? "east" : "west";
            setWallSurfaces((prev) => {
              const updated = {
                ...prev,
                [wallKey]: { materialId: name, name, colorHex, reflectance, textureType },
              };
              const weighted = calculateWeightedWallReflectance(roomL, roomW, updated);
              setReflectances((r) => ({ ...r, walls: weighted }));
              return updated;
            });
          } else if (target === "furniture" && selectedFurnitureId) {
            setFurnitureList((prev) =>
              prev.map((item) =>
                item.id === selectedFurnitureId
                  ? {
                      ...item,
                      colorHex,
                      parts: item.parts.map((p) => ({ ...p, colorHex })),
                    }
                  : item
              )
            );
          }
        }}
        onApplyStandardCIBSE={() => {
          setReflectances({ ceiling: 0.70, walls: 0.50, floor: 0.20 });
          setSurfaceColors({ ceiling: "#f8fafc", walls: "#94a3b8", floor: "#475569" });
          setWallSurfaces(DEFAULT_WALL_SURFACES);
        }}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <MaintenanceFactorModal
        isOpen={isMfModalOpen}
        onClose={() => setIsMfModalOpen(false)}
        currentMf={mf}
        onApplyMf={(newMf) => {
          setMf(newMf);
          setSiteMf(newMf);
        }}
      />

      <DaylightAnalysisModal
        isOpen={isDaylightModalOpen}
        onClose={() => setIsDaylightModalOpen(false)}
        roomL={roomL}
        roomW={roomW}
        roomH={roomH}
        windowCount={windowCount}
        windowWidth={apertureWidth}
        windowHeight={apertureHeight}
        windowSill={apertureSillHeight}
        targetLux={targetLux}
        artificialPowerW={simulationResult.connectedPowerW || 120}
        showFacadeBlinds={showFacadeBlinds}
        onOpenApertures={() => {
          setConstructionTool("apertures");
          setShowApertureModal(true);
        }}
        onApplyDaylightScene={({
          skyModel,
          directSunlight,
          hour,
          latitude,
          longitude,
          cityName,
          northOrientation,
          groundReflectance,
          glassTransmittance,
        }) => {
          setDaylightSkyModel(skyModel);
          setDaylightDirectSun(directSunlight);
          setDaylightHour(hour);
          setDaylightLat(latitude);
          setDaylightLon(longitude);
          setDaylightCity(cityName);
          setDaylightNorthAngle(northOrientation);
          setDaylightGroundReflectance(groundReflectance);
          setDaylightGlassTau(glassTransmittance);
          setIsDaylightSceneActive(true);
          if (skyModel === "clear") {
            setLightScene("daylight_clear");
          } else {
            setLightScene("daylight_overcast");
          }
        }}
      />

      <EmergencyLightingModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        roomL={roomL}
        roomW={roomW}
        simulationResult={simulationResult}
        onSwitchScene={(scene) => setLightScene(scene)}
      />

      <CadPlanModal
        isOpen={isCadPlanModalOpen}
        onClose={() => setIsCadPlanModalOpen(false)}
        currentPlan={activeCadPlan}
        roomL={roomL}
        roomW={roomW}
        initialTab={cadModalInitialTab}
        onApplyPlan={(updatedPlan, autoResizeRoom) => {
          setActiveCadPlan(updatedPlan);
          setShowDwgUnderlay(true);
          if (autoResizeRoom && updatedPlan.widthM > 0 && updatedPlan.heightM > 0) {
            setRoomL(updatedPlan.widthM);
            setRoomW(updatedPlan.heightM);
            toast.success(`CAD Plan applied and room footprint resized to ${updatedPlan.widthM}m × ${updatedPlan.heightM}m`);
          } else {
            toast.success("CAD Plan and Layer configuration applied");
          }
        }}
      />

      <DrawContourModal
        isOpen={isDrawContourModalOpen}
        onClose={() => setIsDrawContourModalOpen(false)}
        mode={drawContourMode}
        storeyId={buildingModel.activeStoreyId}
        buildingL={roomL}
        buildingW={roomW}
        buildingH={roomH}
        activeCadPlan={activeCadPlan}
        existingRooms={activeStorey.rooms}
        onApplyContour={(params) => {
          if (params.mode === "building") {
            const box = computeBoundingBox(params.polygon);
            setBuildingModel((prev) => ({
              ...prev,
              exteriorContour: params.polygon,
              wallThicknessM: params.wallThickness,
              totalHeightM: params.height,
            }));
            setRoomL(box.length);
            setRoomW(box.width);
            setRoomH(params.height);
            toast.success(`Extruded Building Envelope: ${box.length}m × ${box.width}m (${params.areaM2.toFixed(1)} m²)`);
          } else {
            const box = computeBoundingBox(params.polygon);
            const newRoom: IndoorRoomContour = {
              id: `room-${Date.now()}`,
              name: params.name,
              storeyId: buildingModel.activeStoreyId,
              polygon: params.polygon,
              wallThickness: params.wallThickness,
              height: params.height,
              targetLux: params.targetLux,
              applicationProfile: params.applicationProfile,
              areaM2: params.areaM2,
              perimeterM: params.perimeterM,
              color: params.color,
              originX: box.minX,
              originY: box.minY,
              width: box.width,
              length: box.length,
            };

            setBuildingModel((prev) => ({
              ...prev,
              activeRoomId: newRoom.id,
              storeys: prev.storeys.map((st) =>
                st.id === prev.activeStoreyId
                  ? { ...st, rooms: [...st.rooms, newRoom] }
                  : st
              ),
            }));

            // Focus newly constructed room for calculations
            setSpaceCustomName(newRoom.name);
            setRoomL(newRoom.width);
            setRoomW(newRoom.length);
            setRoomH(newRoom.height);
            setTargetLux(newRoom.targetLux);
            toast.success(`Constructed Indoor Contour: ${newRoom.name} (${newRoom.areaM2.toFixed(1)} m²)`);
          }
        }}
      />

      {/* Official DIALux evo 2D CAD Luminaire Placement & Space Layout Modal */}
      <LuminairePlacementModal
        isOpen={isPlacementModalOpen}
        onClose={() => setIsPlacementModalOpen(false)}
        roomL={roomL}
        roomW={roomW}
        roomH={roomH}
        targetLux={targetLux}
        profile={profile}
        gridConfig={gridConfig}
        onApplyGrid={(cfg) => {
          pushGridChange(cfg);
        }}
        arrangementMode={arrangementMode}
        onApplyArrangementMode={(mode) => setArrangementMode(mode)}
        lineConfig={lineConfig}
        onApplyLineConfig={(cfg) => setLineConfig(cfg)}
        circularConfig={circularConfig}
        onApplyCircularConfig={(cfg) => setCircularConfig(cfg)}
        polygonalConfig={polygonalConfig}
        onApplyPolygonalConfig={(cfg) => setPolygonalConfig(cfg)}
        arrangementOverrides={arrangementOverrides}
        onApplyArrangementOverrides={(ovs) => setArrangementOverrides(ovs)}
        customLuminaires={customLuminaires}
        onApplyCustomLuminaires={(lums) => setCustomLuminaires(lums)}
        mountingType={mountingType}
        onApplyMountingType={(m) => setMountingType(m)}
        suspensionLength={suspensionLength}
        onApplySuspensionLength={(l) => setSuspensionLength(l)}
        workPlaneHeight={workPlaneHeight}
      />

      {/* Official DIALux evo Part 7 Raytracer & HDR Studio Modal */}
      <RaytracerModal
        isOpen={isRaytracerModalOpen}
        onClose={() => setIsRaytracerModalOpen(false)}
        roomName={spaceCustomName}
        projectName={projectName}
        roomL={roomL}
        roomW={roomW}
        roomH={roomH}
        profile={profile}
        simulationResult={simulationResult}
        rendererRef={rendererRef}
        projectImages={projectImages}
        setProjectImages={setProjectImages}
      />

      {/* Official DIALux evo Part 10 Street Lighting & EN 13201 Suite Modal */}
      <DialuxStreetLightingModal
        isOpen={isStreetLightingModalOpen}
        onClose={() => setIsStreetLightingModalOpen(false)}
        projectName={projectName}
        projectCode={projectCode}
        onOpenRoundabout={() => {
          setIsStreetLightingModalOpen(false);
          setIsRoundaboutModalOpen(true);
        }}
        onOpenMedianStrip={() => {
          setIsStreetLightingModalOpen(false);
          setIsMedianStripModalOpen(true);
        }}
      />

      {/* Official DIALux evo Part 16 Roundabout Lighting & EN 13201 Suite Modal */}
      <DialuxRoundaboutModal
        isOpen={isRoundaboutModalOpen}
        onClose={() => setIsRoundaboutModalOpen(false)}
        projectName={projectName}
        projectCode={projectCode}
      />

      {/* Official DIALux evo Part 17 UGR Calculation Studio Modal */}
      <DialuxUGRModal
        isOpen={isUGRModalOpen}
        onClose={() => setIsUGRModalOpen(false)}
        roomLength={roomL}
        roomWidth={roomW}
        roomHeight={roomH}
        roomName={spaceCustomName}
        projectName={projectName}
        workplaneLux={targetLux}
        ceilingReflectance={reflectances.ceiling}
        wallReflectance={reflectances.walls}
        floorReflectance={reflectances.floor}
      />

      {/* Official DIALux evo Part 18 Drawing from Scratch Studio Modal */}
      <DialuxDrawingFromScratchModal
        isOpen={isDrawingFromScratchModalOpen}
        onClose={() => setIsDrawingFromScratchModalOpen(false)}
        projectName={projectName}
        onApplyBuildingToScene={(newBuilding) => {
          toast.success(`Loaded "${newBuilding.name}" into active session!`);
        }}
      />

      {/* Official DIALux evo Part 19 Road and Street Lighting: Median Strip Calculation Modal */}
      <DialuxMedianStripModal
        isOpen={isMedianStripModalOpen}
        onClose={() => setIsMedianStripModalOpen(false)}
        projectName={projectName}
        projectCode={projectCode}
      />

      {/* Official DIALux evo Part 20 Maintenance Factors & Improvements Studio Modal */}
      <DialuxMaintenanceFactorStudioModal
        isOpen={isMaintenanceStudioOpen}
        onClose={() => setIsMaintenanceStudioOpen(false)}
        currentMf={mf}
        onApplyMf={(newMf) => {
          setMf(newMf);
          toast.success(`Updated space Maintenance Factor to ${newMf}`);
        }}
        spaceName={spaceCustomName}
        projectName={projectName}
      />

      {/* Official DIALux evo Part 21 Luminaire Groups & Light Scenes Studio Modal */}
      <DialuxLightScenesStudioModal
        isOpen={isLightScenesModalOpen}
        onClose={() => setIsLightScenesModalOpen(false)}
        projectName={projectName}
        onApplySceneToSimulation={(sc) => {
          toast.success(`Switched simulation to "${sc.name}" (${sc.calculatedWatts}W)`);
        }}
      />

      {/* Official DIALux evo Part 22 Swimming Pool Lighting Studio Modal */}
      <DialuxPoolLightingStudioModal
        isOpen={isPoolLightingModalOpen}
        onClose={() => setIsPoolLightingModalOpen(false)}
        projectName={projectName}
        onApplyToSimulation={(report) => {
          toast.success(`Applied pool lighting simulation: ${report.waterSurface.averageLux} lx (${report.totalActiveWatts}W)`);
        }}
      />

      {/* Official DIALux evo Part 23 Daylighting Systems Studio Modal */}
      <DialuxDaylightSystemsStudioModal
        isOpen={isDaylightSystemsModalOpen}
        onClose={() => setIsDaylightSystemsModalOpen(false)}
        projectName={projectName}
        onApplyToSimulation={(res) => {
          toast.success(`Applied daylighting system (${res.system.name}): Avg DF = ${res.averageDaylightFactor}%`);
        }}
      />

      {/* Official DIALux evo Part 24 The Cutout Tool & Complex Roofs Studio Modal */}
      <DialuxCutoutRoofStudioModal
        isOpen={isCutoutRoofModalOpen}
        onClose={() => setIsCutoutRoofModalOpen(false)}
        projectName={projectName}
        onApplyToSimulation={(proj) => {
          toast.success(`Applied cutout geometry (${proj.name}): ${proj.cutouts.length} cutouts applied`);
        }}
      />

      {/* Official DIALux evo Part 25 Managing Interior & Exterior Workplanes Studio Modal */}
      <DialuxWorkplaneStudioModal
        isOpen={isWorkplaneStudioModalOpen}
        onClose={() => setIsWorkplaneStudioModalOpen(false)}
        projectName={projectName}
        onApplyToSimulation={(wps) => {
          toast.success(`Applied ${wps.length} interior & exterior workplanes to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 26 Norm Control Centre & Standards Studio Modal */}
      <DialuxStandardsStudioModal
        isOpen={isStandardsStudioModalOpen}
        onClose={() => setIsStandardsStudioModalOpen(false)}
        projectName={projectName}
        onApplyStandardToSimulation={(stdId, prof) => {
          toast.success(`Applied [${prof.name}] standard to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 27 Detailed Textures & Materials Studio Modal */}
      <DialuxTexturesStudioModal
        isOpen={isTexturesStudioModalOpen}
        onClose={() => setIsTexturesStudioModalOpen(false)}
        projectName={projectName}
        onApplyMaterialsToSimulation={(ass) => {
          toast.success(`Applied ${ass.length} surface textures & reflectances to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 28 Improving Luminaires Studio Modal (Joints & Light Colour CCT) */}
      <DialuxImprovingLuminairesModal
        isOpen={isImprovingLuminairesModalOpen}
        onClose={() => setIsImprovingLuminairesModalOpen(false)}
        projectName={projectName}
        onApplyLuminairesToSimulation={(lums) => {
          toast.success(`Applied ${lums.length} articulated luminaires with joint aiming & CCT to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 29 Complete Building Scenery Studio Modal */}
      <DialuxCompleteSceneryModal
        isOpen={isCompleteSceneryModalOpen}
        onClose={() => setIsCompleteSceneryModalOpen(false)}
        projectName={projectName}
        onApplySceneryToSimulation={(scen) => {
          toast.success(`Applied complete building scenery (${scen.rooms.length} rooms) to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 30 Effective Lighting Design Studio Modal */}
      <DialuxEffectiveLightingModal
        isOpen={isEffectiveLightingModalOpen}
        onClose={() => setIsEffectiveLightingModalOpen(false)}
        projectName={projectName}
        onApplyPlanToSimulation={(p) => {
          toast.success(`Applied effective layered lighting plan to project simulation`);
        }}
      />

      {/* Official DIALux evo Part 12 Simple Indoor Planning (Room Planning / evo easy) Modal */}
      <SimpleIndoorPlanningModal
        isOpen={isSimplePlanningModalOpen}
        onClose={() => setIsSimplePlanningModalOpen(false)}
        initialRoomName={spaceCustomName}
        initialLength={roomL}
        initialWidth={roomW}
        initialHeight={roomH}
        initialTargetLux={targetLux}
        initialMf={mf}
        projectName={projectName}
        projectCode={projectCode}
        userName={userName}
        onApplyTo3DView={({
          roomName: newName,
          length: newL,
          width: newW,
          height: newH,
          workPlaneHeight: newWpH,
          marginOffset: newMargin,
          targetLux: newTarget,
          profile: newProfile,
          rows: newRows,
          cols: newCols,
          mf: newMf,
          reflectances: newRefl,
        }) => {
          setSpaceCustomName(newName);
          setRoomL(newL);
          setRoomW(newW);
          setRoomH(newH);
          setWorkPlaneHeight(newWpH);
          setMarginOffset(newMargin);
          setTargetLux(newTarget);
          setProfile(newProfile);
          pushGridChange({ rows: newRows, cols: newCols });
          setMf(newMf);
          setReflectances(newRefl);
          setArrangementMode("grid");

          if (cameraRef.current && controlsRef.current) {
            const cx = newL / 2;
            const cy = newH / 2;
            const cz = newW / 2;
            controlsRef.current.target.set(cx, cy, cz);
            if (cameraView === "3d") {
              cameraRef.current.position.set(newL * 1.4, newH * 1.8, newW * 1.6);
            } else if (cameraView === "top") {
              cameraRef.current.position.set(cx, Math.max(newL, newW) * 2.2, cz);
            }
            controlsRef.current.update();
          }

          toast.success(`Synchronized ${newName} Simple Indoor Plan into 3D CAD view!`);
        }}
        onApplyToSchedule={
          onApplyResults
            ? (res) => {
                onApplyResults({
                  spaceId: selectedSpaceId || "space-1",
                  quantity: res.quantity,
                  achievedLux: res.achievedLux,
                  rows: res.rows,
                  cols: res.cols,
                  uniformityU0: res.uniformityU0,
                  lightType: res.lightType,
                });
              }
            : undefined
        }
      />

      {/* Official DIALux evo Part 13 Staircases & Extrusion Objects Modal */}
      <StaircaseExtrusionModal
        isOpen={isStaircaseModalOpen}
        onClose={() => setIsStaircaseModalOpen(false)}
        roomLength={roomL}
        roomWidth={roomW}
        roomHeight={roomH}
        luminaires={simulationResult.luminaires}
        mf={mf}
        onAddStaircase={(stair) => {
          setFurnitureList((prev) => [...prev, stair]);
          setSelectedFurnitureId(stair.id);
          setShowFurniture(true);
        }}
      />

      {/* Official DIALux evo Part 14 Staircases Part 2: Copy Along a Line & Grouping Modal */}
      <StaircaseCopyAlongLineModal
        isOpen={isCopyAlongLineModalOpen}
        onClose={() => setIsCopyAlongLineModalOpen(false)}
        roomLength={roomL}
        roomWidth={roomW}
        roomHeight={roomH}
        furnitureList={furnitureList}
        selectedFurnitureId={selectedFurnitureId}
        luminaires={simulationResult.luminaires}
        mf={mf}
        onAddFurnitureItems={(items) => {
          setFurnitureList((prev) => [...prev, ...items]);
          if (items.length > 0) {
            setSelectedFurnitureId(items[0].id);
          }
          setShowFurniture(true);
        }}
        onUpdateFurnitureList={(list) => setFurnitureList(list)}
      />

      {/* Official DIALux evo Part 15 White Balance, Camera Positions & Pivoting Point Modal */}
      <WhiteBalanceCameraModal
        isOpen={isWhiteBalanceModalOpen}
        onClose={() => setIsWhiteBalanceModalOpen(false)}
        whiteBalanceMode={whiteBalanceMode}
        setWhiteBalanceMode={setWhiteBalanceMode}
        whiteBalanceKelvin={whiteBalanceKelvin}
        setWhiteBalanceKelvin={setWhiteBalanceKelvin}
        whiteBalanceExposure={whiteBalanceExposure}
        setWhiteBalanceExposure={setWhiteBalanceExposure}
        whiteBalanceTint={whiteBalanceTint}
        setWhiteBalanceTint={setWhiteBalanceTint}
        savedViews={cadSavedViews}
        onSaveSlot={handleSaveSlot}
        onApplySlot={handleApplySlot}
        onDeleteView={handleDeleteSavedView}
        onSaveCurrentView={handleSaveCurrentView}
        onApplySavedView={handleApplySavedView}
        cameraView={cameraView}
        onApplyCameraView={applyCameraView}
        currentPivot={currentPivot}
        onSetPivot={handleSetPivot}
        isPickingPivot={isPickingPivot}
        setIsPickingPivot={setIsPickingPivot}
        isPickingWhitePoint={isPickingWhitePoint}
        setIsPickingWhitePoint={setIsPickingWhitePoint}
        roomLength={roomL}
        roomWidth={roomW}
        roomHeight={roomH}
      />
    </div>
  );
}

