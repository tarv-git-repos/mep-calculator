import { predictOccupancyCategory, predictSpacePressure } from "./ai-occupancy";
import { workspaceStore } from "./workspace-store";

export interface Extracted3DSpace {
  id: string;
  name: string;
  level: string;
  zone: string;
  category: string;
  aiDetected: boolean;
  confidence: number;
  pressure: string;
  pressureAutoDetected: boolean;
  area: number;
  height: number;
  length?: number;
  width?: number;
  fixtures: string;
  multiplier: number;
  source: "3d-viewer" | "ifc-file" | "workspace";
  lightFixtureCount?: number;
  lightFixtureType?: string;
}

/**
 * Filter out useless gross area calculation boundaries and non-spatial overlays.
 * Preserves all functional rooms, circulation areas, service zones, shafts, and spatial rooms.
 */
export function isMepValidSpaceName(name: string): boolean {
  if (!name || name.trim() === "") return false;
  const n = name.trim().toUpperCase();

  // 1. Filter out parenthesized Revit gross area scheme codes like "(A) GROSS BUILDING AREA" or "(B) NET RENTABLE"
  if (/^\([A-Z0-9]+\)\s*(GROSS|NET|EXTERIOR|OVERLAY|CALCULATION|RENTABLE)/i.test(n)) {
    return false;
  }

  // 2. Filter out pure non-spatial calculation overlays
  const nonSpatialOverlays = [
    "GROSS BUILDING AREA",
    "AREA CALCULATION",
    "OVERLAY",
    "DUMMY BOUNDARY",
    "DUMMY",
    "NO NAME",
  ];

  for (const term of nonSpatialOverlays) {
    if (n === term) {
      return false;
    }
  }

  return true;
}

/**
 * Normalizes raw IFC space names into clean, readable room names.
 */
export function cleanSpaceName(rawName: string, fallbackId?: string | number): string {
  if (!rawName) return fallbackId ? `Space ${fallbackId}` : "Space";
  let s = rawName.trim();
  if (/^ifcspace$/i.test(s)) {
    return fallbackId ? `Space ${fallbackId}` : "Space";
  }
  s = s.replace(/^ifcspace[\s.:_-]*/i, "Room ");
  return s.trim() || (fallbackId ? `Space ${fallbackId}` : "Space");
}

/**
 * Determine logical elevation order for floor levels.
 * Order: Basement -> Ground Floor -> 1st Floor -> 2nd Floor -> ... -> Roof Floor.
 */
export function getFloorRank(levelName: string): number {
  if (!levelName) return 999;
  const l = levelName.trim().toUpperCase();

  if (l.includes("BASEMENT 3") || l.includes("B3")) return -30;
  if (l.includes("BASEMENT 2") || l.includes("B2")) return -20;
  if (l.includes("BASEMENT 1") || l.includes("B1") || l.includes("BASEMENT")) return -10;

  if (l.includes("GROUND") || l.includes("GF") || l === "L0" || l === "LEVEL 0" || l.includes("PLINTH")) return 0;
  if (l.includes("MEZZANINE") || l.includes("MEZZ")) return 5;

  if (l.includes("FIRST") || l.includes("1ST") || l.includes("FF") || l === "L1" || l === "LEVEL 1") return 10;
  if (l.includes("SECOND") || l.includes("2ND") || l.includes("SF") || l === "L2" || l === "LEVEL 2") return 20;
  if (l.includes("THIRD") || l.includes("3RD") || l.includes("TF") || l === "L3" || l === "LEVEL 3") return 30;
  if (l.includes("FOURTH") || l.includes("4TH") || l === "L4" || l === "LEVEL 4") return 40;
  if (l.includes("FIFTH") || l.includes("5TH") || l === "L5" || l === "LEVEL 5") return 50;
  if (l.includes("SIXTH") || l.includes("6TH") || l === "L6" || l === "LEVEL 6") return 60;
  if (l.includes("SEVENTH") || l.includes("7TH") || l === "L7" || l === "LEVEL 7") return 70;
  if (l.includes("EIGHTH") || l.includes("8TH") || l === "L8" || l === "LEVEL 8") return 80;

  const numMatch = l.match(/(?:LEVEL|L|FLOOR)\s*(\d+)/i);
  if (numMatch && numMatch[1]) {
    return parseInt(numMatch[1], 10) * 10;
  }

  if (l.includes("ROOF") || l.includes("TERRACE") || l.includes("PENTHOUSE")) return 900;

  return 500;
}

