import { fToC, cfmToLps, lpsToGpm } from "@/utils/conversions";

// ASHRAE two-equation saturation pressure model (Pa)
export function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

export function wFromWB(db: number, wb: number, p: number = 101325): number {
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  return ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
}

// Auto-flag validation logic matching Ventilation missing data checks
export function getCoilMissingReasons(coil: {
  name?: string;
  dbIn?: number | "";
  wbIn?: number | "";
  dbOut?: number | "";
  wbOut?: number | "";
  flow?: number | "";
  wIn?: number;
  wOut?: number;
}): string[] {
  const reasons: string[] = [];

  const isNoName = !coil.name || coil.name.trim() === "";
  if (isNoName) reasons.push("Missing Unit Reference / Tag");

  const isNoFlow = coil.flow === "" || coil.flow === undefined || isNaN(Number(coil.flow)) || Number(coil.flow) <= 0;
  if (isNoFlow) reasons.push("Missing or invalid Airflow rate");

  const isNoDbIn = coil.dbIn === "" || coil.dbIn === undefined || isNaN(Number(coil.dbIn));
  if (isNoDbIn) reasons.push("Missing On-Coil Dry Bulb");

  const isNoWbIn = coil.wbIn === "" || coil.wbIn === undefined || isNaN(Number(coil.wbIn));
  if (isNoWbIn) reasons.push("Missing On-Coil Wet Bulb");

  const isNoDbOut = coil.dbOut === "" || coil.dbOut === undefined || isNaN(Number(coil.dbOut));
  if (isNoDbOut) reasons.push("Missing Off-Coil Dry Bulb");

  const isNoWbOut = coil.wbOut === "" || coil.wbOut === undefined || isNaN(Number(coil.wbOut));
  if (isNoWbOut) reasons.push("Missing Off-Coil Wet Bulb");

  if (!isNoDbIn && !isNoWbIn && Number(coil.wbIn) > Number(coil.dbIn)) {
    reasons.push("Entering Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (!isNoDbOut && !isNoWbOut && Number(coil.wbOut) > Number(coil.dbOut)) {
    reasons.push("Leaving Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (coil.wIn !== undefined && coil.wOut !== undefined && coil.wOut >= coil.wIn) {
    reasons.push("Leaving humidity ratio ≥ entering (No moisture extraction / sensible only)");
  }

  return reasons;
}

export function checkIfCoilMissingData(coil: any): boolean {
  return getCoilMissingReasons(coil).length > 0;
}

export const calculateCondensateRows = (rows: any[], ip: boolean) => {
  const pAtm = 101325;
  return rows.map(r => {
    const dbInC = ip ? fToC(r.dbIn) : r.dbIn;
    const wbInC = ip ? fToC(r.wbIn) : r.wbIn;
    const dbOutC = ip ? fToC(r.dbOut) : r.dbOut;
    const wbOutC = ip ? fToC(r.wbOut) : r.wbOut;

    let wIn = 0, wOut = 0;
    try { wIn = wFromWB(dbInC, wbInC, pAtm); } catch (e) {}
    try { wOut = wFromWB(dbOutC, wbOutC, pAtm); } catch (e) {}

    const dw = Math.max(0, wIn - wOut);
    // Flow conversion
    const flowLps = ip ? cfmToLps(r.flow) : r.flow;
    const massAirFlow = (flowLps / 1000) * 1.2; // kg/s
    const condFlow = massAirFlow * dw; // L/s

    const missingReasons = getCoilMissingReasons({
      name: r.name,
      dbIn: r.dbIn,
      wbIn: r.wbIn,
      dbOut: r.dbOut,
      wbOut: r.wbOut,
      flow: r.flow,
      wIn,
      wOut
    });

    const isAutoFlagged = missingReasons.length > 0;
    const isEffectivelyFlagged = Boolean(r.flagged) || isAutoFlagged;

    return {
      ...r,
      wIn,
      wOut,
      dw,
      condFlow,
      missingReasons,
      isAutoFlagged,
      isEffectivelyFlagged
    };
  });
};

export const calculateCondensateTotals = (calculatedRows: any[], rows: any[]) => {
  const totalFlow = rows.reduce((a, b) => a + b.flow, 0);
  const totalCond = calculatedRows.reduce((a, b) => a + b.condFlow, 0);
  const avgDw = calculatedRows.length > 0 
    ? calculatedRows.reduce((a, b) => a + b.dw, 0) / calculatedRows.length 
    : 0;
  return {
    totalFlow,
    totalCond,
    avgDw
  };
};

export const calculateRecommendedPipe = (totalCond: number) => {
  const totalGpm = lpsToGpm(totalCond);
  if (totalGpm <= 0.05) return { sizeMm: "20 mm", sizeInch: '3/4"', metricDn: "DN20", capacityGpm: "0.05 GPM" };
  if (totalGpm <= 0.20) return { sizeMm: "25 mm", sizeInch: '1"', metricDn: "DN25", capacityGpm: "0.20 GPM" };
  if (totalGpm <= 0.50) return { sizeMm: "32 mm", sizeInch: '1-1/4"', metricDn: "DN32", capacityGpm: "0.50 GPM" };
  if (totalGpm <= 1.20) return { sizeMm: "40 mm", sizeInch: '1-1/2"', metricDn: "DN40", capacityGpm: "1.20 GPM" };
  if (totalGpm <= 3.00) return { sizeMm: "50 mm", sizeInch: '2"', metricDn: "DN50", capacityGpm: "3.00 GPM" };
  return { sizeMm: "65 mm", sizeInch: '2-1/2"', metricDn: "DN65", capacityGpm: ">3.00 GPM" };
};

export type CondMode = tr | lat;
export const calculateDrainResults = (mode: CondMode, tr: number, lat: number, qty: number, length: number, isIp: boolean, kwToTr: (val: number) => number, kwToBtu: (val: number) => number) => {
  let trVal = mode === tr ? (isIp ? tr : kwToTr(tr)) : 0;
  let latBTU = 0;
  if (mode === tr) {
    latBTU = trVal * 12000 * 0.3;
  } else {
    latBTU = isIp ? lat : kwToBtu(lat);
  }

  const galPerHrSingle = latBTU / (1075 * 8.34);
  const galPerHr = galPerHrSingle * qty;
  const lPerMin = galPerHr * 0.063;

  let pipeSize = ";
 let minSlope = ;
 let totalDrop = ;

 if (galPerHr < 5) {
 pipeSize = 3/4" (19mm);
 minSlope = isIp ? 1/4" per ft (2.0%) : 2.0% (1:50);
 const d = 0.25 * length;
 totalDrop = isIp ? ${d.toFixed(2)} in : ${(length * 0.02 * 1000).toFixed(0)} mm;
 } else if (galPerHr < 20) {
 pipeSize = 1" (25mm);
 minSlope = isIp ? 1/4" per ft (2.0%) : 2.0% (1:50);
 const d = 0.25 * length;
 totalDrop = isIp ? ${d.toFixed(2)} in : ${(length * 0.02 * 1000).toFixed(0)} mm;
 } else {
 pipeSize = 1-1/4" (32mm);
 minSlope = isIp ? 1/8" per ft (1.0%) : 1.0% (1:100);
 const d = 0.125 * length;
 totalDrop = isIp ? ${d.toFixed(2)} in : ${(length * 0.01 * 1000).toFixed(0)} mm;
 }

 return {
 trVal,
 latBTU,
 galPerHrSingle,
 galPerHr,
 lPerMin,
 flowRateDisplay: isIp ? ${galPerHr.toFixed(2)} gal/hr : ${lPerMin.toFixed(3)} L/min,
 pipeSize,
 minSlope,
 totalDrop,
 };
};
