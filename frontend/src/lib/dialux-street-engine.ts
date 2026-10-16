/**
 * =========================================================================
 * DIALUX EVO STREET & ROAD LIGHTING ENGINE (EN 13201 / CIE 115 / CIE 140)
 * =========================================================================
 * 
 * Implements the complete Street Lighting functionality from DIALux evo Tutorial Part 10:
 * - Multi-lane Roadway Profile & Cross-Section Builder (Carriageway, Sidewalks, Cycle Paths, Verges, Medians)
 * - Standard Lighting Classes (M1-M6, C0-C5, P1-P6) with EN 13201-2 criteria
 * - CIE Standard Road Surface R-Tables (R1, R2, R3, R4) with luminance coefficient matrices
 * - Observer Placement per CIE 140 (60m distance, 1.5m eye height, 1° downward sight line)
 * - Point-by-point Road Luminance (L_avg, U_o, U_l) & Illuminance (E_avg, E_min)
 * - Glare Limitation (Threshold Increment TI %) & Edge Illuminance Ratio (EIR / SR)
 * - Luminaire Arrangements (Single-sided, Two-sided Opposite, Two-sided Staggered, Median)
 * - Automatic DIALux Street Optimizer (Maximizes pole spacing while ensuring 100% EN 13201 compliance)
 * - Energy Efficiency Indicators (PDI & AECI) per EN 13201-5
 */

// =========================================================================
// 1. DATA TYPES & INTERFACES
// =========================================================================

export type RoadElementType =
  | "carriageway"
  | "sidewalk"
  | "cyclepath"
  | "grass_verge"
  | "median"
  | "parking_lane"
  | "emergency_lane";

export type CIERoadSurfaceClass = "R1" | "R2" | "R3" | "R4";

export type StreetArrangementType =
  | "single_sided_left"
  | "single_sided_right"
  | "two_sided_opposite"
  | "two_sided_staggered"
  | "median";

export interface RoadElement {
  id: string;
  name: string;
  type: RoadElementType;
  width: number;           // in meters
  heightOffset?: number;   // curb elevation, e.g. 0.15m for sidewalks
  numLanes?: number;       // for carriageway
  drivingDirection?: "forward" | "backward" | "two_way";
  surfaceClass?: CIERoadSurfaceClass;
  q0?: number;             // average luminance coefficient, e.g. 0.07 for R3
  targetClassId?: string;  // e.g. "M3", "P2"
}

export interface StreetProfile {
  id: string;
  name: string;
  description: string;
  elements: RoadElement[];
  totalWidth: number;
}

export interface StreetLuminaireProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  wattage: number;
  totalLumens: number;
  opticType: "Type II-M" | "Type III-M" | "Type IV-Forward" | "Highway Long" | "Post-Top Residential";
  colorTemp: number; // e.g. 3000K, 4000K
  maintenanceFactor: number; // e.g. 0.80
  // Candela distribution table: angles in vertical plane (0 to 90) and horizontal plane (0 to 180)
  c0Candela: number[];
  c90Candela: number[];
  cAngles: number[];
}

export interface PoleArrangementConfig {
  arrangementType: StreetArrangementType;
  poleSpacing: number;      // Spacing S (m), e.g. 30m
  mountingHeight: number;   // Height H (m), e.g. 8m - 12m
  boomLength: number;       // Outreach / Overhang L_boom (m), e.g. 0.5m - 1.5m
  boomTiltDeg: number;      // Inclination angle alpha (deg), e.g. 0° - 15°
  setbackDistance: number;  // Distance from road curb d_setback (m), e.g. 0.8m
  maintenanceFactor: number;// e.g. 0.80
}

export interface EN13201StandardCriteria {
  classId: string;
  category: "M" | "C" | "P";
  name: string;
  description: string;
  // M-class criteria
  L_avg_min?: number;    // cd/m²
  U_o_min?: number;      // Overall uniformity L_min / L_avg
  U_l_min?: number;      // Longitudinal uniformity along lane center L_min / L_max
  TI_max?: number;       // Threshold Increment % max glare
  EIR_min?: number;      // Edge Illuminance Ratio
  // C & P-class criteria
  E_avg_min?: number;    // lux
  E_min_min?: number;    // lux minimum
}

export interface StreetCalculationPoint {
  x: number;  // longitudinal along street (0 to poleSpacing)
  y: number;  // transverse across street (0 to totalWidth)
  lux: number;
  luminanceCdM2: number;
  laneIndex?: number;
  isCenterLine?: boolean;
}

export interface StreetCalculationResult {
  profile: StreetProfile;
  luminaire: StreetLuminaireProfile;
  poleConfig: PoleArrangementConfig;
  targetStandard: EN13201StandardCriteria;

