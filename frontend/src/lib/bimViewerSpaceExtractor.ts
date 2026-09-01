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
  fixtures: string;
  multiplier: number;
  source: "3d-viewer" | "ifc-file" | "workspace";
}

/**
 * Filter out useless gross area calculation boundaries, duplicate area overlays, and unassigned polygons.
 */
export function isMepValidSpaceName(name: string): boolean {
  if (!name || name.trim() === "") return false;
  const n = name.trim().toUpperCase();

  // 1. Filter out gross area boundary codes and parenthesized area markers like "(A) USABLE AREA", "(B) BALCONY AREA"
  if (/^\([A-Z0-9]+\)/i.test(n)) {
    return false;
  }

  // 2. Filter out generic area calculations or non-room boundary spaces
  const uselessTerms = [
    "USABLE AREA",
    "CIRCULATION AREA",
    "GROSS AREA",
    "NET AREA",
    "RENTABLE AREA",
    "TOTAL AREA",
    "SERVICE AREA",
    "BUILDING AREA",
    "EXTERIOR AREA",
    "SURFACE AREA",
    "OPEN TO BELOW",
    "UNASSIGNED",
    "NOT ASSIGNED",
    "NO NAME",
    "DUMMY",
    "VOID",
    "SHAFT",
    "IFCSPACE",
    "AREA CALCULATION",
    "GROSS BUILDING",
    "OVERLAY",
  ];

  for (const term of uselessTerms) {
    if (n === term || n.includes(term)) {
      return false;
    }
  }

  // Filter out single letter codes or pure boundary markers
  if (/^[A-Z]$/.test(n)) return false;

  return true;
}

/**
 * Classifies space airflow pressure class (Positive, Negative, Neutral)
 * based on TARV Revit Addin logic (AutoCreateZonesCommand.cs).
 */
export function predictSpacePressureClass(spaceName: string): { pressure: string; classType: "Positive" | "Negative" | "Neutral" } {
  const name = (spaceName || "").trim();
  if (!name) return { pressure: "+1", classType: "Positive" };

  const negativeKeywords = [
    "TOILET", "WASHROOM", "BATHROOM", "WC", "BATH", "RESTROOM",
    "LAUNDRY", "KITCHEN", "SERVICE KITCHEN", "GARBAGE", "REFUSE",
    "JANITOR", "CLEANER", "EXTRACT", "EXHAUST", "PANTRY", "SHOWER", "DIRTY"
  ];

  const neutralKeywords = [
    "CORRIDOR", "HALLWAY", "PASSAGE", "STAIRS", "STAIRCASE", "SHAFT", "VOID", "LIFT"
  ];

  const upper = name.toUpperCase();

  for (const kw of negativeKeywords) {
    if (upper.includes(kw)) {
      return { pressure: "-1", classType: "Negative" };
    }
  }

  for (const kw of neutralKeywords) {
    if (upper.includes(kw)) {
      return { pressure: "0", classType: "Neutral" };
    }
  }

  return { pressure: "+1", classType: "Positive" };
}

/**
 * Automatically groups extracted 3D spaces into HVAC Zones based on Airflow Pressure & Level Adjacency
 * following the TARV Revit Addin logic (AutoCreateZonesCommand.cs).
 */
