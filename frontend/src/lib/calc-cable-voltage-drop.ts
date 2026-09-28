export interface CableVDRow {
  id: string;
  isGroup: boolean;
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
  cumulativeVd: number; // For groups this is input (parent VD), for nodes it is calculated
  isLinked?: boolean;
}

export const normalizeString = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const computeAllRows = (rows: CableVDRow[]): CableVDRow[] => {
  let currentGroupVd = 0;
  const computedVdMap = new Map<string, number>();
  let busbarVdMap: Record<string, number> = {};
  
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("mep-busbar-calculated-vd-v1");
      if (saved) busbarVdMap = JSON.parse(saved);
    } catch (e) {}
  }

  return rows.map((row) => {
    if (row.isGroup) {
      const fromName = normalizeString(row.from);
      let parentVd = row.cumulativeVd || 0;
      
      if (fromName) {
        if (computedVdMap.has(fromName)) {
           parentVd = computedVdMap.get(fromName)!;
        } else {
           for (const key of Object.keys(busbarVdMap)) {
              if (normalizeString(key) === fromName) {
                  parentVd = busbarVdMap[key];
                  break;
              }
           }
        }
      }
      
      currentGroupVd = parentVd; 
      
      return { 
        ...row, 
        cumulativeVd: parentVd, 
        lineCurrent: 0, 
        currentPerCable: 0, 
        vd: 0, 
        vdPercent: 0 
      };
    }

    const V = row.voltage || 1; // prevent div/0
    const PF = row.pf || 1;
    const Runs = row.runs || 1;

    // Line Current (A) = (Load * 1000) / (1.732 * Voltage * PF)
    const lineCurrent = (row.load * 1000) / (1.732 * V * PF);
    
    // Line Current Per cable (A) = Line Current / No. of cable Runs
    const currentPerCable = lineCurrent / Runs;

    // VOLTAGE DROP (V) = (mV/A/m * Current Per Cable * Length) / 1000
    const vd = (row.mvAm * currentPerCable * row.length) / 1000;

    // VOLTAGE DROP %V = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group VD + Node VD%
    const cumulativeVd = currentGroupVd + vdPercent;

    if (row.description) {
      computedVdMap.set(normalizeString(row.description), cumulativeVd);
    }

    return {
      ...row,
      lineCurrent: Number(lineCurrent.toFixed(2)),
      currentPerCable: Number(currentPerCable.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};
