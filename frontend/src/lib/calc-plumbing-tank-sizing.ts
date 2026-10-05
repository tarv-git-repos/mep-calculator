export interface TankSizingParams {
  dailyDemand: number | "";
  storageDays: number | "";
  peakFlow: number | "";
  pumpFillRate: number | "";
  safetyFactor: number | ""; // %
  usableDepth: number | "";
  numCompartments: number;
}

export type TankPresetKey =
  | "residential_apartment"
  | "commercial_office"
  | "hospital_facility"
  | "hotel_resort"
  | "school_campus"
  | "custom";

export interface TankPresetConfig {
  key: TankPresetKey;
  label: string;
  category: string;
  description: string;
  dailyDemand: number; // L (SI) or gal (IP)
  storageDays: number;
  peakFlow: number; // L/s (SI) or GPM (IP)
  pumpFillRate: number; // L/s (SI) or GPM (IP)
  safetyFactor: number; // %
  usableDepth: number; // m (SI) or ft (IP)
  numCompartments: number;
}

export const SI_PRESETS: Record<TankPresetKey, TankPresetConfig> = {
  residential_apartment: {
    key: "residential_apartment",
    label: "Residential High-Rise Tower",
    category: "IPC Chapter 6 / Domestic",
    description: "Multi-family residential complex based on 150-200 L/person/day with 1.0 day storage autonomy.",
    dailyDemand: 30000,
    storageDays: 1,
    peakFlow: 5.0,
    pumpFillRate: 4.0,
    safetyFactor: 10,
    usableDepth: 2.5,
    numCompartments: 2,
  },
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office Building",
    category: "BS EN 806 / Commercial",
    description: "Office tower with central washroom cores, executive pantries, and 45 L/person/day occupancy load.",
    dailyDemand: 20000,
    storageDays: 1,
    peakFlow: 3.5,
    pumpFillRate: 3.0,
    safetyFactor: 10,
    usableDepth: 2.5,
    numCompartments: 2,
  },
  hospital_facility: {
    key: "hospital_facility",
    label: "Hospital / Healthcare Center",
    category: "Critical Infrastructure / ASPE",
    description: "Critical care medical facility requiring mandatory 48-hour continuous storage reserve.",
    dailyDemand: 60000,
    storageDays: 2,
    peakFlow: 8.0,
    pumpFillRate: 6.0,
    safetyFactor: 15,
    usableDepth: 3.0,
    numCompartments: 2,
  },
  hotel_resort: {
    key: "hotel_resort",
    label: "5-Star Hotel & Luxury Resort",
    category: "Hospitality / IPC 606",
    description: "High-end hotel rooms, laundry facilities, commercial kitchens, and 300 L/guest/day demand.",
    dailyDemand: 50000,
    storageDays: 1.5,
    peakFlow: 7.0,
    pumpFillRate: 5.0,
    safetyFactor: 15,
    usableDepth: 3.0,
    numCompartments: 2,
  },
  school_campus: {
    key: "school_campus",
    label: "School & University Campus",
    category: "Institutional / BS EN 806",
    description: "Educational facility with laboratories, cafeteria, sports amenities, and student washrooms.",
    dailyDemand: 15000,
    storageDays: 1,
    peakFlow: 3.0,
    pumpFillRate: 2.5,
    safetyFactor: 10,
    usableDepth: 2.0,
    numCompartments: 2,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined water storage and break tank sizing parameters.",
    dailyDemand: 20000,
    storageDays: 1,
    peakFlow: 3.5,
    pumpFillRate: 3.0,
    safetyFactor: 10,
    usableDepth: 2.5,
    numCompartments: 2,
  },
};


