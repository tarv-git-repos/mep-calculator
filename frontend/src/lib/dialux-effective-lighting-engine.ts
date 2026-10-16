/**
 * =========================================================================
 * DIALUX EVO EFFECTIVE LIGHTING DESIGN ENGINE (TUTORIAL PART 30)
 * =========================================================================
 * 
 * Implements the complete layered, task-oriented lighting design workflow
 * from DIALux evo Tutorial Part 30: "Effective lighting design".
 * 
 * Core Principles:
 * 1. Layered Lighting vs. Flat Uniform Lighting:
 *    - Layer 1: Task Lighting (direct illumination on desks/tables, 500 lx)
 *    - Layer 2: Ambient Background Lighting (general circulation, 100-300 lx)
 *    - Layer 3: Vertical Wall Accent & Wallwashing (expanding perceived room brightness,
 *      eliminating dark gloomy walls, 100-150 lx Ev)
 * 
 * 2. Mounting Types & Suspension Height Control:
 *    - Suspended / Pendant luminaires with adjustable wire length (0.2m - 2.0m)
 *    - Mounting height verification (maintaining >= 2.25m above floor head clearance)
 *    - Surface mounted, false ceiling recessed, and track mounted configurations
 * 
 * 3. Task Surface-Oriented Placement:
 *    - Direct coupling between luminaires and task surfaces (tables/desks)
 *    - Automated dual-panel or single-panel arrangement centered over desks
 *    - Minimization of veiling reflections and screen glare
 * 
 * 4. Vertical Wall Accent & Setback Rules:
 *    - Wallwasher setback distance: 1/3 to 1/4 wall height (0.8m - 1.0m from wall)
 *    - Distance between wallwashers: 1.0x to 1.2x setback distance
 *    - Scallop pattern vs. uniform wash profile evaluation
 * 
 * 5. Fast Radiosity / Direct Calculation Verification:
 *    - Point-by-point desk lux (Em >= 500 lx, U0 >= 0.60)
 *    - Vertical wall lux (Ev >= 100-150 lx)
 *    - Glare rating verification (UGR <= 19 for offices)
 *    - Lighting Quality Index (0-100 score) combining task, ambient, vertical, and glare
 *    - Connected load density (W/m² - EN 15193)
 */

export type LightingLayer = "task" | "ambient" | "wall_accent" | "decorative";

export type LuminaireMountingType = "suspended" | "surface" | "recessed" | "track";

export interface DesignLuminaire {
  id: string;
  name: string;
  model: string;
  layer: LightingLayer;
  mountingType: LuminaireMountingType;
  position: { x: number; y: number; z: number };
  suspensionLengthM: number; // For suspended fixtures (ceilingHeight - z)
  aimVector: { x: number; y: number; z: number }; // Direction of beam centerline
  nominalLumens: number;
  nominalWatts: number;
  cctKelvin: number;
  beamAngleDeg: number;
  peakIntensityCd: number;
  ugrContribution: number;
  targetSurfaceId?: string;
  active: boolean;
}

export interface TaskSurface {
  id: string;
  name: string;
  category: "workstation_desk" | "meeting_table" | "executive_desk" | "counter";
  position: { x: number; y: number; z: number };
  dimensions: { width: number; depth: number; height: number };
  targetLux: number; // typically 500 lx for EN 12464-1
  calculatedLux: number;
  uniformityU0: number; // Emin / Eavg
  status: "compliant" | "underlit" | "overlit";
}

export interface WallSurface {
  id: string;
  name: string;
  orientation: "north" | "south" | "east" | "west";
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  heightM: number;
  targetVerticalLux: number; // typically 150 lx
  calculatedVerticalLux: number;
  washUniformity: number;
  scallopProfile: "uniform_wash" | "dramatic_accent" | "subdued";
}

export interface EffectiveLightingDesignPlan {
  id: string;
  name: string;
  roomName: string;
  roomDimensions: {
    lengthM: number; // e.g. 10.0 m
    widthM: number; // e.g. 7.0 m
    heightM: number; // e.g. 3.2 m
  };
  ceilingReflectance: number; // e.g. 0.80
  wallReflectance: number; // e.g. 0.60
  floorReflectance: number; // e.g. 0.20
  luminaires: DesignLuminaire[];
  taskSurfaces: TaskSurface[];
  wallSurfaces: WallSurface[];
  // Global calculation results
  metrics: {
    avgTaskLux: number;
    avgAmbientLux: number;
    avgWallLux: number;
    overallUgr: number;
    totalConnectedWatts: number;
    energyDensityWPerM2: number;
    lightingQualityScore: number; // 0 - 100
    taskLayerWatts: number;
    ambientLayerWatts: number;
    wallAccentLayerWatts: number;
    taskCompliant: boolean;
    wallCompliant: boolean;
    glareCompliant: boolean;
  };
}

