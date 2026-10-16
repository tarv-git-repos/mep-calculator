export function checkIfPclMissingData(r: { name?: string; area?: number | string; type?: string }): { isMissing: boolean; reason: string } {
  const isNoName = !r.name || r.name.trim() === "";
  const isNoArea = r.area === "" || r.area === undefined || r.area === null || parseFloat(String(r.area)) <= 0 || isNaN(parseFloat(String(r.area)));
  const isNoType = !r.type || r.type.trim() === "" || r.type.toLowerCase() === "select" || r.type.toLowerCase().includes("select type");

  if (isNoName && isNoArea && isNoType) {
    return { isMissing: true, reason: "Missing space name, area, and space type" };
  }
  if (isNoArea && isNoType) {
    return { isMissing: true, reason: "Missing space area and space type" };
  }
  if (isNoName && isNoArea) {
    return { isMissing: true, reason: "Missing space name and space area" };
  }
  if (isNoName && isNoType) {
    return { isMissing: true, reason: "Missing space name and space type" };
  }
  if (isNoName) {
    return { isMissing: true, reason: "Missing space name" };
  }
  if (isNoArea) {
    return { isMissing: true, reason: "Missing space area" };
  }
  if (isNoType) {
    return { isMissing: true, reason: "Missing space type (heat density not assigned)" };
  }
  return { isMissing: false, reason: "Complied" };
}

export interface PclRow {
  id: string;
  name: string;
  area: number | "";
  type: string;
  density: number; // W/m²
  dissipation: number; // Watts
  kw: number;
  tr: number;
  floor: string;
  selected?: boolean;
  comments?: any[];
  flagged?: boolean;
  aiDetected?: boolean;
}

