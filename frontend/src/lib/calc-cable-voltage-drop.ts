export interface CableVDRow {
  id: string;
  groupName: string;
  from: string;
  description: string;
  load: number; // KW
  voltage: number;
  pf: number;
  lineCurrent: number; // calculated
  runs: number;
  size: string;
  currentPerCable: number; // calculated
  length: number;
  mvAm: number;
  vd: number; // calculated
  vdPercent: number; // calculated
  cumulativeVd: number; // calculated (Parent VD + vdPercent)
  isLinked?: boolean;
  flagged?: boolean;
}

export const CABLE_CATALOGUE: Record<string, number> = {
  "4c 16": 2.5,
  "4c 25": 1.65,
  "4c 35": 1.15,
  "4c 50": 0.87,
  "4c 70": 0.60,
  "4c 95": 0.43,
  "4c 120": 0.35,
  "4c 150": 0.29,
  "4c 185": 0.24,
  "4c 240": 0.19,
  "4c 300": 0.16,
  "1c 16": 2.5,
  "1c 25": 1.65,
  "1c 35": 1.15,
  "1c 50": 0.87,
  "1c 70": 0.60,
  "1c 95": 0.43,
  "1c 120": 0.35,
  "1c 150": 0.29,
  "1c 185": 0.24,
  "1c 240": 0.19,
  "1c 300": 0.16,
  "1c 400": 0.13,
  "1c 500": 0.11,
  "1c 630": 0.09
};

export const normalizeString = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const computeAllRows = (
  rows: CableVDRow[],
  unitSystem: "si" | "ip" = "si",
  parentVdMap: Record<string, number> = {}
): CableVDRow[] => {
  let busbarVdMap: Record<string, number> = {};
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("mep-busbar-calculated-vd-v1");
      if (saved) busbarVdMap = JSON.parse(saved);
    } catch (e) {}
  }

  const computedVdMap = new Map<string, number>();

  return rows.map((row) => {
    const groupName = row.groupName || "Main Feeders";
    let parentVd = parentVdMap[groupName] !== undefined ? parentVdMap[groupName] : 0;

    const fromNorm = normalizeString(row.from);
    if (fromNorm) {
      if (computedVdMap.has(fromNorm)) {
        // Can inherit if needed
      } else {
        for (const key of Object.keys(busbarVdMap)) {
          if (normalizeString(key) === fromNorm && parentVdMap[groupName] === undefined) {
            parentVd = busbarVdMap[key];
            break;
          }
        }
      }
    }

    const V = row.voltage || 400; // prevent div/0
    const PF = row.pf || 0.8;
    const Runs = row.runs || 1;

    // Line Current (A) = (Load * 1000) / (1.732 * Voltage * PF)
    const lineCurrent = (row.load * 1000) / (1.732 * V * PF);
    
    // Line Current Per cable (A) = Line Current / No. of cable Runs
    const currentPerCable = lineCurrent / Runs;

    // VOLTAGE DROP (V) = (mV/A/m * Current Per Cable * Length) / 1000
    const lengthInMeters = unitSystem === "ip" ? ((row.length || 0) * 0.3048) : (row.length || 0);
    const vd = (row.mvAm * currentPerCable * lengthInMeters) / 1000;

    // VOLTAGE DROP %V = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group Parent VD + Cable VD%
    const cumulativeVd = parentVd + vdPercent;

    if (row.description) {
      computedVdMap.set(normalizeString(row.description), cumulativeVd);
    }

    return {
      ...row,
      groupName,
      lineCurrent: Number(lineCurrent.toFixed(2)),
      currentPerCable: Number(currentPerCable.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};