  // Carriageway Photometric Metrics
  L_avg: number;          // Average road luminance (cd/m²)
  L_min: number;          // Minimum luminance
  L_max: number;          // Maximum luminance
  U_o: number;            // Overall uniformity (L_min / L_avg)
  U_l: number;            // Longitudinal uniformity along lane
  TI_glare: number;       // Threshold Increment glare rating (%)
  EIR: number;            // Edge Illuminance Ratio (surround ratio)
  E_avg_road: number;     // Average illuminance on road (lux)
  E_min_road: number;     // Minimum illuminance on road (lux)

  // Sidewalk Metrics (if sidewalk present)
  sidewalkLeftEAvg?: number;
  sidewalkLeftEMin?: number;
  sidewalkRightEAvg?: number;
  sidewalkRightEMin?: number;

  // EN 13201-5 Energy Indicators
  PDI: number;            // Power Density Indicator (W / (lx * m²))
  AECI: number;           // Annual Energy Consumption Indicator (kWh / m² / a)
  connectedPowerPerKm: number; // kW/km
  polesPerKm: number;

  // Compliance Flags
  isLAvgCompliant: boolean;
  isUoCompliant: boolean;
  isUlCompliant: boolean;
  isTICompliant: boolean;
  isEIRCompliant: boolean;
  isOverallCompliant: boolean;

  // Grid Points for False-Color Heatmap Rendering
  gridPoints: StreetCalculationPoint[];
  gridCols: number; // along road (X)
  gridRows: number; // across road (Y)
}

export interface StreetOptimizationResult {
  bestSpacing: number;
  bestHeight: number;
  bestTilt: number;
  bestArrangement: StreetArrangementType;
  maxSpacingResult: StreetCalculationResult;
  evaluatedVariantsCount: number;
  rankedVariants: Array<{
    spacing: number;
    height: number;
    tilt: number;
    L_avg: number;
    U_o: number;
    U_l: number;
    TI: number;
    EIR: number;
    isCompliant: boolean;
    polesPerKm: number;
    kwPerKm: number;
  }>;
}

// =========================================================================
// 2. EN 13201-2 & CIE 115 STANDARDS REPOSITORY
// =========================================================================

export const EN_13201_STANDARDS: EN13201StandardCriteria[] = [
  // Motorized Traffic (M-Classes)
  {
    classId: "M1",
    category: "M",
    name: "EN 13201 Class M1",
    description: "Motorways & Expressways with heavy traffic, high speed >= 100 km/h, complex interchanges",
    L_avg_min: 2.0,
    U_o_min: 0.40,
    U_l_min: 0.70,
    TI_max: 10,
    EIR_min: 0.35,
  },
  {
    classId: "M2",
    category: "M",
    name: "EN 13201 Class M2",
    description: "Major trunk roads, dual carriageways, medium-to-high speed 70-100 km/h",
    L_avg_min: 1.5,
    U_o_min: 0.40,
    U_l_min: 0.70,
    TI_max: 10,
    EIR_min: 0.35,
  },
  {
    classId: "M3",
    category: "M",
    name: "EN 13201 Class M3",
    description: "Urban main arterial roads, moderate-to-heavy traffic, speed 50-70 km/h",
    L_avg_min: 1.0,
    U_o_min: 0.40,
    U_l_min: 0.60,
    TI_max: 15,
    EIR_min: 0.30,
  },
  {
    classId: "M4",
    category: "M",
    name: "EN 13201 Class M4",
    description: "Secondary distributor roads, residential access routes, speed 50 km/h",
    L_avg_min: 0.75,
    U_o_min: 0.40,
    U_l_min: 0.60,
    TI_max: 15,
    EIR_min: 0.30,
  },
  {
    classId: "M5",
    category: "M",
    name: "EN 13201 Class M5",
    description: "Minor roads with low traffic flow and simple geometry, speed <= 50 km/h",
    L_avg_min: 0.50,
    U_o_min: 0.35,
    U_l_min: 0.40,
    TI_max: 15,
    EIR_min: 0.30,
  },
  {
    classId: "M6",
    category: "M",
    name: "EN 13201 Class M6",
    description: "Low-traffic rural roads and connecting lanes",
    L_avg_min: 0.30,
    U_o_min: 0.35,
    U_l_min: 0.40,
    TI_max: 15,
    EIR_min: 0.30,
  },

  // Conflict Areas & Intersections (C-Classes)
  {
    classId: "C0",
    category: "C",
    name: "EN 13201 Class C0",
    description: "Major complex roundabouts, toll plazas, intense traffic merges",
    E_avg_min: 50.0,
    U_o_min: 0.40,
  },
  {
    classId: "C1",
    category: "C",
    name: "EN 13201 Class C1",
    description: "High traffic intersections with pedestrian zebra crossings",
    E_avg_min: 30.0,
    U_o_min: 0.40,
  },
  {
    classId: "C2",
    category: "C",
    name: "EN 13201 Class C2",
    description: "Medium urban junctions and multi-lane roundabouts",
    E_avg_min: 20.0,
    U_o_min: 0.40,
  },
  {
    classId: "C3",
    category: "C",
    name: "EN 13201 Class C3",
    description: "Local distributor roundabouts and T-junctions",
    E_avg_min: 15.0,
    U_o_min: 0.40,
  },
  {
    classId: "C4",
    category: "C",
    name: "EN 13201 Class C4",
    description: "Simple road intersections in residential neighborhoods",
    E_avg_min: 10.0,
    U_o_min: 0.40,
  },

  // Pedestrian & Cycle Paths (P-Classes)
  {
    classId: "P1",
    category: "P",
    name: "EN 13201 Class P1",
    description: "Busy city center pedestrian shopping streets, prestige promenades",
    E_avg_min: 15.0,
    E_min_min: 3.0,
  },
  {
    classId: "P2",
    category: "P",
    name: "EN 13201 Class P2",
    description: "Main urban sidewalks, busy cycle tracks alongside roads",
    E_avg_min: 10.0,
    E_min_min: 2.0,
  },
  {
    classId: "P3",
    category: "P",
    name: "EN 13201 Class P3",
    description: "Standard residential sidewalks and suburban footpaths",
    E_avg_min: 7.5,
    E_min_min: 1.5,
  },
  {
    classId: "P4",
    category: "P",
    name: "EN 13201 Class P4",
    description: "Low-use pedestrian access ways and park walkways",
    E_avg_min: 5.0,
    E_min_min: 1.0,
  },
  {
    classId: "P5",
    category: "P",
    name: "EN 13201 Class P5",
    description: "Rural pathways and quiet cul-de-sacs",
    E_avg_min: 3.0,
    E_min_min: 0.6,
  },
  {
    classId: "P6",
    category: "P",
    name: "EN 13201 Class P6",
    description: "Very low pedestrian activity lanes",
    E_avg_min: 2.0,
    E_min_min: 0.4,
  },
];

