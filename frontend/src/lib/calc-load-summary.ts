import { type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";
import type { TaskComment } from "@/lib/ventilation-calc";
import { workspaceStore } from "@/lib/workspace-store";
import {
  type Extracted3DSpace,
  extractSpacesFromActiveViewer,
  isMepValidSpaceName,
  getFloorRank,
} from "@/lib/bimViewerSpaceExtractor";

export interface LoadRow {
  id: string;
  floor?: string;
  description: string;
  qty: number;
  area: number;
  lighting: number;
  power: number;
  hvac: number;
  other: number;
  totalLoad: number;
  remarks: string;
  flagged?: boolean;
  comments?: TaskComment[];
  isLightingCustomized?: boolean;
  isPowerCustomized?: boolean;
  isHvacCustomized?: boolean;
  isOtherCustomized?: boolean;
}

/**
 * Cleans space name by removing redundant floor prefixes like [GROUND FLOOR], [FIRST FLOOR], [L01], "GROUND FLOOR - ", etc.
 */
export function cleanSpaceName(name: string): string {
  if (!name) return "";
  let cleaned = name.replace(/^\[.*?\]\s*/, "").trim();
  // Also clean prefix like "GROUND FLOOR - ", "1ST FLOOR: ", etc.
  cleaned = cleaned.replace(/^(?:BASEMENT\s*\d*|GROUND\s*FLOOR|FIRST\s*FLOOR|SECOND\s*FLOOR|THIRD\s*FLOOR|FOURTH\s*FLOOR|FIFTH\s*FLOOR|SIXTH\s*FLOOR|ROOF\s*(?:LEVEL|FLOOR)?|TYPICAL\s*FLOOR(?:\s*\([^)]*\))?|MEZZANINE|PODIUM|LEVEL\s*\d+|L\d+|B\d+|GF|FF|SF|TF)\s*[:\-\/]\s*/i, "").trim();
  return cleaned || name;
}

/**
 * Strips auto-generated calculation or BIM remarks so remarks remain clean for user entry
 */
export function cleanRemarks(remarks: string | undefined): string {
  if (!remarks) return "";
  const trimmed = remarks.trim();
  if (
    /^3D BIM/i.test(trimmed) ||
    /^From LPD/i.test(trimmed) ||
    /^Auto-Pulled/i.test(trimmed) ||
    /^ASHRAE 90\.1 & NEC Benchmark/i.test(trimmed)
  ) {
    return "";
  }
  return remarks;
}

/**
 * Extracts normalized floor level name from LoadRow or space description
 */
export function extractFloorName(row: Partial<LoadRow> | { floor?: string; description?: string }): string {
  if (row?.floor && typeof row.floor === "string" && row.floor.trim()) {
    return row.floor.trim().toUpperCase();
  }
  const desc = (row?.description || "").trim();
  const matchBracket = desc.match(/^\[(.*?)\]/);
  if (matchBracket && matchBracket[1]) {
    const raw = matchBracket[1].trim().toUpperCase();
    if (raw === "L01" || raw === "L1" || raw === "FF") return "FIRST FLOOR";
    if (raw === "L02" || raw === "L2" || raw === "SF") return "SECOND FLOOR";
    if (raw === "L03" || raw === "L3" || raw === "TF") return "THIRD FLOOR";
    if (raw === "L00" || raw === "GF" || raw === "L0") return "GROUND FLOOR";
    if (raw === "B1") return "BASEMENT 1";
    if (raw === "B2") return "BASEMENT 2";
    if (raw === "ROOF") return "ROOF LEVEL";
    return raw;
  }

  // Check prefix like "GROUND FLOOR - ", "1ST FLOOR / ", etc.
  const prefixMatch = desc.match(/^(BASEMENT\s*\d*|GROUND\s*FLOOR|FIRST\s*FLOOR|SECOND\s*FLOOR|THIRD\s*FLOOR|FOURTH\s*FLOOR|FIFTH\s*FLOOR|SIXTH\s*FLOOR|ROOF\s*(?:LEVEL|FLOOR)?|TYPICAL\s*FLOOR(?:\s*\([^)]*\))?|MEZZANINE|PODIUM|LEVEL\s*\d+|L\d+|B\d+|GF|FF|SF|TF)\s*[:\-\/]/i);
  if (prefixMatch && prefixMatch[1]) {
    const raw = prefixMatch[1].trim().toUpperCase();
    if (raw === "GF") return "GROUND FLOOR";
    if (raw === "FF" || raw === "L1" || raw === "L01") return "FIRST FLOOR";
    if (raw === "SF" || raw === "L2" || raw === "L02") return "SECOND FLOOR";
    if (raw === "TF" || raw === "L3" || raw === "L03") return "THIRD FLOOR";
    if (raw === "B1") return "BASEMENT 1";
    if (raw === "B2") return "BASEMENT 2";
    if (raw === "ROOF") return "ROOF LEVEL";
    return raw;
  }

  return "FIRST FLOOR";
}

/**
 * Sorts load rows floor-wise (Basement -> Ground -> 1st -> 2nd -> Roof)
 * and then alphabetically by space name inside each floor.
 */
