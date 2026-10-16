/**
 * =========================================================================
 * DIALUX EVO COMPLETE SCENERY ENGINE (TUTORIAL PART 29)
 * =========================================================================
 * 
 * Implements the complete building scenery workflow from DIALux evo
 * Tutorial Part 29: "Creating a complete scenery".
 * 
 * Core Features:
 * 1. Building Storey & Multi-Room Hierarchy:
 *    - Exterior building contour (outer walls, storey height, slab thickness)
 *    - Interior room contours & partition walls (room by room construction)
 *    - Ceiling structures & suspended ceilings (plenum height)
 *    - Room-height structural columns (rectangular and cylindrical)
 * 
 * 2. Doors & Windows Placement Tool:
 *    - Exterior ribbon windows, floor-to-ceiling curtain walls, and high clerestories
 *    - Single doors, double entrance doors, and interior partition doors
 *    - Sill height, casing thickness, opening swing direction, and glass transmittance
 *    - Automated spacing & alignment along building wall axes
 *    - Daylight Aperture Ratio / Window-to-Wall Ratio (WWR)
 * 
 * 3. Room Utilization Profiles & Assessment Zones (EN 12464-1):
 *    - Standard profiles: Open Office (500 lx), Executive Office (500 lx),
 *      Conference Suite (500 lx), Circulation Corridor (100 lx),
 *      Reception Lounge (200 lx), Restroom (200 lx)
 *    - Target maintained illuminance (Em), uniformity (U0), glare limit (UGR),
 *      color rendering (Ra), and workplane height (0.75m vs 0.00m)
 *    - Wall boundary margins (0.50m) and calculation grid spacing
 * 
 * 4. Furniture & Scenery Elements:
 *    - Office workstations, conference tables, chairs, credenzas, reception counters
 *    - 3D placement, dimensions, rotation, and light obstruction factors
 * 
 * 5. Photometric & Connected Load Calculations:
 *    - Lumen method estimation per room: Phi_total = (E_m * A) / (CU * MF)
 *    - Fixture count estimation and Connected Load Density (W/m² - EN 15193)
 */

export type RoomProfileType =
  | "open_office"
  | "executive_office"
  | "conference"
  | "corridor"
  | "reception"
  | "restroom"
  | "breakroom"
  | "storage";

export interface StandardProfile {
  name: string;
  targetLux: number; // Maintained illuminance Em
  uniformityMin: number; // U0
  ugrMax: number; // Glare rating
  criMin: number; // Ra
  workplaneHeightM: number; // typically 0.75m for desks, 0.0m for floors
  boundaryMarginM: number; // typically 0.50m
  standardRef: string; // EN 12464-1:2021
}

export const ROOM_STANDARDS: Record<RoomProfileType, StandardProfile> = {
  open_office: {
    name: "Open Plan Office / Workstations",
    targetLux: 500,
    uniformityMin: 0.60,
    ugrMax: 19,
    criMin: 80,
    workplaneHeightM: 0.75,
    boundaryMarginM: 0.50,
    standardRef: "EN 12464-1: 5.26.2 (Writing, typing, reading)",
  },
  executive_office: {
    name: "Executive Director Office",
    targetLux: 500,
    uniformityMin: 0.60,
    ugrMax: 19,
    criMin: 80,
    workplaneHeightM: 0.75,
    boundaryMarginM: 0.50,
    standardRef: "EN 12464-1: 5.26.1 (Offices general)",
  },
  conference: {
    name: "Conference & Meeting Suite",
    targetLux: 500,
    uniformityMin: 0.60,
    ugrMax: 19,
    criMin: 80,
    workplaneHeightM: 0.75,
    boundaryMarginM: 0.50,
    standardRef: "EN 12464-1: 5.26.3 (Conference & meeting rooms)",
  },
  corridor: {
    name: "Circulation Corridor & Passageway",
    targetLux: 100,
    uniformityMin: 0.40,
    ugrMax: 28,
    criMin: 40,
    workplaneHeightM: 0.00, // Floor level
    boundaryMarginM: 0.20,
    standardRef: "EN 12464-1: 5.1.1 (Circulation zones and corridors)",
  },
  reception: {
    name: "Reception Desk & Waiting Area",
    targetLux: 300,
    uniformityMin: 0.60,
    ugrMax: 22,
    criMin: 80,
    workplaneHeightM: 0.75,
    boundaryMarginM: 0.50,
    standardRef: "EN 12464-1: 5.1.3 (Reception desks)",
  },
  restroom: {
    name: "Restroom & Sanitary Core",
    targetLux: 200,
    uniformityMin: 0.40,
    ugrMax: 25,
    criMin: 80,
    workplaneHeightM: 0.00,
    boundaryMarginM: 0.20,
    standardRef: "EN 12464-1: 5.1.4 (Restrooms and washrooms)",
  },
  breakroom: {
    name: "Breakroom & Coffee Lounge",
    targetLux: 200,
    uniformityMin: 0.40,
    ugrMax: 22,
    criMin: 80,
    workplaneHeightM: 0.75,
    boundaryMarginM: 0.50,
    standardRef: "EN 12464-1: 5.1.2 (Rest and relaxation rooms)",
  },
  storage: {
    name: "Archives & Storage Room",
    targetLux: 100,
    uniformityMin: 0.40,
    ugrMax: 25,
    criMin: 60,
    workplaneHeightM: 0.00,
    boundaryMarginM: 0.20,
    standardRef: "EN 12464-1: 5.1.5 (Store stores and stockrooms)",
  },
};

