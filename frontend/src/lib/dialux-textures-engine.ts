/**
 * =========================================================================
 * DIALUX EVO DETAILED TEXTURES & MATERIALS ENGINE (TUTORIAL PART 27)
 * =========================================================================
 * 
 * Implements the complete Materials, Detailed Textures & Surface Mapping System
 * from DIALux evo Tutorial Part 27 ("Enhancing projects with detailed textures"):
 * 
 * 1. DETAILED TEXTURE MAPPING & UV TRANSFORMS:
 *    - Real-world metric physical sizing: Width X (m) and Height Y (m)
 *      (e.g. 0.60m x 0.60m porcelain tiles, 0.20m x 1.20m parquet planks)
 *    - Texture rotation: 0°, 45°, 90°, 180° or continuous angle [0° - 360°]
 *    - Texture offset (U, V Shift) to align grout lines with walls/doors
 *    - Tiling repeat modes: repeat, mirror, clamp
 * 
 * 2. OPTICAL PROPERTIES & PHOTOMETRIC RADIOSITY:
 *    - Diffuse reflectance factor rho (0.05 to 0.95)
 *    - Specular reflectance rho_s & glossiness (polished, satin, matte)
 *    - Surface roughness (Three.js PBR roughness)
 *    - Metallic factor (dielectric vs metal)
 *    - Transparency tau & refractive index n (glass, clear acrylic)
 *    - Self-luminous / emissive materials (cd/m²)
 *    - Radiosity impact solver: inter-reflections alter room utilization CU
 *      and maintained illuminance E_m.
 * 
 * 3. ADVANCED APPLICATION WORKFLOWS:
 *    - Pipette / Eyedropper tool: sample material from 3D surface
 *    - Paint tool: apply material to selected surface
 *    - Shift-Key batch shortcut: apply to all room walls with one click
 *    - Replace Material tool: global swap of material across all surfaces
 *    - High-resolution procedural canvas texture generators
 */

export type TextureTilingMode = "repeat" | "mirror" | "clamp";

export type SurfaceType =
  | "floor"
  | "ceiling"
  | "wall_north"
  | "wall_south"
  | "wall_east"
  | "wall_west"
  | "accent_feature"
  | "exterior_ground";

export type MaterialCategory =
  | "wood"
  | "stone_marble"
  | "ceramic_tile"
  | "concrete_plaster"
  | "carpet_fabric"
  | "metal"
  | "glass"
  | "outdoor_ground"
  | "custom";

export interface TextureTransform {
  sizeXMeters: number;     // Physical width of 1 texture tile (m)
  sizeYMeters: number;     // Physical height of 1 texture tile (m)
  rotationDeg: number;     // Rotation angle in degrees (0 - 360)
  offsetX: number;         // U-offset shift (0.0 - 1.0)
  offsetY: number;         // V-offset shift (0.0 - 1.0)
  lockAspectRatio: boolean;
  tilingMode: TextureTilingMode;
}

export interface DetailedMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  colorHex: string;
  reflectanceRho: number;  // 0.05 to 0.95 (photometric reflectance)
  specularRho: number;     // 0.00 to 0.90 (gloss / specular reflection)
  roughness: number;       // 0.00 (mirror) to 1.00 (rough matte)
  metallic: number;        // 0.00 (dielectric) to 1.00 (metal)
  transparency: number;    // 0.00 (opaque) to 1.00 (clear glass)
  refractiveIndex: number; // 1.00 (air) to 1.52 (glass)
  emissiveLuminanceCdM2: number; // 0 for passive, >0 for glowing panel
  transform: TextureTransform;
  texturePattern: string;  // generator id or image data
  description: string;
  isBuiltin: boolean;
}

export interface SurfaceMaterialAssignment {
  surfaceId: SurfaceType;
  surfaceName: string;
  materialId: string;
  customTransform?: Partial<TextureTransform>;
  areaM2: number;
}

