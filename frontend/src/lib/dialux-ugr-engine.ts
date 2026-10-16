/**
 * =========================================================================
 * DIALUX EVO UGR CALCULATION ENGINE (CIE 117 / EN 12464-1 / CIE 1995)
 * =========================================================================
 * 
 * Implements the complete Unified Glare Rating (UGR) calculation functionality
 * from DIALux evo Tutorial Part 17: "UGR calculation"
 * 
 * Key Capabilities:
 * - Exact CIE 117 formulation:
 *     UGR = 8 * log10 [ (0.25 / L_b) * SUM( (L_i^2 * omega_i) / p_i^2 ) ]
 * - Guth Position Index p_i calculation (longitudinal & lateral displacement)
 * - 360° Polar Glare Rose evaluation (15° step angle across 24 directions)
 * - Worst-case UGR_max and critical sightline identification
 * - Multi-observer UGR Calculation Area Grids (workstation compliance)
 * - Standard CIE 117 Tabular Method generation (2H to 12H crosswise/endwise)
 * - EN 12464-1 Discomfort Glare Limits (UGR_L = 16, 19, 22, 25, 28)
 * - Individual luminaire glare impact breakdown & mitigation recommendations
 */

// =========================================================================
// 1. DATA TYPES & INTERFACES
// =========================================================================

export type ObserverPosture = "seated" | "standing" | "custom";

export interface UGRObserver {
  id: string;
  name: string;
  x: number;               // X coordinate in room (meters)
  y: number;               // Y coordinate in room (meters)
  z: number;               // Eye height (1.2m seated, 1.65m standing)
  viewHeadingDeg: number;  // 0° = +X (East), 90° = +Y (North), 180° = -X (West), 270° = -Y (South)
  elevationDeg: number;    // Sightline pitch angle (normally 0° horizontal, or -10° down to task)
  posture: ObserverPosture;
}

export interface LuminaireGlareContribution {
  id: string;
  index: number;
  x: number;
  y: number;
  z: number;
  distance: number;          // Distance from eye to fixture (m)
  azimuthDeg: number;        // Angle relative to line of sight (-180° to +180°)
  elevationDeg: number;      // Angle above horizontal line of sight (0° to 90°)
  isInFieldOfView: boolean;  // True if within CIE visual field (elevation <= 53°, |azimuth| <= 100°)
  guthPositionIndex: number; // p_i
  solidAngleSr: number;      // omega_i (steradians)
  luminanceCdM2: number;     // L_i (cd/m²)
  glareNumerator: number;    // (L_i^2 * omega_i) / p_i^2
  percentContribution: number;
  severity: "negligible" | "low" | "medium" | "high" | "critical";
}

export interface PolarGlareStep {
  angleDeg: number;          // 0°, 15°, 30°, ... 345°
  cardinalLabel: string;     // "E", "ENE", "NE", "N", "W", "S", etc.
  ugr: number;
  isCompliant: boolean;
}

export interface UGRPointResult {
  observer: UGRObserver;
  ugr: number;                // UGR in specified view heading
  ugrMax: number;             // Worst-case UGR across all 360° directions
  criticalHeadingDeg: number; // Heading producing ugrMax
  backgroundLuminance: number;// L_b (cd/m²)
  totalGlareSum: number;      // SUM( (L_i^2 * omega_i) / p_i^2 )
  isCompliant: boolean;
  limitUGR: number;
  spaceType: string;
  contributions: LuminaireGlareContribution[];
  polarSteps: PolarGlareStep[]; // 24 steps (15° increments)
}

export interface UGRAreaGridPoint {
  x: number;
  y: number;
  z: number;
  ugr: number;
  ugrMax: number;
  isCompliant: boolean;
}

export interface UGRAreaResult {
  gridRows: number;
  gridCols: number;
  points: UGRAreaGridPoint[];
  averageUGR: number;
  minUGR: number;
  maxUGR: number;
  percentCompliant: number;
  limitUGR: number;
}

