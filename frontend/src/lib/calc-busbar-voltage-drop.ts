import { TaskComment } from "@/lib/ventilation-calc";

export interface BusbarRatingDef {
  rating: string;
  r: number;
  x: number;
}

export const DEFAULT_RATINGS: BusbarRatingDef[] = [
  { rating: "800 (Rt)", r: 0.0750, x: 0.0200 },
  { rating: "1000 (Rt)", r: 0.0523, x: 0.0190 },
  { rating: "1250 (Rt)", r: 0.0400, x: 0.0150 },
  { rating: "1600 (Rt)", r: 0.0300, x: 0.0130 },
  { rating: "2000 (Rt)", r: 0.0220, x: 0.0110 },
  { rating: "2500 (Rt)", r: 0.0177, x: 0.0100 },
  { rating: "3200 (Rt)", r: 0.0130, x: 0.0090 },
  { rating: "4000 (Rt)", r: 0.0100, x: 0.0080 },
];

export interface BusbarVDRow {
  id: string;
  isGroup: boolean;
  ref: string;
  from: string;
  tapOff: string;
  length: number;
  smdbLoad: number;
  tcl: number;
  voltage: number;
  pf: number;
  df: number;
  maxDemand: number;
  lineCurrent: number;
  vd: number;
  vdPercent: number;
  cumulativeVd: number;
  comments?: TaskComment[];
}

export const computeAllRows = (rows: BusbarVDRow[], globalR: number, globalX: number, useMdForCurrent: boolean = true): BusbarVDRow[] => {
  let currentGroupVd = 0;

  return rows.map((row) => {
    if (row.isGroup) {
      currentGroupVd = row.cumulativeVd || 0; // Use the input parent VD for this group
      return { ...row, maxDemand: 0, lineCurrent: 0, vd: 0, vdPercent: 0 };
    }

    const V = row.voltage || 1; // prevent div/0
    const PF = row.pf || 1;

    // Maximum Demand Load (KW) = TCL * Diversity Factor
    const maxDemand = row.tcl * row.df;
    
    // Line Current (A) = (loadForCurrent * 1000) / (1.732 * Voltage * PF)
    const loadForCurrent = useMdForCurrent ? maxDemand : row.tcl;
    const lineCurrent = (loadForCurrent * 1000) / (1.732 * V * PF);

    // VOLTAGE DROP (Vd) = (1.732 * Line Current * Length * (R*CosPhi + X*SinPhi)) / 1000
    // CosPhi = PF, SinPhi = sin(arccos(PF))
    const sinPhi = Math.sin(Math.acos(Math.min(1, Math.max(-1, PF))));
    const vd = (1.732 * lineCurrent * row.length * ((globalR * PF) + (globalX * sinPhi))) / 1000;

    // Vdrop % = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group VD + Node VD%
    const cumulativeVd = currentGroupVd + vdPercent;

    return {
      ...row,
      maxDemand: Number(maxDemand.toFixed(2)),
      lineCurrent: Number(lineCurrent.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};
