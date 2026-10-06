/**
 * DIALux evo Photometric Simulation Engine
 * 
 * Replicates core DIALux evo photometric algorithms:
 * 1. Point-by-Point Calculation Grid on Working Plane (0.75m desk height)
 * 2. Inverse Square & Cosine Law with Beam Intensity Distribution (I(θ) * cos(θ) / d²)
 * 3. Photometric Metrics: E_avg (Maintained Lux), E_min, E_max, Uniformity U0 (E_min/E_avg), Diversity
 * 4. EN 12464-1 & CIBSE LG7 Compliance Verification
 * 5. IES / LDT Photometric File Parser (ANSI/IES LM-63)
 * 6. 2D/3D Polar Candela Distribution Curve Generator
 * 7. False-Color Heatmap & Isolux Contours Generator
 */

export interface LuminairePhotometricProfile {
  id?: string;
  name: string;
  manufacturer: string;
  model?: string;
  totalLumens?: number;
  lumens?: number;
  wattage: number;
  beamAngle: number; // degrees (e.g. 110 for panel, 60 for downlight, 90 for highbay)
  c0Angles?: number[]; // degrees from nadir (0 to 90 or 180)
  c0Candela?: number[]; // cd/klm or absolute cd
  c90Candela?: number[];
  colorTemp: number; // Kelvin (e.g. 4000K)
  cct?: number;
  cri?: number; // Color Rendering Index (e.g. 80, 90)
  category?: string;
  dimensions: { length: number; width: number; height: number; diameter?: number }; // meters
  distributionType?: string;
  shape?: string;
}

export interface LuminaireInstance {
  id: string;
  x: number; // position from room origin (meters)
  y: number;
  z: number; // mounting height (meters)
  rotationZ: number; // degrees (pan azimuth)
  rotationX?: number; // tilt X (degrees)
  rotationY?: number; // tilt Y (degrees)
  dimming?: number; // 0.0 to 1.0 (default 1.0)
  profileId?: string;
  isCustom?: boolean;
  targetPoint?: { x: number; y: number; z: number }; // 3D target point for aiming
  isExcluded?: boolean; // if excluded/skipped from arrangement
  arrangementGroupId?: string;
  gridRow?: number;
  gridCol?: number;
}

export interface LineArrangementConfig {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  count: number;
  spacing?: number;
  isContinuous: boolean; // Continuous seamless trunking / batten run
  fixtureLength?: number; // meters (e.g. 1.2m)
  alignPerpendicular?: boolean;
}

export interface CircularArrangementConfig {
  centerX: number;
  centerY: number;
  radius: number;
  count: number;
  startAngleDeg: number;
  sweepAngleDeg: number;
  alignTangential: boolean;
}

export interface PolygonalArrangementConfig {
  points: Array<{ x: number; y: number }>;
  count: number;
  closed?: boolean;
  isClosed?: boolean; // alias for closed
  alignToSegment?: boolean;
}

export interface LuminaireOverride {
  index?: number;
  x?: number; // absolute override or offset
  y?: number;
  z?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  rotationX?: number; // tilt X (deg)
  rotationY?: number; // tilt Y (deg)
  rotationZ?: number; // pan rotation (deg)
  targetPoint?: { x: number; y: number; z: number };
  aiming?: AimingAngles;
  dimming?: number;
  isExcluded?: boolean;
}

export interface AimingAngles {
  rotationZ: number; // pan azimuth (deg)
  rotationX: number; // tilt X (deg)
  rotationY: number; // tilt Y (deg)
  tiltDeg: number;   // tilt from nadir (0 = down, 90 = horizontal)
  pan: number;       // alias for rotationZ
  tilt: number;      // alias for tiltDeg
  pitch: number;     // alias for rotationX
  roll: number;      // alias for rotationY
  targetPoint: { x: number; y: number; z: number };
}

export interface IndividualLuminaireConfig {
  id: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  dimming?: number;
  profileId?: string;
  targetPoint?: { x: number; y: number; z: number };
  isExcluded?: boolean;
}

export interface PhotometricPoint {
  x: number;
  y: number;
  lux: number;
}

export type LuminaireArrangementMode = "grid" | "linear_continuous" | "perimeter" | "single_center" | "linear" | "circular" | "individual" | "polygonal";

export interface SurfaceReflectances {
  ceiling: number; // e.g. 0.70 (70%)
  walls: number;   // e.g. 0.50 (50%)
  floor: number;   // e.g. 0.20 (20%)
}

export const STANDARD_REFLECTANCE_PRESETS: Array<{
  name: string;
  ceiling: number;
  walls: number;
  floor: number;
}> = [
  { name: "Standard Office (70% / 50% / 20%)", ceiling: 0.70, walls: 0.50, floor: 0.20 },
  { name: "Hospital / Cleanroom (80% / 60% / 30%)", ceiling: 0.80, walls: 0.60, floor: 0.30 },
  { name: "Industrial / Workshop (50% / 30% / 10%)", ceiling: 0.50, walls: 0.30, floor: 0.10 },
  { name: "High-Reflectance White (80% / 80% / 40%)", ceiling: 0.80, walls: 0.80, floor: 0.40 },
  { name: "Dark Interior / Cinema (30% / 20% / 10%)", ceiling: 0.30, walls: 0.20, floor: 0.10 },
];

export type CalculationAreaType = "floor" | "workplane" | "workstation";

export interface WorkstationAreaConfig {
  name: string;
  length: number; // Task desk length (meters, default 1.6m)
  width: number; // Task desk width (meters, default 0.8m)
  x: number; // Center X position in room (meters)
  y: number; // Center Y position in room (meters)
  height: number; // Desk working elevation (meters, default 0.75m)
  surroundingBand: number; // EN 12464-1 surrounding area band width (default 0.5m)
  targetLux: number; // EN 12464-1 task target (default 500 lx)
}

export interface AreaPhotometricStats {
  areaType: CalculationAreaType | "surrounding";
  name: string;
  areaM2: number;
  height: number;
  avgLux: number;
  minLux: number;
  maxLux: number;
  uniformityU0: number;
  diversity: number;
  isCompliant: boolean;
  pointsCount: number;
}

export const WORKSTATION_PRESETS: Array<{
  name: string;
  length: number;
  width: number;
  height: number;
  targetLux: number;
  description: string;
}> = [
  { name: "Single Office Desk", length: 1.6, width: 0.8, height: 0.75, targetLux: 500, description: "Standard single VDU workstation (1600 × 800 mm)" },
  { name: "Dual Bench Pod (Back-to-Back)", length: 2.4, width: 1.6, height: 0.75, targetLux: 500, description: "2-person collaborative bench pod (2400 × 1600 mm)" },
  { name: "CAD / Technical Drawing Station", length: 2.0, width: 1.0, height: 0.75, targetLux: 750, description: "Precision design drafting desk (2000 × 1000 mm)" },
  { name: "Conference / Meeting Table", length: 3.2, width: 1.2, height: 0.75, targetLux: 500, description: "6-8 Person boardroom meeting table (3200 × 1200 mm)" },
  { name: "Reception / Service Counter", length: 2.4, width: 0.7, height: 0.90, targetLux: 300, description: "Standing / tall service reception counter (2400 × 700 mm)" },
  { name: "Laboratory Inspection Bench", length: 1.8, width: 0.9, height: 0.85, targetLux: 1000, description: "EN 12464-1 high-precision test bench (1800 × 900 mm)" },
];

export interface DialuxSimulationResult {
  avgLux: number; // E_avg (Maintained Illuminance)
  minLux: number; // E_min
  maxLux: number; // E_max
  uniformityU0: number; // U0 = E_min / E_avg
  diversity: number; // E_min / E_max
  targetLux: number;
  isUniformityCompliant: boolean; // U0 >= standard min (usually 0.40 or 0.60)
  isLuxCompliant: boolean; // avgLux >= targetLux
  ugrEstimate: number; // Unified Glare Rating estimate
  ugr: number; // Alias for workflow panels
  connectedPowerW: number;
  powerDensityWPerM2: number; // W/m²
  powerDensityPer100Lux: number; // W/m²/100 lx
  points: PhotometricPoint[];
  gridPoints: PhotometricPoint[]; // Alias for workflow panels
  summary: {
    avgLux: number;
    minLux: number;
    maxLux: number;
    uniformity: number;
  };
  gridResolution: { rows: number; cols: number };
  luminaires: LuminaireInstance[];
  rows: number;
  cols: number;
  workPlaneHeight: number;
  suspensionLength: number;
  reflectances: SurfaceReflectances;
  arrangementMode: LuminaireArrangementMode;

  // Calculation Area Decision & Multi-Area Statistics
  activeAreaType: CalculationAreaType;
  floorStats: AreaPhotometricStats;
  workplaneStats: AreaPhotometricStats;
  workstationStats: AreaPhotometricStats;
  surroundingStats: AreaPhotometricStats;
  workstationConfig?: WorkstationAreaConfig;

  // DIALux evo Tutorial Part 5 Arrangement & Individual Configurations
  lineConfig?: LineArrangementConfig;
  circularConfig?: CircularArrangementConfig;
  customLuminaires?: IndividualLuminaireConfig[];
}

/**
 * Standard Architectural Manufacturer Photometric Profiles (Built-in IES library)
 */
export const BUILTIN_PHOTOMETRIC_PROFILES: LuminairePhotometricProfile[] = [
  {
    name: "LED Panel 600x600 (110° Batwing)",
    manufacturer: "Philips / Signify CoreLine",
    model: "RC132V LED36S/840 PSD W60L60",
    totalLumens: 3600,
    wattage: 31,
    beamAngle: 110,
    c0Angles: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    c0Candela: [350, 345, 330, 305, 270, 220, 155, 85, 25, 0], // cd/klm
    colorTemp: 4000,
    cri: 80,
    dimensions: { length: 0.595, width: 0.595, height: 0.04 },
  },
  {
    name: "Recessed Downlight 20W (60° Medium)",
    manufacturer: "Zumtobel Panos Evolution",
    model: "PANOS EVO R150 20W 4000K",
    totalLumens: 2200,
    wattage: 20,
    beamAngle: 60,
    c0Angles: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    c0Candela: [1100, 1050, 850, 520, 240, 80, 25, 8, 2, 0],
    colorTemp: 4000,
    cri: 85,
    dimensions: { length: 0.18, width: 0.18, height: 0.12 },
  },
  {
    name: "Linear LED Batten (120° Wide)",
    manufacturer: "Thorn PopPack LED",
    model: "POP4500-840 L1200",
    totalLumens: 4500,
    wattage: 38,
    beamAngle: 120,
    c0Angles: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    c0Candela: [320, 315, 300, 280, 250, 210, 160, 100, 35, 0],
    colorTemp: 4000,
    cri: 80,
    dimensions: { length: 1.19, width: 0.06, height: 0.07 },
  },
  {
    name: "Industrial Highbay 150W (90° Wide)",
    manufacturer: "Disano Saturno Highbay",
    model: "SATURNO LED 150W 90D",
    totalLumens: 18000,
    wattage: 150,
    beamAngle: 90,
    c0Angles: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    c0Candela: [520, 510, 480, 410, 310, 190, 80, 25, 5, 0],
    colorTemp: 4000,
    cri: 80,
    dimensions: { length: 0.38, width: 0.38, height: 0.15 },
  },
  {
    name: "Vapour Proof IP65 Batten (100°)",
    manufacturer: "Trilux Nextrema LED",
    model: "NEXTREMA G3 G2 4000-840 IP66",
    totalLumens: 4000,
    wattage: 33,
    beamAngle: 100,
    c0Angles: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    c0Candela: [370, 360, 335, 290, 235, 170, 105, 45, 10, 0],
    colorTemp: 4000,
    cri: 80,
    dimensions: { length: 1.05, width: 0.10, height: 0.09 },
  },
];