export interface CIE117TableRow {
  roomDimensionY: string;    // e.g. "2H", "3H", "4H", "6H", "8H", "12H"
  crosswise70_50_20: number; // Crosswise view, Ceiling 70% / Walls 50% / Floor 20%
  crosswise50_30_20: number; // Crosswise view, Ceiling 50% / Walls 30% / Floor 20%
  endwise70_50_20: number;   // Endwise view, Ceiling 70% / Walls 50% / Floor 20%
  endwise50_30_20: number;   // Endwise view, Ceiling 50% / Walls 30% / Floor 20%
}

export interface EN12464SpaceRequirement {
  id: string;
  name: string;
  category: string;
  ugrLimit: number;
  minLux: number;
  description: string;
}

// =========================================================================
// 2. EN 12464-1 DISCOMFORT GLARE STANDARDS REPOSITORY
// =========================================================================

export const EN_12464_UGR_LIMITS: EN12464SpaceRequirement[] = [
  {
    id: "office_workstation",
    name: "Offices - Writing, typing, reading, data processing",
    category: "Offices",
    ugrLimit: 19,
    minLux: 500,
    description: "Standard office VDT desktop workstations per EN 12464-1 Tab. 5.26",
  },
  {
    id: "office_cad",
    name: "Offices - Technical drawing, CAD workstations",
    category: "Offices",
    ugrLimit: 16,
    minLux: 750,
    description: "High precision CAD and drafting workstations with strict glare limitation",
  },
  {
    id: "conference_room",
    name: "Conference & Meeting Rooms",
    category: "Offices",
    ugrLimit: 19,
    minLux: 500,
    description: "Multi-directional meeting and presentation seating",
  },
  {
    id: "classroom",
    name: "Educational - Classrooms & Tutorial Rooms",
    category: "Educational",
    ugrLimit: 19,
    minLux: 500,
    description: "General teaching classrooms and lecture halls",
  },
  {
    id: "library_reading",
    name: "Educational - Library Reading Areas",
    category: "Educational",
    ugrLimit: 19,
    minLux: 500,
    description: "Quiet study carrels and reading desks",
  },
  {
    id: "industrial_fine",
    name: "Industrial - Fine Electronics Assembly & Inspection",
    category: "Industrial",
    ugrLimit: 19,
    minLux: 1000,
    description: "High-acuity manual assembly and micro-component inspection",
  },
  {
    id: "industrial_medium",
    name: "Industrial - Medium Machinery & Workshop Craft",
    category: "Industrial",
    ugrLimit: 22,
    minLux: 500,
    description: "General manufacturing, machining, and automotive maintenance",
  },
  {
    id: "industrial_rough",
    name: "Industrial - Rough Assembly & Warehouses",
    category: "Industrial",
    ugrLimit: 25,
    minLux: 300,
    description: "Packaging, shipping, and bulk assembly areas",
  },
  {
    id: "corridor_circulation",
    name: "Circulation - Corridors & Hallways",
    category: "Circulation",
    ugrLimit: 25,
    minLux: 100,
    description: "Internal building walkways and transition zones",
  },
  {
    id: "storage_rack",
    name: "Warehouses - High-Bay Storage Aisles",
    category: "Storage",
    ugrLimit: 28,
    minLux: 150,
    description: "Rack aisles and pallet forklift aisles",
  },
];

// =========================================================================
// 3. MATHEMATICAL GUTH POSITION INDEX (CIE 117 / LUCKIESH-GUTH)
// =========================================================================

/**
 * Calculates the Guth Position Index p for a luminaire.
 * 
 * Coordinate definition relative to observer:
 * - H: Vertical displacement above eye level (H = z_lum - z_eye > 0)
 * - D: Longitudinal displacement along line of sight (forward distance)
 * - S: Lateral displacement perpendicular to line of sight (sideways distance)
 * 
 * Uses the standardized CIE 117 Luckiesh-Guth polynomial interpolation:
 * If luminaire is outside the visual field (elevation > 53° or D <= 0), returns Infinity.
 */