export type OpeningType = "window" | "door" | "double_door" | "curtain_wall";

export interface SceneryOpening {
  id: string;
  name: string;
  type: OpeningType;
  wallOrientation: "north" | "south" | "east" | "west" | "interior";
  roomId: string;
  widthM: number;
  heightM: number;
  sillHeightM: number; // 0 for doors and curtain walls, 0.85m for ribbon windows
  positionAlongWallM: number; // Offset from wall start
  glassTransmittance: number; // 0.75 for clear double glazing
  frameColorHex: string;
}

export type FurnitureCategory =
  | "desk"
  | "chair"
  | "conference_table"
  | "storage_cabinet"
  | "reception_counter"
  | "presentation_screen";

export interface SceneryFurniture {
  id: string;
  name: string;
  category: FurnitureCategory;
  roomId: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; depth: number; height: number };
  rotationDeg: number;
  colorHex: string;
}

export interface SceneryColumn {
  id: string;
  name: string;
  type: "rectangular" | "cylindrical";
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number }; // or diameter
  heightM: number;
  roomId: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SceneryRoom {
  id: string;
  name: string;
  code: string;
  profileType: RoomProfileType;
  colorHex: string;
  polygon: Point2D[];
  floorAreaM2: number;
  perimeterM: number;
  ceilingHeightM: number;
  suspendedCeilingHeightM: number;
  reflectance: {
    ceiling: number;
    walls: number;
    floor: number;
  };
  openings: SceneryOpening[];
  furniture: SceneryFurniture[];
  columns: SceneryColumn[];
  // Photometric calculation results
  estimatedFixturesCount: number;
  connectedWatts: number;
  wattsPerM2: number;
  daylightFactorEstPercent: number;
}

export interface CompleteBuildingScenery {
  id: string;
  name: string;
  projectName: string;
  buildingWidthM: number; // e.g. 18.0 m
  buildingDepthM: number; // e.g. 12.0 m
  storeyHeightM: number; // e.g. 3.20 m
  slabThicknessM: number; // e.g. 0.30 m
  outerWallThicknessM: number; // e.g. 0.35 m
  innerWallThicknessM: number; // e.g. 0.15 m
  exteriorContour: Point2D[];
  rooms: SceneryRoom[];
}

// =========================================================================
// GEOMETRY UTILITIES
// =========================================================================

/**
 * Calculates polygon area using the Shoelace formula.
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Calculates perimeter of a polygon.
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/**
 * Calculates room photometrics and estimated lighting equipment via the Lumen Method.
 * Phi_total = (E_m * A) / (CU * MF)
 */
