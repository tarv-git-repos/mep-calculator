/**
 * =========================================================================
 * DIALUX EVO STANDARDS & NORM CONTROL CENTRE ENGINE (TUTORIAL PART 26)
 * =========================================================================
 * 
 * Implements the complete Standards Management & Norm Control Centre System
 * from DIALux evo Tutorial Part 26 ("Using different standards"):
 * 
 * 1. STANDARDS REPOSITORY:
 *    - DIN EN 12464-1:2021 (Indoor workplaces - Europe & International)
 *    - DIN EN 12464-2:2014 (Outdoor workplaces - Europe & International)
 *    - IES / ANSI / IESNA RP-8 & RP-1 (North America - Footcandles & Uniformity)
 *    - AS/NZS 1680.1 / 1680.2 (Australia & New Zealand)
 *    - CIBSE SLL Code for Lighting / LG7 (United Kingdom)
 *    - JIS C 7612 / JIS C 8105 (Japan Industrial Standards)
 *    - DIN 5035 (Germany Industrial Standard)
 *    - ABNT NBR ISO/CIE 8995-1 (Brazil / Latin America)
 * 
 * 2. PROFILE DUPLICATION & CUSTOMIZATION:
 *    - Default standards are protected (read-only) for regulatory compliance integrity.
 *    - Users can duplicate templates to create custom company/project profiles.
 *    - Full customization of Em, U0 / U1, UGR / GR / VCP, CRI Ra, Ez, wall margin, etc.
 * 
 * 3. MULTI-STANDARD COMPARISON MATRIX:
 *    - Cross-evaluate identical space geometries and photometric layouts
 *      under multiple standards simultaneously.
 * 
 * 4. PROJECT SCOPE & SPACE OVERRIDES:
 *    - Project-wide governing standard with per-space override capabilities.
 */

export type StandardRegionCode =
  | "EU_INT" // Europe / International (EN 12464)
  | "US_NA"  // North America (IES / ANSI)
  | "AU_NZ"  // Australia / New Zealand (AS/NZS 1680)
  | "UK"     // United Kingdom (CIBSE)
  | "JP"     // Japan (JIS C 7612)
  | "DE"     // Germany (DIN 5035)
  | "BR_LAT" // Latin America (ABNT NBR);

export type GlareMetricType = "UGR" | "GR" | "VCP" | "DGI" | "CIE_GLARE";

export type UniformityMetricType =
  | "U0_MIN_AVG" // E_min / E_avg (EN 12464, AS/NZS)
  | "U1_MIN_MAX" // E_min / E_max
  | "MAX_MIN"    // E_max / E_min (IESNA)
  | "AVG_MIN";   // E_avg / E_min (IESNA)

export interface LightingStandardDefinition {
  id: string;
  name: string;
  shortName: string;
  region: StandardRegionCode;
  organization: string;
  currentEdition: string;
  illuminanceUnit: "lux" | "footcandle";
  defaultUniformityMetric: UniformityMetricType;
  defaultGlareMetric: GlareMetricType;
  description: string;
  isInternational: boolean;
}

export interface StandardProfile {
  id: string;
  standardId: string;
  spaceType: string;
  name: string;
  environment: "interior" | "exterior";
  isProtected: boolean; // default standards are protected, custom duplicates are editable
  isCustom: boolean;

  // Photometric Target Requirements
  targetMaintainedLux: number; // in Lux (converts to fc for US display)
  minUniformityValue: number; // value depending on metric
  uniformityMetric: UniformityMetricType;
  maxGlareValue: number; // max UGR or max GR or min VCP
  glareMetric: GlareMetricType;
  minCRI: number; // Color rendering Ra

  // Geometry & Surface Defaults
  defaultWorkplaneHeightM: number;
  defaultWallMarginM: number;
  reflectanceCeiling: number; // 0.0 - 1.0 (e.g. 0.70)
  reflectanceWalls: number;   // 0.0 - 1.0 (e.g. 0.50)
  reflectanceFloor: number;   // 0.0 - 1.0 (e.g. 0.20)

