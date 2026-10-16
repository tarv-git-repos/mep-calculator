export type SewagePresetKey =
  | "residential_basement"
  | "commercial_building"
  | "restaurant_kitchen"
  | "high_rise_basement"
  | "heavy_duty_station"
  | "custom";

export interface SewagePresetConfig {
  key: SewagePresetKey;
  label: string;
  category: string;
  description: string;
  inflow: number; // GPM
  cycle: number; // minutes
  starts: number; // max starts/hr
  lift: number; // ft
  pipeDia: number; // inches
  pipeLen: number; // ft
  fittingsHead: number; // ft
  safetyFactor: number; // %
  basinDia: number; // inches
}

export const SEWAGE_PRESETS: Record<SewagePresetKey, SewagePresetConfig> = {
  residential_basement: {
    key: "residential_basement",
    label: "Residential Basement",
    category: "IPC / Residential Ejector",
    description: "Single-family or multi-family basement sanitary fixture drainage (WC, basin, laundry).",
    inflow: 20,
    cycle: 5,
    starts: 6,
    lift: 15,
    pipeDia: 2.0,
    pipeLen: 35,
    fittingsHead: 3.5,
    safetyFactor: 15,
    basinDia: 24,
  },
  commercial_building: {
    key: "commercial_building",
    label: "Commercial Office / Retail",
    category: "ASPE / Commercial",
    description: "Multi-fixture public basement restrooms with duplex alternating sewage ejectors.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 25,
    pipeDia: 3.0,
    pipeLen: 65,
    fittingsHead: 6.0,
    safetyFactor: 15,
    basinDia: 36,
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant / Commercial Kitchen",
    category: "IPC / High Solids & Grease",
    description: "Grease-laden waste & high-temperature kitchen discharge requiring high-torque solids handling.",
    inflow: 65,
    cycle: 5,
    starts: 8,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.5,
    safetyFactor: 20,
    basinDia: 42,
  },
  high_rise_basement: {
    key: "high_rise_basement",
    label: "High-Rise Deep Basement",
    category: "ASPE / High Head",
    description: "Deep subterranean parking levels (B3–B5) requiring high-head discharge to street sewer.",
    inflow: 75,
    cycle: 8,
    starts: 6,
    lift: 55,
    pipeDia: 4.0,
    pipeLen: 120,
    fittingsHead: 10.0,
    safetyFactor: 15,
    basinDia: 48,
  },
  heavy_duty_station: {
    key: "heavy_duty_station",
    label: "Heavy-Duty Wet Well Station",
    category: "Municipal / ASPE Chapter 7",
    description: "Large commercial complex or hotel central wet well with large non-clog solids-handling pumps.",
    inflow: 150,
    cycle: 10,
    starts: 6,
    lift: 35,
    pipeDia: 4.0,
    pipeLen: 150,
    fittingsHead: 12.0,
    safetyFactor: 20,
    basinDia: 60,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "Custom user-defined sewage pump hydraulic configuration.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.0,
    safetyFactor: 15,
    basinDia: 36,
  },
};

// Standard Motor Ratings (HP)
export const STANDARD_MOTOR_HP = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0];

// Conversion Constants
export const GPM_TO_LPS = 0.0630902;
export const GPM_TO_LMIN = 3.78541;
export const FT_TO_M = 0.3048;
export const IN_TO_MM = 25.4;
export const GAL_TO_M3 = 0.00378541;
export const GAL_TO_L = 3.78541;
export const HP_TO_KW = 0.7457;


