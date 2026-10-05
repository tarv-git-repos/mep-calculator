export interface SprinklerRow {
  id: string;
  floor?: string;
  label: string;
  kFactor: number;
  solveFor: "Q" | "P";
  pressure: number;
  flow: number;
  coverage: number;
  hazard: string;
  notes?: string;
  comments?: any[];
  flagged?: boolean;
  flagReason?: string;
}

export const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];

export interface KFactorDetail {
  orifice: string;
  thread: string;
  desc: string;
}

export const K_FACTOR_DETAILS: Record<number, KFactorDetail> = {
  2.8: { orifice: '3/8" (10 mm)', thread: '1/2" NPT', desc: "Small orifice for residential and light hazard applications" },
  4.2: { orifice: '7/16" (11 mm)', thread: '1/2" NPT', desc: "Standard small orifice for low hazard density control" },
  5.6: { orifice: '1/2" (15 mm)', thread: '1/2" NPT', desc: "Standard orifice sprinkler - most widely used commercially" },
  8.0: { orifice: '17/32" (20 mm)', thread: '3/4" NPT', desc: "Large orifice (ELO) - higher discharge at lower water pressure" },
  11.2: { orifice: '5/8" (20 mm)', thread: '3/4" NPT', desc: "Extra-large orifice (VELO) for high-challenge storage density" },
  14.0: { orifice: '3/4" (20 mm)', thread: '3/4" NPT', desc: "ESFR / Storage early suppression fast response applications" },
  16.8: { orifice: '3/4" (20 mm)', thread: '3/4" NPT', desc: "High density storage control without in-rack sprinkler heads" },
  19.6: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Very high volume ESFR for palletized ceiling storage >35 ft" },
  22.4: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "High discharge large droplet ESFR storage protection" },
  25.2: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Ultra high volume ESFR suppression for high-bay warehousing" },
  28.0: { orifice: '1" (25 mm)', thread: '1" NPT', desc: "Maximum flow capacity ESFR for extra high bay ceiling configurations" },
};

export function getKFactorDetail(k: number, isSi: boolean): KFactorDetail {
  const ipK = isSi ? parseFloat((k / 14.288).toFixed(1)) : k;
  let closest = 5.6;
  let minDiff = Infinity;
  for (const std of STANDARD_K_FACTORS) {
    const diff = Math.abs(std - ipK);
    if (diff < minDiff) {
      minDiff = diff;
      closest = std;
    }
  }
  return K_FACTOR_DETAILS[closest] || {
    orifice: isSi ? '15 mm' : '1/2" NPT',
    thread: isSi ? '1/2" (15 mm)' : '1/2" NPT',
    desc: `Custom K-${k.toFixed(1)} sprinkler head configuration`
  };
}

export interface BulbRating {
  color: string;
  tempF: string;
  tempC: string;
  classification: string;
  hex: string;
  bgHex: string;
  textHex: string;
}

export const BULB_RATINGS: BulbRating[] = [
  { color: "orange", tempF: "135°F", tempC: "57°C", classification: "Ordinary", hex: "#f97316", bgHex: "bg-orange-500/10", textHex: "text-orange-500" },
  { color: "red", tempF: "155°F", tempC: "68°C", classification: "Ordinary", hex: "#ef4444", bgHex: "bg-red-500/10", textHex: "text-red-500" },
  { color: "yellow", tempF: "175°F", tempC: "79°C", classification: "Intermediate", hex: "#eab308", bgHex: "bg-yellow-500/10", textHex: "text-yellow-500" },
  { color: "green", tempF: "200°F", tempC: "93°C", classification: "Intermediate", hex: "#22c55e", bgHex: "bg-green-500/10", textHex: "text-green-500" },
  { color: "blue", tempF: "286°F", tempC: "141°C", classification: "High", hex: "#3b82f6", bgHex: "bg-blue-500/10", textHex: "text-blue-500" },
  { color: "mauve", tempF: "360°F", tempC: "182°C", classification: "Extra High", hex: "#a855f7", bgHex: "bg-purple-500/10", textHex: "text-purple-500" },
  { color: "black", tempF: "500°F", tempC: "260°C", classification: "Ultra High", hex: "#18181b", bgHex: "bg-zinc-500/10", textHex: "text-zinc-700 dark:text-zinc-300" },
];