export function sortLoadRowsFloorWise(rows: LoadRow[], direction: "asc" | "desc" = "asc"): LoadRow[] {
  return [...rows].sort((a, b) => {
    const floorA = extractFloorName(a);
    const floorB = extractFloorName(b);
    const rankA = getFloorRank(floorA);
    const rankB = getFloorRank(floorB);

    if (rankA !== rankB) {
      return direction === "asc" ? rankA - rankB : rankB - rankA;
    }

    if (floorA !== floorB) {
      const comp = floorA.localeCompare(floorB, undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? comp : -comp;
    }

    const nameA = cleanSpaceName(a.description || "");
    const nameB = cleanSpaceName(b.description || "");
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
  });
}

export interface SpaceBenchmark {
  lpd: number;          // Lighting Power Density (W/m²) per ASHRAE 90.1
  smallPower: number;   // Small Power / Sockets Density (W/m²) per NEC / DEWA
  hvacElectric: number; // HVAC Electrical Power Density (We/m²) [1 TR ≈ 3.51 kWth ≈ 1.2 kWe]
  otherEquipment: number; // Dedicated equipment allowance (kW)
  defaultCategory: string;
}

export const SPACE_BENCHMARKS: Record<string, SpaceBenchmark> = {
  office: {
    lpd: 7.0,
    smallPower: 18.0,
    hvacElectric: 34.0,
    otherEquipment: 0.0,
    defaultCategory: "General Office / Space",
  },
  meeting: {
    lpd: 7.5,
    smallPower: 10.0,
    hvacElectric: 48.0,
    otherEquipment: 0.5,
    defaultCategory: "Conference / Meeting Room",
  },
  server: {
    lpd: 6.0,
    smallPower: 500.0,
    hvacElectric: 135.0,
    otherEquipment: 5.0,
    defaultCategory: "Electrical / Switch Room",
  },
  corridor: {
    lpd: 4.5,
    smallPower: 2.0,
    hvacElectric: 17.0,
    otherEquipment: 0.0,
    defaultCategory: "Corridor / Circulation",
  },
  restroom: {
    lpd: 5.5,
    smallPower: 5.0,
    hvacElectric: 8.0,
    otherEquipment: 1.5, // Hand dryers / water heater
    defaultCategory: "Rest Room / Changing Room",
  },
  storage: {
    lpd: 4.0,
    smallPower: 3.0,
    hvacElectric: 10.0,
    otherEquipment: 0.0,
    defaultCategory: "Storage / Warehouse",
  },
  plant: {
    lpd: 5.0,
    smallPower: 10.0,
    hvacElectric: 12.0,
    otherEquipment: 3.0, // Pump / fan controls
    defaultCategory: "Mechanical Plant / AHU Room",
  },
  kitchen: {
    lpd: 8.0,
    smallPower: 35.0,
    hvacElectric: 60.0,
    otherEquipment: 5.0, // Kitchen appliances
    defaultCategory: "Commercial Kitchen / Pantry",
  },
  retail: {
    lpd: 10.0,
    smallPower: 25.0,
    hvacElectric: 42.0,
    otherEquipment: 1.0,
    defaultCategory: "Retail / Shop",
  },
};

/**
 * Categorizes a space by name / category and returns standard engineering benchmarks
 */
export function getSpaceTypeBenchmark(spaceName: string, category?: string): SpaceBenchmark {
  const text = `${spaceName || ""} ${category || ""}`.toLowerCase();

  if (/server|data\s*center|mdf|idf|telecom|ups|battery/i.test(text)) {
    return SPACE_BENCHMARKS.server;
  }
  if (/kitchen|pantry|canteen|cafeteria|dining/i.test(text)) {
    return SPACE_BENCHMARKS.kitchen;
  }
  if (/meeting|conference|board\s*room|seminar|huddle/i.test(text)) {
    return SPACE_BENCHMARKS.meeting;
  }
  if (/corridor|circulation|passage|hallway|lobby|vestibule|atrium|foyer/i.test(text)) {
    return SPACE_BENCHMARKS.corridor;
  }
  if (/toilet|restroom|washroom|wc|changing|bathroom|shower/i.test(text)) {
    return SPACE_BENCHMARKS.restroom;
  }
  if (/storage|store|warehouse|archive|janitor/i.test(text)) {
    return SPACE_BENCHMARKS.storage;
  }
  if (/plant|ahu|mechanical|electrical|switch|transformer|generator|pump|chiller|boiler/i.test(text)) {
    return SPACE_BENCHMARKS.plant;
  }
  if (/retail|shop|showroom|boutique/i.test(text)) {
    return SPACE_BENCHMARKS.retail;
  }

  return SPACE_BENCHMARKS.office;
}

export const computeRowOutputs = (row: LoadRow): LoadRow => {
  const qty = row.qty || 0;
  const lighting = row.lighting || 0;
  const power = row.power || 0;
  const hvac = row.hvac || 0;
  const other = row.other || 0;

  let totalLoad = 0;
  if (qty > 0) {
    totalLoad = qty * (lighting + power + hvac + other);
  } else {
    totalLoad = lighting + power + hvac + other;
  }

  return { ...row, totalLoad: Number(totalLoad.toFixed(2)) };
};

/**
 * Converts Extracted 3D BIM Spaces into LoadRow items for Load Summary,
 * sorted floor-wise by elevation and room name.
 */
export function convertBimSpacesToLoadRows(spaces: Extracted3DSpace[]): LoadRow[] {
  const sortedSpaces = [...spaces].sort((a, b) => {
    const rankA = getFloorRank(a.level);
    const rankB = getFloorRank(b.level);
    if (rankA !== rankB) return rankA - rankB;
    if (a.level !== b.level) return (a.level || "").localeCompare(b.level || "", undefined, { numeric: true, sensitivity: "base" });
    return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
  });

  return sortedSpaces.map((s, idx) => {
    const area = Math.max(0.1, Number(s.area) || 10);
    const qty = s.multiplier && s.multiplier > 0 ? s.multiplier : 1;
    const bench = getSpaceTypeBenchmark(s.name, s.category);
    const floor = (s.level || "GROUND FLOOR").toUpperCase().trim();

    // 1. Lighting Load (kW)
    let lightingKw = 0;
    if (s.lightFixtureCount && s.lightFixtureCount > 0) {
      lightingKw = Number(((s.lightFixtureCount * 36) / 1000).toFixed(2));
    } else {
      lightingKw = Number(((area * bench.lpd) / 1000).toFixed(2));
    }

    // 2. Small Power (kW)
    const powerKw = Number(((area * bench.smallPower) / 1000).toFixed(2));

    // 3. HVAC (kW)
    const hvacKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));

    // 4. Other (kW)
    const otherKw = bench.otherEquipment;

    const row: LoadRow = {
      id: `ls_3d_${Date.now()}_${idx}`,
      floor,
      description: cleanSpaceName(s.name),
      qty,
      area: Number(area.toFixed(2)),
      lighting: lightingKw,
      power: powerKw,
      hvac: hvacKw,
      other: otherKw,
      totalLoad: 0,
      remarks: "",
    };

    return computeRowOutputs(row);
  });
}

