/**
 * DIALux evo Building & Storey Construction Engine
 * Implements building contours, storeys, multi-room indoor contours (EN 12464-1),
 * wall thickness extrusion, and geometric calculations matching DIALux evo Tutorial Part 3.
 */

export interface Point2D {
  x: number;
  y: number; // in floor plane, represents Z (width)
}

export interface IndoorRoomContour {
  id: string;
  name: string;
  storeyId: string;
  polygon: Point2D[];
  wallThickness: number; // meters (e.g. 0.15)
  height: number; // meters (e.g. 2.80)
  targetLux: number; // EN 12464-1 lux target
  applicationProfile: string; // e.g. "Offices - Writing, typing, reading data"
  areaM2: number;
  perimeterM: number;
  color: string;
  // Bounding box cache
  originX: number;
  originY: number;
  width: number;
  length: number;
}

export interface BuildingStorey {
  id: string;
  name: string;
  levelIndex: number; // 0 = Ground Floor, 1 = 1st Floor, etc.
  elevationM: number; // e.g. 0.00, 2.80, 5.60
  heightM: number; // e.g. 2.80
  floorThicknessM: number; // e.g. 0.20
  wallThicknessM: number; // exterior wall thickness (e.g. 0.25)
  rooms: IndoorRoomContour[];
}

export interface BuildingModel {
  id: string;
  name: string;
  description: string;
  exteriorContour: Point2D[];
  wallThicknessM: number; // exterior wall thickness (0.25m)
  totalHeightM: number;
  storeys: BuildingStorey[];
  activeStoreyId: string;
  activeRoomId: string;
}

/**
 * Calculates net polygon area using the standard Shoelace formula
 */
export function calculatePolygonArea(points: Point2D[]): number {
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
 * Calculates total polygon perimeter length in meters
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  if (!points || points.length < 2) return 0;
  let perimeter = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return Number(perimeter.toFixed(2));
}

/**
 * Computes axis-aligned bounding box for polygon vertices
 */
export function computeBoundingBox(points: Point2D[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  length: number;
} {
  if (!points || points.length === 0) {
    return { minX: 0, minY: 0, maxX: 5, maxY: 4, width: 4, length: 5 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    length: Number((maxX - minX).toFixed(2)),
    width: Number((maxY - minY).toFixed(2)),
  };
}

/**
 * Standard Room Application Presets matching EN 12464-1 & DIALux evo defaults
 */
export const ROOM_PRESETS_EN12464 = [
  {
    name: "Open Plan Office",
    appProfile: "Offices - Writing, typing, reading data",
    targetLux: 500,
    color: "#3b82f6",
    defaultWallThickness: 0.15,
  },
  {
    name: "Executive Office",
    appProfile: "Offices - Technical drawing & meetings",
    targetLux: 500,
    color: "#6366f1",
    defaultWallThickness: 0.15,
  },
  {
    name: "Conference & Meeting Room",
    appProfile: "Offices - Conference and meeting rooms",
    targetLux: 500,
    color: "#8b5cf6",
    defaultWallThickness: 0.15,
  },
  {
    name: "Circulation Corridor",
    appProfile: "Traffic zones and inside corridors",
    targetLux: 100,
    color: "#10b981",
    defaultWallThickness: 0.12,
  },
  {
    name: "Restroom & Sanitary",
    appProfile: "Rest, sanitation and first aid rooms",
    targetLux: 200,
    color: "#06b6d4",
    defaultWallThickness: 0.12,
  },
  {
    name: "Server & Electrical Room",
    appProfile: "Plant rooms, switchgear & transformers",
    targetLux: 200,
    color: "#f59e0b",
    defaultWallThickness: 0.20,
  },
  {
    name: "Breakroom & Cafeteria",
    appProfile: "Restrooms, staff lounges and canteens",
    targetLux: 200,
    color: "#ec4899",
    defaultWallThickness: 0.15,
  },
  {
    name: "Storage & Archive",
    appProfile: "Store rooms and archives",
    targetLux: 100,
    color: "#64748b",
    defaultWallThickness: 0.15,
  },
];

/**
 * Creates a complete default building model with exterior contour
 * and realistic indoor room contours (Office, Conference, Corridor, Restroom).
 */
export function createDefaultBuilding(
  buildingL: number = 6.0,
  buildingW: number = 4.0,
  storeyH: number = 2.80,
  roomName: string = "Space 1"
): BuildingModel {
  const L = Math.max(1, buildingL);
  const W = Math.max(1, buildingW);
  const exteriorContour: Point2D[] = [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: W },
    { x: 0, y: W },
  ];

  const mainRoomPoly: Point2D[] = [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: W },
    { x: 0, y: W },
  ];
  const rBox = computeBoundingBox(mainRoomPoly);

  const defaultRooms: IndoorRoomContour[] = [
    {
      id: "room-1",
      name: roomName,
      storeyId: "storey-1",
      polygon: mainRoomPoly,
      wallThickness: 0.15,
      height: storeyH,
      targetLux: 500,
      applicationProfile: "General Indoor Space",
      areaM2: calculatePolygonArea(mainRoomPoly),
      perimeterM: calculatePolygonPerimeter(mainRoomPoly),
      color: "#3b82f6",
      originX: rBox.minX,
      originY: rBox.minY,
      length: rBox.length,
      width: rBox.width,
    },
  ];

  const storey1: BuildingStorey = {
    id: "storey-1",
    name: "Storey 1 (Ground Floor)",
    levelIndex: 0,
    elevationM: 0.0,
    heightM: storeyH,
    floorThicknessM: 0.20,
    wallThicknessM: 0.25,
    rooms: defaultRooms,
  };

  return {
    id: "building-1",
    name: "Building Structure",
    description: "Architectural envelope aligned with room space",
    exteriorContour,
    wallThicknessM: 0.25,
    totalHeightM: storeyH,
    storeys: [storey1],
    activeStoreyId: "storey-1",
    activeRoomId: "room-1",
  };
}