export interface RadiosityImpactResult {
  averageRoomReflectance: number; // weighted rho
  roomCavityRatio: number;        // RCR
  coefficientOfUtilization: number; // CU
  estimatedAverageLux: number;    // E_m (lx)
  luxMultiplierFromStandard: number; // e.g. 1.18 (+18% boost due to high reflectance)
  wallAverageReflectance: number;
  ceilingReflectance: number;
  floorReflectance: number;
}

// =========================================================================
// 1. BUILT-IN DETAILED MATERIALS CATALOG
// =========================================================================

export const BUILTIN_DETAILED_MATERIALS: DetailedMaterial[] = [
  // 1. WOODS
  {
    id: "wood_natural_oak",
    name: "Natural European Oak Parquet",
    category: "wood",
    colorHex: "#d4a373",
    reflectanceRho: 0.38,
    specularRho: 0.15,
    roughness: 0.45,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.20,
      sizeYMeters: 0.20,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "parquet_oak",
    description: "Elegant satin-finish natural oak planks with subtle wood grain.",
    isBuiltin: true,
  },
  {
    id: "wood_dark_walnut",
    name: "American Dark Walnut Planks",
    category: "wood",
    colorHex: "#58311e",
    reflectanceRho: 0.20,
    specularRho: 0.22,
    roughness: 0.35,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.40,
      sizeYMeters: 0.22,
      rotationDeg: 45,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "parquet_walnut",
    description: "Deep luxurious walnut with high specular highlights and rich tones.",
    isBuiltin: true,
  },

  // 2. STONES & MARBLES
  {
    id: "marble_carrara_white",
    name: "Polished Carrara White Marble",
    category: "stone_marble",
    colorHex: "#f0f2f5",
    reflectanceRho: 0.74,
    specularRho: 0.45,
    roughness: 0.12,
    metallic: 0.05,
    transparency: 0.0,
    refractiveIndex: 1.55,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.60,
      sizeYMeters: 0.80,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "marble_carrara",
    description: "High-gloss precious marble slab with delicate grey veining.",
    isBuiltin: true,
  },
  {
    id: "granite_black_galaxy",
    name: "Polished Black Galaxy Granite",
    category: "stone_marble",
    colorHex: "#1f2421",
    reflectanceRho: 0.16,
    specularRho: 0.55,
    roughness: 0.10,
    metallic: 0.1,
    transparency: 0.0,
    refractiveIndex: 1.6,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.00,
      sizeYMeters: 1.00,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "granite_dark",
    description: "Ultra-dark mirror finish granite with subtle crystalline sparkle.",
    isBuiltin: true,
  },

  // 3. CERAMIC TILES
  {
    id: "tile_porcelain_grey_60x60",
    name: "Porcelain Matte Floor Tiles (60×60 cm)",
    category: "ceramic_tile",
    colorHex: "#94a3b8",
    reflectanceRho: 0.42,
    specularRho: 0.10,
    roughness: 0.60,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 0.60,
      sizeYMeters: 0.60,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "ceramic_grid_60",
    description: "Architectural large-format grey porcelain with 2mm grout joint.",
    isBuiltin: true,
  },
  {
    id: "tile_subway_glossy_white",
    name: "Glossy Subway Wall Tiles (10×30 cm)",
    category: "ceramic_tile",
    colorHex: "#f8fafc",
    reflectanceRho: 0.82,
    specularRho: 0.40,
    roughness: 0.15,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.52,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 0.30,
      sizeYMeters: 0.10,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "subway_brick",
    description: "Bright reflective glazed ceramic subway tiles for washrooms and accent walls.",
    isBuiltin: true,
  },

  // 4. CONCRETE & PLASTER
  {
    id: "concrete_smooth_fairfaced",
    name: "Fair-Faced Architectural Concrete",
    category: "concrete_plaster",
    colorHex: "#64748b",
    reflectanceRho: 0.34,
    specularRho: 0.05,
    roughness: 0.85,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 2.00,
      sizeYMeters: 1.00,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "concrete_panels",
    description: "Modern cast concrete with formwork tie holes and subtle porous texture.",
    isBuiltin: true,
  },
  {
    id: "plaster_acoustic_ceiling_white",
    name: "Acoustic Grid Ceiling Tiles (60×60 cm)",
    category: "concrete_plaster",
    colorHex: "#f1f5f9",
    reflectanceRho: 0.82,
    specularRho: 0.04,
    roughness: 0.90,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.45,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 0.60,
      sizeYMeters: 0.60,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "acoustic_perforated",
    description: "Standard commercial office suspended modular ceiling tile with micro-perforations.",
    isBuiltin: true,
  },

  // 5. CARPET & FABRIC
  {
    id: "carpet_commercial_charcoal",
    name: "Commercial Loop Pile Carpet (Charcoal)",
    category: "carpet_fabric",
    colorHex: "#334155",
    reflectanceRho: 0.18,
    specularRho: 0.02,
    roughness: 0.98,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.4,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 0.50,
      sizeYMeters: 0.50,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "carpet_weave",
    description: "High-traffic commercial modular carpet tiles with low reflectance.",
    isBuiltin: true,
  },

  // 6. METALS
  {
    id: "metal_brushed_aluminum",
    name: "Brushed Aluminum Cladding",
    category: "metal",
    colorHex: "#cbd5e1",
    reflectanceRho: 0.65,
    specularRho: 0.70,
    roughness: 0.28,
    metallic: 0.92,
    transparency: 0.0,
    refractiveIndex: 1.4,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.00,
      sizeYMeters: 2.50,
      rotationDeg: 90,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: false,
      tilingMode: "repeat",
    },
    texturePattern: "brushed_metal",
    description: "Anodized architectural brushed metal panel with linear reflections.",
    isBuiltin: true,
  },

  // 7. GLASS & TRANSLUCENT
  {
    id: "glass_clear_float",
    name: "Clear Architectural Float Glass",
    category: "glass",
    colorHex: "#e2e8f0",
    reflectanceRho: 0.08,
    specularRho: 0.85,
    roughness: 0.02,
    metallic: 0.0,
    transparency: 0.88,
    refractiveIndex: 1.52,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.00,
      sizeYMeters: 1.00,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "clamp",
    },
    texturePattern: "plain",
    description: "Standard architectural glazing with high transmission and specular reflectance.",
    isBuiltin: true,
  },

  // 8. OUTDOOR GROUNDS
  {
    id: "outdoor_asphalt_pavement",
    name: "Dark Exterior Asphalt Road Pavement",
    category: "outdoor_ground",
    colorHex: "#1e293b",
    reflectanceRho: 0.12,
    specularRho: 0.06,
    roughness: 0.92,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 2.00,
      sizeYMeters: 2.00,
      rotationDeg: 0,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "asphalt_grain",
    description: "Granular outdoor blacktop asphalt for parking lots and access roads.",
    isBuiltin: true,
  },
  {
    id: "outdoor_concrete_pavers",
    name: "Interlocking Herringbone Pavers",
    category: "outdoor_ground",
    colorHex: "#94a3b8",
    reflectanceRho: 0.32,
    specularRho: 0.08,
    roughness: 0.80,
    metallic: 0.0,
    transparency: 0.0,
    refractiveIndex: 1.5,
    emissiveLuminanceCdM2: 0,
    transform: {
      sizeXMeters: 1.00,
      sizeYMeters: 1.00,
      rotationDeg: 45,
      offsetX: 0,
      offsetY: 0,
      lockAspectRatio: true,
      tilingMode: "repeat",
    },
    texturePattern: "herringbone_pavers",
    description: "Durable concrete interlocking pavers for pedestrian plazas and courtyards.",
    isBuiltin: true,
  },
];

