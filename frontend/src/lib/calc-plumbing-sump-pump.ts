export const GPM_TO_LPS = 0.0630902;
export const FT_TO_M = 0.3048;
export const IN_TO_MM = 25.4;
export const GAL_TO_M3 = 0.00378541;
export const GAL_TO_L = 3.78541;
export const HP_TO_KW = 0.7457;
export const PSI_TO_BAR = 0.0689476;

export type SumpPresetKey =
  | "basement_seepage"
  | "parking_ramp"
  | "elevator_pit"
  | "industrial_effluent"
  | "custom";

export interface SumpPresetConfig {
  key: SumpPresetKey;
  label: string;
  category: string;
  description: string;
  req: number; // L
  time: number; // hrs
  flow: number; // L/s
  pitFlow: number; // L/s
  pitHold: number; // min
  longestPipe: number; // m
  propSide: number; // m
  pipeVert: number; // m
  pipeHoriz: number; // m
  fricFactor: number; // bar/100m
  staticHead: number; // bar
  presid: number; // bar
  suction: number; // bar
  sfHead: number; // %
  effPump: number; // %
  effMotor: number; // %
}

export const SUMP_PRESETS: Record<SumpPresetKey, SumpPresetConfig> = {
  basement_seepage: {
    key: "basement_seepage",
    label: "Basement Groundwater & Seepage",
    category: "IPC 1113 / Sub-soil Drainage",
    description: "Perimeter foundation weeping tile and sub-soil infiltration dewatering for residential / commercial basements.",
    req: 1000,
    time: 1,
    flow: 0,
    pitFlow: 5,
    pitHold: 5,
    longestPipe: 15,
    propSide: 2,
    pipeVert: 5,
    pipeHoriz: 20,
    fricFactor: 0.4,
    staticHead: 5,
    presid: 1,
    suction: 0,
    sfHead: 10,
    effPump: 70,
    effMotor: 85,
  },
  parking_ramp: {
    key: "parking_ramp",
    label: "Parking Ramp / Storm Surge",
    category: "Stormwater / High Flow",
    description: "Subterranean parking garage entrance ramp stormwater interception sump station.",
    req: 5000,
    time: 0.5,
    flow: 0,
    pitFlow: 15,
    pitHold: 5,
    longestPipe: 25,
    propSide: 2.5,
    pipeVert: 8,
    pipeHoriz: 35,
    fricFactor: 0.5,
    staticHead: 8,
    presid: 1,
    suction: 0,
    sfHead: 15,
    effPump: 70,
    effMotor: 85,
  },
  elevator_pit: {
    key: "elevator_pit",
    label: "Elevator Pit Drainage",
    category: "ASME A17.1 / Elevator Sump",
    description: "Dedicated elevator shaft subterranean drainage pit with 50 GPM (3.0 L/s) minimum discharge capacity.",
    req: 500,
    time: 0.5,
    flow: 0,
    pitFlow: 3.2,
    pitHold: 3,
    longestPipe: 10,
    propSide: 1.2,
    pipeVert: 4,
    pipeHoriz: 15,
    fricFactor: 0.35,
    staticHead: 4,
    presid: 0.8,
    suction: 0,
    sfHead: 10,
    effPump: 65,
    effMotor: 85,
  },
  industrial_effluent: {
    key: "industrial_effluent",
    label: "Industrial Plant Effluent Station",
    category: "Industrial / Heavy Duty",
    description: "Heavy-duty manufacturing or plant subterranean washdown and process drainage collection.",
    req: 10000,
    time: 1.5,
    flow: 0,
    pitFlow: 25,
    pitHold: 10,
    longestPipe: 35,
    propSide: 3.0,
    pipeVert: 10,
    pipeHoriz: 50,
    fricFactor: 0.6,
    staticHead: 10,
    presid: 1.5,
    suction: 0,
    sfHead: 15,
    effPump: 72,
    effMotor: 88,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined sump pump hydraulic and physical pit parameters.",
    req: 1000,
    time: 1,
    flow: 0,
    pitFlow: 5,
    pitHold: 5,
    longestPipe: 15,
    propSide: 2,
    pipeVert: 5,
    pipeHoriz: 20,
    fricFactor: 0.4,
    staticHead: 5,
    presid: 1,
    suction: 0,
    sfHead: 10,
    effPump: 70,
    effMotor: 85,
  },
};


export function computeSumpPumpCalculations(
  req: number | "",
  time: number | "",
  flow: number | "",
  pitFlow: number | "",
  pitHold: number | "",
  longestPipe: number | "",
  propSide: number | "",
  pipeVert: number | "",
  pipeHoriz: number | "",
  fricFactor: number | "",
  staticHead: number | "",
  presid: number | "",
  suction: number | "",
  sfHead: number | "",
  selectedHead: number | "",
  effPump: number | "",
  effMotor: number | ""
) {
  const r = typeof req === "number" ? req : 0;
  const t = typeof time === "number" ? time : 0;
  const f = typeof flow === "number" ? flow : 0;
  const pf = typeof pitFlow === "number" ? pitFlow : 0;
  const ph = typeof pitHold === "number" ? pitHold : 0;
  const lp = typeof longestPipe === "number" ? longestPipe : 0;
  const ps = typeof propSide === "number" ? propSide : 0;
  const pv = typeof pipeVert === "number" ? pipeVert : 0;
  const phz = typeof pipeHoriz === "number" ? pipeHoriz : 0;
  const ff = typeof fricFactor === "number" ? fricFactor : 0;
  const sh = typeof staticHead === "number" ? staticHead : 0;
  const pr = typeof presid === "number" ? presid : 0;
  const suc = typeof suction === "number" ? suction : 0;
  const sfH = typeof sfHead === "number" ? sfHead : 0;
  const eP = typeof effPump === "number" ? effPump : 70;
  const eM = typeof effMotor === "number" ? effMotor : 85;

  const Q_flow = (f > 0) ? f : ((r > 0 && t > 0) ? r / (t * 3600) : 0);
  const pitVol = (pf * ph * 60) / 1000;
  const invertVal = lp > 0 ? (Math.ceil((lp / 90) * 100) / 100) + 0.16 : 0;

  let propDepth = 0;
  if (ps > 0) {
    const waterDepthRaw = pitVol / (ps * ps);
    const waterDepth = waterDepthRaw < 1.0 ? 1.0 : waterDepthRaw;
    propDepth = Math.ceil((waterDepth + invertVal + 0.25) * 100) / 100;
  }

  const L_elbows = (pv + phz) * 0.3;
  const L_valves = (pv + phz) * 0.3;
  const L_sum = pv + phz + L_elbows + L_valves;
  const L_equiv = Math.ceil((L_sum * 1.05) / 10) * 10;
  const H_loss = L_equiv * (ff / 100);

  const H_pump_calc = (Math.max(0, (H_loss + sh + pr) - suc)) * (1 + sfH / 100);
  const selHead = typeof selectedHead === "number" && selectedHead > 0 ? selectedHead : H_pump_calc;

  const P_shaft = (Q_flow * selHead * 100) / (1000 * (eP / 100));
  const P_motor = P_shaft / (eM / 100);
  const HP = P_motor * 1.34102;

  return { Q_flow, pitVol, invertVal, propDepth, pv, phz, ff, L_elbows, L_valves, L_sum, L_equiv, H_loss, H_pump_calc, selHead, P_motor, HP };
}