/**
 * Calculates luminous intensity (in Candela) at a specific angle θ from nadir.
 */
export function getLuminousIntensityAtAngle(
  thetaDeg: number,
  profile: LuminairePhotometricProfile
): number {
  const theta = Math.abs(thetaDeg);
  if (theta >= 90) return 0;

  const angles = profile.c0Angles || [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const candelaTable = profile.c0Candela || [350, 345, 330, 305, 270, 220, 155, 85, 25, 0];
  const lumens = profile.totalLumens || profile.lumens || 3600;
  const klm = lumens / 1000;

  // Linear interpolation across photometric curve
  for (let i = 0; i < angles.length - 1; i++) {
    if (theta >= angles[i] && theta <= angles[i + 1]) {
      const t = (theta - angles[i]) / (angles[i + 1] - angles[i]);
      const cdPerKlm = candelaTable[i] + t * (candelaTable[i + 1] - candelaTable[i]);
      return cdPerKlm * klm;
    }
  }

  return 0;
}

/**
 * Automatically computes optimal rows and columns of luminaires to satisfy:
 * 1. Total Required Quantity from Lumen method
 * 2. Room aspect ratio (L / W)
 * 3. Maximum Spacing-to-Height Ratio (SHR <= 1.5)
 */
export function computeOptimalGridLayout(
  length: number,
  width: number,
  height: number,
  targetQuantity: number,
  workPlaneHeight: number = 0.75
): { rows: number; cols: number; total: number } {
  const Hmount = Math.max(0.5, height - workPlaneHeight);
  const qty = Math.max(1, targetQuantity);

  // Aspect ratio
  const ratio = Math.max(0.1, length / Math.max(0.1, width));

  // Find best integer pair (rows, cols) whose product is >= qty and best matches aspect ratio
  let bestRows = 1;
  let bestCols = 1;
  let minDiff = Infinity;

  // Search potential grid dimensions
  for (let r = 1; r <= Math.max(20, qty); r++) {
    const c = Math.ceil(qty / r);
    const gridRatio = c / r;
    const diff = Math.abs(gridRatio - ratio);

    // Check spacing limits
    const spacingX = length / c;
    const spacingY = width / r;
    const shrX = spacingX / Hmount;
    const shrY = spacingY / Hmount;

    // Favor layouts where SHR <= 1.6
    const shrPenalty = (shrX > 1.6 || shrY > 1.6) ? 2.0 : 0.0;

    const score = diff + (r * c - qty) * 0.15 + shrPenalty;

    if (score < minDiff) {
      minDiff = score;
      bestRows = r;
      bestCols = c;
    }
  }

  return {
    rows: bestRows,
    cols: bestCols,
    total: bestRows * bestCols,
  };
}

/**
 * Generates exact (x, y, z) 3D luminaire coordinates for Line / Trunking arrangements.
 * As demonstrated in DIALux evo Tutorial Part 5.
 */
export function generateLineLuminairePositions(
  lineConfig: LineArrangementConfig,
  height: number,
  suspensionLength: number = 0
): LuminaireInstance[] {
  const instances: LuminaireInstance[] = [];
  const mountZ = Math.max(0.5, height - suspensionLength);
  const { startX, startY, endX, endY, isContinuous, fixtureLength = 1.2 } = lineConfig;

  const dx = endX - startX;
  const dy = endY - startY;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = Number(((angleRad * 180) / Math.PI).toFixed(1));

  let count = Math.max(1, lineConfig.count);
  if (isContinuous && lineLength > 0.1 && fixtureLength > 0) {
    count = Math.max(1, Math.floor(lineLength / fixtureLength));
  }

  if (count === 1) {
    instances.push({
      id: "lum-line-0",
      x: Number(((startX + endX) / 2).toFixed(2)),
      y: Number(((startY + endY) / 2).toFixed(2)),
      z: mountZ,
      rotationZ: lineConfig.alignPerpendicular ? Number(((angleDeg + 90) % 360).toFixed(1)) : angleDeg,
    });
    return instances;
  }

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = startX + t * dx;
    const py = startY + t * dy;
    instances.push({
      id: `lum-line-${i}`,
      x: Number(px.toFixed(2)),
      y: Number(py.toFixed(2)),
      z: mountZ,
      rotationZ: lineConfig.alignPerpendicular ? Number(((angleDeg + 90) % 360).toFixed(1)) : angleDeg,
    });
  }

  return instances;
}

/**
 * Generates exact (x, y, z) 3D luminaire coordinates for Radial / Circular arrangements.
 */
export function generateCircularLuminairePositions(
  circConfig: CircularArrangementConfig,
  height: number,
  suspensionLength: number = 0
): LuminaireInstance[] {
  const instances: LuminaireInstance[] = [];
  const mountZ = Math.max(0.5, height - suspensionLength);
  const { centerX, centerY, radius, count, startAngleDeg = 0, sweepAngleDeg = 360, alignTangential = true } = circConfig;

  const total = Math.max(1, count);
  const startRad = (startAngleDeg * Math.PI) / 180;
  const sweepRad = (sweepAngleDeg * Math.PI) / 180;

  for (let i = 0; i < total; i++) {
    const fraction = total > 1 && sweepAngleDeg < 360 ? i / (total - 1) : i / total;
    const angle = startRad + fraction * sweepRad;
    const px = centerX + Math.cos(angle) * radius;
    const py = centerY + Math.sin(angle) * radius;
    const rotDeg = alignTangential
      ? Number((((angle + Math.PI / 2) * 180) / Math.PI).toFixed(1))
      : Number(((angle * 180) / Math.PI).toFixed(1));

    instances.push({
      id: `lum-circ-${i}`,
      x: Number(px.toFixed(2)),
      y: Number(py.toFixed(2)),
      z: mountZ,
      rotationZ: rotDeg,
    });
  }

  return instances;
}

/**
 * Calculates 3D Pan (rotationZ) and Tilt angles from a luminaire position to a target point.
 * DIALux evo Tutorial Part 6: Target Point Aiming Tool.
 */
export function calculateAimingAngles(
  lumXOrPos: number | { x: number; y: number; z: number },
  lumYOrTarget?: number | { x: number; y: number; z: number },
  lumZ: number = 0,
  targetX: number = 0,
  targetY: number = 0,
  targetZ: number = 0
): AimingAngles {
  let lx = 0, ly = 0, lz = 0;
  let tx = 0, ty = 0, tz = 0;

  if (typeof lumXOrPos === "object" && lumXOrPos !== null) {
    lx = lumXOrPos.x;
    ly = lumXOrPos.y;
    lz = lumXOrPos.z;
    if (typeof lumYOrTarget === "object" && lumYOrTarget !== null) {
      tx = lumYOrTarget.x;
      ty = lumYOrTarget.y;
      tz = lumYOrTarget.z ?? 0;
    }
  } else {
    lx = lumXOrPos;
    ly = typeof lumYOrTarget === "number" ? lumYOrTarget : 0;
    lz = lumZ;
    tx = targetX;
    ty = targetY;
    tz = targetZ;
  }

  const dx = tx - lx;
  const dy = ty - ly;
  const dz = tz - lz;
  const horizDist = Math.sqrt(dx * dx + dy * dy);

  // Pan / Azimuth in horizontal XY plane
  const panRad = Math.atan2(dy, dx);
  const panDeg = Number(((panRad * 180) / Math.PI).toFixed(1));

  // Tilt from vertical nadir (0 deg = straight down, 90 deg = horizontal)
  const tiltRad = Math.atan2(horizDist, Math.max(0.01, -dz));
  const tiltDeg = Number(((tiltRad * 180) / Math.PI).toFixed(1));

  const rotX = Number((tiltDeg * Math.sin(panRad)).toFixed(1));
  const rotY = Number((tiltDeg * Math.cos(panRad)).toFixed(1));

  return {
    rotationZ: panDeg,
    rotationX: rotX,
    rotationY: rotY,
    tiltDeg,
    pan: panDeg,
    tilt: tiltDeg,
    pitch: rotX,
    roll: rotY,
    targetPoint: { x: tx, y: ty, z: tz },
  };
}

/**
 * Generates exact (x, y, z) 3D luminaire coordinates for Polygonal / Free Path arrangements.
 * As demonstrated in DIALux evo Tutorial Part 6.
 */
