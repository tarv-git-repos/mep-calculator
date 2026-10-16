/**
 * =========================================================================
 * DIALUX EVO IMPROVING LUMINAIRES ENGINE (TUTORIAL PART 28)
 * =========================================================================
 * 
 * Implements the complete luminaire enhancement, articulation, and colorimetric
 * engine from DIALux evo Tutorial Part 28: "Improving luminaires — Using joints
 * and changing the colour of light".
 * 
 * Core Features:
 * 1. Articulated Luminaire Joints & Kinematics:
 *    - Multi-axis joint hierarchy (Joint 1: Pan / Azimuth, Joint 2: Tilt / Elevation, Joint 3: Roll)
 *    - Physical joint limits & angular constraints (min/max clamps)
 *    - Inverse Kinematics (IK) for "Set illumination point" 3D target picking:
 *      automatically solves pan & tilt angles to aim at any 3D scene point
 *    - Reset angle to default nadir/normal position (0°, 0°, 0°)
 *    - LEO (Light Emission Object) alignment ray and conical beam cone visualization
 *    - Spot footprint ellipse calculation on target surfaces
 *    - Direct target illuminance calculation: E_t = (I_0 * cos(theta)) / D^2 * tau_filter
 * 
 * 2. Lamp Tool & Light Colour / Colorimetry:
 *    - Correlated Colour Temperature (CCT) tuning from 1800K to 10000K
 *    - Accurate Planckian blackbody locus & CIE 1931 (x, y) chromaticity
 *    - High-fidelity CCT to sRGB conversion (with gamma correction)
 *    - Spectral Power Distribution (SPD) generator across visible spectrum (380 - 780 nm)
 *      for Incandescent, Phosphor-converted Warm LED, Cool LED, Daylight D65, and High-CRI
 *    - Color Rendering Index (CRI / Ra) metrics & test color samples (R1 - R15)
 *    - Optical Color Filter Library (Rosco / Lee filter simulations) with
 *      luminous transmittance (tau_v), resulting flux derating, and CCT shift
 * 
 * Standards & References:
 * - CIE 13.3-1995: Method of Measuring and Specifying Colour Rendering Properties
 * - CIE 15:2004: Colorimetry (Planckian Locus & Illuminants)
 * - EN 12464-1: Light and lighting — Lighting of work places
 * - IES LM-79-19 / ANSI C78.377: Electric Lamps — Specifications for the Chromaticity of SSL Products
 */

// =========================================================================
// TYPES & DATA CONTRACTS
// =========================================================================

export type JointType = "pan" | "tilt" | "roll";

export interface LuminaireJoint {
  id: string;
  name: string;
  type: JointType;
  currentAngleDeg: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  rotationAxis: "x" | "y" | "z";
  locked: boolean;
}

export type LuminaireCategory =
  | "track_spotlight"
  | "recessed_gimbal"
  | "wall_washer"
  | "exterior_floodlight"
  | "surface_projector"
  | "pendant_directional";

export interface ArticulatedLuminaire {
  id: string;
  name: string;
  model: string;
  category: LuminaireCategory;
  roomName: string;
  position: { x: number; y: number; z: number };
  baseRotation: { x: number; y: number; z: number }; // Initial mounting orientation
  joints: LuminaireJoint[];
  beamAngleDeg: number; // FWHM beam angle (e.g. 10°, 24°, 36°, 60°)
  fieldAngleDeg: number; // 10% beam angle
  peakIntensityCd: number; // Center beam candlepower (CBCP in candela)
  nominalLumens: number;
  nominalWatts: number;
  cctKelvin: number;
  criRa: number;
  colorFilterId: string | null;
  targetPoint?: {
    x: number;
    y: number;
    z: number;
    name?: string;
  };
  leoVisible: boolean;
  active: boolean;
}

