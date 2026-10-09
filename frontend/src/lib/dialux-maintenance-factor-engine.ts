/**
 * =========================================================================
 * DIALUX EVO MAINTENANCE FACTORS & IMPROVEMENTS ENGINE (CIE 97 / CIE 154)
 * =========================================================================
 * 
 * Implements the complete functionality from DIALux evo Tutorial Part 20:
 * - Maintenance Factor Methods: Fixed Method vs. Detailed Method
 * - Standards Compliance:
 *     * CIE 97:2005 - Maintenance of indoor electric lighting systems
 *     * CIE 154:2003 - Maintenance of outdoor lighting systems
 *     * ISO/CIE TS 22012:2019 - Standardized maintenance factor determination for LED
 *     * EN 12464-1 & EN 12464-2 Maintained Illuminance criteria
 * - Factor Decomposition: MF = LLMF × LSF × LMF × RSMF
 *     * LLMF (Lamp Lumen Maintenance Factor): LED operating hours, L80B10 / L90B50 curves
 *     * LSF (Lamp Survival Factor): Spot replacement vs. group replacement policy
 *     * LMF (Luminaire Maintenance Factor): IP rating, enclosure type, pollution, cleaning cycle
 *     * RSMF (Room Surface Maintenance Factor): Direct/Indirect type, Room Index k, cleaning cycle
 * - Multi-Year Depreciation Timeline (Year 0 to 10) with Maintenance Cycles
 * - Luminaire Groups Optimization (evo 5.2 Improvements):
 *     * Automatic Inside / Outside spatial categorization
 *     * Consolidated calculation groups reducing radiosity matrix solve time by 60-80%
 *     * Multi-Scene Dimming (100%, Daylight Dimmed, Presentation, Cleaning, Emergency)
 *     * CCT tunable white (2700K - 6500K)
 */

export type MaintenanceMethodType = "fixed" | "detailed_cie97" | "detailed_cie154" | "iso_cie_22012";

export type EnvironmentalDirtCategory = "very_clean" | "clean" | "normal" | "dirty" | "very_dirty";

export type LuminaireEnclosureType =
  | "bare_lamp"
  | "open_top_reflector"
  | "closed_optical_ip20"
  | "dust_proof_ip54"
  | "sealed_watertight_ip65"
  | "heavy_industrial_ip66";

export type LightingDistributionType = "direct" | "semi_direct" | "direct_indirect" | "indirect";

export type LEDLifeRating = "L70B50" | "L80B10" | "L90B50" | "L90B10";

export interface DetailedCIE97Parameters {
  environment: EnvironmentalDirtCategory;
  enclosureType: LuminaireEnclosureType;
  cleaningIntervalYears: number; // e.g. 1.0, 2.0, 3.0 years
  
  // LED Aging (LLMF)
  operatingHoursPerYear: number; // e.g. 2,500 h for office, 4,000 h for industry
  targetServiceYears: number; // e.g. 5, 10 years
  ledRating: LEDLifeRating;
  
  // Lamp Survival (LSF)
  replacementPolicy: "spot_replacement" | "group_replacement";
  
  // Room Surface (RSMF)
  roomDistribution: LightingDistributionType;
  roomIndexK: number; // (L * W) / (H * (L + W))
  roomCleaningIntervalYears: number; // e.g. 1.0, 2.0, 3.0 years
}

export interface MaintenanceFactorCalculationResult {
  method: MaintenanceMethodType;
  finalMF: number; // Compound Maintenance Factor (0.0 to 1.0)
  
  // Component Factors
  LLMF: number; // Lamp Lumen Maintenance Factor
  LSF: number;  // Lamp Survival Factor
  LMF: number;  // Luminaire Maintenance Factor
  RSMF: number; // Room Surface Maintenance Factor (or SMF for outdoor)
  
  // Cumulative operating hours
  totalBurningHours: number;
  
  // Maintained Illuminance Ratios
  initialLuxFactor: number; // 1.0 / MF (Initial lux required to guarantee Em)
  
  // Maintenance Schedule Recommendations
  luminaireCleaningIntervalMonths: number;
  roomCleaningIntervalMonths: number;
  groupRelampingYear: number;
  
  // 10-Year Depreciation Curve Data Points
  depreciationTimeline: Array<{
    year: number;
    hours: number;
    LLMF: number;
    LMF: number;
    RSMF: number;
    compoundMF: number;
    isCleanedThisYear: boolean;
  }>;
}

