import {
  extractSpacesFromActiveViewer,
  extractSpacesFromIFCFile,
  getFloorRank,
  Extracted3DSpace,
} from "@/lib/bimViewerSpaceExtractor";
import { getProjectIfcFile } from "@/lib/projectIfcStorage";
import { getCommercialBenchmarkLoads, extractFloorName, LoadRow } from "@/lib/calc-load-summary";
import { LVPanel, BusbarRow } from "@/lib/calc-busbar-calculation";
import { BusbarVDRow, computeAllRows, DEFAULT_RATINGS } from "@/lib/calc-busbar-voltage-drop";

export interface FloorRiserData {
  floorName: string;
  floorCode: string;
  height: number; // in meters
  loadKw: number; // in kW
  spaceCount: number;
  isFromLoadSummary: boolean;
}

export interface BusbarSyncOptions {
  voltage?: number; // default 415V
  pf?: number;      // default 0.8
  df?: number;      // default 0.85
  defaultFloorHeight?: number; // default 3.8m
  panelName?: string;
  busbarRef?: string;
}

export interface BusbarSyncResult {
  source: "3d-and-load-summary" | "3d-only" | "load-summary-only" | "default-preset";
  floors: FloorRiserData[];
  totalConnectedLoadKw: number;
  diversityFactor: number;
  totalDemandKw: number;
  lineCurrentA: number;
  recommendedRatingId: string;
  recommendedRatingLabel: string;
  panel: LVPanel;
  vdRows: BusbarVDRow[];
}

/**
 * Maps standard floor names to short code for SMDB naming
 * e.g., "GROUND FLOOR" -> "GF", "FIRST FLOOR" -> "L1", "BASEMENT 1" -> "B1"
 */
export function getFloorCode(floorName: string): string {
  const f = (floorName || "").trim().toUpperCase();
  if (f.includes("BASEMENT 3") || f.includes("B3")) return "B3";
  if (f.includes("BASEMENT 2") || f.includes("B2")) return "B2";
  if (f.includes("BASEMENT 1") || f.includes("B1") || f.includes("BASEMENT")) return "B1";
  if (f.includes("LOWER GROUND") || f.includes("LG")) return "LG";
  if (f.includes("GROUND") || f.includes("GF") || f === "L0" || f.includes("LEVEL 0")) return "GF";
  if (f.includes("MEZZANINE") || f.includes("MEZZ")) return "MZ";
  if (f.includes("PODIUM")) return "POD";
  if (f.includes("FIRST") || f.includes("1ST") || f.includes("LEVEL 1") || f.includes("L01")) return "L1";
  if (f.includes("SECOND") || f.includes("2ND") || f.includes("LEVEL 2") || f.includes("L02")) return "L2";
  if (f.includes("THIRD") || f.includes("3RD") || f.includes("LEVEL 3") || f.includes("L03")) return "L3";
  if (f.includes("FOURTH") || f.includes("4TH") || f.includes("LEVEL 4") || f.includes("L04")) return "L4";
  if (f.includes("FIFTH") || f.includes("5TH") || f.includes("LEVEL 5") || f.includes("L05")) return "L5";
  if (f.includes("SIXTH") || f.includes("6TH") || f.includes("LEVEL 6") || f.includes("L06")) return "L6";
  if (f.includes("SEVENTH") || f.includes("7TH") || f.includes("LEVEL 7") || f.includes("L07")) return "L7";
  if (f.includes("EIGHTH") || f.includes("8TH") || f.includes("LEVEL 8") || f.includes("L08")) return "L8";
  if (f.includes("NINTH") || f.includes("9TH") || f.includes("LEVEL 9") || f.includes("L09")) return "L9";
  if (f.includes("TENTH") || f.includes("10TH") || f.includes("LEVEL 10") || f.includes("L10")) return "L10";

  const numMatch = f.match(/(?:LEVEL|FLOOR|FLR|STORY|STORIES|L)\s*(\d+)/i);
  if (numMatch && numMatch[1]) {
    return `L${numMatch[1]}`;
  }

  if (f.includes("UPPER ROOF")) return "UROOF";
  if (f.includes("ROOF") || f.includes("TERRACE")) return "ROOF";
  
  // Clean fallback
  return f.replace(/[^A-Z0-9]/g, "").slice(0, 5) || "FLR";
}

/**
 * Selects the optimal busbar rating based on full demand current with safety margin
 */
