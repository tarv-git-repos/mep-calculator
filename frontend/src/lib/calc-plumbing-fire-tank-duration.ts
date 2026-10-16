export interface FireTankDurationParams {
  demandRate: number | ""; // L/min (SI) or GPM (IP)
  hazardPreset: "30" | "60" | "90" | "120" | "custom";
  targetDurationMin: number | ""; // min
  tankCapacity: number | ""; // L (SI) or gal (IP)
  refillRate: number | ""; // L/min (SI) or GPM (IP)
  reserveMarginPct: number | ""; // % (default 10%)
  allowInflowCredit: boolean; // whether municipal refill reduces required storage
  maxRefillHours: number | ""; // hours (NFPA 22 specifies 8h typical / 24h max)
}

export const DEFAULT_PARAMS_SI: FireTankDurationParams = {
  demandRate: 1892.7, // ~500 GPM
  hazardPreset: "60",
  targetDurationMin: 60,
  tankCapacity: 125000, // 125 mÂ³ (33,021 gal)
  refillRate: 250, // 250 L/min (~66 GPM)
  reserveMarginPct: 10,
  allowInflowCredit: false,
  maxRefillHours: 8,
};

export const DEFAULT_PARAMS_IP: FireTankDurationParams = {
  demandRate: 500, // GPM
  hazardPreset: "60",
  targetDurationMin: 60,
  tankCapacity: 33000, // gal
  refillRate: 66, // GPM
  reserveMarginPct: 10,
  allowInflowCredit: false,
  maxRefillHours: 8,
};


export function computeFireTankDurationCalculations(sizingParams: FireTankDurationParams, unitSystem: "si" | "ip") {
  const isIp = unitSystem === "ip";
  const demand = sizingParams.demandRate === "" ? 0 : Number(sizingParams.demandRate);
  const targetDur = sizingParams.targetDurationMin === "" ? 0 : Number(sizingParams.targetDurationMin);
  const tankCap = sizingParams.tankCapacity === "" ? 0 : Number(sizingParams.tankCapacity);
  const refill = sizingParams.refillRate === "" ? 0 : Number(sizingParams.refillRate);
  const marginPct = sizingParams.reserveMarginPct === "" ? 0 : Number(sizingParams.reserveMarginPct);
  const allowInflow = sizingParams.allowInflowCredit;
  const maxRefillHrs = sizingParams.maxRefillHours === "" ? 8 : Number(sizingParams.maxRefillHours);

  // Baseline required volume without refill credit
  const grossReqVol = demand * targetDur;
  const reserveVol = grossReqVol * (marginPct / 100);
  const totalReqVolNoCredit = grossReqVol + reserveVol;

  // Inflow credit deduction (if municipal supply is continuous and reliable per NFPA 22)
  const effectiveInflow = allowInflow ? Math.min(refill, demand) : 0;
  const netDemand = Math.max(0, demand - effectiveInflow);
  const netReqVol = (netDemand * targetDur) * (1 + marginPct / 100);

  const actualReqVol = allowInflow ? netReqVol : totalReqVolNoCredit;

  // Actual duration tank can sustain
  const actualDurMin = (demand - effectiveInflow) > 0 ? tankCap / (demand - effectiveInflow) : (tankCap > 0 && demand === 0 ? 9999 : 0);
  const actualDurHrs = Number((actualDurMin / 60).toFixed(2));

  // Refill time calculation
  const refillTimeMin = refill > 0 ? tankCap / refill : Infinity;
  const refillTimeHrs = refillTimeMin === Infinity ? Infinity : Number((refillTimeMin / 60).toFixed(1));
  const isRefillCompliant = refillTimeHrs <= maxRefillHrs;

  // Compliance assessment
  const isAdequate = tankCap >= actualReqVol;
  const volumeSurplusDeficit = tankCap - actualReqVol;
  const compliancePct = actualReqVol > 0 ? Number(((tankCap / actualReqVol) * 100).toFixed(1)) : 100;

  // Volume in m³ and ft³
  const tankCapM3 = isIp ? Number((tankCap * 0.00378541).toFixed(2)) : Number((tankCap / 1000).toFixed(2));
  const actualReqVolM3 = isIp ? Number((actualReqVol * 0.00378541).toFixed(2)) : Number((actualReqVol / 1000).toFixed(2));

  const tankCapGal = isIp ? tankCap : Number((tankCap * 0.264172).toFixed(0));
  const actualReqVolGal = isIp ? actualReqVol : Number((actualReqVol * 0.264172).toFixed(0));

  return {
    isIp,
    demand,
    targetDur,
    tankCap,
    refill,
    marginPct,
    grossReqVol,
    reserveVol,
    actualReqVol: Math.round(actualReqVol),
    actualDurMin: Number(actualDurMin.toFixed(1)),
    actualDurHrs,
    refillTimeMin: refillTimeMin === Infinity ? 0 : Number(refillTimeMin.toFixed(0)),
    refillTimeHrs,
    isRefillCompliant,
    isAdequate,
    volumeSurplusDeficit: Math.round(volumeSurplusDeficit),
    compliancePct,
    tankCapM3,
    actualReqVolM3,
    tankCapGal,
    actualReqVolGal,
    flowUnit: isIp ? "GPM" : "L/min",
    volUnit: isIp ? "gal" : "L",
  };
}
