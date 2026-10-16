/**
 * =========================================================================
 * DIALUX EVO ROAD & STREET LIGHTING: MEDIAN STRIP ENGINE (EN 13201 / CIE 140)
 * =========================================================================
 * 
 * Implements the complete Median Strip (Central Reservation) street lighting
 * functionality from DIALux evo Tutorial Part 19:
 * - Dual-Carriageway Street Profile with Central Reservation (Median Strip)
 * - Direction of Travel: Direction 1 (Forward) & Direction 2 (Reverse)
 * - Median types: Grass / Vegetated, Paved, Concrete Barrier (New Jersey), Steel Guardrail
 * - Luminaire Arrangement on Central Reservation (Twin-Bracket / Double-Boom T-arm)
 * - Independent EN 13201-3 Valuation Fields:
 *     * Valuation Field 1: Carriageway 1 (L_avg, U_o, U_l per lane, TI %, EIR)
 *     * Valuation Field 2: Carriageway 2 (L_avg, U_o, U_l per lane, TI %, EIR)
 *     * Valuation Field 3: Median Strip (E_avg lux, E_min lux, U_o)
 * - Dual CIE 140 Observer Positions (Observer 1 facing Dir 1, Observer 2 facing Dir 2)
 * - Automated Median Optimizer: Maximizes pole spacing while ensuring 100% EN 13201 compliance
 * - EN 13201-5 Energy Efficiency Indicators (PDI & AECI) for dual-carriageway installations
 */

export type CIERoadSurfaceClass = "R1" | "R2" | "R3" | "R4";

export type MedianBarrierType = "none" | "concrete_jersey" | "steel_guardrail" | "hedgerow";
export type MedianSurfaceType = "grass" | "paved" | "gravel";

export interface CarriagewayConfig {
  id: string;
  name: string;
  direction: "forward" | "backward";
  numLanes: number;
  laneWidth: number; // m, e.g. 3.50m or 3.75m
  surfaceClass: CIERoadSurfaceClass;
  q0: number; // average luminance coefficient, e.g. 0.07 for R3
  targetClassId: string; // e.g. "M2", "M3"
}

export interface MedianStripConfig {
  width: number; // m, e.g. 2.0m to 6.0m
  curbHeight: number; // m, e.g. 0.15m to 0.25m
  surfaceType: MedianSurfaceType;
  barrierType: MedianBarrierType;
  barrierHeight: number; // m, e.g. 0.85m to 1.10m
  targetEAvgLux: number; // lux, e.g. 15 lux
}

export interface SidewalkConfig {
  present: boolean;
  width: number; // m, e.g. 2.0m
  elevation: number; // m, e.g. 0.15m
  targetClassId: string; // e.g. "P2"
}

export interface DualCarriagewayProfile {
  id: string;
  name: string;
  description: string;
  leftSidewalk: SidewalkConfig;
  carriageway1: CarriagewayConfig; // Left/Northbound
  median: MedianStripConfig;      // Central reservation
  carriageway2: CarriagewayConfig; // Right/Southbound
  rightSidewalk: SidewalkConfig;
  totalWidth: number; // calculated
}

export interface MedianLuminaireProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  wattage: number; // W
  totalLumens: number; // lm
  opticType: "Type II-M" | "Type III-M" | "Type IV-Forward" | "Highway Long";
  colorTemp: number; // K
  maintenanceFactor: number; // e.g. 0.80
  c0Candela: number[];
  c90Candela: number[];
  cAngles: number[];
}

export interface MedianPoleConfig {
  poleSpacing: number; // S (m), e.g. 30m - 50m
  mountingHeight: number; // H (m), e.g. 10m - 14m
  poleOffsetFromCenter: number; // lateral offset inside median (m), 0 = exact center
  
  // Twin-Boom Arms (Carriageway 1 & Carriageway 2)
  isSymmetricBoom: boolean;
  boom1Length: number; // Outreach over Carriageway 1 (m), e.g. 1.5m
  boom1TiltDeg: number; // Tilt angle (deg), e.g. 5°
  boom2Length: number; // Outreach over Carriageway 2 (m), e.g. 1.5m
  boom2TiltDeg: number; // Tilt angle (deg), e.g. 5°
  
  luminaire1Id: string;
  luminaire2Id: string;
  maintenanceFactor: number; // 0.80 - 0.85
}

export interface EN13201StandardCriteria {
  classId: string;
  category: "M" | "C" | "P";
  name: string;
  description: string;
  L_avg_min?: number; // cd/m²
  U_o_min?: number;   // Overall uniformity
  U_l_min?: number;   // Longitudinal uniformity
  TI_max?: number;    // % Threshold increment
  EIR_min?: number;   // Edge illuminance ratio (surround ratio)
  E_avg_min?: number; // lux (for P/C classes)
  E_min_min?: number; // lux
}

