/**
 * =========================================================================
 * DIALUX EVO DRAWING FROM SCRATCH ENGINE (TUTORIAL PART 18)
 * =========================================================================
 * 
 * Implements building construction from scratch without an imported CAD plan:
 * - Help Lines & Construction Guides (Horizontal, Vertical, Parallel Offset, Angular)
 * - Snap-to-Guide & Snap-to-Intersection Geometry Solver
 * - Multi-Room Floor Plan with Exterior (0.25m-0.35m) and Interior (0.10m-0.15m) Wall Thicknesses
 * - Apertures & Openings:
 *   - Rectangular Windows (Width, Height, Sill Height)
 *   - Circular / Round Windows (Diameter, Center Height, Circular Frame Profile)
 *   - Doors and Double Doors
 * - Multi-Storey Building Stacking & Storey Duplication
 * - 3D Wall Extrusion with Boolean/Segmented Cutouts for Rectangular and Circular Openings
 */

export interface Point2D {
  x: number;
  y: number;
}

export type HelpLineType = "horizontal" | "vertical" | "parallel_offset" | "angular";

export interface HelpLine {
  id: string;
  name: string;
  type: HelpLineType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offsetDistance?: number; // Distance offset from origin/reference line
  angleDeg?: number;        // Angle in degrees (e.g. 0°, 90°, 45°)
  color: string;
  visible: boolean;
}

export type ApertureType =
  | "rectangular_window"
  | "circular_window"
  | "door"
  | "double_door";

export interface WallAperture {
  id: string;
  name: string;
  type: ApertureType;
  wallIndex: number;         // Index of wall segment in room polygon
  positionRatio: number;     // 0.0 to 1.0 along the wall segment (0.5 = center)
  widthM: number;            // Width for rectangular window / door (or diameter for circular window)
  heightM: number;           // Height for rectangular window / door (or diameter for circular window)
  sillHeightM: number;       // Bottom sill height above floor (0 for doors, e.g. 0.9m for windows)
  diameterM?: number;        // For circular window (e.g. 1.0m - 1.6m)
  centerHeightM?: number;    // Center elevation for circular window (e.g. 1.5m)
  frameWidthM: number;       // Frame profile thickness (e.g. 0.06m)
  glassColor?: string;
}

export interface ScratchRoom {
  id: string;
  name: string;
  polygon: Point2D[];
  wallThickness: number;     // Exterior: 0.25m-0.35m, Interior: 0.10m-0.15m
  height: number;            // Ceiling height (e.g. 2.80m - 3.20m)
  targetLux: number;         // EN 12464-1 lux target
  applicationProfile: string;// e.g. "Offices - Writing & Computer Work"
  color: string;
  apertures: WallAperture[];
  areaM2: number;
  perimeterM: number;
}

export interface ScratchStorey {
  id: string;
  name: string;
  levelIndex: number;        // 0 = Ground Floor, 1 = 1st Floor, etc.
  heightM: number;           // 2.80m - 3.50m
  elevationM: number;        // e.g. 0.00m, 3.00m, 6.00m
  floorThicknessM: number;   // 0.20m
  exteriorWallThicknessM: number;
  rooms: ScratchRoom[];
}

export interface ScratchBuilding {
  id: string;
  name: string;
  storeys: ScratchStorey[];
  activeStoreyId: string;
  helpLines: HelpLine[];
}

// =========================================================================
// 1. GEOMETRY & HELP LINE INTERSECTION SOLVER
// =========================================================================

/**
 * Calculates line-line intersection of two HelpLines (if not parallel).
 */
export function findHelpLineIntersection(l1: HelpLine, l2: HelpLine): Point2D | null {
  const x1 = l1.x1, y1 = l1.y1, x2 = l1.x2, y2 = l1.y2;
  const x3 = l2.x1, y3 = l2.y1, x4 = l2.x2, y4 = l2.y2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-6) return null; // parallel

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const px = x1 + t * (x2 - x1);
  const py = y1 + t * (y2 - y1);

  return { x: Math.round(px * 1000) / 1000, y: Math.round(py * 1000) / 1000 };
}

/**
 * Snaps a 2D cursor point to the nearest help line, help line intersection, or grid point.
 */
