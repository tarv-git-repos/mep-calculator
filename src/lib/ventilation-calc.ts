import { getOccupancyData } from "./ashrae-data";

export interface Space {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  zone: string; // The zone name/id
  category: string;
  area: number;
  occupancy: number; // Occupancy density or count
  freshAir: number;  // balanced fresh air
  extractAir: number; // balanced extract air
  pressure: string; // "Neutral" | "Positive" | "Negative" | "Critical"
  equipment: string;
  status: "complete" | "in-progress" | "warning" | "draft";

  // Additional fields for calculation engine
  height?: number;
  fixtures?: number | string;
  multiplier?: number;
  minOA?: number;
  minExt?: number;

  // Custom category fields
  customWorkflow?: "calculate" | "direct";
  customPeopleOA?: number | "";
  customAreaOA?: number | "";
  customExhaustPerUnit?: number | "";
  customExhaustPerArea?: number | "";
  customAch?: number | "";
  customFreshGiven?: number | "";
  customExtTaken?: number | "";

  // Restroom subcategories quantities
  restroomSubCategories?: Record<string, number>;

  // Manual overrides
  isManualAirflow?: boolean;
  manualFreshGiven?: number;
  manualExtTaken?: number;

  // AI occupancy matching fields
  aiDetected?: boolean;
  pressureAutoDetected?: boolean;
  isOccupancyCustomized?: boolean;
}

/** One independent instance of the zone (zone.multiplier creates N of these) */
export interface ZoneInstanceAssignment {
  instanceIndex: number;      // 1-based, matches the multiplier slot
  faEquipId: string | null;   // equipment ID serving Fresh Air for this instance
  eaEquipId: string | null;   // equipment ID serving Extract Air for this instance
}

export interface Zone {
  id: string;
  name: string;
  building: string;
  floor: string;
  spaceCount: number;
  area: number;
  freshAir: number;
  extractAir: number;
  pressure: number; // Balance (freshAir - extractAir)
  equipment: string[];
  pressureType: "positive" | "negative" | "neutral";
  faAssignment?: string | null;
  eaAssignment?: string | null;
  multiplier?: number;
  faAssignedQty?: number;
  eaAssignedQty?: number;
  faAssignments?: Record<string, number>;
  eaAssignments?: Record<string, number>;
  // Source of truth: one entry per multiplier instance
  instances?: ZoneInstanceAssignment[];
}


export interface Equipment {
  id: string;
  tag: string;
  type: string; // "MAHU" | "Ecology" | "FAHU" | "Air Handling Unit"
  zones: number;
  spaces: number;
  totalAirflow: number;
  capacity: number;
  utilization: number;
  status: "operational" | "design" | "warning";
  mode?: "Fresh Air Only" | "Extract Air Only" | "Fresh Air + Extract Air";
  zoneIds?: string[];
  totalFA?: number;
  totalEA?: number;
}

let activeRoundOffPreset = 5;

export function setGlobalRoundOffPreset(value: number) {
  activeRoundOffPreset = value;
}

export function getGlobalRoundOffPreset(): number {
  return activeRoundOffPreset;
}

export function RoundToCEC(val: number): number {
  if (val <= 0) return 0;
  return Math.ceil(val / activeRoundOffPreset) * activeRoundOffPreset;
}

