/**
 * =========================================================================
 * DIALUX EVO SWIMMING POOL LIGHTING ENGINE (TUTORIAL PART 22)
 * =========================================================================
 * 
 * Implements the complete Swimming Pool lighting design & simulation system
 * from DIALux evo Tutorial Part 22:
 * 
 * 1. POOL BASIN & EXTRUSION MODELING:
 *    - Depressed floor cutout / pool basin volume
 *    - Sloped or stepped basin profiles (shallow end to deep end)
 *    - Water body extrusion volume with physical optical properties:
 *      * Refractive index n = 1.333 (Snell's Law)
 *      * Water absorption coefficient alpha (Beer-Lambert attenuation)
 *      * Surface transparency (90-95%) and specular reflection (~50%)
 *      * Critical angle for total internal reflection theta_c = 48.6 deg
 *    - Pool interior mosaic tiles & coping/deck apron materials
 * 
 * 2. DUAL-ZONE LIGHTING SYSTEM:
 *    - Submersible underwater luminaires (IP68, SELV 12V/24V)
 *      * Mounted in side walls 0.5m - 0.7m below water line
 *      * Wide flood optics directed across basin floor
 *    - Overhead / perimeter hall luminaires (IP65, C4/C5 chlorine resistant)
 *      * Asymmetric distributions aimed away from normal to minimize glare
 * 
 * 3. STANDARDS & PHOTOMETRIC CALCULATION SURFACES:
 *    - EN 12193 (Sports lighting for swimming pools, Classes I, II, III)
 *    - World Aquatics (FINA) competition benchmarks
 *    - Three calculation surfaces:
 *      1. Water Surface Plane (z = 0)
 *      2. Pool Bottom / Basin Floor (z = -depth, accounting for water attenuation)
 *      3. Surrounding Wet Deck Apron (z = +0.2m, safety movement)
 *    - Lifeguard specular glare & veiling reflection assessment
 * 
 * 4. POWER, LENI & ENERGY PERFORMANCE:
 *    - Specific electrical load: W/m² of water surface & total hall
 */

export type PoolStandardId =
  | "EN12193_CLASS_I"
  | "EN12193_CLASS_II"
  | "EN12193_CLASS_III"
  | "HOTEL_RESORT_LEISURE"
  | "WATER_POLO_DIVING";

export interface PoolStandardRequirement {
  id: PoolStandardId;
  name: string;
  description: string;
  minWaterAvgLux: number;
  minWaterUniformityU0: number;
  minDeckAvgLux: number;
  minDeckUniformityU0: number;
  maxLifeguardGlareIndex: number;
}

export const POOL_STANDARDS: Record<PoolStandardId, PoolStandardRequirement> = {
  EN12193_CLASS_I: {
    id: "EN12193_CLASS_I",
    name: "EN 12193 Class I — International & National Competition",
    description: "High-level professional sports events, television broadcast, and national championships.",
    minWaterAvgLux: 600,
    minWaterUniformityU0: 0.70,
    minDeckAvgLux: 200,
    minDeckUniformityU0: 0.50,
    maxLifeguardGlareIndex: 50,
  },
  EN12193_CLASS_II: {
    id: "EN12193_CLASS_II",
    name: "EN 12193 Class II — Regional & Club Competition",
    description: "Medium-level club competitions, team training, and high-performance squad practice.",
    minWaterAvgLux: 400,
    minWaterUniformityU0: 0.60,
    minDeckAvgLux: 150,
    minDeckUniformityU0: 0.45,
    maxLifeguardGlareIndex: 50,
  },
  EN12193_CLASS_III: {
    id: "EN12193_CLASS_III",
    name: "EN 12193 Class III — Recreational, School & Hotel",
    description: "General public swimming, physical education in schools, and hotel leisure pools.",
    minWaterAvgLux: 250,
    minWaterUniformityU0: 0.50,
    minDeckAvgLux: 150,
    minDeckUniformityU0: 0.40,
    maxLifeguardGlareIndex: 55,
  },
  HOTEL_RESORT_LEISURE: {
    id: "HOTEL_RESORT_LEISURE",
    name: "Resort & Luxury Spa — Atmospheric Leisure",
    description: "Relaxed evening ambience, decorative underwater glow, and wellness relaxation.",
    minWaterAvgLux: 150,
    minWaterUniformityU0: 0.40,
    minDeckAvgLux: 100,
    minDeckUniformityU0: 0.35,
    maxLifeguardGlareIndex: 55,
  },
  WATER_POLO_DIVING: {
    id: "WATER_POLO_DIVING",
    name: "World Aquatics — Water Polo & Diving Pit",
    description: "Deep water visibility, surface ball tracking, and diving platform illumination.",
    minWaterAvgLux: 500,
    minWaterUniformityU0: 0.70,
    minDeckAvgLux: 200,
    minDeckUniformityU0: 0.50,
    maxLifeguardGlareIndex: 50,
  },
};

export type TileMaterialId =
  | "mosaic_azure_cyan"
  | "mosaic_cobalt_blue"
  | "mosaic_caribbean_emerald"
  | "white_porcelain"
  | "dark_granite_luxury";