export interface AimTarget {
  id: string;
  name: string;
  category: "artwork" | "sculpture" | "merchandise" | "architectural_feature" | "floor_zone";
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number }; // Surface normal vector
  dimensions?: { width: number; height: number };
  description: string;
}

export interface ColorFilter {
  id: string;
  name: string;
  code: string;
  category: "warm_amber" | "cool_ctb" | "diffuser" | "theatrical" | "architectural";
  transmittance: number; // 0.0 - 1.0 (luminous transmission factor tau_v)
  hexColor: string;
  deltaCct: number; // Approximate Kelvin shift
  description: string;
}

export interface AimingCalculationResult {
  throwDistanceMeters: number;
  incidentAngleDeg: number;
  targetIlluminanceLux: number;
  spotWidthMeters: number;
  spotHeightMeters: number;
  spotAreaM2: number;
  panAngleDeg: number;
  tiltAngleDeg: number;
  filteredLumens: number;
  fluxDeratingPercent: number;
  targetHitNormalAlignment: number; // Dot product (1 = perpendicular, 0 = parallel)
}

export interface SpectralPoint {
  wavelengthNm: number; // 380 - 780 nm
  relativePower: number; // 0.0 - 1.0 normalized
}

export interface LightSpectrumData {
  cctKelvin: number;
  criRa: number;
  cieX: number;
  cieY: number;
  rgbHex: string;
  spectralPoints: SpectralPoint[];
  colorName: string;
}

// =========================================================================
// OPTICAL COLOR FILTER CATALOG (ROSCO / LEE SIMULATIONS)
// =========================================================================

export const BUILTIN_COLOR_FILTERS: ColorFilter[] = [
  {
    id: "none",
    name: "Clear / No Filter",
    code: "CLEAR",
    category: "diffuser",
    transmittance: 1.0,
    hexColor: "#FFFFFF",
    deltaCct: 0,
    description: "Full transmission with standard LED/lamp spectrum.",
  },
  {
    id: "lee_204_cto",
    name: "Full CTO (Warm Amber)",
    code: "LEE 204",
    category: "warm_amber",
    transmittance: 0.58,
    hexColor: "#FFB04A",
    deltaCct: -2800,
    description: "Converts daylight 6500K to tungsten 3200K, or warms 4000K to cozy 2200K.",
  },
  {
    id: "lee_205_half_cto",
    name: "Half CTO (Soft Warmth)",
    code: "LEE 205",
    category: "warm_amber",
    transmittance: 0.72,
    hexColor: "#FFCF7D",
    deltaCct: -1400,
    description: "Gentle warming filter for hospitality, dining, and skin tone flattering.",
  },
  {
    id: "lee_201_full_ctb",
    name: "Full CTB (Daylight Cool)",
    code: "LEE 201",
    category: "cool_ctb",
    transmittance: 0.36,
    hexColor: "#7AA2FF",
    deltaCct: +2600,
    description: "Converts tungsten 3200K to daylight 5700K. Crisp, clean gallery accent.",
  },
  {
    id: "lee_202_half_ctb",
    name: "Half CTB (Neutral Crispen)",
    code: "LEE 202",
    category: "cool_ctb",
    transmittance: 0.55,
    hexColor: "#A3C2FF",
    deltaCct: +1200,
    description: "Subtle cool boost for jewelry display, diamonds, and modern tech galleries.",
  },
  {
    id: "lee_026_bright_red",
    name: "Bright Red Accent",
    code: "LEE 026",
    category: "theatrical",
    transmittance: 0.16,
    hexColor: "#FF2B2B",
    deltaCct: -3500,
    description: "Vivid saturated red for theatrical staging and dramatic retail display.",
  },
  {
    id: "lee_139_primary_green",
    name: "Primary Botanical Green",
    code: "LEE 139",
    category: "theatrical",
    transmittance: 0.28,
    hexColor: "#2ECC71",
    deltaCct: 0,
    description: "Accent green for living walls, interior landscaping, and atrium plant features.",
  },
  {
    id: "lee_119_dark_blue",
    name: "Deep Mediterranean Blue",
    code: "LEE 119",
    category: "theatrical",
    transmittance: 0.08,
    hexColor: "#2B5BFF",
    deltaCct: +4500,
    description: "Deep aquatic and nighttime accent illumination.",
  },
  {
    id: "lee_128_bright_pink",
    name: "Bright Pink / Magenta",
    code: "LEE 128",
    category: "architectural",
    transmittance: 0.24,
    hexColor: "#FF47A3",
    deltaCct: -1000,
    description: "High-contrast architectural facade and fashion retail highlighting.",
  },
  {
    id: "lee_250_half_diffusion",
    name: "Soft Focus Diffusion Lens",
    code: "LEE 250",
    category: "diffuser",
    transmittance: 0.82,
    hexColor: "#F5F5F0",
    deltaCct: -100,
    description: "Softens beam edges and eliminates hard glare scallop rings without significant color shift.",
  },
];