export function distributeFlow(
  spaces: Space[],
  totalTarget: number, // Must be a multiple of activeRoundOffPreset
  getMinFlow: (s: Space) => number,
  getWeight: (s: Space) => number
): number[] {
  if (spaces.length === 0) return [];

  // 1. Initialize each space with Math.floor(minFlow / activeRoundOffPreset) * activeRoundOffPreset
  const flows = spaces.map((s) => {
    const minFlow = getMinFlow(s);
    return Math.floor(minFlow / activeRoundOffPreset) * activeRoundOffPreset;
  });

  let currentSum = flows.reduce((sum, f) => sum + f, 0);

  if (currentSum >= totalTarget) {
    return flows;
  }

  let remaining = totalTarget - currentSum;
  const totalWeight = spaces.reduce((sum, s) => sum + getWeight(s), 0);

  if (totalWeight === 0) {
    let idx = 0;
    while (remaining > 0) {
      flows[idx % spaces.length] += activeRoundOffPreset;
      remaining -= activeRoundOffPreset;
      idx++;
    }
    return flows;
  }

  // idealShares = weight_ratio * totalTarget
  const idealShares = spaces.map((s) => (getWeight(s) / totalWeight) * totalTarget);

  while (remaining > 0) {
    let maxDiff = -Infinity;
    let targetIdx = 0;

    for (let i = 0; i < spaces.length; i++) {
      const diff = idealShares[i] - flows[i];
      if (diff > maxDiff) {
        maxDiff = diff;
        targetIdx = i;
      }
    }

    flows[targetIdx] += activeRoundOffPreset;
    remaining -= activeRoundOffPreset;
  }

  return flows;
}


/**
 * Ported ventilation balancing engine.
 * Takes current lists of spaces, zones, and equipment and runs the Revit balancing logic.
 * Returns the recalculated clones of these objects.
 */
