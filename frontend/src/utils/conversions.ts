/**
 * Centralized Unit Conversion Utility Functions
 * Used to convert values between Metric (SI) and Imperial (IP) unit systems.
 */

// Temperature
export function cToF(c: number): number {
  return c * 1.8 + 32;
}

export function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

// Airflow
export function lpsToCfm(lps: number): number {
  return lps * 2.11888;
}

export function cfmToLps(cfm: number): number {
  return cfm * 0.471947443;
}

export function m3sToCfm(m3s: number): number {
  return m3s / 0.000471947;
}

export function cfmToM3s(cfm: number): number {
  return cfm * 0.000471947;
}

// Length / Distance
export function mToFt(m: number): number {
  return m * 3.28084;
}

export function ftToM(ft: number): number {
  return ft / 3.28084;
}

// Water / Condensate Flow
export function lpsToGpm(lps: number): number {
  return lps * 15.8503;
}

export function gpmToLps(gpm: number): number {
  return gpm * 0.0630902;
}

export function galhrToLmin(galhr: number): number {
  return galhr * 0.0630902;
}

export function lminToGalhr(lmin: number): number {
  return lmin / 0.0630902;
}

// Cooling Load / Capacity
export function kwToTr(kw: number): number {
  return kw / 3.51685;
}

export function trToKw(tr: number): number {
  return tr * 3.51685;
}

export function btuToKw(btu: number): number {
  return btu * 0.293;
}

export function kwToBtu(kw: number): number {
  return kw / 0.293;
}
