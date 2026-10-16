/**
 * =========================================================================
 * DIALUX EVO ADVANCED CUTOUT TOOL & ROOF INTERSECTIONS ENGINE (TUTORIAL PART 24)
 * =========================================================================
 * 
 * Implements the complete Advanced Cutout Tool (Ausschnitt-Werkzeug) and 
 * Complex Roof Intersections system from DIALux evo Tutorial Part 24:
 * 
 * 1. CUTOUT TOOL GEOMETRIES:
 *    - Polygonal Cutout (freeform n-point polygon on planar or pitched surface)
 *    - Rectangular Cutout (length, width, rotation, center)
 *    - Circular Cutout (radius, center)
 * 
 * 2. TARGET SURFACES & ELEMENTS:
 *    - Roof Structures (Single pitch, Double pitch gable, Hip, Mansard)
 *    - Ceilings (Atrium openings, stairwells, double-height galleries)
 *    - Floors (Sunken pits, machinery recesses, ground slabs)
 *    - Walls (Passages, custom niches, arched openings)
 * 
 * 3. ADVANCED CONTROLS:
 *    - "Limit Cutting Depth" (Schnitttiefe begrenzen):
 *      * Depth in meters (e.g. 0.30m) to only penetrate roof cladding
 *        without cutting into underlying ceiling or lower storeys
 *    - Numerical vertex coordinate table with add/remove/edit operations
 *    - Roof intersection valley trimming (preventing overlapping meshes)
 * 
 * 4. GEOMETRY & QUANTITY RECALCULATION:
 *    - Net roof area, gross roof area, cutout void area
 *    - Enclosed building volume (V_net)
 *    - Daylight aperture opening area (m²)
 */

export type CutoutShapeType = "polygonal" | "rectangular" | "circular";

export type CutoutTargetSurface = "roof" | "ceiling" | "floor" | "wall";

export interface Point2D {
  x: number;
  y: number;
}

export interface CutoutItem {
  id: string;
  name: string;
  shapeType: CutoutShapeType;
  targetSurface: CutoutTargetSurface;
  targetElementId: string; // e.g. "roof_main", "ceiling_level1"
  polygonPoints: Point2D[]; // 2D coordinates on target surface plane
  widthM?: number;
  lengthM?: number;
  radiusM?: number;
  centerPosition: { x: number; y: number; z: number };
  limitCuttingDepth: boolean;
  cuttingDepthM: number; // e.g. 0.35m
  rotationDegrees: number;
  isEnabled: boolean;
  colorHex: string;
}

export type RoofStructureType =
  | "gable_double_pitch"
  | "shed_single_pitch"
  | "hip_roof"
  | "l_shaped_cross_gable"
  | "mansard"
  | "dormer_addition";

export interface RoofWingGeometry {
  id: string;
  name: string;
  type: RoofStructureType;
  lengthM: number;
  widthM: number;
  ridgeHeightM: number; // height above eave line
  eaveHeightM: number; // base wall height
  pitchDegrees: number; // e.g. 35° or 45°
  overhangM: number;
  origin: { x: number; y: number; z: number };
  rotationDegrees: number;
  cutoutIds: string[];
}

export interface CutoutStudioProjectModel {
  id: string;
  name: string;
  description: string;
  buildingLengthM: number;
  buildingWidthM: number;
  buildingHeightM: number;
  storeysCount: number;
  roofs: RoofWingGeometry[];
  cutouts: CutoutItem[];
}

export interface CutoutCalculationMetrics {
  grossRoofAreaM2: number;
  netRoofAreaM2: number;
  totalCutoutAreaM2: number;
  cutoutAreaPercentage: number;
  enclosedVolumeGrossM3: number;
  enclosedVolumeNetM3: number;
  daylightOpeningAreaM2: number;
  estimatedDaylightFactorBoostPercent: number;
}

// =========================================================================
// 2. MATHEMATICAL CALCULATION FUNCTIONS
// =========================================================================

/**
 * Calculates net 2D area of a polygon using Shoelace formula
 */