/**
 * Checks if 3D BIM spaces currently exist in session or storage
 */
export function hasActive3dSpaces(projectId: string = "default"): boolean {
  if (typeof window !== "undefined" && (window as any).__BIM_VIEWER_SPACES__?.length > 0) return true;
  if (typeof localStorage !== "undefined") {
    try {
      const p1 = localStorage.getItem(`mep_active_bim_spaces_${projectId}`);
      if (p1 && JSON.parse(p1).length > 0) return true;
      const p2 = localStorage.getItem("mep_active_bim_spaces");
      if (p2 && JSON.parse(p2).length > 0) return true;
    } catch {}
  }
  return false;
}

/**
 * Parses an IFC file dynamically and generates complete Load Summary rows
 */
export async function importIfcFileToLoadSummary(file: File, projectId: string = "default"): Promise<LoadRow[]> {
  const { extractSpacesFromIFCFile } = await import("./bimViewerSpaceExtractor");
  const extracted = await extractSpacesFromIFCFile(file);
  if (!extracted || extracted.length === 0) {
    throw new Error("No spaces (IFCSPACE) found in this IFC file.");
  }

  try {
    localStorage.setItem("mep_active_bim_spaces", JSON.stringify(extracted));
    localStorage.setItem(`mep_active_bim_spaces_${projectId}`, JSON.stringify(extracted));
  } catch (e) {}

  return convertBimSpacesToLoadRows(extracted);
}

/**
 * Retrieves spaces from Preliminary Cooling Load calculator (/preliminary-cooling-load)
 */
export function getPreliminaryCoolingLoadSpaces(projectId: string = "default"): any[] {
  if (typeof localStorage === "undefined") return [];
  const keys = [
    `mep_pcl_rows_${projectId}`,
    `mep_pcl_rows_default`,
    "pcl_rows",
  ];
  for (const k of keys) {
    try {
      const saved = localStorage.getItem(k);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((r) => r.name && String(r.name).trim() !== "");
          if (valid.length > 0) return valid;
        }
      }
    } catch {}
  }
  return [];
}

/**
 * Retrieves lighting loads from LPD calculation (or legacy Lux calculation)
 */
function getLightingLoadsMap(projectId: string = "default"): Map<string, { lightingKw: number; area?: number; fixtures?: number }> {
  const map = new Map<string, { lightingKw: number; area?: number; fixtures?: number }>();
  if (typeof localStorage === "undefined") return map;

  const pId = projectId || "default";

  // 1. Try LPD Calculator (primary)
  try {
    const lpdRaw = localStorage.getItem(`mep_lpd_calc_${pId}`) || localStorage.getItem("mep-lpd-calc-v2");
    if (lpdRaw) {
      const parsed = JSON.parse(lpdRaw);
      const projects = Array.isArray(parsed.projects) ? parsed.projects : (parsed.projects ? [parsed.projects] : []);
      const curProj = projects.find((p: any) => p.id === pId) || projects[0];
      if (curProj) {
        const allGroups = [...(curProj.internalGroups || []), ...(curProj.externalGroups || [])];
        allGroups.forEach((g: any) => {
          (g.spaces || []).forEach((s: any) => {
            const name = (s.name || "").trim().toLowerCase();
            const totalWatts = (s.fixtures || []).reduce(
              (sum: number, f: any) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
              0
            );
            if (name && totalWatts > 0) {
              map.set(name, {
                lightingKw: Number((totalWatts / 1000).toFixed(2)),
                area: parseFloat(s.areaSqM) || 0,
                fixtures: (s.fixtures || []).reduce((q: number, f: any) => q + (parseInt(f.qty) || 0), 0),
              });
            }
          });
        });
      }
    }
  } catch {}

  // 2. Fallback to Lux calculation
  try {
    const luxRaw = localStorage.getItem(`mep_lux_calc_${pId}`) || localStorage.getItem("mep_lux_calc_default");
    if (luxRaw) {
      const parsed = JSON.parse(luxRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((lr: any) => {
          const name = (lr.spaceName || lr.name || "").trim().toLowerCase();
          const kw = lr.calculatedWatts
            ? lr.calculatedWatts / 1000
            : ((lr.luminaireQty || 0) * (lr.luminaireWatts || 36)) / 1000;
          if (name && kw > 0 && !map.has(name)) {
            map.set(name, {
              lightingKw: Number(kw.toFixed(2)),
              area: Number(lr.area || (lr.length && lr.width ? lr.length * lr.width : 0)),
              fixtures: lr.luminaireQty,
            });
          }
        });
      }
    }
  } catch {}

  return map;
}