/**
 * Duplicates a storey and all its rooms to a new floor elevation level
 */
export function duplicateStorey(
  building: BuildingModel,
  sourceStoreyId: string
): BuildingModel {
  const source = building.storeys.find((s) => s.id === sourceStoreyId) || building.storeys[0];
  const newIndex = building.storeys.length;
  const newElevation = Number((source.elevationM + source.heightM).toFixed(2));
  const newStoreyId = `storey-${newIndex + 1}`;

  const duplicatedRooms: IndoorRoomContour[] = source.rooms.map((r, idx) => ({
    ...r,
    id: `room-${newStoreyId}-${idx + 1}`,
    storeyId: newStoreyId,
    name: `${r.name} (Level ${newIndex})`,
    polygon: JSON.parse(JSON.stringify(r.polygon)),
  }));

  const newStorey: BuildingStorey = {
    id: newStoreyId,
    name: `Storey ${newIndex + 1} (Level ${newIndex})`,
    levelIndex: newIndex,
    elevationM: newElevation,
    heightM: source.heightM,
    floorThicknessM: source.floorThicknessM,
    wallThicknessM: source.wallThicknessM,
    rooms: duplicatedRooms,
  };

  return {
    ...building,
    totalHeightM: Number((building.totalHeightM + source.heightM).toFixed(2)),
    storeys: [...building.storeys, newStorey],
    activeStoreyId: newStoreyId,
    activeRoomId: duplicatedRooms[0]?.id || building.activeRoomId,
  };
}

/**
 * Adds an empty storey to the building
 */
export function addEmptyStorey(building: BuildingModel): BuildingModel {
  const last = building.storeys[building.storeys.length - 1];
  const newIndex = building.storeys.length;
  const newElevation = last ? Number((last.elevationM + last.heightM).toFixed(2)) : 0;
  const newStoreyId = `storey-${newIndex + 1}`;

  const newStorey: BuildingStorey = {
    id: newStoreyId,
    name: `Storey ${newIndex + 1} (Level ${newIndex})`,
    levelIndex: newIndex,
    elevationM: newElevation,
    heightM: last ? last.heightM : 2.8,
    floorThicknessM: 0.20,
    wallThicknessM: 0.25,
    rooms: [],
  };

  return {
    ...building,
    totalHeightM: Number((building.totalHeightM + newStorey.heightM).toFixed(2)),
    storeys: [...building.storeys, newStorey],
    activeStoreyId: newStoreyId,
  };
}