export function applyAirflowAutoZoning<T extends Extracted3DSpace>(spaces: T[]): T[] {
  if (!spaces || spaces.length === 0) return [];

  // Group spaces by floor level
  const spacesByLevel = new Map<string, T[]>();
  spaces.forEach((sp) => {
    const lvl = (sp.level || "Ground Floor").trim();
    if (!spacesByLevel.has(lvl)) spacesByLevel.set(lvl, []);
    spacesByLevel.get(lvl)!.push(sp);
  });

  const zonedSpaces: T[] = [];

  spacesByLevel.forEach((levelSpaces, levelName) => {
    const positiveSpaces: T[] = [];
    const nonPositiveSpaces: T[] = [];

    levelSpaces.forEach((sp) => {
      const pressInfo = predictSpacePressureClass(sp.name);
      if (pressInfo.classType === "Positive") {
        positiveSpaces.push(sp);
      } else {
        nonPositiveSpaces.push(sp);
      }
    });

    const usedZoneNames = new Set<string>();

    const getZoneName = (baseName: string) => {
      const cleanBase = baseName.replace(/\s*(ZONE|\d+)$/i, "").trim();
      let name = `${cleanBase} Zone`;
      if (!usedZoneNames.has(name.toUpperCase())) {
        usedZoneNames.add(name.toUpperCase());
        return name;
      }
      let i = 1;
      while (true) {
        let test = `${cleanBase} Zone-${i}`;
        if (!usedZoneNames.has(test.toUpperCase())) {
          usedZoneNames.add(test.toUpperCase());
          return test;
        }
        i++;
      }
    };

    const posZoneMap = new Map<string, string>();
    positiveSpaces.forEach((posSp) => {
      const zName = getZoneName(posSp.name);
      posZoneMap.set(posSp.id, zName);
    });

    nonPositiveSpaces.forEach((npSp, idx) => {
      let targetZone = "";
      if (positiveSpaces.length > 0) {
        const targetPos = positiveSpaces[idx % positiveSpaces.length];
        targetZone = posZoneMap.get(targetPos.id) || `${levelName} Zone`;
      } else {
        targetZone = `${levelName} Zone`;
      }
      posZoneMap.set(npSp.id, targetZone);
    });

    levelSpaces.forEach((sp) => {
      const assignedZone = posZoneMap.get(sp.id) || `${levelName} Zone`;
      const pressInfo = predictSpacePressureClass(sp.name);
      zonedSpaces.push({
        ...sp,
        zone: (sp.zone && sp.zone.trim() !== "" && sp.zone.trim().toLowerCase() !== "default") ? sp.zone : assignedZone,
        pressure: pressInfo.pressure,
        pressureAutoDetected: true,
      });
    });
  });

  return sortSpacesByFloorAndName(zonedSpaces);
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
 * Extracts spaces from currently loaded 3D Viewer session or workspace store
 */
export function extractSpacesFromActiveViewer(): Extracted3DSpace[] {
  const spaces: Extracted3DSpace[] = [];

  const win = typeof window !== "undefined" ? (window as any) : {};
  const activeBimData = win.__BIM_VIEWER_SPACES__ || win.__BIM_VIEWER_MODEL_DATA__ || [];

  if (Array.isArray(activeBimData) && activeBimData.length > 0) {
    activeBimData.forEach((sp: any, idx: number) => {
      const rawName = String(sp.longName || sp.name || sp.number || `Space ${idx + 1}`).trim();
      if (!isMepValidSpaceName(rawName)) return;

      const levelName = String(sp.level || sp.storeyName || sp.levelName || "Ground Floor").trim();
      const zoneName = String(sp.zone || sp.zoneName || "Default").trim();
      const area = parseFloat(String(sp.area || sp.netArea || 0)) || 0;
      let height = parseFloat(String(sp.height || sp.unboundedHeight || 3.0)) || 3.0;
      if (height > 100) height = height / 1000;
      const occupants = sp.occupants || sp.people || sp.fixtures || "";

      const predCat = predictOccupancyCategory(rawName);
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
        fixtures: occupants ? String(occupants) : "",
        multiplier: 1,
        source: "3d-viewer",
      });
    });

    return applyAirflowAutoZoning(spaces);
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

    const spaces: Extracted3DSpace[] = [];

    spaceExpressIds.forEach((id, idx) => {
      const line = parser.getLine(id);
      if (!line) return;

      const longNameStr = String(line.LongName?.value || "").trim();
      const nameStr = String(line.Name?.value || "").trim();
      const objectTypeStr = String(line.ObjectType?.value || "").trim();
      
      const rawName = longNameStr || nameStr || objectTypeStr || `Space ${idx + 1}`;
      if (!isMepValidSpaceName(rawName)) return;

      const quantities = propMgr.getQuantities(id, relMgr.relDefines);
      const area = parseFloat(String(quantities.Area || quantities.NetArea || quantities.GrossArea || 0)) || 0;
      let height = parseFloat(String(quantities.Height || quantities.UnboundedHeight || 3.0)) || 3.0;
      if (height > 100) height = height / 1000;

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
        fixtures: occupants ? String(occupants) : "",
        multiplier: 1,
        source: "ifc-file",
      });
    });

    parser.closeModel();
    return applyAirflowAutoZoning(spaces);
  } catch (err) {
    console.warn("Dynamic web-ifc space extraction failed, falling back to active viewer:", err);
    return extractSpacesFromActiveViewer();
  }
}