// =========================================================================
// 2. DEFAULT SURFACE ASSIGNMENTS FOR PROJECT ROOM
// =========================================================================

export const DEFAULT_SURFACE_ASSIGNMENTS: SurfaceMaterialAssignment[] = [
  { surfaceId: "floor", surfaceName: "Floor Surface", materialId: "wood_natural_oak", areaM2: 80.0 },
  { surfaceId: "ceiling", surfaceName: "Suspended Ceiling", materialId: "plaster_acoustic_ceiling_white", areaM2: 80.0 },
  { surfaceId: "wall_north", surfaceName: "North Wall (Glazed)", materialId: "concrete_smooth_fairfaced", areaM2: 32.0 },
  { surfaceId: "wall_south", surfaceName: "South Wall", materialId: "tile_subway_glossy_white", areaM2: 32.0 },
  { surfaceId: "wall_east", surfaceName: "East Wall (Partition)", materialId: "concrete_smooth_fairfaced", areaM2: 25.6 },
  { surfaceId: "wall_west", surfaceName: "West Wall", materialId: "concrete_smooth_fairfaced", areaM2: 25.6 },
  { surfaceId: "accent_feature", surfaceName: "Reception Accent Feature", materialId: "marble_carrara_white", areaM2: 12.0 },
  { surfaceId: "exterior_ground", surfaceName: "Exterior Car Park / Ground", materialId: "outdoor_asphalt_pavement", areaM2: 240.0 },
];