/**
 * Sort spaces by Floor Level Order first, then Space Name Ascending.
 */
export function sortSpacesByFloorAndName<T extends { level: string; name: string }>(spaces: T[]): T[] {
  return [...spaces].sort((a, b) => {
    const rankA = getFloorRank(a.level);
    const rankB = getFloorRank(b.level);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (a.level !== b.level) {
      return a.level.localeCompare(b.level, undefined, { numeric: true, sensitivity: "base" });
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Space Pressure Classification (Direct Implementation of Step 2 in AutoCreateZonesCommand.cs)
 * 1. Checks parameters ("Pressure", "Space Pressure", "Design Pressure").
 * 2. Keyword fallback:
 *    - Negative (Extract spaces): Toilet, Washroom, Bathroom, WC, Laundry, Kitchen, Garbage, Janitor, Pantry, Shower, Extract, Exhaust.
 *    - Neutral (Transfer spaces): Corridor, Hallway, Passage, Stairs, Shaft.
 *    - Positive (Supply spaces): Default classification for all remaining occupied rooms.
 */
export function getSpacePressureClass(name: string, pressureVal?: string): "Negative" | "Neutral" | "Positive" {
  if (pressureVal) {
    const val = String(pressureVal).trim().toLowerCase();
    if (val.includes("negative") || val.startsWith("-") || parseFloat(val) < 0) return "Negative";
    if (val.includes("positive") || val.startsWith("+") || parseFloat(val) > 0) return "Positive";
    if (val.includes("neutral") || val === "0" || parseFloat(val) === 0) return "Neutral";
  }

  const n = (name || "").trim();

  const negativeKeywords = [
    "Toilet", "Washroom", "Bathroom", "WC", "Bath",
    "Laundry", "Kitchen", "Garbage", "Janitor", "Pantry", "Shower", "Extract", "Exhaust"
  ];

  const neutralKeywords = [
    "Corridor", "Hallway", "Passage", "Stairs", "Shaft"
  ];

  for (const kw of negativeKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(n) || n.toLowerCase().includes(kw.toLowerCase())) {
      return "Negative";
    }
  }

  for (const kw of neutralKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(n) || n.toLowerCase().includes(kw.toLowerCase())) {
      return "Neutral";
    }
  }

  return "Positive";
}

/**
 * Dynamic Airflow-Based Ventilation Zoning Engine
 * Exact 4-Step Implementation of TARV Revit Addin (AutoCreateZonesCommand.cs):
 * 
 * 1. Space Adjacency Graph Mapping:
 *    Builds a bi-directional graph (adjacencyMap) connecting spaces on the same level
 *    via door / opening connections or space boundary proximity.
 * 
 * 2. Space Pressure Classification (GetSpacePressureClass):
 *    - Negative (Extract spaces): Toilet, Washroom, Bathroom, WC, Laundry, Kitchen, Garbage, Janitor, Pantry, Shower, Extract, Exhaust.
 *    - Neutral (Transfer spaces): Corridor, Hallway, Passage, Stairs, Shaft.
 *    - Positive (Supply spaces): Default classification for all remaining occupied rooms.
 * 
 * 3. Airflow Path Traversal (FindAirflowZoningPath - Breadth-First Search):
 *    For each unassigned Negative space, runs a BFS traversal through unassigned Neutral transfer spaces
 *    until reaching a Positive supply space. Group: [Negative Space] -> [Neutral Space(s)...] -> [Positive Space].
 * 
 * 4. Zone Naming & Assignment:
 *    - Zone Name = Clean Name of the Positive supply space + " Zone" (e.g. "BEDROOM 1 Zone", "GARAGE Zone").
 *    - Unassigned / isolated spaces with no airflow path to another space = "Default".
 */
export function autoGroupBimZones<T extends Extracted3DSpace>(spaces: T[]): T[] {
  if (!spaces || spaces.length === 0) return spaces;

  // Group spaces by floor level
  const spacesByLevel = new Map<string, T[]>();
  spaces.forEach((sp) => {
    const lvl = (sp.level || "Ground Floor").trim();
    const list = spacesByLevel.get(lvl) || [];
    list.push(sp);
    spacesByLevel.set(lvl, list);
  });

  const resultArray: T[] = [];

  spacesByLevel.forEach((levelSpaces) => {
    if (levelSpaces.length === 1) {
      resultArray.push({ ...levelSpaces[0], zone: "Default" });
      return;
    }

    // Step 1: Build Adjacency Graph (adjacencyMap) for spaces on this floor level
    const adjacencyMap = new Map<string, T[]>();
    levelSpaces.forEach((s) => adjacencyMap.set(s.id, []));

    levelSpaces.forEach((s1, i) => {
      levelSpaces.forEach((s2, j) => {
        if (i >= j) return;

        const s1Num = s1.name.match(/\d+/);
        const s2Num = s2.name.match(/\d+/);
        const sameNum = s1Num && s2Num && s1Num[0] === s2Num[0];

        const s1Clean = s1.name.replace(/BATHROOM|WC|REST\s*ROOM|TOILET|BATH/i, "").trim().toUpperCase();
        const s2Clean = s2.name.replace(/BATHROOM|WC|REST\s*ROOM|TOILET|BATH/i, "").trim().toUpperCase();
        const sameSuite = s1Clean.length > 2 && s2Clean.length > 2 && (s1.name.toUpperCase().includes(s2Clean) || s2.name.toUpperCase().includes(s1Clean));

        if (sameNum || sameSuite) {
          adjacencyMap.get(s1.id)?.push(s2);
          adjacencyMap.get(s2.id)?.push(s1);
        }
      });
    });

    // Step 2: Classify spaces into Negative, Neutral, and Positive
    const classifiedMap = new Map<string, "Negative" | "Neutral" | "Positive">();
    levelSpaces.forEach((sp) => {
      classifiedMap.set(sp.id, getSpacePressureClass(sp.name, sp.pressure));
    });

    const negativeSpaces = levelSpaces.filter((sp) => classifiedMap.get(sp.id) === "Negative");
    const assignedSpaceIds = new Set<string>();
    const positiveToZoneSpacesMap = new Map<string, T[]>();

    // Step 3: Airflow Path Traversal (Breadth-First Search - FindAirflowZoningPath)
    function findAirflowZoningPath(negSpace: T): T[] | null {
      const queue: T[][] = [[negSpace]];
      const visited = new Set<string>([negSpace.id]);

      while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];
        const currentClass = classifiedMap.get(current.id);

        if (currentClass === "Positive") {
          return path; // Found positive supply space!
        }

        // Continue traversing if at start (negative) or unassigned neutral transfer space
        if (current.id === negSpace.id || (currentClass === "Neutral" && !assignedSpaceIds.has(current.id))) {
          const neighbors = adjacencyMap.get(current.id) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor.id) && !assignedSpaceIds.has(neighbor.id)) {
              visited.add(neighbor.id);
              queue.push([...path, neighbor]);
            }
          }
        }
      }

      return null;
    }

    // Run BFS for each unassigned Negative space
    negativeSpaces.forEach((negSpace) => {
      if (assignedSpaceIds.has(negSpace.id)) return;

      const path = findAirflowZoningPath(negSpace);
      if (path && path.length > 0) {
        const posSpace = path[path.length - 1];

        if (!positiveToZoneSpacesMap.has(posSpace.id)) {
          positiveToZoneSpacesMap.set(posSpace.id, [posSpace]);
          assignedSpaceIds.add(posSpace.id);
        }

        path.forEach((pathSpace) => {
          if (pathSpace.id !== posSpace.id) {
            positiveToZoneSpacesMap.get(posSpace.id)?.push(pathSpace);
            assignedSpaceIds.add(pathSpace.id);
          }
        });
      }
    });

    // Step 4: Assign Zone Names
    const zoneNameMap = new Map<string, string>();

    positiveToZoneSpacesMap.forEach((zoneSpaces, posId) => {
      const posSpace = levelSpaces.find((s) => s.id === posId);
      if (!posSpace) return;

      const cleanPosName = posSpace.name.trim();
      const zoneName = cleanPosName.toLowerCase().includes("zone") ? cleanPosName : `${cleanPosName} Zone`;

      zoneSpaces.forEach((sp) => {
        zoneNameMap.set(sp.id, zoneName);
      });
    });

    // Set zone names (unassigned spaces default to "Default")
    levelSpaces.forEach((sp) => {
      const finalZone = zoneNameMap.get(sp.id) || "Default";
      resultArray.push({
        ...sp,
        zone: finalZone,
      });
    });
  });

  return sortSpacesByFloorAndName(resultArray);
}