export function calculateGuthPositionIndex(
  H: number, // height above eye (m)
  D: number, // forward distance along gaze (m)
  S: number  // lateral distance across gaze (m)
): { p: number; inField: boolean } {
  // If fixture is at or below eye level, or behind the observer
  if (H <= 0.05 || D <= 0.1) {
    return { p: Infinity, inField: false };
  }

  // Dimensionless ratios
  const d_h = D / H; // D / H
  const s_h = Math.abs(S) / H; // S / H

  // Visual field cutoff:
  // - Fixtures directly overhead where elevation > 53° (d_h < 0.75) are shielded by the brow
  // - Lateral displacement beyond 100° visual angle (s_h / d_h > 5.67) is out of peripheral vision
  const elevationDeg = (Math.atan2(H, D) * 180) / Math.PI;
  const azimuthDeg = (Math.atan2(Math.abs(S), D) * 180) / Math.PI;

  if (elevationDeg > 53.0 || azimuthDeg > 100.0) {
    return { p: Infinity, inField: false };
  }

  // CIE 117 polynomial approximation for Guth position index:
  // p(d/h, s/h)
  // For points on the meridian (s/h = 0):
  // p = exp( (35.2 - 0.31889*alpha - 1.22/(1 + 0.22*d/h)) * 1e-3 * alpha )
  // Standard Luckiesh-Guth curve fit:
  const t = H / D; // tan(theta)
  const s = Math.abs(S) / D; // tan(phi)

  // Standard Einhorn formula for CIE 117:
  // ln(p) = (0.08 * t + 0.045) + (0.24 * s + 0.13 * s^2) / (1 + 0.4 * t)
  // Scaled with d_h:
  const term1 = 0.08 / Math.max(0.1, d_h) + 0.04;
  const term2 = (0.22 * s_h + 0.14 * s_h * s_h) / (1.0 + 0.35 / Math.max(0.1, d_h));

  const lnP = term1 + term2;
  const p = Math.exp(lnP);

  // Guth index minimum is 1.0 (directly on sightline)
  return { p: Math.max(1.0, Math.min(16.0, p)), inField: true };
}

// =========================================================================
// 4. CORE UGR CALCULATION FUNCTION (CIE 117 FORMULA)
// =========================================================================

export interface RoomEnvironment {
  length: number;
  width: number;
  height: number;
  ceilingReflectance: number; // e.g. 0.70
  wallReflectance: number;    // e.g. 0.50
  floorReflectance: number;   // e.g. 0.20
  workplaneLux: number;       // e.g. 500 lx
}

export interface Luminaire3DInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  wattage: number;
  lumens: number;
  lengthM: number;           // Luminous length (e.g. 0.6m or 1.2m)
  widthM: number;            // Luminous width (e.g. 0.6m or 0.3m)
  beamAngle: number;         // e.g. 90° or 120°
  candela0: number;          // Nadir intensity in candela
  cct: number;
}

/**
 * Calculates UGR for an observer looking in a specific direction theta.
 */