/**
 * Imports spaces directly from Preliminary Cooling Load calculation (/preliminary-cooling-load)
 * into unified LoadRow records.
 */
export function importFromPreliminaryCoolingLoad(projectId: string = "default"): LoadRow[] {
  const spaces = getPreliminaryCoolingLoadSpaces(projectId);
  if (spaces.length === 0) return [];

  // Fetch Lighting (LPD / Lux) schedule if available in workspace
  const lightingMap = getLightingLoadsMap(projectId);

  const rows: LoadRow[] = spaces.map((r, idx) => {
    const rawName = cleanSpaceName(r.name || `Space ${idx + 1}`);
    const floor = (r.floor || extractFloorName({ description: r.name }) || "GROUND FLOOR").toUpperCase().trim();
    const area = Math.max(0.1, Number(r.area) || 10);
    const bench = getSpaceTypeBenchmark(rawName, r.type);

    // 1. Lighting Load (kW)
    const lightEntry = lightingMap.get(rawName.toLowerCase());
    const lightingKw = lightEntry !== undefined ? lightEntry.lightingKw : Number(((area * bench.lpd) / 1000).toFixed(2));

    // 2. Small Power Sockets (kW)
    const powerKw = Number(((area * bench.smallPower) / 1000).toFixed(2));

    // 3. HVAC Electrical Load (kW):
    // From PCL, r.kw is the thermal cooling load. In electrical load estimation,
    // compressor/fan electrical input is thermal kW / COP (approx COP 3.0).
    let hvacKw = 0;
    if (r.kw && Number(r.kw) > 0) {
      hvacKw = Number((Number(r.kw) / 3.0).toFixed(2));
    } else if (r.tr && Number(r.tr) > 0) {
      hvacKw = Number((Number(r.tr) * 1.2).toFixed(2));
    } else {
      hvacKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));
    }

    // 4. Other dedicated equipment (kW)
    const otherKw = bench.otherEquipment;

    const row: LoadRow = {
      id: `ls_pcl_${Date.now()}_${idx}`,
      floor,
      description: rawName,
      qty: 1,
      area: Number(area.toFixed(2)),
      lighting: lightingKw,
      power: powerKw,
      hvac: hvacKw,
      other: otherKw,
      totalLoad: 0,
      remarks: "",
      flagged: Boolean(r.flagged),
    };

    return computeRowOutputs(row);
  });

  return sortLoadRowsFloorWise(rows);
}

/**
 * Retrieves spaces from Ventilation calculation (/ventilation)
 */
export function getVentilationSpaces(projectId: string = "default"): any[] {
  const wsSpaces = (workspaceStore.getState().spaces || []).filter(
    (s) => s.name && !/^new\s*space\s*\d+$/i.test(s.name.trim())
  );
  if (wsSpaces.length > 0) return wsSpaces;

  if (typeof localStorage !== "undefined") {
    const keys = [
      `mep_spaces_${projectId}`,
      `spaces_${projectId}`,
      "mep_spaces",
      "spaces",
    ];
    for (const k of keys) {
      try {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((s: any) => s.name && !/^new\s*space\s*\d+$/i.test(s.name.trim()));
            if (filtered.length > 0) return filtered;
          }
        }
      } catch {}
    }
  }
  return [];
}

/**
 * Imports spaces directly from Ventilation calculation (/ventilation)
 * into unified LoadRow records.
 */
export function importFromVentilationCalc(projectId: string = "default"): LoadRow[] {
  const spaces = getVentilationSpaces(projectId);
  if (spaces.length === 0) return [];

  // Fetch Lighting (LPD / Lux) if available
  const lightingMap = getLightingLoadsMap(projectId);

  const rows: LoadRow[] = spaces.map((sp, idx) => {
    const rawName = cleanSpaceName(sp.name || `Space ${idx + 1}`);
    const floor = (sp.floor || sp.level || extractFloorName({ description: sp.name }) || "GROUND FLOOR").toUpperCase().trim();
    const area = Math.max(0.1, Number(sp.area) || 15);
    const qty = sp.multiplier && sp.multiplier > 0 ? sp.multiplier : 1;
    const bench = getSpaceTypeBenchmark(sp.name, sp.category);

    const lightEntry = lightingMap.get(rawName.toLowerCase());
    const lightingKw = lightEntry !== undefined ? lightEntry.lightingKw : Number(((area * bench.lpd) / 1000).toFixed(2));
    const powerKw = Number(((area * bench.smallPower) / 1000).toFixed(2));

    let hvacKw = 0;
    if (sp.freshAir && sp.freshAir > 0) {
      const freshKw = sp.freshAir * 0.015;
      const spaceCoolingKw = (area * bench.hvacElectric) / 1000;
      hvacKw = Number(Math.max(freshKw, spaceCoolingKw).toFixed(2));
    } else {
      hvacKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));
    }

    const otherKw = bench.otherEquipment;

    const row: LoadRow = {
      id: `ls_vent_${Date.now()}_${idx}`,
      floor,
      description: rawName,
      qty,
      area: Number(area.toFixed(2)),
      lighting: lightingKw,
      power: powerKw,
      hvac: hvacKw,
      other: otherKw,
      totalLoad: 0,
      remarks: "",
      flagged: false,
    };

    return computeRowOutputs(row);
  });

  return sortLoadRowsFloorWise(rows);
}