export function generatePolygonalLuminairePositions(
  config: PolygonalArrangementConfig,
  height: number,
  suspensionLength: number = 0
): LuminaireInstance[] {
  const instances: LuminaireInstance[] = [];
  const mountZ = Math.max(0.5, height - suspensionLength);
  const pts = config.points || [];
  if (pts.length < 2) return instances;

  const closed = config.closed ?? config.isClosed ?? true;
  const alignToSegment = config.alignToSegment ?? true;
  const count = Math.max(2, config.count || 6);

  // Calculate segment lengths and cumulative perimeter
  const segments: Array<{
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    len: number;
    angleDeg: number;
  }> = [];

  let totalLength = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));
    segments.push({ p1, p2, len, angleDeg });
    totalLength += len;
  }

  if (closed && pts.length > 2) {
    const p1 = pts[pts.length - 1];
    const p2 = pts[0];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1));
    segments.push({ p1, p2, len, angleDeg });
    totalLength += len;
  }

  if (totalLength <= 0.01) return instances;

  const step = closed ? totalLength / count : totalLength / Math.max(1, count - 1);

  for (let i = 0; i < count; i++) {
    const targetDist = i * step;
    let accumulated = 0;
    let placed = false;

    for (const seg of segments) {
      if (targetDist <= accumulated + seg.len || seg === segments[segments.length - 1]) {
        const segDist = Math.max(0, Math.min(seg.len, targetDist - accumulated));
        const t = seg.len > 0 ? segDist / seg.len : 0;
        const px = seg.p1.x + t * (seg.p2.x - seg.p1.x);
        const py = seg.p1.y + t * (seg.p2.y - seg.p1.y);

        instances.push({
          id: `lum-poly-${i}`,
          x: Number(px.toFixed(2)),
          y: Number(py.toFixed(2)),
          z: mountZ,
          rotationZ: alignToSegment ? seg.angleDeg : 0,
        });
        placed = true;
        break;
      }
      accumulated += seg.len;
    }

    if (!placed && segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      instances.push({
        id: `lum-poly-${i}`,
        x: Number(lastSeg.p2.x.toFixed(2)),
        y: Number(lastSeg.p2.y.toFixed(2)),
        z: mountZ,
        rotationZ: alignToSegment ? lastSeg.angleDeg : 0,
      });
    }
  }

  return instances;
}

/**
 * Transforms an array of luminaire instances (rotate, offset, mirror, align).
 * DIALux evo Part 6 Arrangement Transformation Tools.
 */
export function transformLuminaireArrangement(
  instances: LuminaireInstance[],
  options: {
    rotateDeg?: number;
    center?: { x: number; y: number };
    offsetX?: number;
    offsetY?: number;
    mirrorX?: boolean;
    mirrorY?: boolean;
    alignTo?: "center" | "north" | "south" | "east" | "west";
    roomL?: number;
    roomW?: number;
    wallOffset?: number;
  }
): LuminaireInstance[] {
  if (instances.length === 0) return [];
  const {
    rotateDeg = 0,
    offsetX = 0,
    offsetY = 0,
    mirrorX = false,
    mirrorY = false,
    alignTo,
    roomL,
    roomW,
    wallOffset = 0.5,
  } = options;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  instances.forEach((lum) => {
    if (lum.x < minX) minX = lum.x;
    if (lum.x > maxX) maxX = lum.x;
    if (lum.y < minY) minY = lum.y;
    if (lum.y > maxY) maxY = lum.y;
  });

  const cx = options.center ? options.center.x : (minX + maxX) / 2;
  const cy = options.center ? options.center.y : (minY + maxY) / 2;
  const rotRad = (rotateDeg * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);

  let transformed = instances.map((lum) => {
    let relX = lum.x - cx;
    let relY = lum.y - cy;

    if (mirrorX) relX = -relX;
    if (mirrorY) relY = -relY;

    const rx = relX * cosR - relY * sinR;
    const ry = relX * sinR + relY * cosR;

    return {
      ...lum,
      x: Number((cx + rx + offsetX).toFixed(2)),
      y: Number((cy + ry + offsetY).toFixed(2)),
      rotationZ: Number(((lum.rotationZ + rotateDeg) % 360).toFixed(1)),
    };
  });

  if (alignTo && roomL && roomW) {
    let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
    transformed.forEach((lum) => {
      if (lum.x < tMinX) tMinX = lum.x;
      if (lum.x > tMaxX) tMaxX = lum.x;
      if (lum.y < tMinY) tMinY = lum.y;
      if (lum.y > tMaxY) tMaxY = lum.y;
    });
    const tWidth = tMaxX - tMinX;
    const tHeight = tMaxY - tMinY;
    let shiftX = 0;
    let shiftY = 0;

    if (alignTo === "center") {
      shiftX = (roomL - tWidth) / 2 - tMinX;
      shiftY = (roomW - tHeight) / 2 - tMinY;
    } else if (alignTo === "west") {
      shiftX = wallOffset - tMinX;
    } else if (alignTo === "east") {
      shiftX = (roomL - wallOffset) - tMaxX;
    } else if (alignTo === "south") {
      shiftY = wallOffset - tMinY;
    } else if (alignTo === "north") {
      shiftY = (roomW - wallOffset) - tMaxY;
    }

    transformed = transformed.map((lum) => ({
      ...lum,
      x: Number(Math.max(0.1, Math.min(roomL - 0.1, lum.x + shiftX)).toFixed(2)),
      y: Number(Math.max(0.1, Math.min(roomW - 0.1, lum.y + shiftY)).toFixed(2)),
    }));
  }

  return transformed;
}

/**
 * Computes automatic luminaire arrangement for spaces matching DIALux evo Tutorial Part 5.
 * Replicates "Automatic arrangement for spaces" feature targeting EN 12464-1 illuminance.
 */
export function computeSpaceAutoArrangement(params: {
  length: number;
  width: number;
  height: number;
  targetLux: number;
  profile: LuminairePhotometricProfile;
  mf?: number;
  reflectances?: SurfaceReflectances;
  workPlaneHeight?: number;
}): {
  rows: number;
  cols: number;
  total: number;
  calculatedLux: number;
  uniformityEstimate: number;
  powerDensityWPerM2: number;
  spacingX: number;
  spacingY: number;
  shr: number;
  isCompliant: boolean;
} {
  const {
    length,
    width,
    height,
    targetLux,
    profile,
    mf = 0.80,
    reflectances = { ceiling: 0.70, walls: 0.50, floor: 0.20 },
    workPlaneHeight = 0.75,
  } = params;

  const Hrel = Math.max(0.5, height - workPlaneHeight);
  const floorArea = length * width;
  const rcr = floorArea > 0 ? (5 * Hrel * (length + width)) / floorArea : 2.5;

  // Utilization factor approximation based on RCR & reflectances
  const baseUF = Math.max(0.35, Math.min(0.75, 0.70 - 0.05 * rcr + 0.1 * reflectances.ceiling));
  const fixtureLumens = profile.totalLumens || profile.lumens || 3600;

  const requiredTotalFlux = (targetLux * floorArea) / (baseUF * mf);
  const rawCount = Math.max(1, Math.round(requiredTotalFlux / fixtureLumens));

  const optimalGrid = computeOptimalGridLayout(length, width, height, rawCount, workPlaneHeight);
  const total = optimalGrid.total;
  const rows = optimalGrid.rows;
  const cols = optimalGrid.cols;

  const spacingX = Number((length / cols).toFixed(2));
  const spacingY = Number((width / rows).toFixed(2));
  const shr = Number((Math.max(spacingX, spacingY) / Hrel).toFixed(2));

  const calculatedLux = Math.round((total * fixtureLumens * baseUF * mf) / floorArea);
  const uniformityEstimate = shr <= 1.2 ? 0.70 : shr <= 1.5 ? 0.60 : 0.45;
  const powerDensityWPerM2 = Number(((total * profile.wattage) / floorArea).toFixed(2));
  const isCompliant = calculatedLux >= targetLux && uniformityEstimate >= 0.40;

  return {
    rows,
    cols,
    total,
    calculatedLux,
    uniformityEstimate,
    powerDensityWPerM2,
    spacingX,
    spacingY,
    shr,
    isCompliant,
  };
}

/**
 * Generates exact (x, y, z) 3D luminaire coordinates following standard architectural rules.
 * Supports: Grid (a/2 rule), Linear Continuous Row, Perimeter Border, Circular, and Single Center.
 */