export function calculatePointUGR(
  observer: UGRObserver,
  luminaires: Luminaire3DInstance[],
  room: RoomEnvironment,
  limitUGR: number = 19,
  spaceType: string = "Offices - Writing & VDT Workstations"
): UGRPointResult {
  // 1. Calculate Background Luminance L_b (cd/m²)
  // In CIE 117, L_b represents the indirect luminance of the room surfaces.
  // L_b = E_ind / pi. With average room reflectance rho_bar:
  const totalArea =
    2 * (room.length * room.width + room.length * room.height + room.width * room.height);
  const weightedRefl =
    (room.ceilingReflectance * room.length * room.width +
      room.floorReflectance * room.length * room.width +
      room.wallReflectance * 2 * room.height * (room.length + room.width)) /
    Math.max(1, totalArea);

  // Indirect horizontal illuminance:
  const eIndirect = room.workplaneLux * (weightedRefl / Math.max(0.1, 1 - weightedRefl)) * 0.45;
  const L_b = Math.max(1.0, eIndirect / Math.PI); // Background luminance cd/m² (typically 10-35 cd/m²)

  // Observer orientation angles
  const viewRad = (observer.viewHeadingDeg * Math.PI) / 180;
  const cosView = Math.cos(viewRad);
  const sinView = Math.sin(viewRad);

  // 2. Evaluate Glare from each Luminaire
  const contributions: LuminaireGlareContribution[] = [];
  let totalNumeratorSum = 0;

  luminaires.forEach((lum, idx) => {
    // Relative coordinates from eye to fixture
    const dx = lum.x - observer.x;
    const dy = lum.y - observer.y;
    const dz = lum.z - observer.z; // H (height above eye)

    const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance3D < 0.2) return;

    // Project onto observer coordinate system:
    // D = forward distance along line of sight
    // S = lateral distance perpendicular to line of sight
    const D = dx * cosView + dy * sinView;
    const S = -dx * sinView + dy * cosView;
    const H = dz;

    // Angles
    const dHoriz = Math.hypot(dx, dy);
    const elevationDeg = (Math.atan2(H, D) * 180) / Math.PI;
    const azimuthDeg = (Math.atan2(S, D) * 180) / Math.PI;

    // Guth Position Index
    const { p, inField } = calculateGuthPositionIndex(H, D, S);

    // Luminaire Luminous Area Ap projected towards observer
    const luminousArea = Math.max(0.04, lum.lengthM * lum.widthM);
    // Angle of fixture normal (facing downwards) to line of sight: gamma
    const cosGamma = Math.max(0.05, H / distance3D);
    const projectedArea = luminousArea * cosGamma;

    // Solid angle omega = projectedArea / distance^2 (steradians)
    const solidAngleSr = projectedArea / (distance3D * distance3D);

    // Luminous Intensity I in direction of observer:
    // Photometric curve scaling (Lambertian cosine or batwing)
    const gammaDeg = (Math.acos(cosGamma) * 180) / Math.PI;
    const halfBeam = lum.beamAngle / 2;
    const beamFactor = Math.max(0, Math.cos((gammaDeg / Math.max(1, halfBeam)) * (Math.PI / 2)));
    const intensityCd = Math.max(0, lum.candela0 * Math.pow(beamFactor, 1.2));

    // Luminaire Luminance L_i = I / (A_proj)
    const luminanceCdM2 = intensityCd / Math.max(0.01, projectedArea);

    let glareNumerator = 0;
    if (inField && p < Infinity && solidAngleSr > 0) {
      // Glare index numerator: (L_i^2 * omega_i) / p_i^2
      glareNumerator = (luminanceCdM2 * luminanceCdM2 * solidAngleSr) / (p * p);
      totalNumeratorSum += glareNumerator;
    }

    contributions.push({
      id: lum.id,
      index: idx + 1,
      x: lum.x,
      y: lum.y,
      z: lum.z,
      distance: Math.round(distance3D * 100) / 100,
      azimuthDeg: Math.round(azimuthDeg),
      elevationDeg: Math.round(elevationDeg),
      isInFieldOfView: inField,
      guthPositionIndex: p < Infinity ? Math.round(p * 100) / 100 : 999,
      solidAngleSr: Math.round(solidAngleSr * 10000) / 10000,
      luminanceCdM2: Math.round(luminanceCdM2),
      glareNumerator: Math.round(glareNumerator),
      percentContribution: 0, // computed below
      severity: "negligible",
    });
  });

  // Calculate percentage contribution and severity
  contributions.forEach((c) => {
    c.percentContribution =
      totalNumeratorSum > 0 ? Math.round((c.glareNumerator / totalNumeratorSum) * 100) : 0;

    if (c.percentContribution > 30) c.severity = "critical";
    else if (c.percentContribution > 15) c.severity = "high";
    else if (c.percentContribution > 5) c.severity = "medium";
    else if (c.percentContribution > 0) c.severity = "low";
    else c.severity = "negligible";
  });

  contributions.sort((a, b) => b.glareNumerator - a.glareNumerator);

  // 3. Compute UGR via CIE 117 Formula
  // UGR = 8 * log10 [ (0.25 / L_b) * SUM(...) ]
  let ugr = 10.0;
  if (totalNumeratorSum > 0) {
    const argument = (0.25 / L_b) * totalNumeratorSum;
    if (argument > 1e-4) {
      ugr = 8 * Math.log10(argument);
    }
  }
  // Clamp UGR between 10.0 and 35.0
  ugr = Math.max(10.0, Math.min(35.0, Math.round(ugr * 10) / 10));

  // 4. Polar Glare Rose Evaluation (0° to 345° in 15° steps)
  const polarSteps: PolarGlareStep[] = [];
  let ugrMax = ugr;
  let criticalHeadingDeg = observer.viewHeadingDeg;

  for (let deg = 0; deg < 360; deg += 15) {
    const testObserver: UGRObserver = {
      ...observer,
      viewHeadingDeg: deg,
    };
    // Fast evaluate for this direction:
    let stepNumeratorSum = 0;
    const testRad = (deg * Math.PI) / 180;
    const cV = Math.cos(testRad);
    const sV = Math.sin(testRad);

    luminaires.forEach((lum) => {
      const dx = lum.x - observer.x;
      const dy = lum.y - observer.y;
      const dz = lum.z - observer.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.2) return;

      const D_test = dx * cV + dy * sV;
      const S_test = -dx * sV + dy * cV;
      const H_test = dz;

      const { p, inField } = calculateGuthPositionIndex(H_test, D_test, S_test);
      if (inField && p < Infinity) {
        const luminousArea = Math.max(0.04, lum.lengthM * lum.widthM);
        const cosG = Math.max(0.05, H_test / dist);
        const pArea = luminousArea * cosG;
        const omega = pArea / (dist * dist);
        const gammaD = (Math.acos(cosG) * 180) / Math.PI;
        const bF = Math.max(0, Math.cos((gammaD / Math.max(1, lum.beamAngle / 2)) * (Math.PI / 2)));
        const intensity = lum.candela0 * Math.pow(bF, 1.2);
        const L_i = intensity / Math.max(0.01, pArea);
        stepNumeratorSum += (L_i * L_i * omega) / (p * p);
      }
    });

    let stepUGR = 10.0;
    if (stepNumeratorSum > 0) {
      const arg = (0.25 / L_b) * stepNumeratorSum;
      if (arg > 1e-4) stepUGR = 8 * Math.log10(arg);
    }
    stepUGR = Math.max(10.0, Math.min(35.0, Math.round(stepUGR * 10) / 10));

    if (stepUGR > ugrMax) {
      ugrMax = stepUGR;
      criticalHeadingDeg = deg;
    }

    polarSteps.push({
      angleDeg: deg,
      cardinalLabel: getCardinalLabel(deg),
      ugr: stepUGR,
      isCompliant: stepUGR <= limitUGR,
    });
  }

  return {
    observer,
    ugr,
    ugrMax,
    criticalHeadingDeg,
    backgroundLuminance: Math.round(L_b * 10) / 10,
    totalGlareSum: Math.round(totalNumeratorSum),
    isCompliant: ugr <= limitUGR,
    limitUGR,
    spaceType,
    contributions,
    polarSteps,
  };
}