const INFER_MAP: [string, string][] = [
  // Retail & Supermarket (Multilingual & Typos first)
  ["supermarkter", "Supermarket"],
  ["markter", "Supermarket"],
  ["supermarket", "Supermarket"],
  ["super market", "Supermarket"],
  ["hypermarket", "Supermarket"],
  ["hyper market", "Supermarket"],
  ["grocery", "Supermarket"],
  ["minimart", "Supermarket"],
  ["mini mart", "Supermarket"],
  ["mini-mart", "Supermarket"],
  ["convenience store", "Supermarket"],
  ["general store", "Supermarket"],
  ["provision store", "Supermarket"],
  ["superstore", "Supermarket"],
  ["foodmart", "Supermarket"],
  ["food mart", "Supermarket"],
  ["market", "Supermarket"],
  ["mart", "Supermarket"],

  // Specific Multilingual / Multi-word first
  ["master bed", "Apartment - Dwelling Unit"],
  ["guest bed", "Apartment - Dwelling Unit"],
  ["bedroom", "Apartment - Dwelling Unit"],
  ["bed room", "Apartment - Dwelling Unit"],
  ["bed", "Apartment - Dwelling Unit"],
  ["bhk", "Apartment - Dwelling Unit"],
  ["studio", "Apartment - Dwelling Unit"],
  ["flat", "Apartment - Dwelling Unit"],
  ["apartment", "Apartment - Dwelling Unit"],
  ["dwelling", "Apartment - Dwelling Unit"],
  ["living room", "Apartment - Dwelling Unit"],
  ["living", "Apartment - Dwelling Unit"],
  ["family room", "Apartment - Dwelling Unit"],
  ["dining room", "Apartment - Dwelling Unit"],
  ["dining", "Apartment - Dwelling Unit"],
  ["balcony", "Apartment - Dwelling Unit"],
  ["terrace", "Apartment - Dwelling Unit"],
  ["foyer", "Apartment - Dwelling Unit"],
  ["residential", "Apartment - Dwelling Unit"],
  ["suite", "Apartment - Dwelling Unit"],
  ["guest room", "Apartment - Dwelling Unit"],

  // Corridors
  ["res corridor", "Corridor - Residential"],
  ["residential corridor", "Corridor - Residential"],
  ["corridor - res", "Corridor - Residential"],
  ["corridor", "Corridor - Residential"],
  ["hallway", "Corridor - Residential"],
  ["passage", "Corridor - Residential"],
  ["aisle", "Corridor - Residential"],
  ["service corridor", "Corridor - BOH/Service"],
  ["boh corridor", "Corridor - BOH/Service"],

  // Lobbies
  ["lift lobby", "Lobby - Lift"],
  ["elevator lobby", "Lobby - Lift"],
  ["hotel lobby", "Lobby - Hotel"],
  ["school lobby", "Lobby - School"],
  ["tower lobby", "Lobby - Residential"],
  ["entrance lobby", "Lobby - Residential"],
  ["residential lobby", "Lobby - Residential"],
  ["reception", "Lobby - Residential"],
  ["waiting", "Lobby - Residential"],
  ["atrium", "Lobby - Residential"],
  ["lobby", "Lobby - Residential"],

  // Office / Meetings / Workspaces
  ["conference", "Office - Meeting Room"],
  ["boardroom", "Office - Meeting Room"],
  ["meeting", "Office - Meeting Room"],
  ["discussion", "Office - Meeting Room"],
  ["huddle", "Office - Meeting Room"],
  ["briefing", "Office - Meeting Room"],
  ["cowork", "Coworking Space"],
  ["open office", "Coworking Space"],
  ["workstation", "Coworking Space"],
  ["common room", "Office - Common Room"],
  ["breakout", "Office - Common Room"],
  ["staff room", "Office - Common Room"],
  ["office", "Office - Cabin"],
  ["cabin", "Office - Cabin"],
  ["manager", "Office - Cabin"],
  ["director", "Office - Cabin"],
  ["executive", "Office - Cabin"],
  ["work room", "Office - Cabin"],

  // Education / Classrooms / Labs
  ["eyfs", "Classroom - EYFS"],
  ["kindergarten", "Classroom - EYFS"],
  ["preschool", "Classroom - EYFS"],
  ["art room", "Classroom - Art"],
  ["high school", "Classroom - High School"],
  ["ict room", "ICT Room"],
  ["computer lab", "ICT Room"],
  ["science lab", "Lab - Science"],
  ["physics lab", "Lab - Science"],
  ["chemistry lab", "Lab - Science"],
  ["biology lab", "Lab - Science"],
  ["lab", "Lab - School"],
  ["classroom", "Classroom - Middle School"],
  ["class room", "Classroom - Middle School"],
  ["lecture", "Classroom - Middle School"],
  ["seminar", "Classroom - Middle School"],
  ["training", "Classroom - Middle School"],
  ["school", "Classroom - Middle School"],

  // Gym / Wellness / Play
  ["gym", "GYM"],
  ["fitness", "GYM"],
  ["workout", "GYM"],
  ["cardio", "GYM"],
  ["spa", "SPA"],
  ["sauna", "SPA"],
  ["steam", "SPA"],
  ["massage", "SPA"],
  ["therapy", "SPA"],
  ["kids play", "Kids Play Area"],
  ["play area", "Kids Play Area"],
  ["nursery", "Kids Play Area"],
  ["daycare", "Kids Play Area"],

  // Medical
  ["doctor", "Clinic - Doctor Room"],
  ["treatment", "Clinic - Treatment Room"],
  ["medical store", "Storage - Medical"],
  ["pharmacy", "Storage - Medical"],
  ["clinic", "Clinic"],
  ["medical", "Clinic"],
  ["triage", "Clinic"],

  // F&B / Kitchens
  ["public kitchen", "Kitchen - Public"],
  ["central kitchen", "Kitchen - Public"],
  ["main kitchen", "Kitchen - Public"],
  ["private kitchen", "Kitchen - Private"],
  ["pantry", "Kitchen - Private"],
  ["kitchenette", "Kitchen - Private"],
  ["kitchen", "Kitchen - Public"],
  ["cafe", "Café"],
  ["café", "Café"],
  ["coffee", "Café"],
  ["restaurant", "Food & Beverage"],
  ["food", "Food & Beverage"],
  ["dining area", "Food & Beverage"],
  ["canteen", "Food & Beverage"],
  ["mess", "Food & Beverage"],
  ["buffet", "Food & Beverage"],

  // Retail
  ["mall", "Retail Shop - Mall"],
  ["retail shop - mixed", "Retail Shop - Mixed Building"],
  ["retail shop", "Retail Shop - Mixed Building"],
  ["retail", "Retail Shop - Mixed Building"],
  ["shop", "Retail Shop - Mixed Building"],
  ["showroom", "Retail Shop - Mixed Building"],
  ["boutique", "Retail Shop - Mixed Building"],

  // Wet areas / Toilets / Restrooms
  ["eyfs toilet", "Toilet - EYFS Attached"],
  ["child toilet", "Toilet - EYFS Attached"],
  ["washroom", "Washroom"],
  ["powder room", "Washroom"],
  ["toilet", "Toilet - Public"],
  ["restroom", "Toilet - Public"],
  ["wc", "Toilet - Public"],
  ["w.c.", "Toilet - Public"],
  ["bath", "Toilet - Public"],
  ["bathroom", "Toilet - Public"],
  ["ensuite", "Toilet - Public"],
  ["lavatory", "Toilet - Public"],
  ["urinal", "Toilet - Public"],

  // Religious
  ["prayer", "Male Prayer Room"],
  ["mosque", "Male Prayer Room"],
  ["masjid", "Male Prayer Room"],
  ["namaz", "Male Prayer Room"],

  // Utilities / Housekeeping
  ["laundry", "Laundry / House Keeping"],
  ["house keeping", "Laundry / House Keeping"],
  ["housekeeping", "Laundry / House Keeping"],
  ["janitor", "Laundry / House Keeping"],
  ["cleaner", "Laundry / House Keeping"],
  ["garbage", "Garbage Room"],
  ["trash", "Garbage Room"],
  ["waste", "Garbage Room"],
  ["refuse", "Garbage Room"],
  ["airlock", "Airlock"],
  ["vestibule", "Airlock"],
  ["stairs", "Stairs"],
  ["staircase", "Stairs"],
  ["stairwell", "Stairs"],

  // MEP Technical
  ["server", "Server Room"],
  ["data center", "Server Room"],
  ["datacenter", "Server Room"],
  ["cctv", "CCTV Room"],
  ["security room", "CCTV Room"],
  ["surveillance", "CCTV Room"],
  ["fcc", "FCC Room"],
  ["fire control", "FCC Room"],
  ["fire command", "FCC Room"],
  ["idf", "Typ. IDF Room"],
  ["tel", "Typ. IDF Room"],
  ["telecom", "Typ. IDF Room"],
  ["electrical", "Typ. Electrical Room"],
  ["elec", "Typ. Electrical Room"],
  ["ele.", "Typ. Electrical Room"],
  ["substation", "LV Room"],
  ["lv room", "LV Room"],
  ["transformer", "LV Room"],
  ["switchgear", "LV Room"],
  ["mtr room", "MTR Room"],
  ["water mt", "MTR Room"],
  ["water meter", "MTR Room"],
  ["ets control", "ETS Control Room"],
  ["ets pump", "ETS Pump Room"],
  ["ets", "ETS Room"],
  ["thermal tank", "ETS Room"],
  ["chilled water", "Chilled Water Pump Room"],
  ["chiller", "Chilled Water Pump Room"],
  ["fire pump", "Fire Pump Room"],
  ["boiler", "Boiler Room"],
  ["calorifier", "Boiler Room"],

  // Storage
  ["it storage", "Storage - IT"],
  ["server storage", "Storage - IT"],
  ["occupied storage", "Storage - Occupied"],
  ["storage", "Storage - Dry"],
  ["store", "Storage - Dry"],
  ["warehouse", "Storage - Dry"],
  ["depot", "Storage - Dry"]
];