export const HAZARD_LIMITS: Record<string, number> = {
  "Light Hazard": 225,
  "Ordinary Hazard Gp 1": 130,
  "Ordinary Hazard Gp 2": 130,
  "Extra Hazard Gp 1": 100,
  "Extra Hazard Gp 2": 100,
};

export const DEFAULT_ROWS: SprinklerRow[] = [
  {
    id: "sprink_1",
    floor: "Level 1",
    label: "Office Room 101 - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 15.0,
    flow: 21.69,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: "Standard office coverage",
    comments: [
      {
        id: "c_demo_1",
        authorName: "Design Engineer",
        text: "Verify hydraulic calculation with pump head",
        timestamp: "2026-09-02T10:00:00.000Z",
        status: "in_progress"
      }
    ]
  },
  {
    id: "sprink_2",
    floor: "Ground Floor",
    label: "Reception Area - Pendent",
    kFactor: 5.6,
    solveFor: "Q",
    pressure: 12.0,
    flow: 19.40,
    coverage: 130,
    hazard: "Ordinary Hazard Gp 1",
    notes: ""
  },
  {
    id: "sprink_3",
    floor: "Level 1",
    label: "Server Room - Upright",
    kFactor: 8.0,
    solveFor: "Q",
    pressure: 20.0,
    flow: 35.78,
    coverage: 90,
    hazard: "Extra Hazard Gp 1",
    notes: "High density area"
  },
  {
    id: "sprink_4",
    floor: "Ground Floor",
    label: "Storage Closet - Sidewall",
    kFactor: 4.2,
    solveFor: "Q",
    pressure: 10.0,
    flow: 13.28,
    coverage: 100,
    hazard: "Light Hazard",
    notes: "Small storage"
  }
];

// Helper to compute row flow/pressure
export function computeRowOutputs(row: SprinklerRow): SprinklerRow {
  const K = row.kFactor || 5.6;
  if (row.solveFor === "Q") {
    const P = Math.max(0, row.pressure);
    const Q = K * Math.sqrt(P);
    return { ...row, flow: parseFloat(Q.toFixed(2)) };
  } else {
    const Q = Math.max(0, row.flow);
    const P = Math.pow(Q / K, 2);
    return { ...row, pressure: parseFloat(P.toFixed(2)) };
  }
}

export function extractFloor(name: string): string {
  if (!name) return "Ground Floor";
  const lower = name.toLowerCase();
  if (lower.includes("basement") || lower.includes("b1") || lower.includes("b2")) return "Basement";
  if (lower.includes("ground") || lower.includes("gf") || lower.includes("level 0")) return "Ground Floor";
  if (lower.includes("1st") || lower.includes("first") || lower.includes("level 1") || lower.includes("l1") || lower.includes("101") || lower.includes("102") || lower.includes("103")) return "Level 1";
  if (lower.includes("2nd") || lower.includes("second") || lower.includes("level 2") || lower.includes("l2") || lower.includes("201") || lower.includes("202")) return "Level 2";
  if (lower.includes("3rd") || lower.includes("third") || lower.includes("level 3") || lower.includes("l3") || lower.includes("301")) return "Level 3";
  if (lower.includes("roof") || lower.includes("terrace")) return "Roof";
  return "Ground Floor";
}

export function checkIfSprinklerMissingData(row: SprinklerRow): { isMissing: boolean; reason?: string } {
  if (!row.label || row.label.trim() === "") {
    return { isMissing: true, reason: "Missing Sprinkler Label / Location" };
  }
  if (!row.kFactor || row.kFactor <= 0 || isNaN(row.kFactor)) {
    return { isMissing: true, reason: "Missing or invalid K-Factor" };
  }
  if (!row.pressure || row.pressure <= 0 || isNaN(row.pressure)) {
    return { isMissing: true, reason: "Missing operating pressure" };
  }
  if (!row.flow || row.flow <= 0 || isNaN(row.flow)) {
    return { isMissing: true, reason: "Missing flow rate" };
  }
  if (!row.hazard || row.hazard.trim() === "") {
    return { isMissing: true, reason: "Missing hazard classification" };
  }
  return { isMissing: false };
}