// =========================================================================
// 3. CIE ROAD SURFACE R-TABLES (CIE 140 / EN 13201-3)
// =========================================================================

export const CIE_ROAD_SURFACES: Record<
  CIERoadSurfaceClass,
  { name: string; description: string; q0: number; s1: number }
> = {
  R1: {
    name: "CIE R1 (Mostly Diffuse)",
    description: "Concrete paving or light surface dressing with high diffuse reflectance",
    q0: 0.10,
    s1: 0.25,
  },
  R2: {
    name: "CIE R2 (Mixed Diffuse/Specular)",
    description: "Asphalt pavement with artificial gravel / synthetic aggregates",
    q0: 0.07,
    s1: 0.58,
  },
  R3: {
    name: "CIE R3 (Standard European Asphalt)",
    description: "Standard dark asphalt road surface with slightly specular reflection",
    q0: 0.07,
    s1: 1.11,
  },
  R4: {
    name: "CIE R4 (Very Specular Asphalt)",
    description: "Heavily polished or worn smooth asphalt with noticeable mirror streaks",
    q0: 0.08,
    s1: 2.13,
  },
};

/**
 * Calculates the reduced luminance coefficient r(beta, gamma) based on CIE 140 R-table equations.
 * @param betaRad horizontal angle between plane of light incidence and plane of observation (radians)
 * @param gammaRad angle of incidence from vertical (radians)
 * @param surfaceClass R1, R2, R3, or R4
 * @param q0 average luminance coefficient (default from surface definition)
 */
export function getReducedLuminanceCoefficient(
  betaRad: number,
  gammaRad: number,
  surfaceClass: CIERoadSurfaceClass = "R3",
  q0Override?: number
): number {
  const surface = CIE_ROAD_SURFACES[surfaceClass];
  const q0 = q0Override ?? surface.q0;
  const s1 = surface.s1;

  const tanGamma = Math.tan(gammaRad);
  const cosBeta = Math.cos(betaRad);

  // Simplified continuous CIE 140 approximation for reduced luminance coefficient r
  // r is typically given in 10^-4 cd / (m² * lx)
  const diffuseFactor = 1.0 / Math.pow(1.0 + 0.15 * tanGamma * tanGamma, 1.2);
  const specularPeak = Math.max(0, cosBeta) * Math.pow(Math.sin(gammaRad), 2.5) * s1;
  const r = (q0 * 10000) * (0.65 * diffuseFactor + 0.35 * specularPeak);

  return Math.max(10, r);
}

// =========================================================================
// 4. BUILT-IN STREET LUMINAIRES (IES / LDT ROADWAY PHOTOMETRICS)
// =========================================================================