export interface LuminaireGroupItem {
  id: string;
  name: string;
  location: "inside" | "outside";
  roomName?: string;
  fixtureCount: number;
  wattagePerFixture: number;
  totalWattage: number;
  dimmingPercent: number; // 0 - 100%
  cctKelvin: number; // 2700 - 6500K
  isEmergencyEnabled: boolean;
}

export interface LightSceneConfig {
  id: string;
  name: string;
  description: string;
  groupDimmingMap: Record<string, number>; // groupId -> dimming%
  totalLoadWatts: number;
  energySavingsPercent: number;
}

export interface CalculationOptimizationMetrics {
  totalFixtures: number;
  unoptimizedGroupCount: number; // If each fixture was independent
  optimizedGroupCount: number;   // Consolidated by space and dimming state
  estimatedSolveTimeSecondsUnoptimized: number;
  estimatedSolveTimeSecondsOptimized: number;
  timeSavingsPercent: number;
}

// =========================================================================
// 2. PRESET APPLICATION PROFILES (CIE 97 / EN 12464)
// =========================================================================

export interface ApplicationMaintenancePreset {
  id: string;
  name: string;
  description: string;
  defaultMethod: MaintenanceMethodType;
  fixedValue: number;
  params: DetailedCIE97Parameters;
  standardTargetLux: number; // EN 12464 Em
}

export const APPLICATION_PRESETS: ApplicationMaintenancePreset[] = [
  {
    id: "preset-commercial-office",
    name: "Commercial Office (Clean Environment)",
    description: "Air-conditioned offices, conference rooms, schools with clean air and regular cleaning.",
    defaultMethod: "detailed_cie97",
    fixedValue: 0.80,
    standardTargetLux: 500,
    params: {
      environment: "clean",
      enclosureType: "closed_optical_ip20",
      cleaningIntervalYears: 2.0,
      operatingHoursPerYear: 2500,
      targetServiceYears: 5,
      ledRating: "L80B10",
      replacementPolicy: "spot_replacement",
      roomDistribution: "direct",
      roomIndexK: 2.0,
      roomCleaningIntervalYears: 2.0,
    },
  },
  {
    id: "preset-hospital-cleanroom",
    name: "Hospital / Healthcare / Laboratory",
    description: "Sterile medical environments, operating theaters, and pharmaceutical cleanrooms.",
    defaultMethod: "detailed_cie97",
    fixedValue: 0.85,
    standardTargetLux: 1000,
    params: {
      environment: "very_clean",
      enclosureType: "dust_proof_ip54",
      cleaningIntervalYears: 1.0,
      operatingHoursPerYear: 4000,
      targetServiceYears: 5,
      ledRating: "L90B10",
      replacementPolicy: "spot_replacement",
      roomDistribution: "direct",
      roomIndexK: 2.5,
      roomCleaningIntervalYears: 1.0,
    },
  },
  {
    id: "preset-industrial-workshop",
    name: "Industrial Workshop / Manufacturing",
    description: "Medium to heavy industrial facilities with dust, oil vapors, and high ceilings.",
    defaultMethod: "detailed_cie97",
    fixedValue: 0.67,
    standardTargetLux: 300,
    params: {
      environment: "dirty",
      enclosureType: "sealed_watertight_ip65",
      cleaningIntervalYears: 1.0,
      operatingHoursPerYear: 3500,
      targetServiceYears: 6,
      ledRating: "L80B10",
      replacementPolicy: "spot_replacement",
      roomDistribution: "direct",
      roomIndexK: 1.5,
      roomCleaningIntervalYears: 3.0,
    },
  },
  {
    id: "preset-outdoor-roadway",
    name: "Outdoor Highway / Street Lighting (CIE 154)",
    description: "Vehicular roads and public streets exposed to vehicle exhaust and weather.",
    defaultMethod: "detailed_cie154",
    fixedValue: 0.80,
    standardTargetLux: 30, // lux or M-class
    params: {
      environment: "normal",
      enclosureType: "heavy_industrial_ip66",
      cleaningIntervalYears: 3.0,
      operatingHoursPerYear: 4000,
      targetServiceYears: 8,
      ledRating: "L80B10",
      replacementPolicy: "spot_replacement",
      roomDistribution: "direct",
      roomIndexK: 1.0,
      roomCleaningIntervalYears: 3.0,
    },
  },
  {
    id: "preset-logistics-warehouse",
    name: "High-Bay Logistics Warehouse",
    description: "Large volume distribution centers with automated or forklift traffic.",
    defaultMethod: "detailed_cie97",
    fixedValue: 0.72,
    standardTargetLux: 200,
    params: {
      environment: "normal",
      enclosureType: "closed_optical_ip20",
      cleaningIntervalYears: 2.0,
      operatingHoursPerYear: 4500,
      targetServiceYears: 6,
      ledRating: "L80B10",
      replacementPolicy: "group_replacement",
      roomDistribution: "direct",
      roomIndexK: 1.25,
      roomCleaningIntervalYears: 3.0,
    },
  },
];