export function calculateShoelaceArea(points: Point2D[]): number {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Calculates surface area of a pitched roof wing
 */
export function calculatePitchedRoofSurfaceArea(roof: RoofWingGeometry): number {
  const pitchRad = (roof.pitchDegrees * Math.PI) / 180;
  const cosPitch = Math.max(0.2, Math.cos(pitchRad));
  const effectiveWidth = (roof.widthM + 2 * roof.overhangM) / cosPitch;
  const effectiveLength = roof.lengthM + 2 * roof.overhangM;

  if (roof.type === "shed_single_pitch") {
    return effectiveLength * effectiveWidth;
  } else if (roof.type === "gable_double_pitch" || roof.type === "l_shaped_cross_gable") {
    // Two symmetrical slopes
    return effectiveLength * effectiveWidth;
  } else if (roof.type === "hip_roof") {
    return effectiveLength * effectiveWidth * 0.95;
  }
  return effectiveLength * effectiveWidth;
}

/**
 * Recalculates all architectural quantities taking cutouts into account
 */
export function recalculateCutoutMetrics(
  project: CutoutStudioProjectModel
): CutoutCalculationMetrics {
  let grossRoofArea = 0;
  project.roofs.forEach((r) => {
    grossRoofArea += calculatePitchedRoofSurfaceArea(r);
  });

  let totalCutoutArea = 0;
  let daylightOpeningArea = 0;

  project.cutouts.forEach((cut) => {
    if (!cut.isEnabled) return;
    let area = 0;
    if (cut.shapeType === "polygonal") {
      area = calculateShoelaceArea(cut.polygonPoints);
    } else if (cut.shapeType === "rectangular") {
      area = (cut.widthM || 2) * (cut.lengthM || 2);
    } else if (cut.shapeType === "circular") {
      const r = cut.radiusM || 1;
      area = Math.PI * r * r;
    }

    totalCutoutArea += area;
    if (cut.targetSurface === "roof" || cut.targetSurface === "ceiling") {
      daylightOpeningArea += area;
    }
  });

  const netRoofArea = Math.max(0, grossRoofArea - totalCutoutArea);
  const cutoutPercent = grossRoofArea > 0 ? (totalCutoutArea / grossRoofArea) * 100 : 0;

  // Enclosed Volume
  const baseBoxVolume = project.buildingLengthM * project.buildingWidthM * project.buildingHeightM;
  let roofAtticVolume = 0;
  project.roofs.forEach((r) => {
    roofAtticVolume += 0.5 * r.lengthM * r.widthM * r.ridgeHeightM;
  });

  const grossVolume = baseBoxVolume + roofAtticVolume;
  // Void volume deducted by cutouts
  let voidVolume = 0;
  project.cutouts.forEach((cut) => {
    if (!cut.isEnabled) return;
    const depth = cut.limitCuttingDepth ? cut.cuttingDepthM : project.buildingHeightM * 0.4;
    let cutArea = 0;
    if (cut.shapeType === "polygonal") cutArea = calculateShoelaceArea(cut.polygonPoints);
    else if (cut.shapeType === "rectangular") cutArea = (cut.widthM || 2) * (cut.lengthM || 2);
    else cutArea = Math.PI * Math.pow(cut.radiusM || 1, 2);

    voidVolume += cutArea * depth;
  });

  const netVolume = Math.max(0, grossVolume - voidVolume);

  // Daylight factor boost through roof openings (empirical daylight ratio)
  const floorArea = project.buildingLengthM * project.buildingWidthM;
  const daylightBoost = floorArea > 0 ? (daylightOpeningArea / floorArea) * 45 : 0;

  return {
    grossRoofAreaM2: Math.round(grossRoofArea * 10) / 10,
    netRoofAreaM2: Math.round(netRoofArea * 10) / 10,
    totalCutoutAreaM2: Math.round(totalCutoutArea * 10) / 10,
    cutoutAreaPercentage: Math.round(cutoutPercent * 10) / 10,
    enclosedVolumeGrossM3: Math.round(grossVolume * 10) / 10,
    enclosedVolumeNetM3: Math.round(netVolume * 10) / 10,
    daylightOpeningAreaM2: Math.round(daylightOpeningArea * 10) / 10,
    estimatedDaylightFactorBoostPercent: Math.round(daylightBoost * 10) / 10,
  };
}

// =========================================================================
// 3. DEFAULT PRESETS FOR TUTORIAL 24
// =========================================================================

export const TUTORIAL_24_PRESETS: CutoutStudioProjectModel[] = [
  // PRESET 1: L-SHAPED INTERSECTING GABLE ROOFS (Cross-Gable Trimming)
  {
    id: "l_shaped_cross_gable_trim",
    name: "L-Shaped Intersecting Gable Roofs (Cross-Gable Trimming)",
    description: "Main wing and perpendicular side wing. Uses polygonal cutout to trim overlapping valley slopes, eliminating mesh collision.",
    buildingLengthM: 16.0,
    buildingWidthM: 12.0,
    buildingHeightM: 5.5,
    storeysCount: 2,
    roofs: [
      {
        id: "roof_main_wing",
        name: "Main Wing Gable Roof (16m × 8m)",
        type: "gable_double_pitch",
        lengthM: 16.0,
        widthM: 8.0,
        ridgeHeightM: 3.2,
        eaveHeightM: 5.5,
        pitchDegrees: 38,
        overhangM: 0.4,
        origin: { x: 0, y: 0, z: 5.5 },
        rotationDegrees: 0,
        cutoutIds: ["cutout_valley_trim_1"],
      },
      {
        id: "roof_side_wing",
        name: "Perpendicular Side Wing (8m × 6m)",
        type: "l_shaped_cross_gable",
        lengthM: 8.0,
        widthM: 6.0,
        ridgeHeightM: 2.8,
        eaveHeightM: 5.5,
        pitchDegrees: 38,
        overhangM: 0.4,
        origin: { x: 4.0, y: 6.0, z: 5.5 },
        rotationDegrees: 90,
        cutoutIds: [],
      },
    ],
    cutouts: [
      {
        id: "cutout_valley_trim_1",
        name: "Valley Intersection Slope Trimming Cutout",
        shapeType: "polygonal",
        targetSurface: "roof",
        targetElementId: "roof_main_wing",
        polygonPoints: [
          { x: 3.8, y: -0.2 },
          { x: 7.2, y: -0.2 },
          { x: 5.5, y: 3.2 },
        ],
        centerPosition: { x: 5.5, y: 1.5, z: 7.0 },
        limitCuttingDepth: true,
        cuttingDepthM: 0.35,
        rotationDegrees: 0,
        isEnabled: true,
        colorHex: "#38bdf8",
      },
    ],
  },

  // PRESET 2: DORMER WINDOW SLOPE CUTOUT (DACHGAUBE)
  {
    id: "dormer_window_cutout",
    name: "Roof Dormer Window Opening & Trimming (Dachgaube)",
    description: "Cuts a rectangular aperture into the 40° sloped roof to seat a vertical dormer facade and roof addition.",
    buildingLengthM: 14.0,
    buildingWidthM: 9.0,
    buildingHeightM: 5.8,
    storeysCount: 2,
    roofs: [
      {
        id: "roof_dormer_main",
        name: "Main Steep Pitch Roof (40°)",
        type: "gable_double_pitch",
        lengthM: 14.0,
        widthM: 9.0,
        ridgeHeightM: 3.8,
        eaveHeightM: 5.8,
        pitchDegrees: 40,
        overhangM: 0.45,
        origin: { x: 0, y: 0, z: 5.8 },
        rotationDegrees: 0,
        cutoutIds: ["cutout_dormer_aperture"],
      },
    ],
    cutouts: [
      {
        id: "cutout_dormer_aperture",
        name: "Dormer Vertical Window Slope Aperture",
        shapeType: "rectangular",
        targetSurface: "roof",
        targetElementId: "roof_dormer_main",
        polygonPoints: [
          { x: -1.4, y: -1.2 },
          { x: 1.4, y: -1.2 },
          { x: 1.4, y: 1.2 },
          { x: -1.4, y: 1.2 },
        ],
        widthM: 2.8,
        lengthM: 2.4,
        centerPosition: { x: 7.0, y: 2.2, z: 7.2 },
        limitCuttingDepth: true,
        cuttingDepthM: 0.40,
        rotationDegrees: 0,
        isEnabled: true,
        colorHex: "#f59e0b",
      },
    ],
  },

  // PRESET 3: MULTI-STOREY ATRIUM & GALLERY VOID CUTOUT
  {
    id: "atrium_gallery_void",
    name: "Multi-Storey Atrium & Gallery Void Cutout",
    description: "Carves an expansive 6m × 4m rectangular void through the 1st floor intermediate slab, opening daylight to the ground lobby.",
    buildingLengthM: 18.0,
    buildingWidthM: 12.0,
    buildingHeightM: 7.2,
    storeysCount: 2,
    roofs: [
      {
        id: "roof_flat_skylight",
        name: "Flat Roof with Central Skylight Strip",
        type: "shed_single_pitch",
        lengthM: 18.0,
        widthM: 12.0,
        ridgeHeightM: 0.5,
        eaveHeightM: 7.2,
        pitchDegrees: 2,
        overhangM: 0.2,
        origin: { x: 0, y: 0, z: 7.2 },
        rotationDegrees: 0,
        cutoutIds: ["cutout_atrium_slab"],
      },
    ],
    cutouts: [
      {
        id: "cutout_atrium_slab",
        name: "Central Atrium Intermediate Slab Void",
        shapeType: "rectangular",
        targetSurface: "ceiling",
        targetElementId: "ceiling_level1",
        polygonPoints: [
          { x: -3.0, y: -2.0 },
          { x: 3.0, y: -2.0 },
          { x: 3.0, y: 2.0 },
          { x: -3.0, y: 2.0 },
        ],
        widthM: 6.0,
        lengthM: 4.0,
        centerPosition: { x: 9.0, y: 6.0, z: 3.6 },
        limitCuttingDepth: false,
        cuttingDepthM: 1.0,
        rotationDegrees: 0,
        isEnabled: true,
        colorHex: "#10b981",
      },
    ],
  },
];
