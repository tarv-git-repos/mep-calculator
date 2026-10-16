/**
 * =========================================================================
 * DIALUX EVO ROUNDABOUT LIGHTING ENGINE (EN 13201 / CIE 115 / CIE 140)
 * =========================================================================
 * 
 * Implements the complete Roundabout Construction and Calculation functionality
 * from DIALux evo Tutorial Part 16: "Creating and calculating roundabouts"
 * 
 * Capabilities:
 * - Parametric Roundabout Geometry Builder:
 *   - Central island (radius, truck apron with mountable curb, landscaping styles)
 *   - Circulatory roadway (1 to 3 lanes, lane width, inner/outer radius)
 *   - Radial approach arms (3-way, 4-way, 5-way) with entry/exit lanes, splitter islands, and crosswalks
 * - Luminaire Placement Modes:
 *   - Outer Perimeter Polar Array (radial step, angular distribution, arc spacing s = 2*pi*R/N)
 *   - Central High-Mast Cluster (multi-head fixtures pointing outwards)
 *   - Approach Conflict Pairs (luminaires lighting entry and exit conflict points)
 * - EN 13201-2 Conflict Area C-Classes (C0, C1, C2, C3, C4, C5):
 *   - Maintained average illuminance E_avg (7.5 lx to 50 lx)
 *   - Overall uniformity U_o >= 0.40
 *   - Pedestrian crosswalk illuminance evaluation
 * - High-density Annular & Approach Calculation Grids
 * - Inverse-Square Photometric Point-by-Point Calculation with Candela distributions
 * - Energy Efficiency Metrics (PDI & AECI) per EN 13201-5
 * - Automatic Roundabout Spacing & Pole Count Optimizer
 */

// =========================================================================
// 1. DATA TYPES & INTERFACES
// =========================================================================

export type RoundaboutArrangementType =
  | "outer_perimeter"
  | "central_island_mast"
  | "combined"
  | "approach_conflict_pairs";

export type CentralLandscapingType =
  | "grass_mound"
  | "paved_apron"
  | "sculpture_fountain"
  | "low_shrubbery"
  | "flat_lawn";

export type LuminaireAimingMode =
  | "tangential"
  | "inward_radial"
  | "forward_drive";

export interface RoundaboutArm {
  id: string;
  name: string;
  angleDeg: number;         // Azimuth angle: 0° (East), 90° (North), 180° (West), 270° (South)
  entryLanes: number;       // Inflow lanes (1 or 2)
  exitLanes: number;        // Outflow lanes (1 or 2)
  laneWidth: number;        // in meters (e.g. 3.75m)
  length: number;           // Approach road length in meters (e.g. 35m - 50m)
  hasSplitterIsland: boolean;
  splitterWidth: number;    // Width of triangular deflection island (e.g. 2.0m)
  hasCrosswalk: boolean;
  crosswalkDistance: number;// Distance from outer circulatory curb (e.g. 12m)
}

export interface RoundaboutGeometry {
  id: string;
  name: string;
  description: string;
  center: { x: number; y: number };
  islandRadius: number;       // Central island radius in meters (e.g. 10m - 25m)
  truckApronWidth: number;    // Mountable truck apron ring width in meters (e.g. 1.5m - 3.0m)
  truckApronCurb: number;     // Apron curb step height in meters (e.g. 0.08m)
  circulatoryLanes: number;   // 1, 2, or 3 lanes
  laneWidth: number;          // Circulatory lane width in meters (e.g. 4.5m - 5.5m)
  outerRoadwayRadius: number; // Computed: islandRadius + truckApronWidth + circulatoryLanes * laneWidth
  landscapingType: CentralLandscapingType;
  arms: RoundaboutArm[];
}

export interface RoundaboutLuminaireProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  wattage: number;
  totalLumens: number;
  opticType: "Type II-M" | "Type III-M" | "Type IV-Forward" | "Type V-Circular" | "Area Flood";
  colorTemp: number; // 3000K, 4000K, etc.
  maintenanceFactor: number;
  cAngles: number[];
  c0Candela: number[];  // Forward throw candela per 1000 lm
  c90Candela: number[]; // Transverse candela per 1000 lm
}

export interface RoundaboutPoleConfig {
  arrangementType: RoundaboutArrangementType;
  poleCount: number;          // Total perimeter poles (e.g. 6 to 12)
  setback: number;            // Distance from outer road edge in meters (e.g. 1.2m)
  mountingHeight: number;     // Height in meters (e.g. 8m - 12m)
  boomLength: number;         // Outreach / overhang in meters (e.g. 1.0m)
  boomTiltDeg: number;        // Inclination angle in degrees (e.g. 5°)
  aimingMode: LuminaireAimingMode;
  maintenanceFactor: number;  // Default 0.85
  // Central high-mast parameters (for central mast or combined mode)
  centralMastPoles?: number;   // e.g. 4 or 6 fixtures on central cluster
  centralMastHeight?: number;  // e.g. 16m - 22m
  centralMastTilt?: number;    // e.g. 20°
  // Approach conflict lighting
  includeApproachPoles?: boolean;
  approachPoleHeight?: number;
}