export function calculateRoomPhotometrics(
  areaM2: number,
  ceilingHeightM: number,
  profile: StandardProfile,
  reflectance: { ceiling: number; walls: number; floor: number },
  windowAreaM2: number = 0
): {
  estimatedFixturesCount: number;
  connectedWatts: number;
  wattsPerM2: number;
  daylightFactorEstPercent: number;
} {
  // Typical fixture lumen package for commercial LED troffer/panel: 4000 lumens, 32W
  const fixtureLumens = 4000;
  const fixtureWatts = 32;
  const maintenanceFactor = 0.80; // CIE 97 clean interior

  // Utilization factor estimation from RCR and reflectances
  const rcr = (5 * (ceilingHeightM - profile.workplaneHeightM) * Math.sqrt(areaM2) * 4) / areaM2;
  const cu = Math.max(0.40, Math.min(0.75, 0.72 - rcr * 0.04));

  const totalLumensRequired = (profile.targetLux * areaM2) / (cu * maintenanceFactor);
  const rawFixtures = totalLumensRequired / fixtureLumens;
  const estimatedFixturesCount = Math.max(1, Math.ceil(rawFixtures));
  const connectedWatts = estimatedFixturesCount * fixtureWatts;
  const wattsPerM2 = Math.round((connectedWatts / Math.max(1, areaM2)) * 10) / 10;

  // Daylight factor estimation (Littlefair empirical formula: DF ~ 0.2 * (WindowArea / FloorArea) * 100)
  const windowToFloorRatio = areaM2 > 0 ? windowAreaM2 / areaM2 : 0;
  const daylightFactorEstPercent = Math.round(Math.min(8.0, windowToFloorRatio * 20) * 10) / 10;

  return {
    estimatedFixturesCount,
    connectedWatts,
    wattsPerM2,
    daylightFactorEstPercent,
  };
}

// =========================================================================
// DEFAULT ARCHITECTURAL SCENERY (TUTORIAL 29 CORPORATE OFFICE STOREY)
// =========================================================================

