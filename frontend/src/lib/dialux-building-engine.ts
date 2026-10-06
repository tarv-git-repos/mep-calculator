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
  buildingL: number = 12.0,
  buildingW: number = 8.0,
  storeyH: number = 2.80
): BuildingModel {
  const exteriorContour: Point2D[] = [
    { x: 0, y: 0 },
    { x: buildingL, y: 0 },
    { x: buildingL, y: buildingW },
    { x: 0, y: buildingW },
  ];

  // Room 1: Open Office (West Wing: 7m x 5m)
  const room1Poly: Point2D[] = [
    { x: 0.2, y: 0.2 },
    { x: 7.2, y: 0.2 },
    { x: 7.2, y: 5.2 },
    { x: 0.2, y: 5.2 },
  ];
  const r1Box = computeBoundingBox(room1Poly);

  // Room 2: Conference Room (East Wing: 4.4m x 4.8m)
  const room2Poly: Point2D[] = [
    { x: 7.4, y: 0.2 },
    { x: 11.8, y: 0.2 },
    { x: 11.8, y: 5.0 },
    { x: 7.4, y: 5.0 },
  ];
  const r2Box = computeBoundingBox(room2Poly);

  // Room 3: Main Corridor (Access spine: 11.6m x 1.4m)
  const room3Poly: Point2D[] = [
    { x: 0.2, y: 5.4 },
    { x: 11.8, y: 5.4 },
    { x: 11.8, y: 6.6 },
    { x: 0.2, y: 6.6 },
  ];
  const r3Box = computeBoundingBox(room3Poly);

  // Room 4: Restroom & Service (South East: 4.4m x 1.1m)
  const room4Poly: Point2D[] = [
    { x: 7.4, y: 6.7 },
    { x: 11.8, y: 6.7 },
    { x: 11.8, y: 7.8 },
    { x: 7.4, y: 7.8 },
  ];
  const r4Box = computeBoundingBox(room4Poly);

  const defaultRooms: IndoorRoomContour[] = [
    {
      id: "room-open-office",
      name: "Main Open Office",
      storeyId: "storey-1",
      polygon: room1Poly,
      wallThickness: 0.15,
      height: storeyH,
      targetLux: 500,
      applicationProfile: "Offices - Writing, typing, reading data",
      areaM2: calculatePolygonArea(room1Poly),
      perimeterM: calculatePolygonPerimeter(room1Poly),
      color: "#3b82f6",
      originX: r1Box.minX,
      originY: r1Box.minY,
      length: r1Box.length,
      width: r1Box.width,
    },
    {
      id: "room-conference",
      name: "Conference Room",
      storeyId: "storey-1",
      polygon: room2Poly,
      wallThickness: 0.15,
      height: storeyH,
      targetLux: 500,
      applicationProfile: "Offices - Conference and meeting rooms",
      areaM2: calculatePolygonArea(room2Poly),
      perimeterM: calculatePolygonPerimeter(room2Poly),
      color: "#8b5cf6",
      originX: r2Box.minX,
      originY: r2Box.minY,
      length: r2Box.length,
      width: r2Box.width,
    },
    {
      id: "room-corridor",
      name: "Access Corridor",
      storeyId: "storey-1",
      polygon: room3Poly,
      wallThickness: 0.12,
      height: storeyH,
      targetLux: 100,
      applicationProfile: "Traffic zones and inside corridors",
      areaM2: calculatePolygonArea(room3Poly),
      perimeterM: calculatePolygonPerimeter(room3Poly),
      color: "#10b981",
      originX: r3Box.minX,
      originY: r3Box.minY,
      length: r3Box.length,
      width: r3Box.width,
    },
    {
      id: "room-restroom",
      name: "Restroom & Facilities",
      storeyId: "storey-1",
      polygon: room4Poly,
      wallThickness: 0.12,
      height: storeyH,
      targetLux: 200,
      applicationProfile: "Rest, sanitation and first aid rooms",
      areaM2: calculatePolygonArea(room4Poly),
      perimeterM: calculatePolygonPerimeter(room4Poly),
      color: "#06b6d4",
      originX: r4Box.minX,
      originY: r4Box.minY,
      length: r4Box.length,
      width: r4Box.width,
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
    name: "Corporate Building A",
    description: "Standard commercial multi-room storey matching DIALux evo Tutorial Part 3",
    exteriorContour,
    wallThicknessM: 0.25,
    totalHeightM: storeyH,
    storeys: [storey1],
    activeStoreyId: "storey-1",
    activeRoomId: defaultRooms[0].id,
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