  // Advanced EN 12464 Criteria
  minCylindricalEzLux?: number;
  minWallIlluminanceLux?: number;
  minCeilingIlluminanceLux?: number;
  defaultMaintenanceFactor: number;

  notes: string;
}

export interface RoomPhotometricData {
  lengthM: number;
  widthM: number;
  heightM: number;
  calculatedAvgLux: number;
  calculatedMinLux: number;
  calculatedMaxLux: number;
  calculatedUGR: number;
  calculatedGR?: number;
  calculatedCRI: number;
  calculatedWallAvgLux?: number;
  calculatedCeilingAvgLux?: number;
  calculatedCylindricalEz?: number;
}

export interface StandardComplianceReport {
  standardId: string;
  standardName: string;
  profileId: string;
  profileName: string;
  isLuxMet: boolean;
  isUniformityMet: boolean;
  isGlareMet: boolean;
  isCRIMet: boolean;
  isWallCeilingMet: boolean;
  isCompliant: boolean;
  illuminanceScorePct: number;
  details: {
    targetLux: number;
    actualLux: number;
    requiredUniformity: string;
    actualUniformity: string;
    requiredGlare: string;
    actualGlare: string;
    requiredCRI: number;
    actualCRI: number;
  };
}

// =========================================================================
// 1. BUILT-IN STANDARDS REPOSITORY
// =========================================================================

export const LIGHTING_STANDARDS: Record<string, LightingStandardDefinition> = {
  "EN_12464_1": {
    id: "EN_12464_1",
    name: "DIN EN 12464-1:2021 — Light and lighting of indoor workplaces",
    shortName: "EN 12464-1 (Europe)",
    region: "EU_INT",
    organization: "CEN (European Committee for Standardization)",
    currentEdition: "2021-08",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "Standard for indoor workplaces throughout the European Union and recognized internationally.",
    isInternational: true,
  },
  "EN_12464_2": {
    id: "EN_12464_2",
    name: "DIN EN 12464-2:2014 — Light and lighting of outdoor workplaces",
    shortName: "EN 12464-2 (Europe Outdoor)",
    region: "EU_INT",
    organization: "CEN",
    currentEdition: "2014-05",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "GR",
    description: "Governing standard for exterior workspaces including parking lots, pedestrian pathways, and loading docks.",
    isInternational: true,
  },
  "IES_RP_8_RP_1": {
    id: "IES_RP_8_RP_1",
    name: "IES / ANSI RP-8 & RP-1 — Recommended Practices for Office & Commercial Lighting",
    shortName: "IESNA / ANSI (North America)",
    region: "US_NA",
    organization: "Illuminating Engineering Society of North America (IES)",
    currentEdition: "ANSI/IES RP-1-20 / RP-8-21",
    illuminanceUnit: "footcandle",
    defaultUniformityMetric: "AVG_MIN",
    defaultGlareMetric: "VCP",
    description: "North American national lighting design standard using footcandles (1 fc ≈ 10.764 lx) and Avg/Min uniformity ratios.",
    isInternational: false,
  },
  "AS_NZS_1680": {
    id: "AS_NZS_1680",
    name: "AS/NZS 1680.1 & 1680.2 — Interior and workplace lighting",
    shortName: "AS/NZS 1680 (Australia & NZ)",
    region: "AU_NZ",
    organization: "Standards Australia / Standards New Zealand",
    currentEdition: "2006 (R2016)",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "Joint Australian and New Zealand standard for workplace lighting tasks, visual ergonomics, and maintenance factors.",
    isInternational: false,
  },
  "CIBSE_LG7": {
    id: "CIBSE_LG7",
    name: "CIBSE SLL Lighting Guide 7: Offices & Code for Lighting",
    shortName: "CIBSE SLL / LG7 (UK)",
    region: "UK",
    organization: "Chartered Institution of Building Services Engineers (CIBSE / SLL)",
    currentEdition: "LG07: 2023",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "British standard emphasizing task area, wall and ceiling illuminance ratios for visual balance and wellbeing.",
    isInternational: false,
  },
  "JIS_C_7612": {
    id: "JIS_C_7612",
    name: "JIS C 7612:2020 — Illuminance measurements and indoor workplace standards",
    shortName: "JIS C 7612 (Japan)",
    region: "JP",
    organization: "Japanese Standards Association (JSA)",
    currentEdition: "2020-03",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "Japanese Industrial Standard specifying illuminance classifications (Class A high precision, Class B, Class C).",
    isInternational: false,
  },
  "DIN_5035": {
    id: "DIN_5035",
    name: "DIN 5035-3 / 5035-7 — Beleuchtung mit künstlichem Licht in Arbeitsstätten",
    shortName: "DIN 5035 (Germany)",
    region: "DE",
    organization: "Deutsches Institut für Normung (DIN)",
    currentEdition: "2020",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "German national workplace lighting standard, historically foundational to CEN European standards.",
    isInternational: false,
  },
  "ABNT_NBR_8995": {
    id: "ABNT_NBR_8995",
    name: "ABNT NBR ISO/CIE 8995-1 — Iluminação de ambientes de trabalho (Parte 1: Interior)",
    shortName: "ABNT NBR 8995 (Brazil)",
    region: "BR_LAT",
    organization: "Associação Brasileira de Normas Técnicas (ABNT)",
    currentEdition: "2013 (Conf. 2021)",
    illuminanceUnit: "lux",
    defaultUniformityMetric: "U0_MIN_AVG",
    defaultGlareMetric: "UGR",
    description: "Brazilian national standard harmonized with ISO/CIE 8995 for indoor workplace environments.",
    isInternational: false,
  },
};