export interface TileMaterialOption {
  id: TileMaterialId;
  name: string;
  reflectance: number; // 0.0 - 1.0
  colorHex: string;
  roughness: number;
}

export const POOL_TILE_MATERIALS: Record<TileMaterialId, TileMaterialOption> = {
  mosaic_azure_cyan: {
    id: "mosaic_azure_cyan",
    name: "Azure Cyan Glass Mosaic",
    reflectance: 0.58,
    colorHex: "#00b4d8",
    roughness: 0.20,
  },
  mosaic_cobalt_blue: {
    id: "mosaic_cobalt_blue",
    name: "Deep Cobalt Olympic Tile",
    reflectance: 0.42,
    colorHex: "#0077b6",
    roughness: 0.22,
  },
  mosaic_caribbean_emerald: {
    id: "mosaic_caribbean_emerald",
    name: "Caribbean Emerald Glass Mosaic",
    reflectance: 0.62,
    colorHex: "#2a9d8f",
    roughness: 0.18,
  },
  white_porcelain: {
    id: "white_porcelain",
    name: "High-Gloss White Ceramic",
    reflectance: 0.78,
    colorHex: "#f8fafc",
    roughness: 0.12,
  },
  dark_granite_luxury: {
    id: "dark_granite_luxury",
    name: "Deep Charcoal Luxury Stone",
    reflectance: 0.22,
    colorHex: "#334155",
    roughness: 0.35,
  },
};

export type WaterClarityType =
  | "ultra_clear_competition"
  | "standard_chlorinated"
  | "natural_saltwater"
  | "turbid_heated_spa";

export interface WaterClarityOption {
  id: WaterClarityType;
  name: string;
  absorptionAlpha: number; // m^-1
  transparencyPercent: number;
  refractiveIndex: number;
}

export const WATER_CLARITY_OPTIONS: Record<WaterClarityType, WaterClarityOption> = {
  ultra_clear_competition: {
    id: "ultra_clear_competition",
    name: "Ultra-Filtered Competition (Ozonated)",
    absorptionAlpha: 0.05,
    transparencyPercent: 95,
    refractiveIndex: 1.333,
  },
  standard_chlorinated: {
    id: "standard_chlorinated",
    name: "Standard Commercial Chlorinated",
    absorptionAlpha: 0.08,
    transparencyPercent: 92,
    refractiveIndex: 1.333,
  },
  natural_saltwater: {
    id: "natural_saltwater",
    name: "Mineral Saltwater Pool",
    absorptionAlpha: 0.12,
    transparencyPercent: 88,
    refractiveIndex: 1.335,
  },
  turbid_heated_spa: {
    id: "turbid_heated_spa",
    name: "Heated Hydrotherapy Spa (36°C)",
    absorptionAlpha: 0.18,
    transparencyPercent: 82,
    refractiveIndex: 1.334,
  },
};

export interface PoolBasinConfig {
  length: number; // m (e.g. 25.0)
  width: number; // m (e.g. 12.5)
  shallowDepth: number; // m (e.g. 1.3)
  deepDepth: number; // m (e.g. 2.0)
  isSlopedBottom: boolean;
  freeboard: number; // m (water line offset below coping rim, e.g. 0.20)
  copingWidth: number; // m (e.g. 0.30)
  deckWidth: number; // m (surrounding wet deck walkway, e.g. 2.5)
  tileMaterial: TileMaterialId;
  laneCount: number; // 0 for leisure, 5-8 for competition
  hasStartingBlocks: boolean;
  hasLadders: boolean;
  hasLifeguardChair: boolean;
}

export interface WaterVolumeConfig {
  clarity: WaterClarityType;
  refractiveIndex: number;
  transparencyPercent: number;
  specularReflectancePercent: number;
  absorptionAlpha: number;
  showCausticEffect: boolean;
  showSurfaceRipples: boolean;
}

export interface UnderwaterLuminaire {
  id: string;
  name: string;
  wallSide: "left_long_wall" | "right_long_wall" | "shallow_end" | "deep_end";
  position: { x: number; y: number; z: number }; // z is negative (submerged)
  aimingAngle: number; // degrees down towards floor (e.g. 5)
  luminousFlux: number; // lumens
  powerWatts: number; // W
  beamAngle: number; // degrees (e.g. 90 wide flood)
  cctKelvin: number; // e.g. 5000K or RGB
  colorHex: string;
  dimmingPercent: number; // 0 - 100
  isEnabled: boolean;
  ipRating: "IP68";
  voltage: "12V AC/DC SELV" | "24V DC SELV";
}

export interface OverheadLuminaire {
  id: string;
  name: string;
  mountingSide: "left_deck" | "right_deck" | "shallow_deck" | "deep_deck" | "ceiling_central";
  position: { x: number; y: number; z: number }; // z is positive (above floor)
  aimingTarget: { x: number; y: number; z: number };
  luminousFlux: number; // lumens
  powerWatts: number; // W
  beamSpreadX: number; // degrees
  beamSpreadY: number; // degrees
  cctKelvin: number;
  dimmingPercent: number; // 0 - 100
  isEnabled: boolean;
  ipRating: "IP65" | "IP66";
  corrosionClass: "C4" | "C5";
}