export interface EN13201CClassCriteria {
  classId: "C0" | "C1" | "C2" | "C3" | "C4" | "C5";
  name: string;
  description: string;
  E_avg_min: number;    // Maintained average horizontal illuminance (lux)
  U_o_min: number;      // Minimum overall uniformity E_min / E_avg (0.40)
  TI_max: number;       // Maximum allowable threshold increment (%)
}

export interface RoundaboutPolePosition {
  id: string;
  x: number;
  y: number;
  z: number;
  headingDeg: number;   // Azimuth angle luminaire is aiming towards
  tiltDeg: number;
  isCentral?: boolean;
  isApproach?: boolean;
  armId?: string;
  spacingToNextM?: number;
}

export interface RoundaboutGridPoint {
  x: number;
  y: number;
  lux: number;
  zone: "circulatory" | "apron" | "approach" | "crosswalk";
  armId?: string;
  laneIndex?: number;
}

export interface RoundaboutCalculationResult {
  geometry: RoundaboutGeometry;
  luminaire: RoundaboutLuminaireProfile;
  poleConfig: RoundaboutPoleConfig;
  targetStandard: EN13201CClassCriteria;

  // Circulatory Roadway Photometric Metrics
  E_avg: number;          // Average maintained illuminance (lux)
  E_min: number;          // Minimum illuminance (lux)
  E_max: number;          // Maximum illuminance (lux)
  U_o: number;            // Overall uniformity (E_min / E_avg)
  U_d: number;            // Uniformity ratio (E_min / E_max)

  // Sub-zone metrics
  apronEAvg: number;
  approachEAvg: Record<string, number>;
  crosswalkEAvg: Record<string, number>;

  // Compliance Flags
  isEAvgCompliant: boolean;
  isUoCompliant: boolean;
  isCrosswalkCompliant: boolean;
  isOverallCompliant: boolean;

  // Energy Indicators (EN 13201-5)
  totalPoles: number;
  totalPowerW: number;
  lightedAreaM2: number;
  PDI: number;            // Power Density Indicator: W / (lx * m²)
  AECI: number;           // Annual Energy Consumption Indicator: kWh / m² / year

  // Pole Spacing Metrics
  perimeterPoleSpacingM: number; // Arc distance between consecutive perimeter poles
  spacingToHeightRatio: number;  // s / H (recommended <= 3.5)

  // Detailed Sampling Points & Poles
  gridPoints: RoundaboutGridPoint[];
  polePositions: RoundaboutPolePosition[];
}

export interface RoundaboutOptimizationVariant {
  poleCount: number;
  height: number;
  tilt: number;
  arrangement: RoundaboutArrangementType;
  E_avg: number;
  E_min: number;
  U_o: number;
  spacingM: number;
  sToHRatio: number;
  totalPowerW: number;
  isCompliant: boolean;
}

export interface RoundaboutOptimizationResult {
  bestVariant: RoundaboutOptimizationVariant;
  allVariants: RoundaboutOptimizationVariant[];
  evaluatedCount: number;
}

// =========================================================================
// 2. EN 13201-2 CONFLICT AREA STANDARDS (C-SERIES)
// =========================================================================

export const ROUNDABOUT_C_STANDARDS: Record<string, EN13201CClassCriteria> = {
  C0: {
    classId: "C0",
    name: "EN 13201 Class C0",
    description: "Major complex roundabouts, grade-separated junctions, multi-lane heavy traffic (> 25,000 veh/day)",
    E_avg_min: 50.0,
    U_o_min: 0.40,
    TI_max: 10,
  },
  C1: {
    classId: "C1",
    name: "EN 13201 Class C1",
    description: "Arterial dual-carriageway roundabouts with high traffic volume (15,000 - 25,000 veh/day)",
    E_avg_min: 30.0,
    U_o_min: 0.40,
    TI_max: 10,
  },
  C2: {
    classId: "C2",
    name: "EN 13201 Class C2",
    description: "Standard suburban roundabouts, commercial intersections with moderate traffic (8,000 - 15,000 veh/day)",
    E_avg_min: 20.0,
    U_o_min: 0.40,
    TI_max: 15,
  },
  C3: {
    classId: "C3",
    name: "EN 13201 Class C3",
    description: "Urban collector roundabouts and distributor junctions (4,000 - 8,000 veh/day)",
    E_avg_min: 15.0,
    U_o_min: 0.40,
    TI_max: 15,
  },
  C4: {
    classId: "C4",
    name: "EN 13201 Class C4",
    description: "Local residential access roundabouts, low speed <= 50 km/h (1,500 - 4,000 veh/day)",
    E_avg_min: 10.0,
    U_o_min: 0.40,
    TI_max: 15,
  },
  C5: {
    classId: "C5",
    name: "EN 13201 Class C5",
    description: "Quiet residential mini-roundabouts and rural crossroads (< 1,500 veh/day)",
    E_avg_min: 7.5,
    U_o_min: 0.40,
    TI_max: 20,
  },
};

// =========================================================================
// 3. BUILT-IN LUMINAIRES REPOSITORY FOR ROUNDABOUTS
// =========================================================================