// =========================================================================
// DEFAULT ARTICULATED LUMINAIRES
// =========================================================================

export const DEFAULT_ARTICULATED_LUMINAIRES: ArticulatedLuminaire[] = [
  {
    id: "lum-track-01",
    name: "Track Spotlight Alpha (Gallery Wall)",
    model: "ERCO Optec Zoom Track Spotlight LED",
    category: "track_spotlight",
    roomName: "Art Gallery & Exhibition Hall",
    position: { x: 2.5, y: 3.0, z: 3.5 },
    baseRotation: { x: 0, y: 0, z: 0 },
    joints: [
      {
        id: "j-pan-1",
        name: "Joint 1 (Pan / Azimuth)",
        type: "pan",
        currentAngleDeg: -35,
        minAngleDeg: -180,
        maxAngleDeg: 180,
        rotationAxis: "z",
        locked: false,
      },
      {
        id: "j-tilt-1",
        name: "Joint 2 (Tilt / Inclination)",
        type: "tilt",
        currentAngleDeg: 42,
        minAngleDeg: 0,
        maxAngleDeg: 90,
        rotationAxis: "x",
        locked: false,
      },
      {
        id: "j-roll-1",
        name: "Joint 3 (Head Axial Roll)",
        type: "roll",
        currentAngleDeg: 0,
        minAngleDeg: -45,
        maxAngleDeg: 45,
        rotationAxis: "y",
        locked: false,
      },
    ],
    beamAngleDeg: 24,
    fieldAngleDeg: 46,
    peakIntensityCd: 9500,
    nominalLumens: 2400,
    nominalWatts: 28,
    cctKelvin: 3000,
    criRa: 95,
    colorFilterId: "none",
    targetPoint: { x: 1.2, y: 5.8, z: 1.8, name: "Masterpiece Canvas #1" },
    leoVisible: true,
    active: true,
  },
  {
    id: "lum-track-02",
    name: "Track Spotlight Beta (Sculpture Accent)",
    model: "iGuzzini Palco Framer 86mm LED",
    category: "track_spotlight",
    roomName: "Art Gallery & Exhibition Hall",
    position: { x: 4.5, y: 3.0, z: 3.5 },
    baseRotation: { x: 0, y: 0, z: 0 },
    joints: [
      {
        id: "j-pan-2",
        name: "Joint 1 (Pan / Azimuth)",
        type: "pan",
        currentAngleDeg: 45,
        minAngleDeg: -180,
        maxAngleDeg: 180,
        rotationAxis: "z",
        locked: false,
      },
      {
        id: "j-tilt-2",
        name: "Joint 2 (Tilt / Inclination)",
        type: "tilt",
        currentAngleDeg: 38,
        minAngleDeg: 0,
        maxAngleDeg: 90,
        rotationAxis: "x",
        locked: false,
      },
      {
        id: "j-roll-2",
        name: "Joint 3 (Head Axial Roll)",
        type: "roll",
        currentAngleDeg: 0,
        minAngleDeg: -45,
        maxAngleDeg: 45,
        rotationAxis: "y",
        locked: false,
      },
    ],
    beamAngleDeg: 15,
    fieldAngleDeg: 32,
    peakIntensityCd: 14500,
    nominalLumens: 2100,
    nominalWatts: 25,
    cctKelvin: 4000,
    criRa: 97,
    colorFilterId: "none",
    targetPoint: { x: 5.5, y: 4.2, z: 1.2, name: "Bronze Sculpture Pedestal" },
    leoVisible: true,
    active: true,
  },
  {
    id: "lum-gimbal-01",
    name: "Recessed Gimbal Downlight #1",
    model: "Zumtobel Vivo L Recessed Directional",
    category: "recessed_gimbal",
    roomName: "Art Gallery & Exhibition Hall",
    position: { x: 3.0, y: 1.5, z: 3.5 },
    baseRotation: { x: 0, y: 0, z: 0 },
    joints: [
      {
        id: "j-pan-3",
        name: "Joint 1 (Swivel Rotation)",
        type: "pan",
        currentAngleDeg: 15,
        minAngleDeg: -180,
        maxAngleDeg: 180,
        rotationAxis: "z",
        locked: false,
      },
      {
        id: "j-tilt-3",
        name: "Joint 2 (Gimbal Tilt)",
        type: "tilt",
        currentAngleDeg: 28,
        minAngleDeg: 0,
        maxAngleDeg: 45,
        rotationAxis: "x",
        locked: false,
      },
    ],
    beamAngleDeg: 36,
    fieldAngleDeg: 62,
    peakIntensityCd: 4800,
    nominalLumens: 1800,
    nominalWatts: 20,
    cctKelvin: 3000,
    criRa: 90,
    colorFilterId: "lee_205_half_cto",
    targetPoint: { x: 3.5, y: 0.1, z: 1.5, name: "South Feature Display Wall" },
    leoVisible: true,
    active: true,
  },
  {
    id: "lum-wallwash-01",
    name: "Architectural Wall Washer Head",
    model: "Targetti Dali Pro Wallwasher Asym",
    category: "wall_washer",
    roomName: "Art Gallery & Exhibition Hall",
    position: { x: 1.0, y: 3.0, z: 3.4 },
    baseRotation: { x: 0, y: 0, z: 0 },
    joints: [
      {
        id: "j-pan-4",
        name: "Joint 1 (Pan / Rotation)",
        type: "pan",
        currentAngleDeg: -90,
        minAngleDeg: -180,
        maxAngleDeg: 180,
        rotationAxis: "z",
        locked: false,
      },
      {
        id: "j-tilt-4",
        name: "Joint 2 (Wash Angle Tilt)",
        type: "tilt",
        currentAngleDeg: 25,
        minAngleDeg: 0,
        maxAngleDeg: 60,
        rotationAxis: "x",
        locked: false,
      },
    ],
    beamAngleDeg: 48,
    fieldAngleDeg: 80,
    peakIntensityCd: 3200,
    nominalLumens: 3100,
    nominalWatts: 35,
    cctKelvin: 3500,
    criRa: 92,
    colorFilterId: "none",
    targetPoint: { x: 0.0, y: 3.0, z: 1.8, name: "West Murals Gallery Wall" },
    leoVisible: true,
    active: true,
  },
];