export const SPACE_DENSITIES: Record<string, number> = {
  // Residential
  "Apartment - Dwelling Unit": 120,
  "Corridor - Residential": 60,
  "Lobby - Residential": 180,
  // Retail & F&B
  "Supermarket": 230,
  "Retail Shop - Mixed Building": 400,
  "Retail Shop - Mall": 200,
  "Food & Beverage": 2000,
  "Kitchen - Public": 600,
  "Kitchen - Private": 120,
  "Café": 140,
  // Office & Coworking
  "Office - Cabin": 120,
  "Office - Meeting Room": 120,
  "Office - Common Room": 120,
  "Coworking Space": 120,
  // Education
  "Classroom - EYFS": 140,
  "Classroom - Middle School": 140,
  "Classroom - Art": 140,
  "Classroom - High School": 150,
  "ICT Room": 180,
  "Lab - School": 180,
  "Lab - Science": 180,
  "Lobby - School": 100,
  // Wellness
  "GYM": 180,
  "SPA": 150,
  "Kids Play Area": 250,
  // Medical
  "Clinic": 250,
  "Clinic - Treatment Room": 140,
  "Clinic - Doctor Room": 140,
  "Storage - Medical": 140,
  // Hospitality
  "Lobby - Hotel": 100,
  // Utilities
  "Airlock": 120,
  "Washroom": 60,
  "Toilet - EYFS Attached": 100,
  "Toilet - Public": 100,
  "Male Prayer Room": 60,
  "Laundry / House Keeping": 150,
  "Garbage Room": 120,
  "Stairs": 100,
  "Lobby - Lift": 100,
  "Corridor - BOH/Service": 120,
  // MEP
  "MTR Room": 300,
  "LV Room": 90,
  "Server Room": 300,
  "CCTV Room": 300,
  "Typ. Electrical Room": 100,
  "Typ. IDF Room": 1500,
  "FCC Room": 120,
  "ETS Room": 120,
  "ETS Control Room": 120,
  "Chilled Water Pump Room": 120,
  "Fire Pump Room": 150,
  "ETS Pump Room": 100,
  "Boiler Room": 200,
  // Storage
  "Storage - Dry": 100,
  "Storage - IT": 1000,
  "Storage - Occupied": 120,
};