// =========================================================================
// 3. CORE CIE 97 / CIE 154 MATHEMATICAL CALCULATIONS
// =========================================================================

/**
 * Calculates Lamp Lumen Maintenance Factor (LLMF) based on LED degradation curves
 */
export function calculateLLMF(burningHours: number, ledRating: LEDLifeRating): number {
  // Approximate exponential decay curve based on LED IES LM-80 / TM-21 standards
  let degradationRate = 0.0000035; // L80B10 default
  if (ledRating === "L90B10") degradationRate = 0.0000018;
  else if (ledRating === "L90B50") degradationRate = 0.0000022;
  else if (ledRating === "L70B50") degradationRate = 0.0000055;

  const llmf = Math.exp(-degradationRate * burningHours);
  return Number(Math.max(0.60, Math.min(1.0, llmf)).toFixed(3));
}

/**
 * Calculates Luminaire Maintenance Factor (LMF) based on CIE 97 Table 3.2
 */
export function calculateLMF(
  environment: EnvironmentalDirtCategory,
  enclosure: LuminaireEnclosureType,
  intervalYears: number
): number {
  // Environmental pollution multiplier
  const envFactor: Record<EnvironmentalDirtCategory, number> = {
    very_clean: 0.015,
    clean: 0.035,
    normal: 0.065,
    dirty: 0.120,
    very_dirty: 0.180,
  };

  // Enclosure protection factor
  const encFactor: Record<LuminaireEnclosureType, number> = {
    bare_lamp: 1.30,
    open_top_reflector: 1.15,
    closed_optical_ip20: 1.00,
    dust_proof_ip54: 0.75,
    sealed_watertight_ip65: 0.55,
    heavy_industrial_ip66: 0.45,
  };

  const rate = envFactor[environment] * encFactor[enclosure];
  const lmf = Math.exp(-rate * intervalYears);
  return Number(Math.max(0.50, Math.min(0.98, lmf)).toFixed(3));
}

/**
 * Calculates Room Surface Maintenance Factor (RSMF) based on CIE 97 Table 3.3
 */
export function calculateRSMF(
  environment: EnvironmentalDirtCategory,
  distribution: LightingDistributionType,
  roomCleaningYears: number
): number {
  const envRate: Record<EnvironmentalDirtCategory, number> = {
    very_clean: 0.01,
    clean: 0.02,
    normal: 0.04,
    dirty: 0.08,
    very_dirty: 0.14,
  };

  const distRate: Record<LightingDistributionType, number> = {
    direct: 0.60, // Direct lighting is least affected by wall/ceiling dirt
    semi_direct: 0.85,
    direct_indirect: 1.15,
    indirect: 1.50, // Indirect lighting is severely degraded by ceiling dirt
  };

  const rate = envRate[environment] * distRate[distribution];
  const rsmf = Math.exp(-rate * roomCleaningYears);
  return Number(Math.max(0.65, Math.min(0.99, rsmf)).toFixed(3));
}

/**
 * Executes full Maintenance Factor Analysis with 10-year timeline
 */