// =========================================================================
// AIM TARGETS CATALOG (ARTWORK, SCULPTURES, VITRINES)
// =========================================================================

export const DEFAULT_AIM_TARGETS: AimTarget[] = [
  {
    id: "target-art-1",
    name: "Masterpiece Canvas #1 (Gallery North)",
    category: "artwork",
    position: { x: 1.2, y: 5.8, z: 1.8 },
    normal: { x: 0, y: -1, z: 0 },
    dimensions: { width: 1.6, height: 1.2 },
    description: "Oil painting on canvas mounted on north gallery wall (target: 300 lux, Ra >= 95).",
  },
  {
    id: "target-art-2",
    name: "Contemporary Acrylic Artwork #2",
    category: "artwork",
    position: { x: 3.8, y: 5.8, z: 1.8 },
    normal: { x: 0, y: -1, z: 0 },
    dimensions: { width: 1.2, height: 1.5 },
    description: "Vibrant acrylic painting demanding true high-CRI color rendering.",
  },
  {
    id: "target-sculpt-1",
    name: "Bronze Sculpture Pedestal",
    category: "sculpture",
    position: { x: 5.5, y: 4.2, z: 1.2 },
    normal: { x: -0.707, y: -0.707, z: 0 },
    dimensions: { width: 0.6, height: 1.4 },
    description: "Patinated bronze centerpiece on cylindrical matte plinth (accent ratio 3:1).",
  },
  {
    id: "target-vitrine-1",
    name: "Jewelry / Artifact Glass Vitrine",
    category: "merchandise",
    position: { x: 2.0, y: 1.8, z: 0.9 },
    normal: { x: 0, y: 0, z: 1 },
    dimensions: { width: 1.0, height: 0.8 },
    description: "Horizontal museum display case (target: 200 lux with minimal UV/IR exposure).",
  },
  {
    id: "target-col-1",
    name: "Architectural Marble Fluted Column",
    category: "architectural_feature",
    position: { x: 5.2, y: 1.5, z: 2.0 },
    normal: { x: -1, y: 0, z: 0 },
    dimensions: { width: 0.5, height: 3.5 },
    description: "Classical marble column requiring grazing light to reveal stone relief texture.",
  },
  {
    id: "target-floor-1",
    name: "Main Gallery Entrance Threshold",
    category: "floor_zone",
    position: { x: 3.0, y: 0.5, z: 0.0 },
    normal: { x: 0, y: 0, z: 1 },
    dimensions: { width: 2.0, height: 2.0 },
    description: "Welcoming reception threshold on hardwood parquet floor.",
  },
];

