// Conversion Constants
export const GPM_TO_LPS = 0.0630902;
export const GPM_TO_LMIN = 3.78541;
export const PSI_TO_BAR = 0.0689476;
export const PSI_TO_KPA = 6.89476;
export const PSI_TO_M = 0.70307; // psi to meters of water head
export const FT_TO_M = 0.3048;
export const HP_TO_KW = 0.7457;

// NFPA 20 Standard Rated Fire Pump Sizes (GPM)
export const NFPA_STANDARD_PUMP_SIZES = [
  25, 50, 100, 150, 200, 250, 300, 400, 450, 500, 750, 1000, 1250, 1500, 2000,
  2500, 3000, 3500, 4000, 4500, 5000,
];

// Standard Electric Motor HP ratings
export const STANDARD_MOTOR_HP = [
  5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300,
  350, 400, 450, 500, 600,
];

// NFPA 20 Table 4.27 Pipe Size Recommendations (Minimum inside diameter in inches)
export function getRecommendedPipeSizes(ratedGpm: number) {
  if (ratedGpm <= 25) return { suctionIn: 1.0, dischargeIn: 1.0, reliefIn: 0.75, meterIn: 1.25 };
  if (ratedGpm <= 50) return { suctionIn: 1.5, dischargeIn: 1.25, reliefIn: 1.25, meterIn: 1.5 };
  if (ratedGpm <= 100) return { suctionIn: 2.0, dischargeIn: 2.0, reliefIn: 1.5, meterIn: 2.0 };
  if (ratedGpm <= 150) return { suctionIn: 2.5, dischargeIn: 2.5, reliefIn: 2.0, meterIn: 2.5 };
  if (ratedGpm <= 250) return { suctionIn: 3.5, dischargeIn: 3.0, reliefIn: 2.0, meterIn: 3.5 };
  if (ratedGpm <= 500) return { suctionIn: 5.0, dischargeIn: 5.0, reliefIn: 3.0, meterIn: 5.0 };
  if (ratedGpm <= 750) return { suctionIn: 6.0, dischargeIn: 6.0, reliefIn: 3.0, meterIn: 5.0 };
  if (ratedGpm <= 1000) return { suctionIn: 8.0, dischargeIn: 6.0, reliefIn: 4.0, meterIn: 6.0 };
  if (ratedGpm <= 1250) return { suctionIn: 8.0, dischargeIn: 8.0, reliefIn: 6.0, meterIn: 6.0 };
  if (ratedGpm <= 1500) return { suctionIn: 8.0, dischargeIn: 8.0, reliefIn: 6.0, meterIn: 8.0 };
  if (ratedGpm <= 2000) return { suctionIn: 10.0, dischargeIn: 10.0, reliefIn: 6.0, meterIn: 8.0 };
  if (ratedGpm <= 2500) return { suctionIn: 10.0, dischargeIn: 10.0, reliefIn: 8.0, meterIn: 8.0 };
  if (ratedGpm <= 3000) return { suctionIn: 12.0, dischargeIn: 12.0, reliefIn: 8.0, meterIn: 8.0 };
  return { suctionIn: 14.0, dischargeIn: 12.0, reliefIn: 8.0, meterIn: 10.0 };
}

export interface FirePumpParams {
  fpFlow: number | "";
  fpPress: number | "";
  fpDisch: number | "";
  fpSuct: number | "";
  fpEff: number | "";
  fpSafetyMargin: number | "";
  driverType: "electric" | "diesel";
  jockeyFlowPct: number | "";
  jockeyPressureMargin: number | "";
}

export const DEFAULT_PARAMS: FirePumpParams = {
  fpFlow: 500,
  fpPress: 100,
  fpDisch: 5,
  fpSuct: 0,
  fpEff: 70,
  fpSafetyMargin: 3,
  driverType: "electric",
  jockeyFlowPct: 2,
  jockeyPressureMargin: 10,
};

// Preset Definitions for Intelligence Drawer
export interface PumpPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Partial<FirePumpParams>;
}