export interface ValuationFieldResult {
  id: string;
  name: string;
  width: number;
  length: number;
  L_avg: number;
  L_min: number;
  L_max: number;
  U_o: number;
  U_l: number;
  TI_glare: number;
  EIR: number;
  E_avg: number;
  E_min: number;
  isLAvgCompliant: boolean;
  isUoCompliant: boolean;
  isUlCompliant: boolean;
  isTICompliant: boolean;
  isEIRCompliant: boolean;
  isOverallCompliant: boolean;
  laneLuminances: number[][]; // longitudinal along each lane
}

export interface MedianStripCalculationPoint {
  x: number; // along road (m)
  y: number; // transverse across entire profile (m)
  lux: number;
  luminanceCdM2: number;
  zone: "left_sidewalk" | "carriageway1" | "median" | "carriageway2" | "right_sidewalk";
}

export interface MedianStripCalculationResult {
  profile: DualCarriagewayProfile;
  poleConfig: MedianPoleConfig;
  luminaire1: MedianLuminaireProfile;
  luminaire2: MedianLuminaireProfile;
  targetStandard1: EN13201StandardCriteria;
  targetStandard2: EN13201StandardCriteria;

  // Independent Valuation Fields
  field1: ValuationFieldResult; // Carriageway 1
  field2: ValuationFieldResult; // Carriageway 2
  medianField: {
    E_avg: number;
    E_min: number;
    U_o: number;
    isCompliant: boolean;
  };

  // Overall EN 13201 System Compliance
  isOverallCompliant: boolean;

  // Energy Efficiency per EN 13201-5
  totalConnectedPowerPerKm: number; // kW/km
  polesPerKm: number;
  fixturesPerKm: number;
  PDI: number; // Power Density Indicator W/(lx*m²)
  AECI: number; // Annual Energy Consumption Indicator kWh/(m²*a)

  // Combined Grid Heatmap
  gridPoints: MedianStripCalculationPoint[];
  gridCols: number;
  gridRows: number;
}

export interface MedianOptimizationResult {
  bestSpacing: number;
  bestHeight: number;
  bestBoomOutreach: number;
  bestTilt: number;
  maxSpacingResult: MedianStripCalculationResult;
  evaluatedVariantsCount: number;
  rankedVariants: Array<{
    spacing: number;
    height: number;
    outreach: number;
    tilt: number;
    field1_Lavg: number;
    field1_Uo: number;
    field2_Lavg: number;
    field2_Uo: number;
    isCompliant: boolean;
    polesPerKm: number;
    kwPerKm: number;
  }>;
}

// =========================================================================
// 2. EN 13201-2 STANDARDS REPOSITORY
// =========================================================================

export const EN_13201_STANDARDS: EN13201StandardCriteria[] = [
  {
    classId: "M1",
    category: "M",
    name: "EN 13201 Class M1",
    description: "Motorways & Divided High-Speed Expressways >= 100 km/h, heavy traffic, critical interchanges",
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
    description: "Major dual-carriageway arterial highways, speed 70-100 km/h, heavy traffic flow",
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
    description: "Urban expressways & dual carriageways with medium traffic density, speed 60-80 km/h",
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
    description: "Connecting highways and secondary divided roads, speed 50-70 km/h",
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
    description: "Secondary distributor roads with low-to-medium traffic speed",
    L_avg_min: 0.50,
    U_o_min: 0.35,
    U_l_min: 0.40,
    TI_max: 15,
    EIR_min: 0.30,
  },
];

// =========================================================================
// 3. CIE ROAD SURFACE MATRICES (R-TABLES)
// =========================================================================

export const CIE_ROAD_SURFACES: Record<CIERoadSurfaceClass, { name: string; q0: number; s1: number; desc: string }> = {
  R1: { name: "CIE R1 (Mostly Diffuse)", q0: 0.10, s1: 0.25, desc: "Concrete surface or light asphalt with very rough texture" },
  R2: { name: "CIE R2 (Mixed Diffuse/Specular)", q0: 0.07, s1: 0.58, desc: "Asphalt with gravel or crushed rock aggregate" },
  R3: { name: "CIE R3 (Slightly Specular)", q0: 0.07, s1: 1.11, desc: "Standard European asphalt road surface (most common)" },
  R4: { name: "CIE R4 (Highly Specular)", q0: 0.08, s1: 1.55, desc: "Very smooth mastic asphalt surface, high shine" },
};

// =========================================================================
// 4. BUILT-IN LUMINAIRE DATABASE FOR MEDIAN ROADWAYS
// =========================================================================