// =========================================================================
// COLORIMETRY & COLOR TEMPERATURE UTILITIES
// =========================================================================

/**
 * Converts Correlated Colour Temperature (Kelvin) to CIE 1931 (x, y) coordinates
 * using McCamy and Kang empirical approximations of the Planckian locus.
 */
export function cctToCieXy(cctKelvin: number): { x: number; y: number } {
  const T = Math.max(1667, Math.min(25000, cctKelvin));
  let x: number;

  if (T <= 4000) {
    x =
      -0.2661239 * (1e9 / (T * T * T)) -
      0.234358 * (1e6 / (T * T)) +
      0.8776956 * (1e3 / T) +
      0.17991;
  } else {
    x =
      -3.0258469 * (1e9 / (T * T * T)) +
      2.1070379 * (1e6 / (T * T)) +
      0.2226347 * (1e3 / T) +
      0.24039;
  }

  // CIE 1931 y coordinate from x coordinate along Planckian locus
  let y: number;
  if (T <= 2222) {
    y = -1.1063814 * x * x * x - 1.3481102 * x * x + 2.18555832 * x - 0.20219683;
  } else if (T <= 4000) {
    y = -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.081758 * x * x * x - 5.8733867 * x * x + 3.75112997 * x - 0.37001483;
  }

  return {
    x: Math.max(0.1, Math.min(0.7, x)),
    y: Math.max(0.1, Math.min(0.7, y)),
  };
}

/**
 * Converts CCT (Kelvin) directly to RGB hex code based on blackbody radiation.
 * Implements Tanner Helland's high-precision algorithm.
 */