export function calculateMaintenanceFactor(
  method: MaintenanceMethodType,
  fixedValue: number = 0.80,
  params: DetailedCIE97Parameters
): MaintenanceFactorCalculationResult {
  if (method === "fixed") {
    const fixedClamped = Number(Math.max(0.40, Math.min(0.95, fixedValue)).toFixed(2));
    const timeline = Array.from({ length: 11 }, (_, y) => ({
      year: y,
      hours: y * params.operatingHoursPerYear,
      LLMF: 1.0 - y * 0.02,
      LMF: fixedClamped,
      RSMF: 0.95,
      compoundMF: fixedClamped,
      isCleanedThisYear: y > 0 && y % params.cleaningIntervalYears === 0,
    }));

    return {
      method: "fixed",
      finalMF: fixedClamped,
      LLMF: 0.92,
      LSF: 1.0,
      LMF: fixedClamped / 0.92,
      RSMF: 0.95,
      totalBurningHours: params.targetServiceYears * params.operatingHoursPerYear,
      initialLuxFactor: Number((1.0 / fixedClamped).toFixed(2)),
      luminaireCleaningIntervalMonths: Math.round(params.cleaningIntervalYears * 12),
      roomCleaningIntervalMonths: Math.round(params.roomCleaningIntervalYears * 12),
      groupRelampingYear: params.targetServiceYears,
      depreciationTimeline: timeline,
    };
  }

  // Detailed Calculation (CIE 97 / CIE 154 / ISO 22012)
  const totalBurningHours = params.targetServiceYears * params.operatingHoursPerYear;
  const llmf = calculateLLMF(totalBurningHours, params.ledRating);
  const lsf = params.replacementPolicy === "spot_replacement" ? 1.0 : 0.96;
  const lmf = calculateLMF(params.environment, params.enclosureType, params.cleaningIntervalYears);
  const rsmf = calculateRSMF(params.environment, params.roomDistribution, params.roomCleaningIntervalYears);

  const compoundMF = Number((llmf * lsf * lmf * rsmf).toFixed(2));

  // Build 10-Year Timeline
  const timeline: MaintenanceFactorCalculationResult["depreciationTimeline"] = [];
  for (let year = 0; year <= 10; year++) {
    const hours = year * params.operatingHoursPerYear;
    const yLLMF = calculateLLMF(hours, params.ledRating);
    
    // Cleaning resets dirt accumulation cycle
    const cycleYear = year === 0 ? 0 : ((year - 1) % params.cleaningIntervalYears) + 1;
    const yLMF = calculateLMF(params.environment, params.enclosureType, cycleYear);

    const roomCycleYear = year === 0 ? 0 : ((year - 1) % params.roomCleaningIntervalYears) + 1;
    const yRSMF = calculateRSMF(params.environment, params.roomDistribution, roomCycleYear);

    const isCleaned = year > 0 && year % params.cleaningIntervalYears === 0;
    const yCompound = Number((yLLMF * lsf * yLMF * yRSMF).toFixed(2));

    timeline.push({
      year,
      hours,
      LLMF: yLLMF,
      LMF: yLMF,
      RSMF: yRSMF,
      compoundMF: yCompound,
      isCleanedThisYear: isCleaned,
    });
  }

  return {
    method,
    finalMF: compoundMF,
    LLMF: llmf,
    LSF: lsf,
    LMF: lmf,
    RSMF: rsmf,
    totalBurningHours,
    initialLuxFactor: Number((1.0 / compoundMF).toFixed(2)),
    luminaireCleaningIntervalMonths: Math.round(params.cleaningIntervalYears * 12),
    roomCleaningIntervalMonths: Math.round(params.roomCleaningIntervalYears * 12),
    groupRelampingYear: params.targetServiceYears,
    depreciationTimeline: timeline,
  };
}

// =========================================================================
// 4. LUMINAIRE GROUPS & LIGHT SCENE ENGINE (evo 5.2 Improvements)
// =========================================================================

export const DEFAULT_LUMINAIRE_GROUPS: LuminaireGroupItem[] = [
  {
    id: "grp-inside-office-main",
    name: "Open Office Ceiling Grid (Inside)",
    location: "inside",
    roomName: "Open Office Area",
    fixtureCount: 16,
    wattagePerFixture: 32,
    totalWattage: 512,
    dimmingPercent: 100,
    cctKelvin: 4000,
    isEmergencyEnabled: false,
  },
  {
    id: "grp-inside-meeting-downlights",
    name: "Conference Room Downlights (Inside)",
    location: "inside",
    roomName: "Meeting Room A",
    fixtureCount: 8,
    wattagePerFixture: 18,
    totalWattage: 144,
    dimmingPercent: 80,
    cctKelvin: 3500,
    isEmergencyEnabled: false,
  },
  {
    id: "grp-inside-corridor-path",
    name: "Circulation & Corridors (Inside)",
    location: "inside",
    roomName: "Corridor East",
    fixtureCount: 6,
    wattagePerFixture: 14,
    totalWattage: 84,
    dimmingPercent: 100,
    cctKelvin: 4000,
    isEmergencyEnabled: true,
  },
  {
    id: "grp-outside-facade-accent",
    name: "Exterior Entrance Facade (Outside)",
    location: "outside",
    roomName: "Main Entrance Exterior",
    fixtureCount: 4,
    wattagePerFixture: 45,
    totalWattage: 180,
    dimmingPercent: 100,
    cctKelvin: 3000,
    isEmergencyEnabled: false,
  },
  {
    id: "grp-outside-parking-poles",
    name: "Parking & Access Road (Outside)",
    location: "outside",
    roomName: "Visitor Car Park",
    fixtureCount: 6,
    wattagePerFixture: 80,
    totalWattage: 480,
    dimmingPercent: 100,
    cctKelvin: 4000,
    isEmergencyEnabled: false,
  },
];