export function generateLuminairePositions(
  length: number,
  width: number,
  height: number,
  rows: number,
  cols: number,
  suspensionLength: number = 0,
  mode: LuminaireArrangementMode = "grid",
  lineConfig?: Partial<LineArrangementConfig>,
  circularConfig?: Partial<CircularArrangementConfig>,
  polygonalConfig?: Partial<PolygonalArrangementConfig>,
  gridOptions?: {
    spacingX?: number;
    spacingY?: number;
    marginX?: number;
    marginY?: number;
    rotationDeg?: number;
  },
  overrides?: Record<number | string, LuminaireOverride>
): LuminaireInstance[] {
  const instances: LuminaireInstance[] = [];
  const mountZ = Math.max(0.5, height - suspensionLength);

  if (mode === "single_center") {
    instances.push({
      id: "lum-center",
      x: Number((length / 2).toFixed(2)),
      y: Number((width / 2).toFixed(2)),
      z: mountZ,
      rotationZ: 0,
    });
    return applyLuminaireOverrides(instances, overrides);
  }

  if (mode === "individual") {
    return [];
  }

  if (mode === "polygonal") {
    const fullPolyCfg: PolygonalArrangementConfig = {
      points: polygonalConfig?.points || [
        { x: Number((length * 0.15).toFixed(2)), y: Number((width * 0.15).toFixed(2)) },
        { x: Number((length * 0.85).toFixed(2)), y: Number((width * 0.15).toFixed(2)) },
        { x: Number((length * 0.85).toFixed(2)), y: Number((width * 0.85).toFixed(2)) },
        { x: Number((length * 0.15).toFixed(2)), y: Number((width * 0.85).toFixed(2)) },
      ],
      count: polygonalConfig?.count ?? Math.max(4, rows * cols),
      closed: polygonalConfig?.closed ?? true,
      alignToSegment: polygonalConfig?.alignToSegment ?? true,
    };
    const polyLums = generatePolygonalLuminairePositions(fullPolyCfg, height, suspensionLength);
    return applyLuminaireOverrides(polyLums, overrides);
  }

  if (mode === "linear" && lineConfig && lineConfig.startX !== undefined && lineConfig.endX !== undefined) {
    const fullLineCfg: LineArrangementConfig = {
      startX: lineConfig.startX ?? 0.5,
      startY: lineConfig.startY ?? width / 2,
      endX: lineConfig.endX ?? length - 0.5,
      endY: lineConfig.endY ?? width / 2,
      count: lineConfig.count ?? Math.max(1, rows * cols),
      isContinuous: lineConfig.isContinuous ?? false,
      fixtureLength: lineConfig.fixtureLength ?? 1.2,
      alignPerpendicular: lineConfig.alignPerpendicular ?? false,
    };
    const lineLums = generateLineLuminairePositions(fullLineCfg, height, suspensionLength);
    return applyLuminaireOverrides(lineLums, overrides);
  }

  if (mode === "linear_continuous") {
    const count = Math.max(1, rows * cols);
    const isXLonger = length >= width;
    if (isXLonger) {
      const step = length / count;
      const fixedY = width / 2;
      for (let i = 0; i < count; i++) {
        instances.push({
          id: `lum-lin-${i}`,
          x: Number((step * 0.5 + i * step).toFixed(2)),
          y: Number(fixedY.toFixed(2)),
          z: mountZ,
          rotationZ: 0,
        });
      }
    } else {
      const step = width / count;
      const fixedX = length / 2;
      for (let i = 0; i < count; i++) {
        instances.push({
          id: `lum-lin-${i}`,
          x: Number(fixedX.toFixed(2)),
          y: Number((step * 0.5 + i * step).toFixed(2)),
          z: mountZ,
          rotationZ: 90,
        });
      }
    }
    return applyLuminaireOverrides(instances, overrides);
  }

  if (mode === "perimeter") {
    const total = Math.max(4, rows * cols);
    const marginX = length * 0.15;
    const marginY = width * 0.15;
    const perimeterLength = 2 * ((length - 2 * marginX) + (width - 2 * marginY));
    const step = perimeterLength / total;
    for (let i = 0; i < total; i++) {
      const dist = i * step;
      let x = marginX;
      let y = marginY;
      const topLen = length - 2 * marginX;
      const rightLen = width - 2 * marginY;
      if (dist <= topLen) {
        x = marginX + dist;
        y = marginY;
      } else if (dist <= topLen + rightLen) {
        x = length - marginX;
        y = marginY + (dist - topLen);
      } else if (dist <= 2 * topLen + rightLen) {
        x = length - marginX - (dist - (topLen + rightLen));
        y = width - marginY;
      } else {
        x = marginX;
        y = width - marginY - (dist - (2 * topLen + rightLen));
      }
      instances.push({
        id: `lum-perim-${i}`,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: mountZ,
        rotationZ: 0,
      });
    }
    return applyLuminaireOverrides(instances, overrides);
  }

  if (mode === "circular") {
    if (circularConfig && circularConfig.centerX !== undefined) {
      const fullCircCfg: CircularArrangementConfig = {
        centerX: circularConfig.centerX ?? length / 2,
        centerY: circularConfig.centerY ?? width / 2,
        radius: circularConfig.radius ?? Math.min(length, width) * 0.35,
        count: circularConfig.count ?? Math.max(4, rows * cols),
        startAngleDeg: circularConfig.startAngleDeg ?? 0,
        sweepAngleDeg: circularConfig.sweepAngleDeg ?? 360,
        alignTangential: circularConfig.alignTangential ?? true,
      };
      const circLums = generateCircularLuminairePositions(fullCircCfg, height, suspensionLength);
      return applyLuminaireOverrides(circLums, overrides);
    }
    const total = Math.max(4, rows * cols);
    const radius = Math.min(length, width) * 0.35;
    const centerX = length / 2;
    const centerY = width / 2;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * 2 * Math.PI;
      instances.push({
        id: `lum-circ-${i}`,
        x: Number((centerX + Math.cos(angle) * radius).toFixed(2)),
        y: Number((centerY + Math.sin(angle) * radius).toFixed(2)),
        z: mountZ,
        rotationZ: Number(((angle * 180) / Math.PI).toFixed(1)),
      });
    }
    return applyLuminaireOverrides(instances, overrides);
  }

  // Default: Grid (standard architectural a/2 spacing rule or explicit gridOptions)
  const marginX = gridOptions?.marginX !== undefined ? gridOptions.marginX : 0;
  const marginY = gridOptions?.marginY !== undefined ? gridOptions.marginY : 0;
  const usableL = length - 2 * marginX;
  const usableW = width - 2 * marginY;
  const dx = gridOptions?.spacingX || (cols > 0 ? usableL / cols : usableL);
  const dy = gridOptions?.spacingY || (rows > 0 ? usableW / rows : usableW);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      instances.push({
        id: `lum-${r}-${c}`,
        gridRow: r,
        gridCol: c,
        x: Number((marginX + dx * 0.5 + c * dx).toFixed(2)),
        y: Number((marginY + dy * 0.5 + r * dy).toFixed(2)),
        z: mountZ,
        rotationZ: gridOptions?.rotationDeg || 0,
      });
    }
  }

  let finalLums = instances;
  if (gridOptions?.rotationDeg) {
    finalLums = transformLuminaireArrangement(finalLums, {
      rotateDeg: gridOptions.rotationDeg,
      roomL: length,
      roomW: width,
    });
  }

  return applyLuminaireOverrides(finalLums, overrides);
}

/**
 * Applies individual luminaire coordinate/aiming/dimming/exclusion overrides.
 * DIALux evo Part 6: Selecting and modifying individual luminaires in an arrangement.
 */
export function applyLuminaireOverrides(
  instances: LuminaireInstance[],
  overrides?: Record<number | string, LuminaireOverride>
): LuminaireInstance[] {
  if (!overrides) return instances;
  return instances.map((lum, idx) => {
    const ovr = overrides[idx] !== undefined ? overrides[idx] : overrides[lum.id];
    if (!ovr) return lum;
    return {
      ...lum,
      x: ovr.x !== undefined ? ovr.x : ovr.offsetX !== undefined ? Number((lum.x + ovr.offsetX).toFixed(2)) : lum.x,
      y: ovr.y !== undefined ? ovr.y : ovr.offsetY !== undefined ? Number((lum.y + ovr.offsetY).toFixed(2)) : lum.y,
      z: ovr.z !== undefined ? ovr.z : ovr.offsetZ !== undefined ? Number((lum.z + ovr.offsetZ).toFixed(2)) : lum.z,
      rotationZ: ovr.rotationZ !== undefined ? ovr.rotationZ : lum.rotationZ,
      rotationX: ovr.rotationX !== undefined ? ovr.rotationX : lum.rotationX,
      rotationY: ovr.rotationY !== undefined ? ovr.rotationY : lum.rotationY,
      dimming: ovr.dimming !== undefined ? ovr.dimming : lum.dimming,
      targetPoint: ovr.targetPoint !== undefined ? ovr.targetPoint : lum.targetPoint,
      isExcluded: ovr.isExcluded !== undefined ? ovr.isExcluded : lum.isExcluded,
    };
  });
}

/**
 * Runs the Point-by-Point Photometric Inverse Square Law Simulation.
 * Supports EN 12464-1 / DIALux evo multi-area evaluation:
 * - Floor Area (Z = 0.00m, wall-to-wall footprint, margin = 0)
 * - Working Plane (Elevated at workPlaneHeight, default 0.75m, with wall margin offset)
 * - Workstation Desk Area (Task area + EN 12464-1 0.5m immediate surrounding area)
 */
