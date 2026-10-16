import { fToC, cfmToLps, lpsToGpm } from "@/utils/conversions";

// ASHRAE two-equation saturation pressure model (Pa)
export function satP(tK: number): number {
  if (isNaN(tK) || !isFinite(tK) || tK <= 0) return 0;
  if (tK >= 273.15) {
    const val = Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
    return isNaN(val) || !isFinite(val) ? 0 : Math.max(0, val);
  }
  const val = Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
  return isNaN(val) || !isFinite(val) ? 0 : Math.max(0, val);
}

export function wFromWB(db: number, wb: number, p: number = 101325): number {
  if (isNaN(db) || isNaN(wb) || isNaN(p) || p <= 0) return 0;
  const pSat = satP(wb + 273.15);
  if (p - pSat <= 0) return 0;
  const ws = 0.621945 * pSat / (p - pSat);
  const denom = (2501 + 1.805 * db - 4.186 * wb);
  if (denom === 0 || isNaN(denom)) return 0;
  const val = ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / denom;
  return isNaN(val) || !isFinite(val) || val < 0 ? 0 : val;
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

  const isNoFlow = coil.flow === "" || coil.flow === undefined || coil.flow === null || isNaN(Number(coil.flow)) || Number(coil.flow) <= 0;
  if (isNoFlow) reasons.push("Missing or zero Airflow rate");

  const isNoDbIn = coil.dbIn === "" || coil.dbIn === undefined || coil.dbIn === null || isNaN(Number(coil.dbIn));
  if (isNoDbIn) reasons.push("Missing On-Coil Dry Bulb");

  const isNoWbIn = coil.wbIn === "" || coil.wbIn === undefined || coil.wbIn === null || isNaN(Number(coil.wbIn));
  if (isNoWbIn) reasons.push("Missing On-Coil Wet Bulb");

  const isNoDbOut = coil.dbOut === "" || coil.dbOut === undefined || coil.dbOut === null || isNaN(Number(coil.dbOut));
  if (isNoDbOut) reasons.push("Missing Off-Coil Dry Bulb");

  const isNoWbOut = coil.wbOut === "" || coil.wbOut === undefined || coil.wbOut === null || isNaN(Number(coil.wbOut));
  if (isNoWbOut) reasons.push("Missing Off-Coil Wet Bulb");

  if (!isNoDbIn && !isNoWbIn && Number(coil.wbIn) > Number(coil.dbIn)) {
    reasons.push("Entering Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (!isNoDbOut && !isNoWbOut && Number(coil.wbOut) > Number(coil.dbOut)) {
    reasons.push("Leaving Wet Bulb exceeds Dry Bulb (Thermodynamically invalid)");
  }

  if (!isNoDbIn && !isNoDbOut && Number(coil.dbOut) >= Number(coil.dbIn)) {
    reasons.push("Leaving Dry Bulb ≥ Entering Dry Bulb (No cooling occurs)");
  }

  if (!isNoDbIn && !isNoWbIn && !isNoDbOut && !isNoWbOut && coil.wIn !== undefined && coil.wOut !== undefined && coil.wOut >= coil.wIn) {
    reasons.push("Leaving humidity ratio ≥ entering (No moisture extraction / sensible only)");
  }

  return reasons;
}

export function checkIfCoilMissingData(coil: any): boolean {
  return getCoilMissingReasons(coil).length > 0;
}

export const calculateCondensateRows = (rows: any[], ip: boolean) => {
  const pAtm = 101325;
  if (!Array.isArray(rows)) return [];
  return rows.map(r => {
    const rawDbIn = Number(r.dbIn);
    const rawWbIn = Number(r.wbIn);
    const rawDbOut = Number(r.dbOut);
    const rawWbOut = Number(r.wbOut);
    const rawFlow = Number(r.flow);

    const hasValidIn = !isNaN(rawDbIn) && !isNaN(rawWbIn) && r.dbIn !== "" && r.wbIn !== "";
    const hasValidOut = !isNaN(rawDbOut) && !isNaN(rawWbOut) && r.dbOut !== "" && r.wbOut !== "";
    const hasValidFlow = !isNaN(rawFlow) && r.flow !== "" && rawFlow >= 0;

    const dbInC = ip ? (hasValidIn ? fToC(rawDbIn) : 0) : (hasValidIn ? rawDbIn : 0);
    const wbInC = ip ? (hasValidIn ? fToC(rawWbIn) : 0) : (hasValidIn ? rawWbIn : 0);
    const dbOutC = ip ? (hasValidOut ? fToC(rawDbOut) : 0) : (hasValidOut ? rawDbOut : 0);
    const wbOutC = ip ? (hasValidOut ? fToC(rawWbOut) : 0) : (hasValidOut ? rawWbOut : 0);

    let wIn = 0, wOut = 0;
    if (hasValidIn) {
      try { wIn = wFromWB(dbInC, wbInC, pAtm); } catch (e) {}
      if (isNaN(wIn) || !isFinite(wIn) || wIn < 0) wIn = 0;
    }
    if (hasValidOut) {
      try { wOut = wFromWB(dbOutC, wbOutC, pAtm); } catch (e) {}
      if (isNaN(wOut) || !isFinite(wOut) || wOut < 0) wOut = 0;
    }

    const dw = Math.max(0, wIn - wOut);
    // Flow conversion
    const flowLps = hasValidFlow ? (ip ? cfmToLps(rawFlow) : rawFlow) : 0;
    const massAirFlow = (flowLps / 1000) * 1.2; // kg/s
    const condFlow = Math.max(0, isNaN(massAirFlow * dw) ? 0 : massAirFlow * dw); // L/s

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
      wIn: Number(wIn.toFixed(6)),
      wOut: Number(wOut.toFixed(6)),
      dw: Number(dw.toFixed(6)),
      condFlow,
      missingReasons,
      isAutoFlagged,
      isEffectivelyFlagged
    };
  });
};

