export interface OverheadTank {
  id: number;
  name: string;
  splitPct: number;
}

export interface WDRow {
  id: number;
  name: string;
  ppl: number;
  cat: string;
  lpd: number;
  multiplier?: number;
  autoDetected?: boolean;
  flagged?: boolean;
  comments?: any[];
}

export interface IrrRow {
  id: number;
  area: number;
  vegType: string;
  lpd: number;
  flagged?: boolean;
  comments?: any[];
}

export const WD_TYPE_MAP: Record<string, number> = {
  // Residential
  "Residential buildings (flat)": 300,
  "Villas": 350,
  "Mixed used residential": 350,
  "Labour accommodation": 150,
  // Office & Commercial
  "Offices": 60,
  "Headquarters": 80,
  "Commercial buildings": 100,
  "Mixed used commercial": 80,
  "Logistic, academic & business center": 75,
  // Retail & Leisure
  "Local plaza / retail / town center": 82,
  "Shops": 60,
  "Club house / recreation": 100,
  "Entertainment & leisure / theater": 60,
  "Theatre": 50,
  "Events": 50,
  // Hospitality
  "Hotels (per guest)": 300,
  "Hotels (per employee)": 80,
  "Restaurant (per meal)": 15,
  "Visitors": 40,
  // Education
  "Schools / university": 60,
  "Nursery / child care centre": 70,
  // Medical & Healthcare
  "Medical (per bed)": 450,
  "Day clinic (per medical practitioner) incl. visitors": 450,
  "Laboratory": 80,
  // Industrial
  "Manufacturing / mineral": 80,
  "Industrial (workshops / machinery / warehouse)": 80,
  "Guardhouse": 75,
  // Public & Assembly
  "Mosques": 60,
  "Public amenities": 50,
  // Custom
  "Custom Rate / Category": 100,
};

export const IRR_TYPE_MAP: Record<string, number> = {
  "Palm Trees": 150,
  "Small Palm Tree": 75,
  "Ornamental trees": 80,
  "Mix Vegetation / Mixed Planting": 30,
  "Mix Vegetarian": 30,
  "Shrubs & hedges": 15,
  "Ground cover and succulents": 12,
  "Seasonal flowers and creepers": 12,
  "Lawn with pop-up sprays": 10,
};

export const PRESET_STANDARDS = {
  dewa: {
    name: "DEWA / Dubai Municipality Guidelines",
    desc: "Standard Middle East domestic consumption rates (Flat: 300 LPD, Villa: 350 LPD, Office: 60 LPD).",
    multiplier: 1.0,
  },
  addc: {
    name: "ADDC / Abu Dhabi RSB Guidelines",
    desc: "Abu Dhabi Distribution Co. consumption standards (Flat: 270 LPD, Villa: 320 LPD, Office: 55 LPD).",
    multiplier: 0.9,
  },
  ipc: {
    name: "ASHRAE / IPC (International Plumbing Code)",
    desc: "US/International standard occupancy demand rates.",
    multiplier: 0.85,
  },
  cibse: {
    name: "BS 8558 / CIBSE Guide G Guidelines",
    desc: "UK & European CIBSE water supply & storage standards.",
    multiplier: 0.8,
  },
};

export interface AutoDetectResult {
  people: number;
  cat?: string;
  autoDetected: boolean;
}