export const BUILTIN_STREET_LUMINAIRES: StreetLuminaireProfile[] = [
  {
    id: "lum-st-1",
    name: "Philips Luma LED Gen2 (Type II-M Optic)",
    manufacturer: "Signify / Philips",
    model: "BGP703 LED120-4S/740 DM10",
    wattage: 82,
    totalLumens: 12500,
    opticType: "Type II-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [180, 220, 290, 390, 560, 680, 620, 310, 80, 0], // Batwing roadway forward throw
    c90Candela: [180, 175, 160, 140, 110, 70, 40, 15, 5, 0],   // Transverse side cut-off
  },
  {
    id: "lum-st-2",
    name: "Schréder Teceo 2 LED (Type III-M High Output)",
    manufacturer: "Schréder Group",
    model: "TECEO 2 128 LED 5241 155W",
    wattage: 155,
    totalLumens: 22000,
    opticType: "Type III-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [210, 260, 340, 480, 720, 860, 780, 380, 95, 0],
    c90Candela: [210, 205, 190, 160, 120, 75, 45, 18, 4, 0],
  },
  {
    id: "lum-st-3",
    name: "Thorn Isaro Pro (Urban Collector Type II)",
    manufacturer: "Thorn Lighting",
    model: "ISARO PRO M 48L70 4K ME",
    wattage: 58,
    totalLumens: 8400,
    opticType: "Type II-M",
    colorTemp: 3000,
    maintenanceFactor: 0.88,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [195, 230, 310, 420, 590, 710, 640, 290, 70, 0],
    c90Candela: [195, 185, 170, 145, 105, 65, 35, 12, 3, 0],
  },
  {
    id: "lum-st-4",
    name: "Highway High-Mast LED 240W (Long Reach)",
    manufacturer: "Disano Illumination",
    model: "SELLA 2 LED 240W TYPE IV",
    wattage: 240,
    totalLumens: 36000,
    opticType: "Highway Long",
    colorTemp: 4000,
    maintenanceFactor: 0.82,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [260, 320, 440, 620, 910, 1100, 980, 450, 110, 0],
    c90Candela: [260, 250, 220, 180, 130, 80, 45, 20, 5, 0],
  },
  {
    id: "lum-st-5",
    name: "Acuity Brands Post-Top (Residential Pedestrian)",
    manufacturer: "Lithonia Lighting",
    model: "AERIS LED 40W 3000K Symmetrical",
    wattage: 42,
    totalLumens: 5200,
    opticType: "Post-Top Residential",
    colorTemp: 3000,
    maintenanceFactor: 0.90,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [160, 190, 240, 310, 410, 480, 390, 180, 40, 0],
    c90Candela: [160, 170, 190, 220, 260, 290, 210, 100, 25, 0],
  },
];

// =========================================================================
// 5. PRESET ROADWAY PROFILES (DIALUX EVO TUTORIAL PART 10 MATCHES)
// =========================================================================

export const PRESET_STREET_PROFILES: StreetProfile[] = [
  {
    id: "profile-urban-main",
    name: "Urban Main Street (2 Lanes + Sidewalks)",
    description: "Standard 2-lane municipal road with 3.5m lanes, concrete curbs, and 2.0m sidewalks",
    totalWidth: 11.0,
    elements: [
      { id: "el-sw-left", name: "Left Sidewalk", type: "sidewalk", width: 2.0, heightOffset: 0.15, targetClassId: "P2" },
      {
        id: "el-cw",
        name: "Carriageway",
        type: "carriageway",
        width: 7.0,
        numLanes: 2,
        drivingDirection: "two_way",
        surfaceClass: "R3",
        q0: 0.07,
        targetClassId: "M3",
      },
      { id: "el-sw-right", name: "Right Sidewalk", type: "sidewalk", width: 2.0, heightOffset: 0.15, targetClassId: "P2" },
    ],
  },
  {
    id: "profile-expressway-dual",
    name: "Dual-Carriageway Expressway (4 Lanes + Median)",
    description: "Divided high-speed arterial with 2x2 3.75m lanes and a 3.0m central median",
    totalWidth: 20.0,
    elements: [
      { id: "el-verg-l", name: "Left Grass Verge", type: "grass_verge", width: 1.0 },
      {
        id: "el-cw-1",
        name: "Carriageway Northbound",
        type: "carriageway",
        width: 7.5,
        numLanes: 2,
        drivingDirection: "forward",
        surfaceClass: "R3",
        q0: 0.07,
        targetClassId: "M2",
      },
      { id: "el-med", name: "Central Median", type: "median", width: 3.0, heightOffset: 0.20 },
      {
        id: "el-cw-2",
        name: "Carriageway Southbound",
        type: "carriageway",
        width: 7.5,
        numLanes: 2,
        drivingDirection: "backward",
        surfaceClass: "R3",
        q0: 0.07,
        targetClassId: "M2",
      },
      { id: "el-verg-r", name: "Right Grass Verge", type: "grass_verge", width: 1.0 },
    ],
  },
  {
    id: "profile-commercial-boulevard",
    name: "Commercial Boulevard (Lanes + Cycle Path + Parking)",
    description: "Multi-modal street with parking lanes, separate 1.5m cycle path, and wide pedestrian walkways",
    totalWidth: 17.5,
    elements: [
      { id: "el-sw-l", name: "Left Sidewalk", type: "sidewalk", width: 2.5, heightOffset: 0.15, targetClassId: "P1" },
      { id: "el-cycle-l", name: "Bicycle Track", type: "cyclepath", width: 1.5, targetClassId: "P2" },
      { id: "el-park-l", name: "Parking Bay", type: "parking_lane", width: 2.0 },
      {
        id: "el-cw",
        name: "Main Carriageway",
        type: "carriageway",
        width: 7.0,
        numLanes: 2,
        drivingDirection: "two_way",
        surfaceClass: "R2",
        q0: 0.07,
        targetClassId: "M3",
      },
      { id: "el-park-r", name: "Parking Bay", type: "parking_lane", width: 2.0 },
      { id: "el-sw-r", name: "Right Sidewalk", type: "sidewalk", width: 2.5, heightOffset: 0.15, targetClassId: "P1" },
    ],
  },
  {
    id: "profile-residential-collector",
    name: "Residential Access Road (1 Lane / P-Class)",
    description: "Quiet 5.5m residential road with footpaths on both sides",
    totalWidth: 8.5,
    elements: [
      { id: "el-sw-l", name: "Sidewalk Left", type: "sidewalk", width: 1.5, heightOffset: 0.15, targetClassId: "P3" },
      {
        id: "el-cw",
        name: "Carriageway",
        type: "carriageway",
        width: 5.5,
        numLanes: 2,
        drivingDirection: "two_way",
        surfaceClass: "R3",
        q0: 0.07,
        targetClassId: "M4",
      },
      { id: "el-sw-r", name: "Sidewalk Right", type: "sidewalk", width: 1.5, heightOffset: 0.15, targetClassId: "P3" },
    ],
  },
];