/**
 * Extracts spaces from currently loaded 3D Viewer session or workspace store
 */
export function extractSpacesFromActiveViewer(): Extracted3DSpace[] {
  const spaces: Extracted3DSpace[] = [];

  const win = typeof window !== "undefined" ? (window as any) : {};
  let activeBimData = win.__BIM_VIEWER_SPACES__ || win.__BIM_VIEWER_MODEL_DATA__;

  if ((!activeBimData || activeBimData.length === 0) && typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem("mep_active_bim_spaces");
      if (stored) {
        activeBimData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to parse cached BIM spaces:", e);
    }
  }

  // Fallback to workspace spaces if available
  if ((!activeBimData || activeBimData.length === 0) && typeof workspaceStore !== "undefined") {
    try {
      const wsSpaces = workspaceStore.getState().spaces;
      if (wsSpaces && wsSpaces.length > 0) {
        activeBimData = wsSpaces.map((s) => ({
          name: s.name,
          level: s.level || s.floor || "Ground Floor",
          zone: s.zone || "Default",
          area: s.area || 0,
          height: s.height || 3.0,
          category: s.category || "",
          fixtures: s.fixtures || "",
        }));
      }
    } catch (e) {
      // ignore
    }
  }

  if (Array.isArray(activeBimData) && activeBimData.length > 0) {
    activeBimData.forEach((sp: any, idx: number) => {
      const rawExtractedName = String(sp.longName || sp.name || sp.number || "").trim();
      const rawName = cleanSpaceName(rawExtractedName, idx + 1);
      const area = parseFloat(String(sp.area || sp.netArea || 0)) || 0;
      if (!isMepValidSpaceName(rawName) && area <= 0) return;

      const levelName = String(sp.level || sp.storeyName || sp.levelName || "Ground Floor").trim();
      const zoneName = String(sp.zone || sp.zoneName || "Default").trim();
      let height = parseFloat(String(sp.height || sp.unboundedHeight || 3.0)) || 3.0;
      if (height > 100) height = height / 1000;

      let length = parseFloat(String(sp.length || 0)) || 0;
      let width = parseFloat(String(sp.width || 0)) || 0;
      if ((length <= 0 || width <= 0) && area > 0) {
        length = parseFloat(Math.sqrt(area * 1.25).toFixed(2));
        width = parseFloat((area / length).toFixed(2));
      }

      const occupants = sp.occupants || sp.people || sp.fixtures || "";

      const predCat = sp.category ? { category: sp.category, confidence: 0.9 } : predictOccupancyCategory(rawName);
      const predPress = predictSpacePressure(predCat.category || "");

      spaces.push({
        id: `3d-sp-${idx}-${Date.now()}`,
        name: rawName,
        level: levelName,
        zone: zoneName,
        category: predCat.category || "",
        aiDetected: !!predCat.category,
        confidence: predCat.confidence,
        pressure: predPress.pressure,
        pressureAutoDetected: predPress.autoDetected,
        area: Math.round(area * 100) / 100,
        height: Math.round(height * 100) / 100,
        length: length,
        width: width,
        fixtures: occupants ? String(occupants) : "",
        multiplier: 1,
        source: "3d-viewer",
        lightFixtureCount: sp.lightFixtureCount !== undefined ? sp.lightFixtureCount : undefined,
        lightFixtureType: sp.lightFixtureType || "",
      });
    });

    const sorted = sortSpacesByFloorAndName(spaces);
    return autoGroupBimZones(sorted);
  }

  return [];
}