export const BUILTIN_ROUNDABOUT_LUMINAIRES: RoundaboutLuminaireProfile[] = [
  {
    id: "lum-rb-1",
    name: "Philips Luma Gen2 (Roundabout Wide Type II-M)",
    manufacturer: "Signify / Philips",
    model: "BGP704 LED180-4S/740 DM50",
    wattage: 120,
    totalLumens: 17400,
    opticType: "Type II-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [210, 260, 350, 490, 680, 840, 760, 360, 85, 0],
    c90Candela: [210, 205, 190, 160, 120, 75, 45, 18, 4, 0],
  },
  {
    id: "lum-rb-2",
    name: "Schréder Teceo 2 (Conflict Area Optic 5241)",
    manufacturer: "Schréder Group",
    model: "TECEO 2 128 LED 155W Wide Conflict",
    wattage: 155,
    totalLumens: 22800,
    opticType: "Type III-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [240, 300, 410, 580, 820, 990, 890, 420, 95, 0],
    c90Candela: [240, 235, 215, 180, 135, 85, 50, 20, 5, 0],
  },
  {
    id: "lum-rb-3",
    name: "Disano Sella 2 High-Power Area (Type IV)",
    manufacturer: "Disano Illumination",
    model: "SELLA 2 LED 200W Wide Throw",
    wattage: 200,
    totalLumens: 31000,
    opticType: "Type IV-Forward",
    colorTemp: 4000,
    maintenanceFactor: 0.82,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [290, 370, 510, 720, 1050, 1260, 1120, 510, 120, 0],
    c90Candela: [290, 280, 250, 200, 150, 90, 50, 22, 6, 0],
  },
  {
    id: "lum-rb-4",
    name: "Lithonia HighMast Roundabout Floodlight (400W)",
    manufacturer: "Acuity Brands / Lithonia",
    model: "HMS LED 400W 4K Symmetric Ring",
    wattage: 400,
    totalLumens: 59000,
    opticType: "Area Flood",
    colorTemp: 4000,
    maintenanceFactor: 0.82,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [380, 450, 590, 780, 1080, 1250, 950, 420, 90, 0],
    c90Candela: [380, 420, 550, 720, 990, 1150, 880, 390, 85, 0],
  },
  {
    id: "lum-rb-5",
    name: "Thorn Isaro Pro (Urban Compact 80W)",
    manufacturer: "Thorn Lighting",
    model: "ISARO PRO M 60L70 4K",
    wattage: 80,
    totalLumens: 11600,
    opticType: "Type II-M",
    colorTemp: 3000,
    maintenanceFactor: 0.88,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [195, 240, 320, 450, 630, 760, 680, 310, 75, 0],
    c90Candela: [195, 185, 170, 145, 105, 65, 35, 12, 3, 0],
  },
  {
    id: "lum-rb-6",
    name: "Siteco Streetlight 11 Micro (50W Mini)",
    manufacturer: "Siteco",
    model: "5XE1 Streetlight 11 Micro LED 50W",
    wattage: 50,
    totalLumens: 6900,
    opticType: "Type II-M",
    colorTemp: 3000,
    maintenanceFactor: 0.90,
    cAngles: [0, 15, 30, 45, 60, 70, 75, 80, 85, 90],
    c0Candela: [160, 195, 260, 360, 510, 620, 540, 240, 55, 0],
    c90Candela: [160, 150, 135, 115, 85, 50, 25, 8, 2, 0],
  },
];

// =========================================================================
// 4. PRESET ROUNDABOUT ARCHITECTURES (DIALUX EVO TUTORIAL 16)
// =========================================================================