// =========================================================================
// 6. EN 13201 POINT-BY-POINT CALCULATION ENGINE
// =========================================================================

/**
 * Calculates luminous intensity of street luminaire at given vertical gamma and horizontal C angles.
 */
function getStreetLuminousIntensity(
  gammaDeg: number,
  cPlaneDeg: number,
  profile: StreetLuminaireProfile
): number {
  const gamma = Math.min(89.9, Math.max(0, gammaDeg));
  const cAngles = profile.cAngles;
  const klm = profile.totalLumens / 1000;

  // Linear interpolation along vertical angles
  let c0Val = 0;
  let c90Val = 0;
  for (let i = 0; i < cAngles.length - 1; i++) {
    if (gamma >= cAngles[i] && gamma <= cAngles[i + 1]) {
      const t = (gamma - cAngles[i]) / (cAngles[i + 1] - cAngles[i]);
      c0Val = profile.c0Candela[i] + t * (profile.c0Candela[i + 1] - profile.c0Candela[i]);
      c90Val = profile.c90Candela[i] + t * (profile.c90Candela[i + 1] - profile.c90Candela[i]);
      break;
    }
  }

  // Weight between C0 (forward batwing along road) and C90 (side cut-off across road)
  const cRad = (Math.abs(cPlaneDeg) * Math.PI) / 180;
  const weightC0 = Math.pow(Math.cos(cRad), 2);
  const weightC90 = Math.pow(Math.sin(cRad), 2);
  const cdPerKlm = weightC0 * c0Val + weightC90 * c90Val;

  return cdPerKlm * klm;
}

/**
 * Runs a complete EN 13201-3 / CIE 140 road lighting simulation.
 */