export function selectRecommendedBusbarRating(currentA: number): {
  id: string;
  label: string;
  amp: number;
} {
  const ratings = [
    { amp: 800, id: "1000_rt", label: "800 (Rt)" },
    { amp: 1000, id: "1000_rt", label: "1000 (Rt)" },
    { amp: 1250, id: "1250_rt", label: "1250 (Rt)" },
    { amp: 1600, id: "1600_rt", label: "1600 (Rt)" },
    { amp: 2000, id: "2000_rt", label: "2000 (Rt)" },
    { amp: 2500, id: "2500_rt", label: "2500 (Rt)" },
    { amp: 3200, id: "3200_rt", label: "3200 (Rt)" },
    { amp: 4000, id: "4000_rt", label: "4000 (Rt)" },
    { amp: 5000, id: "5000_rt", label: "5000 (Rt)" },
    { amp: 6300, id: "6300_rt", label: "6300 (Rt)" },
  ];

  // Provide at least 10% design margin
  const targetCapacity = currentA * 1.05;
  const match = ratings.find((r) => r.amp >= targetCapacity) || ratings[ratings.length - 1];
  return match;
}

/**
 * Main automated bridge function connecting 3D Studio & Load Summary to Busbar Calculations
 */
export async function syncBusbarFrom3DAndLoadSummary(
  projectId?: string,
  options?: BusbarSyncOptions
): Promise<BusbarSyncResult> {
  const voltage = options?.voltage || 415;
  const pf = options?.pf || 0.8;
  const df = options?.df !== undefined ? options.df : 0.85;
  const defaultHeight = options?.defaultFloorHeight || 3.8;
  const panelName = options?.panelName || "MDB - RISER BUSDUCT";
  const busbarRef = options?.busbarRef || "BB-RISER-01";

  // 1. Try to extract 3D Spaces & Heights from 3D Studio
  let extractedSpaces: Extracted3DSpace[] = [];
  try {
    extractedSpaces = extractSpacesFromActiveViewer(projectId);
    if (extractedSpaces.length === 0 && projectId) {
      const savedIfc = await getProjectIfcFile(projectId);
      if (savedIfc) {
        extractedSpaces = await extractSpacesFromIFCFile(savedIfc);
      }
    }
  } catch (err) {
    console.warn("Failed to extract spaces from 3D viewer:", err);
  }

  // 2. Fetch active Load Summary rows
  let loadSummaryRows: LoadRow[] = [];
  const pId = projectId || "default";
  if (typeof localStorage !== "undefined") {
    try {
      const savedLoads = localStorage.getItem(`mep_load_summary_rows_${pId}`) || localStorage.getItem("mep_load_summary_rows");
      if (savedLoads) {
        const parsed = JSON.parse(savedLoads);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadSummaryRows = parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load Load Summary records:", e);
    }
  }

  // 3. Aggregate Loads by Floor from Load Summary
  const loadByFloor = new Map<string, number>();
  if (loadSummaryRows.length > 0) {
    loadSummaryRows.forEach((row) => {
      const floor = extractFloorName(row);
      const rowLoad = Number(row.totalLoad) || (Number(row.power || 0) + Number(row.lighting || 0) + Number(row.hvac || 0) + Number(row.other || 0));
      const current = loadByFloor.get(floor) || 0;
      loadByFloor.set(floor, current + rowLoad);
    });
  }

  // 4. Structure Floor List
  const floorsMap = new Map<string, { height: number; count: number; spaceLoad: number }>();

  // If 3D spaces exist, group by 3D storey
  if (extractedSpaces.length > 0) {
    extractedSpaces.forEach((sp) => {
      const level = (sp.level || "Ground Floor").trim().toUpperCase();
      const current = floorsMap.get(level) || { height: 0, count: 0, spaceLoad: 0 };
      
      const spHeight = sp.height > 1.5 && sp.height < 15 ? sp.height : defaultHeight;
      const height = Math.max(current.height, spHeight);
      
      // If no load summary, use standard commercial benchmark loads
      let spaceKw = 0;
      if (loadSummaryRows.length === 0) {
        const bm = getCommercialBenchmarkLoads(sp.name, sp.category, sp.area || 25);
        spaceKw = bm.totalLoad || 10;
      }

      floorsMap.set(level, {
        height,
        count: current.count + 1,
        spaceLoad: current.spaceLoad + spaceKw,
      });
    });
  } else if (loadSummaryRows.length > 0) {
    // If only load summary exists, build floors from load summary
    loadByFloor.forEach((load, floor) => {
      floorsMap.set(floor, {
        height: defaultHeight,
        count: 1,
        spaceLoad: load,
      });
    });
  }

  // Fallback: Default High-Rise 5-Floor Preset if project has neither yet
  let source: BusbarSyncResult["source"] = "default-preset";
  if (extractedSpaces.length > 0 && loadSummaryRows.length > 0) {
    source = "3d-and-load-summary";
  } else if (extractedSpaces.length > 0) {
    source = "3d-only";
  } else if (loadSummaryRows.length > 0) {
    source = "load-summary-only";
  }

  if (floorsMap.size === 0) {
    floorsMap.set("GROUND FLOOR", { height: 4.2, count: 8, spaceLoad: 120 });
    floorsMap.set("FIRST FLOOR", { height: 3.8, count: 12, spaceLoad: 95 });
    floorsMap.set("SECOND FLOOR", { height: 3.8, count: 12, spaceLoad: 95 });
    floorsMap.set("THIRD FLOOR", { height: 3.8, count: 12, spaceLoad: 95 });
    floorsMap.set("ROOF FLOOR", { height: 4.0, count: 4, spaceLoad: 180 });
  }

  // 5. Sort floors in logical vertical riser order (Bottom -> Top)
  const sortedFloors = Array.from(floorsMap.entries()).sort((a, b) => {
    const rankA = getFloorRank(a[0]);
    const rankB = getFloorRank(b[0]);
    if (rankA !== rankB) return rankA - rankB;
    return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: "base" });
  });

  // 6. Build FloorRiserData
  const floors: FloorRiserData[] = sortedFloors.map(([floorName, info]) => {
    const floorCode = getFloorCode(floorName);
    const hasSummaryLoad = loadByFloor.has(floorName);
    const finalKw = hasSummaryLoad
      ? Number((loadByFloor.get(floorName) || 0).toFixed(2))
      : Number((info.spaceLoad || 80).toFixed(2));

    return {
      floorName,
      floorCode,
      height: Number(info.height.toFixed(2)) || defaultHeight,
      loadKw: finalKw,
      spaceCount: info.count,
      isFromLoadSummary: hasSummaryLoad,
    };
  });

  // 7. Calculate Total Load & Recommended Rating
  const totalConnectedLoadKw = Number(
    floors.reduce((sum, f) => sum + f.loadKw, 0).toFixed(2)
  );
  const totalDemandKw = Number((totalConnectedLoadKw * df).toFixed(2));
  
  // 3-Phase Line Current: I = (MD * 1000) / (sqrt(3) * V * PF)
  const lineCurrentA = Number(
    ((totalDemandKw * 1000) / (Math.sqrt(3) * voltage * pf)).toFixed(2)
  );

  const recommended = selectRecommendedBusbarRating(lineCurrentA);

  // 8. Generate LVPanel structure for /busbar-calculation
  const busbarRows: BusbarRow[] = floors.map((f, idx) => ({
    id: `bb_sync_${Date.now()}_${idx}`,
    from: panelName,
    desc: `SMDB-${f.floorCode} (${f.floorName})`,
    ref: busbarRef,
    length: f.height,
    loadKw: f.loadKw,
    div: df,
  }));

  const panel: LVPanel = {
    id: `pan_sync_${Date.now()}`,
    name: panelName,
    sections: [
      {
        id: `sec_sync_${Date.now()}`,
        name: busbarRef,
        ratingId: recommended.id,
        volts: voltage,
        pf: pf,
        useMdForCurrent: true,
        rows: busbarRows,
      },
    ],
  };

  // 9. Generate BusbarVDRow[] structure for /busbar-voltage-drop
  let runningTcl = totalConnectedLoadKw;
  const vdRows: BusbarVDRow[] = [
    {
      id: `vd_grp_${Date.now()}`,
      isGroup: true,
      ref: busbarRef,
      from: "MDB",
      tapOff: `MAIN RISER (${floors.length} FLOORS)`,
      length: 0,
      smdbLoad: 0,
      tcl: totalConnectedLoadKw,
      voltage: voltage,
      pf: pf,
      df: df,
      maxDemand: 0,
      lineCurrent: 0,
      vd: 0,
      vdPercent: 0,
      cumulativeVd: 0,
    },
    ...floors.map((f, idx) => {
      const currentFloorTcl = runningTcl;
      runningTcl -= f.loadKw; // downstream subtraction
      return {
        id: `vd_row_${Date.now()}_${idx}`,
        isGroup: false,
        ref: busbarRef,
        from: idx === 0 ? "MDB" : `SMDB-${floors[idx - 1].floorCode}`,
        tapOff: `SMDB-${f.floorCode}`,
        length: f.height,
        smdbLoad: f.loadKw,
        tcl: currentFloorTcl,
        voltage: voltage,
        pf: pf,
        df: df,
        maxDemand: 0,
        lineCurrent: 0,
        vd: 0,
        vdPercent: 0,
        cumulativeVd: 0,
      };
    }),
  ];

  // Compute VD calculations
  const defaultR = DEFAULT_RATINGS.find(r => r.rating === recommended.label)?.r || 0.0300;
  const defaultX = DEFAULT_RATINGS.find(r => r.rating === recommended.label)?.x || 0.0130;
  const computedVdRows = computeAllRows(vdRows, defaultR, defaultX);

  return {
    source,
    floors,
    totalConnectedLoadKw,
    diversityFactor: df,
    totalDemandKw,
    lineCurrentA,
    recommendedRatingId: recommended.id,
    recommendedRatingLabel: recommended.label,
    panel,
    vdRows: computedVdRows,
  };
}