export const PRESET_ROUNDABOUTS: RoundaboutGeometry[] = [
  {
    id: "rb-suburban-dual",
    name: "Standard Suburban Dual-Lane Roundabout",
    description: "4-way intersection with 14m central island, 2.0m truck apron, 2 circulatory lanes (4.5m each), and splitter islands",
    center: { x: 0, y: 0 },
    islandRadius: 14.0,
    truckApronWidth: 2.0,
    truckApronCurb: 0.08,
    circulatoryLanes: 2,
    laneWidth: 4.5,
    outerRoadwayRadius: 25.0, // 14 + 2 + 2*4.5
    landscapingType: "grass_mound",
    arms: [
      {
        id: "arm-east",
        name: "East Approach (Main St)",
        angleDeg: 0,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 40.0,
        hasSplitterIsland: true,
        splitterWidth: 2.5,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
      {
        id: "arm-north",
        name: "North Approach (Parkway Ave)",
        angleDeg: 90,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 40.0,
        hasSplitterIsland: true,
        splitterWidth: 2.5,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
      {
        id: "arm-west",
        name: "West Approach (Main St)",
        angleDeg: 180,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 40.0,
        hasSplitterIsland: true,
        splitterWidth: 2.5,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
      {
        id: "arm-south",
        name: "South Approach (Commercial Blvd)",
        angleDeg: 270,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 40.0,
        hasSplitterIsland: true,
        splitterWidth: 2.5,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
    ],
  },
  {
    id: "rb-urban-single",
    name: "Compact Urban Single-Lane Roundabout",
    description: "Compact 4-way roundabout with 10m island, 1.5m apron, 1 wide lane (5.5m), designed for urban traffic calming",
    center: { x: 0, y: 0 },
    islandRadius: 10.0,
    truckApronWidth: 1.5,
    truckApronCurb: 0.08,
    circulatoryLanes: 1,
    laneWidth: 5.5,
    outerRoadwayRadius: 17.0, // 10 + 1.5 + 5.5
    landscapingType: "low_shrubbery",
    arms: [
      {
        id: "arm-e",
        name: "East Approach",
        angleDeg: 0,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.5,
        length: 30.0,
        hasSplitterIsland: true,
        splitterWidth: 1.8,
        hasCrosswalk: true,
        crosswalkDistance: 10.0,
      },
      {
        id: "arm-n",
        name: "North Approach",
        angleDeg: 90,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.5,
        length: 30.0,
        hasSplitterIsland: true,
        splitterWidth: 1.8,
        hasCrosswalk: true,
        crosswalkDistance: 10.0,
      },
      {
        id: "arm-w",
        name: "West Approach",
        angleDeg: 180,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.5,
        length: 30.0,
        hasSplitterIsland: true,
        splitterWidth: 1.8,
        hasCrosswalk: true,
        crosswalkDistance: 10.0,
      },
      {
        id: "arm-s",
        name: "South Approach",
        angleDeg: 270,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.5,
        length: 30.0,
        hasSplitterIsland: true,
        splitterWidth: 1.8,
        hasCrosswalk: true,
        crosswalkDistance: 10.0,
      },
    ],
  },
  {
    id: "rb-arterial-triple",
    name: "Arterial Multi-Lane 3-Lane Roundabout",
    description: "High-capacity intersection with 20m island, 2.5m apron, 3 circulatory lanes (4.2m each), designed for arterial ring roads",
    center: { x: 0, y: 0 },
    islandRadius: 20.0,
    truckApronWidth: 2.5,
    truckApronCurb: 0.10,
    circulatoryLanes: 3,
    laneWidth: 4.2,
    outerRoadwayRadius: 35.1, // 20 + 2.5 + 3*4.2
    landscapingType: "sculpture_fountain",
    arms: [
      {
        id: "arm-e3",
        name: "East Expressway",
        angleDeg: 0,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 50.0,
        hasSplitterIsland: true,
        splitterWidth: 3.0,
        hasCrosswalk: true,
        crosswalkDistance: 15.0,
      },
      {
        id: "arm-n3",
        name: "North Arterial",
        angleDeg: 90,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 50.0,
        hasSplitterIsland: true,
        splitterWidth: 3.0,
        hasCrosswalk: true,
        crosswalkDistance: 15.0,
      },
      {
        id: "arm-w3",
        name: "West Expressway",
        angleDeg: 180,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 50.0,
        hasSplitterIsland: true,
        splitterWidth: 3.0,
        hasCrosswalk: true,
        crosswalkDistance: 15.0,
      },
      {
        id: "arm-s3",
        name: "South Arterial",
        angleDeg: 270,
        entryLanes: 2,
        exitLanes: 2,
        laneWidth: 3.75,
        length: 50.0,
        hasSplitterIsland: true,
        splitterWidth: 3.0,
        hasCrosswalk: true,
        crosswalkDistance: 15.0,
      },
    ],
  },
  {
    id: "rb-t-junction",
    name: "3-Way T-Junction Roundabout",
    description: "3-arm roundabout with 12m island, 1.8m apron, 1 lane (5.0m), arms at 0°, 120°, and 240°",
    center: { x: 0, y: 0 },
    islandRadius: 12.0,
    truckApronWidth: 1.8,
    truckApronCurb: 0.08,
    circulatoryLanes: 1,
    laneWidth: 5.0,
    outerRoadwayRadius: 18.8,
    landscapingType: "grass_mound",
    arms: [
      {
        id: "arm-t1",
        name: "Branch 1 (East)",
        angleDeg: 0,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.75,
        length: 35.0,
        hasSplitterIsland: true,
        splitterWidth: 2.0,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
      {
        id: "arm-t2",
        name: "Branch 2 (North-West 120°)",
        angleDeg: 120,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.75,
        length: 35.0,
        hasSplitterIsland: true,
        splitterWidth: 2.0,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
      {
        id: "arm-t3",
        name: "Branch 3 (South-West 240°)",
        angleDeg: 240,
        entryLanes: 1,
        exitLanes: 1,
        laneWidth: 3.75,
        length: 35.0,
        hasSplitterIsland: true,
        splitterWidth: 2.0,
        hasCrosswalk: true,
        crosswalkDistance: 12.0,
      },
    ],
  },
];

// =========================================================================
// 5. GEOMETRY HELPER & POLE POSITIONS CALCULATOR
// =========================================================================

/**
 * Calculates the exact 3D pole positions based on geometry and arrangement settings.
 */
export function calculateRoundaboutPoles(
  geometry: RoundaboutGeometry,
  config: RoundaboutPoleConfig
): RoundaboutPolePosition[] {
  const poles: RoundaboutPolePosition[] = [];
  const outerR = geometry.outerRoadwayRadius + config.setback;

  // 1. Outer Perimeter Polar Array
  if (
    config.arrangementType === "outer_perimeter" ||
    config.arrangementType === "combined"
  ) {
    const N = Math.max(3, config.poleCount);
    const dTheta = (2 * Math.PI) / N;
    const arcSpacing = (2 * Math.PI * outerR) / N;

    for (let i = 0; i < N; i++) {
      const angle = i * dTheta;
      const px = geometry.center.x + outerR * Math.cos(angle);
      const py = geometry.center.y + outerR * Math.sin(angle);

      // Aiming heading:
      let headingDeg = 0;
      if (config.aimingMode === "inward_radial") {
        // Pointing directly towards central island
        headingDeg = (angle * 180) / Math.PI + 180;
      } else if (config.aimingMode === "tangential") {
        // Pointing in direction of traffic flow (counter-clockwise)
        headingDeg = (angle * 180) / Math.PI + 90;
      } else {
        // Angled slightly inward with driving vector
        headingDeg = (angle * 180) / Math.PI + 135;
      }

      poles.push({
        id: `pole-perim-${i + 1}`,
        x: px,
        y: py,
        z: config.mountingHeight,
        headingDeg: (headingDeg + 360) % 360,
        tiltDeg: config.boomTiltDeg,
        spacingToNextM: arcSpacing,
      });
    }
  }

  // 2. Central Island High Mast Cluster
  if (
    config.arrangementType === "central_island_mast" ||
    config.arrangementType === "combined"
  ) {
    const mastCount = config.centralMastPoles || 6;
    const mastHeight = config.centralMastHeight || (config.mountingHeight + 6);
    const mastTilt = config.centralMastTilt || 25;
    const dTheta = (2 * Math.PI) / mastCount;

    for (let i = 0; i < mastCount; i++) {
      const angle = i * dTheta;
      // Head offset slightly from mast center (0.8m cluster ring)
      const px = geometry.center.x + 0.8 * Math.cos(angle);
      const py = geometry.center.y + 0.8 * Math.sin(angle);
      const headingDeg = (angle * 180) / Math.PI; // pointing outward radially

      poles.push({
        id: `pole-mast-${i + 1}`,
        x: px,
        y: py,
        z: mastHeight,
        headingDeg,
        tiltDeg: mastTilt,
        isCentral: true,
      });
    }
  }

  // 3. Approach Arm Conflict Pairs
  if (
    config.arrangementType === "approach_conflict_pairs" ||
    (config.arrangementType === "combined" && config.includeApproachPoles)
  ) {
    geometry.arms.forEach((arm) => {
      const rad = (arm.angleDeg * Math.PI) / 180;
      const armTotalWidth = (arm.entryLanes + arm.exitLanes) * arm.laneWidth + (arm.hasSplitterIsland ? arm.splitterWidth : 0);
      const halfW = armTotalWidth / 2 + config.setback;

      // Pole 1: Entry side, approx 15m back from roundabout curb
      const dist1 = geometry.outerRoadwayRadius + 14.0;
      // Perpendicular vector for offset
      const perpRad = rad + Math.PI / 2;
      const p1x = geometry.center.x + dist1 * Math.cos(rad) + halfW * Math.cos(perpRad);
      const p1y = geometry.center.y + dist1 * Math.sin(rad) + halfW * Math.sin(perpRad);

      poles.push({
        id: `pole-app-${arm.id}-entry`,
        x: p1x,
        y: p1y,
        z: config.approachPoleHeight || config.mountingHeight,
        headingDeg: (arm.angleDeg + 180) % 360,
        tiltDeg: config.boomTiltDeg,
        isApproach: true,
        armId: arm.id,
      });

      // Pole 2: Exit side
      const p2x = geometry.center.x + dist1 * Math.cos(rad) - halfW * Math.cos(perpRad);
      const p2y = geometry.center.y + dist1 * Math.sin(rad) - halfW * Math.sin(perpRad);

      poles.push({
        id: `pole-app-${arm.id}-exit`,
        x: p2x,
        y: p2y,
        z: config.approachPoleHeight || config.mountingHeight,
        headingDeg: arm.angleDeg,
        tiltDeg: config.boomTiltDeg,
        isApproach: true,
        armId: arm.id,
      });
    });
  }

  return poles;
}

// =========================================================================
// 6. CALCULATION GRID GENERATOR
// =========================================================================

/**
 * Generates high-density annular and approach grid sampling points.
 */
export function generateRoundaboutGrid(geometry: RoundaboutGeometry): RoundaboutGridPoint[] {
  const points: RoundaboutGridPoint[] = [];

  const innerR = geometry.islandRadius + geometry.truckApronWidth;
  const outerR = geometry.outerRoadwayRadius;

  // 1. Truck Apron Sampling (2 radial rings, 24 angular divisions)
  if (geometry.truckApronWidth > 0.5) {
    const apronR = geometry.islandRadius + geometry.truckApronWidth * 0.5;
    for (let k = 0; k < 24; k++) {
      const theta = (k * 2 * Math.PI) / 24;
      points.push({
        x: geometry.center.x + apronR * Math.cos(theta),
        y: geometry.center.y + apronR * Math.sin(theta),
        lux: 0,
        zone: "apron",
      });
    }
  }

  // 2. Circulatory Roadway Annular Grid
  // Divide radial space into rings: 3 rings per lane
  const radialRings = Math.max(4, geometry.circulatoryLanes * 3);
  // Divide angular space into sectors: 36 sectors (every 10°)
  const angularSectors = 48;

  for (let rIdx = 0; rIdx < radialRings; rIdx++) {
    const frac = (rIdx + 0.5) / radialRings;
    const r = innerR + frac * (outerR - innerR);
    const laneIdx = Math.floor(frac * geometry.circulatoryLanes);

    for (let aIdx = 0; aIdx < angularSectors; aIdx++) {
      const theta = (aIdx * 2 * Math.PI) / angularSectors;
      points.push({
        x: geometry.center.x + r * Math.cos(theta),
        y: geometry.center.y + r * Math.sin(theta),
        lux: 0,
        zone: "circulatory",
        laneIndex: laneIdx,
      });
    }
  }

  // 3. Approach Arm Points
  geometry.arms.forEach((arm) => {
    const armRad = (arm.angleDeg * Math.PI) / 180;
    const perpRad = armRad + Math.PI / 2;
    const totalArmWidth = (arm.entryLanes + arm.exitLanes) * arm.laneWidth;

    // Longitudinal points from outer curb to arm length (every 5m)
    for (let dist = 3; dist <= Math.min(arm.length, 30); dist += 5) {
      const rDist = outerR + dist;

      // Transverse points across lanes
      const lanePoints = (arm.entryLanes + arm.exitLanes) * 2;
      for (let lp = 0; lp < lanePoints; lp++) {
        const offset = ((lp + 0.5) / lanePoints - 0.5) * totalArmWidth;
        const px = geometry.center.x + rDist * Math.cos(armRad) + offset * Math.cos(perpRad);
        const py = geometry.center.y + rDist * Math.sin(armRad) + offset * Math.sin(perpRad);

        points.push({
          x: px,
          y: py,
          lux: 0,
          zone: "approach",
          armId: arm.id,
        });
      }
    }

    // 4. Pedestrian Crosswalk Points (if crosswalk present)
    if (arm.hasCrosswalk) {
      const cwDist = outerR + arm.crosswalkDistance;
      for (let cp = 0; cp < 8; cp++) {
        const offset = ((cp + 0.5) / 8 - 0.5) * totalArmWidth;
        const px = geometry.center.x + cwDist * Math.cos(armRad) + offset * Math.cos(perpRad);
        const py = geometry.center.y + cwDist * Math.sin(armRad) + offset * Math.sin(perpRad);

        points.push({
          x: px,
          y: py,
          lux: 0,
          zone: "crosswalk",
          armId: arm.id,
        });
      }
    }
  });

  return points;
}

// =========================================================================
// 7. PHOTOMETRIC SIMULATION ENGINE
// =========================================================================

/**
 * Evaluates luminous intensity I(gamma, psi) in candela for a given luminaire candela table.
 */
function getCandelaIntensity(
  luminaire: RoundaboutLuminaireProfile,
  gammaDeg: number,
  psiDeg: number
): number {
  const clampGamma = Math.max(0, Math.min(90, gammaDeg));
  const angles = luminaire.cAngles;

  // Find vertical angle segment
  let idx = 0;
  for (let i = 0; i < angles.length - 1; i++) {
    if (clampGamma >= angles[i] && clampGamma <= angles[i + 1]) {
      idx = i;
      break;
    }
  }

  const g0 = angles[idx];
  const g1 = angles[idx + 1] || 90;
  const t = g1 > g0 ? (clampGamma - g0) / (g1 - g0) : 0;

  // Interpolate forward and transverse candelas
  const c0_0 = luminaire.c0Candela[idx] || 0;
  const c0_1 = luminaire.c0Candela[idx + 1] || 0;
  const iC0 = c0_0 + t * (c0_1 - c0_0);

  const c90_0 = luminaire.c90Candela[idx] || 0;
  const c90_1 = luminaire.c90Candela[idx + 1] || 0;
  const iC90 = c90_0 + t * (c90_1 - c90_0);

  // Azimuthal weighting between forward throw (C0) and side throw (C90)
  const psiRad = (psiDeg * Math.PI) / 180;
  const cosPsiSq = Math.pow(Math.cos(psiRad), 2);
  const sinPsiSq = Math.pow(Math.sin(psiRad), 2);

  const cdPer1000 = iC0 * cosPsiSq + iC90 * sinPsiSq;
  // Scale by luminaire total lumens / 1000
  return cdPer1000 * (luminaire.totalLumens / 1000);
}

/**
 * Runs the full EN 13201 point-by-point photometric simulation for the roundabout.
 */
export function runRoundaboutSimulation(
  geometry: RoundaboutGeometry,
  luminaire: RoundaboutLuminaireProfile,
  poleConfig: RoundaboutPoleConfig,
  targetStandard: EN13201CClassCriteria
): RoundaboutCalculationResult {
  const poles = calculateRoundaboutPoles(geometry, poleConfig);
  const gridPoints = generateRoundaboutGrid(geometry);

  const mf = poleConfig.maintenanceFactor * luminaire.maintenanceFactor;

  // Point-by-point illuminance summation
  gridPoints.forEach((pt) => {
    let totalLux = 0;

    poles.forEach((pole) => {
      const dx = pt.x - pole.x;
      const dy = pt.y - pole.y;
      const dz = pole.z; // ground level is z = 0

      const dHoriz = Math.hypot(dx, dy);
      const d3D = Math.sqrt(dHoriz * dHoriz + dz * dz);

      if (d3D < 0.1) return;

      // Elevation angle from luminaire nadir (0° = straight down)
      const gammaRad = Math.atan2(dHoriz, dz);
      const gammaDeg = (gammaRad * 180) / Math.PI;

      if (gammaDeg > 88) return; // cut-off above 88°

      // Azimuth angle of point relative to pole heading
      const pointAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const relAngleDeg = Math.abs((pointAngleDeg - pole.headingDeg + 540) % 360 - 180);

      // Candela intensity
      const intensity = getCandelaIntensity(luminaire, gammaDeg, relAngleDeg);

      // Inverse-square law: E = (I * cos(gamma)) / d^2 * MF
      const cosGamma = Math.cos(gammaRad);
      const luxContribution = (intensity * cosGamma * mf) / (d3D * d3D);

      totalLux += Math.max(0, luxContribution);
    });

    pt.lux = Math.round(totalLux * 10) / 10;
  });

  // Extract circulatory roadway points for normative evaluation
  const circulatoryPoints = gridPoints.filter((p) => p.zone === "circulatory");
  const luxValues = circulatoryPoints.map((p) => p.lux);

  const E_avg = luxValues.length > 0 ? luxValues.reduce((a, b) => a + b, 0) / luxValues.length : 0;
  const E_min = luxValues.length > 0 ? Math.min(...luxValues) : 0;
  const E_max = luxValues.length > 0 ? Math.max(...luxValues) : 0;
  const U_o = E_avg > 0 ? E_min / E_avg : 0;
  const U_d = E_max > 0 ? E_min / E_max : 0;

  // Sub-zones
  const apronPoints = gridPoints.filter((p) => p.zone === "apron");
  const apronEAvg =
    apronPoints.length > 0
      ? apronPoints.reduce((acc, p) => acc + p.lux, 0) / apronPoints.length
      : 0;

  const approachEAvg: Record<string, number> = {};
  const crosswalkEAvg: Record<string, number> = {};

  geometry.arms.forEach((arm) => {
    const armPts = gridPoints.filter((p) => p.zone === "approach" && p.armId === arm.id);
    if (armPts.length > 0) {
      approachEAvg[arm.id] =
        armPts.reduce((acc, p) => acc + p.lux, 0) / armPts.length;
    }

    const cwPts = gridPoints.filter((p) => p.zone === "crosswalk" && p.armId === arm.id);
    if (cwPts.length > 0) {
      crosswalkEAvg[arm.id] =
        cwPts.reduce((acc, p) => acc + p.lux, 0) / cwPts.length;
    }
  });

  // Compliance checks
  const isEAvgCompliant = E_avg >= targetStandard.E_avg_min;
  const isUoCompliant = U_o >= targetStandard.U_o_min;
  const crosswalkMinTarget = 50.0; // EN 13201-2 conflict crosswalk target
  const crosswalkKeys = Object.keys(crosswalkEAvg);
  const isCrosswalkCompliant =
    crosswalkKeys.length === 0 ||
    crosswalkKeys.every((k) => crosswalkEAvg[k] >= crosswalkMinTarget);

  const isOverallCompliant = isEAvgCompliant && isUoCompliant;

  // Energy assessment (EN 13201-5)
  const totalPoles = poles.length;
  const totalPowerW = totalPoles * luminaire.wattage;

  // Lighted area: annulus area + arms area
  const innerR = geometry.islandRadius + geometry.truckApronWidth;
  const outerR = geometry.outerRoadwayRadius;
  const annulusArea = Math.PI * (outerR * outerR - innerR * innerR);
  const armsArea = geometry.arms.reduce((acc, arm) => {
    const w = (arm.entryLanes + arm.exitLanes) * arm.laneWidth;
    return acc + w * Math.min(arm.length, 30);
  }, 0);
  const lightedAreaM2 = Math.round(annulusArea + armsArea);

  // Power Density Indicator: PDI = P / (sum(E_i * A_i))
  const weightedLuxArea = E_avg * lightedAreaM2;
  const PDI = weightedLuxArea > 0 ? totalPowerW / weightedLuxArea : 0;

  // Annual Energy Consumption Indicator (4,000 standard operating hours/year)
  const AECI = lightedAreaM2 > 0 ? (totalPowerW * 4000) / (lightedAreaM2 * 1000) : 0;

  // Pole spacing
  const perimeterPoles = poles.filter((p) => !p.isCentral && !p.isApproach);
  const perimeterPoleSpacingM =
    perimeterPoles.length > 0
      ? (2 * Math.PI * (geometry.outerRoadwayRadius + poleConfig.setback)) / perimeterPoles.length
      : 0;
  const spacingToHeightRatio =
    poleConfig.mountingHeight > 0
      ? perimeterPoleSpacingM / poleConfig.mountingHeight
      : 0;

  return {
    geometry,
    luminaire,
    poleConfig,
    targetStandard,
    E_avg: Math.round(E_avg * 10) / 10,
    E_min: Math.round(E_min * 10) / 10,
    E_max: Math.round(E_max * 10) / 10,
    U_o: Math.round(U_o * 100) / 100,
    U_d: Math.round(U_d * 100) / 100,
    apronEAvg: Math.round(apronEAvg * 10) / 10,
    approachEAvg,
    crosswalkEAvg,
    isEAvgCompliant,
    isUoCompliant,
    isCrosswalkCompliant,
    isOverallCompliant,
    totalPoles,
    totalPowerW,
    lightedAreaM2,
    PDI: Math.round(PDI * 1000) / 1000,
    AECI: Math.round(AECI * 100) / 100,
    perimeterPoleSpacingM: Math.round(perimeterPoleSpacingM * 10) / 10,
    spacingToHeightRatio: Math.round(spacingToHeightRatio * 100) / 100,
    gridPoints,
    polePositions: poles,
  };
}

// =========================================================================
// 8. AUTOMATIC ROUNDABOUT SPACING & POLE COUNT OPTIMIZER
// =========================================================================

/**
 * Iterates through pole counts and mounting heights to find the ideal layout
 * maximizing spacing (minimizing pole count) while ensuring 100% EN 13201 compliance.
 */
export function optimizeRoundaboutLighting(
  geometry: RoundaboutGeometry,
  luminaire: RoundaboutLuminaireProfile,
  targetStandard: EN13201CClassCriteria
): RoundaboutOptimizationResult {
  const variants: RoundaboutOptimizationVariant[] = [];

  const candidatePoleCounts = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
  const candidateHeights = [8.0, 9.0, 10.0, 11.0, 12.0, 14.0];
  const candidateTilts = [0.0, 5.0, 10.0];

  candidatePoleCounts.forEach((poleCount) => {
    candidateHeights.forEach((height) => {
      candidateTilts.forEach((tilt) => {
        const testConfig: RoundaboutPoleConfig = {
          arrangementType: "outer_perimeter",
          poleCount,
          setback: 1.2,
          mountingHeight: height,
          boomLength: 1.2,
          boomTiltDeg: tilt,
          aimingMode: "tangential",
          maintenanceFactor: 0.85,
        };

        const res = runRoundaboutSimulation(geometry, luminaire, testConfig, targetStandard);

        variants.push({
          poleCount,
          height,
          tilt,
          arrangement: "outer_perimeter",
          E_avg: res.E_avg,
          E_min: res.E_min,
          U_o: res.U_o,
          spacingM: res.perimeterPoleSpacingM,
          sToHRatio: res.spacingToHeightRatio,
          totalPowerW: res.totalPowerW,
          isCompliant: res.isOverallCompliant,
        });
      });
    });
  });

  // Filter compliant variants
  const compliant = variants.filter((v) => v.isCompliant);

  // Best variant: minimum total power, then minimum pole count
  let bestVariant: RoundaboutOptimizationVariant;
  if (compliant.length > 0) {
    compliant.sort((a, b) => {
      if (a.totalPowerW !== b.totalPowerW) return a.totalPowerW - b.totalPowerW;
      if (a.poleCount !== b.poleCount) return a.poleCount - b.poleCount;
      return b.U_o - a.U_o;
    });
    bestVariant = compliant[0];
  } else {
    // Fallback to highest uniformity
    variants.sort((a, b) => b.U_o - a.U_o);
    bestVariant = variants[0];
  }

  // Sort ranked variants for display
  variants.sort((a, b) => {
    if (a.isCompliant !== b.isCompliant) return a.isCompliant ? -1 : 1;
    return a.totalPowerW - b.totalPowerW;
  });

  return {
    bestVariant,
    allVariants: variants.slice(0, 20),
    evaluatedCount: variants.length,
  };
}

// =========================================================================
// 9. FALSE COLOR COLORMAP HELPER (FOR HEATMAP VISUALIZATION)
// =========================================================================

export function getRoundaboutFalseColor(lux: number, maxLux: number = 60): string {
  const norm = Math.max(0, Math.min(1, lux / maxLux));

  // High contrast thermal palette:
  // Black -> Deep Blue -> Cyan -> Green -> Yellow -> Orange -> Red -> White
  if (norm < 0.15) {
    const t = norm / 0.15;
    return `rgb(0, ${Math.round(40 * t)}, ${Math.round(180 * t)})`;
  } else if (norm < 0.35) {
    const t = (norm - 0.15) / 0.2;
    return `rgb(0, ${Math.round(40 + 180 * t)}, ${Math.round(180 - 60 * t)})`;
  } else if (norm < 0.6) {
    const t = (norm - 0.35) / 0.25;
    return `rgb(${Math.round(240 * t)}, 220, 0)`;
  } else if (norm < 0.85) {
    const t = (norm - 0.6) / 0.25;
    return `rgb(255, ${Math.round(220 - 150 * t)}, 0)`;
  } else {
    const t = (norm - 0.85) / 0.15;
    return `rgb(255, ${Math.round(70 + 185 * t)}, ${Math.round(255 * t)})`;
  }
}