// =========================================================================
// 2. STANDARD APPLICATION PROFILES REPOSITORY
// =========================================================================

export const BUILTIN_PROFILES: StandardProfile[] = [
  // 1. EN 12464-1: OFFICE
  {
    id: "en_office_general",
    standardId: "EN_12464_1",
    spaceType: "office",
    name: "Office — Writing, typing, reading data (EN 12464-1)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 500,
    minUniformityValue: 0.60,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.80,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    minCylindricalEzLux: 150,
    minWallIlluminanceLux: 150,
    minCeilingIlluminanceLux: 100,
    defaultMaintenanceFactor: 0.80,
    notes: "Normative reference EN 12464-1:2021 Clause 5.3 Tab 5.26.",
  },

  // 2. EN 12464-1: CONFERENCE & MEETING ROOM
  {
    id: "en_conference_room",
    standardId: "EN_12464_1",
    spaceType: "conference",
    name: "Conference & Meeting Rooms (EN 12464-1)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 500,
    minUniformityValue: 0.60,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.75,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    minCylindricalEzLux: 150,
    defaultMaintenanceFactor: 0.80,
    notes: "Requires good visual contact and facial modeling (Ez >= 150 lx).",
  },

  // 3. EN 12464-1: CORRIDORS & CIRCULATION
  {
    id: "en_corridor_circulation",
    standardId: "EN_12464_1",
    spaceType: "corridor",
    name: "Corridors & Circulation Areas (EN 12464-1)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 100,
    minUniformityValue: 0.40,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 28,
    glareMetric: "UGR",
    minCRI: 40,
    defaultWorkplaneHeightM: 0.00,
    defaultWallMarginM: 0.20,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    defaultMaintenanceFactor: 0.80,
    notes: "Floor level evaluation for safe personnel transit.",
  },

  // 4. EN 12464-1: CLASSROOMS & EDUCATION
  {
    id: "en_classroom_education",
    standardId: "EN_12464_1",
    spaceType: "classroom",
    name: "Classrooms & Educational Auditoriums (EN 12464-1)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 500,
    minUniformityValue: 0.60,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.75,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    minWallIlluminanceLux: 150,
    minCeilingIlluminanceLux: 100,
    defaultMaintenanceFactor: 0.80,
    notes: "Blackboard/whiteboard task plane requires separate vertical 500 lx evaluation.",
  },

  // 5. EN 12464-2: EXTERIOR CAR PARK
  {
    id: "en_parking_outdoor",
    standardId: "EN_12464_2",
    spaceType: "parking",
    name: "Outdoor Parking Areas — Medium/Busy (EN 12464-2)",
    environment: "exterior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 20,
    minUniformityValue: 0.40,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 50,
    glareMetric: "GR",
    minCRI: 20,
    defaultWorkplaneHeightM: 0.00,
    defaultWallMarginM: 0.00,
    reflectanceCeiling: 0.00,
    reflectanceWalls: 0.00,
    reflectanceFloor: 0.15,
    defaultMaintenanceFactor: 0.70,
    notes: "Evaluation zone placed on exterior ground surface per EN 12464-2 Tab 5.9.",
  },

  // 6. IESNA RP-1: NORTH AMERICAN OFFICE
  {
    id: "ies_office_general",
    standardId: "IES_RP_8_RP_1",
    spaceType: "office",
    name: "Office — Computer & Paper Tasks (IES RP-1)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 430, // ~40 footcandles
    minUniformityValue: 2.50, // Avg/Min <= 2.5
    uniformityMetric: "AVG_MIN",
    maxGlareValue: 70, // VCP >= 70%
    glareMetric: "VCP",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.76, // 30 inches = 0.762m
    defaultWallMarginM: 0.60, // 2 feet = 0.609m
    reflectanceCeiling: 0.80,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    defaultMaintenanceFactor: 0.85,
    notes: "ANSI/IES RP-1 Recommended Practice. Target: 40 fc, Avg/Min <= 2.5:1.",
  },

  // 7. IESNA RP-8: NORTH AMERICAN PARKING LOT
  {
    id: "ies_parking_lot",
    standardId: "IES_RP_8_RP_1",
    spaceType: "parking",
    name: "Parking Facility — Open Surface Lot (IES RP-8)",
    environment: "exterior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 25, // ~2.4 footcandles
    minUniformityValue: 4.00, // Max/Min <= 4:1
    uniformityMetric: "MAX_MIN",
    maxGlareValue: 50,
    glareMetric: "GR",
    minCRI: 65,
    defaultWorkplaneHeightM: 0.00,
    defaultWallMarginM: 0.00,
    reflectanceCeiling: 0.00,
    reflectanceWalls: 0.00,
    reflectanceFloor: 0.12,
    defaultMaintenanceFactor: 0.70,
    notes: "IES RP-8-21 outdoor security and vehicle navigation standard.",
  },

  // 8. AS/NZS 1680.1: AUSTRALIA OFFICE
  {
    id: "asnzs_office_general",
    standardId: "AS_NZS_1680",
    spaceType: "office",
    name: "General Offices — Reading, writing & typing (AS/NZS 1680)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 400,
    minUniformityValue: 0.50,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.75,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    defaultMaintenanceFactor: 0.80,
    notes: "AS/NZS 1680.1 Table 3.1. Requires minimum 400 lx maintained at desk height.",
  },

  // 9. CIBSE SLL LG7: BRITISH OFFICE WITH WALL & CEILING RATIOS
  {
    id: "cibse_office_lg7",
    standardId: "CIBSE_LG7",
    spaceType: "office",
    name: "Offices — Visual Environment & LG7 Compliance (CIBSE SLL)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 500,
    minUniformityValue: 0.60,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.80,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    minCylindricalEzLux: 150,
    minWallIlluminanceLux: 175, // CIBSE LG7 emphasizes bright walls (35% of task)
    minCeilingIlluminanceLux: 125, // CIBSE LG7 emphasizes bright ceilings (25% of task)
    defaultMaintenanceFactor: 0.80,
    notes: "CIBSE LG7 requires strict wall (min 175 lx) and ceiling (min 125 lx) illuminance.",
  },

  // 10. JIS C 7612: JAPANESE INDUSTRIAL CLASS A OFFICE
  {
    id: "jis_office_class_a",
    standardId: "JIS_C_7612",
    spaceType: "office",
    name: "Office — High Precision Business Work Class A (JIS C 7612)",
    environment: "interior",
    isProtected: true,
    isCustom: false,
    targetMaintainedLux: 750,
    minUniformityValue: 0.60,
    uniformityMetric: "U0_MIN_AVG",
    maxGlareValue: 19,
    glareMetric: "UGR",
    minCRI: 80,
    defaultWorkplaneHeightM: 0.80,
    defaultWallMarginM: 0.50,
    reflectanceCeiling: 0.70,
    reflectanceWalls: 0.50,
    reflectanceFloor: 0.20,
    defaultMaintenanceFactor: 0.80,
    notes: "JIS standard Class A recommends 750 lux for high-density reading and VDT tasks.",
  },
];

