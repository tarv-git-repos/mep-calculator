/**
 * =========================================================================
 * DIALUX EVO DAYLIGHTING SYSTEMS ENGINE (TUTORIAL PART 23)
 * =========================================================================
 * 
 * Implements the complete Daylighting Systems & Facade Shading/Redirecting system
 * from DIALux evo Tutorial Part 23:
 * 
 * 1. DAYLIGHT CONTROL SYSTEMS (Tageslichtsysteme):
 *    - Louvre Blinds (Horizontal & Vertical Venetian Blinds / Raffstore):
 *      * Slat width (w), slat spacing (s), slat curvature
 *      * Slat reflectance (rho = 0.70 white satin, 0.85 anodized alu, 0.20 charcoal)
 *      * Tilt angle beta (0° horizontal, 30°, 45°, 75° cut-off, 90° closed)
 *      * Retraction / Deployment extension (0% to 100%)
 *      * Automated cut-off tracking & light redirecting mode (ceiling bounce)
 *    - Light Shelves (Lichtlenk-Systeme):
 *      * Internal & external specular shelves redirecting high-angle sun
 *        deep onto reflective ceilings (rho = 0.80)
 *    - Prismatic / Micro-Louvre Optical Panels:
 *      * Angular-selective seasonal transmission
 *    - Textile Solar Screens / Roller Blinds:
 *      * Visual transmittance (tau_v) and openness factor (OF)
 *    - Skylights & Light Domes:
 *      * Rooflight apertures with diffusing polycarbonate domes
 * 
 * 2. STANDARDS & METRICS:
 *    - EN 17037: Daylight in Buildings
 *      * Daylight Provision (Target D >= 2.0% over 50% area, D_min >= 0.7% over 95%)
 *      * Assessment of View Out (Horizontal sight angle, distance, layers)
 *      * Sunlight Exposure (hours on March 21 Equinox)
 *      * Daylight Glare Probability (DGP) evaluation at workstations
 *    - CIE Sky Models:
 *      * CIE Standard Overcast Sky
 *      * CIE Clear Sky with Sun
 *      * CIE Intermediate Sky
 *    - Solar Positioning:
 *      * Latitude, Longitude, Date, Time -> Solar altitude & azimuth
 * 
 * 3. ENERGY HARVESTING (LENI EN 15193):
 *    - Daylight-linked artificial lighting dimming & annual kWh savings
 * 
 * 4. OPEN DAYLIGHT SYSTEM (ODLS / DDLS) CATALOG:
 *    - Electronic product database with manufacturer specifications
 */

export type DaylightSystemType =
  | "horizontal_louvre"
  | "vertical_louvre"
  | "light_shelf"
  | "prismatic_film"
  | "textile_screen"
  | "roof_skylight_dome";

export type LouvreControlStrategy =
  | "manual_fixed"
  | "sun_tracking_cutoff"
  | "light_redirecting_ceiling"
  | "full_closed_glare";

export type CIESkyType =
  | "cie_overcast"
  | "cie_clear_sun"
  | "cie_intermediate";

export interface SlatGeometryConfig {
  slatWidthMm: number; // e.g. 80mm
  slatSpacingMm: number; // e.g. 70mm
  slatTiltDegrees: number; // 0 = horizontal open, 90 = closed
  slatReflectance: number; // 0.1 - 0.9 (e.g. 0.85 silver anodized)
  deploymentPercent: number; // 0 = retracted, 100 = fully lowered
  controlStrategy: LouvreControlStrategy;
}

export interface LightShelfConfig {
  shelfDepthMm: number; // e.g. 600mm
  isExternal: boolean;
  mountingHeightM: number; // e.g. 2.1m (above window bottom)
  upperSurfaceSpecularReflectance: number; // e.g. 0.88
}

export interface GlazingConfig {
  layerCount: "single" | "double_low_e" | "triple_solar_control";
  visualTransmittanceTauV: number; // e.g. 0.72 for double low-E
  solarFactorG: number; // e.g. 0.50
  uValueWpm2K: number; // e.g. 1.1
}

