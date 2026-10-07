export interface CBSRow {
  id: string;
  description: string;
  emLightQty: number;
  emLightW: number;
  exitLightQty: number;
  exitLightW: number;
  remarks: string;
  flagged?: boolean;
}

export const STANDARD_CBS_SIZES = [
  5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 315, 400
];

export const calculateCentralBattery = (
  rows: CBSRow[],
  loadingFactor: number,
  powerFactor: number,
  spareCapacity: number
) => {
  let totalConnectedW = 0;

  rows.forEach((r) => {
    const emQty = r.emLightQty || 0;
    const emW = r.emLightW || 0;
    const exitQty = r.exitLightQty || 0;
    const exitW = r.exitLightW || 0;

    const rowConnected = (emQty * emW) + (exitQty * exitW);
    totalConnectedW += rowConnected;
  });

  const totalConnectedKw = totalConnectedW / 1000;
  
  const safeLF = loadingFactor <= 0 ? 0.9 : loadingFactor;
  const totalLoadAfterLFFactorKw = totalConnectedKw / safeLF;

  const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
  const batteryRatingKva = totalLoadAfterLFFactorKw / safePF;

  const finalRecommendedKva = batteryRatingKva * (1 + spareCapacity / 100);

  // Recommend standard size
  const recStandardSize = STANDARD_CBS_SIZES.find(size => size >= finalRecommendedKva) || 400;

  return {
    totalConnectedW,
    totalConnectedKw,
    totalLoadAfterLFFactorKw,
    batteryRatingKva,
    finalRecommendedKva,
    recStandardSize
  };
};

export interface BimSpaceForCbs {
  id: string;
  name: string;
  level?: string;
  zone?: string;
  category?: string;
  area: number;
  height?: number;
  length?: number;
  fixtures?: string;
  lightFixtureCount?: number;
  lightFixtureType?: string;
}

export function convertBimSpaceToCbsRow(s: BimSpaceForCbs, index: number): CBSRow {
  const name = s.name.toLowerCase();
  const cat = (s.category || "").toLowerCase();
  const text = `${name} ${cat}`;
  const floorTag = s.level ? `[${s.level}] ` : "";

  let emQty = 0;
  let emWatts = 18;
  let exitQty = 0;
  let exitWatts = 8;
  let remarks = "";

  // 1. Corridors & Circulation (Escape Route: 1 Lux, max 9-10m spacing per NFPA 101 / BS 5266)
  if (/corridor|circulation|passage|hallway|lobby|aisle/i.test(text)) {
    const corridorLen = s.length && s.length > 0 ? s.length : Math.max(9, Math.sqrt(s.area) * 2.5);
    emQty = Math.max(1, Math.ceil(corridorLen / 9));
    emWatts = 18;
    exitQty = Math.max(1, Math.ceil(s.area / 40));
    exitWatts = 8;
    remarks = "NFPA 101 / BS 5266 Escape Route (1.0 Lux min)";
  }
  // 2. Staircases & Escape Stairwells
  else if (/stair|staircase|stairwell|fire\s*exit/i.test(text)) {
    emQty = 2; // 2 luminaires per landing/floor
    emWatts = 24;
    exitQty = 1;
    exitWatts = 8;
    remarks = "Escape stairs & landings (BS 5266)";
  }
  // 3. Electrical / Plant / AHU / Switch / Server Rooms (Critical Operations: 100% backup)
  else if (/electrical|plant|ahu|switch|transformer|generator|pump|server|mdf|idf/i.test(text)) {
    emQty = s.area > 30 ? 4 : 2;
    emWatts = 36;
    exitQty = 1;
    exitWatts = 8;
    remarks = "Critical Plant Room (100% emergency backup)";
  }
  // 4. Open Offices / Large Occupied Rooms (> 60 m² require Anti-panic 0.5 Lux)
  else if (/office|workstation|open\s*plan|conference|meeting|retail|hall|canteen/i.test(text)) {
    if (s.area >= 60) {
      emQty = Math.max(2, Math.ceil(s.area / 30)); // approx 20-25% coverage
      emWatts = 18;
      exitQty = Math.max(1, Math.ceil(s.area / 80));
      exitWatts = 8;
      remarks = `Anti-panic open area lighting (${s.area.toFixed(0)}m² > 60m²)`;
    } else {
      emQty = 1;
      emWatts = 18;
      exitQty = 0;
      exitWatts = 8;
      remarks = "Standard room emergency luminaire";
    }
  }
  // 5. Restrooms / Changing / Toilets
  else if (/toilet|restroom|washroom|wc|changing/i.test(text)) {
    if (s.area >= 12) {
      emQty = Math.max(1, Math.ceil(s.area / 20));
      emWatts = 12;
      exitQty = 0;
      exitWatts = 8;
      remarks = "Public restroom emergency fitting";
    } else {
      emQty = 1;
      emWatts = 12;
      exitQty = 0;
      exitWatts = 8;
      remarks = "Single cubicle/restroom emergency unit";
    }
  }
  // 6. Generic / Storage / Warehouse
  else {
    emQty = Math.max(1, Math.ceil(s.area / 35));
    emWatts = 18;
    exitQty = s.area > 50 ? 1 : 0;
    exitWatts = 8;
    remarks = "General escape & standby lighting";
  }

  // If IFC model actually had light fixtures modeled in 3D (Scenario A)
  if (s.lightFixtureCount && s.lightFixtureCount > 0) {
    const derivedEm = Math.max(1, Math.round(s.lightFixtureCount * 0.25));
    emQty = derivedEm;
    remarks += ` (Derived from ${s.lightFixtureCount} 3D IFC luminaires)`;
  }

  return {
    id: `cbs-${Date.now()}-${index}`,
    description: `${floorTag}${s.name}`,
    emLightQty: emQty,
    emLightW: emWatts,
    exitLightQty: exitQty,
    exitLightW: exitWatts,
    remarks,
    flagged: false,
  };
}

export function convertBimSpacesToCbsRows(spaces: BimSpaceForCbs[]): CBSRow[] {
  const validSpaces = spaces.filter((s) => (s.area || 0) >= 1.0);
  const targetSpaces = validSpaces.length > 0 ? validSpaces : spaces;
  return targetSpaces.map((s, idx) => convertBimSpaceToCbsRow(s, idx));
}