export const calculateCondensateTotals = (calculatedRows: any[], rows: any[]) => {
  const totalFlow = (Array.isArray(rows) ? rows : []).reduce((a, b) => a + (Number(b?.flow) || 0), 0);
  const totalCond = (Array.isArray(calculatedRows) ? calculatedRows : []).reduce((a, b) => a + (Number(b?.condFlow) || 0), 0);
  const avgDw = Array.isArray(calculatedRows) && calculatedRows.length > 0 
    ? calculatedRows.reduce((a, b) => a + (Number(b?.dw) || 0), 0) / calculatedRows.length 
    : 0;
  return {
    totalFlow: isNaN(totalFlow) ? 0 : totalFlow,
    totalCond: isNaN(totalCond) ? 0 : totalCond,
    avgDw: isNaN(avgDw) ? 0 : avgDw
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

export type CondMode = "tr" | "lat";
export const calculateDrainResults = (mode: CondMode, tr: number, lat: number, qty: number, length: number, isIp: boolean, kwToTr: (val: number) => number, kwToBtu: (val: number) => number) => {
  let trVal = mode === "tr" ? (isIp ? tr : kwToTr(tr)) : 0;
  let latBTU = 0;
  if (mode === "tr") {
    latBTU = trVal * 12000 * 0.3;
  } else {
    latBTU = isIp ? lat : kwToBtu(lat);
  }

  const galPerHrSingle = latBTU / (1075 * 8.34);
  const galPerHr = galPerHrSingle * qty;
  const lPerMin = galPerHr * 0.063;

  let pipeSize = "";
  let minSlope = "";
  let totalDrop = "";

  if (galPerHr < 5) {
    pipeSize = '3/4" (19mm)';
    minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
    const d = 0.25 * length;
    totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
  } else if (galPerHr < 20) {
    pipeSize = '1" (25mm)';
    minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
    const d = 0.25 * length;
    totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
  } else {
    pipeSize = '1-1/4" (32mm)';
    minSlope = isIp ? '1/8" per ft (1.0%)' : "1.0% (1:100)";
    const d = 0.125 * length;
    totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.01 * 1000).toFixed(0)} mm`;
  }

  return {
    trVal,
    latBTU,
    galPerHrSingle,
    galPerHr,
    lPerMin,
    flowRateDisplay: isIp ? `${galPerHr.toFixed(2)} gal/hr` : `${lPerMin.toFixed(3)} L/min`,
    pipeSize,
    minSlope,
    totalDrop,
  };
};