export const PUMP_PRESETS: PumpPreset[] = [
  {
    id: "light_hazard",
    name: "Light Hazard Sprinkler (NFPA 13)",
    category: "Offices, Schools, Residential",
    description: "250 GPM @ 100 psi rated duty for low-hazard fire sprinkler systems.",
    params: {
      fpFlow: 250,
      fpPress: 90,
      fpDisch: 5,
      fpSuct: 0,
      fpEff: 70,
      fpSafetyMargin: 3,
      driverType: "electric",
      jockeyFlowPct: 2,
    },
  },
  {
    id: "ordinary_hazard_1",
    name: "Ordinary Hazard Group 1 (OH-1)",
    category: "Restaurants, Laundries, Garages",
    description: "500 GPM @ 100 psi rated duty with electric driver.",
    params: {
      fpFlow: 500,
      fpPress: 100,
      fpDisch: 5,
      fpSuct: 0,
      fpEff: 72,
      fpSafetyMargin: 3,
      driverType: "electric",
      jockeyFlowPct: 2,
    },
  },
  {
    id: "ordinary_hazard_2",
    name: "Ordinary Hazard Group 2 (OH-2)",
    category: "Malls, Mercantile, Warehouses",
    description: "750 GPM @ 110 psi duty point for combined sprinkler & hose systems.",
    params: {
      fpFlow: 750,
      fpPress: 110,
      fpDisch: 6,
      fpSuct: 0,
      fpEff: 75,
      fpSafetyMargin: 4,
      driverType: "electric",
      jockeyFlowPct: 2,
    },
  },
  {
    id: "high_rise_standpipe",
    name: "High-Rise Standpipe & Sprinkler",
    category: "NFPA 14 Class I Multi-Story",
    description: "1,000 GPM @ 150 psi high-head duty for multi-story buildings with standpipes.",
    params: {
      fpFlow: 1000,
      fpPress: 150,
      fpDisch: 8,
      fpSuct: 0,
      fpEff: 75,
      fpSafetyMargin: 5,
      driverType: "diesel",
      jockeyFlowPct: 1.5,
    },
  },
  {
    id: "extra_hazard_industrial",
    name: "Extra Hazard Industrial (EH-1/2)",
    category: "Chemical, Plastics, Hangars",
    description: "1,500 GPM @ 125 psi heavy duty fire pump with diesel driver.",
    params: {
      fpFlow: 1500,
      fpPress: 125,
      fpDisch: 8,
      fpSuct: 0,
      fpEff: 78,
      fpSafetyMargin: 5,
      driverType: "diesel",
      jockeyFlowPct: 1,
    },
  },
  {
    id: "foam_water_deluge",
    name: "Foam-Water Deluge System",
    category: "Flammable Liquid Storage, Tank Farms",
    description: "2,000 GPM @ 140 psi high-capacity deluge pump.",
    params: {
      fpFlow: 2000,
      fpPress: 140,
      fpDisch: 10,
      fpSuct: 0,
      fpEff: 80,
      fpSafetyMargin: 5,
      driverType: "diesel",
      jockeyFlowPct: 1,
    },
  },
];