export interface PhotometricPoint {
  x: number;
  y: number;
  z: number;
  lux: number;
}

export interface CalculationSurfaceResult {
  name: string;
  width: number;
  length: number;
  gridRows: number;
  gridCols: number;
  points: PhotometricPoint[];
  averageLux: number;
  minLux: number;
  maxLux: number;
  uniformityU0: number; // E_min / E_avg
  uniformityU1: number; // E_min / E_max
}

export interface LifeguardGlareAssessment {
  lifeguardPosition: { x: number; y: number; z: number };
  veilingReflectionPercent: number; // % specular glare reflected into eyes
  isAcceptable: boolean;
  recommendation: string;
}

export interface PoolLightingSimulationReport {
  timestamp: string;
  standard: PoolStandardId;
  basin: PoolBasinConfig;
  water: WaterVolumeConfig;
  waterSurface: CalculationSurfaceResult;
  poolBottom: CalculationSurfaceResult;
  deckApron: CalculationSurfaceResult;
  lifeguardGlare: LifeguardGlareAssessment;
  totalUnderwaterPowerWatts: number;
  totalOverheadPowerWatts: number;
  totalActiveWatts: number;
  waterPowerDensityWpm2: number; // W / m² of water surface
  overallPowerDensityWpm2: number; // W / m² of water + deck
  compliance: {
    waterLuxPass: boolean;
    waterU0Pass: boolean;
    deckLuxPass: boolean;
    glarePass: boolean;
    isOverallCompliant: boolean;
  };
}

// =========================================================================
// 2. MATHEMATICAL CALCULATION FUNCTIONS (OPTICS & ATTENUATION)
// =========================================================================

/**
 * Calculates Fresnel reflectance for unpolarized light at an air-water boundary.
 * R(theta_i) = 0.5 * (R_s + R_p)
 * At normal incidence R(0) ~ 0.0204 (2.04%).
 */
export function calculateFresnelReflectance(
  incidentAngleRad: number,
  nAir: number = 1.0,
  nWater: number = 1.333
): number {
  if (incidentAngleRad <= 0.001) {
    const r0 = Math.pow((nWater - nAir) / (nWater + nAir), 2);
    return r0;
  }

  const sinThetaI = Math.sin(incidentAngleRad);
  const sinThetaT = (nAir / nWater) * sinThetaI;

  // Total internal reflection condition (only happens when light travels from water to air)
  if (sinThetaT >= 1.0) {
    return 1.0;
  }

  const cosThetaI = Math.cos(incidentAngleRad);
  const cosThetaT = Math.sqrt(1 - sinThetaT * sinThetaT);

  const rs = Math.pow((nAir * cosThetaI - nWater * cosThetaT) / (nAir * cosThetaI + nWater * cosThetaT), 2);
  const rp = Math.pow((nWater * cosThetaI - nAir * cosThetaT) / (nWater * cosThetaI + nAir * cosThetaT), 2);

  return 0.5 * (rs + rp);
}

/**
 * Calculates Beer-Lambert light transmission through water.
 * T(d) = exp(-alpha * d)
 */
export function calculateWaterAttenuation(distanceMeters: number, alpha: number): number {
  return Math.exp(-alpha * Math.max(0, distanceMeters));
}

/**
 * Interpolates pool basin depth at any coordinate along length (x in [-L/2, L/2]).
 */
export function getBasinDepthAt(
  x: number,
  basin: PoolBasinConfig
): number {
  if (!basin.isSlopedBottom) {
    return basin.shallowDepth;
  }
  // x ranges from -L/2 (shallow end) to +L/2 (deep end)
  const normX = Math.min(1, Math.max(0, (x + basin.length / 2) / basin.length));
  return basin.shallowDepth + normX * (basin.deepDepth - basin.shallowDepth);
}

/**
 * Solves point photometrics on water surface, pool floor, and deck apron.
 */