/**
 * Creates realistic multi-room benchmark commercial office loads grouped by floor
 */
export function getCommercialBenchmarkLoads(): LoadRow[] {
  const templates = [
    { floor: "GROUND FLOOR", name: "Reception & Main Lobby", area: 85, category: "Corridor / Circulation", qty: 1 },
    { floor: "FIRST FLOOR", name: "Executive Boardroom", area: 65, category: "Conference / Meeting Room", qty: 1 },
    { floor: "FIRST FLOOR", name: "Main MDF / Server Room", area: 25, category: "Electrical / Switch Room", qty: 1 },
    { floor: "FIRST FLOOR", name: "Meeting Rooms (A & B)", area: 35, category: "Conference / Meeting Room", qty: 2 },
    { floor: "FIRST FLOOR", name: "Open Office Workstations", area: 320, category: "General Office / Space", qty: 1 },
    { floor: "FIRST FLOOR", name: "Restroom Blocks (Male & Female)", area: 30, category: "Rest Room / Changing Room", qty: 2 },
    { floor: "FIRST FLOOR", name: "Staff Breakout Pantry", area: 45, category: "Commercial Kitchen / Pantry", qty: 1 },
    { floor: "ROOF LEVEL", name: "Circulation Corridors & Lift Lobby", area: 110, category: "Corridor / Circulation", qty: 1 },
    { floor: "ROOF LEVEL", name: "Main Distribution Electrical Room", area: 20, category: "Electrical / Switch Room", qty: 1 },
    { floor: "ROOF LEVEL", name: "Primary AHU / Plant Room", area: 40, category: "Mechanical Plant / AHU Room", qty: 1 },
  ];

  const rows = templates.map((t, idx) => {
    const bench = getSpaceTypeBenchmark(t.name, t.category);
    const lightingKw = Number(((t.area * bench.lpd) / 1000).toFixed(2));
    const powerKw = Number(((t.area * bench.smallPower) / 1000).toFixed(2));
    const hvacKw = Number(((t.area * bench.hvacElectric) / 1000).toFixed(2));
    const otherKw = bench.otherEquipment;

    const row: LoadRow = {
      id: `ls_bench_${Date.now()}_${idx}`,
      floor: t.floor,
      description: t.name,
      qty: t.qty,
      area: t.area,
      lighting: lightingKw,
      power: powerKw,
      hvac: hvacKw,
      other: otherKw,
      totalLoad: 0,
      remarks: "",
    };
    return computeRowOutputs(row);
  });

  return sortLoadRowsFloorWise(rows);
}

/**
 * Intelligently aggregates data across 3D Studio, Lighting LUX / LPD, and HVAC Ventilation
 */