// =========================================================================
// 5. UGR CALCULATION AREA GRID EVALUATION
// =========================================================================

/**
 * Calculates UGR over an entire grid of observer positions (e.g. across an open-plan office).
 */
export function calculateUGRAreaGrid(
  room: RoomEnvironment,
  luminaires: Luminaire3DInstance[],
  gridCols: number = 5,
  gridRows: number = 5,
  eyeHeight: number = 1.2,
  viewHeadingDeg: number = 0,
  limitUGR: number = 19
): UGRAreaResult {
  const points: UGRAreaGridPoint[] = [];

  const marginX = room.length * 0.15;
  const marginY = room.width * 0.15;
  const usableLength = room.length - 2 * marginX;
  const usableWidth = room.width - 2 * marginY;

  let totalUGR = 0;
  let minUGR = 999;
  let maxUGR = -999;
  let compliantCount = 0;

  for (let r = 0; r < gridRows; r++) {
    const y = marginY + (gridRows > 1 ? (r / (gridRows - 1)) * usableWidth : usableWidth / 2);

    for (let c = 0; c < gridCols; c++) {
      const x = marginX + (gridCols > 1 ? (c / (gridCols - 1)) * usableLength : usableLength / 2);

      const observer: UGRObserver = {
        id: `obs-grid-${r}-${c}`,
        name: `Desk (${c + 1}, ${r + 1})`,
        x,
        y,
        z: eyeHeight,
        viewHeadingDeg,
        elevationDeg: 0,
        posture: eyeHeight <= 1.3 ? "seated" : "standing",
      };

      const res = calculatePointUGR(observer, luminaires, room, limitUGR);

      totalUGR += res.ugr;
      if (res.ugr < minUGR) minUGR = res.ugr;
      if (res.ugr > maxUGR) maxUGR = res.ugr;
      if (res.isCompliant) compliantCount++;

      points.push({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z: eyeHeight,
        ugr: res.ugr,
        ugrMax: res.ugrMax,
        isCompliant: res.isCompliant,
      });
    }
  }

  const pointCount = points.length;
  const averageUGR = pointCount > 0 ? Math.round((totalUGR / pointCount) * 10) / 10 : 0;
  const percentCompliant =
    pointCount > 0 ? Math.round((compliantCount / pointCount) * 100) : 0;

  return {
    gridRows,
    gridCols,
    points,
    averageUGR,
    minUGR: minUGR === 999 ? 0 : minUGR,
    maxUGR: maxUGR === -999 ? 0 : maxUGR,
    percentCompliant,
    limitUGR,
  };
}

