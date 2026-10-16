/**
 * =========================================================================
 * DIALUX EVO INTERIOR & EXTERIOR WORKPLANE ENGINE (TUTORIAL PART 25)
 * =========================================================================
 * 
 * Implements the complete Interior & Exterior Workplane Management System
 * from DIALux evo Tutorial Part 25:
 * 
 * 1. WORKPLANE DOMAIN SEPARATION:
 *    - Interior Workplanes (Nutzebenen):
 *      * Automatic room generation or IFC import toggle
 *      * Height offset (e.g. 0.80m desk, 0.75m standard, 0.00m floor corridor)
 *      * Wall margin zone (Randzone, e.g. 0.50m) excluded per EN 12464-1
 *      * Task Area (Bereich der Sehaufgabe) vs Immediate Surrounding Area
 *    - Exterior Workplanes (Bewertungsobjekte / Bewertungsflächen):
 *      * Manual creation requirement (rectangles or polygons)
 *      * Ground level (0.00m) or elevated (loading docks, ramps)
 *      * EN 12464-2 profiles (Parking, Walkways, Loading Bays, Security)
 * 
 * 2. STANDARDS & PROFILES:
 *    - EN 12464-1 (Indoor workplaces):
 *      * Target maintained illuminance E_m (lux)
 *      * Uniformity U_0 = E_min / E_avg
 *      * Glare limit UGR_L & Color rendering Ra
 *    - EN 12464-2 (Outdoor workplaces):
 *      * Parking areas (10 lx - 50 lx, U0 >= 0.40)
 *      * Walkways (5 lx - 15 lx)
 *      * Loading bays & cargo handling (50 lx, U0 >= 0.40)
 *      * Fuel stations & gatehouses (150 lx - 300 lx)
 * 
 * 3. GRID GENERATION (CIE / EN 12464 FORMULA):
 *    - Grid point spacing: p = 0.2 * 5^(log10(d))
 *    - Horizontal Eh, Vertical Ev, or Cylindrical Ez illuminance
 */

export type WorkplaneEnvironmentType = "interior" | "exterior";

export type WorkplaneGeometryType = "rectangular" | "polygonal";

export type CalculationMetricType =
  | "horizontal_eh"
  | "vertical_ev"
  | "cylindrical_ez"
  | "semi_cylindrical";

export interface WorkplaneProfile {
  id: string;
  name: string;
  standard: "EN 12464-1" | "EN 12464-2";
  environment: WorkplaneEnvironmentType;
  targetMaintainedLux: number;
  minUniformityU0: number;
  maxUgrOrGr: number;
  minCRI: number;
  defaultHeightM: number;
  defaultMarginM: number;
  description: string;
}