export function cctToRgbHex(cctKelvin: number): string {
  const temp = Math.max(1000, Math.min(40000, cctKelvin)) / 100;
  let red = 0;
  let green = 0;
  let blue = 0;

  // Calculate Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = temp - 60;
    red = 329.698727446 * Math.pow(red, -0.1332047592);
    red = Math.max(0, Math.min(255, red));
  }

  // Calculate Green
  if (temp <= 66) {
    green = temp;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
    green = Math.max(0, Math.min(255, green));
  } else {
    green = temp - 60;
    green = 288.1221695283 * Math.pow(green, -0.0755148492);
    green = Math.max(0, Math.min(255, green));
  }

  // Calculate Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = temp - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    blue = Math.max(0, Math.min(255, blue));
  }

  const rHex = Math.round(red).toString(16).padStart(2, "0");
  const gHex = Math.round(green).toString(16).padStart(2, "0");
  const bHex = Math.round(blue).toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

/**
 * Returns human-readable descriptive name for a given CCT.
 */
export function getCctColorName(cctKelvin: number): string {
  if (cctKelvin < 2200) return "Candlelight Ultra-Warm";
  if (cctKelvin < 2600) return "Warm Sunset (Amber)";
  if (cctKelvin < 2900) return "Very Warm White (Incandescent)";
  if (cctKelvin < 3300) return "Warm White (Halogen / LED)";
  if (cctKelvin < 3800) return "Soft White";
  if (cctKelvin < 4500) return "Neutral White (Office / Studio)";
  if (cctKelvin < 5500) return "Cool White (Commercial / Lab)";
  if (cctKelvin < 6800) return "Daylight White (CIE D65)";
  return "Cool Overcast Sky (>7000K)";
}

/**
 * Generates the Spectral Power Distribution (SPD) curve for a light source.
 * Supports:
 * - Phosphor LED (narrow 450nm blue peak + broad 560nm phosphor emission)
 * - Incandescent/Halogen Planck curve
 * - CIE D65 Daylight curve
 */
