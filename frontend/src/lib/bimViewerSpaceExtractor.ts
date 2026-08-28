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
 * Extracts spaces from currently loaded 3D Viewer session or workspace store
 */
export function extractSpacesFromActiveViewer(): Extracted3DSpace[] {
  const spaces: Extracted3DSpace[] = [];

  // 1. Check window global 3D model cache if active
  const win = typeof window !== "undefined" ? (window as any) : {};
  const activeBimData = win.__BIM_VIEWER_SPACES__ || win.__BIM_VIEWER_MODEL_DATA__ || [];

  if (Array.isArray(activeBimData) && activeBimData.length > 0) {
    activeBimData.forEach((sp: any, idx: number) => {
      const rawName = String(sp.longName || sp.name || sp.number || `Space ${idx + 1}`).trim();
      const levelName = String(sp.level || sp.storeyName || sp.levelName || "Level 1").trim();
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
    return spaces;
  }

  return [];
}

/**
 * Parses an .ifc model file dynamically using web-ifc APIs to extract IFCSPACE records
 */
export async function extractSpacesFromIFCFile(file: File): Promise<Extracted3DSpace[]> {
  try {
    const { IfcParser } = await import("@/features/bim-viewer/backend/IfcParser");
    const { RelationshipManager } = await import("@/features/bim-viewer/backend/RelationshipManager");
    const { PropertyManager } = await import("@/features/bim-viewer/backend/PropertyManager");
    const WEBIFC = await import("web-ifc");

    const parser = new IfcParser();
    await parser.init();

    const arrayBuffer = await file.arrayBuffer();
    const modelId = parser.openModel(new Uint8Array(arrayBuffer));

    const relMgr = new RelationshipManager(parser);
    relMgr.extractRelationships();

    const propMgr = new PropertyManager(parser);

    // Build mapping from space ID to storey/level name
    const spaceToStoreyMap = new Map<number, string>();
    const storeyIds = parser.getIds(WEBIFC.IFCBUILDINGSTOREY);
    storeyIds.forEach((sId) => {
      const sLine = parser.getLine(sId);
      const sName = String(sLine?.Name?.value || sLine?.LongName?.value || "").trim();
      if (!sName) return;
      const children = relMgr.relAggregates.get(sId) || [];
      children.forEach((cId) => spaceToStoreyMap.set(cId, sName));
    });

    const spaceIds = parser.getIds(WEBIFC.IFCSPACE);
    const spaces: Extracted3DSpace[] = [];

    spaceIds.forEach((id, idx) => {
      const line = parser.getLine(id);
      if (!line) return;

      const longNameStr = String(line.LongName?.value || "").trim();
      const nameStr = String(line.Name?.value || "").trim();
      const objectTypeStr = String(line.ObjectType?.value || "").trim();
      
      // Prioritize descriptive LongName (e.g. FORMAL LIVING ROOM) over room code (e.g. GF04)
      const rawName = longNameStr || nameStr || objectTypeStr || `Space ${idx + 1}`;
      const quantities = propMgr.getQuantities(id, relMgr.relDefines);

      const area = parseFloat(String(quantities.Area || quantities.NetArea || quantities.GrossArea || 0)) || 0;
      let height = parseFloat(String(quantities.Height || quantities.UnboundedHeight || 3.0)) || 3.0;
      if (height > 100) height = height / 1000;

      const occupants = quantities.Occupants || quantities.Count || quantities.People || "";
      
      // Determine precise level name
      let levelName = spaceToStoreyMap.get(id);
      if (!levelName) {
        const spaceIdRel = relMgr.getSpaceId(id);
        const levelLine = spaceIdRel ? parser.getLine(spaceIdRel) : null;
        levelName = levelLine ? String(levelLine.Name?.value || levelLine.LongName?.value || "") : "";
      }
      if (!levelName) {
        if (/^GF/i.test(rawName)) levelName = "Ground Floor";
        else if (/^FF/i.test(rawName)) levelName = "First Floor";
        else if (/^SF/i.test(rawName)) levelName = "Second Floor";
        else if (/^B\d/i.test(rawName)) levelName = "Basement";
        else levelName = "Level 1";
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
    return spaces;
  } catch (err) {
    console.error("Error parsing IFC file for 3D spaces:", err);
    throw err;
  }
}