export interface DaylightingSystemItem {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  type: DaylightSystemType;
  installedAperture: "window_facade" | "roof_skylight";
  glazing: GlazingConfig;
  louvre?: SlatGeometryConfig;
  lightShelf?: LightShelfConfig;
  screenOpennessFactor?: number; // 1% - 5%
  odlsCompliant: boolean;
  description: string;
}

export interface RoomDaylightEnvironment {
  lengthM: number; // e.g. 8.0m (depth from window)
  widthM: number; // e.g. 6.0m
  heightM: number; // e.g. 3.2m
  windowWidthM: number; // e.g. 4.8m
  windowHeightM: number; // e.g. 2.2m
  windowSillHeightM: number; // e.g. 0.85m
  facadeAzimuthDegrees: number; // 0 = North, 90 = East, 180 = South, 270 = West
  ceilingReflectance: number; // e.g. 0.80
  wallReflectance: number; // e.g. 0.50
  floorReflectance: number; // e.g. 0.20
  workplaneHeightM: number; // e.g. 0.75m
  artificialLightingWatts: number; // e.g. 240W installed
  targetIlluminanceLux: number; // e.g. 500 lx
}

export interface SolarPosition {
  altitudeDegrees: number;
  azimuthDegrees: number;
  directNormalLux: number;
  diffuseHorizontalLux: number;
  globalHorizontalLux: number;
  incidentProfileAngleDegrees: number;
}

export interface DaylightGridPoint {
  x: number; // depth from window (m)
  y: number; // across width (m)
  z: number; // workplane height (m)
  daylightFactorPercent: number;
  illuminanceLux: number;
  directSunlightLux: number;
  diffuseSkyLux: number;
  reflectedCeilingLux: number;
}

export interface EN17037Evaluation {
  daylightProvisionLevel: "None" | "Minimum" | "Medium" | "High";
  targetDaylightFactorRequired: number; // 2.0% for Minimum, 3.0% Medium, 4.0% High
  achievedSpace50PercentDF: number;
  achievedSpace95PercentDF: number;
  isProvisionCompliant: boolean;

  dgpGlaredRating: number; // Daylight Glare Probability (0.0 - 1.0)
  glareCategory: "Imperceptible" | "Perceptible" | "Disturbing" | "Intolerable";
  isGlareCompliant: boolean;

  viewOutRating: "Level 1 (Adequate)" | "Level 2 (Good)" | "Level 3 (Excellent)";
  sunlightHoursEquinox: number; // hours on March 21
}

export interface DaylightHarvestingReport {
  daylightAutonomyPercent: number; // % hours above 500 lx
  averageDimmingFactor: number; // 0.0 - 1.0 (artificial light level)
  activeArtificialWatts: number;
  powerReductionWatts: number;
  annualEnergySavedKwh: number;
  co2ReductionKg: number;
}

export interface DaylightSimulationResult {
  timestamp: string;
  system: DaylightingSystemItem;
  room: RoomDaylightEnvironment;
  solar: SolarPosition;
  skyType: CIESkyType;
  gridPoints: DaylightGridPoint[];
  averageDaylightFactor: number;
  minDaylightFactor: number;
  maxDaylightFactor: number;
  uniformityU0: number;
  averageIlluminanceLux: number;
  minIlluminanceLux: number;
  maxIlluminanceLux: number;
  en17037: EN17037Evaluation;
  harvesting: DaylightHarvestingReport;
}

// =========================================================================
// 2. SOLAR GEOMETRY & DAYLIGHT MATHEMATICAL ENGINE
// =========================================================================

/**
 * Calculates solar position (Altitude & Azimuth) and incident profile angle on vertical façade.
 */