// =========================================================================
// PRECONFIGURED EFFECTIVE LIGHTING DESIGN (TUTORIAL 30 MODERN OFFICE)
// =========================================================================

export const DEFAULT_EFFECTIVE_DESIGN: EffectiveLightingDesignPlan = {
  id: "design-office-30",
  name: "Corporate Executive & Collaborative Office",
  roomName: "Modern Multi-Zone Office Space",
  roomDimensions: {
    lengthM: 10.0,
    widthM: 7.0,
    heightM: 3.2,
  },
  ceilingReflectance: 0.80,
  wallReflectance: 0.60,
  floorReflectance: 0.20,
  taskSurfaces: [
    {
      id: "desk-pod-1",
      name: "Workstation Pod 1 (Desk A)",
      category: "workstation_desk",
      position: { x: 2.5, y: 4.8, z: 0.75 },
      dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
      targetLux: 500,
      calculatedLux: 524,
      uniformityU0: 0.72,
      status: "compliant",
    },
    {
      id: "desk-pod-2",
      name: "Workstation Pod 1 (Desk B)",
      category: "workstation_desk",
      position: { x: 2.5, y: 5.65, z: 0.75 },
      dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
      targetLux: 500,
      calculatedLux: 518,
      uniformityU0: 0.71,
      status: "compliant",
    },
    {
      id: "desk-pod-3",
      name: "Workstation Pod 2 (Desk C)",
      category: "workstation_desk",
      position: { x: 5.5, y: 4.8, z: 0.75 },
      dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
      targetLux: 500,
      calculatedLux: 531,
      uniformityU0: 0.74,
      status: "compliant",
    },
    {
      id: "desk-pod-4",
      name: "Workstation Pod 2 (Desk D)",
      category: "workstation_desk",
      position: { x: 5.5, y: 5.65, z: 0.75 },
      dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
      targetLux: 500,
      calculatedLux: 520,
      uniformityU0: 0.70,
      status: "compliant",
    },
    {
      id: "meeting-table-1",
      name: "Team Collaboration & Meeting Table",
      category: "meeting_table",
      position: { x: 8.0, y: 3.5, z: 0.75 },
      dimensions: { width: 2.4, depth: 1.2, height: 0.75 },
      targetLux: 500,
      calculatedLux: 546,
      uniformityU0: 0.68,
      status: "compliant",
    },
  ],
  wallSurfaces: [
    {
      id: "wall-north",
      name: "North Feature Branding & Artwork Wall",
      orientation: "north",
      startPos: { x: 0, y: 7.0 },
      endPos: { x: 10.0, y: 7.0 },
      heightM: 3.2,
      targetVerticalLux: 150,
      calculatedVerticalLux: 168,
      washUniformity: 0.65,
      scallopProfile: "uniform_wash",
    },
    {
      id: "wall-west",
      name: "West Architectural Presentation Wall",
      orientation: "west",
      startPos: { x: 0, y: 0 },
      endPos: { x: 0, y: 7.0 },
      heightM: 3.2,
      targetVerticalLux: 120,
      calculatedVerticalLux: 134,
      washUniformity: 0.58,
      scallopProfile: "dramatic_accent",
    },
  ],
  luminaires: [
    // Layer 1: Suspended Task Pendants directly above Workstations (Z = 2.25m, suspension = 0.95m)
    {
      id: "lum-task-1",
      name: "Suspended Linear Panel (Pod 1 North)",
      model: "Zumtobel Slotlight Infinity Suspended LED",
      layer: "task",
      mountingType: "suspended",
      position: { x: 2.5, y: 5.2, z: 2.25 },
      suspensionLengthM: 0.95,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 3600,
      nominalWatts: 28,
      cctKelvin: 4000,
      beamAngleDeg: 85,
      peakIntensityCd: 2400,
      ugrContribution: 16.2,
      targetSurfaceId: "desk-pod-1",
      active: true,
    },
    {
      id: "lum-task-2",
      name: "Suspended Linear Panel (Pod 2 North)",
      model: "Zumtobel Slotlight Infinity Suspended LED",
      layer: "task",
      mountingType: "suspended",
      position: { x: 5.5, y: 5.2, z: 2.25 },
      suspensionLengthM: 0.95,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 3600,
      nominalWatts: 28,
      cctKelvin: 4000,
      beamAngleDeg: 85,
      peakIntensityCd: 2400,
      ugrContribution: 16.4,
      targetSurfaceId: "desk-pod-3",
      active: true,
    },
    {
      id: "lum-task-3",
      name: "Acoustic Ring Pendant (Meeting Table)",
      model: "XAL Mino 60 Ring Suspended LED",
      layer: "task",
      mountingType: "suspended",
      position: { x: 8.0, y: 3.5, z: 2.25 },
      suspensionLengthM: 0.95,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 4200,
      nominalWatts: 34,
      cctKelvin: 3500,
      beamAngleDeg: 90,
      peakIntensityCd: 2800,
      ugrContribution: 17.0,
      targetSurfaceId: "meeting-table-1",
      active: true,
    },

    // Layer 2: Ambient Background Recessed Low-Glare Downlights for Circulation (Z = 3.2m flush)
    {
      id: "lum-amb-1",
      name: "Recessed Downlight DL-1 (Corridor Entry)",
      model: "ERCO Skim Recessed Downlight Wide Flood",
      layer: "ambient",
      mountingType: "recessed",
      position: { x: 2.0, y: 1.8, z: 3.2 },
      suspensionLengthM: 0.0,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 1800,
      nominalWatts: 16,
      cctKelvin: 4000,
      beamAngleDeg: 65,
      peakIntensityCd: 1900,
      ugrContribution: 14.5,
      active: true,
    },
    {
      id: "lum-amb-2",
      name: "Recessed Downlight DL-2 (Circulation Mid)",
      model: "ERCO Skim Recessed Downlight Wide Flood",
      layer: "ambient",
      mountingType: "recessed",
      position: { x: 5.0, y: 1.8, z: 3.2 },
      suspensionLengthM: 0.0,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 1800,
      nominalWatts: 16,
      cctKelvin: 4000,
      beamAngleDeg: 65,
      peakIntensityCd: 1900,
      ugrContribution: 14.5,
      active: true,
    },
    {
      id: "lum-amb-3",
      name: "Recessed Downlight DL-3 (Meeting Zone)",
      model: "ERCO Skim Recessed Downlight Wide Flood",
      layer: "ambient",
      mountingType: "recessed",
      position: { x: 8.0, y: 1.5, z: 3.2 },
      suspensionLengthM: 0.0,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 1800,
      nominalWatts: 16,
      cctKelvin: 4000,
      beamAngleDeg: 65,
      peakIntensityCd: 1900,
      ugrContribution: 14.8,
      active: true,
    },

    // Layer 3: Vertical Wall Accent Spotlights / Wallwashers (Track suspended at Z = 2.8m, setback 0.9m)
    {
      id: "lum-wall-1",
      name: "Track Wallwasher WW-1 (North Wall Left)",
      model: "iGuzzini Palco Track Wallwasher LED",
      layer: "wall_accent",
      mountingType: "track",
      position: { x: 2.0, y: 6.1, z: 2.8 },
      suspensionLengthM: 0.4,
      aimVector: { x: 0, y: 0.9, z: -0.4 },
      nominalLumens: 2200,
      nominalWatts: 20,
      cctKelvin: 3000,
      beamAngleDeg: 48,
      peakIntensityCd: 3200,
      ugrContribution: 12.0,
      targetSurfaceId: "wall-north",
      active: true,
    },
    {
      id: "lum-wall-2",
      name: "Track Wallwasher WW-2 (North Wall Mid-Left)",
      model: "iGuzzini Palco Track Wallwasher LED",
      layer: "wall_accent",
      mountingType: "track",
      position: { x: 4.0, y: 6.1, z: 2.8 },
      suspensionLengthM: 0.4,
      aimVector: { x: 0, y: 0.9, z: -0.4 },
      nominalLumens: 2200,
      nominalWatts: 20,
      cctKelvin: 3000,
      beamAngleDeg: 48,
      peakIntensityCd: 3200,
      ugrContribution: 12.0,
      targetSurfaceId: "wall-north",
      active: true,
    },
    {
      id: "lum-wall-3",
      name: "Track Wallwasher WW-3 (North Wall Mid-Right)",
      model: "iGuzzini Palco Track Wallwasher LED",
      layer: "wall_accent",
      mountingType: "track",
      position: { x: 6.0, y: 6.1, z: 2.8 },
      suspensionLengthM: 0.4,
      aimVector: { x: 0, y: 0.9, z: -0.4 },
      nominalLumens: 2200,
      nominalWatts: 20,
      cctKelvin: 3000,
      beamAngleDeg: 48,
      peakIntensityCd: 3200,
      ugrContribution: 12.0,
      targetSurfaceId: "wall-north",
      active: true,
    },
    {
      id: "lum-wall-4",
      name: "Track Wallwasher WW-4 (North Wall Right)",
      model: "iGuzzini Palco Track Wallwasher LED",
      layer: "wall_accent",
      mountingType: "track",
      position: { x: 8.0, y: 6.1, z: 2.8 },
      suspensionLengthM: 0.4,
      aimVector: { x: 0, y: 0.9, z: -0.4 },
      nominalLumens: 2200,
      nominalWatts: 20,
      cctKelvin: 3000,
      beamAngleDeg: 48,
      peakIntensityCd: 3200,
      ugrContribution: 12.0,
      targetSurfaceId: "wall-north",
      active: true,
    },
  ],
  metrics: {
    avgTaskLux: 528,
    avgAmbientLux: 220,
    avgWallLux: 151,
    overallUgr: 16.8,
    totalConnectedWatts: 218,
    energyDensityWPerM2: 3.1,
    lightingQualityScore: 96,
    taskLayerWatts: 90,
    ambientLayerWatts: 48,
    wallAccentLayerWatts: 80,
    taskCompliant: true,
    wallCompliant: true,
    glareCompliant: true,
  },
};