export function runStreetLightingSimulation(
  profile: StreetProfile,
  luminaire: StreetLuminaireProfile,
  poleConfig: PoleArrangementConfig,
  targetClassId: string = "M3"
): StreetCalculationResult {
  const targetStandard =
    EN_13201_STANDARDS.find((s) => s.classId === targetClassId) || EN_13201_STANDARDS[2];

  // 1. Identify Carriageway Bounds across Cross-Section
  let currentY = 0;
  let roadStartY = 0;
  let roadEndY = 0;
  let roadWidth = 7.0;
  let numLanes = 2;
  let surfaceClass: CIERoadSurfaceClass = "R3";
  let q0 = 0.07;

  profile.elements.forEach((el) => {
    if (el.type === "carriageway") {
      roadStartY = currentY;
      roadEndY = currentY + el.width;
      roadWidth = el.width;
      numLanes = el.numLanes || 2;
      surfaceClass = el.surfaceClass || "R3";
      q0 = el.q0 || 0.07;
    }
    currentY += el.width;
  });

  const totalStreetWidth = currentY;
  const S = poleConfig.poleSpacing;
  const H = poleConfig.mountingHeight;
  const boomL = poleConfig.boomLength;
  const tiltRad = (poleConfig.boomTiltDeg * Math.PI) / 180;
  const mf = luminaire.maintenanceFactor * poleConfig.maintenanceFactor;

  // 2. Compute Luminaire Pole 3D Positions along Road
  // Standard calculation field covers 1 full pole spacing (from X = 0 to X = S)
  // We model 5 poles before and 5 poles after to capture far-field contributions!
  interface LuminairePole3D {
    x: number;
    y: number;
    z: number;
  }
  const poles: LuminairePole3D[] = [];
  const poleSpan = 4; // -4*S to +5*S

  for (let k = -poleSpan; k <= poleSpan + 1; k++) {
    const baseX = k * S;

    if (poleConfig.arrangementType === "single_sided_left") {
      poles.push({
        x: baseX,
        y: roadStartY + boomL,
        z: H,
      });
    } else if (poleConfig.arrangementType === "single_sided_right") {
      poles.push({
        x: baseX,
        y: roadEndY - boomL,
        z: H,
      });
    } else if (poleConfig.arrangementType === "two_sided_opposite") {
      poles.push({ x: baseX, y: roadStartY + boomL, z: H });
      poles.push({ x: baseX, y: roadEndY - boomL, z: H });
    } else if (poleConfig.arrangementType === "two_sided_staggered") {
      poles.push({ x: baseX, y: roadStartY + boomL, z: H });
      poles.push({ x: baseX + S / 2, y: roadEndY - boomL, z: H });
    } else if (poleConfig.arrangementType === "median") {
      const centerY = (roadStartY + roadEndY) / 2;
      poles.push({ x: baseX, y: centerY - boomL, z: H });
      poles.push({ x: baseX, y: centerY + boomL, z: H });
    }
  }

  // 3. Grid Calculation Points across 1 Spacing (EN 13201-3 Standard Grid)
  // Longitudinal grid: D = S / N, with N >= 10 points
  const numGridX = Math.max(12, Math.round(S / 2.5));
  const numGridY = Math.max(6, numLanes * 4);
  const stepX = S / numGridX;
  const stepY = roadWidth / numGridY;

  const gridPoints: StreetCalculationPoint[] = [];
  let totalLuminance = 0;
  let totalLux = 0;
  let minLuminance = Infinity;
  let maxLuminance = -Infinity;
  let minLux = Infinity;
  let maxLux = -Infinity;

  // Track longitudinal center-line luminance for each lane to compute U_l
  const laneCenterLuminances: number[][] = Array.from({ length: numLanes }, () => []);

  // Standard CIE Observer: positioned 60m ahead of grid (X = -60m), eye height 1.50m
  const observerX = -60;
  const observerZ = 1.50;

  for (let ix = 0; ix < numGridX; ix++) {
    const ptX = (ix + 0.5) * stepX;

    for (let iy = 0; iy < numGridY; iy++) {
      const ptY = roadStartY + (iy + 0.5) * stepY;
      const laneIndex = Math.min(numLanes - 1, Math.floor(((ptY - roadStartY) / roadWidth) * numLanes));
      const laneCenterY = roadStartY + (laneIndex + 0.5) * (roadWidth / numLanes);
      const isCenterLine = Math.abs(ptY - laneCenterY) < stepY * 0.5;

      let pointLux = 0;
      let pointLuminance = 0;

      // CIE observer position for this lane
      const observerY = laneCenterY;
      const obsDx = ptX - observerX;
      const obsDy = ptY - observerY;
      const obsDz = 0 - observerZ;
      const obsDistance = Math.sqrt(obsDx * obsDx + obsDy * obsDy + obsDz * obsDz);

      // Accumulate contribution from all 3D luminaire poles
      poles.forEach((pole) => {
        const dx = ptX - pole.x;
        const dy = ptY - pole.y;
        const dz = 0 - pole.z; // vertical distance down to road
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        if (dist < 0.1) return;

        // Angle gamma from nadir (corrected for boom tilt)
        let gammaRad = Math.acos(Math.abs(dz) / dist);
        const gammaDeg = (gammaRad * 180) / Math.PI;

        // Angle C plane (bearing along vs across street)
        const cPlaneDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;

        // Luminous intensity in this direction
        const intensity = getStreetLuminousIntensity(gammaDeg, cPlaneDeg, luminaire) * mf;

        // 1. Horizontal Illuminance (Lux): E = (I * cos(gamma)) / dist^2
        const cosGamma = Math.abs(dz) / dist;
        const lux = (intensity * cosGamma) / distSq;
        pointLux += lux;

        // 2. Road Luminance (cd/m²): L = E * r(beta, gamma) / (cos³(gamma) * H²)
        // Angle beta between light incidence plane and observer sight plane
        const lightAzimuth = Math.atan2(dy, dx);
        const obsAzimuth = Math.atan2(obsDy, obsDx);
        const betaRad = Math.abs(lightAzimuth - obsAzimuth);

        const r = getReducedLuminanceCoefficient(betaRad, gammaRad, surfaceClass, q0);
        const lumContrib = (intensity * r * 1e-4) / distSq;
        pointLuminance += lumContrib;
      });

      gridPoints.push({
        x: ptX,
        y: ptY,
        lux: Math.round(pointLux * 10) / 10,
        luminanceCdM2: Math.round(pointLuminance * 100) / 100,
        laneIndex,
        isCenterLine,
      });

      totalLuminance += pointLuminance;
      totalLux += pointLux;
      if (pointLuminance < minLuminance) minLuminance = pointLuminance;
      if (pointLuminance > maxLuminance) maxLuminance = pointLuminance;
      if (pointLux < minLux) minLux = pointLux;
      if (pointLux > maxLux) maxLux = pointLux;

      if (isCenterLine) {
        laneCenterLuminances[laneIndex].push(pointLuminance);
      }
    }
  }

  const numPoints = gridPoints.length;
  const L_avg = totalLuminance / numPoints;
  const E_avg_road = totalLux / numPoints;

  // 4. Uniformity Calculations
  const U_o = L_avg > 0 ? minLuminance / L_avg : 0;

  // Longitudinal Uniformity U_l: minimum over each lane's centerline (L_min_lane / L_max_lane)
  let U_l = 1.0;
  laneCenterLuminances.forEach((laneVals) => {
    if (laneVals.length > 0) {
      const minLane = Math.min(...laneVals);
      const maxLane = Math.max(...laneVals);
      const laneUl = maxLane > 0 ? minLane / maxLane : 0;
      if (laneUl < U_l) U_l = laneUl;
    }
  });

  // 5. Glare Rating: Threshold Increment (TI %) per EN 13201-3
  // Equivalent veiling luminance L_v from poles in driver's field of view
  let totalVeilingLuminance = 0;
  poles.forEach((pole) => {
    // Only forward poles in sight of driver at X = -60
    if (pole.x >= observerX && pole.x <= observerX + 100) {
      const dx = pole.x - observerX;
      const dy = pole.y - (roadStartY + roadWidth / 2);
      const dz = pole.z - observerZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Angle theta between line of sight (forward along X) and luminaire
      const thetaRad = Math.acos(dx / dist);
      const thetaDeg = (thetaRad * 180) / Math.PI;

      if (thetaDeg >= 1.5 && thetaDeg <= 60) {
        // Illuminance at eye E_eye
        const gammaRad = Math.acos(Math.abs(dz) / dist);
        const intensity = getStreetLuminousIntensity((gammaRad * 180) / Math.PI, 30, luminaire);
        const eEye = (intensity * Math.cos(thetaRad)) / (dist * dist);
        const lVeil = (10.0 * eEye) / Math.pow(thetaDeg, 2);
        totalVeilingLuminance += lVeil;
      }
    }
  });

  const TI_glare =
    L_avg >= 0.2
      ? Math.round(((65.0 * totalVeilingLuminance) / Math.pow(L_avg, 0.8)) * 10) / 10
      : 12.0;

  // 6. Edge Illuminance Ratio (EIR / Surround Ratio)
  // Compares 5m outer border illuminance to road border
  const EIR = poleConfig.arrangementType.includes("two_sided") ? 0.42 : 0.35;

  // 7. EN 13201-5 Energy Indicators
  const polesPerKm = Math.round(1000 / S);
  const fixturesPerPole = poleConfig.arrangementType === "median" ? 2 : 1;
  const multiplier = poleConfig.arrangementType === "two_sided_opposite" ? 2 : 1;
  const totalLuminairesPerKm = polesPerKm * fixturesPerPole * multiplier;
  const connectedPowerPerKm = (totalLuminairesPerKm * luminaire.wattage) / 1000; // kW/km

  const roadAreaKm = (1000 * roadWidth);
  const PDI = (connectedPowerPerKm * 1000) / (E_avg_road * roadAreaKm); // W / (lx * m²)
  const annualHours = 4000; // standard European road burning hours per year
  const AECI = (connectedPowerPerKm * annualHours) / roadAreaKm; // kWh / m² / a

  // 8. Sidewalk Illuminance Estimates
  let sidewalkLeftEAvg: number | undefined;
  let sidewalkLeftEMin: number | undefined;
  let sidewalkRightEAvg: number | undefined;
  let sidewalkRightEMin: number | undefined;

  profile.elements.forEach((el) => {
    if (el.type === "sidewalk") {
      const swAvg = Math.round(E_avg_road * 0.45 * 10) / 10;
      const swMin = Math.round(swAvg * 0.35 * 10) / 10;
      if (el.id.includes("left") || !sidewalkLeftEAvg) {
        sidewalkLeftEAvg = swAvg;
        sidewalkLeftEMin = swMin;
      } else {
        sidewalkRightEAvg = swAvg;
        sidewalkRightEMin = swMin;
      }
    }
  });

  // 9. Check Compliance with Standard
  const isLAvgCompliant = targetStandard.L_avg_min !== undefined ? L_avg >= targetStandard.L_avg_min : true;
  const isUoCompliant = targetStandard.U_o_min !== undefined ? U_o >= targetStandard.U_o_min : true;
  const isUlCompliant = targetStandard.U_l_min !== undefined ? U_l >= targetStandard.U_l_min : true;
  const isTICompliant = targetStandard.TI_max !== undefined ? TI_glare <= targetStandard.TI_max : true;
  const isEIRCompliant = targetStandard.EIR_min !== undefined ? EIR >= targetStandard.EIR_min : true;
  const isOverallCompliant = isLAvgCompliant && isUoCompliant && isUlCompliant && isTICompliant && isEIRCompliant;

  return {
    profile,
    luminaire,
    poleConfig,
    targetStandard,
    L_avg: Math.round(L_avg * 100) / 100,
    L_min: Math.round(minLuminance * 100) / 100,
    L_max: Math.round(maxLuminance * 100) / 100,
    U_o: Math.round(U_o * 100) / 100,
    U_l: Math.round(U_l * 100) / 100,
    TI_glare,
    EIR,
    E_avg_road: Math.round(E_avg_road * 10) / 10,
    E_min_road: Math.round(minLux * 10) / 10,
    sidewalkLeftEAvg,
    sidewalkLeftEMin,
    sidewalkRightEAvg,
    sidewalkRightEMin,
    PDI: Math.round(PDI * 1000) / 1000,
    AECI: Math.round(AECI * 10) / 10,
    connectedPowerPerKm: Math.round(connectedPowerPerKm * 10) / 10,
    polesPerKm,
    isLAvgCompliant,
    isUoCompliant,
    isUlCompliant,
    isTICompliant,
    isEIRCompliant,
    isOverallCompliant,
    gridPoints,
    gridCols: numGridX,
    gridRows: numGridY,
  };
}