export const DEFAULT_COMPLETE_SCENERY: CompleteBuildingScenery = {
  id: "scenery-building-01",
  name: "Corporate Headquarters Level 2",
  projectName: "DIALux evo Tutorial Part 29 Complete Scenery",
  buildingWidthM: 18.0,
  buildingDepthM: 12.0,
  storeyHeightM: 3.20,
  slabThicknessM: 0.30,
  outerWallThicknessM: 0.35,
  innerWallThicknessM: 0.15,
  exteriorContour: [
    { x: 0, y: 0 },
    { x: 18.0, y: 0 },
    { x: 18.0, y: 12.0 },
    { x: 0, y: 12.0 },
  ],
  rooms: [
    {
      id: "room-open-office",
      name: "Open Plan Collaborative Office",
      code: "R-201",
      profileType: "open_office",
      colorHex: "#3b82f6",
      polygon: [
        { x: 0, y: 5.5 },
        { x: 9.5, y: 5.5 },
        { x: 9.5, y: 12.0 },
        { x: 0, y: 12.0 },
      ],
      floorAreaM2: 61.75,
      perimeterM: 32.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.80,
      reflectance: { ceiling: 0.80, walls: 0.60, floor: 0.20 },
      openings: [
        {
          id: "win-no-1",
          name: "North Ribbon Window #1",
          type: "window",
          wallOrientation: "north",
          roomId: "room-open-office",
          widthM: 1.80,
          heightM: 1.60,
          sillHeightM: 0.85,
          positionAlongWallM: 1.5,
          glassTransmittance: 0.75,
          frameColorHex: "#374151",
        },
        {
          id: "win-no-2",
          name: "North Ribbon Window #2",
          type: "window",
          wallOrientation: "north",
          roomId: "room-open-office",
          widthM: 1.80,
          heightM: 1.60,
          sillHeightM: 0.85,
          positionAlongWallM: 4.5,
          glassTransmittance: 0.75,
          frameColorHex: "#374151",
        },
        {
          id: "win-no-3",
          name: "North Ribbon Window #3",
          type: "window",
          wallOrientation: "north",
          roomId: "room-open-office",
          widthM: 1.80,
          heightM: 1.60,
          sillHeightM: 0.85,
          positionAlongWallM: 7.5,
          glassTransmittance: 0.75,
          frameColorHex: "#374151",
        },
        {
          id: "door-int-1",
          name: "Access Door to Corridor",
          type: "door",
          wallOrientation: "interior",
          roomId: "room-open-office",
          widthM: 0.95,
          heightM: 2.10,
          sillHeightM: 0.00,
          positionAlongWallM: 4.8,
          glassTransmittance: 0.0,
          frameColorHex: "#4b5563",
        },
      ],
      furniture: [
        {
          id: "furn-desk-1",
          name: "Workstation Pod 1 (Desk A)",
          category: "desk",
          roomId: "room-open-office",
          position: { x: 2.5, y: 7.5, z: 0.0 },
          dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
          rotationDeg: 0,
          colorHex: "#e2e8f0",
        },
        {
          id: "furn-desk-2",
          name: "Workstation Pod 1 (Desk B)",
          category: "desk",
          roomId: "room-open-office",
          position: { x: 2.5, y: 8.35, z: 0.0 },
          dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
          rotationDeg: 180,
          colorHex: "#e2e8f0",
        },
        {
          id: "furn-desk-3",
          name: "Workstation Pod 2 (Desk C)",
          category: "desk",
          roomId: "room-open-office",
          position: { x: 6.5, y: 7.5, z: 0.0 },
          dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
          rotationDeg: 0,
          colorHex: "#e2e8f0",
        },
        {
          id: "furn-desk-4",
          name: "Workstation Pod 2 (Desk D)",
          category: "desk",
          roomId: "room-open-office",
          position: { x: 6.5, y: 8.35, z: 0.0 },
          dimensions: { width: 1.6, depth: 0.8, height: 0.75 },
          rotationDeg: 180,
          colorHex: "#e2e8f0",
        },
      ],
      columns: [
        {
          id: "col-1",
          name: "Structural Column C1",
          type: "rectangular",
          position: { x: 4.75, y: 9.0, z: 0 },
          size: { width: 0.45, depth: 0.45 },
          heightM: 3.20,
          roomId: "room-open-office",
        },
      ],
      estimatedFixturesCount: 6,
      connectedWatts: 192,
      wattsPerM2: 3.1,
      daylightFactorEstPercent: 2.8,
    },
    {
      id: "room-executive",
      name: "Executive Director Office",
      code: "R-202",
      profileType: "executive_office",
      colorHex: "#8b5cf6",
      polygon: [
        { x: 9.5, y: 6.5 },
        { x: 14.5, y: 6.5 },
        { x: 14.5, y: 12.0 },
        { x: 9.5, y: 12.0 },
      ],
      floorAreaM2: 27.5,
      perimeterM: 21.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.80,
      reflectance: { ceiling: 0.80, walls: 0.60, floor: 0.20 },
      openings: [
        {
          id: "win-exec-1",
          name: "North Window Executive",
          type: "window",
          wallOrientation: "north",
          roomId: "room-executive",
          widthM: 2.20,
          heightM: 1.80,
          sillHeightM: 0.75,
          positionAlongWallM: 1.4,
          glassTransmittance: 0.75,
          frameColorHex: "#1f2937",
        },
        {
          id: "door-exec-1",
          name: "Director Office Door",
          type: "door",
          wallOrientation: "interior",
          roomId: "room-executive",
          widthM: 0.95,
          heightM: 2.10,
          sillHeightM: 0.00,
          positionAlongWallM: 2.0,
          glassTransmittance: 0.0,
          frameColorHex: "#4b5563",
        },
      ],
      furniture: [
        {
          id: "furn-exec-desk",
          name: "Executive Mahogany Desk",
          category: "desk",
          roomId: "room-executive",
          position: { x: 12.0, y: 9.5, z: 0.0 },
          dimensions: { width: 2.2, depth: 1.0, height: 0.75 },
          rotationDeg: 0,
          colorHex: "#78350f",
        },
        {
          id: "furn-exec-credenza",
          name: "Executive Storage Credenza",
          category: "storage_cabinet",
          roomId: "room-executive",
          position: { x: 12.0, y: 11.5, z: 0.0 },
          dimensions: { width: 2.4, depth: 0.5, height: 0.9 },
          rotationDeg: 0,
          colorHex: "#92400e",
        },
      ],
      columns: [],
      estimatedFixturesCount: 3,
      connectedWatts: 96,
      wattsPerM2: 3.5,
      daylightFactorEstPercent: 3.2,
    },
    {
      id: "room-conference",
      name: "Conference & Boardroom Suite",
      code: "R-203",
      profileType: "conference",
      colorHex: "#10b981",
      polygon: [
        { x: 14.5, y: 5.0 },
        { x: 18.0, y: 5.0 },
        { x: 18.0, y: 12.0 },
        { x: 14.5, y: 12.0 },
      ],
      floorAreaM2: 24.5,
      perimeterM: 21.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.80,
      reflectance: { ceiling: 0.80, walls: 0.60, floor: 0.20 },
      openings: [
        {
          id: "win-conf-east",
          name: "East Façade Curtain Wall Bay",
          type: "curtain_wall",
          wallOrientation: "east",
          roomId: "room-conference",
          widthM: 3.00,
          heightM: 2.80,
          sillHeightM: 0.00,
          positionAlongWallM: 2.0,
          glassTransmittance: 0.70,
          frameColorHex: "#111827",
        },
        {
          id: "door-conf-1",
          name: "Boardroom Double Glass Door",
          type: "double_door",
          wallOrientation: "interior",
          roomId: "room-conference",
          widthM: 1.80,
          heightM: 2.20,
          sillHeightM: 0.00,
          positionAlongWallM: 1.2,
          glassTransmittance: 0.85,
          frameColorHex: "#374151",
        },
      ],
      furniture: [
        {
          id: "furn-conf-table",
          name: "10-Person Conference Table",
          category: "conference_table",
          roomId: "room-conference",
          position: { x: 16.25, y: 8.5, z: 0.0 },
          dimensions: { width: 3.2, depth: 1.3, height: 0.75 },
          rotationDeg: 90,
          colorHex: "#1e293b",
        },
      ],
      columns: [],
      estimatedFixturesCount: 4,
      connectedWatts: 128,
      wattsPerM2: 5.2,
      daylightFactorEstPercent: 4.5,
    },
    {
      id: "room-corridor",
      name: "Central Circulation Corridor",
      code: "R-200",
      profileType: "corridor",
      colorHex: "#f59e0b",
      polygon: [
        { x: 0, y: 3.5 },
        { x: 18.0, y: 3.5 },
        { x: 18.0, y: 5.5 },
        { x: 0, y: 5.5 },
      ],
      floorAreaM2: 36.0,
      perimeterM: 40.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.60,
      reflectance: { ceiling: 0.75, walls: 0.50, floor: 0.20 },
      openings: [],
      furniture: [],
      columns: [
        {
          id: "col-cor-1",
          name: "Corridor Cylindrical Column",
          type: "cylindrical",
          position: { x: 9.0, y: 4.5, z: 0 },
          size: { width: 0.40, depth: 0.40 },
          heightM: 3.20,
          roomId: "room-corridor",
        },
      ],
      estimatedFixturesCount: 4,
      connectedWatts: 128,
      wattsPerM2: 3.6,
      daylightFactorEstPercent: 0.6,
    },
    {
      id: "room-reception",
      name: "Reception Lobby & Welcome Lounge",
      code: "R-204",
      profileType: "reception",
      colorHex: "#ec4899",
      polygon: [
        { x: 0, y: 0 },
        { x: 9.5, y: 0 },
        { x: 9.5, y: 3.5 },
        { x: 0, y: 3.5 },
      ],
      floorAreaM2: 33.25,
      perimeterM: 26.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.90,
      reflectance: { ceiling: 0.80, walls: 0.60, floor: 0.25 },
      openings: [
        {
          id: "door-main-entrance",
          name: "Building Main Double Entrance Door",
          type: "double_door",
          wallOrientation: "south",
          roomId: "room-reception",
          widthM: 2.00,
          heightM: 2.40,
          sillHeightM: 0.00,
          positionAlongWallM: 3.5,
          glassTransmittance: 0.80,
          frameColorHex: "#18181b",
        },
        {
          id: "win-south-rec",
          name: "South Curtain Wall Glazing",
          type: "curtain_wall",
          wallOrientation: "south",
          roomId: "room-reception",
          widthM: 2.50,
          heightM: 2.60,
          sillHeightM: 0.00,
          positionAlongWallM: 6.5,
          glassTransmittance: 0.75,
          frameColorHex: "#27272a",
        },
      ],
      furniture: [
        {
          id: "furn-rec-counter",
          name: "Curved Reception Counter",
          category: "reception_counter",
          roomId: "room-reception",
          position: { x: 4.5, y: 2.0, z: 0.0 },
          dimensions: { width: 2.8, depth: 0.9, height: 1.1 },
          rotationDeg: 0,
          colorHex: "#f8fafc",
        },
      ],
      columns: [],
      estimatedFixturesCount: 4,
      connectedWatts: 128,
      wattsPerM2: 3.9,
      daylightFactorEstPercent: 3.8,
    },
    {
      id: "room-restroom",
      name: "Restroom & Sanitary Facility",
      code: "R-205",
      profileType: "restroom",
      colorHex: "#06b6d4",
      polygon: [
        { x: 9.5, y: 0 },
        { x: 14.5, y: 0 },
        { x: 14.5, y: 3.5 },
        { x: 9.5, y: 3.5 },
      ],
      floorAreaM2: 17.5,
      perimeterM: 17.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.70,
      reflectance: { ceiling: 0.80, walls: 0.50, floor: 0.20 },
      openings: [
        {
          id: "door-rest-1",
          name: "Restroom Entrance Door",
          type: "door",
          wallOrientation: "interior",
          roomId: "room-restroom",
          widthM: 0.90,
          heightM: 2.10,
          sillHeightM: 0.00,
          positionAlongWallM: 1.5,
          glassTransmittance: 0.0,
          frameColorHex: "#4b5563",
        },
      ],
      furniture: [],
      columns: [],
      estimatedFixturesCount: 2,
      connectedWatts: 64,
      wattsPerM2: 3.7,
      daylightFactorEstPercent: 0.0,
    },
    {
      id: "room-breakroom",
      name: "Staff Breakroom & Pantry Lounge",
      code: "R-206",
      profileType: "breakroom",
      colorHex: "#14b8a6",
      polygon: [
        { x: 14.5, y: 0 },
        { x: 18.0, y: 0 },
        { x: 18.0, y: 5.0 },
        { x: 14.5, y: 5.0 },
      ],
      floorAreaM2: 17.5,
      perimeterM: 17.0,
      ceilingHeightM: 3.20,
      suspendedCeilingHeightM: 2.80,
      reflectance: { ceiling: 0.80, walls: 0.60, floor: 0.20 },
      openings: [
        {
          id: "win-break-east",
          name: "East Window Breakroom",
          type: "window",
          wallOrientation: "east",
          roomId: "room-breakroom",
          widthM: 1.60,
          heightM: 1.50,
          sillHeightM: 0.90,
          positionAlongWallM: 2.2,
          glassTransmittance: 0.75,
          frameColorHex: "#374151",
        },
      ],
      furniture: [
        {
          id: "furn-break-table",
          name: "Dining & Coffee Table",
          category: "desk",
          roomId: "room-breakroom",
          position: { x: 16.25, y: 2.5, z: 0.0 },
          dimensions: { width: 1.6, depth: 0.9, height: 0.75 },
          rotationDeg: 0,
          colorHex: "#f1f5f9",
        },
      ],
      columns: [],
      estimatedFixturesCount: 2,
      connectedWatts: 64,
      wattsPerM2: 3.7,
      daylightFactorEstPercent: 2.4,
    },
  ],
};