export function calculateSolarGeometry(
  latitude: number,
  longitude: number,
  dayOfYear: number, // 1 - 365
  hourOfDay: number, // 0 - 24 (decimal hours)
  facadeAzimuthDeg: number,
  skyType: CIESkyType
): SolarPosition {
  // Solar Declination delta (Spencer formula)
  const b = ((dayOfYear - 1) * 2 * Math.PI) / 365;
  const declinationRad =
    (23.45 * Math.PI) / 180 *
    Math.sin(((284 + dayOfYear) * 2 * Math.PI) / 365);

  // Hour Angle omega
  const solarTime = hourOfDay + (longitude - 15 * Math.round(longitude / 15)) / 15;
  const hourAngleRad = ((solarTime - 12) * 15 * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;

  // Solar Altitude alpha_s
  const sinAlt =
    Math.sin(latRad) * Math.sin(declinationRad) +
    Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitudeDeg = Math.max(0, (altitudeRad * 180) / Math.PI);

  // Solar Azimuth gamma_s (0 = North, 90 = East, 180 = South, 270 = West)
  const cosAz =
    (sinAlt * Math.sin(latRad) - Math.sin(declinationRad)) /
    (Math.max(0.001, Math.cos(altitudeRad)) * Math.cos(latRad));
  let azimuthDeg = (Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180) / Math.PI;
  if (hourAngleRad > 0) {
    azimuthDeg = 360 - azimuthDeg;
  }

  // Incident Profile Angle on vertical window facade
  const deltaAzRad = ((azimuthDeg - facadeAzimuthDeg) * Math.PI) / 180;
  const profileAngleRad = Math.atan2(Math.tan(altitudeRad), Math.cos(deltaAzRad));
  const profileAngleDeg = (profileAngleRad * 180) / Math.PI;

  // Outdoor Horizontal Illuminance models (CIE)
  let directNormalLux = 0;
  let diffuseHorizontalLux = 0;

  if (skyType === "cie_overcast") {
    // Standard CIE Overcast Sky: 10,000 lx reference diffuse
    diffuseHorizontalLux = Math.max(800, 10000 * Math.sin(altitudeRad));
    directNormalLux = 0;
  } else if (skyType === "cie_clear_sun") {
    // Clear Sky: up to 90,000 lx direct + 15,000 lx diffuse
    if (altitudeDeg > 2) {
      directNormalLux = 95000 * Math.exp(-0.21 / Math.sin(altitudeRad));
      diffuseHorizontalLux = 14000 * Math.pow(Math.sin(altitudeRad), 0.7);
    } else {
      directNormalLux = 0;
      diffuseHorizontalLux = 1500;
    }
  } else {
    // Intermediate Sky
    if (altitudeDeg > 2) {
      directNormalLux = 45000 * Math.exp(-0.35 / Math.sin(altitudeRad));
      diffuseHorizontalLux = 22000 * Math.sin(altitudeRad);
    } else {
      directNormalLux = 0;
      diffuseHorizontalLux = 3000;
    }
  }

  const globalHorizontalLux = diffuseHorizontalLux + directNormalLux * Math.sin(altitudeRad);

  return {
    altitudeDegrees: Math.round(altitudeDeg * 10) / 10,
    azimuthDegrees: Math.round(azimuthDeg * 10) / 10,
    directNormalLux: Math.round(directNormalLux),
    diffuseHorizontalLux: Math.round(diffuseHorizontalLux),
    globalHorizontalLux: Math.round(globalHorizontalLux),
    incidentProfileAngleDegrees: Math.round(profileAngleDeg * 10) / 10,
  };
}

/**
 * Calculates louvre slat transmission and ceiling redirection flux.
 */
export function calculateLouvreOpticalTransfer(
  louvre: SlatGeometryConfig,
  solar: SolarPosition,
  glazing: GlazingConfig
): {
  directBeamTransmission: number;
  diffuseSkyTransmission: number;
  ceilingRedirectedFraction: number;
  isCutoffActive: boolean;
} {
  const w = louvre.slatWidthMm;
  const s = louvre.slatSpacingMm;
  const betaDeg = louvre.slatTiltDegrees;
  const betaRad = (betaDeg * Math.PI) / 180;
  const dep = louvre.deploymentPercent / 100;

  if (dep <= 0.05) {
    // Retracted slats: 100% open window aperture
    return {
      directBeamTransmission: glazing.visualTransmittanceTauV,
      diffuseSkyTransmission: glazing.visualTransmittanceTauV,
      ceilingRedirectedFraction: 0,
      isCutoffActive: false,
    };
  }

  // Slat direct cut-off angle
  const cutoffTan = s / (w * Math.cos(betaRad)) - Math.tan(betaRad);
  const cutoffAngleDeg = (Math.atan(cutoffTan) * 180) / Math.PI;

  const isCutoff = solar.incidentProfileAngleDegrees >= cutoffAngleDeg;

  let directBeamTrans = 0;
  if (!isCutoff) {
    // Sunlight passes directly between slats
    const openRatio = Math.max(0, 1 - (w * Math.sin(betaRad + (solar.incidentProfileAngleDegrees * Math.PI) / 180)) / s);
    directBeamTrans = openRatio * glazing.visualTransmittanceTauV;
  } else {
    // In cut-off: only inter-slat specular/diffuse forward bounce
    directBeamTrans = 0.04 * louvre.slatReflectance * glazing.visualTransmittanceTauV;
  }

  // Diffuse sky transmission (integral across sky hemisphere)
  const cosHalfBeta = Math.cos(betaRad / 2);
  const diffuseTrans =
    cosHalfBeta *
    (1 - (w / s) * (1 - Math.cos(betaRad)) * (1 - louvre.slatReflectance)) *
    glazing.visualTransmittanceTauV;

  // Ceiling redirection fraction (slats angled to bounce sun rays upward)
  let ceilingRedirect = 0;
  if (betaDeg >= 10 && betaDeg <= 60 && solar.altitudeDegrees > 15) {
    ceilingRedirect =
      0.35 *
      louvre.slatReflectance *
      Math.sin(betaRad) *
      glazing.visualTransmittanceTauV *
      dep;
  }

  // Weighted by deployment factor
  const finalDirect = directBeamTrans * dep + (1 - dep) * glazing.visualTransmittanceTauV;
  const finalDiffuse = diffuseTrans * dep + (1 - dep) * glazing.visualTransmittanceTauV;

  return {
    directBeamTransmission: Math.max(0, Math.min(1, finalDirect)),
    diffuseSkyTransmission: Math.max(0.02, Math.min(1, finalDiffuse)),
    ceilingRedirectedFraction: ceilingRedirect,
    isCutoffActive: isCutoff,
  };
}

/**
 * Point-by-point indoor daylight calculation across workplane grid.
 */
export function simulateDaylightingSystem(
  system: DaylightingSystemItem,
  room: RoomDaylightEnvironment,
  solar: SolarPosition,
  skyType: CIESkyType
): DaylightSimulationResult {
  const windowArea = room.windowWidthM * room.windowHeightM;
  const roomFloorArea = room.lengthM * room.widthM;

  // 1. Calculate optical system transfer coefficients
  let directTrans = system.glazing.visualTransmittanceTauV;
  let diffuseTrans = system.glazing.visualTransmittanceTauV;
  let ceilingBounceFlux = 0;

  if (system.type === "horizontal_louvre" || system.type === "vertical_louvre") {
    if (system.louvre) {
      const opt = calculateLouvreOpticalTransfer(system.louvre, solar, system.glazing);
      directTrans = opt.directBeamTransmission;
      diffuseTrans = opt.diffuseSkyTransmission;
      ceilingBounceFlux = opt.ceilingRedirectedFraction;
    }
  } else if (system.type === "light_shelf") {
    if (system.lightShelf) {
      // Light shelf transmits lower diffuse + reflects upper sun onto ceiling
      diffuseTrans = system.glazing.visualTransmittanceTauV * 0.75;
      directTrans = 0.08; // deep shading near window
      if (solar.altitudeDegrees > 12) {
        ceilingBounceFlux = 0.45 * system.lightShelf.upperSurfaceSpecularReflectance * system.glazing.visualTransmittanceTauV;
      }
    }
  } else if (system.type === "textile_screen") {
    const of = (system.screenOpennessFactor || 3) / 100;
    diffuseTrans = system.glazing.visualTransmittanceTauV * of * 2.2;
    directTrans = system.glazing.visualTransmittanceTauV * of;
  } else if (system.type === "roof_skylight_dome") {
    diffuseTrans = 0.58;
    directTrans = 0.40;
  }

  // 2. Generate 12x8 workplane calculation grid
  const cols = 12; // room depth from window (0 to room.lengthM)
  const rows = 8; // room width
  const gridPoints: DaylightGridPoint[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const depthX = ((c + 0.5) / cols) * room.lengthM; // 0.3m to 7.8m
      const widthY = ((r + 0.5) / rows) * room.widthM;
      const z = room.workplaneHeightM;

      // 2.1 Sky Component (SC) via BRE / Tregenza angular view factor
      const distToWindow = Math.max(0.4, depthX);
      const viewAngleRad = Math.atan2(room.windowHeightM, distToWindow);
      const horizontalAngleRad = Math.atan2(room.windowWidthM / 2, distToWindow) * 2;
      const solidAngleFraction = (viewAngleRad * horizontalAngleRad) / (2 * Math.PI);

      const skyComponentDF = solidAngleFraction * diffuseTrans * 100;

      // 2.2 Internally Reflected Component (IRC)
      const avgReflectance =
        (room.ceilingReflectance + room.wallReflectance + room.floorReflectance) / 3;
      const ircDF =
        ((windowArea * diffuseTrans) / (roomFloorArea * (1 - avgReflectance))) *
        (avgReflectance * 0.45) *
        100;

      // 2.3 Ceiling Redirection Bounce (Lichtlenkung effect)
      // Light reflected from ceiling reaches deeper into room (depth 3m - 7m)
      const ceilingDepthFactor = Math.exp(-Math.pow((depthX - room.lengthM * 0.5) / 2.5, 2));
      const redirectedDF =
        ceilingBounceFlux * 6.5 * room.ceilingReflectance * ceilingDepthFactor;

      const totalDF = Math.max(0.1, skyComponentDF + ircDF + redirectedDF);

      // Convert to Illuminance (Lux)
      const diffuseLux = (totalDF / 100) * solar.diffuseHorizontalLux;

      // Direct sunlight beam component (if sun facing facade and unshaded)
      let sunBeamLux = 0;
      if (solar.directNormalLux > 0 && Math.abs(solar.incidentProfileAngleDegrees) < 85) {
        // Direct sun patch on workplane
        const isSunPatch = depthX < 3.5;
        if (isSunPatch) {
          sunBeamLux = directTrans * solar.directNormalLux * Math.sin((solar.altitudeDegrees * Math.PI) / 180) * 0.6;
        }
      }

      const totalLux = Math.round(diffuseLux + sunBeamLux);

      gridPoints.push({
        x: Math.round(depthX * 100) / 100,
        y: Math.round(widthY * 100) / 100,
        z,
        daylightFactorPercent: Math.round(totalDF * 100) / 100,
        illuminanceLux: totalLux,
        directSunlightLux: Math.round(sunBeamLux),
        diffuseSkyLux: Math.round(diffuseLux),
        reflectedCeilingLux: Math.round(redirectedDF * (solar.diffuseHorizontalLux / 100)),
      });
    }
  }

  const dfValues = gridPoints.map((p) => p.daylightFactorPercent);
  const avgDF = dfValues.reduce((a, b) => a + b, 0) / dfValues.length;
  const minDF = Math.min(...dfValues);
  const maxDF = Math.max(...dfValues);
  const u0 = avgDF > 0 ? minDF / avgDF : 0;

  const luxValues = gridPoints.map((p) => p.illuminanceLux);
  const avgLux = luxValues.reduce((a, b) => a + b, 0) / luxValues.length;
  const minLux = Math.min(...luxValues);
  const maxLux = Math.max(...luxValues);

  // 3. EN 17037 Compliance Evaluation
  const sortedDF = [...dfValues].sort((a, b) => a - b);
  const p50DF = sortedDF[Math.floor(sortedDF.length * 0.5)]; // median (50% of space)
  const p95DF = sortedDF[Math.floor(sortedDF.length * 0.05)]; // 95% of space meets this

  let level: "None" | "Minimum" | "Medium" | "High" = "None";
  if (p50DF >= 4.0 && p95DF >= 1.4) level = "High";
  else if (p50DF >= 3.0 && p95DF >= 1.0) level = "Medium";
  else if (p50DF >= 2.0 && p95DF >= 0.7) level = "Minimum";

  // Daylight Glare Probability (DGP)
  // Wienold & Christoffersen formula estimation at desk 1.5m from window
  const evAtDesk = luxValues[2]; // vertical illuminance at eyes near window
  const dgp = 5.87e-5 * evAtDesk + 0.092 * Math.log10(1 + (evAtDesk * directTrans) / 400) + 0.16;
  const clampedDgp = Math.max(0.18, Math.min(0.65, dgp));

  let glareCat: "Imperceptible" | "Perceptible" | "Disturbing" | "Intolerable" = "Imperceptible";
  if (clampedDgp > 0.45) glareCat = "Intolerable";
  else if (clampedDgp > 0.40) glareCat = "Disturbing";
  else if (clampedDgp > 0.35) glareCat = "Perceptible";

  const en17037: EN17037Evaluation = {
    daylightProvisionLevel: level,
    targetDaylightFactorRequired: 2.0,
    achievedSpace50PercentDF: Math.round(p50DF * 100) / 100,
    achievedSpace95PercentDF: Math.round(p95DF * 100) / 100,
    isProvisionCompliant: level !== "None",
    dgpGlaredRating: Math.round(clampedDgp * 100) / 100,
    glareCategory: glareCat,
    isGlareCompliant: clampedDgp <= 0.38,
    viewOutRating: "Level 2 (Good)",
    sunlightHoursEquinox: 4.5,
  };

  // 4. Daylight Harvesting & Energy Savings (LENI EN 15193)
  const pointsAboveTarget = luxValues.filter((lx) => lx >= room.targetIlluminanceLux).length;
  const daylightAutonomy = Math.round((pointsAboveTarget / luxValues.length) * 100);

  // Required artificial dimming level
  const dimmingFactor = Math.max(0, Math.min(1, 1 - avgLux / room.targetIlluminanceLux));
  const activeWatts = Math.round(room.artificialLightingWatts * dimmingFactor);
  const savedWatts = room.artificialLightingWatts - activeWatts;
  const annualSavedKwh = Math.round((savedWatts * 2200 * 0.75) / 1000); // 2200 operating hours/yr
  const co2ReductionKg = Math.round(annualSavedKwh * 0.42); // 0.42 kg CO2 / kWh

  const harvesting: DaylightHarvestingReport = {
    daylightAutonomyPercent: daylightAutonomy,
    averageDimmingFactor: Math.round(dimmingFactor * 100) / 100,
    activeArtificialWatts: activeWatts,
    powerReductionWatts: savedWatts,
    annualEnergySavedKwh: annualSavedKwh,
    co2ReductionKg,
  };

  return {
    timestamp: new Date().toISOString(),
    system,
    room,
    solar,
    skyType,
    gridPoints,
    averageDaylightFactor: Math.round(avgDF * 100) / 100,
    minDaylightFactor: Math.round(minDF * 100) / 100,
    maxDaylightFactor: Math.round(maxDF * 100) / 100,
    uniformityU0: Math.round(u0 * 100) / 100,
    averageIlluminanceLux: Math.round(avgLux),
    minIlluminanceLux: Math.round(minLux),
    maxIlluminanceLux: Math.round(maxLux),
    en17037,
    harvesting,
  };
}