export const WORKPLANE_PROFILES: Record<string, WorkplaneProfile> = {
  // INTERIOR PROFILES (EN 12464-1)
  "office_general": {
    id: "office_general",
    name: "Offices — Writing, typing, reading data (EN 12464-1)",
    standard: "EN 12464-1",
    environment: "interior",
    targetMaintainedLux: 500,
    minUniformityU0: 0.60,
    maxUgrOrGr: 19,
    minCRI: 80,
    defaultHeightM: 0.80,
    defaultMarginM: 0.50,
    description: "Standard commercial office desk height with 0.5m wall boundary exclusion.",
  },
  "conference_meeting": {
    id: "conference_meeting",
    name: "Conference & Meeting Rooms (EN 12464-1)",
    standard: "EN 12464-1",
    environment: "interior",
    targetMaintainedLux: 500,
    minUniformityU0: 0.60,
    maxUgrOrGr: 19,
    minCRI: 80,
    defaultHeightM: 0.75,
    defaultMarginM: 0.50,
    description: "Conference table plane with controlled facial recognition.",
  },
  "corridor_traffic": {
    id: "corridor_traffic",
    name: "Corridors & Circulation Areas (EN 12464-1)",
    standard: "EN 12464-1",
    environment: "interior",
    targetMaintainedLux: 100,
    minUniformityU0: 0.40,
    maxUgrOrGr: 28,
    minCRI: 40,
    defaultHeightM: 0.00,
    defaultMarginM: 0.20,
    description: "Floor level circulation with safety movement illumination.",
  },
  "classroom_education": {
    id: "classroom_education",
    name: "Educational Classrooms & Auditoriums (EN 12464-1)",
    standard: "EN 12464-1",
    environment: "interior",
    targetMaintainedLux: 500,
    minUniformityU0: 0.60,
    maxUgrOrGr: 19,
    minCRI: 80,
    defaultHeightM: 0.75,
    defaultMarginM: 0.50,
    description: "Student desks working plane with low glare.",
  },

  // EXTERIOR PROFILES (EN 12464-2)
  "parking_regular": {
    id: "parking_regular",
    name: "Parking Areas — Medium Traffic (EN 12464-2)",
    standard: "EN 12464-2",
    environment: "exterior",
    targetMaintainedLux: 20,
    minUniformityU0: 0.40,
    maxUgrOrGr: 50,
    minCRI: 20,
    defaultHeightM: 0.00,
    defaultMarginM: 0.00,
    description: "Commercial building employee and visitor outdoor car park.",
  },
  "parking_busy": {
    id: "parking_busy",
    name: "Parking Areas — Busy / Shopping Center (EN 12464-2)",
    standard: "EN 12464-2",
    environment: "exterior",
    targetMaintainedLux: 50,
    minUniformityU0: 0.40,
    maxUgrOrGr: 50,
    minCRI: 40,
    defaultHeightM: 0.00,
    defaultMarginM: 0.00,
    description: "High pedestrian and vehicular interaction area.",
  },
  "pedestrian_walkway": {
    id: "pedestrian_walkway",
    name: "Pedestrian Walkways & Entrance Plaza (EN 12464-2)",
    standard: "EN 12464-2",
    environment: "exterior",
    targetMaintainedLux: 15,
    minUniformityU0: 0.35,
    maxUgrOrGr: 50,
    minCRI: 40,
    defaultHeightM: 0.00,
    defaultMarginM: 0.00,
    description: "Safe pathway access between parking, grounds, and building entrance.",
  },
  "loading_bay_cargo": {
    id: "loading_bay_cargo",
    name: "Loading Bays & Logistics Cargo Handling (EN 12464-2)",
    standard: "EN 12464-2",
    environment: "exterior",
    targetMaintainedLux: 50,
    minUniformityU0: 0.40,
    maxUgrOrGr: 50,
    minCRI: 20,
    defaultHeightM: 1.00,
    defaultMarginM: 0.00,
    description: "Elevated loading ramp and truck dock workplane.",
  },
  "security_checkpoint": {
    id: "security_checkpoint",
    name: "Security Gatehouse & Checkpoints (EN 12464-2)",
    standard: "EN 12464-2",
    environment: "exterior",
    targetMaintainedLux: 150,
    minUniformityU0: 0.40,
    maxUgrOrGr: 45,
    minCRI: 60,
    defaultHeightM: 1.00,
    defaultMarginM: 0.00,
    description: "Vehicle inspection and driver identification area.",
  },
};

export interface WorkplanePoint {
  x: number;
  y: number;
  z: number;
  lux: number;
  isInsideMargin: boolean; // true if within active calculation zone (outside wall margin)
}

export interface WorkplaneItem {
  id: string;
  name: string;
  environment: WorkplaneEnvironmentType;
  geometryType: WorkplaneGeometryType;
  profileId: string;
  position: { x: number; y: number; z: number }; // center coordinates
  widthM: number;
  lengthM: number;
  heightOffsetM: number; // Z-elevation
  wallMarginM: number; // Randzone exclusion width
  gridStepM: number; // point spacing
  calculationMetric: CalculationMetricType;
  isEnabled: boolean;
  colorHex: string;
}

export interface WorkplaneCalculationResult {
  workplaneId: string;
  averageLux: number;
  minLux: number;
  maxLux: number;
  uniformityU0: number; // E_min / E_avg
  uniformityU1: number; // E_min / E_max
  activePointsCount: number;
  totalPointsCount: number;
  gridPoints: WorkplanePoint[];
  isTargetLuxMet: boolean;
  isUniformityMet: boolean;
  isCompliant: boolean;
}

export interface WorkplaneStudioState {
  autoCreateInteriorWorkplanes: boolean;
  workplanes: WorkplaneItem[];
  selectedWorkplaneId: string;
}

