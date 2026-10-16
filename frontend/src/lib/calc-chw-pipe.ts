export const pipeTable: Record<string, number> = {
  0.5: 15.80, 0.75: 20.93, 1.0: 26.64, 1.25: 35.05, 1.5: 40.89,
  2.0: 52.50, 2.5: 62.71, 3.0: 77.93, 3.5: 90.12, 4.0: 102.26,
  5.0: 128.19, 6.0: 154.05, 8.0: 202.72, 10.0: 254.46, 12.0: 303.23
};

export const GLYCOL_VISC: Record<string, number> = { chw: 1, cw: 1, g25: 1.8, g40: 2.6 };
export const GLYCOL_DENS: Record<string, number> = { chw: 1, cw: 1, g25: 1.03, g40: 1.05 };

export const PIPE_MATERIALS: Record<string, { label: string; roughness: number }> = {
  steel: { label: "Carbon Steel", roughness: 0.000046 },
  copper: { label: "Copper", roughness: 0.0000015 },
  stainless: { label: "Stainless Steel", roughness: 0.000015 },
  galvanized: { label: "Galvanized Steel", roughness: 0.00015 },
};

export type CHWModePill = "primary_chw" | "secondary_chw" | "condenser_cw" | "district_cooling" | "glycol_loop";

export interface CHWPreset {
  id: CHWModePill;
  name: string;
  flowRateSI: number;
  flowRateIP: number;
  fluidType: "chw" | "cw" | "g25" | "g40";
  tempSI: number;
  tempIP: number;
  targetDpSI: number;
  targetDpIP: number;
  material: "steel" | "copper" | "stainless" | "galvanized";
}

export const CHW_PRESETS: Record<CHWModePill, CHWPreset> = {
  primary_chw: {
    id: "primary_chw",
    name: "Primary CHW Loop",
    flowRateSI: 5.0,
    flowRateIP: 80.0,
    fluidType: "chw",
    tempSI: 6.7,
    tempIP: 44.0,
    targetDpSI: 40,
    targetDpIP: 4.0,
    material: "steel",
  },
  secondary_chw: {
    id: "secondary_chw",
    name: "Secondary Riser",
    flowRateSI: 12.0,
    flowRateIP: 190.0,
    fluidType: "chw",
    tempSI: 6.7,
    tempIP: 44.0,
    targetDpSI: 50,
    targetDpIP: 3.5,
    material: "steel",
  },
  condenser_cw: {
    id: "condenser_cw",
    name: "Condenser Water",
    flowRateSI: 40.0,
    flowRateIP: 634.0,
    fluidType: "cw",
    tempSI: 32.0,
    tempIP: 89.6,
    targetDpSI: 45,
    targetDpIP: 3.0,
    material: "steel",
  },
  district_cooling: {
    id: "district_cooling",
    name: "District Cooling",
    flowRateSI: 60.0,
    flowRateIP: 951.0,
    fluidType: "chw",
    tempSI: 5.5,
    tempIP: 41.9,
    targetDpSI: 25,
    targetDpIP: 1.8,
    material: "steel",
  },
  glycol_loop: {
    id: "glycol_loop",
    name: "Glycol Loop",
    flowRateSI: 8.0,
    flowRateIP: 127.0,
    fluidType: "g25",
    tempSI: 4.0,
    tempIP: 39.2,
    targetDpSI: 60,
    targetDpIP: 4.0,
    material: "steel",
  },
};

export function colebrook(Re: number, relR: number): number {
  if (Re <= 0) return 0.1;
  if (Re < 2300) return 64 / Re;
  let f = 0.25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, 0.9)) / Math.LN10, 2);
  for (let i = 0; i < 80; i++) {
    const r = -2 * Math.log((relR / 3.7) + (2.51 / (Re * Math.sqrt(f)))) / Math.LN10;
    const fn = 1 / (r * r);
    if (Math.abs(fn - f) < 1e-10) {
      f = fn;
      break;
    }
    f = fn;
  }
  return f;
}

export function waterDens(tC: number): number {
  return 999.842594 + 6.793952e-2 * tC - 9.09529e-3 * Math.pow(tC, 2) + 1.001685e-4 * Math.pow(tC, 3) - 1.120083e-6 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}

export function waterVisc(tC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tC + 406.15));
}

export function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}



export function calculateCHWPipeSize(sizingParams: any, unitSystem: "si" | "ip", ip: boolean) {
    const flowVal = parseFloat(String(sizingParams.flowRate));
    const tRaw = parseFloat(String(sizingParams.temperature));
    const dpRaw = parseFloat(String(sizingParams.targetDp));

    const isValid = !isNaN(flowVal) && flowVal > 0 && !isNaN(tRaw) && !isNaN(dpRaw) && dpRaw > 0;

    if (!isValid) {
      return {
        isValid: false,
        flowVal: 0,
        tRaw: 0,
        dpRaw: 0,
        chosen: null,
        allPipes: [],
        rho: 1000,
        mu: 0.001
      };
    }

    const Q = ip ? flowVal * 6.30902e-5 : flowVal * 1e-3; // m³/s
    const tC = ip ? fToC(tRaw) : tRaw;
    const eps = PIPE_MATERIALS[sizingParams.pipeMaterial]?.roughness || 0.000046;
    const targetDpPaM = ip ? dpRaw * 29.89 : dpRaw; // 1 ft w.g./100ft ≈ 29.89 Pa/m

    const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
    const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];

    let chosen: any = null;
    const allPipes: any[] = [];

    for (const [nps, idMm] of Object.entries(pipeTable)) {
      const D = idMm / 1000; // m
      const A = (Math.PI * D * D) / 4; // m²
      const v = Q / A; // m/s
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dpPaM = (f * rho * v * v) / (2 * D); // Pa/m
      const dpFt = dpPaM / 29.89; // ft w.g. / 100ft
      const vFps = v / 0.3048;
      const idIn = idMm / 25.4;
      const isCompliant = dpPaM <= targetDpPaM * 1.05;

      const rowObj = {
        nps: Number(nps),
        idMm,
        idIn,
        D,
        A,
        v,
        vFps,
        Re,
        f,
        dpPaM,
        dpFt,
        isCompliant,
        regime: Re > 4000 ? "Turbulent" : "Laminar"
      };
      allPipes.push(rowObj);

      if (!chosen && isCompliant) {
        chosen = rowObj;
      }
    }

    if (!chosen && allPipes.length > 0) {
      chosen = allPipes[allPipes.length - 1];
    }

    return {
      isValid: true,
      flowVal,
      tRaw,
      tC,
      dpRaw,
      rho,
      mu,
      chosen,
      allPipes
    };
  }