// =========================================================================
// 3. CORE LOGIC FUNCTIONS
// =========================================================================

/**
 * Creates an editable duplicate of a standard profile.
 */
export function duplicateStandardProfile(
  source: StandardProfile,
  customName?: string
): StandardProfile {
  const newId = `custom_prof_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  return {
    ...source,
    id: newId,
    name: customName || `Copy of ${source.name}`,
    isProtected: false,
    isCustom: true,
    notes: `Custom user-defined profile based on template [${source.name}]. Created ${new Date().toLocaleDateString()}.`,
  };
}

/**
 * Solves compliance against a specific standard profile.
 */
export function evaluateStandardCompliance(
  data: RoomPhotometricData,
  profile: StandardProfile
): StandardComplianceReport {
  const std = LIGHTING_STANDARDS[profile.standardId] || LIGHTING_STANDARDS["EN_12464_1"];

  // 1. Illuminance check
  const isLuxMet = data.calculatedAvgLux >= profile.targetMaintainedLux;
  const luxRatio = profile.targetMaintainedLux > 0 ? data.calculatedAvgLux / profile.targetMaintainedLux : 1;

  // 2. Uniformity check
  let isUniformityMet = false;
  let requiredUniformityStr = "";
  let actualUniformityStr = "";

  if (profile.uniformityMetric === "U0_MIN_AVG") {
    const actualU0 = data.calculatedAvgLux > 0 ? data.calculatedMinLux / data.calculatedAvgLux : 0;
    isUniformityMet = actualU0 >= profile.minUniformityValue;
    requiredUniformityStr = `U0 ≥ ${profile.minUniformityValue}`;
    actualUniformityStr = `U0 = ${actualU0.toFixed(2)}`;
  } else if (profile.uniformityMetric === "AVG_MIN") {
    const actualAvgMin = data.calculatedMinLux > 0 ? data.calculatedAvgLux / data.calculatedMinLux : 999;
    isUniformityMet = actualAvgMin <= profile.minUniformityValue;
    requiredUniformityStr = `Avg/Min ≤ ${profile.minUniformityValue}:1`;
    actualUniformityStr = `Avg/Min = ${actualAvgMin.toFixed(2)}:1`;
  } else if (profile.uniformityMetric === "MAX_MIN") {
    const actualMaxMin = data.calculatedMinLux > 0 ? data.calculatedMaxLux / data.calculatedMinLux : 999;
    isUniformityMet = actualMaxMin <= profile.minUniformityValue;
    requiredUniformityStr = `Max/Min ≤ ${profile.minUniformityValue}:1`;
    actualUniformityStr = `Max/Min = ${actualMaxMin.toFixed(2)}:1`;
  } else {
    const actualU1 = data.calculatedMaxLux > 0 ? data.calculatedMinLux / data.calculatedMaxLux : 0;
    isUniformityMet = actualU1 >= profile.minUniformityValue;
    requiredUniformityStr = `U1 ≥ ${profile.minUniformityValue}`;
    actualUniformityStr = `U1 = ${actualU1.toFixed(2)}`;
  }

  // 3. Glare check
  let isGlareMet = true;
  let reqGlareStr = "";
  let actGlareStr = "";

  if (profile.glareMetric === "UGR") {
    isGlareMet = data.calculatedUGR <= profile.maxGlareValue;
    reqGlareStr = `UGR ≤ ${profile.maxGlareValue}`;
    actGlareStr = `UGR = ${data.calculatedUGR.toFixed(1)}`;
  } else if (profile.glareMetric === "GR") {
    const actualGR = data.calculatedGR ?? 42;
    isGlareMet = actualGR <= profile.maxGlareValue;
    reqGlareStr = `GR ≤ ${profile.maxGlareValue}`;
    actGlareStr = `GR = ${actualGR.toFixed(1)}`;
  } else if (profile.glareMetric === "VCP") {
    // VCP: higher is better (e.g. >= 70%)
    const estVCP = Math.max(50, Math.min(95, 100 - (data.calculatedUGR - 10) * 3));
    isGlareMet = estVCP >= profile.maxGlareValue;
    reqGlareStr = `VCP ≥ ${profile.maxGlareValue}%`;
    actGlareStr = `VCP ≈ ${estVCP.toFixed(0)}%`;
  }

  // 4. CRI check
  const isCRIMet = data.calculatedCRI >= profile.minCRI;

  // 5. Wall & Ceiling check
  let isWallCeilingMet = true;
  if (profile.minWallIlluminanceLux && data.calculatedWallAvgLux) {
    if (data.calculatedWallAvgLux < profile.minWallIlluminanceLux) {
      isWallCeilingMet = false;
    }
  }
  if (profile.minCeilingIlluminanceLux && data.calculatedCeilingAvgLux) {
    if (data.calculatedCeilingAvgLux < profile.minCeilingIlluminanceLux) {
      isWallCeilingMet = false;
    }
  }

  const isCompliant = isLuxMet && isUniformityMet && isGlareMet && isCRIMet && isWallCeilingMet;

  return {
    standardId: profile.standardId,
    standardName: std.name,
    profileId: profile.id,
    profileName: profile.name,
    isLuxMet,
    isUniformityMet,
    isGlareMet,
    isCRIMet,
    isWallCeilingMet,
    isCompliant,
    illuminanceScorePct: Math.min(100, Math.round(luxRatio * 100)),
    details: {
      targetLux: profile.targetMaintainedLux,
      actualLux: Math.round(data.calculatedAvgLux),
      requiredUniformity: requiredUniformityStr,
      actualUniformity: actualUniformityStr,
      requiredGlare: reqGlareStr,
      actualGlare: actGlareStr,
      requiredCRI: profile.minCRI,
      actualCRI: data.calculatedCRI,
    },
  };
}

/**
 * Multi-Standard Cross-Check:
 * Evaluates the space against all available standards matching the space type.
 */
export function crossCompareAllStandards(
  data: RoomPhotometricData,
  spaceType: string,
  profilesList: StandardProfile[]
): StandardComplianceReport[] {
  const matching = profilesList.filter((p) => p.spaceType === spaceType);
  return matching.map((prof) => evaluateStandardCompliance(data, prof));
}

/**
 * Converts lux to footcandles or vice versa.
 */
export function luxToFootcandle(lux: number): number {
  return Math.round((lux / 10.7639) * 10) / 10;
}

export function footcandleToLux(fc: number): number {
  return Math.round(fc * 10.7639);
}