export function pullFromOtherCalculators(
  projectId: string = "default",
  existingRows: LoadRow[] = []
): {
  rows: LoadRow[];
  spacesUpdated: number;
  newSpacesAdded: number;
  lightingTotalKw: number;
  hvacTotalKw: number;
  sourceType: "3d-bim" | "calculators" | "workspace" | "none";
} {
  const pId = projectId || "default";

  // Check if existing rows are merely the default dummy placeholder spaces (New Space 1, 2, 3)
  const isOnlyDummyRows =
    existingRows.length === 0 ||
    existingRows.every((r) => /^(\[.+\]\s*)?new\s*space\s*\d+$/i.test(r.description.trim()));

  // 1. First priority: Check 3D BIM Spaces from active viewer or localStorage
  let bimSpaces: Extracted3DSpace[] = [];
  try {
    const fromViewer = extractSpacesFromActiveViewer(pId);
    if (fromViewer && fromViewer.length > 0) {
      bimSpaces = fromViewer;
    }
  } catch {}

  if (bimSpaces.length === 0 && typeof localStorage !== "undefined") {
    try {
      const storedProj = localStorage.getItem(`mep_active_bim_spaces_${pId}`);
      const storedGen = localStorage.getItem("mep_active_bim_spaces");
      const stored = storedProj || storedGen;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          bimSpaces = parsed;
        }
      }
    } catch {}
  }

  // 2. Fetch Lighting (LPD / Lux) rows if available
  const luxSpaces = getLightingLoadsMap(pId);

  // 3. Fetch Ventilation spaces from workspaceStore
  const wsSpaces = (workspaceStore.getState().spaces || []).filter(
    (s) => !/^new\s*space\s*\d+$/i.test(s.name.trim())
  );

  // CASE A: 3D BIM Spaces exist!
  if (bimSpaces.length > 0) {
    const valid3D = bimSpaces.filter(
      (s) => isMepValidSpaceName(s.name) && !/^new\s*space\s*\d+$/i.test(s.name.trim()) && s.area > 0.5
    );

    if (valid3D.length > 0) {
      const converted = convertBimSpacesToLoadRows(valid3D);
      // Enrich with Lux and Ventilation if available
      const enriched = converted.map((row) => {
        const rawName = row.description.replace(/^\[.*?\]\s*/, "").trim().toLowerCase();
        const luxMatch = luxSpaces.get(rawName) || luxSpaces.get(row.description.toLowerCase());
        if (luxMatch) {
          row.lighting = luxMatch.lightingKw;
        }
        const ventMatch = wsSpaces.find((s) => s.name.trim().toLowerCase() === rawName);
        if (ventMatch && ventMatch.freshAir && ventMatch.freshAir > 0) {
          const freshKw = ventMatch.freshAir * 0.015;
          if (freshKw > row.hvac) row.hvac = Number(freshKw.toFixed(2));
        }
        row.description = cleanSpaceName(row.description);
        return computeRowOutputs(row);
      });

      const sortedEnriched = sortLoadRowsFloorWise(enriched);
      const lightingTotalKw = sortedEnriched.reduce((sum, r) => sum + (r.lighting || 0) * (r.qty || 1), 0);
      const hvacTotalKw = sortedEnriched.reduce((sum, r) => sum + (r.hvac || 0) * (r.qty || 1), 0);

      return {
        rows: sortedEnriched,
        spacesUpdated: isOnlyDummyRows ? 0 : existingRows.length,
        newSpacesAdded: sortedEnriched.length,
        lightingTotalKw: Number(lightingTotalKw.toFixed(2)),
        hvacTotalKw: Number(hvacTotalKw.toFixed(2)),
        sourceType: "3d-bim",
      };
    }
  }

  // CASE A.2: Check Preliminary Cooling Load spaces (/preliminary-cooling-load)
  const pclRows = importFromPreliminaryCoolingLoad(pId);
  if (pclRows.length > 0) {
    const lightingTotalKw = pclRows.reduce((sum, r) => sum + (r.lighting || 0) * (r.qty || 1), 0);
    const hvacTotalKw = pclRows.reduce((sum, r) => sum + (r.hvac || 0) * (r.qty || 1), 0);
    return {
      rows: pclRows,
      spacesUpdated: isOnlyDummyRows ? 0 : existingRows.length,
      newSpacesAdded: pclRows.length,
      lightingTotalKw: Number(lightingTotalKw.toFixed(2)),
      hvacTotalKw: Number(hvacTotalKw.toFixed(2)),
      sourceType: "calculators",
    };
  }

  // CASE A.3: Check Ventilation Calculation spaces (/ventilation)
  const ventRows = importFromVentilationCalc(pId);
  if (ventRows.length > 0) {
    const lightingTotalKw = ventRows.reduce((sum, r) => sum + (r.lighting || 0) * (r.qty || 1), 0);
    const hvacTotalKw = ventRows.reduce((sum, r) => sum + (r.hvac || 0) * (r.qty || 1), 0);
    return {
      rows: ventRows,
      spacesUpdated: isOnlyDummyRows ? 0 : existingRows.length,
      newSpacesAdded: ventRows.length,
      lightingTotalKw: Number(lightingTotalKw.toFixed(2)),
      hvacTotalKw: Number(hvacTotalKw.toFixed(2)),
      sourceType: "workspace",
    };
  }

  // CASE A.5: Check LPD Calculator (mep-lpd-calc-v2) where BIM spaces may be cached
  let lpdSpacesList: LoadRow[] = [];
  if (typeof localStorage !== "undefined") {
    try {
      const lpdSaved = localStorage.getItem(`mep_lpd_calc_${pId}`) || localStorage.getItem("mep-lpd-calc-v2");
      if (lpdSaved) {
        const parsed = JSON.parse(lpdSaved);
        const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
        const curProj = projects.find((p: any) => p.id === pId) || projects[0];
        if (curProj) {
          const allGroups = [...(curProj.internalGroups || []), ...(curProj.externalGroups || [])];
          let rowIdx = 0;
          allGroups.forEach((g: any) => {
            const floorName = (g.name || "GROUND FLOOR").toUpperCase().trim();
            (g.spaces || []).forEach((s: any) => {
              const rawName = cleanSpaceName(s.name || "");
              if (!rawName || /^new\s*space\s*\d+$/i.test(rawName)) return;
              const area = Math.max(0.1, parseFloat(s.areaSqM) || 15);
              const bench = getSpaceTypeBenchmark(rawName, s.areaType);
              const totalWatts = (s.fixtures || []).reduce(
                (sum: number, f: any) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
                0
              );
              const lightingKw = totalWatts > 0
                ? Number((totalWatts / 1000).toFixed(2))
                : Number(((area * bench.lpd) / 1000).toFixed(2));
              const powerKw = Number(((area * bench.smallPower) / 1000).toFixed(2));
              const hvacKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));

              const row: LoadRow = {
                id: `ls_lpd_${Date.now()}_${rowIdx++}`,
                floor: floorName,
                description: rawName,
                qty: 1,
                area: Number(area.toFixed(2)),
                lighting: lightingKw,
                power: powerKw,
                hvac: hvacKw,
                other: bench.otherEquipment,
                totalLoad: 0,
                remarks: "",
                flagged: Boolean(s.flagged),
              };
              lpdSpacesList.push(computeRowOutputs(row));
            });
          });
        }
      }
    } catch {}
  }

  if (lpdSpacesList.length > 0) {
    const sorted = sortLoadRowsFloorWise(lpdSpacesList);
    const lightingTotalKw = sorted.reduce((sum, r) => sum + (r.lighting || 0) * (r.qty || 1), 0);
    const hvacTotalKw = sorted.reduce((sum, r) => sum + (r.hvac || 0) * (r.qty || 1), 0);

    return {
      rows: sorted,
      spacesUpdated: isOnlyDummyRows ? 0 : existingRows.length,
      newSpacesAdded: sorted.length,
      lightingTotalKw: Number(lightingTotalKw.toFixed(2)),
      hvacTotalKw: Number(hvacTotalKw.toFixed(2)),
      sourceType: "3d-bim",
    };
  }

  // CASE B: Non-dummy Ventilation or Lighting spaces exist!
  if (wsSpaces.length > 0 || luxSpaces.size > 0) {
    const rowMap = new Map<string, LoadRow>();
    if (!isOnlyDummyRows) {
      existingRows.forEach((r) => {
        rowMap.set(r.description.toLowerCase(), { ...r });
      });
    }

    let spacesUpdated = 0;
    let newSpacesAdded = 0;

    wsSpaces.forEach((sp: any, idx: number) => {
      const rawName = cleanSpaceName(sp.name || `Space ${idx + 1}`);
      const floor = sp.floor ? sp.floor.toUpperCase().trim() : "GROUND FLOOR";
      const fullName = `[${floor}] ${rawName}`.toLowerCase();
      const bench = getSpaceTypeBenchmark(sp.name, sp.category);
      const area = Math.max(0.1, Number(sp.area) || 15);
      const qty = sp.multiplier && sp.multiplier > 0 ? sp.multiplier : 1;

      const luxMatch = luxSpaces.get(rawName.toLowerCase()) || luxSpaces.get(fullName);
      const lightingKw = luxMatch ? luxMatch.lightingKw : Number(((area * bench.lpd) / 1000).toFixed(2));

      let hvacKw = 0;
      if (sp.freshAir && sp.freshAir > 0) {
        const freshKw = sp.freshAir * 0.015;
        const spaceCoolingKw = (area * bench.hvacElectric) / 1000;
        hvacKw = Number(Math.max(freshKw, spaceCoolingKw).toFixed(2));
      } else {
        hvacKw = Number(((area * bench.hvacElectric) / 1000).toFixed(2));
      }

      const powerKw = Number(((area * bench.smallPower) / 1000).toFixed(2));
      const otherKw = bench.otherEquipment;

      const existing = rowMap.get(fullName) || rowMap.get(rawName.toLowerCase());
      if (existing) {
        existing.area = Number(area.toFixed(2));
        existing.qty = qty;
        existing.lighting = lightingKw;
        existing.hvac = hvacKw;
        if (!existing.floor) existing.floor = floor;
        if (!existing.power || existing.power === 0) existing.power = powerKw;
        rowMap.set(fullName, computeRowOutputs(existing));
        spacesUpdated++;
      } else {
        const newRow: LoadRow = {
          id: `ls_agg_${Date.now()}_${idx}`,
          floor,
          description: rawName,
          qty,
          area: Number(area.toFixed(2)),
          lighting: lightingKw,
          power: powerKw,
          hvac: hvacKw,
          other: otherKw,
          totalLoad: 0,
          remarks: "",
        };
        rowMap.set(fullName, computeRowOutputs(newRow));
        newSpacesAdded++;
      }
    });

    const finalRows = sortLoadRowsFloorWise(Array.from(rowMap.values()));
    const lightingTotalKw = finalRows.reduce((sum, r) => sum + (r.lighting || 0) * (r.qty || 1), 0);
    const hvacTotalKw = finalRows.reduce((sum, r) => sum + (r.hvac || 0) * (r.qty || 1), 0);

    return {
      rows: finalRows,
      spacesUpdated,
      newSpacesAdded,
      lightingTotalKw: Number(lightingTotalKw.toFixed(2)),
      hvacTotalKw: Number(hvacTotalKw.toFixed(2)),
      sourceType: "calculators",
    };
  }

  // CASE C: No real spaces found anywhere in cache
  return {
    rows: existingRows,
    spacesUpdated: 0,
    newSpacesAdded: 0,
    lightingTotalKw: 0,
    hvacTotalKw: 0,
    sourceType: "none",
  };
}