export function computeSewagePumpCalculations(
  inflow: number | "",
  flowMultiplier: number | "",
  cycle: number | "",
  starts: number | "",
  lift: number | "",
  pipeDia: number | "",
  pipeLen: number | "",
  fittingsHead: number | "",
  safetyFactor: number | "",
  basinDia: number | "",
  pumpEfficiency: number | "",
  motorEfficiency: number | "",
  pumpCountMode: "1W_1S" | "2W_1S"
) {
  const qIn = typeof inflow === "number" ? inflow : 50;
  const mult = typeof flowMultiplier === "number" ? flowMultiplier : 2.0;
  const tCycle = typeof cycle === "number" ? cycle : 6;
  const maxStarts = typeof starts === "number" ? starts : 6;
  const hStatic = typeof lift === "number" ? lift : 25;
  const dPipe = typeof pipeDia === "number" ? pipeDia : 3.0;
  const lPipe = typeof pipeLen === "number" ? pipeLen : 65;
  const hFittings = typeof fittingsHead === "number" ? fittingsHead : 6.0;
  const sf = typeof safetyFactor === "number" ? safetyFactor : 15;
  const dBasin = typeof basinDia === "number" ? basinDia : 36;
  const effP = typeof pumpEfficiency === "number" ? pumpEfficiency / 100 : 0.6;
  const effM = typeof motorEfficiency === "number" ? motorEfficiency / 100 : 0.85;

  // 1. Pump Duty Flow Rate (Q_pump)
  const dutyFlowPerPump = qIn * mult;
  const totalWorkingFlow = pumpCountMode === "2W_1S" ? dutyFlowPerPump * 2 : dutyFlowPerPump;

  // 2. Discharge Pipe Velocity (v)
  const pipeAreaSqFt = (Math.PI * Math.pow(dPipe / 24, 2));
  const flowCfs = (dutyFlowPerPump * 0.13368) / 60;
  const velocityFps = pipeAreaSqFt > 0 ? flowCfs / pipeAreaSqFt : 0;
  const velocityMs = velocityFps * FT_TO_M;

  // 3. Friction Head Loss (H_f) via Hazen-Williams (C=120 for PVC/Cast Iron)
  const C = 120;
  const frictionHead =
    dPipe > 0
      ? 0.002083 * lPipe * Math.pow(100 / C, 1.852) * (Math.pow(dutyFlowPerPump, 1.852) / Math.pow(dPipe, 4.8655))
      : 0;

  // 4. Total Dynamic Head (TDH)
  const totalDynamicLosses = hStatic + frictionHead + hFittings;
  const tdh = totalDynamicLosses * (1 + sf / 100);

  // 5. Active Wet Well Storage Volume (V_active)
  const activeVolGal = (dutyFlowPerPump * tCycle) / 4;
  const activeVolM3 = activeVolGal * GAL_TO_M3;
  const activeVolL = activeVolGal * GAL_TO_L;

  // 6. Basin Liquid Depth & Geometry
  const basinRadiusFt = dBasin / 24;
  const basinAreaSqFt = Math.PI * Math.pow(basinRadiusFt, 2);
  const activeVolCuFt = activeVolGal * 0.13368;
  const activeDepthFt = basinAreaSqFt > 0 ? activeVolCuFt / basinAreaSqFt : 0;
  const activeDepthInches = activeDepthFt * 12;
  const totalBasinDepthInches = activeDepthInches + 24;

  // 7. Power Requirements & Motor Selection
  const waterHP = (dutyFlowPerPump * tdh) / 3960;
  const bhp = effP > 0 ? waterHP / effP : waterHP / 0.6;
  const motorKW = effM > 0 ? (bhp * HP_TO_KW) / effM : bhp * HP_TO_KW;

  let recommendedMotorHP = STANDARD_MOTOR_HP[0];
  for (const stdHP of STANDARD_MOTOR_HP) {
    if (stdHP >= bhp) {
      recommendedMotorHP = stdHP;
      break;
    }
    recommendedMotorHP = stdHP;
  }
  const recommendedMotorKW = recommendedMotorHP * HP_TO_KW;

  // 8. Checks & Verification
  const isScouringCompliant = velocityFps >= 2.0;
  const isMaxVelocityCompliant = velocityFps <= 8.0;
  const isSolidsCompliant = dPipe >= 2.0;
  const calculatedStartsPerHour = tCycle > 0 ? 60 / tCycle : 0;

  return {
    qIn,
    mult,
    tCycle,
    dutyFlowPerPump,
    totalWorkingFlow,
    velocityFps,
    velocityMs,
    frictionHead,
    hStatic,
    hFittings,
    tdh,
    sf,
    activeVolGal,
    activeVolM3,
    activeVolL,
    dBasin,
    dPipe,
    activeDepthInches,
    totalBasinDepthInches,
    waterHP,
    bhp,
    motorKW,
    recommendedMotorHP,
    recommendedMotorKW,
    isScouringCompliant,
    isMaxVelocityCompliant,
    isSolidsCompliant,
    calculatedStartsPerHour,
    maxStarts,
  };
}