export function simulatePoolLighting(
  basin: PoolBasinConfig,
  water: WaterVolumeConfig,
  underwaterFixtures: UnderwaterLuminaire[],
  overheadFixtures: OverheadLuminaire[],
  standardId: PoolStandardId
): PoolLightingSimulationReport {
  const standard = POOL_STANDARDS[standardId];
  const tileOption = POOL_TILE_MATERIALS[basin.tileMaterial];

  const poolHalfL = basin.length / 2;
  const poolHalfW = basin.width / 2;

  // Active wattage tally
  let totalUnderWatts = 0;
  underwaterFixtures.forEach((f) => {
    if (f.isEnabled) totalUnderWatts += f.powerWatts * (f.dimmingPercent / 100);
  });

  let totalOverWatts = 0;
  overheadFixtures.forEach((f) => {
    if (f.isEnabled) totalOverWatts += f.powerWatts * (f.dimmingPercent / 100);
  });

  const totalActiveWatts = totalUnderWatts + totalOverWatts;
  const waterArea = basin.length * basin.width;
  const totalArea = (basin.length + 2 * basin.deckWidth) * (basin.width + 2 * basin.deckWidth);

  // -------------------------------------------------------------------------
  // 1. Water Surface Calculation Grid (z = 0)
  // -------------------------------------------------------------------------
  const waterCols = 16;
  const waterRows = 10;
  const waterPoints: PhotometricPoint[] = [];

  for (let r = 0; r < waterRows; r++) {
    for (let c = 0; c < waterCols; c++) {
      const x = -poolHalfL + ((c + 0.5) / waterCols) * basin.length;
      const y = -poolHalfW + ((r + 0.5) / waterRows) * basin.width;
      const z = 0; // water surface

      let pointLux = 0;

      // Contribution from overhead luminaires
      overheadFixtures.forEach((fix) => {
        if (!fix.isEnabled || fix.dimmingPercent <= 0) return;
        const dx = x - fix.position.x;
        const dy = y - fix.position.y;
        const dz = z - fix.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        if (dist < 0.2) return;

        // Angle from vertical normal
        const cosTheta = Math.abs(dz) / dist;
        const flux = fix.luminousFlux * (fix.dimmingPercent / 100);

        // Typical asymmetric sport floodlight intensity model
        const intensity = (flux / (2 * Math.PI)) * Math.pow(Math.max(0, cosTheta), 1.5) * 2.2;
        const directLux = (intensity * cosTheta) / distSq;
        pointLux += directLux;
      });

      // Contribution from underwater luminaires emerging through water surface
      underwaterFixtures.forEach((uFix) => {
        if (!uFix.isEnabled || uFix.dimmingPercent <= 0) return;
        const dx = x - uFix.position.x;
        const dy = y - uFix.position.y;
        const dz = z - uFix.position.z;
        const distInWater = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (distInWater < 0.2) return;

        const sinTheta = Math.sqrt(dx * dx + dy * dy) / distInWater;
        // Total internal reflection threshold (48.6 deg)
        if (sinTheta > 1.0 / water.refractiveIndex) {
          return; // Totally internally reflected back down
        }

        const flux = uFix.luminousFlux * (uFix.dimmingPercent / 100);
        const attenuation = calculateWaterAttenuation(distInWater, water.absorptionAlpha);
        const cosAngle = Math.abs(dz) / distInWater;
        const intensity = (flux / (2 * Math.PI)) * cosAngle * 1.8;
        const emergingLux = ((intensity * cosAngle) / (distInWater * distInWater)) * attenuation * (1 - water.specularReflectancePercent / 200);
        pointLux += emergingLux * 0.4;
      });

      waterPoints.push({ x, y, z, lux: Math.round(pointLux * 10) / 10 });
    }
  }

  const waterLuxValues = waterPoints.map((p) => p.lux);
  const waterAvg = waterLuxValues.reduce((a, b) => a + b, 0) / waterLuxValues.length;
  const waterMin = Math.min(...waterLuxValues);
  const waterMax = Math.max(...waterLuxValues);
  const waterU0 = waterAvg > 0 ? waterMin / waterAvg : 0;
  const waterU1 = waterMax > 0 ? waterMin / waterMax : 0;

  const waterSurfaceResult: CalculationSurfaceResult = {
    name: "Water Surface Plane (z = 0.0m)",
    width: basin.width,
    length: basin.length,
    gridRows: waterRows,
    gridCols: waterCols,
    points: waterPoints,
    averageLux: Math.round(waterAvg),
    minLux: Math.round(waterMin),
    maxLux: Math.round(waterMax),
    uniformityU0: Math.round(waterU0 * 100) / 100,
    uniformityU1: Math.round(waterU1 * 100) / 100,
  };

  // -------------------------------------------------------------------------
  // 2. Pool Bottom Basin Floor Calculation Grid (z = -depth)
  // -------------------------------------------------------------------------
  const floorCols = 16;
  const floorRows = 10;
  const floorPoints: PhotometricPoint[] = [];

  for (let r = 0; r < floorRows; r++) {
    for (let c = 0; c < floorCols; c++) {
      const x = -poolHalfL + ((c + 0.5) / floorCols) * basin.length;
      const y = -poolHalfW + ((r + 0.5) / floorRows) * basin.width;
      const currentDepth = getBasinDepthAt(x, basin);
      const z = -currentDepth;

      let pointLux = 0;

      // 2.1 Underwater fixtures direct illumination onto basin floor
      underwaterFixtures.forEach((uFix) => {
        if (!uFix.isEnabled || uFix.dimmingPercent <= 0) return;
        const dx = x - uFix.position.x;
        const dy = y - uFix.position.y;
        const dz = z - uFix.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.15) return;

        // Underwater beam direction: aimed outwards across the pool
        let normalX = 0;
        let normalY = 0;
        if (uFix.wallSide === "left_long_wall") normalY = 1;
        else if (uFix.wallSide === "right_long_wall") normalY = -1;
        else if (uFix.wallSide === "shallow_end") normalX = 1;
        else if (uFix.wallSide === "deep_end") normalX = -1;

        const dotProduct = (dx * normalX + dy * normalY) / dist;
        if (dotProduct <= 0) return; // behind luminaire

        const beamSpreadRad = ((uFix.beamAngle / 2) * Math.PI) / 180;
        const beamFalloff = Math.max(0, Math.cos(Math.acos(Math.max(-1, Math.min(1, dotProduct))) / (beamSpreadRad / 1.5)));

        const flux = uFix.luminousFlux * (uFix.dimmingPercent / 100);
        const attenuation = calculateWaterAttenuation(dist, water.absorptionAlpha);

        // Floor normal is roughly (0, 0, 1) with small tilt if sloped
        const cosFloor = Math.abs(dz) / dist;
        const intensity = (flux / (Math.PI * 0.9)) * Math.pow(dotProduct, 1.2) * beamFalloff;
        const floorLux = ((intensity * cosFloor) / (dist * dist)) * attenuation;
        pointLux += floorLux;
      });

      // 2.2 Overhead fixtures passing through water surface to basin floor
      overheadFixtures.forEach((fix) => {
        if (!fix.isEnabled || fix.dimmingPercent <= 0) return;
        const distAir = fix.position.z; // vertical distance to water
        const distWater = currentDepth;
        const dx = x - fix.position.x;
        const dy = y - fix.position.y;
        const totalHorizontalDist = Math.sqrt(dx * dx + dy * dy);

        const totalAirPath = Math.sqrt(totalHorizontalDist * 0.7 * (totalHorizontalDist * 0.7) + distAir * distAir);
        const incidentAngleRad = Math.atan2(totalHorizontalDist * 0.7, distAir);
        const fresnelR = calculateFresnelReflectance(incidentAngleRad, 1.0, water.refractiveIndex);
        const transmission = 1.0 - fresnelR;

        const totalWaterPath = Math.sqrt(totalHorizontalDist * 0.3 * (totalHorizontalDist * 0.3) + distWater * distWater);
        const attenuation = calculateWaterAttenuation(totalWaterPath, water.absorptionAlpha);

        const totalEffDist = totalAirPath + totalWaterPath * water.refractiveIndex;
        const flux = fix.luminousFlux * (fix.dimmingPercent / 100);
        const cosFloor = distWater / totalWaterPath;
        const intensity = (flux / (2 * Math.PI)) * Math.pow(cosFloor, 1.2) * 2.0;

        const transmittedLux = ((intensity * cosFloor) / (totalEffDist * totalEffDist)) * transmission * attenuation;
        pointLux += transmittedLux * tileOption.reflectance * 1.6;
      });

      floorPoints.push({ x, y, z, lux: Math.round(pointLux * 10) / 10 });
    }
  }

  const floorLuxValues = floorPoints.map((p) => p.lux);
  const floorAvg = floorLuxValues.reduce((a, b) => a + b, 0) / floorLuxValues.length;
  const floorMin = Math.min(...floorLuxValues);
  const floorMax = Math.max(...floorLuxValues);
  const floorU0 = floorAvg > 0 ? floorMin / floorAvg : 0;
  const floorU1 = floorMax > 0 ? floorMin / floorMax : 0;

  const floorResult: CalculationSurfaceResult = {
    name: "Pool Basin Floor (z = -Depth, Water Attenuation)",
    width: basin.width,
    length: basin.length,
    gridRows: floorRows,
    gridCols: floorCols,
    points: floorPoints,
    averageLux: Math.round(floorAvg),
    minLux: Math.round(floorMin),
    maxLux: Math.round(floorMax),
    uniformityU0: Math.round(floorU0 * 100) / 100,
    uniformityU1: Math.round(floorU1 * 100) / 100,
  };

  // -------------------------------------------------------------------------
  // 3. Surrounding Wet Deck Apron Calculation Grid (z = +0.2m)
  // -------------------------------------------------------------------------
  const deckCols = 18;
  const deckRows = 12;
  const deckPoints: PhotometricPoint[] = [];
  const fullHalfL = poolHalfL + basin.deckWidth;
  const fullHalfW = poolHalfW + basin.deckWidth;

  for (let r = 0; r < deckRows; r++) {
    for (let c = 0; c < deckCols; c++) {
      const x = -fullHalfL + ((c + 0.5) / deckCols) * (2 * fullHalfL);
      const y = -fullHalfW + ((r + 0.5) / deckRows) * (2 * fullHalfW);

      // Only calculate if inside the deck walkway (outside the water pool boundary)
      const isInsideWater = Math.abs(x) < poolHalfL && Math.abs(y) < poolHalfW;
      if (isInsideWater) continue;

      let pointLux = 0;
      overheadFixtures.forEach((fix) => {
        if (!fix.isEnabled || fix.dimmingPercent <= 0) return;
        const dx = x - fix.position.x;
        const dy = y - fix.position.y;
        const dz = 0.2 - fix.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);
        if (dist < 0.2) return;

        const cosTheta = Math.abs(dz) / dist;
        const flux = fix.luminousFlux * (fix.dimmingPercent / 100);
        const intensity = (flux / (2 * Math.PI)) * Math.pow(cosTheta, 1.3) * 2.4;
        pointLux += (intensity * cosTheta) / distSq;
      });

      deckPoints.push({ x, y, z: 0.2, lux: Math.round(pointLux * 10) / 10 });
    }
  }

  const deckLuxValues = deckPoints.map((p) => p.lux);
  const deckAvg = deckLuxValues.length > 0 ? deckLuxValues.reduce((a, b) => a + b, 0) / deckLuxValues.length : 0;
  const deckMin = deckLuxValues.length > 0 ? Math.min(...deckLuxValues) : 0;
  const deckMax = deckLuxValues.length > 0 ? Math.max(...deckLuxValues) : 0;
  const deckU0 = deckAvg > 0 ? deckMin / deckAvg : 0;

  const deckResult: CalculationSurfaceResult = {
    name: "Wet Deck Apron Walkway (z = +0.2m)",
    width: basin.width + 2 * basin.deckWidth,
    length: basin.length + 2 * basin.deckWidth,
    gridRows: deckRows,
    gridCols: deckCols,
    points: deckPoints,
    averageLux: Math.round(deckAvg),
    minLux: Math.round(deckMin),
    maxLux: Math.round(deckMax),
    uniformityU0: Math.round(deckU0 * 100) / 100,
    uniformityU1: Math.round(deckMax > 0 ? (deckMin / deckMax) * 100 : 0) / 100,
  };

  // -------------------------------------------------------------------------
  // 4. Lifeguard Glare & Veiling Reflection Assessment
  // -------------------------------------------------------------------------
  const lifeguardPos = {
    x: poolHalfL * 0.4,
    y: poolHalfW + basin.deckWidth * 0.6,
    z: 2.2, // elevated lifeguard chair observation eye-height
  };

  let maxGlareVeiling = 0;
  overheadFixtures.forEach((fix) => {
    if (!fix.isEnabled) return;
    // Specular reflection geometry: midpoint between fixture and lifeguard projected onto water
    const midX = (fix.position.x + lifeguardPos.x) / 2;
    const midY = (fix.position.y + lifeguardPos.y) / 2;
    const isOverWater = Math.abs(midX) < poolHalfL && Math.abs(midY) < poolHalfW;

    if (isOverWater) {
      // Direct specular reflection path exists on water surface!
      const incidentAngleRad = Math.atan2(
        Math.hypot(fix.position.x - midX, fix.position.y - midY),
        fix.position.z
      );
      const r = calculateFresnelReflectance(incidentAngleRad, 1.0, water.refractiveIndex);
      maxGlareVeiling = Math.max(maxGlareVeiling, r * 100 * 1.5);
    }
  });

  const isGlareOk = maxGlareVeiling <= standard.maxLifeguardGlareIndex;
  const lifeguardGlare: LifeguardGlareAssessment = {
    lifeguardPosition: lifeguardPos,
    veilingReflectionPercent: Math.round(maxGlareVeiling * 10) / 10,
    isAcceptable: isGlareOk,
    recommendation: isGlareOk
      ? "Asymmetric optics and side setback comply with EN 12193 glare restrictions. Pool bottom remains clearly visible to lifeguard."
      : "High veiling reflection detected off water surface! Move overhead luminaires further back onto perimeter deck or angle optics away from pool center.",
  };

  // -------------------------------------------------------------------------
  // 5. Compliance Assessment
  // -------------------------------------------------------------------------
  const waterLuxPass = waterSurfaceResult.averageLux >= standard.minWaterAvgLux;
  const waterU0Pass = waterSurfaceResult.uniformityU0 >= standard.minWaterUniformityU0;
  const deckLuxPass = deckResult.averageLux >= standard.minDeckAvgLux;
  const glarePass = isGlareOk;
  const isOverallCompliant = waterLuxPass && waterU0Pass && deckLuxPass && glarePass;

  return {
    timestamp: new Date().toISOString(),
    standard: standardId,
    basin,
    water,
    waterSurface: waterSurfaceResult,
    poolBottom: floorResult,
    deckApron: deckResult,
    lifeguardGlare,
    totalUnderwaterPowerWatts: Math.round(totalUnderWatts),
    totalOverheadPowerWatts: Math.round(totalOverWatts),
    totalActiveWatts: Math.round(totalActiveWatts),
    waterPowerDensityWpm2: Math.round((totalActiveWatts / waterArea) * 10) / 10,
    overallPowerDensityWpm2: Math.round((totalActiveWatts / totalArea) * 10) / 10,
    compliance: {
      waterLuxPass,
      waterU0Pass,
      deckLuxPass,
      glarePass,
      isOverallCompliant,
    },
  };
}