export function detectAshraeOccupancy(desc: string): AutoDetectResult | null {
  if (!desc) return null;
  const clean = desc.trim().toLowerCase();

  let qty = 1;
  const qtyMatch = clean.match(/^(\d+)\s*(?:x|nos|no|units|flats|apartments|rooms|beds|seats|offices|classrooms|toilets|restrooms)?\s+/i);
  let textToScan = clean;

  if (qtyMatch) {
    const parsedQty = parseInt(qtyMatch[1], 10);
    if (!isNaN(parsedQty) && parsedQty > 0) {
      qty = parsedQty;
      textToScan = clean.substring(qtyMatch[0].length).trim();
    }
  }

  // Healthcare / Medical / Clinic / Lab
  if (textToScan.includes("day clinic") || textToScan.includes("practitioner") || textToScan.includes("polyclinic")) {
    return { people: qty * 5, cat: "Day clinic (per medical practitioner) incl. visitors", autoDetected: true };
  }
  if (
    textToScan.includes("hospital") ||
    textToScan.includes("clinic") ||
    textToScan.includes("patient room") ||
    textToScan.includes("bed") ||
    textToScan.includes("ward") ||
    textToScan.includes("medical")
  ) {
    return { people: qty * 2, cat: "Medical (per bed)", autoDetected: true };
  }
  if (textToScan.includes("lab") || textToScan.includes("laboratory") || textToScan.includes("diagnostic")) {
    return { people: qty * 15, cat: "Laboratory", autoDetected: true };
  }

  // Education
  if (
    textToScan.includes("classroom") ||
    textToScan.includes("class room") ||
    textToScan.includes("school") ||
    textToScan.includes("university") ||
    textToScan.includes("college") ||
    textToScan.includes("institute") ||
    textToScan.includes("lecture")
  ) {
    return { people: qty * 30, cat: "Schools / university", autoDetected: true };
  }
  if (
    textToScan.includes("nursery") ||
    textToScan.includes("child care") ||
    textToScan.includes("daycare") ||
    textToScan.includes("creche") ||
    textToScan.includes("kindergarten") ||
    textToScan.includes("kg")
  ) {
    return { people: qty * 20, cat: "Nursery / child care centre", autoDetected: true };
  }

  // Hospitality & Dining
  if (
    textToScan.includes("hotel room") ||
    textToScan.includes("hotel guest") ||
    textToScan.includes("guest room") ||
    textToScan.includes("hotel") ||
    textToScan.includes("resort")
  ) {
    return { people: qty * 2, cat: "Hotels (per guest)", autoDetected: true };
  }
  if (textToScan.includes("hotel staff") || textToScan.includes("hotel employee") || textToScan.includes("staff quarter")) {
    return { people: qty * 10, cat: "Hotels (per employee)", autoDetected: true };
  }
  if (
    textToScan.includes("restaurant") ||
    textToScan.includes("dining") ||
    textToScan.includes("cafeteria") ||
    textToScan.includes("cafe") ||
    textToScan.includes("food court") ||
    textToScan.includes("bistro") ||
    textToScan.includes("eatery")
  ) {
    return { people: qty * 40, cat: "Restaurant (per meal)", autoDetected: true };
  }
  if (textToScan.includes("visitor") || textToScan.includes("lobby") || textToScan.includes("reception") || textToScan.includes("waiting")) {
    return { people: qty * 20, cat: "Visitors", autoDetected: true };
  }

  // Industrial & Workshops
  if (textToScan.includes("manufacturing") || textToScan.includes("factory") || textToScan.includes("production") || textToScan.includes("mill")) {
    return { people: qty * 15, cat: "Manufacturing / mineral", autoDetected: true };
  }
  if (
    textToScan.includes("workshop") ||
    textToScan.includes("warehouse") ||
    textToScan.includes("depot") ||
    textToScan.includes("plant room") ||
    textToScan.includes("substation") ||
    textToScan.includes("mechanical room") ||
    textToScan.includes("pump room") ||
    textToScan.includes("industrial")
  ) {
    return { people: qty * 10, cat: "Industrial (workshops / machinery / warehouse)", autoDetected: true };
  }

  // Security / Guardhouse
  if (textToScan.includes("guard") || textToScan.includes("guardhouse") || textToScan.includes("security") || textToScan.includes("gatehouse")) {
    return { people: qty * 2, cat: "Guardhouse", autoDetected: true };
  }

  // Mosque & Public
  if (textToScan.includes("mosque") || textToScan.includes("prayer room") || textToScan.includes("masjid") || textToScan.includes("musalla")) {
    return { people: qty * 50, cat: "Mosques", autoDetected: true };
  }

  // Residential Studio / BHK / Villas
  if (textToScan.includes("studio")) {
    return { people: qty * 2, cat: "Residential buildings (flat)", autoDetected: true };
  }

  const bhkMatch = textToScan.match(/(\d+)\s*(?:bhk|bed|bedroom|br)\b/i);
  if (bhkMatch && bhkMatch[1]) {
    const bedrooms = parseInt(bhkMatch[1], 10);
    if (!isNaN(bedrooms) && bedrooms > 0) {
      const isVilla = clean.includes("villa") || clean.includes("house");
      return {
        people: qty * (bedrooms * 2),
        cat: isVilla ? "Villas" : "Residential buildings (flat)",
        autoDetected: true,
      };
    }
  }

  if (textToScan.includes("villa") || textToScan.includes("townhouse") || textToScan.includes("duplex")) {
    return { people: qty * 6, cat: "Villas", autoDetected: true };
  }

  if (textToScan.includes("flat") || textToScan.includes("apartment") || textToScan.includes("residential") || textToScan.includes("residence")) {
    return { people: qty * 4, cat: "Residential buildings (flat)", autoDetected: true };
  }

  if (textToScan.includes("labour") || textToScan.includes("labor") || textToScan.includes("worker") || textToScan.includes("camp")) {
    return { people: qty * 20, cat: "Labour accommodation", autoDetected: true };
  }

  // Restroom / Changing Room / Toilet / Amenities
  if (
    textToScan.includes("rest room") ||
    textToScan.includes("restroom") ||
    textToScan.includes("changing room") ||
    textToScan.includes("toilet") ||
    textToScan.includes("washroom") ||
    textToScan.includes("bathroom") ||
    textToScan.includes("wc")
  ) {
    return { people: qty * 15, cat: "Public amenities", autoDetected: true };
  }

  // Offices & Commercial
  if (textToScan.includes("office") || textToScan.includes("workstation") || textToScan.includes("desk") || textToScan.includes("cubicle")) {
    return { people: qty * 10, cat: "Offices", autoDetected: true };
  }
  if (textToScan.includes("headquarter") || textToScan.includes("hq")) {
    return { people: qty * 50, cat: "Headquarters", autoDetected: true };
  }
  if (textToScan.includes("commercial")) {
    return { people: qty * 25, cat: "Commercial buildings", autoDetected: true };
  }

  // Retail & Leisure
  if (textToScan.includes("shop") || textToScan.includes("retail") || textToScan.includes("store") || textToScan.includes("boutique") || textToScan.includes("supermarket")) {
    return { people: qty * 8, cat: "Shops", autoDetected: true };
  }
  if (textToScan.includes("plaza") || textToScan.includes("mall") || textToScan.includes("town center")) {
    return { people: qty * 100, cat: "Local plaza / retail / town center", autoDetected: true };
  }
  if (textToScan.includes("club") || textToScan.includes("recreation") || textToScan.includes("gym") || textToScan.includes("fitness")) {
    return { people: qty * 30, cat: "Club house / recreation", autoDetected: true };
  }
  if (textToScan.includes("theater") || textToScan.includes("theatre") || textToScan.includes("cinema") || textToScan.includes("auditorium")) {
    return { people: qty * 50, cat: "Theatre", autoDetected: true };
  }
  if (textToScan.includes("event") || textToScan.includes("exhibition") || textToScan.includes("banquet") || textToScan.includes("function hall")) {
    return { people: qty * 50, cat: "Events", autoDetected: true };
  }

  return null;
}

