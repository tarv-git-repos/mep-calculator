import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Basic CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Moist air property functions
function satP(tK: number): number {
  if (tK >= 273.15) {
    const c8 = -5.8002206e3;
    const c9 = 1.3914993;
    const c10 = -4.864e-2;
    const c11 = 4.1764768e-5;
    const c12 = -1.4452093e-8;
    const c13 = 6.5459673;
    return Math.exp(c8 / tK + c9 + c10 * tK + c11 * Math.pow(tK, 2) + c12 * Math.pow(tK, 3) + c13 * Math.log(tK));
  }
  const c1 = -5.6745359e3;
  const c2 = 6.3925247;
  const c3 = -9.677843e-3;
  const c4 = 6.2215701e-7;
  const c5 = 2.0747825e-9;
  const c6 = -9.484024e-13;
  const c7 = 4.1635019;
  return Math.exp(c1 / tK + c2 + c3 * tK + c4 * Math.pow(tK, 2) + c5 * Math.pow(tK, 3) + c6 * Math.pow(tK, 4) + c7 * Math.log(tK));
}

function wFromRH(tC: number, rh: number, p: number): number {
  const pws = satP(tC + 273.15);
  return 0.621945 * (rh / 100) * pws / (p - (rh / 100) * pws);
}

function wFromWB(td: number, tw: number, p: number): number {
  const ws = 0.621945 * satP(tw + 273.15) / (p - satP(tw + 273.15));
  return ((2501 - 2.381 * tw) * ws - 1.006 * (td - tw)) / (2501 + 1.805 * td - 4.186 * tw);
}

function wFromDP(dp: number, p: number): number {
  const pws = satP(dp + 273.15);
  return 0.621945 * pws / (p - pws);
}

function dewPt(w: number, p: number): number {
  const pw = w * p / (0.621945 + w);
  let lo = -60, hi = 80;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (satP(m + 273.15) < pw) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function wetBulb(td: number, w: number, p: number): number {
  let lo = -60, hi = td;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (wFromWB(td, m, p) < w) lo = m;
    else hi = m;
    if (hi - lo < 0.001) break;
  }
  return (lo + hi) / 2;
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { dbtInput, secondParam, paramValue, atmPressure, ip } = body;

    const pAtmVal = atmPressure !== "" && atmPressure != null ? Number(atmPressure) : 101.325;
    const pAtm = pAtmVal * 1000; // kPa to Pa
    const dbtVal = dbtInput !== "" && dbtInput != null ? Number(dbtInput) : (ip ? 95 : 35);
    const tC = ip ? fToC(dbtVal) : dbtVal;
    let w = 0;

    const pv = paramValue !== "" && paramValue != null ? Number(paramValue) : (secondParam === "rh" ? 60 : secondParam === "wb" || secondParam === "dp" ? (ip ? 78 : 25.5) : (ip ? 100 : 15));

    if (secondParam === "rh") {
      w = wFromRH(tC, pv, pAtm);
    } else if (secondParam === "wb") {
      const wbC = ip ? fToC(pv) : pv;
      w = wFromWB(tC, wbC, pAtm);
    } else if (secondParam === "dp") {
      const dpC = ip ? fToC(pv) : pv;
      w = wFromDP(dpC, pAtm);
    } else {
      w = ip ? pv / 7000 : pv / 1000;
    }

    if (w < 0) w = 0;

    const pws = satP(tC + 273.15);
    const pw = w * pAtm / (0.621945 + w);
    const rh = Math.min(100, (pw / pws) * 100);
    const dp = dewPt(w, pAtm);
    const wb = wetBulb(tC, w, pAtm);
    const h = 1.006 * tC + w * (2501 + 1.805 * tC); // kJ/kg
    const v = 0.287042 * (tC + 273.15) * (1 + 1.607858 * w) / (pAtm / 1000); // m³/kg

    const calculatedData = {
      dbt: tC,
      wbt: wb,
      dp: dp,
      rh: rh,
      w: w,
      h: h,
      v: v,
      pw: pw
    };

    return new Response(
      JSON.stringify(calculatedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
