export const SQFT_TO_SQM = 0.092903;
export const SQM_TO_SQFT = 10.7639;
export const FT_TO_M = 0.3048;
export const M_TO_FT = 3.28084;
export const U_IP_TO_SI = 5.678263; // BTU/hr·ft²·°F -> W/m²K
export const U_SI_TO_IP = 0.17611;  // W/m²K -> BTU/hr·ft²·°F
export const CFM_TO_LPS = 0.471947;
export const LPS_TO_CFM = 2.11888;
export const BTU_HR_TO_KW = 0.000293071;
export const KW_TO_BTU_HR = 3412.142;

export const calculateHeatingLoad = (
  area: number | "",
  height: number | "",
  uWall: number | "",
  uGlaz: number | "",
  glazArea: number | "",
  oat: number | "",
  iat: number | "",
  ach: number | ""
) => {
  const areaVal = typeof area === "number" ? Math.max(0, area) : 5000;
  const heightVal = typeof height === "number" ? Math.max(0, height) : 10;
  const uWallVal = typeof uWall === "number" ? Math.max(0, uWall) : 0.065;
  const uGlazVal = typeof uGlaz === "number" ? Math.max(0, uGlaz) : 0.32;
  const glazAreaVal = typeof glazArea === "number" ? Math.max(0, glazArea) : 600;
  const oatVal = typeof oat === "number" ? oat : 20;
  const iatVal = typeof iat === "number" ? iat : 70;
  const achVal = typeof ach === "number" ? Math.max(0, ach) : 0.35;

  // Design Temperature Difference ΔT (°F)
  const deltaTF = Math.max(0, iatVal - oatVal);
  const deltaTC = deltaTF / 1.8;

  // Building Envelope Geometries (assumes square footprint for perimeter estimation)
  const sideLength = Math.sqrt(areaVal);
  const perimeterFt = sideLength * 4;
  const grossWallAreaFt2 = perimeterFt * heightVal;
  
  // As per original calculator: wallArea = sqrtA * 4 * htFt - glazFt2 + areaFt2
  const wallPlusRoofAreaFt2 = grossWallAreaFt2 - glazAreaVal + areaVal;
  const volumeFt3 = areaVal * heightVal;

  // Conduction Heat Losses (BTU/hr)
  const qWall = uWallVal * Math.max(0, wallPlusRoofAreaFt2) * deltaTF;
  const qGlaz = uGlazVal * glazAreaVal * deltaTF;
  const qTotalCond = qWall + qGlaz;

  // Infiltration Heat Loss (BTU/hr)
  // Original calc used: 0.018 * ach * volFt3 * dT
  const qInfil = 0.018 * achVal * volumeFt3 * deltaTF;
  const qTotalAir = qInfil;

  // Base Total Building Heat Loss
  const qBase = qTotalCond + qTotalAir;
  const qTotal = qBase;

  // Kilowatt Equivalents
  const kwBase = qBase * BTU_HR_TO_KW;
  const kwTotal = qTotal * BTU_HR_TO_KW;
  const kwWall = qWall * BTU_HR_TO_KW;
  const kwGlaz = qGlaz * BTU_HR_TO_KW;
  const kwInfil = qInfil * BTU_HR_TO_KW;

  // Load Density Indices
  const loadDensityBtuPerSqft = areaVal > 0 ? qTotal / areaVal : 0;
  const loadDensityWPerSqm = (areaVal * SQFT_TO_SQM) > 0 ? (kwTotal * 1000) / (areaVal * SQFT_TO_SQM) : 0;

  // Percentage Breakdown
  const pctWall = qBase > 0 ? (qWall / qBase) * 100 : 0;
  const pctGlaz = qBase > 0 ? (qGlaz / qBase) * 100 : 0;
  const pctInfil = qBase > 0 ? (qInfil / qBase) * 100 : 0;

  // To prevent errors when mapping results in UI, we export zero for unused values 
  // that might still be conditionally mapped in the UI (although we'll clean UI too)
  const qRoof = 0, kwRoof = 0, pctRoof = 0;
  const qSlab = 0, kwSlab = 0, pctSlab = 0;
  const qVent = 0, kwVent = 0, pctVent = 0;

  return {
    deltaTF,
    deltaTC,
    perimeterFt,
    grossWallAreaFt2,
    netWallAreaFt2: Math.max(0, grossWallAreaFt2 - glazAreaVal),
    roofAreaFt2: areaVal,
    volumeFt3,
    qWall,
    qRoof,
    qGlaz,
    qSlab,
    qTotalCond,
    qInfil,
    qVent,
    qTotalAir,
    qBase,
    qTotal,
    kwBase,
    kwTotal,
    kwWall,
    kwRoof,
    kwGlaz,
    kwSlab,
    kwInfil,
    kwVent,
    loadDensityBtuPerSqft,
    loadDensityWPerSqm,
    pctWall,
    pctRoof,
    pctGlaz,
    pctSlab,
    pctInfil,
    pctVent,
  };
};
