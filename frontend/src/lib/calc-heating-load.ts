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
  ach: number | "",
  safetyMargin: number | "" = 15
) => {
  const areaVal = typeof area === "number" ? Math.max(0, area) : 5000;
  const heightVal = typeof height === "number" ? Math.max(0, height) : 10;
  const uWallVal = typeof uWall === "number" ? Math.max(0, uWall) : 0.065;
  const uGlazVal = typeof uGlaz === "number" ? Math.max(0, uGlaz) : 0.32;
  const glazAreaVal = typeof glazArea === "number" ? Math.max(0, glazArea) : 600;
  const oatVal = typeof oat === "number" ? oat : 20;
  const iatVal = typeof iat === "number" ? iat : 70;
  const achVal = typeof ach === "number" ? Math.max(0, ach) : 0.35;
  const sfVal = typeof safetyMargin === "number" ? Math.max(0, safetyMargin) : 15;

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
  
  // Total Equipment Sizing Capacity (including Safety Factor %)
  const qTotal = qBase * (1 + sfVal / 100);

  // Kilowatt Equivalents
  const kwBase = qBase * BTU_HR_TO_KW;
  const kwTotal = qTotal * BTU_HR_TO_KW;
  const kwWall = qWall * BTU_HR_TO_KW;
  const kwGlaz = qGlaz * BTU_HR_TO_KW;
  const kwInfil = qInfil * BTU_HR_TO_KW;
  const kwTotalAir = qTotalAir * BTU_HR_TO_KW;

  // Load Density Indices
  const loadDensityBtuPerSqft = areaVal > 0 ? qTotal / areaVal : 0;
  const loadDensityWPerSqm = (areaVal * SQFT_TO_SQM) > 0 ? (kwTotal * 1000) / (areaVal * SQFT_TO_SQM) : 0;

  // Percentage Breakdown
  const pctWall = qBase > 0 ? (qWall / qBase) * 100 : 0;
  const pctGlaz = qBase > 0 ? (qGlaz / qBase) * 100 : 0;
  const pctInfil = qBase > 0 ? (qInfil / qBase) * 100 : 0;

  // Export zero placeholders for unrendered fields
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
    kwTotalAir,
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

export type HeatingPresetKey =
  | "commercial_office"
  | "residential_house"
  | "educational_school"
  | "healthcare_clinic"
  | "retail_showroom"
  | "warehouse_storage"
  | "custom";

export interface HeatingPresetConfig {
  key: HeatingPresetKey;
  label: string;
  category: string;
  description: string;
  area: number; // sq ft
  height: number; // ft
  uWall: number; // BTU/hr·ft²·°F
  uRoof: number; // BTU/hr·ft²·°F
  uGlaz: number; // BTU/hr·ft²·°F
  glazArea: number; // sq ft
  oat: number; // °F (Outdoor design temp)
  iat: number; // °F (Indoor setpoint)
  ach: number; // Infiltration ACH
  ventCfm: number; // Ventilation fresh air CFM
  safetyMargin: number; // %
}

export const HEATING_PRESETS: Record<HeatingPresetKey, HeatingPresetConfig> = {
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office",
    category: "ASHRAE 90.1 / Office",
    description: "Multi-story commercial office building with insulated curtain wall and fresh air ventilation.",
    area: 5000,
    height: 10,
    uWall: 0.065,
    uRoof: 0.035,
    uGlaz: 0.32,
    glazArea: 600,
    oat: 20,
    iat: 70,
    ach: 0.35,
    ventCfm: 450,
    safetyMargin: 15,
  },
  residential_house: {
    key: "residential_house",
    label: "Residential Home / Villa",
    category: "IECC / Residential",
    description: "Modern single/multi-family residence with thermal double-glazed windows and insulated roof.",
    area: 2500,
    height: 9,
    uWall: 0.055,
    uRoof: 0.028,
    uGlaz: 0.30,
    glazArea: 350,
    oat: 15,
    iat: 68,
    ach: 0.45,
    ventCfm: 120,
    safetyMargin: 15,
  },
  educational_school: {
    key: "educational_school",
    label: "School / Classrooms",
    category: "ASHRAE 62.1 / School",
    description: "Educational facility with high outdoor air ventilation requirement for indoor air quality.",
    area: 8000,
    height: 12,
    uWall: 0.060,
    uRoof: 0.032,
    uGlaz: 0.35,
    glazArea: 900,
    oat: 25,
    iat: 72,
    ach: 0.50,
    ventCfm: 1200,
    safetyMargin: 20,
  },
  healthcare_clinic: {
    key: "healthcare_clinic",
    label: "Healthcare Clinic",
    category: "ASHRAE 170 / Health",
    description: "Outpatient clinical facility with continuous 100% fresh air ventilation and tight temperature control.",
    area: 4000,
    height: 10,
    uWall: 0.050,
    uRoof: 0.030,
    uGlaz: 0.28,
    glazArea: 400,
    oat: 20,
    iat: 72,
    ach: 0.60,
    ventCfm: 800,
    safetyMargin: 20,
  },
  retail_showroom: {
    key: "retail_showroom",
    label: "Retail Showroom",
    category: "Commercial / High Glazing",
    description: "Commercial retail shop or vehicle showroom with large storefront perimeter glazing.",
    area: 6000,
    height: 14,
    uWall: 0.070,
    uRoof: 0.040,
    uGlaz: 0.38,
    glazArea: 1800,
    oat: 25,
    iat: 70,
    ach: 0.40,
    ventCfm: 600,
    safetyMargin: 15,
  },
  warehouse_storage: {
    key: "warehouse_storage",
    label: "Warehouse / Storage",
    category: "Industrial / Low Infiltration",
    description: "High-ceiling storage facility or logistics center with basic envelope insulation and minimal glazing.",
    area: 15000,
    height: 20,
    uWall: 0.090,
    uRoof: 0.050,
    uGlaz: 0.45,
    glazArea: 300,
    oat: 20,
    iat: 60,
    ach: 0.25,
    ventCfm: 300,
    safetyMargin: 20,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined building geometries, envelope thermal properties, and climate criteria.",
    area: 5000,
    height: 10,
    uWall: 0.065,
    uRoof: 0.035,
    uGlaz: 0.32,
    glazArea: 600,
    oat: 20,
    iat: 70,
    ach: 0.35,
    ventCfm: 450,
    safetyMargin: 15,
  },
};