export function snapToGuidesAndGrid(
  rawX: number,
  rawY: number,
  helpLines: HelpLine[],
  gridStep: number = 0.25,
  snapDistance: number = 0.25
): { point: Point2D; snappedTo: "intersection" | "helpline" | "grid" | "none"; label?: string } {
  // 1. Check all HelpLine intersections (highest priority)
  const visibleLines = helpLines.filter((l) => l.visible);
  let bestDist = snapDistance;
  let bestPoint: Point2D | null = null;
  let bestType: "intersection" | "helpline" | "grid" | "none" = "none";
  let bestLabel = "";

  for (let i = 0; i < visibleLines.length; i++) {
    for (let j = i + 1; j < visibleLines.length; j++) {
      const inter = findHelpLineIntersection(visibleLines[i], visibleLines[j]);
      if (inter) {
        const d = Math.hypot(rawX - inter.x, rawY - inter.y);
        if (d < bestDist) {
          bestDist = d;
          bestPoint = inter;
          bestType = "intersection";
          bestLabel = `Guide Intersection (${inter.x.toFixed(2)}, ${inter.y.toFixed(2)})`;
        }
      }
    }
  }

  if (bestPoint && bestType === "intersection") {
    return { point: bestPoint, snappedTo: bestType, label: bestLabel };
  }

  // 2. Check projection onto visible Help Lines
  for (const line of visibleLines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > 1e-6) {
      const t = Math.max(0, Math.min(1, ((rawX - line.x1) * dx + (rawY - line.y1) * dy) / lenSq));
      const projX = line.x1 + t * dx;
      const projY = line.y1 + t * dy;
      const d = Math.hypot(rawX - projX, rawY - projY);
      if (d < bestDist) {
        bestDist = d;
        bestPoint = { x: Math.round(projX * 100) / 100, y: Math.round(projY * 100) / 100 };
        bestType = "helpline";
        bestLabel = `Snapped to ${line.name}`;
      }
    }
  }

  if (bestPoint && bestType === "helpline") {
    return { point: bestPoint, snappedTo: bestType, label: bestLabel };
  }

  // 3. Snap to regular Grid
  const gridX = Math.round(rawX / gridStep) * gridStep;
  const gridY = Math.round(rawY / gridStep) * gridStep;
  const gridD = Math.hypot(rawX - gridX, rawY - gridY);
  if (gridD <= snapDistance) {
    return {
      point: { x: Number(gridX.toFixed(3)), y: Number(gridY.toFixed(3)) },
      snappedTo: "grid",
      label: `Grid (${gridX.toFixed(2)}, ${gridY.toFixed(2)})`,
    };
  }

  return { point: { x: rawX, y: rawY }, snappedTo: "none" };
}

// =========================================================================
// 2. POLYGON AREA & PERIMETER CALCULATIONS
// =========================================================================