export function computeTankSizingCalculations(
  sizingParams: TankSizingParams,
  unitSystem: "ip" | "si"
) {
  const isIp = unitSystem === "ip";
  const daily = typeof sizingParams.dailyDemand === "number" ? sizingParams.dailyDemand : 0;
  const days = typeof sizingParams.storageDays === "number" ? sizingParams.storageDays : 0;
  const peak = typeof sizingParams.peakFlow === "number" ? sizingParams.peakFlow : 0;
  const pump = typeof sizingParams.pumpFillRate === "number" ? sizingParams.pumpFillRate : 0;
  const safetyPct = typeof sizingParams.safetyFactor === "number" ? sizingParams.safetyFactor : 0;
  const depth = typeof sizingParams.usableDepth === "number" ? sizingParams.usableDepth : (isIp ? 8 : 2.5);
  const comps = sizingParams.numCompartments || 2;

  // 1. Consumption Storage
  const storageDemandVol = daily * days; // gal or Litres

  // 2. Break Tank / Buffer (30 minutes peak surge flow)
  // In IP: Peak is GPM -> 30 mins = Peak * 30 gal
  // In SI: Peak is L/s -> 30 mins (1800 s) = Peak * 1800 Litres
  const peakSurgeVol = isIp ? peak * 30 : peak * 1800;

  // 3. Base Capacity
  const baseCapacity = Math.max(storageDemandVol, peakSurgeVol);

  // 4. Safety Margin
  const safetyMarginVol = baseCapacity * (safetyPct / 100);
  const recommendedCapacity = Math.round(baseCapacity + safetyMarginVol);

  // Dual Unit Conversions
  const capacityGal = isIp ? recommendedCapacity : Math.round(recommendedCapacity / 3.78541);
  const capacityLitres = isIp ? Math.round(recommendedCapacity * 3.78541) : recommendedCapacity;
  const capacityM3 = Number((capacityLitres / 1000).toFixed(2));
  const capacityFt3 = Number((capacityGal / 7.48052).toFixed(1));

  // Refill / Pump Inflow Calculations
  // In IP: pump is GPM -> fill minutes = recommended / pump
  // In SI: pump is L/s -> fill minutes = (recommended / pump) / 60
  let fillTimeMinutes = 0;
  if (pump > 0) {
    fillTimeMinutes = isIp ? recommendedCapacity / pump : (recommendedCapacity / pump) / 60;
  }
  const fillTimeHours = Number((fillTimeMinutes / 60).toFixed(2));

  // Compartment Split
  const perCompartmentVol = Math.round(recommendedCapacity / comps);
  const perCompartmentM3 = Number((capacityM3 / comps).toFixed(2));
  const perCompartmentGal = Math.round(capacityGal / comps);

  // Suggested Physical Tank Footprint (Aspect Ratio ~ 2:1 Rectangular)
  const effectiveDepth = depth > 0 ? depth : (isIp ? 8 : 2.5);
  let floorArea = 0;
  let tankLength = 0;
  let tankWidth = 0;

  if (isIp) {
    floorArea = capacityFt3 / effectiveDepth;
    tankWidth = Math.sqrt(floorArea / 2);
    tankLength = tankWidth * 2;
  } else {
    floorArea = capacityM3 / effectiveDepth;
    tankWidth = Math.sqrt(floorArea / 2);
    tankLength = tankWidth * 2;
  }

  return {
    isIp,
    volUnit: isIp ? "gal" : "L",
    volUnitAlt: isIp ? "m³" : "gal",
    flowUnit: isIp ? "GPM" : "L/s",
    dimUnit: isIp ? "ft" : "m",
    areaUnit: isIp ? "sq.ft" : "m²",
    storageDemandVol,
    peakSurgeVol,
    baseCapacity,
    safetyMarginVol,
    recommendedCapacity,
    capacityGal,
    capacityLitres,
    capacityM3,
    capacityFt3,
    fillTimeMinutes: Number(fillTimeMinutes.toFixed(1)),
    fillTimeHours,
    perCompartmentVol,
    perCompartmentM3,
    perCompartmentGal,
    comps,
    effectiveDepth,
    floorArea: Number(floorArea.toFixed(1)),
    tankLength: Number(tankLength.toFixed(2)),
    tankWidth: Number(tankWidth.toFixed(2)),
  };
}