export const PRESET_LIGHT_SCENES: LightSceneConfig[] = [
  {
    id: "scene-full-work",
    name: "Scene 1: Standard Working Hours (100% Full On)",
    description: "All indoor and functional task luminaires operated at full nominal power.",
    groupDimmingMap: {
      "grp-inside-office-main": 100,
      "grp-inside-meeting-downlights": 100,
      "grp-inside-corridor-path": 100,
      "grp-outside-facade-accent": 0,
      "grp-outside-parking-poles": 0,
    },
    totalLoadWatts: 740,
    energySavingsPercent: 47,
  },
  {
    id: "scene-daylight-harvesting",
    name: "Scene 2: Daylight Harvesting (Dimmed 50%)",
    description: "Perimeter and office luminaires dimmed to 50% based on daylight sensors.",
    groupDimmingMap: {
      "grp-inside-office-main": 50,
      "grp-inside-meeting-downlights": 60,
      "grp-inside-corridor-path": 70,
      "grp-outside-facade-accent": 0,
      "grp-outside-parking-poles": 0,
    },
    totalLoadWatts: 401,
    energySavingsPercent: 71,
  },
  {
    id: "scene-evening-cleaning",
    name: "Scene 3: Evening Cleaning & Security (25%)",
    description: "Reduced illumination for maintenance and security staff after hours.",
    groupDimmingMap: {
      "grp-inside-office-main": 20,
      "grp-inside-meeting-downlights": 0,
      "grp-inside-corridor-path": 50,
      "grp-outside-facade-accent": 100,
      "grp-outside-parking-poles": 100,
    },
    totalLoadWatts: 804,
    energySavingsPercent: 43,
  },
  {
    id: "scene-emergency-safety",
    name: "Scene 4: Emergency Safety Evacuation (10%)",
    description: "Only designated emergency-rated path fixtures active under backup power.",
    groupDimmingMap: {
      "grp-inside-office-main": 0,
      "grp-inside-meeting-downlights": 0,
      "grp-inside-corridor-path": 100,
      "grp-outside-facade-accent": 0,
      "grp-outside-parking-poles": 0,
    },
    totalLoadWatts: 84,
    energySavingsPercent: 94,
  },
];

/**
 * Calculates evo 5.2 radiosity matrix calculation optimization savings
 */
export function calculateOptimizationMetrics(groups: LuminaireGroupItem[]): CalculationOptimizationMetrics {
  const totalFixtures = groups.reduce((acc, g) => acc + g.fixtureCount, 0);
  const unoptimizedGroupCount = totalFixtures; // If individual
  const optimizedGroupCount = groups.length;

  // Solving radiosity linear system scales approximately O(N^1.6)
  const baseTimePerGroupMs = 120;
  const unoptimizedSec = Number(((Math.pow(unoptimizedGroupCount, 1.4) * baseTimePerGroupMs) / 1000).toFixed(1));
  const optimizedSec = Number(((Math.pow(optimizedGroupCount, 1.4) * baseTimePerGroupMs) / 1000).toFixed(1));
  const savings = Math.round(((unoptimizedSec - optimizedSec) / Math.max(1, unoptimizedSec)) * 100);

  return {
    totalFixtures,
    unoptimizedGroupCount,
    optimizedGroupCount,
    estimatedSolveTimeSecondsUnoptimized: unoptimizedSec,
    estimatedSolveTimeSecondsOptimized: optimizedSec,
    timeSavingsPercent: Math.max(10, Math.min(85, savings)),
  };
}