export function runPointByPointSimulation(params: {
  length: number;
  width: number;
  height: number;
  rows: number;
  cols: number;
  profile: LuminairePhotometricProfile;
  targetLux: number;
  mf: number; // Maintenance Factor (e.g. 0.8)
  workPlaneHeight?: number; // default 0.75m
  suspensionLength?: number; // default 0m
  reflectances?: SurfaceReflectances; // default { ceiling: 0.70, walls: 0.50, floor: 0.20 }
  arrangementMode?: LuminaireArrangementMode; // default "grid"
  gridResolution?: { cols: number; rows: number }; // default 25x25
  calcAreaType?: CalculationAreaType; // "floor" | "workplane" | "workstation" (default "workplane")
  workstationConfig?: Partial<WorkstationAreaConfig>;
  marginOffset?: number; // default 0.5m
  lineConfig?: Partial<LineArrangementConfig>;
  circularConfig?: Partial<CircularArrangementConfig>;
  polygonalConfig?: Partial<PolygonalArrangementConfig>;
  gridOptions?: {
    spacingX?: number;
    spacingY?: number;
    marginX?: number;
    marginY?: number;
    rotationDeg?: number;
  };
  arrangementOverrides?: Record<number | string, LuminaireOverride>;
  customLuminaires?: IndividualLuminaireConfig[];
}): DialuxSimulationResult {
  const {
    length,
    width,
    height,
    rows,
    cols,
    profile,
    targetLux,
    mf,
    workPlaneHeight = 0.75,
    suspensionLength: rawSuspension = 0,
    reflectances = { ceiling: 0.70, walls: 0.50, floor: 0.20 },
    arrangementMode = "grid",
    calcAreaType: rawCalcAreaType = "workplane",
    workstationConfig: rawWsConfig,
    marginOffset: rawMargin,
    lineConfig,
    circularConfig,
    polygonalConfig,
    gridOptions,
    arrangementOverrides,
    customLuminaires = [],
  } = params;

  const activeAreaType: CalculationAreaType = rawCalcAreaType || "workplane";
  const margin = rawMargin !== undefined ? rawMargin : Math.min(0.5, Math.min(length, width) * 0.15);

  const workstationConfig: WorkstationAreaConfig = {
    name: rawWsConfig?.name || "Single Office Desk",
    length: rawWsConfig?.length || 1.6,
    width: rawWsConfig?.width || 0.8,
    x: rawWsConfig?.x !== undefined ? rawWsConfig.x : Number((length / 2).toFixed(2)),
    y: rawWsConfig?.y !== undefined ? rawWsConfig.y : Number((width / 2).toFixed(2)),
    height: rawWsConfig?.height !== undefined ? rawWsConfig.height : 0.75,
    surroundingBand: rawWsConfig?.surroundingBand !== undefined ? rawWsConfig.surroundingBand : 0.5,
    targetLux: rawWsConfig?.targetLux || 500,
  };

  const suspensionLength = Math.max(0, Math.min(rawSuspension, height - workPlaneHeight - 0.2));
  const resCols = params.gridResolution?.cols || Math.min(35, Math.max(15, Math.round(length * 3)));
  const resRows = params.gridResolution?.rows || Math.min(35, Math.max(15, Math.round(width * 3)));

  const rawLuminaires = generateLuminairePositions(
    length,
    width,
    height,
    rows,
    cols,
    suspensionLength,
    arrangementMode,
    lineConfig,
    circularConfig,
    polygonalConfig,
    gridOptions,
    arrangementOverrides
  );

  const customLums: LuminaireInstance[] = customLuminaires.map((cl) => ({
    id: cl.id,
    x: cl.x,
    y: cl.y,
    z: cl.z,
    rotationX: cl.rotationX || 0,
    rotationY: cl.rotationY || 0,
    rotationZ: cl.rotationZ || 0,
    dimming: cl.dimming !== undefined ? cl.dimming : 1.0,
    profileId: cl.profileId,
    targetPoint: cl.targetPoint,
    isExcluded: cl.isExcluded,
    isCustom: true,
  }));

  const luminaires: LuminaireInstance[] = arrangementMode === "individual"
    ? customLums
    : [...rawLuminaires, ...customLums];

  // Surface reflectances & interreflection (CIE 97 / IESNA Zonal Cavity Method)
  const ceilingArea = length * width;
  const floorArea = length * width;
  const wallArea = 2 * (length + width) * height;
  const totalRoomArea = ceilingArea + floorArea + wallArea;
  const avgReflectance = totalRoomArea > 0
    ? (reflectances.ceiling * ceilingArea + reflectances.walls * wallArea + reflectances.floor * floorArea) / totalRoomArea
    : 0.40;

  // Active elevation for 3D false-color display and isolux lines
  const evalZ = activeAreaType === "floor"
    ? 0.00
    : activeAreaType === "workstation"
    ? workstationConfig.height
    : workPlaneHeight;

  const Hrel = Math.max(0.2, height - suspensionLength - evalZ);
  const roomIndex = (length * width) / (Hrel * (length + width));
  const interReflection = 1.0 + (avgReflectance / (1 - Math.min(0.85, avgReflectance))) * Math.min(0.35, Math.max(0.05, roomIndex * 0.10));

  // Helper: Computes total maintained illuminance at any 3D coordinate (px, py, pz)
  // Implements 3D Cosine & Inverse-Square Law with support for aiming targets & tilt angles (Part 6)
  const computePointLux = (px: number, py: number, pz: number): number => {
    let directLux = 0;
    for (const lum of luminaires) {
      if (lum.isExcluded) continue;

      const H = Math.max(0.05, lum.z - pz);
      const dx = px - lum.x;
      const dy = py - lum.y;
      const distHoriz = Math.sqrt(dx * dx + dy * dy);
      const dist3D = Math.sqrt(distHoriz * distHoriz + H * H);
      if (dist3D <= 0) continue;

      const cosPsi = Math.max(0, H / dist3D); // horizontal surface incidence

      // Direction vector from luminaire to point
      const vX = dx / dist3D;
      const vY = dy / dist3D;
      const vZ = -H / dist3D;

      // Luminaire optical aiming axis unit vector
      let axisX = 0;
      let axisY = 0;
      let axisZ = -1;

      if (lum.targetPoint) {
        const tdx = lum.targetPoint.x - lum.x;
        const tdy = lum.targetPoint.y - lum.y;
        const tdz = lum.targetPoint.z - lum.z;
        const tDist = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
        if (tDist > 0.01) {
          axisX = tdx / tDist;
          axisY = tdy / tDist;
          axisZ = tdz / tDist;
        }
      } else if (lum.rotationX || lum.rotationY) {
        const tiltXRad = ((lum.rotationX || 0) * Math.PI) / 180;
        const tiltYRad = ((lum.rotationY || 0) * Math.PI) / 180;
        axisX = Math.sin(tiltYRad);
        axisY = Math.sin(tiltXRad);
        axisZ = -Math.cos(Math.max(Math.abs(tiltXRad), Math.abs(tiltYRad)));
        const aLen = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ);
        if (aLen > 0) {
          axisX /= aLen;
          axisY /= aLen;
          axisZ /= aLen;
        }
      }

      // Cosine angle between luminaire aiming axis and calculation point direction
      const cosTheta = Math.max(0, axisX * vX + axisY * vY + axisZ * vZ);
      const thetaDeg = (Math.acos(Math.min(1, Math.max(0, cosTheta))) * 180) / Math.PI;

      const intensity = getLuminousIntensityAtAngle(thetaDeg, profile);
      const dim = lum.dimming !== undefined ? lum.dimming : 1.0;
      directLux += ((intensity * cosPsi) / (dist3D * dist3D)) * dim;
    }
    return Math.round(directLux * mf * interReflection);
  };

  // Workstation Task bounds
  const wsX1 = workstationConfig.x - workstationConfig.length / 2;
  const wsX2 = workstationConfig.x + workstationConfig.length / 2;
  const wsY1 = workstationConfig.y - workstationConfig.width / 2;
  const wsY2 = workstationConfig.y + workstationConfig.width / 2;

  // EN 12464-1 Immediate surrounding area bounds
  const surrX1 = wsX1 - workstationConfig.surroundingBand;
  const surrX2 = wsX2 + workstationConfig.surroundingBand;
  const surrY1 = wsY1 - workstationConfig.surroundingBand;
  const surrY2 = wsY2 + workstationConfig.surroundingBand;

  const points: PhotometricPoint[] = [];
  const floorLuxValues: number[] = [];
  const workplaneLuxValues: number[] = [];
  const workstationLuxValues: number[] = [];
  const surroundingLuxValues: number[] = [];

  const stepX = length / resCols;
  const stepY = width / resRows;

  for (let r = 0; r < resRows; r++) {
    const ptY = (r + 0.5) * stepY;
    const isInsideMarginY = ptY >= margin && ptY <= width - margin;

    for (let c = 0; c < resCols; c++) {
      const ptX = (c + 0.5) * stepX;
      const isInsideMarginX = ptX >= margin && ptX <= length - margin;
      const isInsideWorkplaneZone = isInsideMarginX && isInsideMarginY;

      // 1. Point illuminance at active evaluation plane (for 3D Heatmap & Isolux lines)
      const ptLuxAtEvalZ = computePointLux(ptX, ptY, evalZ);
      points.push({
        x: Number(ptX.toFixed(2)),
        y: Number(ptY.toFixed(2)),
        lux: ptLuxAtEvalZ,
      });

      // 2. Floor evaluation (Z = 0.00m, wall-to-wall)
      const floorLux = evalZ === 0.00 ? ptLuxAtEvalZ : computePointLux(ptX, ptY, 0.00);
      floorLuxValues.push(floorLux);

      // 3. Working Plane evaluation (Z = workPlaneHeight, margin excluded)
      if (isInsideWorkplaneZone) {
        const wpLux = evalZ === workPlaneHeight ? ptLuxAtEvalZ : computePointLux(ptX, ptY, workPlaneHeight);
        workplaneLuxValues.push(wpLux);
      }

      // 4. Workstation Desk evaluation (Z = workstation.height)
      const isInsideWs = ptX >= wsX1 && ptX <= wsX2 && ptY >= wsY1 && ptY <= wsY2;
      if (isInsideWs) {
        const wsLux = evalZ === workstationConfig.height ? ptLuxAtEvalZ : computePointLux(ptX, ptY, workstationConfig.height);
        workstationLuxValues.push(wsLux);
      }

      // 5. Immediate surrounding area (Z = workstation.height, band around desk)
      const isInsideSurr = ptX >= surrX1 && ptX <= surrX2 && ptY >= surrY1 && ptY <= surrY2 && !isInsideWs;
      if (isInsideSurr) {
        const surrLux = evalZ === workstationConfig.height ? ptLuxAtEvalZ : computePointLux(ptX, ptY, workstationConfig.height);
        surroundingLuxValues.push(surrLux);
      }
    }
  }

  // Micro-grid fallback for workstation desk if room grid points are sparse (< 12 points)
  if (workstationLuxValues.length < 12) {
    const subCols = 5;
    const subRows = 5;
    const subStepX = workstationConfig.length / subCols;
    const subStepY = workstationConfig.width / subRows;
    for (let r = 0; r < subRows; r++) {
      for (let c = 0; c < subCols; c++) {
        const sx = wsX1 + (c + 0.5) * subStepX;
        const sy = wsY1 + (r + 0.5) * subStepY;
        workstationLuxValues.push(computePointLux(sx, sy, workstationConfig.height));
      }
    }
  }

  // Fallback for surrounding area if sparse (< 12 points)
  if (surroundingLuxValues.length < 12) {
    const surrSamples = 16;
    for (let i = 0; i < surrSamples; i++) {
      const angle = (i / surrSamples) * 2 * Math.PI;
      const offsetDist = workstationConfig.surroundingBand * 0.5;
      const sx = Math.max(0.1, Math.min(length - 0.1, workstationConfig.x + (workstationConfig.length / 2 + offsetDist) * Math.cos(angle)));
      const sy = Math.max(0.1, Math.min(width - 0.1, workstationConfig.y + (workstationConfig.width / 2 + offsetDist) * Math.sin(angle)));
      surroundingLuxValues.push(computePointLux(sx, sy, workstationConfig.height));
    }
  }

  // Stats computation helper
  const computeStatsForValues = (
    values: number[],
    areaType: CalculationAreaType | "surrounding",
    name: string,
    areaM2: number,
    heightVal: number,
    targetVal: number,
    minU0Required: number
  ): AreaPhotometricStats => {
    if (values.length === 0) {
      return {
        areaType,
        name,
        areaM2: Number(areaM2.toFixed(2)),
        height: Number(heightVal.toFixed(2)),
        avgLux: 0,
        minLux: 0,
        maxLux: 0,
        uniformityU0: 0,
        diversity: 0,
        isCompliant: false,
        pointsCount: 0,
      };
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = Math.round(sum / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const u0 = avg > 0 ? parseFloat((min / avg).toFixed(2)) : 0;
    const div = max > 0 ? parseFloat((min / max).toFixed(2)) : 0;
    const isCompliant = avg >= targetVal && u0 >= minU0Required;
    return {
      areaType,
      name,
      areaM2: Number(areaM2.toFixed(2)),
      height: Number(heightVal.toFixed(2)),
      avgLux: avg,
      minLux: min,
      maxLux: max,
      uniformityU0: u0,
      diversity: div,
      isCompliant,
      pointsCount: values.length,
    };
  };

  // Compile individual stats blocks
  const floorStats = computeStatsForValues(
    floorLuxValues,
    "floor",
    "Floor Surface Area",
    length * width,
    0.00,
    100,
    0.40
  );

  const usefulWpArea = Math.max(0.1, length - 2 * margin) * Math.max(0.1, width - 2 * margin);
  const minRequiredU0 = targetLux >= 500 ? 0.60 : 0.40;
  const workplaneStats = computeStatsForValues(
    workplaneLuxValues.length > 0 ? workplaneLuxValues : floorLuxValues,
    "workplane",
    "Working Plane (Useful Area)",
    usefulWpArea,
    workPlaneHeight,
    targetLux,
    minRequiredU0
  );

  const wsArea = workstationConfig.length * workstationConfig.width;
  const workstationStats = computeStatsForValues(
    workstationLuxValues,
    "workstation",
    workstationConfig.name,
    wsArea,
    workstationConfig.height,
    workstationConfig.targetLux,
    0.60
  );

  const surrArea = Math.max(
    0.1,
    (workstationConfig.length + 2 * workstationConfig.surroundingBand) *
      (workstationConfig.width + 2 * workstationConfig.surroundingBand) -
      wsArea
  );
  const surrTargetLux = Math.min(300, Math.round(workstationConfig.targetLux * 0.6));
  const surroundingStats = computeStatsForValues(
    surroundingLuxValues,
    "surrounding",
    "Immediate Surrounding Area (0.5m)",
    surrArea,
    workstationConfig.height,
    surrTargetLux,
    0.40
  );

  // Synchronize top-level summary metrics with the user's active decided evaluation area
  const activeStats = activeAreaType === "floor"
    ? floorStats
    : activeAreaType === "workstation"
    ? workstationStats
    : workplaneStats;

  const avgLux = activeStats.avgLux;
  const evalMin = activeStats.minLux;
  const evalMax = activeStats.maxLux;
  const uniformityU0 = activeStats.uniformityU0;
  const diversity = activeStats.diversity;
  const isUniformityCompliant = activeStats.uniformityU0 >= (activeAreaType === "floor" ? 0.40 : activeAreaType === "workstation" ? 0.60 : minRequiredU0);
  const isLuxCompliant = activeStats.isCompliant;

  // Power Density calculations
  const totalLuminaires = luminaires.length;
  const connectedPowerW = totalLuminaires * profile.wattage;
  const roomArea = length * width;
  const powerDensityWPerM2 = roomArea > 0 ? parseFloat((connectedPowerW / roomArea).toFixed(2)) : 0;
  const powerDensityPer100Lux = (powerDensityWPerM2 > 0 && avgLux > 0)
    ? parseFloat(((powerDensityWPerM2 / avgLux) * 100).toFixed(2))
    : 0;

  // Glare (UGR) estimate based on CIBSE Unified Glare Rating standard tables
  let ugrEstimate = 16;
  if (profile.beamAngle > 100) ugrEstimate = 19;
  if (profile.beamAngle > 115) ugrEstimate = 22;
  if (powerDensityWPerM2 > 15) ugrEstimate += 2;
  if (Hrel < 2.0) ugrEstimate += 1;

  return {
    avgLux,
    minLux: evalMin,
    maxLux: evalMax,
    uniformityU0,
    diversity,
    targetLux: activeAreaType === "workstation" ? workstationConfig.targetLux : targetLux,
    isUniformityCompliant,
    isLuxCompliant,
    ugrEstimate,
    ugr: ugrEstimate,
    connectedPowerW: Math.round(connectedPowerW),
    powerDensityWPerM2,
    powerDensityPer100Lux,
    points,
    gridPoints: points,
    summary: {
      avgLux,
      minLux: evalMin,
      maxLux: evalMax,
      uniformity: uniformityU0,
    },
    gridResolution: { rows: resRows, cols: resCols },
    luminaires,
    rows,
    cols,
    workPlaneHeight,
    suspensionLength,
    reflectances,
    arrangementMode,
    activeAreaType,
    floorStats,
    workplaneStats,
    workstationStats,
    surroundingStats,
    workstationConfig,
    lineConfig: lineConfig ? {
      startX: lineConfig.startX ?? 0.5,
      startY: lineConfig.startY ?? width / 2,
      endX: lineConfig.endX ?? length - 0.5,
      endY: lineConfig.endY ?? width / 2,
      count: lineConfig.count ?? Math.max(1, rows * cols),
      isContinuous: lineConfig.isContinuous ?? false,
      fixtureLength: lineConfig.fixtureLength ?? 1.2,
      alignPerpendicular: lineConfig.alignPerpendicular ?? false,
    } : undefined,
    circularConfig: circularConfig ? {
      centerX: circularConfig.centerX ?? length / 2,
      centerY: circularConfig.centerY ?? width / 2,
      radius: circularConfig.radius ?? Math.min(length, width) * 0.35,
      count: circularConfig.count ?? Math.max(4, rows * cols),
      startAngleDeg: circularConfig.startAngleDeg ?? 0,
      sweepAngleDeg: circularConfig.sweepAngleDeg ?? 360,
      alignTangential: circularConfig.alignTangential ?? true,
    } : undefined,
    customLuminaires,
  };
}

/**
 * Tanner Helland's Algorithm: Converts Color Temperature (Kelvin) to RGB Hex.
 * e.g., 2700K = Warm White, 4000K = Neutral Commercial White, 6500K = Cool Daylight.
 */
export function kelvinToHex(kelvin: number): string {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let red = 0;
  let green = 0;
  let blue = 0;

  // Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = temp - 60;
    red = 329.698727446 * Math.pow(red, -0.1332047592);
    if (red < 0) red = 0;
    if (red > 255) red = 255;
  }

  // Green
  if (temp <= 66) {
    green = temp;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
    if (green < 0) green = 0;
    if (green > 255) green = 255;
  } else {
    green = temp - 60;
    green = 288.1221695283 * Math.pow(green, -0.0755148492);
    if (green < 0) green = 0;
    if (green > 255) green = 255;
  }

  // Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = temp - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    if (blue < 0) blue = 0;
    if (blue > 255) blue = 255;
  }

  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