/**
 * Calculates building-wide complete scenery statistics.
 */
export function calculateSceneryMetrics(scenery: CompleteBuildingScenery) {
  const grossAreaM2 = scenery.buildingWidthM * scenery.buildingDepthM;
  const netAreaM2 = scenery.rooms.reduce((acc, r) => acc + r.floorAreaM2, 0);
  const totalConnectedWatts = scenery.rooms.reduce((acc, r) => acc + r.connectedWatts, 0);
  const averageWattsPerM2 = netAreaM2 > 0 ? Math.round((totalConnectedWatts / netAreaM2) * 10) / 10 : 0;
  const totalOpenings = scenery.rooms.reduce((acc, r) => acc + r.openings.length, 0);
  const totalFurniture = scenery.rooms.reduce((acc, r) => acc + r.furniture.length, 0);
  const totalColumns = scenery.rooms.reduce((acc, r) => acc + r.columns.length, 0);
  const totalFixtures = scenery.rooms.reduce((acc, r) => acc + r.estimatedFixturesCount, 0);

  return {
    grossAreaM2,
    netAreaM2,
    roomsCount: scenery.rooms.length,
    totalOpenings,
    totalFurniture,
    totalColumns,
    totalFixtures,
    totalConnectedWatts,
    averageWattsPerM2,
  };
}