// =========================================================================
// 3. PHOTOMETRIC RADIOSITY & INTER-REFLECTION CALCULATION
// =========================================================================

/**
 * Calculates Room Cavity Ratio (RCR), weighted average reflectance,
 * and the resulting photometric boost/derating on maintained illuminance.
 */
export function calculateRadiosityImpact(
  roomLengthM: number,
  roomWidthM: number,
  roomHeightM: number,
  assignments: SurfaceMaterialAssignment[],
  materialsMap: Record<string, DetailedMaterial>,
  baseLumensInstalled: number = 36000
): RadiosityImpactResult {
  const floorMat = materialsMap[assignments.find((a) => a.surfaceId === "floor")?.materialId || ""] || BUILTIN_DETAILED_MATERIALS[0];
  const ceilMat = materialsMap[assignments.find((a) => a.surfaceId === "ceiling")?.materialId || ""] || BUILTIN_DETAILED_MATERIALS[7];

  const wallAssignments = assignments.filter((a) => a.surfaceId.startsWith("wall_"));
  let totalWallArea = 0;
  let weightedWallReflectance = 0;

  wallAssignments.forEach((wa) => {
    const mat = materialsMap[wa.materialId] || BUILTIN_DETAILED_MATERIALS[6];
    totalWallArea += wa.areaM2;
    weightedWallReflectance += wa.areaM2 * mat.reflectanceRho;
  });

  const avgWallRho = totalWallArea > 0 ? weightedWallReflectance / totalWallArea : 0.50;
  const floorRho = floorMat.reflectanceRho;
  const ceilRho = ceilMat.reflectanceRho;

  // Total room surface area
  const floorArea = roomLengthM * roomWidthM;
  const totalRoomArea = 2 * floorArea + totalWallArea;
  const totalWeightedRho = (floorArea * floorRho + floorArea * ceilRho + weightedWallReflectance) / totalRoomArea;

  // Room Cavity Ratio (RCR): RCR = 5 * H * (L + W) / (L * W)
  const rcr = floorArea > 0 ? (5 * roomHeightM * (roomLengthM + roomWidthM)) / floorArea : 2.5;

  // Approximate Coefficient of Utilization (CU) based on LiTG / IES formula
  // CU depends strongly on ceiling reflectance, wall reflectance, and RCR
  const baseCU = 0.55 * Math.exp(-0.08 * rcr);
  const reflectanceBonus = (ceilRho - 0.70) * 0.15 + (avgWallRho - 0.50) * 0.25 + (floorRho - 0.20) * 0.10;
  const cu = Math.max(0.20, Math.min(0.85, baseCU + reflectanceBonus));

  // Maintained Illuminance: E = (Total Lumens * CU * MF) / Area
  const mf = 0.80;
  const estimatedLux = (baseLumensInstalled * cu * mf) / Math.max(1, floorArea);

  // Compare with baseline standard room (70/50/20)
  const baselineCU = baseCU;
  const luxMultiplier = baselineCU > 0 ? cu / baselineCU : 1.0;

  return {
    averageRoomReflectance: Math.round(totalWeightedRho * 100) / 100,
    roomCavityRatio: Math.round(rcr * 100) / 100,
    coefficientOfUtilization: Math.round(cu * 100) / 100,
    estimatedAverageLux: Math.round(estimatedLux),
    luxMultiplierFromStandard: Math.round(luxMultiplier * 100) / 100,
    wallAverageReflectance: Math.round(avgWallRho * 100) / 100,
    ceilingReflectance: Math.round(ceilRho * 100) / 100,
    floorReflectance: Math.round(floorRho * 100) / 100,
  };
}