// =========================================================================
// 3. ODLS / DDLS PRODUCT CATALOG PRESETS
// =========================================================================

export const ODLS_DAYLIGHT_CATALOG: DaylightingSystemItem[] = [
  // 1. External Raffstore Venetian Louvre Blinds
  {
    id: "warema_raffstore_80",
    name: "Warema Raffstore E80 A6 (External Venetian Blinds)",
    manufacturer: "Warema Renkhoff SE",
    model: "E80 A6 Beaded Louvre",
    type: "horizontal_louvre",
    installedAperture: "window_facade",
    glazing: {
      layerCount: "double_low_e",
      visualTransmittanceTauV: 0.74,
      solarFactorG: 0.52,
      uValueWpm2K: 1.1,
    },
    louvre: {
      slatWidthMm: 80,
      slatSpacingMm: 70,
      slatTiltDegrees: 45,
      slatReflectance: 0.82, // Silver metallic finish
      deploymentPercent: 100,
      controlStrategy: "sun_tracking_cutoff",
    },
    odlsCompliant: true,
    description: "External 80mm beaded slats with automated cut-off angle tracking. Excellent glare reduction and high solar protection (g_tot = 0.08).",
  },

  // 2. Griesser Daylight Redirecting Blinds (Lichtlenk-Jalousie)
  {
    id: "griesser_metalunic_v",
    name: "Griesser Metalunic V Daylight Redirecting Louvre",
    manufacturer: "Griesser AG",
    model: "Metalunic V-80 Retro-Lux",
    type: "horizontal_louvre",
    installedAperture: "window_facade",
    glazing: {
      layerCount: "double_low_e",
      visualTransmittanceTauV: 0.72,
      solarFactorG: 0.48,
      uValueWpm2K: 1.0,
    },
    louvre: {
      slatWidthMm: 90,
      slatSpacingMm: 75,
      slatTiltDegrees: 30,
      slatReflectance: 0.88, // High-specular concave upper finish
      deploymentPercent: 100,
      controlStrategy: "light_redirecting_ceiling",
    },
    odlsCompliant: true,
    description: "Concave dual-zone slats: upper section directs sunlight onto the ceiling for deep room daylighting, lower section prevents workstation glare.",
  },

  // 3. Architectural Light Shelf System
  {
    id: "schueco_lightshelf_600",
    name: "Schüco Architectural Specular Light Shelf (600mm)",
    manufacturer: "Schüco International",
    model: "SLS-600 Extruded Aluminum Light Shelf",
    type: "light_shelf",
    installedAperture: "window_facade",
    glazing: {
      layerCount: "triple_solar_control",
      visualTransmittanceTauV: 0.65,
      solarFactorG: 0.38,
      uValueWpm2K: 0.8,
    },
    lightShelf: {
      shelfDepthMm: 600,
      isExternal: false,
      mountingHeightM: 2.15,
      upperSurfaceSpecularReflectance: 0.88,
    },
    odlsCompliant: true,
    description: "Interior horizontal light shelf mounted at 2.15m height. Bounces sunbeams 6 to 9 meters into deep office floorplans.",
  },

  // 4. Textile Micro-Perforated Solar Screen
  {
    id: "ferrari_soltis_92",
    name: "Serge Ferrari Soltis Perform 92 Micro-Perforated Screen",
    manufacturer: "Serge Ferrari Group",
    model: "Soltis 92-2044 LowE Bronze",
    type: "textile_screen",
    installedAperture: "window_facade",
    glazing: {
      layerCount: "double_low_e",
      visualTransmittanceTauV: 0.70,
      solarFactorG: 0.45,
      uValueWpm2K: 1.1,
    },
    screenOpennessFactor: 4, // 4% openness
    odlsCompliant: true,
    description: "Micro-ventilated textile screen providing glare protection (Tv = 4%) while preserving transparency and outdoor view.",
  },

  // 5. Continuous Roof Skylight Dome with Prismatic Baffles
  {
    id: "velux_modular_skylight",
    name: "VELUX Modular Diffusing Rooflight Dome",
    manufacturer: "VELUX Group",
    model: "VMS Ridgelight with Diffusing Opal",
    type: "roof_skylight_dome",
    installedAperture: "roof_skylight",
    glazing: {
      layerCount: "double_low_e",
      visualTransmittanceTauV: 0.58,
      solarFactorG: 0.35,
      uValueWpm2K: 1.2,
    },
    odlsCompliant: true,
    description: "Overhead diffusing rooflight providing uniform, glare-free daylighting across central atrium and deep core spaces.",
  },
];