export function computeFirePumpCalculations(params: FirePumpParams) {
  const Q_req = parseFloat(String(params.fpFlow)) || 0;
  const P_req = parseFloat(String(params.fpPress)) || 0;
  const dischLoss = parseFloat(String(params.fpDisch)) || 0;
  const suctHeadFt = parseFloat(String(params.fpSuct)) || 0;
  const suctPsi = suctHeadFt * 0.4335; // ft to psi
  const eff = (parseFloat(String(params.fpEff)) || 70) / 100;
  const margin = parseFloat(String(params.fpSafetyMargin)) || 0;

  // Recommended nearest NFPA Standard rated pump size >= Q_req
  const nearestStandardSize =
    NFPA_STANDARD_PUMP_SIZES.find((sz) => sz >= Q_req) ||
    (Q_req > 5000 ? Math.ceil(Q_req / 500) * 500 : 500);

  // Rated Head = System Required Pressure + Discharge Piping Losses - Available Suction Pressure + Margin
  const ratedHeadPsi = Math.max(0, P_req + dischLoss - suctPsi + margin);
  const ratedHeadBar = ratedHeadPsi * PSI_TO_BAR;
  const ratedHeadM = ratedHeadPsi * PSI_TO_M;

  // NFPA 20 Characteristic Curve Reference Points
  // 1. Churn (Shutoff Head): Maximum 140% of rated head (typically 110% - 140%)
  const churnPsi = ratedHeadPsi * 1.4;
  const churnBar = churnPsi * PSI_TO_BAR;

  // 2. 150% Peak Flow Point: Minimum 65% of rated head
  const peakFlowGpm = nearestStandardSize * 1.5;
  const peakFlowLps = peakFlowGpm * GPM_TO_LPS;
  const peakHeadPsi = ratedHeadPsi * 0.65;
  const peakHeadBar = peakHeadPsi * PSI_TO_BAR;

  // Power Calculations
  // Water Horsepower (WHP) = (Q in GPM * Head in ft) / 3960 = (Q in GPM * Head in psi * 2.3066) / 3960 = (Q * Head_psi) / 1714
  const whp = (nearestStandardSize * ratedHeadPsi) / 1714.28;
  const brakeHp = eff > 0 ? whp / eff : 0;
  const brakeKw = brakeHp * HP_TO_KW;

  // Maximum Power at Peak 150% condition (for non-overloading motor selection)
  // At 150% flow and 65% head: WHP_peak = (1.5 * Q * 0.65 * H) / 1714 = 0.975 * WHP_rated
  // However, pump efficiency at 150% flow drops ~15-20%, leading to peak BHP ~ 1.15 to 1.25x rated BHP
  const peakBrakeHp = brakeHp * 1.2;

  // Standard Motor Selection
  const selectedMotorHp =
    STANDARD_MOTOR_HP.find((hp) => hp >= peakBrakeHp) || Math.ceil(peakBrakeHp / 50) * 50;
  const selectedMotorKw = selectedMotorHp * HP_TO_KW;

  // Electrical Estimates (for 400V 3-phase electric motor)
  const motorFullLoadAmps = (selectedMotorKw * 1000) / (1.732 * 400 * 0.88 * 0.92); // ~ FLA
  const motorStartingAmpsDOL = motorFullLoadAmps * 6; // Direct on line
  const motorStartingAmpsStarDelta = motorFullLoadAmps * 2; // Soft start / star-delta

  // Jockey Pump Sizing
  const jockeyPct = parseFloat(String(params.jockeyFlowPct)) || 2;
  const jockeyFlowGpm = Math.max(10, (nearestStandardSize * jockeyPct) / 100);
  const jockeyFlowLps = jockeyFlowGpm * GPM_TO_LPS;
  const jockeyPressMargin = parseFloat(String(params.jockeyPressureMargin)) || 10;
  const jockeyCutOutPsi = churnPsi + jockeyPressMargin;
  const jockeyCutInPsi = ratedHeadPsi - 5;
  const mainFirePumpCutInPsi = ratedHeadPsi - 15;

  // Pipe Size Recommendations per NFPA 20 Table 4.27
  const pipeSizes = getRecommendedPipeSizes(nearestStandardSize);

  // Safety and Compliance Warnings
  const isHighChurn = churnPsi > 250;
  const isCavitationRisk = suctHeadFt < 0 || suctPsi < -3;
  const isHighSystemDemand = P_req > 175; // Above 175 psi requires 300 psi rated valves & fittings

  return {
    Q_req,
    P_req,
    dischLoss,
    suctHeadFt,
    suctPsi,
    eff,
    margin,
    nearestStandardSize,
    ratedHeadPsi,
    ratedHeadBar,
    ratedHeadM,
    churnPsi,
    churnBar,
    peakFlowGpm,
    peakFlowLps,
    peakHeadPsi,
    peakHeadBar,
    whp,
    brakeHp,
    brakeKw,
    peakBrakeHp,
    selectedMotorHp,
    selectedMotorKw,
    motorFullLoadAmps,
    motorStartingAmpsDOL,
    motorStartingAmpsStarDelta,
    jockeyFlowGpm,
    jockeyFlowLps,
    jockeyCutOutPsi,
    jockeyCutInPsi,
    mainFirePumpCutInPsi,
    pipeSizes,
    isHighChurn,
    isCavitationRisk,
    isHighSystemDemand,
  };
}