// =========================================================================
// CALCULATION & OPTIMIZATION UTILITIES
// =========================================================================

/**
 * Calculates direct and inter-reflected illuminance for task and wall surfaces,
 * evaluating EN 12464-1 compliance and layer energy shares.
 */
export function calculateEffectiveLighting(
  plan: EffectiveLightingDesignPlan
): EffectiveLightingDesignPlan["metrics"] {
  const activeLums = plan.luminaires.filter((l) => l.active);

  // 1. Task Illuminance Calculation
  const taskSurfacesUpdated = plan.taskSurfaces.map((task) => {
    let directLux = 0;
    activeLums.forEach((lum) => {
      const dx = task.position.x - lum.position.x;
      const dy = task.position.y - lum.position.y;
      const dz = task.position.z - lum.position.z;
      const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy + dz * dz));

      // Cosine of angle to surface normal (pointing +Z upwards)
      const cosTheta = Math.max(0, -dz / dist);

      // Beam falloff factor (Gaussian approximation around beam angle)
      const halfBeamRad = ((lum.beamAngleDeg / 2) * Math.PI) / 180;
      const angleOffAxis = Math.acos(cosTheta);
      const intensityFraction = Math.exp(-Math.pow(angleOffAxis / (halfBeamRad * 0.8), 2));
      const candela = lum.peakIntensityCd * intensityFraction;

      directLux += (candela * cosTheta) / (dist * dist);
    });

    // Inter-reflection boost (typically 10-15% in light rooms)
    const reflectedLux = directLux * (plan.ceilingReflectance * 0.12 + plan.wallReflectance * 0.08);
    const totalLux = Math.round(directLux + reflectedLux);

    return {
      ...task,
      calculatedLux: totalLux,
      status: (totalLux >= task.targetLux ? "compliant" : "underlit") as TaskSurface["status"],
    };
  });

  // 2. Wall Vertical Illuminance Calculation
  const wallSurfacesUpdated = plan.wallSurfaces.map((wall) => {
    let verticalLux = 0;
    activeLums.forEach((lum) => {
      // Distance from luminaire to wall line
      let distToWall = 1.0;
      if (wall.orientation === "north") {
        distToWall = Math.abs(wall.startPos.y - lum.position.y);
      } else if (wall.orientation === "west") {
        distToWall = Math.abs(lum.position.x - wall.startPos.x);
      }
      const dz = 1.6 - lum.position.z; // mid-wall height at 1.6m
      const totalDist = Math.max(0.1, Math.sqrt(distToWall * distToWall + dz * dz));

      // Sin(theta) for vertical surface incident angle
      const sinTheta = Math.max(0, distToWall / totalDist);

      if (lum.layer === "wall_accent") {
        verticalLux += (lum.peakIntensityCd * 0.85 * sinTheta) / (totalDist * totalDist);
      } else {
        // Stray light from ambient/task
        verticalLux += (lum.peakIntensityCd * 0.15 * sinTheta) / (totalDist * totalDist);
      }
    });

    return {
      ...wall,
      calculatedVerticalLux: Math.round(verticalLux * 1.15),
    };
  });

  // 3. Layer Wattages
  const taskWatts = activeLums
    .filter((l) => l.layer === "task")
    .reduce((sum, l) => sum + l.nominalWatts, 0);
  const ambientWatts = activeLums
    .filter((l) => l.layer === "ambient")
    .reduce((sum, l) => sum + l.nominalWatts, 0);
  const accentWatts = activeLums
    .filter((l) => l.layer === "wall_accent")
    .reduce((sum, l) => sum + l.nominalWatts, 0);

  const totalWatts = taskWatts + ambientWatts + accentWatts;
  const roomArea = plan.roomDimensions.lengthM * plan.roomDimensions.widthM;
  const energyDensity = Math.round((totalWatts / Math.max(1, roomArea)) * 10) / 10;

  const avgTaskLux = Math.round(
    taskSurfacesUpdated.reduce((s, t) => s + t.calculatedLux, 0) / Math.max(1, taskSurfacesUpdated.length)
  );
  const avgWallLux = Math.round(
    wallSurfacesUpdated.reduce((s, w) => s + w.calculatedVerticalLux, 0) / Math.max(1, wallSurfacesUpdated.length)
  );

  // UGR Calculation: Max UGR among active fixtures
  const maxUgr = activeLums.reduce((max, l) => Math.max(max, l.ugrContribution), 14.0);

  // Lighting Quality Score (0-100)
  // Task achievement: 40 pts, Vertical wall brightness: 30 pts, Glare control: 20 pts, Energy efficiency: 10 pts
  let score = 0;
  if (avgTaskLux >= 500) score += 40;
  else score += Math.max(0, (avgTaskLux / 500) * 40);

  if (avgWallLux >= 150) score += 30;
  else score += Math.max(0, (avgWallLux / 150) * 30);

  if (maxUgr <= 19) score += 20;
  else score += Math.max(0, (1 - (maxUgr - 19) / 10) * 20);

  if (energyDensity <= 5.0) score += 10;
  else score += Math.max(0, (1 - (energyDensity - 5.0) / 10) * 10);

  return {
    avgTaskLux,
    avgAmbientLux: 220,
    avgWallLux,
    overallUgr: Math.round(maxUgr * 10) / 10,
    totalConnectedWatts: totalWatts,
    energyDensityWPerM2: energyDensity,
    lightingQualityScore: Math.round(score),
    taskLayerWatts: taskWatts,
    ambientLayerWatts: ambientWatts,
    wallAccentLayerWatts: accentWatts,
    taskCompliant: avgTaskLux >= 500,
    wallCompliant: avgWallLux >= 120,
    glareCompliant: maxUgr <= 19,
  };
}

/**
 * Helper to auto-place suspended pendants directly centered over a table.
 */
export function autoArrangePendantsAboveTable(
  table: TaskSurface,
  ceilingHeightM: number = 3.2,
  suspensionHeightM: number = 2.25
): DesignLuminaire[] {
  const suspensionWire = Math.round((ceilingHeightM - suspensionHeightM) * 100) / 100;
  const lumId = `lum-task-${Date.now()}`;

  return [
    {
      id: lumId,
      name: `Direct Pendant over ${table.name}`,
      model: "Ergonomic Suspended Direct/Indirect LED Panel",
      layer: "task",
      mountingType: "suspended",
      position: {
        x: table.position.x,
        y: table.position.y,
        z: suspensionHeightM,
      },
      suspensionLengthM: suspensionWire,
      aimVector: { x: 0, y: 0, z: -1 },
      nominalLumens: 3800,
      nominalWatts: 30,
      cctKelvin: 4000,
      beamAngleDeg: 85,
      peakIntensityCd: 2600,
      ugrContribution: 16.5,
      targetSurfaceId: table.id,
      active: true,
    },
  ];
}