export const extractFloor = (name: string): string => {
  if (!name || typeof name !== "string") return "";
  const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?(?=[-\s_]|\b)/i);
  return match ? match[0].toUpperCase().replace(/L$/i, "F") : "";
};

export const inferTypeFromName = (name: string): string => {
  if (!name || typeof name !== "string") return "";
  const raw = name.trim();
  if (!raw) return "";

  const q = raw.toLowerCase().replace(/[\-_]/g, " ").replace(/\s+/g, " ");

  // 1. Direct match with SPACE_DENSITIES
  if (SPACE_DENSITIES[raw]) return raw;
  const exactKey = Object.keys(SPACE_DENSITIES).find(
    (k) => k.toLowerCase() === q || k.toLowerCase().replace(/[\-_]/g, " ") === q
  );
  if (exactKey) return exactKey;

  // 2. Multi-word & keyword inference from INFER_MAP
  for (const [kw, targetType] of INFER_MAP) {
    if (q.includes(kw)) {
      return targetType;
    }
  }

  // 3. Token-based word boundary checks & typo tolerance
  const words = q.split(/[^a-z0-9]/).filter(Boolean);
  for (const w of words) {
    if (
      w === "market" ||
      w === "markter" ||
      w === "supermarkter" ||
      w === "supermarket" ||
      w === "mart" ||
      w === "grocery" ||
      w === "hypermarket" ||
      w === "bazaar" ||
      w === "minimart"
    ) {
      return "Supermarket";
    }
    if (w === "bed" || w === "bedroom" || w === "flat" || w === "apartment" || w === "dwelling" || w === "studio" || w === "bhk" || w === "living" || w === "balcony") {
      return "Apartment - Dwelling Unit";
    }
    if (w === "corridor" || w === "hallway" || w === "passage" || w === "aisle") {
      return "Corridor - Residential";
    }
    if (w === "lobby" || w === "reception" || w === "foyer" || w === "atrium") {
      return "Lobby - Residential";
    }
    if (w === "office" || w === "cabin" || w === "manager" || w === "director" || w === "executive") {
      return "Office - Cabin";
    }
    if (w === "meeting" || w === "conference" || w === "boardroom" || w === "huddle" || w === "seminar") {
      return "Office - Meeting Room";
    }
    if (w === "cowork" || w === "workstation") {
      return "Coworking Space";
    }
    if (w === "gym" || w === "fitness" || w === "cardio" || w === "workout") {
      return "GYM";
    }
    if (w === "spa" || w === "sauna" || w === "steam" || w === "massage") {
      return "SPA";
    }
    if (w === "toilet" || w === "wc" || w === "restroom" || w === "washroom" || w === "bath" || w === "bathroom" || w === "lavatory") {
      return "Toilet - Public";
    }
    if (w === "pantry" || w === "kitchenette") {
      return "Kitchen - Private";
    }
    if (w === "kitchen" || w === "canteen" || w === "restaurant" || w === "dining") {
      return "Food & Beverage";
    }
    if (w === "cafe" || w === "coffee" || w === "bistro") {
      return "Café";
    }
    if (w === "server" || w === "datacenter" || w === "data") {
      return "Server Room";
    }
    if (w === "electrical" || w === "elec") {
      return "Typ. Electrical Room";
    }
    if (w === "storage" || w === "store" || w === "warehouse") {
      return "Storage - Dry";
    }
    if (w === "prayer" || w === "mosque" || w === "masjid" || w === "namaz") {
      return "Male Prayer Room";
    }
    if (w === "classroom" || w === "school" || w === "lecture") {
      return "Classroom - Middle School";
    }
    if (w === "lab" || w === "laboratory") {
      return "Lab - School";
    }
    if (w === "clinic" || w === "doctor" || w === "medical" || w === "pharmacy") {
      return "Clinic";
    }
    if (w === "stairs" || w === "staircase" || w === "stairwell") {
      return "Stairs";
    }
    if (w === "laundry" || w === "janitor" || w === "housekeeping") {
      return "Laundry / House Keeping";
    }
    if (w === "garbage" || w === "trash" || w === "waste" || w === "refuse") {
      return "Garbage Room";
    }
  }

  return "";
};