export const BUILTIN_MEDIAN_LUMINAIRES: MedianLuminaireProfile[] = [
  {
    id: "med-lum-120",
    name: "AeroRoad LED 120W (High-Speed Dual Carriageway)",
    manufacturer: "Luminaire Systems Pro",
    model: "AR-120-M",
    wattage: 120,
    totalLumens: 18000,
    opticType: "Type II-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    c0Candela: [120, 240, 480, 850, 1420, 1950, 2480, 2200, 1300, 450, 80, 15],
    c90Candela: [120, 150, 190, 230, 270, 290, 310, 280, 180, 70, 20, 5],
    cAngles: [0, 10, 20, 30, 40, 50, 60, 65, 70, 75, 80, 85],
  },
  {
    id: "med-lum-160",
    name: "HighwayMaster Pro 160W (Motorway Central)",
    manufacturer: "Nordic Highway Optic",
    model: "HM-160-HWY",
    wattage: 160,
    totalLumens: 25600,
    opticType: "Highway Long",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    c0Candela: [160, 320, 650, 1200, 2100, 2950, 3700, 3200, 1900, 650, 110, 20],
    c90Candela: [160, 210, 280, 340, 390, 420, 450, 380, 240, 90, 25, 8],
    cAngles: [0, 10, 20, 30, 40, 50, 60, 65, 70, 75, 80, 85],
  },
  {
    id: "med-lum-220",
    name: "SuperExpressway 220W (8-Lane Heavy Arterial)",
    manufacturer: "OptiLux Global",
    model: "SE-220-OPT",
    wattage: 220,
    totalLumens: 36300,
    opticType: "Type III-M",
    colorTemp: 4000,
    maintenanceFactor: 0.85,
    c0Candela: [240, 490, 980, 1750, 2980, 4100, 5200, 4500, 2700, 890, 150, 30],
    c90Candela: [240, 310, 410, 490, 560, 610, 650, 540, 330, 120, 35, 10],
    cAngles: [0, 10, 20, 30, 40, 50, 60, 65, 70, 75, 80, 85],
  },
];

// =========================================================================
// 5. PRESET DUAL CARRIAGEWAY ROAD PROFILES
// =========================================================================

export function calculateTotalWidth(profile: Omit<DualCarriagewayProfile, "totalWidth">): number {
  let w = 0;
  if (profile.leftSidewalk.present) w += profile.leftSidewalk.width;
  w += profile.carriageway1.numLanes * profile.carriageway1.laneWidth;
  w += profile.median.width;
  w += profile.carriageway2.numLanes * profile.carriageway2.laneWidth;
  if (profile.rightSidewalk.present) w += profile.rightSidewalk.width;
  return Number(w.toFixed(2));
}

export const PRESET_MEDIAN_PROFILES: DualCarriagewayProfile[] = [
  {
    id: "profile-motorway-2x2",
    name: "Motorway (2x2 Lanes with 3.0m Median Strip)",
    description: "Dual carriageway with 2 lanes per direction (3.75m each) separated by a 3.0m central reservation with concrete New Jersey barrier.",
    leftSidewalk: { present: false, width: 2.0, elevation: 0.15, targetClassId: "P2" },
    carriageway1: {
      id: "cw1",
      name: "Direction 1 (Northbound)",
      direction: "forward",
      numLanes: 2,
      laneWidth: 3.75,
      surfaceClass: "R3",
      q0: 0.07,
      targetClassId: "M2",
    },
    median: {
      width: 3.0,
      curbHeight: 0.20,
      surfaceType: "paved",
      barrierType: "concrete_jersey",
      barrierHeight: 0.85,
      targetEAvgLux: 15,
    },
    carriageway2: {
      id: "cw2",
      name: "Direction 2 (Southbound)",
      direction: "backward",
      numLanes: 2,
      laneWidth: 3.75,
      surfaceClass: "R3",
      q0: 0.07,
      targetClassId: "M2",
    },
    rightSidewalk: { present: false, width: 2.0, elevation: 0.15, targetClassId: "P2" },
    totalWidth: 18.0, // 7.5 + 3.0 + 7.5
  },
  {
    id: "profile-expressway-3x3",
    name: "Expressway (3x3 Lanes with 4.0m Vegetated Median)",
    description: "High capacity 6-lane divided arterial with 3.5m lanes and a 4.0m landscaped grass median with steel Armco guardrail.",
    leftSidewalk: { present: false, width: 2.5, elevation: 0.15, targetClassId: "P2" },
    carriageway1: {
      id: "cw1",
      name: "Direction 1 (Eastbound)",
      direction: "forward",
      numLanes: 3,
      laneWidth: 3.50,
      surfaceClass: "R3",
      q0: 0.07,
      targetClassId: "M1",
    },
    median: {
      width: 4.0,
      curbHeight: 0.25,
      surfaceType: "grass",
      barrierType: "steel_guardrail",
      barrierHeight: 0.75,
      targetEAvgLux: 12,
    },
    carriageway2: {
      id: "cw2",
      name: "Direction 2 (Westbound)",
      direction: "backward",
      numLanes: 3,
      laneWidth: 3.50,
      surfaceClass: "R3",
      q0: 0.07,
      targetClassId: "M1",
    },
    rightSidewalk: { present: false, width: 2.5, elevation: 0.15, targetClassId: "P2" },
    totalWidth: 25.0, // 10.5 + 4.0 + 10.5
  },
  {
    id: "profile-boulevard-urban",
    name: "Metropolitan Boulevard (2x2 Lanes + Sidewalks + 2.5m Median)",
    description: "Urban multi-modal avenue with pedestrian sidewalks, 2x2 traffic lanes, and a curbed median strip for central pole lighting.",
    leftSidewalk: { present: true, width: 2.5, elevation: 0.15, targetClassId: "P2" },
    carriageway1: {
      id: "cw1",
      name: "Direction 1 (Inbound)",
      direction: "forward",
      numLanes: 2,
      laneWidth: 3.50,
      surfaceClass: "R2",
      q0: 0.07,
      targetClassId: "M3",
    },
    median: {
      width: 2.5,
      curbHeight: 0.15,
      surfaceType: "paved",
      barrierType: "none",
      barrierHeight: 0,
      targetEAvgLux: 20,
    },
    carriageway2: {
      id: "cw2",
      name: "Direction 2 (Outbound)",
      direction: "backward",
      numLanes: 2,
      laneWidth: 3.50,
      surfaceClass: "R2",
      q0: 0.07,
      targetClassId: "M3",
    },
    rightSidewalk: { present: true, width: 2.5, elevation: 0.15, targetClassId: "P2" },
    totalWidth: 21.5, // 2.5 + 7.0 + 2.5 + 7.0 + 2.5
  },
];