// =========================================================================
// 2. MATHEMATICAL CALCULATION FUNCTIONS
// =========================================================================

/**
 * Calculates optimal point grid spacing according to EN 12464-1 & CIE formula:
 * p = 0.2 * 5^(log10(d))
 * where d is the longer dimension of the area.
 */
export function calculateEN12464GridStep(dimensionMeters: number): number {
  const d = Math.max(1, dimensionMeters);
  const logD = Math.log10(d);
  const p = 0.2 * Math.pow(5, logD);
  return Math.max(0.2, Math.min(2.0, Math.round(p * 100) / 100));
}

/**
 * Solves point-by-point grid values for an interior or exterior workplane.
 */
export function solveWorkplanePhotometrics(
  wp: WorkplaneItem
): WorkplaneCalculationResult {
  const profile = WORKPLANE_PROFILES[wp.profileId] || WORKPLANE_PROFILES["office_general"];

  // Grid sizing based on EN 12464
  const longDim = Math.max(wp.lengthM, wp.widthM);
  const step = wp.gridStepM || calculateEN12464GridStep(longDim);

  const cols = Math.max(4, Math.round(wp.lengthM / step));
  const rows = Math.max(4, Math.round(wp.widthM / step));

  const halfL = wp.lengthM / 2;
  const halfW = wp.widthM / 2;
  const margin = wp.wallMarginM;

  const points: WorkplanePoint[] = [];
  const activeLuxValues: number[] = [];

  // Simulated luminaire layout contribution
  // In interior rooms: downlights create smooth curve with peak in center
  // In exterior parking/walkways: pole floodlights create radial bell-curves
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const localX = -halfL + ((c + 0.5) / cols) * wp.lengthM;
      const localY = -halfW + ((r + 0.5) / rows) * wp.widthM;
      const worldX = wp.position.x + localX;
      const worldY = wp.position.y + localY;
      const worldZ = wp.position.z + wp.heightOffsetM;

      // Check if point is inside margin exclusion (Randzone)
      const distFromEdgeX = halfL - Math.abs(localX);
      const distFromEdgeY = halfW - Math.abs(localY);
      const isInsideMargin = distFromEdgeX >= margin && distFromEdgeY >= margin;

      let pointLux = 0;

      if (wp.environment === "interior") {
        // Interior office ceiling array simulation (target ~500 lux)
        const centerFactor = 1.0 - (Math.pow(localX / halfL, 2) + Math.pow(localY / halfW, 2)) * 0.35;
        const baseTarget = profile.targetMaintainedLux * 1.08;
        pointLux = Math.max(80, baseTarget * centerFactor);
      } else {
        // Exterior pole floodlights (target ~20-50 lux)
        // Two lighting poles on long edges
        const pole1Dist = Math.hypot(localX - halfL * 0.5, localY - halfW);
        const pole2Dist = Math.hypot(localX + halfL * 0.5, localY + halfW);
        const intensity1 = (profile.targetMaintainedLux * 14) / (Math.pow(pole1Dist + 4, 1.4));
        const intensity2 = (profile.targetMaintainedLux * 14) / (Math.pow(pole2Dist + 4, 1.4));
        pointLux = Math.max(5, intensity1 + intensity2);
      }

      const roundedLux = Math.round(pointLux * 10) / 10;
      points.push({
        x: Math.round(worldX * 100) / 100,
        y: Math.round(worldY * 100) / 100,
        z: Math.round(worldZ * 100) / 100,
        lux: roundedLux,
        isInsideMargin,
      });

      if (isInsideMargin) {
        activeLuxValues.push(roundedLux);
      }
    }
  }

  const valuesToEvaluate = activeLuxValues.length > 0 ? activeLuxValues : points.map((p) => p.lux);
  const avgLux = valuesToEvaluate.reduce((a, b) => a + b, 0) / valuesToEvaluate.length;
  const minLux = Math.min(...valuesToEvaluate);
  const maxLux = Math.max(...valuesToEvaluate);

  const u0 = avgLux > 0 ? minLux / avgLux : 0;
  const u1 = maxLux > 0 ? minLux / maxLux : 0;

  const isTargetLuxMet = avgLux >= profile.targetMaintainedLux;
  const isUniformityMet = u0 >= profile.minUniformityU0;
  const isCompliant = isTargetLuxMet && isUniformityMet;

  return {
    workplaneId: wp.id,
    averageLux: Math.round(avgLux),
    minLux: Math.round(minLux),
    maxLux: Math.round(maxLux),
    uniformityU0: Math.round(u0 * 100) / 100,
    uniformityU1: Math.round(u1 * 100) / 100,
    activePointsCount: valuesToEvaluate.length,
    totalPointsCount: points.length,
    gridPoints: points,
    isTargetLuxMet,
    isUniformityMet,
    isCompliant,
  };
}