export function computePclData(rows: PclRow[]) {
  let totalArea = 0;
  let totalW = 0;

  rows.forEach(r => {
    const a = r.area !== "" ? Number(r.area) : 0;
    totalArea += a;
    totalW += r.dissipation;
  });

  const totalKw = totalW / 1000;
  const totalTr = totalKw / 3.517;
  const avgDensity = totalArea > 0 ? totalW / totalArea : 0;

  return {
    totalArea,
    totalKw,
    totalTr,
    avgDensity
  };
}

export function computePclValidationLogs(calculatedData: { avgDensity: number }, rows: PclRow[]) {
  const logs: { type: "success" | "warning" | "danger" | "info"; msg: string }[] = [];

  if (calculatedData.avgDensity > 300) {
    logs.push({
      type: "warning",
      msg: `High average heat load density detected (${calculatedData.avgDensity.toFixed(1)} W/m²). Ensure high air-change rates to prevent local hotspots.`,
    });
  } else {
    logs.push({
      type: "success",
      msg: `Average load density is in standard range (${calculatedData.avgDensity.toFixed(1)} W/m²).`,
    });
  }

  const highDensityRow = rows.find(r => r.density > 1000);
  if (highDensityRow) {
    logs.push({
      type: "danger",
      msg: `Space '${highDensityRow.name}' has extremely high load density (${highDensityRow.density} W/m²). Verify ventilation and spot cooling layouts.`,
    });
  }

  return logs;
}
