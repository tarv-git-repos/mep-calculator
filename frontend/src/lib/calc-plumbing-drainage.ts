export type DrainagePresetKey =
  | "commercial_office"
  | "residential_apartment"
  | "luxury_hotel"
  | "restaurant_kitchen"
  | "hospital_clinic"
  | "educational_school"
  | "custom";

export interface FixtureRowItem {
  id: string;
  name: string;
  category: "sanitary" | "kitchen" | "laundry" | "special";
  dfu: number;
  val: number;
  minTrapSizeInches: number;
  notes: string;
}

export interface DrainageFixtureMeta {
  id: string;
  name: string;
  short: string;
  category: "sanitary" | "kitchen" | "laundry" | "special";
  dfu: number;
  minTrapSizeInches: number;
  notes: string;
}

export const DRAINAGE_FIXTURES_META: DrainageFixtureMeta[] = [
  { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", short: "WC (Flush)", category: "sanitary", dfu: 4.0, minTrapSizeInches: 3.0, notes: "Public restrooms" },
  { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", short: "WC (Tank)", category: "sanitary", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Private / residential" },
  { id: "lavatory", name: "Lavatory / Hand Basin", short: "LAV / Basin", category: "sanitary", dfu: 1.0, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
  { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", short: "Urinal", category: "sanitary", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
  { id: "bathtub_shower", name: "Bathtub / Shower Combo", short: "Bath/Shower", category: "sanitary", dfu: 2.0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
  { id: "shower_stall", name: "Shower Stall (Dedicated)", short: "Shower", category: "sanitary", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
  { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", short: "Kitchen Sink", category: "kitchen", dfu: 2.0, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
  { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", short: "Pot Sink", category: "kitchen", dfu: 3.0, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
  { id: "dishwasher_comm", name: "Commercial Dishwasher", short: "Dishwasher", category: "kitchen", dfu: 3.0, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
  { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", short: "Washer", category: "laundry", dfu: 3.0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
  { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", short: "Floor Drain", category: "special", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
  { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", short: "Floor Drain 3\"", category: "special", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
  { id: "service_sink", name: "Service Sink / Janitor Mop Basin", short: "Mop Basin", category: "special", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
  { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", short: "Fountain", category: "special", dfu: 0.5, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
];

export interface DrainageSpaceItem {
  id: string;
  floor: string;
  desc: string;
  fixtures: Record<string, number>;
  spaceQty: number;
  floorsQty: number;
  comments?: any[];
}

export interface DrainagePresetConfig {
  key: DrainagePresetKey;
  label: string;
  category: string;
  description: string;
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  slope: number; // in/ft (e.g. 0.25 = 1/4 in/ft)
  material: "pvc" | "cast_iron" | "hdpe" | "copper";
  safetyFactor: number; // %
  ventLength: number; // ft
  fixtures: FixtureRowItem[];
}

export const DEFAULT_FIXTURES: FixtureRowItem[] = DRAINAGE_FIXTURES_META.map(f => ({
  id: f.id,
  name: f.name,
  category: f.category,
  dfu: f.dfu,
  val: 0,
  minTrapSizeInches: f.minTrapSizeInches,
  notes: f.notes,
}));

export const DRAINAGE_PRESET_SPACES: Record<DrainagePresetKey, { floorSections: string[]; spaces: DrainageSpaceItem[] }> = {
  commercial_office: {
    floorSections: ["6th FLOOR (CORE)"],
    spaces: [
      { id: "s1", floor: "6th FLOOR (CORE)", desc: "Main Restroom Core (Male & Female)", fixtures: { wc_flush_valve: 8, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s2", floor: "6th FLOOR (CORE)", desc: "Executive Restrooms", fixtures: { wc_flush_valve: 4, urinal_fv: 2, lavatory: 4, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s3", floor: "6th FLOOR (CORE)", desc: "Office Pantry & Coffee Stations", fixtures: { kitchen_sink_dom: 2, floor_drain_2: 1 }, spaceQty: 1, floorsQty: 1 },
      { id: "s4", floor: "6th FLOOR (CORE)", desc: "Janitor Service Closet", fixtures: { service_sink: 2, floor_drain_2: 1 }, spaceQty: 1, floorsQty: 1 },
      { id: "s5", floor: "6th FLOOR (CORE)", desc: "Corridor Drinking Water Coolers", fixtures: { drinking_fountain: 4 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  residential_apartment: {
    floorSections: ["TYPICAL RESIDENTIAL FLOORS"],
    spaces: [
      { id: "s1", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "2-Bedroom Master Bathrooms", fixtures: { wc_tank: 1, lavatory: 2, bathtub_shower: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
      { id: "s2", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "Guest Bathrooms", fixtures: { wc_tank: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
      { id: "s3", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "Apartment Kitchens & Laundries", fixtures: { kitchen_sink_dom: 1, clothes_washer: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
    ],
  },
  luxury_hotel: {
    floorSections: ["GUESTROOM WINGS", "PUBLIC & SERVICE PODIUM"],
    spaces: [
      { id: "s1", floor: "GUESTROOM WINGS", desc: "King Deluxe Suite En-Suite", fixtures: { wc_tank: 1, lavatory: 2, bathtub_shower: 1, shower_stall: 1 }, spaceQty: 10, floorsQty: 5 },
      { id: "s2", floor: "GUESTROOM WINGS", desc: "Twin Suite En-Suite", fixtures: { wc_tank: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 8, floorsQty: 5 },
      { id: "s3", floor: "PUBLIC & SERVICE PODIUM", desc: "Hotel Banquet Prep Kitchen", fixtures: { kitchen_sink_comm: 4, dishwasher_comm: 2, floor_drain_2: 4, service_sink: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s4", floor: "PUBLIC & SERVICE PODIUM", desc: "Lobby Public Restrooms", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  restaurant_kitchen: {
    floorSections: ["COMMERCIAL KITCHEN & DINING"],
    spaces: [
      { id: "s1", floor: "COMMERCIAL KITCHEN & DINING", desc: "Scullery & Pot Washing Zone", fixtures: { kitchen_sink_comm: 4, dishwasher_comm: 2, floor_drain_2: 4 }, spaceQty: 1, floorsQty: 1 },
      { id: "s2", floor: "COMMERCIAL KITCHEN & DINING", desc: "Hot Prep & Cookline Drains", fixtures: { kitchen_sink_dom: 2, floor_drain_3: 4, service_sink: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s3", floor: "COMMERCIAL KITCHEN & DINING", desc: "Customer Restrooms (M/F)", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  hospital_clinic: {
    floorSections: ["INPATIENT WARD (LEVEL 2-4)", "GROUND FLOOR CLINIC"],
    spaces: [
      { id: "s1", floor: "INPATIENT WARD (LEVEL 2-4)", desc: "Patient Private Rooms", fixtures: { wc_flush_valve: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 12, floorsQty: 3 },
      { id: "s2", floor: "INPATIENT WARD (LEVEL 2-4)", desc: "Nurses Station & Dirty Utility", fixtures: { service_sink: 2, kitchen_sink_dom: 1, floor_drain_2: 2 }, spaceQty: 2, floorsQty: 3 },
      { id: "s3", floor: "GROUND FLOOR CLINIC", desc: "Outpatient Core Restrooms", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  educational_school: {
    floorSections: ["ACADEMIC WING", "SPORTS & CAFETERIA"],
    spaces: [
      { id: "s1", floor: "ACADEMIC WING", desc: "Boys & Girls Restroom Core", fixtures: { wc_flush_valve: 10, urinal_fv: 8, lavatory: 8, floor_drain_2: 4 }, spaceQty: 2, floorsQty: 3 },
      { id: "s2", floor: "ACADEMIC WING", desc: "Science & Art Laboratories", fixtures: { kitchen_sink_dom: 6, floor_drain_2: 2 }, spaceQty: 2, floorsQty: 3 },
      { id: "s3", floor: "SPORTS & CAFETERIA", desc: "Gym Locker Rooms & Showers", fixtures: { shower_stall: 8, wc_flush_valve: 4, lavatory: 4, floor_drain_2: 4 }, spaceQty: 2, floorsQty: 1 },
      { id: "s4", floor: "SPORTS & CAFETERIA", desc: "Cafeteria Kitchen & Washup", fixtures: { kitchen_sink_comm: 3, dishwasher_comm: 1, service_sink: 2, floor_drain_2: 3 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  custom: {
    floorSections: ["CUSTOM FLOOR SECTION"],
    spaces: [
      { id: "s1", floor: "CUSTOM FLOOR SECTION", desc: "Sanitary Restroom Core", fixtures: { wc_flush_valve: 4, lavatory: 4, urinal_fv: 2, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
};

export const DRAINAGE_PRESETS: Record<DrainagePresetKey, DrainagePresetConfig> = {
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office Floor",
    category: "IPC / Commercial Branch & Stack",
    description: "Multi-fixture male/female commercial restroom core with WCs, urinals, lavatories, and pantry.",
    systemType: "branch",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 45,
    fixtures: DEFAULT_FIXTURES,
  },
  residential_apartment: {
    key: "residential_apartment",
    label: "Residential Apartment Stack",
    category: "IPC / Multi-Family Stack",
    description: "6-story multi-family apartment residential soil & waste vertical drainage stack.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 60,
    fixtures: DEFAULT_FIXTURES,
  },
  luxury_hotel: {
    key: "luxury_hotel",
    label: "Luxury Hotel Guestrooms & Kitchen",
    category: "IPC / Hospitality Sizing",
    description: "Multi-story luxury guestrooms with heavy drainage scullery prep and public amenities.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "cast_iron",
    safetyFactor: 15,
    ventLength: 75,
    fixtures: DEFAULT_FIXTURES,
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant & Commercial Kitchen",
    category: "IPC / High Grease Commercial",
    description: "High-discharge pot washing sinks, commercial dishwashers, and floor drains.",
    systemType: "building_drain",
    slope: 0.25,
    material: "cast_iron",
    safetyFactor: 20,
    ventLength: 50,
    fixtures: DEFAULT_FIXTURES,
  },
  hospital_clinic: {
    key: "hospital_clinic",
    label: "Hospital / Healthcare Clinic",
    category: "IPC / Healthcare Ward",
    description: "Inpatient private suites, clinical janitor dirty utility basins, and outpatient core.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "hdpe",
    safetyFactor: 20,
    ventLength: 65,
    fixtures: DEFAULT_FIXTURES,
  },
  educational_school: {
    key: "educational_school",
    label: "Educational School Campus",
    category: "IPC / Institutional High-Use",
    description: "High simultaneous peak usage school restroom batteries, lab sinks, and sports locker rooms.",
    systemType: "building_drain",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 55,
    fixtures: DEFAULT_FIXTURES,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "User Defined",
    description: "Custom user-defined drainage layout with specific space configurations.",
    systemType: "branch",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 45,
    fixtures: DEFAULT_FIXTURES,
  },
};

export const MATERIAL_ROUGHNESS: Record<string, { n: number; name: string }> = {
  pvc: { n: 0.009, name: "PVC / ABS Schedule 40 (n = 0.009)" },
  cast_iron: { n: 0.012, name: "Cast Iron Hubless / No-Hub (n = 0.012)" },
  hdpe: { n: 0.009, name: "HDPE Drainage Pipe (n = 0.009)" },
  copper: { n: 0.011, name: "Copper Type DWV (n = 0.011)" },
};

export const BRANCH_CAPACITY: { size: number; maxDfu: number; dn: number }[] = [
  { size: 1.5, maxDfu: 3, dn: 40 },
  { size: 2.0, maxDfu: 6, dn: 50 },
  { size: 2.5, maxDfu: 12, dn: 65 },
  { size: 3.0, maxDfu: 20, dn: 80 },
  { size: 4.0, maxDfu: 160, dn: 100 },
  { size: 5.0, maxDfu: 360, dn: 125 },
  { size: 6.0, maxDfu: 620, dn: 150 },
  { size: 8.0, maxDfu: 1400, dn: 200 },
  { size: 10.0, maxDfu: 2500, dn: 250 },
  { size: 12.0, maxDfu: 3900, dn: 300 },
];

export const STACK_CAPACITY: { size: number; maxShort: number; maxTall: number; dn: number }[] = [
  { size: 1.5, maxShort: 4, maxTall: 8, dn: 40 },
  { size: 2.0, maxShort: 10, maxTall: 24, dn: 50 },
  { size: 2.5, maxShort: 20, maxTall: 42, dn: 65 },
  { size: 3.0, maxShort: 48, maxTall: 72, dn: 80 },
  { size: 4.0, maxShort: 240, maxTall: 500, dn: 100 },
  { size: 5.0, maxShort: 540, maxTall: 1100, dn: 125 },
  { size: 6.0, maxShort: 960, maxTall: 1900, dn: 150 },
  { size: 8.0, maxShort: 2200, maxTall: 3600, dn: 200 },
  { size: 10.0, maxShort: 3800, maxTall: 5600, dn: 250 },
  { size: 12.0, maxShort: 6000, maxTall: 8400, dn: 300 },
];

export const BUILDING_DRAIN_CAPACITY: { size: number; s0625: number; s125: number; s25: number; s50: number; dn: number }[] = [
  { size: 1.5, s0625: 0, s125: 0, s25: 1, s50: 1, dn: 40 },
  { size: 2.0, s0625: 0, s125: 0, s25: 21, s50: 26, dn: 50 },
  { size: 2.5, s0625: 0, s125: 0, s25: 24, s50: 31, dn: 65 },
  { size: 3.0, s0625: 0, s125: 36, s25: 42, s50: 50, dn: 80 },
  { size: 4.0, s0625: 180, s125: 216, s25: 250, s50: 290, dn: 100 },
  { size: 5.0, s0625: 390, s125: 480, s25: 575, s50: 675, dn: 125 },
  { size: 6.0, s0625: 700, s125: 840, s25: 1000, s50: 1300, dn: 150 },
  { size: 8.0, s0625: 1400, s125: 1920, s25: 2300, s50: 3000, dn: 200 },
  { size: 10.0, s0625: 2500, s125: 3500, s25: 4200, s50: 5300, dn: 250 },
  { size: 12.0, s0625: 3900, s125: 5600, s25: 6700, s50: 8300, dn: 300 },
];

export function computeVentSize(soilStackSize: number, totalDfu: number, ventLengthFt: number): { size: number; dn: number } {
  if (soilStackSize <= 1.5) return { size: 1.25, dn: 32 };
  if (soilStackSize <= 2.0) {
    if (ventLengthFt <= 50) return { size: 1.5, dn: 40 };
    return { size: 2.0, dn: 50 };
  }
  if (soilStackSize <= 3.0) {
    if (totalDfu <= 20 && ventLengthFt <= 60) return { size: 1.5, dn: 40 };
    if (ventLengthFt <= 100) return { size: 2.0, dn: 50 };
    return { size: 2.5, dn: 65 };
  }
  if (soilStackSize <= 4.0) {
    if (totalDfu <= 100 && ventLengthFt <= 50) return { size: 2.0, dn: 50 };
    if (ventLengthFt <= 100) return { size: 2.5, dn: 65 };
    if (ventLengthFt <= 200) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  if (soilStackSize <= 6.0) {
    if (ventLengthFt <= 100) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  return { size: 4.0, dn: 100 };
}


export function computeDrainageCalculations(
  drainageSpaces: DrainageSpaceItem[],
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain",
  slope: number,
  material: "pvc" | "cast_iron" | "hdpe" | "copper",
  safetyFactor: number,
  ventLength: number
) {
  // 1. Calculate space DFU subtotals and aggregated fixture totals
  const fixtureTotalCounts: Record<string, number> = {};
  DRAINAGE_FIXTURES_META.forEach(f => {
    fixtureTotalCounts[f.id] = 0;
  });

  let rawDfu = 0;
  let totalConnectedAppliances = 0;

  drainageSpaces.forEach(space => {
    const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
    let spaceUnitDfu = 0;

    Object.entries(space.fixtures || {}).forEach(([fid, qty]) => {
      const meta = DRAINAGE_FIXTURES_META.find(f => f.id === fid);
      const count = Number(qty) || 0;
      if (meta && count > 0) {
        spaceUnitDfu += meta.dfu * count;
        fixtureTotalCounts[fid] = (fixtureTotalCounts[fid] || 0) + (count * mult);
        totalConnectedAppliances += count * mult;
      }
    });

    rawDfu += spaceUnitDfu * mult;
  });

  // 2. Factored Design DFU
  const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));

  // 3. Water Closet 3" NPS Rule Check
  const wcFlushCount = fixtureTotalCounts.wc_flush_valve || 0;
  const wcTankCount = fixtureTotalCounts.wc_tank || 0;
  const wcCount = wcFlushCount + wcTankCount;
  const hasWc = wcCount > 0;

  // 4. Pipe Sizing
  let sizedNps = 1.5;
  let sizedDn = 40;
  let maxAllowedDfu = 3;

  if (systemType === "branch") {
    const match = BRANCH_CAPACITY.find(b => b.maxDfu >= designDfu);
    if (match) {
      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowedDfu = match.maxDfu;
    } else {
      const last = BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
      sizedNps = last.size;
      sizedDn = last.dn;
      maxAllowedDfu = last.maxDfu;
    }
    if (wcCount >= 1 && wcCount <= 2 && sizedNps < 3.0) {
      sizedNps = 3.0;
      sizedDn = 80;
      maxAllowedDfu = 20;
    } else if (wcCount > 2 && sizedNps < 4.0) {
      sizedNps = 4.0;
      sizedDn = 100;
      maxAllowedDfu = 160;
    }
  } else if (systemType === "stack_short" || systemType === "stack_tall") {
    const isShort = systemType === "stack_short";
    const match = STACK_CAPACITY.find(s => (isShort ? s.maxShort : s.maxTall) >= designDfu);
    if (match) {
      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowedDfu = isShort ? match.maxShort : match.maxTall;
    } else {
      const last = STACK_CAPACITY[STACK_CAPACITY.length - 1];
      sizedNps = last.size;
      sizedDn = last.dn;
      maxAllowedDfu = isShort ? last.maxShort : last.maxTall;
    }
    if (hasWc && sizedNps < 3.0) {
      sizedNps = 3.0;
      sizedDn = 80;
      maxAllowedDfu = isShort ? 48 : 72;
    }
  } else {
    // Building drain
    const match = BUILDING_DRAIN_CAPACITY.find(b => {
      let cap = b.s25;
      if (slope <= 0.0625) cap = b.s0625;
      else if (slope <= 0.125) cap = b.s125;
      else if (slope <= 0.25) cap = b.s25;
      else cap = b.s50;
      return cap >= designDfu && cap > 0;
    });
    if (match) {
      sizedNps = match.size;
      sizedDn = match.dn;
      let cap = match.s25;
      if (slope <= 0.0625) cap = match.s0625;
      else if (slope <= 0.125) cap = match.s125;
      else if (slope <= 0.25) cap = match.s25;
      else cap = match.s50;
      maxAllowedDfu = cap;
    } else {
      const last = BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];
      sizedNps = last.size;
      sizedDn = last.dn;
      maxAllowedDfu = slope <= 0.125 ? last.s125 : last.s25;
    }
    if (hasWc && sizedNps < 3.0) {
      sizedNps = 3.0;
      sizedDn = 80;
      maxAllowedDfu = slope <= 0.125 ? 36 : 42;
    }
  }

  // 5. Hydraulics & Manning's Equation for Gravity Flow
  const roughness = MATERIAL_ROUGHNESS[material]?.n || 0.009;
  const slopeDecimal = slope / 12.0;
  const dFeet = sizedNps / 12.0;
  const dMeters = (sizedNps * 25.4) / 1000.0;

  const rhFeet = dFeet / 4.0;
  const rhMeters = dMeters / 4.0;
  const areaHalfSqFt = (Math.PI * Math.pow(dFeet, 2)) / 8.0;

  const velocityFps = (1.486 / roughness) * Math.pow(rhFeet, 2 / 3) * Math.pow(slopeDecimal, 0.5);
  const velocityMps = (1.0 / roughness) * Math.pow(rhMeters, 2 / 3) * Math.pow(slopeDecimal, 0.5);

  const qCapCfs = velocityFps * areaHalfSqFt;
  const qCapGpm = qCapCfs * 448.831;
  const qCapLps = qCapGpm * 0.06309;

  // 6. Vent Sizing
  const vent = computeVentSize(sizedNps, designDfu, ventLength);

  // 7. Slope Text Display
  const slopeInPerFt = slope;
  const slopeMmPerM = slope * 83.333;
  const slopePercent = (slope / 12.0) * 100;

  // 8. Breakdown Percentages by Category
  const sanitaryDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "sanitary").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
  const kitchenDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "kitchen").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
  const laundryDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "laundry").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
  const specialDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "special").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);

  const breakdown = [
    { id: "sanitary", name: "WCs, Lavs & Urinals", dfu: sanitaryDfu, color: "#2563EB", pct: rawDfu > 0 ? (sanitaryDfu / rawDfu) * 100 : 0 },
    { id: "kitchen", name: "Kitchen & Scullery", dfu: kitchenDfu, color: "#F59E0B", pct: rawDfu > 0 ? (kitchenDfu / rawDfu) * 100 : 0 },
    { id: "laundry", name: "Laundry Standpipes", dfu: laundryDfu, color: "#10B981", pct: rawDfu > 0 ? (laundryDfu / rawDfu) * 100 : 0 },
    { id: "special", name: "Floor Drains & Janitor", dfu: specialDfu, color: "#8B5CF6", pct: rawDfu > 0 ? (specialDfu / rawDfu) * 100 : 0 },
  ];

  // Fixture list format for report and compatibility
  const aggregatedFixtures: FixtureRowItem[] = DRAINAGE_FIXTURES_META.map(f => ({
    id: f.id,
    name: f.name,
    category: f.category,
    dfu: f.dfu,
    val: fixtureTotalCounts[f.id] || 0,
    minTrapSizeInches: f.minTrapSizeInches,
    notes: f.notes,
  }));

  return {
    rawDfu,
    totalCount: totalConnectedAppliances,
    designDfu,
    sizedNps,
    sizedDn,
    maxAllowedDfu,
    capacityUtilization: maxAllowedDfu > 0 ? (designDfu / maxAllowedDfu) * 100 : 0,
    velocityFps: parseFloat(velocityFps.toFixed(2)),
    velocityMps: parseFloat(velocityMps.toFixed(2)),
    isScourVelocityOk: velocityFps >= 2.0,
    qCapGpm: Math.round(qCapGpm),
    qCapLps: parseFloat(qCapLps.toFixed(1)),
    ventNps: vent.size,
    ventDn: vent.dn,
    slopeInPerFt,
    slopeMmPerM: parseFloat(slopeMmPerM.toFixed(1)),
    slopePercent: parseFloat(slopePercent.toFixed(2)),
    roughness,
    materialName: MATERIAL_ROUGHNESS[material]?.name || "PVC DWV",
    hasWc,
    wcCount,
    breakdown,
    fixtureTotalCounts,
    aggregatedFixtures,
  };
}

export function computeDrainageFloorSizing(
  floorSections: string[],
  drainageSpaces: DrainageSpaceItem[],
  safetyFactor: number,
  floorSystemTypes: Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain">,
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain",
  slope: number
) {
  const res: Record<string, {
    rawDfu: number;
    designDfu: number;
    wcCount: number;
    sizedNps: number;
    sizedDn: number;
    maxAllowedDfu: number;
    capacityUtilization?: number;
    systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  }> = {};

  floorSections.forEach(fl => {
    const flSpaces = drainageSpaces.filter(s => (s.floor || floorSections[0]) === fl);
    let rawDfu = 0;
    let wcCount = 0;

    flSpaces.forEach(space => {
      const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
      DRAINAGE_FIXTURES_META.forEach(f => {
        const count = space.fixtures[f.id] || 0;
        if (count > 0) {
          rawDfu += f.dfu * count * mult;
          if (f.id === "wc_flush_valve" || f.id === "wc_tank") {
            wcCount += count * mult;
          }
        }
      });
    });

    const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));
    const flSysType = floorSystemTypes[fl] || systemType || "branch";
    const hasWc = wcCount > 0;

    let sizedNps = 1.5;
    let sizedDn = 40;
    let maxAllowedDfu = 3;

    if (flSysType === "branch") {
      const match = BRANCH_CAPACITY.find(b => b.maxDfu >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = match.maxDfu;
      } else {
        const last = BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = last.maxDfu;
      }
      if (wcCount >= 1 && wcCount <= 2 && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = 20;
      } else if (wcCount > 2 && sizedNps < 4.0) {
        sizedNps = 4.0;
        sizedDn = 100;
        maxAllowedDfu = 160;
      }
    } else if (flSysType === "stack_short" || flSysType === "stack_tall") {
      const isShort = flSysType === "stack_short";
      const match = STACK_CAPACITY.find(s => (isShort ? s.maxShort : s.maxTall) >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = isShort ? match.maxShort : match.maxTall;
      } else {
        const last = STACK_CAPACITY[STACK_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = isShort ? last.maxShort : last.maxTall;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = isShort ? 48 : 72;
      }
    } else {
      // Building drain
      const match = BUILDING_DRAIN_CAPACITY.find(b => {
        let cap = b.s25;
        if (slope <= 0.0625) cap = b.s0625;
        else if (slope <= 0.125) cap = b.s125;
        else if (slope <= 0.25) cap = b.s25;
        else cap = b.s50;
        return cap >= designDfu && cap > 0;
      });
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        let cap = match.s25;
        if (slope <= 0.0625) cap = match.s0625;
        else if (slope <= 0.125) cap = match.s125;
        else if (slope <= 0.25) cap = match.s25;
        else cap = match.s50;
        maxAllowedDfu = cap;
      } else {
        const last = BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = slope <= 0.125 ? last.s125 : last.s25;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = slope <= 0.125 ? 36 : 42;
      }
    }

    const capacityUtilization = maxAllowedDfu > 0 ? (designDfu / maxAllowedDfu) * 100 : 0;

    res[fl] = {
      rawDfu,
      designDfu,
      wcCount,
      sizedNps,
      sizedDn,
      maxAllowedDfu,
      capacityUtilization,
      systemType: flSysType,
    };
  });

  return res;
}