// =========================================================================
// 4. PROCEDURAL CANVAS TEXTURE GENERATOR
// =========================================================================

/**
 * Generates an HTML5 Canvas containing procedural high-resolution textures.
 */
export function generateProceduralCanvasTexture(
  pattern: string,
  baseColorHex: string,
  widthPx: number = 256,
  heightPx: number = 256
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background base color
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (pattern === "parquet_oak" || pattern === "parquet_walnut") {
    // Parquet Wood Planks with subtle grain lines
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.lineWidth = 2;
    const plankH = heightPx / 4;
    for (let y = 0; y <= heightPx; y += plankH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(widthPx, y);
      ctx.stroke();

      // Staggered vertical joints
      const isOdd = Math.round(y / plankH) % 2 === 1;
      const xOffset = isOdd ? widthPx / 2 : 0;
      ctx.beginPath();
      ctx.moveTo(xOffset, y);
      ctx.lineTo(xOffset, y + plankH);
      ctx.stroke();
    }

    // Wood Grain Noise
    ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
    for (let i = 0; i < 200; i++) {
      const rx = Math.random() * widthPx;
      const ry = Math.random() * heightPx;
      ctx.fillRect(rx, ry, Math.random() * 25 + 5, 1);
    }
  } else if (pattern === "ceramic_grid_60" || pattern === "subway_brick") {
    // Ceramic Tile Grid with Grout
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 3;
    const tileW = pattern === "subway_brick" ? widthPx / 4 : widthPx / 2;
    const tileH = pattern === "subway_brick" ? heightPx / 8 : heightPx / 2;

    for (let y = 0; y <= heightPx; y += tileH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(widthPx, y);
      ctx.stroke();
    }
    for (let x = 0; x <= widthPx; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightPx);
      ctx.stroke();
    }
  } else if (pattern === "marble_carrara") {
    // Marble Veining Curves
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, heightPx * 0.2);
    ctx.bezierCurveTo(widthPx * 0.4, heightPx * 0.5, widthPx * 0.6, heightPx * 0.1, widthPx, heightPx * 0.8);
    ctx.stroke();

    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(widthPx * 0.2, 0);
    ctx.bezierCurveTo(widthPx * 0.5, heightPx * 0.6, widthPx * 0.3, heightPx * 0.9, widthPx * 0.8, heightPx);
    ctx.stroke();
  } else if (pattern === "acoustic_perforated") {
    // Suspended Acoustic Ceiling Dot Matrix
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    const dotSpacing = 16;
    for (let y = 8; y < heightPx; y += dotSpacing) {
      for (let x = 8; x < widthPx; x += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Perimeter grid border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, widthPx - 2, heightPx - 2);
  } else if (pattern === "concrete_panels") {
    // Concrete Joint Lines & Tie Holes
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, widthPx - 4, heightPx - 4);

    // Tie holes in corners
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    const corners = [[20, 20], [widthPx - 20, 20], [20, heightPx - 20], [widthPx - 20, heightPx - 20]];
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (pattern === "carpet_weave" || pattern === "asphalt_grain") {
    // High frequency speckled grain
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let i = 0; i < 600; i++) {
      const rx = Math.random() * widthPx;
      const ry = Math.random() * heightPx;
      ctx.fillRect(rx, ry, 2, 2);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() * widthPx;
      const ry = Math.random() * heightPx;
      ctx.fillRect(rx, ry, 2, 2);
    }
  }

  return canvas;
}
