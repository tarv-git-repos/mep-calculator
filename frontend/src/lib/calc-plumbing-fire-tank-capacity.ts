// Conversion Constants
export const GPM_TO_LPS = 0.0630902;
export const GPM_TO_LMIN = 3.78541;
export const GAL_TO_L = 3.78541;
export const GAL_TO_M3 = 0.00378541;
export const CUFT_PER_GAL = 0.133681; // 1 gal = 0.133681 ft3
export const GAL_PER_CUFT = 7.48052;
export const CUFT_TO_GAL = 7.48052;

export interface FireTankParams {
  systemType: "combined" | "sprinkler" | "standpipe";
  sprinklerFlow: number | "";
  sprinklerDur: number | "";
  standpipeFlow: number | "";
  standpipeDur: number | "";
  hoseFlow: number | "";
  hoseDur: number | "";
  makeupFlow: number | "";
  usableDepth: number | "";
}

export const DEFAULT_PARAMS: FireTankParams = {
  systemType: "combined",
  sprinklerFlow: 500,
  sprinklerDur: 60,
  standpipeFlow: 500,
  standpipeDur: 60,
  hoseFlow: 250,
  hoseDur: 60,
  makeupFlow: 0,
  usableDepth: 8, // 8 ft or ~2.5 m
};

// Preset Definitions for Intelligence Drawer
export interface TankPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Partial<FireTankParams>;
}

export const TANK_PRESETS: TankPreset[] = [
  {
    id: "light_hazard",
    name: "Light Hazard (NFPA 13)",
    category: "Offices, Schools, Hospitals",
    description: "30-min duration, 300 GPM sprinkler + 100 GPM hose stream allowance.",
    params: {
      systemType: "sprinkler",
      sprinklerFlow: 300,
      sprinklerDur: 30,
      standpipeFlow: 0,
      standpipeDur: 0,
      hoseFlow: 100,
      hoseDur: 30,
      makeupFlow: 0,
    },
  },
  {
    id: "ordinary_1",
    name: "Ordinary Hazard Group 1",
    category: "Restaurants, Laundries, Parking",
    description: "60-min duration, 500 GPM sprinkler, 500 GPM standpipe + 250 GPM hose stream.",
    params: {
      systemType: "combined",
      sprinklerFlow: 500,
      sprinklerDur: 60,
      standpipeFlow: 500,
      standpipeDur: 60,
      hoseFlow: 250,
      hoseDur: 60,
      makeupFlow: 0,
    },
  },
  {
    id: "ordinary_2_highrise",
    name: "Ordinary Hazard Group 2 / High Rise",
    category: "Commercial Malls, Factories, Warehouses",
    description: "90-min duration, 750 GPM sprinkler, 500 GPM standpipe + 250 GPM hose stream.",
    params: {
      systemType: "combined",
      sprinklerFlow: 750,
      sprinklerDur: 90,
      standpipeFlow: 500,
      standpipeDur: 60,
      hoseFlow: 250,
      hoseDur: 90,
      makeupFlow: 0,
    },
  },
  {
    id: "extra_hazard",
    name: "Extra Hazard Group 1 & 2",
    category: "Chemical, Plastics, High-Rack Storage",
    description: "120-min duration, 1,000 GPM sprinkler + 500 GPM hose stream allowance.",
    params: {
      systemType: "sprinkler",
      sprinklerFlow: 1000,
      sprinklerDur: 120,
      standpipeFlow: 0,
      standpipeDur: 0,
      hoseFlow: 500,
      hoseDur: 120,
      makeupFlow: 0,
    },
  },
  {
    id: "standpipe_only",
    name: "Standpipe Only (NFPA 14 Class I/III)",
    category: "Multi-Story Stairwell Risers",
    description: "30-min duration, 500 GPM first riser + 250 GPM hose stream allowance.",
    params: {
      systemType: "standpipe",
      sprinklerFlow: 0,
      sprinklerDur: 0,
      standpipeFlow: 500,
      standpipeDur: 30,
      hoseFlow: 250,
      hoseDur: 30,
      makeupFlow: 0,
    },
  },
];


export function computeFireTankCalculations(params: FireTankParams) {
  const isCombined = params.systemType === "combined";
  const isSprinkler = params.systemType === "sprinkler" || isCombined;
  const isStandpipe = params.systemType === "standpipe" || isCombined;

  const spQ = isSprinkler ? Number(params.sprinklerFlow || 0) : 0;
  const spD = isSprinkler ? Number(params.sprinklerDur || 0) : 0;
  const spV = spQ * spD; // gal

  const stQ = isStandpipe ? Number(params.standpipeFlow || 0) : 0;
  const stD = isStandpipe ? Number(params.standpipeDur || 0) : 0;
  const stV = stQ * stD; // gal

  const hsQ = Number(params.hoseFlow || 0);
  const hsD = Number(params.hoseDur || 0);
  const hsV = hsQ * hsD; // gal

  const grossDemandGal = spV + stV + hsV;

  const muQ = Number(params.makeupFlow || 0);
  const maxDur = Math.max(spD, stD, hsD, 0);
  const makeupCredit = muQ * maxDur;

  const totalGal = Math.max(0, grossDemandGal - makeupCredit);
  const totalM3 = totalGal * GAL_TO_M3;
  const totalL = totalGal * GAL_TO_L;

  const usableDepthFt = Math.max(1, Number(params.usableDepth || 8));
  const totalCuFt = totalGal / CUFT_TO_GAL;
  const footprintSqFt = totalCuFt / usableDepthFt;

  const rectRatio = 1.5;
  const rectWidthFt = Math.sqrt(footprintSqFt / rectRatio);
  const rectLengthFt = rectWidthFt * rectRatio;

  const cylDiamFt = Math.sqrt((4 * footprintSqFt) / Math.PI);

  const depthM = usableDepthFt * 0.3048;
  const rectLenM = rectLengthFt * 0.3048;
  const rectWidM = rectWidthFt * 0.3048;
  const cylDiamM = cylDiamFt * 0.3048;

  // Refill hours to restore 100% capacity
  const refillHours = muQ > 0 ? totalGal / (muQ * 60) : null;
  const isRefillCompliant = refillHours !== null ? refillHours <= 8.0 : null;

  const rectAreaSqFt = footprintSqFt;
  const rectAreaSqM = depthM > 0 ? totalM3 / depthM : 0;

  return {
    spQ,
    spD,
    spV,
    stQ,
    stD,
    stV,
    hsQ,
    hsD,
    hsV,
    grossDemandGal,
    mu: muQ,
    maxDur,
    makeupCredit,
    totalGal,
    totalM3,
    totalL,
    usableDepthFt,
    totalCuFt,
    footprintSqFt,
    rectLengthFt,
    rectWidthFt,
    cylDiamFt,
    depthM,
    rectLenM,
    rectWidM,
    cylDiamM,
    refillHours,
    isRefillCompliant,
    depthVal: usableDepthFt,
    rectLengthM: rectLenM,
    rectWidthM: rectWidM,
  };
}