/**
 * Prepares and saves data into Transformer Sizing (/transformer-sizing)
 */
export function exportToTransformerSizing(projectId: string = "default", rows: LoadRow[]) {
  const pId = projectId || "default";
  const transformerLoads = rows.map((r, idx) => ({
    id: `tr_load_${Date.now()}_${idx}`,
    description: r.description,
    lightingHeatingKw: Number(((r.lighting + r.other) * (r.qty || 1)).toFixed(2)),
    inductiveMotorKw: Number(((r.hvac + r.power) * (r.qty || 1)).toFixed(2)),
    connectedLoad: Number(r.totalLoad.toFixed(2)),
    diversityFactor: 0.9,
    demandFactor: 0.85,
    selected: false,
  }));

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`mep_transformer_loads_${pId}`, JSON.stringify(transformerLoads));
  }
  return transformerLoads;
}

/**
 * Prepares and saves emergency & critical loads into Generator Sizing (/generator-sizing)
 */
export function exportToGeneratorSizing(projectId: string = "default", rows: LoadRow[]) {
  const pId = projectId || "default";
  const generatorLoads = rows
    .filter((r) => {
      const text = r.description.toLowerCase();
      // Life safety, server rooms, HVAC, pumps, or stairwells
      return /server|plant|pump|stair|lift|elevator|critical|emergency|ahu|hvac/i.test(text) || r.hvac > 0;
    })
    .map((r, idx) => ({
      id: `gen_load_${Date.now()}_${idx}`,
      description: `[Backup] ${r.description}`,
      connectedKw: Number(r.totalLoad.toFixed(2)),
      emergencyKw: Number(((r.hvac + r.other + r.lighting * 0.3) * (r.qty || 1)).toFixed(2)), // Essential HVAC + 30% emergency lighting
      isEmergency: true,
      startingMethod: "DOL",
    }));

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`mep_generator_loads_${pId}`, JSON.stringify(generatorLoads));
  }
  return generatorLoads;
}