/**
 * Generates DIALux evo STF (Standard Table Format) string for direct desktop export.
 */
export function generateDialuxSTFContent(params: {
  projectName: string;
  projectCode: string;
  roomName: string;
  length: number;
  width: number;
  height: number;
  workPlaneHeight: number;
  reflectances: SurfaceReflectances;
  profile: LuminairePhotometricProfile;
  luminaires: LuminaireInstance[];
}): string {
  const {
    projectName,
    roomName,
    length,
    width,
    height,
    workPlaneHeight,
    reflectances,
    profile,
    luminaires,
  } = params;

  let stf = "";
  stf += "[HEADER]\n";
  stf += "VERSION=1.0\n";
  stf += `GENERATOR=MEP DIALux Studio 3D\n`;
  stf += `DATE=${new Date().toISOString().slice(0, 10)}\n\n`;

  stf += "[PROJECT]\n";
  stf += `NAME=${projectName}\n\n`;

  stf += "[ROOM]\n";
  stf += `NAME=${roomName}\n`;
  stf += `HEIGHT=${height.toFixed(2)}\n`;
  stf += `WORKING_PLANE=${workPlaneHeight.toFixed(2)}\n`;
  stf += `RHO_CEILING=${Math.round(reflectances.ceiling * 100)}\n`;
  stf += `RHO_WALLS=${Math.round(reflectances.walls * 100)}\n`;
  stf += `RHO_FLOOR=${Math.round(reflectances.floor * 100)}\n\n`;

  stf += "[GEOMETRY]\n";
  stf += `POINT=0.00 0.00\n`;
  stf += `POINT=${length.toFixed(2)} 0.00\n`;
  stf += `POINT=${length.toFixed(2)} ${width.toFixed(2)}\n`;
  stf += `POINT=0.00 ${width.toFixed(2)}\n\n`;

  stf += "[LUMINAIRES]\n";
  stf += `TYPE=${profile.name}\n`;
  stf += `MANUFACTURER=${profile.manufacturer}\n`;
  stf += `TOTAL_LUMENS=${profile.totalLumens}\n`;
  stf += `WATTAGE=${profile.wattage}\n`;
  stf += `COUNT=${luminaires.length}\n`;

  luminaires.forEach((lum, idx) => {
    stf += `POS_${idx + 1}=${lum.x.toFixed(2)} ${lum.y.toFixed(2)} ${lum.z.toFixed(2)} ROT=0.0\n`;
  });

  return stf;
}

/**
 * Downloads a DIALux evo STF (Standard Table Format) file to client computer.
 */