export function calculateVentilation(
  currentSpaces: Space[],
  currentZones: Zone[],
  currentEquipment: Equipment[]
): { spaces: Space[]; zones: Zone[]; equipment: Equipment[] } {
  // Deep clone inputs to keep function pure
  const spaces: Space[] = JSON.parse(JSON.stringify(currentSpaces));
  const zones: Zone[] = JSON.parse(JSON.stringify(currentZones));
  const equipment: Equipment[] = JSON.parse(JSON.stringify(currentEquipment));

  // 1) First calculate minOA and minExt for all spaces, scaled by multiplier
  spaces.forEach((z) => {
    const mult = parseFloat(String(z.multiplier || 1)) || 1;

    if (z.isManualAirflow) {
      z.minOA = Math.ceil(parseFloat(String(z.manualFreshGiven || 0))) * mult;
      z.minExt = Math.ceil(parseFloat(String(z.manualExtTaken || 0))) * mult;
      z.freshAir = z.minOA;
      z.extractAir = z.minExt;
    } else if (z.category && z.category.endsWith(" (Custom)")) {
      if (z.customWorkflow === "direct") {
        z.minOA = Math.ceil(parseFloat(String(z.customFreshGiven || 0))) * mult;
        z.minExt = Math.ceil(parseFloat(String(z.customExtTaken || 0))) * mult;
        z.freshAir = z.minOA;
        z.extractAir = z.minExt;
      } else {
        // calculate workflow
        const areaOA = parseFloat(String(z.customAreaOA || 0)) || 0;
        const peopleOA = parseFloat(String(z.customPeopleOA || 0)) || 0;
        const exhaustPerArea = parseFloat(String(z.customExhaustPerArea || 0)) || 0;
        const exhaustPerUnit = parseFloat(String(z.customExhaustPerUnit || 0)) || 0;

        const hasFixtures =
          z.fixtures !== "" &&
          z.fixtures !== null &&
          z.fixtures !== undefined &&
          !isNaN(parseFloat(String(z.fixtures)));
        const effectiveOcc = hasFixtures
          ? parseFloat(String(z.fixtures))
          : parseFloat(String(z.occupancy || 0)) || 0;
        const minOA_base = (parseFloat(String(z.area || 0)) * areaOA) + (effectiveOcc * peopleOA);
        z.minOA = Math.ceil(minOA_base) * mult;

        const areaVal = parseFloat(String(z.area || 0)) || 0;
        const heightVal = parseFloat(String(z.height || 0)) || 0;
        const achVal = parseFloat(String(z.customAch || 0)) || 0;

        const minExt_base =
          exhaustPerUnit * effectiveOcc +
          exhaustPerArea * areaVal +
          (achVal * areaVal * heightVal) / 3.6;
      }
    } else if (z.category === "Rest Room / Changing Room") {
      let totalExhaust = 0;
      const sub = z.restroomSubCategories || {};
      const areaVal = parseFloat(String(z.area || 0)) || 0;
      
      totalExhaust += (sub.toiletPrivateContinuous || 0) * 12.5;
      totalExhaust += (sub.toiletPublicContinuous || 0) * 25.0;
      totalExhaust += (sub.toiletPrivateDiscontinuous || 0) * 25.0;
      totalExhaust += (sub.toiletPublicDiscontinuous || 0) * 35.0;
      totalExhaust += (sub.showerContinuous || 0) * 10.0;
      totalExhaust += (sub.showerDiscontinuous || 0) * 25.0;
      totalExhaust += (sub.janitorCloset || 0) * areaVal * 5.0;
      totalExhaust += (sub.lockerRoom || 0) * areaVal * 1.25;

      z.minOA = 0;
      z.minExt = Math.ceil(totalExhaust) * mult;
    } else {
      const data = getOccupancyData(z.category);

      const areaOA = data ? parseFloat(String(data.areaOA || 0)) || 0 : 0;
      const peopleOA = data ? parseFloat(String(data.peopleOA || 0)) || 0 : 0;
      const exhaustPerArea = data ? parseFloat(String(data.exhaustPerArea || 0)) || 0 : 0;
      const exhaustPerUnit = data ? parseFloat(String(data.exhaustPerUnit || 0)) || 0 : 0;

      // Dynamically calculate and update occupancy if not customized
      if (data && !z.isOccupancyCustomized) {
        const defaultOcc = (data.exhaustPerUnit > 0 && data.defaultDensity === 0)
          ? 1
          : Math.ceil(((parseFloat(String(z.area || 0)) || 0) * data.defaultDensity) / 100);
        z.occupancy = defaultOcc;
      }

      const hasFixtures =
        z.fixtures !== "" &&
        z.fixtures !== null &&
        z.fixtures !== undefined &&
        !isNaN(parseFloat(String(z.fixtures)));

      const hasOccupancy =
        z.occupancy !== undefined &&
        z.occupancy !== null &&
        (z.occupancy as any) !== "" &&
        !isNaN(parseFloat(String(z.occupancy)));

      const effectiveOcc = hasFixtures
        ? parseFloat(String(z.fixtures))
        : hasOccupancy
        ? parseFloat(String(z.occupancy))
        : 8;

      const minOA_base = (parseFloat(String(z.area || 0)) * areaOA) + (effectiveOcc * peopleOA);
      z.minOA = Math.ceil(minOA_base) * mult;

      const areaVal = parseFloat(String(z.area || 0)) || 0;
      const heightVal = parseFloat(String(z.height || 0)) || 0;
      const achVal = data ? parseFloat(String(data.ach || 0)) || 0 : 0;

      const minExt_base =
        exhaustPerUnit * effectiveOcc +
        exhaustPerArea * areaVal +
        (achVal * areaVal * heightVal) / 3.6;
      z.minExt = Math.ceil(minExt_base) * mult;
    }
  });

  // 2) Run Balancing logic for unzoned spaces individually
  const unzonedSpaces = spaces.filter((s) => {
    const zoneStr = (s.zone || "").trim().toLowerCase();
    if (!zoneStr || zoneStr === "default" || zoneStr === "unzoned") {
      return true;
    }
    return !zones.some((g) => g.id === s.zone || g.name === s.zone);
  });
  unzonedSpaces.forEach((z) => {
    if (z.isManualAirflow) return;
    if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;

    const req = Math.max(z.minExt || 0, z.minOA || 0);
    z.freshAir = RoundToCEC(req);
    z.extractAir = RoundToCEC(req);
  });

  // 3) Run Balancing logic for each user-created zone
  zones.forEach((g) => {
    const isDefault = g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned";
    if (isDefault) {
      g.spaceCount = 0;
      g.area = 0;
      g.freshAir = 0;
      g.extractAir = 0;
      g.pressure = 0;
      g.pressureType = "neutral";
      return;
    }

    // Find spaces in this zone (by ID or name)
    const zoneSpaces = spaces.filter((z) => z.zone === g.id || z.zone === g.name);
    if (zoneSpaces.length === 0) {
      g.spaceCount = 0;
      g.area = 0;
      g.freshAir = 0;
      g.extractAir = 0;
      g.pressure = 0;
      g.pressureType = "neutral";
      return;
    }

    // Group spaces of the custom zone by pressure
    const neutralSpaces = zoneSpaces.filter((z) => z.pressure === "Neutral" || !z.pressure);
    const positiveSpaces = zoneSpaces.filter((z) => z.pressure === "Positive");
    const negativeSpaces = zoneSpaces.filter((z) => z.pressure === "Negative");
    const critNegSpaces = zoneSpaces.filter((z) => z.pressure === "Critical");

    // A. Neutral spaces
    neutralSpaces.forEach((z) => {
      if (z.isManualAirflow) return;
      if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
      const req = Math.max(z.minExt || 0, z.minOA || 0);
      z.freshAir = RoundToCEC(req);
      z.extractAir = RoundToCEC(req);
    });

    // B. Negative spaces (-1)
    negativeSpaces.forEach((z) => {
      if (z.isManualAirflow) return;
      if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;

      const minExt = z.minExt || 0;
      const minOA = z.minOA || 0;

      let rawExt = 0;
      let rawFA = 0;
      if (minExt <= minOA) {
        rawExt = Math.min(minOA + 25, 1.1 * minOA);
        rawFA = minOA;
      } else if (minExt > minOA + 25) {
        rawExt = minExt;
        rawFA = minExt - 25;
      } else {
        rawExt = minExt;
        rawFA = minOA;
      }
      z.extractAir = RoundToCEC(rawExt);
      z.freshAir = RoundToCEC(rawFA);
    });

    // C. Critical Negative spaces (-2)
    critNegSpaces.forEach((z) => {
      if (z.isManualAirflow) return;
      if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;

      const minExt = z.minExt || 0;
      const minOA = z.minOA || 0;

      let rawExt = 0;
      let rawFA = 0;
      if (minExt - minOA <= 5.0) {
        rawExt = minOA + 5.0;
        rawFA = minOA;
      } else {
        rawExt = minExt;
        rawFA = minOA;
      }
      z.extractAir = RoundToCEC(rawExt);
      z.freshAir = RoundToCEC(rawFA);
    });

    // D. Positive spaces (+1)
    const positiveSpacesToBalance = positiveSpaces.filter(
      (z) => !z.isManualAirflow && !(z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct")
    );

    if (positiveSpaces.length > 0) {
      let FA_other = 0;
      let EA_other = 0;

      // Sum fixed air rates from neutral, negative, and critical negative spaces
      neutralSpaces.forEach((z) => {
        FA_other += z.freshAir || 0;
        EA_other += z.extractAir || 0;
      });
      negativeSpaces.forEach((z) => {
        FA_other += z.freshAir || 0;
        EA_other += z.extractAir || 0;
      });
      critNegSpaces.forEach((z) => {
        FA_other += z.freshAir || 0;
        EA_other += z.extractAir || 0;
      });

      // Sum fixed air rates from manual/direct positive spaces
      positiveSpaces.forEach((z) => {
        if (z.isManualAirflow || (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct")) {
          FA_other += z.freshAir || 0;
          EA_other += z.extractAir || 0;
        }
      });

      // Sum minimum requirements for the positive spaces we are balancing
      const FA_pos_min = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minOA || 0), 0);
      const EA_pos_min = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minExt || 0), 0);

      const FA_min_zone = FA_other + FA_pos_min;
      const EA_min_zone = EA_other + EA_pos_min;

      let Total_FA_target = 0;
      let Total_EA_target = 0;

      // Candidate 1: Fresh air is the bottleneck
      const FA_candidate = RoundToCEC(FA_min_zone);
      const EA_candidate = Math.floor((FA_candidate / 1.1) / activeRoundOffPreset) * activeRoundOffPreset;

      if (EA_candidate >= EA_min_zone) {
        Total_FA_target = FA_candidate;
        Total_EA_target = EA_candidate;
      } else {
        // Candidate 2: Extract air is the bottleneck
        Total_EA_target = RoundToCEC(EA_min_zone);
        Total_FA_target = Math.ceil((Total_EA_target * 1.1) / activeRoundOffPreset) * activeRoundOffPreset;
      }

      // Calculate target flows specifically for positive spaces to balance
      const FA_pos_target = Math.max(0, Total_FA_target - FA_other);
      const EA_pos_target = Math.max(0, Total_EA_target - EA_other);

      // Distribute fresh air target using area * multiplier as weight
      const faFlows = distributeFlow(
        positiveSpacesToBalance,
        FA_pos_target,
        (z) => z.minOA || 0,
        (z) => parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1)
      );

      // Distribute extract air target using minOA as weight (fallback to area if minOA is 0)
      const totalMinOA = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minOA || 0), 0);
      const eaFlows = distributeFlow(
        positiveSpacesToBalance,
        EA_pos_target,
        (z) => z.minExt || 0,
        (z) => totalMinOA > 0
          ? (z.minOA || 0)
          : parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1)
      );

      // Assign the distributed values back to the spaces
      positiveSpacesToBalance.forEach((z, idx) => {
        z.freshAir = faFlows[idx];
        z.extractAir = eaFlows[idx];
      });

      // For positive spaces that were manual/direct, make sure z.freshAir/z.extractAir are set to z.minOA/z.minExt
      positiveSpaces.forEach((z) => {
        if (z.isManualAirflow || (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct")) {
          z.freshAir = z.minOA || 0;
          z.extractAir = z.minExt || 0;
        }
      });
    }

    // E. Apply CEC Rounding
    zoneSpaces.forEach((z) => {
      if (z.isManualAirflow) return;
      if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
      z.freshAir = RoundToCEC(z.freshAir || 0);
      z.extractAir = RoundToCEC(z.extractAir || 0);
    });

    // F. Guarantee Zone Balance (Total Fresh Air >= Total Extract Air * 1.1) and perform internal balancing
    let Total_FA = 0;
    let Total_EA = 0;
    zoneSpaces.forEach((z) => {
      Total_FA += z.freshAir || 0;
      Total_EA += z.extractAir || 0;
    });

    if (Total_FA < Total_EA * 1.1) {
      const FA_deficit = Total_EA * 1.1 - Total_FA;

      // Priority list of space pressures to receive additional fresh air:
      let targetSpaces = zoneSpaces.filter((z) => z.pressure === "Positive");
      if (targetSpaces.length === 0) {
        targetSpaces = zoneSpaces.filter((z) => z.pressure === "Neutral" || !z.pressure);
      }
      if (targetSpaces.length === 0) {
        targetSpaces = zoneSpaces.filter((z) => z.pressure === "Negative");
      }
      if (targetSpaces.length === 0) {
        targetSpaces = zoneSpaces.filter((z) => z.pressure === "Critical");
      }

      // Do not auto-adjust direct custom workflow spaces or manual override spaces
      targetSpaces = targetSpaces.filter(
        (z) => !z.isManualAirflow && !(z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct")
      );

      if (targetSpaces.length > 0) {
        const totalArea = targetSpaces.reduce(
          (sum, z) => sum + parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1),
          0
        );
        if (totalArea > 0) {
          targetSpaces.forEach((z) => {
            const areaShare =
              (parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1)) / totalArea;
            z.freshAir = (z.freshAir || 0) + FA_deficit * areaShare;
            z.freshAir = RoundToCEC(z.freshAir);
          });
        } else {
          const share = FA_deficit / targetSpaces.length;
          targetSpaces.forEach((z) => {
            z.freshAir = (z.freshAir || 0) + share;
            z.freshAir = RoundToCEC(z.freshAir);
          });
        }
      }
    }

    // G. Re-calculate Zone summary totals
    let finalFA = 0;
    let finalEA = 0;
    let finalArea = 0;
    const finalEquipSet = new Set<string>();

    zoneSpaces.forEach((z) => {
      finalFA += z.freshAir || 0;
      finalEA += z.extractAir || 0;
      finalArea += (z.area || 0) * (z.multiplier || 1);
      if (z.equipment) {
        finalEquipSet.add(z.equipment);
      }
    });

    g.spaceCount = zoneSpaces.length;
    g.area = parseFloat(finalArea.toFixed(1));
    g.freshAir = finalFA;
    g.extractAir = finalEA;
    g.pressure = Math.round(finalFA - finalEA);
    g.pressureType = g.pressure > 50 ? "positive" : g.pressure < -50 ? "negative" : "neutral";
    g.equipment = Array.from(finalEquipSet);
  });

  // 4) Recalculate Equipment utilization based on assigned zones/spaces
  equipment.forEach((e) => {
    // Sync zoneIds based on faAssignment/eaAssignment or faAssignments/eaAssignments
    e.zoneIds = zones.filter((g) => {
      const hasFA = g.faAssignment === e.id || (g.faAssignments && e.id in g.faAssignments);
      const hasEA = g.eaAssignment === e.id || (g.eaAssignments && e.id in g.eaAssignments);
      return hasFA || hasEA;
    }).map((g) => g.id);

    // Sum airflows from assigned zones
    let totalFA = 0;
    let totalEA = 0;
    let spacesCount = 0;

    zones.forEach((g) => {
      // Find spaces in this zone
      const zoneSpaces = spaces.filter((s) => s.zone === g.id || s.zone === g.name);
      const zoneMult = parseFloat(String(g.multiplier || 1)) || 1;

      // Determine FA qty for this equipment
      let faQty = 0;
      if (g.faAssignments && e.id in g.faAssignments) {
        faQty = g.faAssignments[e.id];
      } else if (g.faAssignment === e.id) {
        faQty = parseFloat(String(g.faAssignedQty || 1)) || 1;
      }
      faQty = Math.min(zoneMult, faQty);

      // Determine EA qty for this equipment
      let eaQty = 0;
      if (g.eaAssignments && e.id in g.eaAssignments) {
        eaQty = g.eaAssignments[e.id];
      } else if (g.eaAssignment === e.id) {
        eaQty = parseFloat(String(g.eaAssignedQty || 1)) || 1;
      }
      eaQty = Math.min(zoneMult, eaQty);

      if (faQty > 0) {
        // MAHU or AHU or FAHU with FA modes
        if (e.type === "MAHU" || e.type === "Air Handling Unit" || (e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air"))) {
          totalFA += g.freshAir * faQty;
          spacesCount += zoneSpaces.length * faQty;
        }
      }
      if (eaQty > 0) {
        // Ecology or FAHU with EA modes
        if (e.type === "Ecology" || (e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air"))) {
          totalEA += g.extractAir * eaQty;
          // Avoid double-counting spaces if already counted for FA
          if (faQty === 0) {
            spacesCount += zoneSpaces.length * eaQty;
          }
        }
      }
    });

    e.totalFA = totalFA;
    e.totalEA = totalEA;
    e.totalAirflow = totalFA + totalEA;
    e.zones = e.zoneIds.length;
    e.spaces = spacesCount;
    e.utilization = e.capacity > 0 ? Math.min(100, Math.round((e.totalAirflow / e.capacity) * 100)) : 0;
    e.status = e.utilization > 92 ? "warning" : e.utilization > 0 ? "operational" : "design";
  });

  // Calculate status for spaces (complete, warning, in-progress, draft)
  spaces.forEach((s) => {
    // Determine status: if there's any warning, label it as warning.
    // In our case, a warning can be defined if freshAir is below minOA or extractAir is below minExt (unless manual override or custom workflow allows it)
    const isWarning =
      !s.isManualAirflow &&
      !(s.category && s.category.endsWith(" (Custom)") && s.customWorkflow === "direct") &&
      ((s.freshAir || 0) < (s.minOA || 0) || (s.extractAir || 0) < (s.minExt || 0));

    s.status = isWarning ? "warning" : s.status === "warning" ? "complete" : s.status;
  });

  const filteredZones = zones.filter((g) => {
    const isDefault = g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned";
    return !isDefault || g.spaceCount > 0;
  });

  return { spaces, zones: filteredZones, equipment };
}