// =========================================================================
// 3. DEFAULT PRESETS FOR TUTORIAL 25
// =========================================================================

export const DEFAULT_WORKPLANES: WorkplaneItem[] = [
  // INTERIOR 1: OPEN OFFICE DESK WORKPLANE (Auto-generated room plane)
  {
    id: "wp_int_office",
    name: "Open Plan Office — Workstation Working Plane",
    environment: "interior",
    geometryType: "rectangular",
    profileId: "office_general",
    position: { x: 5.0, y: 4.0, z: 0.0 },
    widthM: 8.0,
    lengthM: 10.0,
    heightOffsetM: 0.80, // 0.80m desk height
    wallMarginM: 0.50, // 0.50m margin exclusion
    gridStepM: 0.75,
    calculationMetric: "horizontal_eh",
    isEnabled: true,
    colorHex: "#38bdf8",
  },

  // INTERIOR 2: CORRIDOR CIRCULATION FLOOR PLANE
  {
    id: "wp_int_corridor",
    name: "Central Circulation Corridor (Floor Plane)",
    environment: "interior",
    geometryType: "rectangular",
    profileId: "corridor_traffic",
    position: { x: 5.0, y: -1.5, z: 0.0 },
    widthM: 2.2,
    lengthM: 10.0,
    heightOffsetM: 0.00, // 0.00m floor level
    wallMarginM: 0.20,
    gridStepM: 0.50,
    calculationMetric: "horizontal_eh",
    isEnabled: true,
    colorHex: "#a855f7",
  },

  // EXTERIOR 1: VISITOR PARKING LOT (Manually created exterior zone)
  {
    id: "wp_ext_parking",
    name: "Visitor Car Park — Outdoor Assessment Zone",
    environment: "exterior",
    geometryType: "rectangular",
    profileId: "parking_regular",
    position: { x: -8.0, y: 6.0, z: 0.0 },
    widthM: 14.0,
    lengthM: 18.0,
    heightOffsetM: 0.00, // Ground level
    wallMarginM: 0.00,
    gridStepM: 1.50,
    calculationMetric: "horizontal_eh",
    isEnabled: true,
    colorHex: "#10b981",
  },

  // EXTERIOR 2: MAIN BUILDING ENTRANCE PLAZA & WALKWAY
  {
    id: "wp_ext_plaza",
    name: "Building Entrance Plaza & Pedestrian Walkway",
    environment: "exterior",
    geometryType: "rectangular",
    profileId: "pedestrian_walkway",
    position: { x: -4.0, y: -2.0, z: 0.0 },
    widthM: 5.0,
    lengthM: 8.0,
    heightOffsetM: 0.00,
    wallMarginM: 0.00,
    gridStepM: 0.80,
    calculationMetric: "horizontal_eh",
    isEnabled: true,
    colorHex: "#f59e0b",
  },

  // EXTERIOR 3: LOGISTICS LOADING BAY DOCK
  {
    id: "wp_ext_loading",
    name: "Rear Logistics Loading Bay & Ramp",
    environment: "exterior",
    geometryType: "rectangular",
    profileId: "loading_bay_cargo",
    position: { x: 14.0, y: 4.0, z: 0.0 },
    widthM: 6.0,
    lengthM: 8.0,
    heightOffsetM: 1.00, // Elevated ramp dock height
    wallMarginM: 0.00,
    gridStepM: 0.80,
    calculationMetric: "horizontal_eh",
    isEnabled: true,
    colorHex: "#ef4444",
  },
];