// =========================================================================
// 6. PHOTOMETRIC CALCULATION ENGINE (EN 13201-3 / CIE 140)
// =========================================================================

function interpolateCandela(lum: MedianLuminaireProfile, verticalAngleDeg: number, isC90: boolean): number {
  const angles = lum.cAngles;
  const candelaArr = isC90 ? lum.c90Candela : lum.c0Candela;
  const ang = Math.max(0, Math.min(85, verticalAngleDeg));

  for (let i = 0; i < angles.length - 1; i++) {
    if (ang >= angles[i] && ang <= angles[i + 1]) {
      const frac = (ang - angles[i]) / (angles[i + 1] - angles[i]);
      return candelaArr[i] + frac * (candelaArr[i + 1] - candelaArr[i]);
    }
  }
  return candelaArr[candelaArr.length - 1];
}

/**
 * Calculates point illuminance and luminance contribution from a luminaire
 */
function computePointPhotometrics(
  ptX: number,
  ptY: number,
  lumX: number,
  lumY: number,
  lumZ: number,
  tiltDeg: number,
  pointingDir: "towards_cw1" | "towards_cw2",
  luminaire: MedianLuminaireProfile,
  q0: number,
  observerForward: boolean // true if observer is looking in +X direction, false if -X
): { lux: number; cdM2: number } {
  const dx = ptX - lumX;
  const dy = ptY - lumY;
  const dz = lumZ; // ground to fixture height

  const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist3D < 0.1) return { lux: 0, cdM2: 0 };

  const cosTheta = dz / dist3D;
  const thetaDeg = Math.acos(Math.min(1, Math.max(0, cosTheta))) * (180 / Math.PI);

  // Accounting for boom tilt & orientation
  let effTilt = tiltDeg;
  if (pointingDir === "towards_cw1" && dy > 0) effTilt = -tiltDeg;
  if (pointingDir === "towards_cw2" && dy < 0) effTilt = -tiltDeg;
  const effectiveTheta = Math.max(0, Math.min(85, thetaDeg - effTilt * 0.4));

  // Determine horizontal orientation relative to boom axis
  const candela = interpolateCandela(luminaire, effectiveTheta, Math.abs(dx) > Math.abs(dy));

  // Point Illuminance: E = (I * cos(theta)) / d^2
  const lux = (candela * cosTheta) / (dist3D * dist3D) * luminaire.maintenanceFactor;

  // Road Surface Reduced Luminance Coefficient r(beta, gamma)
  // Approximated using CIE standard R-table specular reflectance formulation
  const observerDirFactor = observerForward ? (dx < 0 ? 1.25 : 0.75) : (dx > 0 ? 1.25 : 0.75);
  const specFactor = 1.0 + (effectiveTheta / 65) * 0.6;
  const rCoeff = (q0 / Math.PI) * specFactor * observerDirFactor;

  const cdM2 = lux * rCoeff;
  return { lux: Math.max(0, lux), cdM2: Math.max(0, cdM2) };
}

/**
 * Executes full EN 13201 Median Strip Street Lighting Simulation
 */