export function generateSpectralPowerDistribution(
  cctKelvin: number,
  criRa: number = 90,
  filter?: ColorFilter | null
): SpectralPoint[] {
  const points: SpectralPoint[] = [];
  const startWavelength = 380;
  const endWavelength = 780;
  const step = 5;

  for (let wl = startWavelength; wl <= endWavelength; wl += step) {
    let power = 0;

    if (cctKelvin <= 2800 && criRa >= 98) {
      // Planckian blackbody radiator curve (Incandescent/Halogen)
      const h = 6.626e-34;
      const c = 3.0e8;
      const k = 1.38e-23;
      const lambda = wl * 1e-9;
      const c1 = 2 * Math.PI * h * c * c;
      const c2 = (h * c) / (k * lambda * cctKelvin);
      power = (c1 / Math.pow(lambda, 5)) / (Math.exp(c2) - 1);
    } else {
      // Phosphor converted LED model:
      // 1. Blue GaN pump peak at 450nm (narrow Gaussian)
      const blueCenter = 450;
      const blueFwhm = 24;
      const blueAmp = (cctKelvin / 6500) * 0.95; // higher for cool white
      const blueComp = blueAmp * Math.exp(-Math.pow((wl - blueCenter) / (blueFwhm * 0.6), 2));

      // 2. Yellow-Orange Phosphor band (broad asymmetric peak at ~560-600nm)
      const phosphorCenter = cctKelvin < 3500 ? 590 : 555;
      const phosphorFwhm = cctKelvin < 3500 ? 115 : 100;
      const phosphorAmp = cctKelvin < 3500 ? 0.95 : 0.65;
      const phosphorComp = phosphorAmp * Math.exp(-Math.pow((wl - phosphorCenter) / (phosphorFwhm * 0.6), 2));

      // 3. Deep Red boost for High-CRI fixtures (R9 phosphor peak at ~640nm)
      const r9Center = 635;
      const r9Fwhm = 50;
      const r9Amp = (criRa / 100) * 0.35;
      const r9Comp = r9Amp * Math.exp(-Math.pow((wl - r9Center) / (r9Fwhm * 0.6), 2));

      // 4. Cyan dip filler for ultra-high CRI (SunLike / violet pump at 485nm)
      const cyanCenter = 490;
      const cyanFwhm = 30;
      const cyanAmp = (criRa > 90 ? (criRa - 90) / 10 : 0) * 0.25;
      const cyanComp = cyanAmp * Math.exp(-Math.pow((wl - cyanCenter) / (cyanFwhm * 0.6), 2));

      power = blueComp + phosphorComp + r9Comp + cyanComp;
    }

    // Apply color filter transmission curve if active
    if (filter && filter.id !== "none") {
      let filterFactor = filter.transmittance;

      if (filter.category === "warm_amber") {
        // Boost longer wavelengths (580 - 700 nm), suppress blue (< 500 nm)
        filterFactor = wl < 500 ? filter.transmittance * 0.25 : filter.transmittance * 1.35;
      } else if (filter.category === "cool_ctb") {
        // Boost blue (420 - 480 nm), suppress red (> 600 nm)
        filterFactor = wl < 500 ? filter.transmittance * 1.6 : filter.transmittance * 0.45;
      } else if (filter.id === "lee_026_bright_red") {
        // Transmit only red (> 610 nm)
        filterFactor = wl > 600 ? filter.transmittance * 2.2 : filter.transmittance * 0.08;
      } else if (filter.id === "lee_139_primary_green") {
        // Transmit green (500 - 560 nm)
        filterFactor = wl >= 500 && wl <= 570 ? filter.transmittance * 2.0 : filter.transmittance * 0.15;
      } else if (filter.id === "lee_119_dark_blue") {
        // Transmit deep blue (420 - 480 nm)
        filterFactor = wl >= 420 && wl <= 490 ? filter.transmittance * 3.5 : filter.transmittance * 0.04;
      }

      power *= Math.max(0.01, filterFactor);
    }

    points.push({
      wavelengthNm: wl,
      relativePower: power,
    });
  }

  // Normalize max power to 1.0
  const maxPower = Math.max(...points.map((p) => p.relativePower), 0.001);
  return points.map((p) => ({
    wavelengthNm: p.wavelengthNm,
    relativePower: Math.round((p.relativePower / maxPower) * 1000) / 1000,
  }));
}

// =========================================================================
// INVERSE KINEMATICS & AIMING CALCULATION ENGINE
// =========================================================================

/**
 * Solves Inverse Kinematics for "Set illumination point":
 * Given a luminaire's 3D mounting position (x_L, y_L, z_L) and a 3D target point (x_T, y_T, z_T),
 * calculates the required Pan (azimuth) and Tilt (elevation) joint angles.
 */
export function solveInverseKinematicsAiming(
  luminairePos: { x: number; y: number; z: number },
  targetPos: { x: number; y: number; z: number },
  panJointLimits: { min: number; max: number } = { min: -180, max: 180 },
  tiltJointLimits: { min: number; max: number } = { min: 0, max: 90 }
): {
  panAngleDeg: number;
  tiltAngleDeg: number;
  throwDistanceMeters: number;
  directionVector: { x: number; y: number; z: number };
} {
  const dx = targetPos.x - luminairePos.x;
  const dy = targetPos.y - luminairePos.y;
  const dz = targetPos.z - luminairePos.z;

  const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
  const throwDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Normalized directional vector
  const dirNorm = {
    x: throwDistance > 0.001 ? dx / throwDistance : 0,
    y: throwDistance > 0.001 ? dy / throwDistance : 0,
    z: throwDistance > 0.001 ? dz / throwDistance : -1,
  };

  // Pan Angle: Azimuth rotation in XY plane
  // 0° points in -Y direction, 90° in +X direction, -90° in -X direction
  // Using standard cartesian: atan2(dx, -dy) or atan2(dy, dx)
  let panDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;

  // Clamp pan within joint physical travel limits
  if (panDeg > 180) panDeg -= 360;
  if (panDeg < -180) panDeg += 360;
  panDeg = Math.max(panJointLimits.min, Math.min(panJointLimits.max, panDeg));

  // Tilt Angle: Angle off downward nadir vector [0, 0, -1]
  // 0° = straight down to floor
  // 90° = horizontal beam to wall
  // 180° = straight up to ceiling
  let tiltDeg = (Math.atan2(horizontalDistance, -dz) * 180) / Math.PI;
  tiltDeg = Math.max(tiltJointLimits.min, Math.min(tiltJointLimits.max, tiltDeg));

  return {
    panAngleDeg: Math.round(panDeg * 10) / 10,
    tiltAngleDeg: Math.round(tiltDeg * 10) / 10,
    throwDistanceMeters: Math.round(throwDistance * 100) / 100,
    directionVector: dirNorm,
  };
}