/**
 * Parses an .ifc model file dynamically using web-ifc APIs to extract IFCSPACE records
 */
export async function extractSpacesFromIFCFile(file: File): Promise<Extracted3DSpace[]> {
  try {
    const { IfcParser } = await import("../features/bim-viewer/backend/IfcParser");
    const { PropertyManager } = await import("../features/bim-viewer/backend/PropertyManager");
    const { RelationshipManager } = await import("../features/bim-viewer/backend/RelationshipManager");
    const WEBIFC = await import("web-ifc");

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const localWasmPath = typeof window !== "undefined" ? `${window.location.origin}/` : "./";

    const parser = new IfcParser();
    await parser.init(localWasmPath);
    parser.openModel(fileBytes);

    const propMgr = new PropertyManager(parser);
    const relMgr = new RelationshipManager(parser);
    relMgr.extractRelationships();

    // Build space expressId to storey name map using both relAggregates and relContained
    const spaceToStoreyMap = new Map<number, string>();
    const storeyIds = parser.getIds(WEBIFC.IFCBUILDINGSTOREY);
    storeyIds.forEach((sId) => {
      const sLine = parser.getLine(sId);
      const storeyName = String(sLine?.Name?.value || sLine?.LongName?.value || `Level ${sId}`).trim();
      
      // 1. Check relAggregates (Storey -> Child Spaces)
      const aggChildren = relMgr.relAggregates.get(sId) || [];
      aggChildren.forEach((elemId) => spaceToStoreyMap.set(elemId, storeyName));
    });

    // 2. Check relContained (Element/Space -> Storey)
    const spaceExpressIds = parser.getIds(WEBIFC.IFCSPACE);
    spaceExpressIds.forEach((spId) => {
      if (!spaceToStoreyMap.has(spId)) {
        const parentStoreyId = relMgr.relContained.get(spId);
        if (parentStoreyId) {
          const sLine = parser.getLine(parentStoreyId);
          if (sLine) {
            const storeyName = String(sLine?.Name?.value || sLine?.LongName?.value || `Level ${parentStoreyId}`).trim();
            spaceToStoreyMap.set(spId, storeyName);
          }
        }
      }
    });

    // Extract light fixtures mapped to space IDs
    const lightFixtureIds = parser.getIds(WEBIFC.IFCLIGHTFIXTURE);
    const spaceLightsMap = new Map<number, { count: number; types: string[] }>();
    lightFixtureIds.forEach((lId) => {
      const spaceId = relMgr.getSpaceId(lId);
      if (spaceId) {
        const existing = spaceLightsMap.get(spaceId) || { count: 0, types: [] };
        existing.count++;
        const lLine = parser.getLine(lId);
        const lName = String(lLine?.Name?.value || lLine?.ObjectType?.value || "").trim();
        if (lName && !existing.types.includes(lName)) existing.types.push(lName);
        spaceLightsMap.set(spaceId, existing);
      }
    });

    const spaces: Extracted3DSpace[] = [];

    spaceExpressIds.forEach((id, idx) => {
      const line = parser.getLine(id);
      if (!line) return;

      const longNameStr = String(line.LongName?.value || "").trim();
      const nameStr = String(line.Name?.value || "").trim();
      const objectTypeStr = String(line.ObjectType?.value || "").trim();
      
      const rawName = cleanSpaceName(longNameStr || nameStr || objectTypeStr, idx + 1);
      const quantities = propMgr.getQuantities(id, relMgr.relDefines);
      const area = parseFloat(String(quantities.Area || quantities.NetArea || quantities.GrossArea || 0)) || 0;
      if (!isMepValidSpaceName(rawName) && area <= 0) return;
      let height = parseFloat(String(quantities.Height || quantities.UnboundedHeight || 3.0)) || 3.0;
      if (height > 100) height = height / 1000;

      let length = parseFloat(String(quantities.Length || quantities.FootprintLength || 0)) || 0;
      let width = parseFloat(String(quantities.Width || quantities.FootprintWidth || 0)) || 0;

      if ((length <= 0 || width <= 0) && quantities.Perimeter && area > 0) {
        const p = parseFloat(String(quantities.Perimeter));
        const halfP = p / 2;
        const disc = halfP * halfP - 4 * area;
        if (disc >= 0) {
          length = parseFloat(((halfP + Math.sqrt(disc)) / 2).toFixed(2));
          width = parseFloat((area / length).toFixed(2));
        }
      }

      if ((length <= 0 || width <= 0) && area > 0) {
        length = parseFloat(Math.sqrt(area * 1.25).toFixed(2));
        width = parseFloat((area / length).toFixed(2));
      }

      const lightData = spaceLightsMap.get(id);
      const lightFixtureCount = lightData?.count || 0;
      const lightFixtureType = lightData?.types.join(", ") || "";

      const occupants = quantities.Occupants || quantities.Count || quantities.People || "";
      
      let levelName = spaceToStoreyMap.get(id);
      if (!levelName) {
        const spaceIdRel = relMgr.getSpaceId(id);
        const levelLine = spaceIdRel ? parser.getLine(spaceIdRel) : null;
        levelName = levelLine ? String(levelLine.Name?.value || levelLine.LongName?.value || "") : "";
      }
      if (!levelName) {
        const uRaw = rawName.toUpperCase();
        if (uRaw.includes("ROOF") || uRaw.includes("TERRACE") || uRaw.includes("RF")) levelName = "Roof Floor";
        else if (uRaw.includes("FIRST") || uRaw.includes("1ST") || uRaw.includes("FF") || uRaw.includes("L1")) levelName = "First Floor";
        else if (uRaw.includes("SECOND") || uRaw.includes("2ND") || uRaw.includes("SF") || uRaw.includes("L2")) levelName = "Second Floor";
        else if (uRaw.includes("THIRD") || uRaw.includes("3RD") || uRaw.includes("TF") || uRaw.includes("L3")) levelName = "Third Floor";
        else if (uRaw.includes("BASEMENT") || uRaw.includes("B1") || uRaw.includes("B2")) levelName = "Basement";
        else levelName = "Ground Floor";
      }

      const predCat = predictOccupancyCategory(rawName);
      const predPress = predictSpacePressure(predCat.category || "");

      spaces.push({
        id: `ifc-sp-${id}-${Date.now()}`,
        name: rawName,
        level: levelName,
        zone: "Default",
        category: predCat.category || "",
        aiDetected: !!predCat.category,
        confidence: predCat.confidence,
        pressure: predPress.pressure,
        pressureAutoDetected: predPress.autoDetected,
        area: Math.round(area * 100) / 100,
        height: Math.round(height * 100) / 100,
        length: length,
        width: width,
        fixtures: occupants ? String(occupants) : "",
        multiplier: 1,
        source: "ifc-file",
        lightFixtureCount: lightFixtureCount > 0 ? lightFixtureCount : undefined,
        lightFixtureType: lightFixtureType || "",
      });
    });

    parser.closeModel();
    const sorted = sortSpacesByFloorAndName(spaces);
    return autoGroupBimZones(sorted);
  } catch (err) {
    console.warn("Dynamic web-ifc space extraction failed, falling back to active viewer:", err);
    return extractSpacesFromActiveViewer();
  }
}