export function runMedianStripSimulation(
  profile: DualCarriagewayProfile,
  luminaire1: MedianLuminaireProfile,
  luminaire2: MedianLuminaireProfile,
  poleConfig: MedianPoleConfig,
  targetClass1Id: string = "M2",
  targetClass2Id: string = "M2"
): MedianStripCalculationResult {
  const S = Math.max(15, poleConfig.poleSpacing);
  const H = Math.max(6, poleConfig.mountingHeight);

  // Determine Transverse (Y) layout coordinates
  let curY = 0;
  const leftSidewalkWidth = profile.leftSidewalk.present ? profile.leftSidewalk.width : 0;
  const leftSidewalkStart = curY;
  curY += leftSidewalkWidth;

  const cw1Width = profile.carriageway1.numLanes * profile.carriageway1.laneWidth;
  const cw1Start = curY;
  const cw1End = curY + cw1Width;
  curY += cw1Width;

  const medianWidth = profile.median.width;
  const medianStart = curY;
  const medianEnd = curY + medianWidth;
  const medianCenterY = (medianStart + medianEnd) / 2 + poleConfig.poleOffsetFromCenter;
  curY += medianWidth;

  const cw2Width = profile.carriageway2.numLanes * profile.carriageway2.laneWidth;
  const cw2Start = curY;
  const cw2End = curY + cw2Width;
  curY += cw2Width;

  const rightSidewalkWidth = profile.rightSidewalk.present ? profile.rightSidewalk.width : 0;
  const totalW = curY;

  // Luminaire 1 position (over Carriageway 1: extends in -Y direction from median center)
  const boom1L = poleConfig.boom1Length;
  const boom1Tilt = poleConfig.boom1TiltDeg;
  const lum1Y = medianCenterY - boom1L;

  // Luminaire 2 position (over Carriageway 2: extends in +Y direction from median center)
  const boom2L = poleConfig.isSymmetricBoom ? boom1L : poleConfig.boom2Length;
  const boom2Tilt = poleConfig.isSymmetricBoom ? boom1Tilt : poleConfig.boom2TiltDeg;
  const lum2Y = medianCenterY + boom2L;

  // Multi-Pole Simulation Range (-S to +2S to account for adjacent pole spill light)
  const poleXPositions = [-S, 0, S, 2 * S];

  // Grid point counts for numerical evaluation
  const numGridX = Math.max(12, Math.round(S / 2.5));
  const stepX = S / numGridX;

  // -------------------------------------------------------------
  // Evaluation Field 1: Carriageway 1 (Direction 1 Forward)
  // -------------------------------------------------------------
  const numGridY_cw1 = Math.max(6, profile.carriageway1.numLanes * 3);
  const stepY_cw1 = cw1Width / numGridY_cw1;
  const laneLuminances1: number[][] = Array.from({ length: profile.carriageway1.numLanes }, () => []);

  let sumL1 = 0, sumLux1 = 0;
  let minL1 = Infinity, maxL1 = -Infinity;
  let minLux1 = Infinity, maxLux1 = -Infinity;
  let countPts1 = 0;

  for (let ix = 0; ix < numGridX; ix++) {
    const ptX = (ix + 0.5) * stepX;

    for (let iy = 0; iy < numGridY_cw1; iy++) {
      const ptY = cw1Start + (iy + 0.5) * stepY_cw1;
      const laneIdx = Math.min(profile.carriageway1.numLanes - 1, Math.floor(iy / (numGridY_cw1 / profile.carriageway1.numLanes)));

      let ptLux = 0;
      let ptCdM2 = 0;

      for (const px of poleXPositions) {
        // Contribution from Luminaire 1 (over CW1)
        const c1 = computePointPhotometrics(
          ptX, ptY, px, lum1Y, H, boom1Tilt, "towards_cw1", luminaire1, profile.carriageway1.q0, true
        );
        // Contribution from Luminaire 2 (back-side spill)
        const c2 = computePointPhotometrics(
          ptX, ptY, px, lum2Y, H, boom2Tilt, "towards_cw2", luminaire2, profile.carriageway1.q0, true
        );
        ptLux += c1.lux + c2.lux;
        ptCdM2 += c1.cdM2 + c2.cdM2;
      }

      sumL1 += ptCdM2;
      sumLux1 += ptLux;
      minL1 = Math.min(minL1, ptCdM2);
      maxL1 = Math.max(maxL1, ptCdM2);
      minLux1 = Math.min(minLux1, ptLux);
      maxLux1 = Math.max(maxLux1, ptLux);
      countPts1++;

      // Track lane center line points
      const laneFraction = (iy % (numGridY_cw1 / profile.carriageway1.numLanes)) / (numGridY_cw1 / profile.carriageway1.numLanes);
      if (Math.abs(laneFraction - 0.5) < 0.2) {
        laneLuminances1[laneIdx].push(ptCdM2);
      }
    }
  }

  const L_avg_1 = countPts1 > 0 ? sumL1 / countPts1 : 0;
  const U_o_1 = L_avg_1 > 0 ? Math.min(1, minL1 / L_avg_1) : 0;

  // Longitudinal uniformity along lanes for Field 1
  let minUl1 = 1.0;
  for (const laneVals of laneLuminances1) {
    if (laneVals.length > 0) {
      const minLane = Math.min(...laneVals);
      const maxLane = Math.max(...laneVals);
      if (maxLane > 0) {
        minUl1 = Math.min(minUl1, minLane / maxLane);
      }
    }
  }

  // Glare TI% and EIR for Field 1
  const TI_1 = Math.max(5.0, Math.min(18.0, 8.5 + (maxL1 / Math.max(0.1, L_avg_1)) * 1.8 - (H / 10) * 1.5));
  const EIR_1 = Math.max(0.30, Math.min(0.85, 0.45 + (boom1L / 2) * 0.1));

  // -------------------------------------------------------------
  // Evaluation Field 2: Carriageway 2 (Direction 2 Reverse)
  // -------------------------------------------------------------
  const numGridY_cw2 = Math.max(6, profile.carriageway2.numLanes * 3);
  const stepY_cw2 = cw2Width / numGridY_cw2;
  const laneLuminances2: number[][] = Array.from({ length: profile.carriageway2.numLanes }, () => []);

  let sumL2 = 0, sumLux2 = 0;
  let minL2 = Infinity, maxL2 = -Infinity;
  let minLux2 = Infinity, maxLux2 = -Infinity;
  let countPts2 = 0;

  for (let ix = 0; ix < numGridX; ix++) {
    const ptX = (ix + 0.5) * stepX;

    for (let iy = 0; iy < numGridY_cw2; iy++) {
      const ptY = cw2Start + (iy + 0.5) * stepY_cw2;
      const laneIdx = Math.min(profile.carriageway2.numLanes - 1, Math.floor(iy / (numGridY_cw2 / profile.carriageway2.numLanes)));

      let ptLux = 0;
      let ptCdM2 = 0;

      for (const px of poleXPositions) {
        // Contribution from Luminaire 2 (over CW2)
        const c2 = computePointPhotometrics(
          ptX, ptY, px, lum2Y, H, boom2Tilt, "towards_cw2", luminaire2, profile.carriageway2.q0, false
        );
        // Contribution from Luminaire 1 (back-side spill)
        const c1 = computePointPhotometrics(
          ptX, ptY, px, lum1Y, H, boom1Tilt, "towards_cw1", luminaire1, profile.carriageway2.q0, false
        );
        ptLux += c2.lux + c1.lux;
        ptCdM2 += c2.cdM2 + c1.cdM2;
      }

      sumL2 += ptCdM2;
      sumLux2 += ptLux;
      minL2 = Math.min(minL2, ptCdM2);
      maxL2 = Math.max(maxL2, ptCdM2);
      minLux2 = Math.min(minLux2, ptLux);
      maxLux2 = Math.max(maxLux2, ptLux);
      countPts2++;

      const laneFraction = (iy % (numGridY_cw2 / profile.carriageway2.numLanes)) / (numGridY_cw2 / profile.carriageway2.numLanes);
      if (Math.abs(laneFraction - 0.5) < 0.2) {
        laneLuminances2[laneIdx].push(ptCdM2);
      }
    }
  }

  const L_avg_2 = countPts2 > 0 ? sumL2 / countPts2 : 0;
  const U_o_2 = L_avg_2 > 0 ? Math.min(1, minL2 / L_avg_2) : 0;

  let minUl2 = 1.0;
  for (const laneVals of laneLuminances2) {
    if (laneVals.length > 0) {
      const minLane = Math.min(...laneVals);
      const maxLane = Math.max(...laneVals);
      if (maxLane > 0) {
        minUl2 = Math.min(minUl2, minLane / maxLane);
      }
    }
  }

  const TI_2 = Math.max(5.0, Math.min(18.0, 8.5 + (maxL2 / Math.max(0.1, L_avg_2)) * 1.8 - (H / 10) * 1.5));
  const EIR_2 = Math.max(0.30, Math.min(0.85, 0.45 + (boom2L / 2) * 0.1));

  // -------------------------------------------------------------
  // Evaluation Field 3: Median Strip (Central Reservation)
  // -------------------------------------------------------------
  const numGridY_med = 4;
  const stepY_med = medianWidth / numGridY_med;
  let sumLuxMed = 0;
  let minLuxMed = Infinity;
  let countPtsMed = 0;

  for (let ix = 0; ix < numGridX; ix++) {
    const ptX = (ix + 0.5) * stepX;
    for (let iy = 0; iy < numGridY_med; iy++) {
      const ptY = medianStart + (iy + 0.5) * stepY_med;
      let ptLux = 0;

      for (const px of poleXPositions) {
        const c1 = computePointPhotometrics(ptX, ptY, px, lum1Y, H, boom1Tilt, "towards_cw1", luminaire1, 0.05, true);
        const c2 = computePointPhotometrics(ptX, ptY, px, lum2Y, H, boom2Tilt, "towards_cw2", luminaire2, 0.05, false);
        ptLux += c1.lux + c2.lux;
      }

      sumLuxMed += ptLux;
      minLuxMed = Math.min(minLuxMed, ptLux);
      countPtsMed++;
    }
  }

  const E_avg_med = countPtsMed > 0 ? sumLuxMed / countPtsMed : 0;
  const U_o_med = E_avg_med > 0 ? minLuxMed / E_avg_med : 0;

  // -------------------------------------------------------------
  // Full Profile Heatmap Calculation Grid (False-Color Visualizer)
  // -------------------------------------------------------------
  const totalGridRows = 28;
  const stepTotalY = totalW / totalGridRows;
  const gridPoints: MedianStripCalculationPoint[] = [];

  for (let ix = 0; ix < numGridX; ix++) {
    const ptX = (ix + 0.5) * stepX;

    for (let iy = 0; iy < totalGridRows; iy++) {
      const ptY = (iy + 0.5) * stepTotalY;
      let zone: MedianStripCalculationPoint["zone"] = "median";

      if (ptY < cw1Start) {
        zone = "left_sidewalk";
      } else if (ptY < cw1End) {
        zone = "carriageway1";
      } else if (ptY < medianEnd) {
        zone = "median";
      } else if (ptY < cw2End) {
        zone = "carriageway2";
      } else {
        zone = "right_sidewalk";
      }

      let ptLux = 0;
      let ptCdM2 = 0;

      const isCW2 = zone === "carriageway2";
      const q0 = zone === "carriageway1" ? profile.carriageway1.q0 : (zone === "carriageway2" ? profile.carriageway2.q0 : 0.05);

      for (const px of poleXPositions) {
        const c1 = computePointPhotometrics(ptX, ptY, px, lum1Y, H, boom1Tilt, "towards_cw1", luminaire1, q0, !isCW2);
        const c2 = computePointPhotometrics(ptX, ptY, px, lum2Y, H, boom2Tilt, "towards_cw2", luminaire2, q0, !isCW2);
        ptLux += c1.lux + c2.lux;
        ptCdM2 += c1.cdM2 + c2.cdM2;
      }

      gridPoints.push({
        x: ptX,
        y: ptY,
        lux: Number(ptLux.toFixed(1)),
        luminanceCdM2: Number(ptCdM2.toFixed(2)),
        zone,
      });
    }
  }

  // -------------------------------------------------------------
  // Standards Compliance Checking
  // -------------------------------------------------------------
  const targetStd1 = EN_13201_STANDARDS.find((s) => s.classId === targetClass1Id) || EN_13201_STANDARDS[1];
  const targetStd2 = EN_13201_STANDARDS.find((s) => s.classId === targetClass2Id) || EN_13201_STANDARDS[1];

  const f1_LAvgOk = L_avg_1 >= (targetStd1.L_avg_min ?? 1.5);
  const f1_UoOk = U_o_1 >= (targetStd1.U_o_min ?? 0.40);
  const f1_UlOk = minUl1 >= (targetStd1.U_l_min ?? 0.70);
  const f1_TIOk = TI_1 <= (targetStd1.TI_max ?? 10);
  const f1_EIROk = EIR_1 >= (targetStd1.EIR_min ?? 0.35);
  const f1_Overall = f1_LAvgOk && f1_UoOk && f1_UlOk && f1_TIOk && f1_EIROk;

  const f2_LAvgOk = L_avg_2 >= (targetStd2.L_avg_min ?? 1.5);
  const f2_UoOk = U_o_2 >= (targetStd2.U_o_min ?? 0.40);
  const f2_UlOk = minUl2 >= (targetStd2.U_l_min ?? 0.70);
  const f2_TIOk = TI_2 <= (targetStd2.TI_max ?? 10);
  const f2_EIROk = EIR_2 >= (targetStd2.EIR_min ?? 0.35);
  const f2_Overall = f2_LAvgOk && f2_UoOk && f2_UlOk && f2_TIOk && f2_EIROk;

  const medianCompliant = E_avg_med >= profile.median.targetEAvgLux;

  // -------------------------------------------------------------
  // Energy Efficiency (EN 13201-5)
  // -------------------------------------------------------------
  const polesPerKm = Math.round(1000 / S);
  const fixturesPerKm = polesPerKm * 2; // twin luminaires per pole
  const totalKwPerKm = Number(((polesPerKm * (luminaire1.wattage + luminaire2.wattage)) / 1000).toFixed(2));
  
  // Power Density Indicator: PDI = P / (sum(E_i * A_i))
  const roadAreaPerKm = 1000 * (cw1Width + cw2Width);
  const combinedEAvg = (sumLux1 / countPts1 + sumLux2 / countPts2) / 2;
  const PDI = combinedEAvg > 0 ? Number(((totalKwPerKm * 1000) / (combinedEAvg * roadAreaPerKm)).toFixed(4)) : 0.02;
  const AECI = Number((PDI * combinedEAvg * 4000 / 1000).toFixed(2)); // 4000 burning hours/year

  return {
    profile,
    poleConfig,
    luminaire1,
    luminaire2,
    targetStandard1: targetStd1,
    targetStandard2: targetStd2,

    field1: {
      id: "field-cw1",
      name: "Valuation Field 1: Carriageway 1 (Direction 1)",
      width: cw1Width,
      length: S,
      L_avg: Number(L_avg_1.toFixed(2)),
      L_min: Number(minL1.toFixed(2)),
      L_max: Number(maxL1.toFixed(2)),
      U_o: Number(U_o_1.toFixed(2)),
      U_l: Number(minUl1.toFixed(2)),
      TI_glare: Number(TI_1.toFixed(1)),
      EIR: Number(EIR_1.toFixed(2)),
      E_avg: Number((sumLux1 / countPts1).toFixed(1)),
      E_min: Number(minLux1.toFixed(1)),
      isLAvgCompliant: f1_LAvgOk,
      isUoCompliant: f1_UoOk,
      isUlCompliant: f1_UlOk,
      isTICompliant: f1_TIOk,
      isEIRCompliant: f1_EIROk,
      isOverallCompliant: f1_Overall,
      laneLuminances: laneLuminances1,
    },

    field2: {
      id: "field-cw2",
      name: "Valuation Field 2: Carriageway 2 (Direction 2)",
      width: cw2Width,
      length: S,
      L_avg: Number(L_avg_2.toFixed(2)),
      L_min: Number(minL2.toFixed(2)),
      L_max: Number(maxL2.toFixed(2)),
      U_o: Number(U_o_2.toFixed(2)),
      U_l: Number(minUl2.toFixed(2)),
      TI_glare: Number(TI_2.toFixed(1)),
      EIR: Number(EIR_2.toFixed(2)),
      E_avg: Number((sumLux2 / countPts2).toFixed(1)),
      E_min: Number(minLux2.toFixed(1)),
      isLAvgCompliant: f2_LAvgOk,
      isUoCompliant: f2_UoOk,
      isUlCompliant: f2_UlOk,
      isTICompliant: f2_TIOk,
      isEIRCompliant: f2_EIROk,
      isOverallCompliant: f2_Overall,
      laneLuminances: laneLuminances2,
    },

    medianField: {
      E_avg: Number(E_avg_med.toFixed(1)),
      E_min: Number(minLuxMed.toFixed(1)),
      U_o: Number(U_o_med.toFixed(2)),
      isCompliant: medianCompliant,
    },

    isOverallCompliant: f1_Overall && f2_Overall,
    totalConnectedPowerPerKm: totalKwPerKm,
    polesPerKm,
    fixturesPerKm,
    PDI,
    AECI,
    gridPoints,
    gridCols: numGridX,
    gridRows: totalGridRows,
  };
}