export function downloadDialuxSTF(params: {
  projectName: string;
  projectCode: string;
  roomName: string;
  length: number;
  width: number;
  height: number;
  workPlaneHeight: number;
  reflectances: SurfaceReflectances;
  profile: LuminairePhotometricProfile;
  luminaires: LuminaireInstance[];
}) {
  const content = generateDialuxSTFContent(params);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${params.roomName.replace(/[^a-zA-Z0-9_-]/g, "_")}_DIALux.stf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts a lux value into a DIALux evo False-Color Heatmap RGB hex string.
 * Scale: Indigo (<100) -> Blue (200) -> Teal (300) -> Green (500) -> Yellow (750) -> Red (>1000)
 */
export function getFalseColorForLux(lux: number, targetLux: number = 500): string {
  // Normalize against target lux
  const factor = targetLux > 0 ? lux / targetLux : lux / 500;

  if (factor <= 0.2) return "#1e1b4b"; // Dark Indigo (<100 lx)
  if (factor <= 0.4) return "#1d4ed8"; // Blue (100-200 lx)
  if (factor <= 0.6) return "#0284c7"; // Sky Blue (200-300 lx)
  if (factor <= 0.8) return "#0d9488"; // Teal (300-400 lx)
  if (factor <= 1.0) return "#16a34a"; // Green (400-500 lx - Target Met)
  if (factor <= 1.3) return "#ca8a04"; // Yellow/Gold (500-650 lx)
  if (factor <= 1.6) return "#ea580c"; // Orange (650-800 lx)
  return "#dc2626"; // Crimson Red (>800 lx - Intense)
}

/**
 * Parses an ANSI/IES LM-63 (.ies) photometric file format into a luminaire profile.
 */
export function parseIESFile(content: string, fileName: string): LuminairePhotometricProfile {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let lumManufacturer = "Generic";
  let lumModel = fileName.replace(/\.ies$/i, "");
  let numLamps = 1;
  let lumensPerLamp = 3200;
  let multiplier = 1.0;
  let numVAngles = 10;
  let numHAngles = 1;
  let photType = 1; // 1 = Type C
  let wattage = 30;

  // 1. Parse header labels
  for (const line of lines) {
    if (line.startsWith("[MANUFAC]")) lumManufacturer = line.replace("[MANUFAC]", "").trim();
    if (line.startsWith("[LUMCAT]") || line.startsWith("[LUMINAIRE]")) lumModel = line.replace(/\[.*?\]/, "").trim();
  }

  // 2. Find TILT line
  let tiltIndex = lines.findIndex((l) => l.toUpperCase().includes("TILT="));
  if (tiltIndex === -1) tiltIndex = 0;

  // Line after TILT contains: NUM_LAMPS, LUMENS_PER_LAMP, MULTIPLIER, NUM_V_ANGLES, NUM_H_ANGLES, PHOT_TYPE, UNITS_TYPE, WIDTH, LENGTH, HEIGHT
  const dataTokens: number[] = [];
  for (let i = tiltIndex + 1; i < lines.length; i++) {
    const tokens = lines[i].split(/\s+/).map(Number).filter((n) => !isNaN(n));
    dataTokens.push(...tokens);
    if (dataTokens.length >= 13) break;
  }

  if (dataTokens.length >= 10) {
    numLamps = Math.max(1, dataTokens[0]);
    lumensPerLamp = Math.max(100, dataTokens[1]);
    multiplier = dataTokens[2] || 1.0;
    numVAngles = Math.max(2, dataTokens[3]);
    numHAngles = Math.max(1, dataTokens[4]);
    photType = dataTokens[5] || 1;
  }

  const totalLumens = Math.round(numLamps * lumensPerLamp * (multiplier > 0 ? multiplier : 1));

  // Extract vertical angles and candela values
  const allNumbers: number[] = [];
  for (let i = tiltIndex + 1; i < lines.length; i++) {
    const lineNumbers = lines[i].split(/\s+/).map(Number).filter((n) => !isNaN(n));
    allNumbers.push(...lineNumbers);
  }

  // Tokens starting after 13 parameters are: Ballast factor, Future use, Input watts, Angles..., Candela...
  wattage = allNumbers[12] && allNumbers[12] > 0 ? Math.round(allNumbers[12]) : 30;

  const vAngles: number[] = [];
  const candelaValues: number[] = [];

  const angleStartIndex = 13;
  for (let i = angleStartIndex; i < angleStartIndex + numVAngles && i < allNumbers.length; i++) {
    vAngles.push(allNumbers[i]);
  }

  const candelaStartIndex = angleStartIndex + numVAngles + numHAngles;
  for (let i = candelaStartIndex; i < candelaStartIndex + numVAngles && i < allNumbers.length; i++) {
    candelaValues.push(allNumbers[i] * multiplier);
  }

  // Default fallback curves if file truncated
  const finalVAngles = vAngles.length >= 2 ? vAngles : [0, 15, 30, 45, 60, 75, 90];
  const finalCandela = candelaValues.length >= 2 ? candelaValues : [400, 380, 320, 220, 110, 30, 0];

  // Determine nominal beam angle (angle where intensity drops to 50% of peak)
  const peakCd = Math.max(...finalCandela, 1);
  const halfPeak = peakCd * 0.5;
  let beamAngle = 90;
  for (let i = 0; i < finalCandela.length; i++) {
    if (finalCandela[i] <= halfPeak) {
      beamAngle = Math.round((finalVAngles[i] || 45) * 2);
      break;
    }
  }

  return {
    name: `${lumModel} (${beamAngle}°)`,
    manufacturer: lumManufacturer || "IES Luminaire",
    model: lumModel,
    totalLumens,
    wattage,
    beamAngle,
    c0Angles: finalVAngles,
    c0Candela: finalCandela,
    colorTemp: 4000,
    cri: 80,
    dimensions: { length: 0.6, width: 0.6, height: 0.05 },
  };
}

/**
 * Parses an EULUMDAT (.ldt) photometric file format into a luminaire profile.
 */
export function parseLDTFile(content: string, fileName: string): LuminairePhotometricProfile {
  const lines = content.split(/\r?\n/).map((l) => l.trim());

  const manufacturer = lines[0] || "LDT Luminaire";
  const lumModel = lines[8] || fileName.replace(/\.ldt$/i, "");

  // Dimensions in mm -> convert to meters
  const lengthM = (parseFloat(lines[12]) || 600) / 1000;
  const widthM = (parseFloat(lines[13]) || 600) / 1000;
  const heightM = (parseFloat(lines[14]) || 50) / 1000;

  let totalLumens = 3600;
  let wattage = 32;
  let colorTemp = 4000;
  let cri = 80;

  // Lamp details (flux, color temp, CRI, wattage)
  if (lines.length > 32) {
    const parsedLumens = parseFloat(lines[28]);
    if (!isNaN(parsedLumens) && parsedLumens > 100) totalLumens = Math.round(parsedLumens);
    const parsedCct = parseFloat(lines[29]);
    if (!isNaN(parsedCct) && parsedCct >= 2000 && parsedCct <= 10000) colorTemp = Math.round(parsedCct);
    const parsedCri = parseFloat(lines[30]);
    if (!isNaN(parsedCri) && parsedCri >= 50 && parsedCri <= 100) cri = Math.round(parsedCri);
    const parsedWatt = parseFloat(lines[31]);
    if (!isNaN(parsedWatt) && parsedWatt > 0 && parsedWatt < 5000) wattage = Math.round(parsedWatt);
  }

  const ng = parseInt(lines[5]) || 19;
  const dg = parseFloat(lines[6]) || 5;

  const c0Angles: number[] = [];
  for (let i = 0; i < Math.min(ng, 19); i++) {
    c0Angles.push(i * dg);
  }

  // Scan luminous intensity values
  const numbers: number[] = [];
  for (let i = 40; i < lines.length; i++) {
    const val = parseFloat(lines[i]);
    if (!isNaN(val)) numbers.push(val);
  }

  const c0Candela: number[] = [];
  for (let i = 0; i < c0Angles.length; i++) {
    if (numbers[i] !== undefined) {
      c0Candela.push(numbers[i]);
    } else {
      c0Candela.push(Math.max(0, 350 - i * 35));
    }
  }

  const peakCd = Math.max(...c0Candela, 1);
  const halfPeak = peakCd * 0.5;
  let beamAngle = 90;
  for (let i = 0; i < c0Candela.length; i++) {
    if (c0Candela[i] <= halfPeak) {
      beamAngle = Math.round((c0Angles[i] || 45) * 2);
      break;
    }
  }

  return {
    name: `${lumModel} (${beamAngle}°)`,
    manufacturer: manufacturer || "EULUMDAT Luminaire",
    model: lumModel,
    totalLumens,
    wattage,
    beamAngle,
    c0Angles,
    c0Candela,
    colorTemp,
    cri,
    dimensions: {
      length: lengthM > 0 ? lengthM : 0.6,
      width: widthM > 0 ? widthM : 0.6,
      height: heightM > 0 ? heightM : 0.05,
    },
  };
}

/**
 * Universal Photometric File Parser: automatically detects .ies (ANSI/IES LM-63) or .ldt (EULUMDAT).
 */
export function parsePhotometricFile(content: string, fileName: string): LuminairePhotometricProfile {
  const isLdt = fileName.toLowerCase().endsWith(".ldt") || (!content.includes("IESNA") && !content.includes("TILT="));
  if (isLdt) {
    try {
      return parseLDTFile(content, fileName);
    } catch {
      return parseIESFile(content, fileName);
    }
  }
  return parseIESFile(content, fileName);
}

/**
 * Calculates Solar Azimuth and Altitude (Elevation) based on geographic coordinates, date, and hour.
 * Standard Spencer / NOAA Solar Position Algorithm used in DIALux evo Daylight systems.
 */
export function calculateSunPosition(
  latitude: number = 51.5,
  longitude: number = 0.0,
  date: Date = new Date()
): { azimuth: number; altitude: number; solarNoon: string } {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  const hours = date.getHours() + date.getMinutes() / 60;
  
  // Declination (Spencer formula)
  const b = (2 * Math.PI * (dayOfYear - 81)) / 365;
  const declination = 23.45 * Math.sin(b);
  const declRad = (declination * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;

  // Hour angle (H)
  const hourAngle = (hours - 12) * 15;
  const hRad = (hourAngle * Math.PI) / 180;

  // Solar Altitude (alpha)
  const sinAlt = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitude = Math.max(0, Number(((altitudeRad * 180) / Math.PI).toFixed(1)));

  // Solar Azimuth (gamma)
  const cosAz = (Math.sin(declRad) - Math.sin(latRad) * Math.sin(altitudeRad)) / (Math.cos(latRad) * Math.cos(altitudeRad) || 0.001);
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (hourAngle > 0) azRad = 2 * Math.PI - azRad;
  const azimuth = Number(((azRad * 180) / Math.PI).toFixed(1));

  return { azimuth, altitude, solarNoon: "12:00" };
}

/**
 * Calculates CIE Overcast Sky Daylight Factor (DF %) and daylight contribution on the workplane.
 * Formula (CIE / BREEAM / EN 17037):
 * DF = (Glass Area / Total Room Surface Area) * (Glass Transmittance tau) * theta_sky / (1 - R_avg)
 */
export function calculateDaylightFactor(params: {
  length: number;
  width: number;
  height: number;
  windowCount: number;
  windowWidth: number;
  windowHeight: number;
  windowSill?: number;
  glassTransmittance?: number; // default 0.75 for double glazing
  reflectances?: SurfaceReflectances;
}): {
  avgDaylightFactor: number;
  minDaylightFactor: number;
  isCompliant: boolean; // BREEAM / EN 17037 requires DF >= 2.0%
  exteriorLux: number; // 10,000 lx for standard CIE overcast sky
  avgDaylightLux: number;
} {
  const {
    length,
    width,
    height,
    windowCount,
    windowWidth,
    windowHeight,
    glassTransmittance = 0.75,
    reflectances = { ceiling: 0.7, walls: 0.5, floor: 0.2 },
  } = params;

  if (windowCount <= 0 || windowWidth <= 0 || windowHeight <= 0) {
    return {
      avgDaylightFactor: 0,
      minDaylightFactor: 0,
      isCompliant: false,
      exteriorLux: 10000,
      avgDaylightLux: 0,
    };
  }

  const floorArea = length * width;
  const totalGlazingArea = windowCount * windowWidth * windowHeight;
  const totalSurfaceArea = 2 * (length * width + length * height + width * height);

  // Area-weighted average reflectance
  const rAvg = (floorArea * reflectances.floor + floorArea * reflectances.ceiling + 2 * (length + width) * height * reflectances.walls) / totalSurfaceArea;

  // Window factor (visible sky angle approx 45 degrees for standard urban horizon)
  const skyAngleDeg = 45;
  const skyFactor = skyAngleDeg / 90;

  // Daylight Factor (BRE / CIBSE formula)
  const denom = Math.max(0.1, totalSurfaceArea * (1 - rAvg));
  const rawDf = ((totalGlazingArea * glassTransmittance * skyFactor) / denom) * 100 * 2.8;
  const avgDaylightFactor = Number(Math.min(15.0, Math.max(0.1, rawDf)).toFixed(2));
  const minDaylightFactor = Number(Math.max(0.05, avgDaylightFactor * 0.42).toFixed(2));

  const exteriorLux = 10000; // CIE Standard Overcast Sky
  const avgDaylightLux = Math.round((avgDaylightFactor / 100) * exteriorLux);
  const isCompliant = avgDaylightFactor >= 2.0;

  return {
    avgDaylightFactor,
    minDaylightFactor,
    isCompliant,
    exteriorLux,
    avgDaylightLux,
  };
}

/**
 * Evaluates Emergency Lighting according to EN 1838 standard:
 * 1. Escape Routes (width 1.0m): E_min >= 1.0 lx, Uniformity U_d = E_min / E_max >= 1:40 (0.025)
 * 2. Anti-Panic Open Areas: E_min >= 0.5 lx, Uniformity U_d >= 1:20 (0.05)
 */
export function calculateEmergencyLighting(params: {
  points: PhotometricPoint[];
  length: number;
  width: number;
  emergencyFactor: number; // e.g. 0.10 for 10% emergency battery scene
}): {
  escapeRouteMinLux: number;
  escapeRouteMaxLux: number;
  escapeRouteAvgLux: number;
  escapeRouteUniformity: number;
  isEscapeRouteCompliant: boolean;
  antiPanicMinLux: number;
  isAntiPanicCompliant: boolean;
} {
  const { points, length, width, emergencyFactor = 0.10 } = params;
  if (!points || points.length === 0) {
    return {
      escapeRouteMinLux: 0,
      escapeRouteMaxLux: 0,
      escapeRouteAvgLux: 0,
      escapeRouteUniformity: 0,
      isEscapeRouteCompliant: false,
      antiPanicMinLux: 0,
      isAntiPanicCompliant: false,
    };
  }

  // Central 1.0m corridor along length (escape route)
  const midY = width / 2;
  const escapeRoutePoints = points.filter((p) => Math.abs(p.y - midY) <= 0.50);
  const pts = escapeRoutePoints.length > 0 ? escapeRoutePoints : points;

  let sum = 0;
  let minL = Infinity;
  let maxL = -Infinity;

  pts.forEach((p) => {
    const emergLux = Math.max(0.1, Number((p.lux * emergencyFactor).toFixed(1)));
    sum += emergLux;
    if (emergLux < minL) minL = emergLux;
    if (emergLux > maxL) maxL = emergLux;
  });

  const avgL = Number((sum / pts.length).toFixed(1));
  const uniformity = maxL > 0 ? Number((minL / maxL).toFixed(3)) : 0;

  // Global anti-panic min lux
  let globalMin = Infinity;
  points.forEach((p) => {
    const emL = p.lux * emergencyFactor;
    if (emL < globalMin) globalMin = emL;
  });
  const antiPanicMin = Number(globalMin.toFixed(1));

  return {
    escapeRouteMinLux: minL,
    escapeRouteMaxLux: maxL,
    escapeRouteAvgLux: avgL,
    escapeRouteUniformity: uniformity,
    isEscapeRouteCompliant: minL >= 1.0 && uniformity >= 0.025,
    antiPanicMinLux: antiPanicMin,
    isAntiPanicCompliant: antiPanicMin >= 0.5,
  };
}

/**
 * Detailed CIE 97 / DIN 5035 Maintenance Factor Wizard:
 * MF = LLMF * LSF * LMF * RSMF
 */
export function calculateCIE97MaintenanceFactor(params: {
  environment: "clean" | "normal" | "dusty";
  cleaningIntervalYears: 1 | 2 | 3;
}): {
  mf: number;
  llmf: number; // Lamp Lumen Maintenance Factor
  lsf: number;  // Lamp Survival Factor
  lmf: number;  // Luminaire Maintenance Factor
  rsmf: number; // Room Surface Maintenance Factor
  categoryDescription: string;
} {
  const { environment, cleaningIntervalYears } = params;

  // LED standard rated life (L80B10 @ 50,000 hrs -> LLMF = 0.90, LSF = 1.00)
  const llmf = 0.90;
  const lsf = 1.00;

  let lmf = 0.92;
  let rsmf = 0.96;

  if (environment === "clean") {
    lmf = cleaningIntervalYears === 1 ? 0.95 : cleaningIntervalYears === 2 ? 0.91 : 0.88;
    rsmf = cleaningIntervalYears === 1 ? 0.98 : cleaningIntervalYears === 2 ? 0.95 : 0.92;
  } else if (environment === "normal") {
    lmf = cleaningIntervalYears === 1 ? 0.89 : cleaningIntervalYears === 2 ? 0.84 : 0.80;
    rsmf = cleaningIntervalYears === 1 ? 0.95 : cleaningIntervalYears === 2 ? 0.90 : 0.86;
  } else {
    // dusty / industrial
    lmf = cleaningIntervalYears === 1 ? 0.82 : cleaningIntervalYears === 2 ? 0.74 : 0.67;
    rsmf = cleaningIntervalYears === 1 ? 0.90 : cleaningIntervalYears === 2 ? 0.84 : 0.78;
  }

  const mf = Number((llmf * lsf * lmf * rsmf).toFixed(2));
  const categoryDescription = `${environment.toUpperCase()} Environment with ${cleaningIntervalYears}-Year Cleaning Interval`;

  return { mf, llmf, lsf, lmf, rsmf, categoryDescription };
}

// =========================================================================
// DIALUX EVO TUTORIAL PART 7: RAYTRACER & HDR IMAGING ENGINE
// =========================================================================

export interface RaytracerResolutionPreset {
  id: "draft" | "medium" | "high" | "2k" | "4k" | "custom";
  label: string;
  width: number;
  height: number;
  description: string;
}

export const RAYTRACER_PRESETS: RaytracerResolutionPreset[] = [
  { id: "draft", label: "Draft (640 × 480)", width: 640, height: 480, description: "Fast preview test calculation" },
  { id: "medium", label: "HD (1280 × 720)", width: 1280, height: 720, description: "Standard screen preview" },
  { id: "high", label: "Full HD (1920 × 1080)", width: 1920, height: 1080, description: "Client presentation standard" },
  { id: "2k", label: "2K QHD (2560 × 1440)", width: 2560, height: 1440, description: "High-resolution brochure render" },
  { id: "4k", label: "4K UHD (3840 × 2160)", width: 3840, height: 2160, description: "Ultra-sharp architectural master" },
];

export interface RaytracerConfig {
  preset: "draft" | "medium" | "high" | "2k" | "4k" | "custom";
  width: number;
  height: number;
  aspectRatio: "16:9" | "4:3" | "1:1" | "custom";
  enableMirrorReflections: boolean; // Iconic red sphere on mirror surface feature
  mirrorReflectance: number;        // 0.0 - 1.0 (e.g. 0.85 for polished mirrors)
  enableTransparency: boolean;      // Glass windows, doors, diffusers
  glassRefractiveIndex: number;     // e.g. 1.52 (Crown glass)
  enableSoftShadows: boolean;       // Penumbra soft shadows from area luminaires
  shadowSamples: number;            // 16, 32, 64 samples
  enableIndirectBounces: boolean;   // Diffuse radiosity secondary inter-reflections
  radiosityBounces: number;         // 1, 2, 3 bounces
  enableHdr: boolean;               // High Dynamic Range capture (.exr / .hdr)
  antiAliasing: "1x" | "4x" | "8x" | "16x";
  exposureEv: number;               // Post-process exposure (-3.0 to +3.0 EV)
  toneMapping: "reinhard" | "aces" | "linear";
  title: string;
  description: string;
}

export interface RenderedRaytraceImage {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  width: number;
  height: number;
  dataUrl: string;
  originalDataUrl?: string; // Un-adjusted base render for EV slider
  isHdr: boolean;
  exposureEv: number;
  toneMapping: "reinhard" | "aces" | "linear";
  cameraInfo?: {
    posX: number;
    posY: number;
    posZ: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    fov: number;
  };
  roomName: string;
  fileSizeBytes: number;
}

/**
 * Creates an authentic Radiance RGBE (*.hdr) file binary Blob.
 * Directly compliant with Radiance, Photoshop, Blender, and DIALux HDR image workflows.
 */
export function generateRadianceHdrBlob(
  width: number,
  height: number,
  imageData: ImageData
): Blob {
  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0000000000000\nSOFTWARE=DIALux evo Raytracer Studio\n\n-Y ${height} +X ${width}\n`;
  const headerBytes = new TextEncoder().encode(header);

  // Uncompressed RGBE: 4 bytes per pixel (R, G, B, E)
  const pixelCount = width * height;
  const rgbeBuffer = new Uint8Array(pixelCount * 4);
  const src = imageData.data;

  for (let i = 0; i < pixelCount; i++) {
    const r = src[i * 4] / 255.0;
    const g = src[i * 4 + 1] / 255.0;
    const b = src[i * 4 + 2] / 255.0;
    const maxVal = Math.max(r, g, b);

    if (maxVal < 1e-32) {
      rgbeBuffer[i * 4] = 0;
      rgbeBuffer[i * 4 + 1] = 0;
      rgbeBuffer[i * 4 + 2] = 0;
      rgbeBuffer[i * 4 + 3] = 0;
    } else {
      // Decompose into mantissa and exponent
      const exp = Math.ceil(Math.log2(maxVal));
      const factor = Math.pow(2, -exp) * 255.0;
      rgbeBuffer[i * 4] = Math.min(255, Math.floor(r * factor));
      rgbeBuffer[i * 4 + 1] = Math.min(255, Math.floor(g * factor));
      rgbeBuffer[i * 4 + 2] = Math.min(255, Math.floor(b * factor));
      rgbeBuffer[i * 4 + 3] = Math.min(255, Math.max(0, exp + 128));
    }
  }

  return new Blob([headerBytes, rgbeBuffer], { type: "image/vnd.radiance" });
}

/**
 * Adjusts exposure and applies tone mapping to an ImageData buffer in-place.
 * Enables live +/- EV slider adjustments in DIALux evo Images viewer.
 */
export function applyHdrExposureAndToneMapping(
  srcData: Uint8ClampedArray,
  dstData: Uint8ClampedArray,
  exposureEv: number,
  toneMapping: "reinhard" | "aces" | "linear" = "aces"
): void {
  const multiplier = Math.pow(2, exposureEv);
  const len = srcData.length;

  for (let i = 0; i < len; i += 4) {
    let r = (srcData[i] / 255.0) * multiplier;
    let g = (srcData[i + 1] / 255.0) * multiplier;
    let b = (srcData[i + 2] / 255.0) * multiplier;

    if (toneMapping === "reinhard") {
      r = r / (1.0 + r);
      g = g / (1.0 + g);
      b = b / (1.0 + b);
    } else if (toneMapping === "aces") {
      // ACES Filmic curve
      const tonemapAces = (x: number) => {
        const a = 2.51, bv = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return Math.max(0, Math.min(1, (x * (a * x + bv)) / (x * (c * x + d) + e)));
      };
      r = tonemapAces(r);
      g = tonemapAces(g);
      b = tonemapAces(b);
    } else {
      r = Math.min(1, r);
      g = Math.min(1, g);
      b = Math.min(1, b);
    }

    dstData[i] = Math.floor(r * 255);
    dstData[i + 1] = Math.floor(g * 255);
    dstData[i + 2] = Math.floor(b * 255);
    dstData[i + 3] = srcData[i + 3]; // Preserve alpha
  }
}