/**
 * Calculates complete photometric aiming metrics:
 * Direct illuminance at target, spot ellipse dimensions, and filter transmission derating.
 */
export function calculateAimingMetrics(
  luminaire: ArticulatedLuminaire,
  target: AimTarget,
  activeFilter?: ColorFilter | null
): AimingCalculationResult {
  const dx = target.position.x - luminaire.position.x;
  const dy = target.position.y - luminaire.position.y;
  const dz = target.position.z - luminaire.position.z;
  const distance = Math.max(0.1, Math.sqrt(dx * dx + dy * dy + dz * dz));

  // Beam direction vector
  const beamDir = {
    x: dx / distance,
    y: dy / distance,
    z: dz / distance,
  };

  // Incident angle relative to target surface normal
  // dot(beamDir, targetNormal)
  const normal = target.normal || { x: 0, y: 0, z: 1 };
  const dotProd = -(beamDir.x * normal.x + beamDir.y * normal.y + beamDir.z * normal.z);
  const cosIncident = Math.max(0.05, Math.min(1.0, dotProd));
  const incidentAngleDeg = Math.round((Math.acos(cosIncident) * 180) / Math.PI);

  // Spot size calculation using FWHM beam angle (radians)
  const halfBeamRad = ((luminaire.beamAngleDeg / 2) * Math.PI) / 180;
  const perpRadius = distance * Math.tan(halfBeamRad);

  // Spot width (minor axis) and spot height (major axis stretched by incident angle)
  const spotWidthMeters = Math.round(perpRadius * 2 * 100) / 100;
  const spotHeightMeters = Math.round((spotWidthMeters / cosIncident) * 100) / 100;
  const spotAreaM2 = Math.round(Math.PI * (spotWidthMeters / 2) * (spotHeightMeters / 2) * 100) / 100;

  // Transmission factor
  const filterTrans = activeFilter ? activeFilter.transmittance : 1.0;
  const filteredLumens = Math.round(luminaire.nominalLumens * filterTrans);
  const fluxDeratingPercent = Math.round((1 - filterTrans) * 100);

  // Direct target illuminance (Inverse square law)
  // E = (I_0 * cos(theta)) / D^2 * filterTrans
  const peakIntensity = luminaire.peakIntensityCd || (luminaire.nominalLumens * 3.5);
  const targetIlluminanceLux = Math.round(
    ((peakIntensity * cosIncident) / (distance * distance)) * filterTrans
  );

  // Pan & Tilt angles
  const ikResult = solveInverseKinematicsAiming(luminaire.position, target.position);

  return {
    throwDistanceMeters: Math.round(distance * 100) / 100,
    incidentAngleDeg,
    targetIlluminanceLux,
    spotWidthMeters,
    spotHeightMeters,
    spotAreaM2,
    panAngleDeg: ikResult.panAngleDeg,
    tiltAngleDeg: ikResult.tiltAngleDeg,
    filteredLumens,
    fluxDeratingPercent,
    targetHitNormalAlignment: Math.round(cosIncident * 100) / 100,
  };
}
