$path = "frontend\src\routes\fresh-air-cooling-load.tsx"
$text = [IO.File]::ReadAllText($path)

$targetConsts = @"
// ASHRAE two-equation saturation pressure model (Pa)
function satP(tK: number): number {
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

function wFromWB(db: number, wb: number, p: number): number {
  const pSatWb = satP(wb + 273.15);
  const ws = 0.621945 * pSatWb / Math.max(1, (p - pSatWb));
  const wVal = ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
  return Math.max(0.0001, wVal);
}

// Relative Humidity from DB, WB, and pressure
function rhFromDbWb(db: number, wb: number, p: number): number {
  const w = wFromWB(db, wb, p);
  const pSatDb = satP(db + 273.15);
  const pw = (p * w) / (0.621945 + w);
  return Math.min(100, Math.max(0, (pw / pSatDb) * 100));
}

// Enthalpy of moist air in kJ/kg dry air
function enthalpyMoistAir(db: number, w: number): number {
  return 1.006 * db + w * (2501 + 1.86 * db);
}
"@

$targetMath = @"
  // Calculation Engine
  const calc = useMemo(() => {
    const dbInVal = dbIn !== "" ? Number(dbIn) : (ip ? 95 : 35.0);
    const wbInVal = wbIn !== "" ? Number(wbIn) : (ip ? 78 : 25.5);
    const dbOutVal = dbOut !== "" ? Number(dbOut) : (ip ? 55 : 12.8);
    const wbOutVal = wbOut !== "" ? Number(wbOut) : (ip ? 54 : 12.2);
    const flowVal = flowRate !== "" ? Number(flowRate) : (ip ? 1000 : 0.472);

    const dbInC = ip ? fToC(dbInVal) : dbInVal;
    const wbInC = ip ? fToC(wbInVal) : wbInVal;
    const dbOutC = ip ? fToC(dbOutVal) : dbOutVal;
    const wbOutC = ip ? fToC(wbOutVal) : wbOutVal;
    const flowM3s = ip ? cfmToM3s(flowVal) : flowVal;
    const flowLps = flowM3s * 1000;
    const flowCfm = flowM3s * 2118.88;

    const pAtm = 101325; // standard sea-level Pa
    const wInKg = wFromWB(dbInC, wbInC, pAtm);
    const wOutKg = wFromWB(dbOutC, wbOutC, pAtm);

    const rhIn = rhFromDbWb(dbInC, wbInC, pAtm);
    const rhOut = rhFromDbWb(dbOutC, wbOutC, pAtm);

    const hIn = enthalpyMoistAir(dbInC, wInKg);
    const hOut = enthalpyMoistAir(dbOutC, wOutKg);

    const rho = 1.2; // standard air density kg/m3
    const mDot = flowM3s * rho; // kg/s dry air
    const cp = 1.006; // kJ/kg.K
    const hfg = 2501; // kJ/kg latent heat of vaporization

    const sfMultiplier = 1 + (Number(safetyFactor) || 0) / 100;

    const sensKwBase = mDot * cp * Math.max(0, (dbInC - dbOutC));
    const latKwBase = mDot * Math.max(0, (wInKg - wOutKg)) * hfg;
    const totKwBase = sensKwBase + latKwBase;

    const sensKw = sensKwBase * sfMultiplier;
    const latKw = latKwBase * sfMultiplier;
    const totKw = totKwBase * sfMultiplier;

    const capTons = totKw / 3.51685;
    const shr = totKw > 0 ? (sensKw / totKw) : 1.0;

    // Condensate removal rate in kg/h (or L/h)
    const condensateKgH = mDot * Math.max(0, (wInKg - wOutKg)) * 3600;
    const condensateGph = condensateKgH * 0.264172;

    const sensLoad = ip ? sensKw * 3412.14 : sensKw;
    const latLoad = ip ? latKw * 3412.14 : latKw;
    const totLoad = ip ? totKw * 3412.14 : totKw;
    const wIn = ip ? wInKg * 7000 : wInKg;
    const wOut = ip ? wOutKg * 7000 : wOutKg;
    const hInBtu = hIn * 0.429923;
    const hOutBtu = hOut * 0.429923;

    return {
      dbInVal, wbInVal, dbOutVal, wbOutVal, flowVal,
      dbInC, wbInC, dbOutC, wbOutC,
      flowM3s, flowLps, flowCfm,
      wInKg, wOutKg,
      rhIn, rhOut,
      hIn, hOut, hInBtu, hOutBtu,
      sensKw, latKw, totKw,
      sensLoad, latLoad, totLoad,
      capacityTons: capTons,
      wIn, wOut,
      shr,
      condensateKgH,
      condensateGph,
      mDot,
    };
  }, [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    const dbInVal = dbIn !== "" ? Number(dbIn) : (ip ? 95 : 35);
    const wbInVal = wbIn !== "" ? Number(wbIn) : (ip ? 78 : 25.5);
    const dbOutVal = dbOut !== "" ? Number(dbOut) : (ip ? 55 : 12.8);
    const wbOutVal = wbOut !== "" ? Number(wbOut) : (ip ? 54 : 12.2);

    if (wbInVal > dbInVal) w.push("Entering Wet Bulb cannot exceed Entering Dry Bulb temperature.");
    if (wbOutVal > dbOutVal) w.push("Leaving Wet Bulb cannot exceed Leaving Dry Bulb temperature.");
    if (dbOutVal > dbInVal) w.push("Leaving Dry Bulb temperature is higher than Entering Dry Bulb temperature (Heating mode).");
    if (wbOutVal > wbInVal) w.push("Leaving Wet Bulb temperature is higher than Entering Wet Bulb temperature.");
    if (calc.shr < 0.3) w.push("Very high latent moisture load detected (SHR < 0.30). Ensure adequate coil depth & condensate drain sizing.");
    return w;
  }, [dbIn, wbIn, dbOut, wbOut, calc.shr, ip]);
"@

$replacementMath = @"
  // Calculation Engine
  const calc = useMemo(() => calculateFreshAirCoolingLoad(dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip), [dbIn, wbIn, dbOut, wbOut, flowRate, safetyFactor, ip]);
  const warnings = useMemo(() => calculateFreshAirWarnings(dbIn, wbIn, dbOut, wbOut, calc.shr, ip), [dbIn, wbIn, dbOut, wbOut, calc.shr, ip]);
"@

$text = $text.Replace($targetMath, $replacementMath)
$text = $text.Replace($targetConsts, "")
$text = "import { calculateFreshAirCoolingLoad, calculateFreshAirWarnings } from `"@/lib/calc-fresh-air`";`n" + $text

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