export function calculateAreaShoelace(pts: Point2D[]): number {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

export function calculatePerimeter(pts: Point2D[]): number {
  if (!pts || pts.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

// =========================================================================
// 3. PRESET ARCHITECTURAL TEMPLATES (DRAWING FROM SCRATCH)
// =========================================================================

export const PRESET_SCRATCH_BUILDINGS: ScratchBuilding[] = [
  {
    id: "scratch-office-suite",
    name: "Modern Commercial Office Suite (Tutorial 18)",
    activeStoreyId: "storey-gf",
    helpLines: [
      {
        id: "hl-1",
        name: "North Baseline (Y=8m)",
        type: "horizontal",
        x1: 0,
        y1: 8,
        x2: 12,
        y2: 8,
        offsetDistance: 8,
        color: "#f59e0b",
        visible: true,
      },
      {
        id: "hl-2",
        name: "South Baseline (Y=0m)",
        type: "horizontal",
        x1: 0,
        y1: 0,
        x2: 12,
        y2: 0,
        offsetDistance: 0,
        color: "#f59e0b",
        visible: true,
      },
      {
        id: "hl-3",
        name: "West Facade (X=0m)",
        type: "vertical",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 8,
        offsetDistance: 0,
        color: "#3b82f6",
        visible: true,
      },
      {
        id: "hl-4",
        name: "East Facade (X=12m)",
        type: "vertical",
        x1: 12,
        y1: 0,
        x2: 12,
        y2: 8,
        offsetDistance: 12,
        color: "#3b82f6",
        visible: true,
      },
      {
        id: "hl-5",
        name: "Corridor Partition (Y=3.5m)",
        type: "horizontal",
        x1: 0,
        y1: 3.5,
        x2: 12,
        y2: 3.5,
        offsetDistance: 3.5,
        color: "#10b981",
        visible: true,
      },
      {
        id: "hl-6",
        name: "Feature Circular Window Guide (X=6m)",
        type: "vertical",
        x1: 6,
        y1: 0,
        x2: 6,
        y2: 8,
        offsetDistance: 6,
        color: "#ec4899",
        visible: true,
      },
    ],
    storeys: [
      {
        id: "storey-gf",
        name: "Ground Floor",
        levelIndex: 0,
        heightM: 3.0,
        elevationM: 0.0,
        floorThicknessM: 0.2,
        exteriorWallThicknessM: 0.25,
        rooms: [
          {
            id: "room-open-office",
            name: "Open-Plan Office (North)",
            polygon: [
              { x: 0, y: 3.5 },
              { x: 12, y: 3.5 },
              { x: 12, y: 8.0 },
              { x: 0, y: 8.0 },
            ],
            wallThickness: 0.25,
            height: 3.0,
            targetLux: 500,
            applicationProfile: "Offices - Writing, typing, reading data",
            color: "#3b82f6",
            areaM2: 54.0,
            perimeterM: 33.0,
            apertures: [
              {
                id: "ap-win-1",
                name: "North Ribbon Window 1",
                type: "rectangular_window",
                wallIndex: 2, // top wall
                positionRatio: 0.25,
                widthM: 2.4,
                heightM: 1.5,
                sillHeightM: 0.9,
                frameWidthM: 0.06,
                glassColor: "#93c5fd",
              },
              {
                id: "ap-win-2",
                name: "North Ribbon Window 2",
                type: "rectangular_window",
                wallIndex: 2,
                positionRatio: 0.75,
                widthM: 2.4,
                heightM: 1.5,
                sillHeightM: 0.9,
                frameWidthM: 0.06,
                glassColor: "#93c5fd",
              },
              {
                id: "ap-door-1",
                name: "Corridor Entry Door",
                type: "door",
                wallIndex: 0, // south partition wall
                positionRatio: 0.5,
                widthM: 0.9,
                heightM: 2.1,
                sillHeightM: 0.0,
                frameWidthM: 0.05,
              },
            ],
          },
          {
            id: "room-conference",
            name: "Executive Meeting Room (South-East)",
            polygon: [
              { x: 6, y: 0.0 },
              { x: 12, y: 0.0 },
              { x: 12, y: 3.5 },
              { x: 6, y: 3.5 },
            ],
            wallThickness: 0.25,
            height: 3.0,
            targetLux: 500,
            applicationProfile: "Conference & Meeting Rooms",
            color: "#8b5cf6",
            areaM2: 21.0,
            perimeterM: 19.0,
            apertures: [
              {
                id: "ap-win-circ-1",
                name: "Architectural Circular Window (Tutorial 18)",
                type: "circular_window",
                wallIndex: 0, // south facade
                positionRatio: 0.5,
                widthM: 1.4,
                heightM: 1.4,
                diameterM: 1.4,
                centerHeightM: 1.6,
                sillHeightM: 0.9,
                frameWidthM: 0.08,
                glassColor: "#67e8f9",
              },
              {
                id: "ap-door-conf",
                name: "Conference Door",
                type: "door",
                wallIndex: 2,
                positionRatio: 0.4,
                widthM: 0.9,
                heightM: 2.1,
                sillHeightM: 0.0,
                frameWidthM: 0.05,
              },
            ],
          },
          {
            id: "room-lobby",
            name: "Reception & Gallery Lobby (South-West)",
            polygon: [
              { x: 0, y: 0.0 },
              { x: 6, y: 0.0 },
              { x: 6, y: 3.5 },
              { x: 0, y: 3.5 },
            ],
            wallThickness: 0.25,
            height: 3.0,
            targetLux: 300,
            applicationProfile: "Entrance Halls & Reception Desks",
            color: "#10b981",
            areaM2: 21.0,
            perimeterM: 19.0,
            apertures: [
              {
                id: "ap-door-entrance",
                name: "Main Entrance Double Door",
                type: "double_door",
                wallIndex: 0, // south facade
                positionRatio: 0.5,
                widthM: 1.8,
                heightM: 2.2,
                sillHeightM: 0.0,
                frameWidthM: 0.06,
              },
              {
                id: "ap-win-west-circ",
                name: "West Porthole Circular Window",
                type: "circular_window",
                wallIndex: 3, // west facade
                positionRatio: 0.5,
                widthM: 1.2,
                heightM: 1.2,
                diameterM: 1.2,
                centerHeightM: 1.5,
                sillHeightM: 0.9,
                frameWidthM: 0.06,
                glassColor: "#67e8f9",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "scratch-medical-clinic",
    name: "Medical Clinic with Consultation Rooms",
    activeStoreyId: "storey-clinic-gf",
    helpLines: [
      {
        id: "hl-c1",
        name: "North Wall (Y=7m)",
        type: "horizontal",
        x1: 0,
        y1: 7,
        x2: 10,
        y2: 7,
        offsetDistance: 7,
        color: "#f59e0b",
        visible: true,
      },
      {
        id: "hl-c2",
        name: "Central Corridor (Y=3.5m)",
        type: "horizontal",
        x1: 0,
        y1: 3.5,
        x2: 10,
        y2: 3.5,
        offsetDistance: 3.5,
        color: "#10b981",
        visible: true,
      },
    ],
    storeys: [
      {
        id: "storey-clinic-gf",
        name: "Ground Floor",
        levelIndex: 0,
        heightM: 2.8,
        elevationM: 0.0,
        floorThicknessM: 0.2,
        exteriorWallThicknessM: 0.3,
        rooms: [
          {
            id: "room-consult-1",
            name: "Consultation Room 1",
            polygon: [
              { x: 0, y: 3.5 },
              { x: 5, y: 3.5 },
              { x: 5, y: 7.0 },
              { x: 0, y: 7.0 },
            ],
            wallThickness: 0.25,
            height: 2.8,
            targetLux: 500,
            applicationProfile: "Health Care - Examination Rooms",
            color: "#06b6d4",
            areaM2: 17.5,
            perimeterM: 17.0,
            apertures: [
              {
                id: "ap-win-c1",
                name: "Daylight Window",
                type: "rectangular_window",
                wallIndex: 2,
                positionRatio: 0.5,
                widthM: 1.8,
                heightM: 1.4,
                sillHeightM: 0.9,
                frameWidthM: 0.06,
              },
            ],
          },
          {
            id: "room-consult-2",
            name: "Consultation Room 2",
            polygon: [
              { x: 5, y: 3.5 },
              { x: 10, y: 3.5 },
              { x: 10, y: 7.0 },
              { x: 5, y: 7.0 },
            ],
            wallThickness: 0.25,
            height: 2.8,
            targetLux: 500,
            applicationProfile: "Health Care - Examination Rooms",
            color: "#06b6d4",
            areaM2: 17.5,
            perimeterM: 17.0,
            apertures: [
              {
                id: "ap-win-c2-circ",
                name: "Hygiene Circular Window",
                type: "circular_window",
                wallIndex: 2,
                positionRatio: 0.5,
                widthM: 1.2,
                heightM: 1.2,
                diameterM: 1.2,
                centerHeightM: 1.6,
                sillHeightM: 1.0,
                frameWidthM: 0.08,
              },
            ],
          },
        ],
      },
    ],
  },
];

// =========================================================================
// 4. STOREY MANAGEMENT UTILITIES
// =========================================================================

/**
 * Duplicates a completed storey and stacks it at the next floor level.
 */
export function duplicateStoreyUpwards(
  building: ScratchBuilding,
  sourceStoreyId: string
): ScratchBuilding {
  const source = building.storeys.find((s) => s.id === sourceStoreyId);
  if (!source) return building;

  const nextLevel = building.storeys.length;
  const newElevation = source.elevationM + source.heightM;
  const newId = `storey-level-${nextLevel}`;

  const duplicatedRooms: ScratchRoom[] = source.rooms.map((r, i) => ({
    ...r,
    id: `room-${newId}-${i + 1}`,
    name: `${r.name} (Level ${nextLevel})`,
    apertures: r.apertures.map((a, j) => ({
      ...a,
      id: `ap-${newId}-${i + 1}-${j + 1}`,
    })),
  }));

  const newStorey: ScratchStorey = {
    id: newId,
    name: `Level ${nextLevel} Floor`,
    levelIndex: nextLevel,
    heightM: source.heightM,
    elevationM: newElevation,
    floorThicknessM: source.floorThicknessM,
    exteriorWallThicknessM: source.exteriorWallThicknessM,
    rooms: duplicatedRooms,
  };

  return {
    ...building,
    storeys: [...building.storeys, newStorey],
    activeStoreyId: newId,
  };
}