// =========================================================================
// 3. DEFAULT PRESETS FOR QUICK EXPLORATION
// =========================================================================

export interface PoolPresetTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  standardId: PoolStandardId;
  basin: PoolBasinConfig;
  water: WaterVolumeConfig;
  underwaterFixtures: UnderwaterLuminaire[];
  overheadFixtures: OverheadLuminaire[];
}

export const POOL_PRESETS: PoolPresetTemplate[] = [
  // PRESET 1: SEMI-OLYMPIC COMPETITION POOL (25M x 12.5M)
  {
    id: "semi_olympic_25m",
    name: "Semi-Olympic Competition Pool (25m × 12.5m)",
    category: "Competition Sports",
    description: "6-Lane 25m short-course competition basin compliant with EN 12193 Class I and World Aquatics guidelines.",
    standardId: "EN12193_CLASS_I",
    basin: {
      length: 25.0,
      width: 12.5,
      shallowDepth: 1.4,
      deepDepth: 2.0,
      isSlopedBottom: true,
      freeboard: 0.20,
      copingWidth: 0.35,
      deckWidth: 3.0,
      tileMaterial: "mosaic_azure_cyan",
      laneCount: 6,
      hasStartingBlocks: true,
      hasLadders: true,
      hasLifeguardChair: true,
    },
    water: {
      clarity: "ultra_clear_competition",
      refractiveIndex: 1.333,
      transparencyPercent: 95,
      specularReflectancePercent: 50,
      absorptionAlpha: 0.05,
      showCausticEffect: true,
      showSurfaceRipples: true,
    },
    underwaterFixtures: [
      // 7 on left long wall (submerged at z = -0.65m)
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `uw_left_${i + 1}`,
        name: `Left Wall Recessed Submersible #${i + 1}`,
        wallSide: "left_long_wall" as const,
        position: { x: -10.5 + i * 3.5, y: -6.25, z: -0.65 },
        aimingAngle: 5,
        luminousFlux: 4200,
        powerWatts: 40,
        beamAngle: 90,
        cctKelvin: 5700,
        colorHex: "#00f0ff",
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "24V DC SELV" as const,
      })),
      // 7 on right long wall
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `uw_right_${i + 1}`,
        name: `Right Wall Recessed Submersible #${i + 1}`,
        wallSide: "right_long_wall" as const,
        position: { x: -10.5 + i * 3.5, y: 6.25, z: -0.65 },
        aimingAngle: 5,
        luminousFlux: 4200,
        powerWatts: 40,
        beamAngle: 90,
        cctKelvin: 5700,
        colorHex: "#00f0ff",
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "24V DC SELV" as const,
      })),
    ],
    overheadFixtures: [
      // 4 on left deck walkway (mounted 6.0m high, 1.8m setback from pool edge)
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `oh_left_${i + 1}`,
        name: `Deck Truss Asymmetric Floodlight L#${i + 1}`,
        mountingSide: "left_deck" as const,
        position: { x: -9.0 + i * 6.0, y: -8.0, z: 6.5 },
        aimingTarget: { x: -9.0 + i * 6.0, y: -1.0, z: 0 },
        luminousFlux: 18500,
        powerWatts: 145,
        beamSpreadX: 85,
        beamSpreadY: 45,
        cctKelvin: 5000,
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C5" as const,
      })),
      // 4 on right deck walkway
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `oh_right_${i + 1}`,
        name: `Deck Truss Asymmetric Floodlight R#${i + 1}`,
        mountingSide: "right_deck" as const,
        position: { x: -9.0 + i * 6.0, y: 8.0, z: 6.5 },
        aimingTarget: { x: -9.0 + i * 6.0, y: 1.0, z: 0 },
        luminousFlux: 18500,
        powerWatts: 145,
        beamSpreadX: 85,
        beamSpreadY: 45,
        cctKelvin: 5000,
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C5" as const,
      })),
    ],
  },

  // PRESET 2: HOTEL & RESORT INFINITY LEISURE POOL (15M x 7M)
  {
    id: "hotel_resort_15m",
    name: "Hotel & Resort Infinity Pool (15m × 7m)",
    category: "Hospitality & Leisure",
    description: "Atmospheric evening resort pool with warm white deck bollards and vibrant underwater cyan mood glow.",
    standardId: "HOTEL_RESORT_LEISURE",
    basin: {
      length: 15.0,
      width: 7.0,
      shallowDepth: 1.35,
      deepDepth: 1.35,
      isSlopedBottom: false,
      freeboard: 0.15,
      copingWidth: 0.30,
      deckWidth: 2.5,
      tileMaterial: "mosaic_caribbean_emerald",
      laneCount: 0,
      hasStartingBlocks: false,
      hasLadders: true,
      hasLifeguardChair: false,
    },
    water: {
      clarity: "standard_chlorinated",
      refractiveIndex: 1.333,
      transparencyPercent: 92,
      specularReflectancePercent: 50,
      absorptionAlpha: 0.08,
      showCausticEffect: true,
      showSurfaceRipples: true,
    },
    underwaterFixtures: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `uw_resort_l_${i + 1}`,
        name: `Lagoon Cyan Recessed LED L#${i + 1}`,
        wallSide: "left_long_wall" as const,
        position: { x: -5.25 + i * 3.5, y: -3.5, z: -0.55 },
        aimingAngle: 0,
        luminousFlux: 3000,
        powerWatts: 28,
        beamAngle: 100,
        cctKelvin: 4000,
        colorHex: "#00e5ff",
        dimmingPercent: 90,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "12V AC/DC SELV" as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `uw_resort_r_${i + 1}`,
        name: `Lagoon Cyan Recessed LED R#${i + 1}`,
        wallSide: "right_long_wall" as const,
        position: { x: -5.25 + i * 3.5, y: 3.5, z: -0.55 },
        aimingAngle: 0,
        luminousFlux: 3000,
        powerWatts: 28,
        beamAngle: 100,
        cctKelvin: 4000,
        colorHex: "#00e5ff",
        dimmingPercent: 90,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "12V AC/DC SELV" as const,
      })),
    ],
    overheadFixtures: [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `oh_resort_l_${i + 1}`,
        name: `Perimeter Soft Column Flood L#${i + 1}`,
        mountingSide: "left_deck" as const,
        position: { x: -4.5 + i * 4.5, y: -5.2, z: 3.8 },
        aimingTarget: { x: -4.5 + i * 4.5, y: -1.0, z: 0 },
        luminousFlux: 6200,
        powerWatts: 48,
        beamSpreadX: 90,
        beamSpreadY: 60,
        cctKelvin: 3000,
        dimmingPercent: 80,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C4" as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `oh_resort_r_${i + 1}`,
        name: `Perimeter Soft Column Flood R#${i + 1}`,
        mountingSide: "right_deck" as const,
        position: { x: -4.5 + i * 4.5, y: 5.2, z: 3.8 },
        aimingTarget: { x: -4.5 + i * 4.5, y: 1.0, z: 0 },
        luminousFlux: 6200,
        powerWatts: 48,
        beamSpreadX: 90,
        beamSpreadY: 60,
        cctKelvin: 3000,
        dimmingPercent: 80,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C4" as const,
      })),
    ],
  },

  // PRESET 3: SCHOOL / COMMUNITY TRAINING BASIN (25M x 10M)
  {
    id: "school_community_25m",
    name: "School & Community Training Basin (25m × 10m)",
    category: "Education & Public",
    description: "Multipurpose school pool with dual depth gradient (1.1m shallow end to 1.8m deep end).",
    standardId: "EN12193_CLASS_II",
    basin: {
      length: 25.0,
      width: 10.0,
      shallowDepth: 1.1,
      deepDepth: 1.8,
      isSlopedBottom: true,
      freeboard: 0.20,
      copingWidth: 0.30,
      deckWidth: 2.5,
      tileMaterial: "mosaic_cobalt_blue",
      laneCount: 5,
      hasStartingBlocks: true,
      hasLadders: true,
      hasLifeguardChair: true,
    },
    water: {
      clarity: "standard_chlorinated",
      refractiveIndex: 1.333,
      transparencyPercent: 92,
      specularReflectancePercent: 50,
      absorptionAlpha: 0.08,
      showCausticEffect: true,
      showSurfaceRipples: false,
    },
    underwaterFixtures: [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `uw_sch_l_${i + 1}`,
        name: `Wall Recessed Pool Flood L#${i + 1}`,
        wallSide: "left_long_wall" as const,
        position: { x: -9.0 + i * 4.5, y: -5.0, z: -0.60 },
        aimingAngle: 5,
        luminousFlux: 3500,
        powerWatts: 35,
        beamAngle: 85,
        cctKelvin: 5000,
        colorHex: "#38bdf8",
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "24V DC SELV" as const,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `uw_sch_r_${i + 1}`,
        name: `Wall Recessed Pool Flood R#${i + 1}`,
        wallSide: "right_long_wall" as const,
        position: { x: -9.0 + i * 4.5, y: 5.0, z: -0.60 },
        aimingAngle: 5,
        luminousFlux: 3500,
        powerWatts: 35,
        beamAngle: 85,
        cctKelvin: 5000,
        colorHex: "#38bdf8",
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP68" as const,
        voltage: "24V DC SELV" as const,
      })),
    ],
    overheadFixtures: [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `oh_sch_l_${i + 1}`,
        name: `High Ceiling Asymmetric Hall Flood L#${i + 1}`,
        mountingSide: "left_deck" as const,
        position: { x: -8.0 + i * 8.0, y: -7.0, z: 5.5 },
        aimingTarget: { x: -8.0 + i * 8.0, y: -1.0, z: 0 },
        luminousFlux: 14500,
        powerWatts: 115,
        beamSpreadX: 80,
        beamSpreadY: 50,
        cctKelvin: 4000,
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C4" as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `oh_sch_r_${i + 1}`,
        name: `High Ceiling Asymmetric Hall Flood R#${i + 1}`,
        mountingSide: "right_deck" as const,
        position: { x: -8.0 + i * 8.0, y: 7.0, z: 5.5 },
        aimingTarget: { x: -8.0 + i * 8.0, y: 1.0, z: 0 },
        luminousFlux: 14500,
        powerWatts: 115,
        beamSpreadX: 80,
        beamSpreadY: 50,
        cctKelvin: 4000,
        dimmingPercent: 100,
        isEnabled: true,
        ipRating: "IP65" as const,
        corrosionClass: "C4" as const,
      })),
    ],
  },
];