export const getCalculationPreview = (row: LoadRow, unitSystem: "si" | "ip", totalPower: number): CalculationPreviewData => {
  const qty = Number(row.qty) || 1;
  const area = Number(row.area) || 0;
  const lighting = Number(row.lighting) || 0;
  const power = Number(row.power) || 0;
  const hvac = Number(row.hvac) || 0;
  const other = Number(row.other) || 0;
  const unitLoad = lighting + power + hvac + other;
  const totalLoad = row.totalLoad || (qty > 0 ? qty * unitLoad : unitLoad);
  const areaUnit = unitSystem === "ip" ? "sq.ft" : "sq.m";
  const densityUnit = unitSystem === "ip" ? "W/sq.ft" : "W/m²";
  const powerDensity = area > 0 ? (totalLoad * 1000) / area : 0;
  const projectShare = totalPower > 0 ? (totalLoad / totalPower) * 100 : 0;
  const totalWithSafety = totalLoad * 1.1;

  const steps: CalculationStep[] = [
    {
      stepNumber: 1,
      label: "Sub-Loads Summation (Unit Power Demand)",
      formula: "P_unit = P_lighting + P_power + P_hvac + P_other",
      substitution: `${lighting} kW + ${power} kW + ${hvac} kW + ${other} kW`,
      result: `${unitLoad.toFixed(2)} kW`,
      status: "pass",
      description: "Direct summation of all connected branch loads for a single unit of this space.",
    },
    {
      stepNumber: 2,
      label: "Total Connected Load (with Quantity Multiplier)",
      formula: qty > 0 ? "P_total = Qty × P_unit" : "P_total = P_unit",
      substitution: qty > 0 ? `${qty} × ${unitLoad.toFixed(2)} kW` : `${unitLoad.toFixed(2)} kW`,
      result: `${totalLoad.toFixed(2)} kW`,
      status: "pass",
      description: "Gross active power demand taking into account space multiplier quantity.",
    },
  ];

  if (area > 0) {
    steps.push({
      stepNumber: steps.length + 1,
      label: `Area Power Density (${densityUnit})`,
      formula: "Power Density = (P_total × 1000) / Area",
      substitution: `(${totalLoad.toFixed(2)} kW × 1000) / ${area} ${areaUnit}`,
      result: `${powerDensity.toFixed(2)} ${densityUnit}`,
      status: "pass",
      description: "Specific power demand per unit area for space benchmarking and thermal compliance.",
    });
  }

  if (totalPower > 0) {
    steps.push({
      stepNumber: steps.length + 1,
      label: "Share of Total Facility Connected Load",
      formula: "Project Share = (P_total / P_project_total) × 100%",
      substitution: `(${totalLoad.toFixed(2)} kW / ${totalPower.toFixed(2)} kW) × 100%`,
      result: `${projectShare.toFixed(1)}%`,
      status: "pass",
      description: "Contribution of this space to the entire facility's active connected power.",
    });
  }

  steps.push({
    stepNumber: steps.length + 1,
    label: "Design Safety Margin (10% Additional Capacity)",
    formula: "P_design = P_total × 1.10",
    substitution: `${totalLoad.toFixed(2)} kW × 1.10`,
    result: `${totalWithSafety.toFixed(2)} kW`,
    status: "pass",
    description: "Standard 10% design safety margin allocated for feeder cable and transformer sizing.",
  });

  return {
    title: "Electrical Load Calculation Breakdown",
    itemName: cleanSpaceName(row.description) || "Unnamed Load Area",
    standardReference: "IEC 60364-5-52 / ASHRAE 90.1 / NEC NFPA 70",
    inputs: [
      { label: "Space Description", value: cleanSpaceName(row.description) || "—" },
      { label: "Quantity (Units)", value: qty },
      { label: "Floor Area", value: area > 0 ? area : "N/A", unit: area > 0 ? areaUnit : undefined },
      { label: "Lighting Load", value: lighting, unit: "kW" },
      { label: "Power Load", value: power, unit: "kW" },
      { label: "HVAC Load", value: hvac, unit: "kW" },
      { label: "Other Load", value: other, unit: "kW" },
      { label: "Remarks / Notes", value: row.remarks || "None" },
    ],
    steps,
    finalResultLabel: "Total Design Load (+10% Safety)",
    finalResultValue: totalWithSafety.toFixed(2),
    finalResultUnit: "kW",
    complianceNote: "Calculations follow standard electrical engineering practices for commercial and residential load estimation.",
  };
};