export type Tab = "demand" | "tanks" | "report";

export function computeWaterDemandCalculations(
  wdRows: WDRow[],
  irrRows: IrrRow[],
  poolArea: number | "",
  poolDepth: number | "",
  poolEvap: number,
  fireFlow: number | "",
  storageDays: number,
  groundTankPct: number,
  overheadTanks: OverheadTank[],
  peakFactor: number,
  fillWindowHours: number,
  ip: boolean
) {
  // Domestic Total
  let totalPeople = 0;
  let totalWaterL = 0;
  wdRows.forEach((r) => {
    const mult = r.multiplier && r.multiplier > 0 ? r.multiplier : 1;
    totalPeople += r.ppl * mult;
    totalWaterL += r.ppl * r.lpd * mult;
  });

  // Irrigation Total
  let totalIrrL = 0;
  irrRows.forEach((r) => {
    totalIrrL += r.area * r.lpd;
  });

  // Pool Total
  const pAreaVal = Number(poolArea) || 0;
  const pDepthVal = Number(poolDepth) || 0;
  const poolVolL = pAreaVal * pDepthVal * 1000;
  const poolDemandL = poolVolL * (poolEvap / 100);

  // Fire Total
  const fFlowGPM = Number(fireFlow) || 0;
  const fireLPM = fFlowGPM * 3.78541;
  const fireCapL = fireLPM * 60; // 60 mins reserve

  // Grand Total Daily Demand (Domestic + Irrigation + Pool Makeup)
  const grandTotalL = totalWaterL + totalIrrL + poolDemandL;

  // Storage Tank Calculations
  const reqStorageL = grandTotalL * (storageDays || 1);
  const reqStorageM3 = reqStorageL / 1000;
  const reqStorageGal = reqStorageL / 3.78541;

  const totalOverheadPct = overheadTanks.reduce(
    (sum, t) => sum + (Number(t.splitPct) || 0),
    0
  );
  const groundPct = Number(groundTankPct) || 100;

  const groundTankL = reqStorageL * (groundPct / 100);
  const roofTankL = reqStorageL * (totalOverheadPct / 100);

  // Dimensions helper (assuming rectangular cube with H ~ 2.2m for ground, H ~ 1.5m for roof)
  const estimateDimensions = (volM3: number, hDefault: number) => {
    if (volM3 <= 0) return { l: 0, w: 0, h: 0 };
    const h = hDefault;
    const baseArea = volM3 / h;
    const w = Math.sqrt(baseArea / 1.5);
    const l = w * 1.5;
    return {
      l: Math.round(l * 100) / 100,
      w: Math.round(w * 100) / 100,
      h: Math.round(h * 100) / 100,
    };
  };

  const groundDim = estimateDimensions(groundTankL / 1000, 2.2);

  // Unit Formatter
  const formatVol = (liters: number) => {
    if (ip) {
      return `${Math.round(liters / 3.78541).toLocaleString()} gal`;
    }
    return `${Math.round(liters).toLocaleString()} L`;
  };

  const formatRate = (litersPerDay: number) => {
    if (ip) {
      return `${Math.round(litersPerDay / 3.78541).toLocaleString()} gal/day`;
    }
    return `${Math.round(litersPerDay).toLocaleString()} L/day`;
  };

  const overheadTanksCalculated = overheadTanks.map((t) => {
    const pct = Number(t.splitPct) || 0;
    const volL = reqStorageL * (pct / 100);
    const dim = estimateDimensions(volL / 1000, 1.5);
    return {
      ...t,
      volL,
      sharePct: pct,
      dim,
      displayVol: formatVol(volL),
    };
  });

  // Peak Demand & Transfer Pump Flow
  const peakFactorVal = peakFactor || 2.5;
  const peakHourlyFlowL = (totalWaterL * peakFactorVal) / 10; // Peak 10-hr operating window
  const peakLPS = peakHourlyFlowL / 3600;
  const peakGPM = (peakHourlyFlowL / 3.78541) / 60;

  const fillHrs = fillWindowHours || 2;
  const transferPumpFlowLPH = roofTankL > 0 ? roofTankL / fillHrs : totalWaterL / fillHrs;
  const transferPumpLPS = transferPumpFlowLPH / 3600;
  const transferPumpGPM = (transferPumpFlowLPH / 3.78541) / 60;

  return {
    totalPeople,
    totalWaterL,
    totalIrrL,
    poolVolL,
    poolDemandL,
    fireLPM,
    fireCapL,
    grandTotalL,
    reqStorageL,
    reqStorageM3,
    reqStorageGal,
    totalOverheadPct,
    groundPct,
    groundTankL,
    roofTankL,
    groundDim,
    overheadTanksCalculated,
    peakHourlyFlowL,
    peakLPS,
    peakGPM,
    transferPumpFlowLPH,
    transferPumpLPS,
    transferPumpGPM,
    displayDomestic: formatRate(totalWaterL),
    displayDomesticPeak: ip
      ? `${Math.round(peakGPM).toLocaleString()} GPM`
      : `${peakLPS.toFixed(2)} L/s`,
    displayIrrigation: formatRate(totalIrrL),
    displayPoolVol: formatVol(poolVolL),
    displayPoolDemand: formatRate(poolDemandL),
    displayFireLPM: `${fireLPM.toFixed(1)} L/min (${fFlowGPM} GPM)`,
    displayFireCap: formatVol(fireCapL),
    displayGrandTotal: formatRate(grandTotalL),
    displayTotalStorage: ip
      ? `${Math.round(reqStorageGal).toLocaleString()} gal (${(reqStorageM3 * 35.3147).toFixed(1)} ft³)`
      : `${Math.round(reqStorageL).toLocaleString()} L (${reqStorageM3.toFixed(2)} m³)`,
    displayGroundTank: formatVol(groundTankL),
    displayRoofTank: formatVol(roofTankL),
    displayTransferPump: ip
      ? `${transferPumpGPM.toFixed(1)} GPM`
      : `${transferPumpLPS.toFixed(2)} L/s (${Math.round(transferPumpFlowLPH)} L/hr)`,
  };
}