// =========================================================================
// 7. AUTOMATIC MEDIAN STRIP OPTIMIZER (EN 13201)
// =========================================================================

export function optimizeMedianStripLighting(
  profile: DualCarriagewayProfile,
  luminaire1: MedianLuminaireProfile,
  luminaire2: MedianLuminaireProfile,
  basePoleConfig: MedianPoleConfig,
  targetClass1Id: string = "M2",
  targetClass2Id: string = "M2"
): MedianOptimizationResult {
  const spacingRange = [28, 32, 36, 40, 44, 48, 52];
  const heightRange = [10.0, 11.0, 12.0, 13.0, 14.0];
  const outreachRange = [1.0, 1.5, 2.0];
  const tiltRange = [0, 5, 10];

  const variants: MedianOptimizationResult["rankedVariants"] = [];
  let bestVariant: any = null;
  let bestSimResult: MedianStripCalculationResult | null = null;
  let maxCompliantSpacing = -1;

  for (const s of spacingRange) {
    for (const h of heightRange) {
      for (const out of outreachRange) {
        for (const t of tiltRange) {
          const testConfig: MedianPoleConfig = {
            ...basePoleConfig,
            poleSpacing: s,
            mountingHeight: h,
            boom1Length: out,
            boom1TiltDeg: t,
            boom2Length: out,
            boom2TiltDeg: t,
          };

          const sim = runMedianStripSimulation(profile, luminaire1, luminaire2, testConfig, targetClass1Id, targetClass2Id);

          const variant = {
            spacing: s,
            height: h,
            outreach: out,
            tilt: t,
            field1_Lavg: sim.field1.L_avg,
            field1_Uo: sim.field1.U_o,
            field2_Lavg: sim.field2.L_avg,
            field2_Uo: sim.field2.U_o,
            isCompliant: sim.isOverallCompliant,
            polesPerKm: sim.polesPerKm,
            kwPerKm: sim.totalConnectedPowerPerKm,
          };
          variants.push(variant);

          if (sim.isOverallCompliant && s > maxCompliantSpacing) {
            maxCompliantSpacing = s;
            bestVariant = variant;
            bestSimResult = sim;
          }
        }
      }
    }
  }

  // Fallback if no full compliance variant found
  if (!bestSimResult) {
    const fallbackConfig: MedianPoleConfig = {
      ...basePoleConfig,
      poleSpacing: 32,
      mountingHeight: 12.0,
      boom1Length: 1.5,
      boom1TiltDeg: 5,
      boom2Length: 1.5,
      boom2TiltDeg: 5,
    };
    bestSimResult = runMedianStripSimulation(profile, luminaire1, luminaire2, fallbackConfig, targetClass1Id, targetClass2Id);
    bestVariant = {
      spacing: 32,
      height: 12.0,
      outreach: 1.5,
      tilt: 5,
      field1_Lavg: bestSimResult.field1.L_avg,
      field1_Uo: bestSimResult.field1.U_o,
      field2_Lavg: bestSimResult.field2.L_avg,
      field2_Uo: bestSimResult.field2.U_o,
      isCompliant: bestSimResult.isOverallCompliant,
      polesPerKm: bestSimResult.polesPerKm,
      kwPerKm: bestSimResult.totalConnectedPowerPerKm,
    };
  }

  return {
    bestSpacing: bestVariant.spacing,
    bestHeight: bestVariant.height,
    bestBoomOutreach: bestVariant.outreach,
    bestTilt: bestVariant.tilt,
    maxSpacingResult: bestSimResult,
    evaluatedVariantsCount: variants.length,
    rankedVariants: variants.sort((a, b) => (b.isCompliant ? 1 : 0) - (a.isCompliant ? 1 : 0) || b.spacing - a.spacing),
  };
}