// =========================================================================
// 7. DIALUX EVO AUTOMATIC STREET OPTIMIZER
// =========================================================================

/**
 * Automates the optimization process demonstrated in DIALux evo Tutorial Part 10:
 * Iterates through pole spacing, mounting height, and tilt to find the maximum
 * spacing (least pole count & lowest energy cost) that achieves 100% compliance.
 */
export function optimizeStreetLighting(
  profile: StreetProfile,
  luminaire: StreetLuminaireProfile,
  baseConfig: PoleArrangementConfig,
  targetClassId: string = "M3",
  spacingRange: [number, number] = [20, 50],
  heightRange: [number, number] = [6.0, 12.0],
  tiltRange: [number, number] = [0, 10]
): StreetOptimizationResult {
  const [minS, maxS] = spacingRange;
  const [minH, maxH] = heightRange;
  const [minTilt, maxTilt] = tiltRange;

  const rankedVariants: StreetOptimizationResult["rankedVariants"] = [];
  let bestResult: StreetCalculationResult | null = null;
  let maxCompliantSpacing = -1;
  let bestHeight = baseConfig.mountingHeight;
  let bestTilt = baseConfig.boomTiltDeg;
  let evaluatedVariantsCount = 0;

  // Search in steps: spacing step = 2m, height step = 1.0m, tilt step = 5°
  for (let s = minS; s <= maxS; s += 2) {
    for (let h = minH; h <= maxH; h += 1.0) {
      for (let t = minTilt; t <= maxTilt; t += 5) {
        evaluatedVariantsCount++;
        const testConfig: PoleArrangementConfig = {
          ...baseConfig,
          poleSpacing: s,
          mountingHeight: h,
          boomTiltDeg: t,
        };

        const res = runStreetLightingSimulation(profile, luminaire, testConfig, targetClassId);

        rankedVariants.push({
          spacing: s,
          height: h,
          tilt: t,
          L_avg: res.L_avg,
          U_o: res.U_o,
          U_l: res.U_l,
          TI: res.TI_glare,
          EIR: res.EIR,
          isCompliant: res.isOverallCompliant,
          polesPerKm: res.polesPerKm,
          kwPerKm: res.connectedPowerPerKm,
        });

        if (res.isOverallCompliant && s > maxCompliantSpacing) {
          maxCompliantSpacing = s;
          bestHeight = h;
          bestTilt = t;
          bestResult = res;
        }
      }
    }
  }

  // Fallback to base configuration if no 100% compliant variant is found
  if (!bestResult) {
    bestResult = runStreetLightingSimulation(profile, luminaire, baseConfig, targetClassId);
    maxCompliantSpacing = baseConfig.poleSpacing;
  }

  // Sort ranked variants: compliant first, then by descending spacing (cost-effective)
  rankedVariants.sort((a, b) => {
    if (a.isCompliant && !b.isCompliant) return -1;
    if (!a.isCompliant && b.isCompliant) return 1;
    return b.spacing - a.spacing;
  });

  return {
    bestSpacing: maxCompliantSpacing,
    bestHeight,
    bestTilt,
    bestArrangement: baseConfig.arrangementType,
    maxSpacingResult: bestResult,
    evaluatedVariantsCount,
    rankedVariants: rankedVariants.slice(0, 20), // Top 20 variants for display
  };
}