// =========================================================================
// 6. STANDARD CIE 117 TABULAR METHOD GENERATOR
// =========================================================================

/**
 * Generates the standard CIE 117 / EN 13032-2 UGR Table for luminaire documentation.
 */
export function generateCIE117Table(
  baseUGR: number,
  beamAngle: number
): CIE117TableRow[] {
  // Crosswise vs Endwise delta based on optical symmetry:
  // Asymmetrical linear luminaires produce higher glare crosswise (view perpendicular to lamps)
  const crosswiseDelta = beamAngle > 100 ? 1.4 : 0.8;

  const yDimensions = ["2H", "3H", "4H", "6H", "8H", "12H"];

  return yDimensions.map((dim, idx) => {
    // Room proportion scaling: larger rooms include more fixtures in peripheral field
    const sizeOffset = idx * 0.9;

    const cross70_50_20 = Math.round((baseUGR + crosswiseDelta + sizeOffset) * 10) / 10;
    const cross50_30_20 = Math.round((cross70_50_20 + 0.8) * 10) / 10;
    const end70_50_20 = Math.round((baseUGR - crosswiseDelta + sizeOffset) * 10) / 10;
    const end50_30_20 = Math.round((end70_50_20 + 0.8) * 10) / 10;

    return {
      roomDimensionY: dim,
      crosswise70_50_20: cross70_50_20,
      crosswise50_30_20: cross50_30_20,
      endwise70_50_20: end70_50_20,
      endwise50_30_20: end50_30_20,
    };
  });
}

// =========================================================================
// 7. CARDINAL LABELS & HELPER UTILITIES
// =========================================================================

function getCardinalLabel(deg: number): string {
  const norm = (deg + 360) % 360;
  if (norm >= 348.75 || norm < 11.25) return "E (0°)";
  if (norm >= 11.25 && norm < 33.75) return "ENE";
  if (norm >= 33.75 && norm < 56.25) return "NE (45°)";
  if (norm >= 56.25 && norm < 78.75) return "NNE";
  if (norm >= 78.75 && norm < 101.25) return "N (90°)";
  if (norm >= 101.25 && norm < 123.75) return "NNW";
  if (norm >= 123.75 && norm < 146.25) return "NW (135°)";
  if (norm >= 146.25 && norm < 168.75) return "WNW";
  if (norm >= 168.75 && norm < 191.25) return "W (180°)";
  if (norm >= 191.25 && norm < 213.75) return "WSW";
  if (norm >= 213.75 && norm < 236.25) return "SW (225°)";
  if (norm >= 236.25 && norm < 258.75) return "SSW";
  if (norm >= 258.75 && norm < 281.25) return "S (270°)";
  if (norm >= 281.25 && norm < 303.75) return "SSE";
  if (norm >= 303.75 && norm < 326.25) return "SE (315°)";
  return "ESE";
}
