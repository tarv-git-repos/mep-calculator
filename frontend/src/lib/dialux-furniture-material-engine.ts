/**
 * DIALUX EVO FURNITURE, MATERIALS & TEXTURES ENGINE
 * 
 * Implements full DIALux evo Tutorial Part 4 capabilities:
 * 1. Material Catalog with accurate reflectances (rho) & roughness (EN 12464-1 & CIBSE).
 * 2. RAL architectural standard colors.
 * 3. Procedural high-resolution canvas texture generators (parquet wood, ceramic tile,
 *    acoustic ceiling tiles, concrete formwork stipple, carpet weave).
 * 4. Shift-key / Individual wall selection (North, South, East, West) vs All Walls,
 *    with automatic weighted wall reflectance and radiosity recalculation.
 * 5. Compound furniture objects (e.g. multi-cuboid Reception Desk built in tutorial 4,
 *    executive desks, ergonomic chairs, conference tables, bookshelves, monitors).
 * 6. Array placement generators (rectangular N x M, linear array, circular radial).
 */

// ============================================================================
// 1. MATERIAL DEFINITION & CATALOG
// ============================================================================

export type MaterialCategory =
  | "plaster"
  | "concrete"
  | "wood"
  | "tiles"
  | "metal"
  | "carpet"
  | "glass"
  | "ral_color";

export type TexturePatternType =
  | "plain"
  | "wood_parquet"
  | "ceramic_tile"
  | "acoustic_tile"
  | "carpet_weave"
  | "concrete_stipple";

export interface MaterialDefinition {
  id: string;
  name: string;
  category: MaterialCategory;
  reflectance: number; // 0.05 to 0.95 (rho)
  roughness: number;   // 0.0 to 1.0 (Three.js roughness)
  colorHex: string;
  textureType: TexturePatternType;
  description?: string;
  specular?: number;
  transparency?: number;
}

export const DIALUX_MATERIAL_CATALOG: MaterialDefinition[] = [
  // --- PLASTERS & EMULSIONS ---
  {
    id: "plaster_white",
    name: "White Interior Plaster (RAL 9010)",
    category: "plaster",
    reflectance: 0.82,
    roughness: 0.9,
    colorHex: "#f7f9f5",
    textureType: "plain",
    description: "Standard high-reflectance interior ceiling & wall emulsion",
  },
  {
    id: "plaster_rough_grey",
    name: "Rough Architectural Plaster",
    category: "plaster",
    reflectance: 0.50,
    roughness: 0.95,
    colorHex: "#cbd5e1",
    textureType: "plain",
    description: "Textured mineral plaster with diffuse scattering",
  },
  {
    id: "plaster_cream_stucco",
    name: "Warm Cream Stucco",
    category: "plaster",
    reflectance: 0.68,
    roughness: 0.85,
    colorHex: "#fef3c7",
    textureType: "plain",
    description: "Warm-tinted lime stucco for interior hospitality or residential spaces",
  },

  // --- CONCRETE ---
  {
    id: "concrete_fair_faced",
    name: "Fair-Faced Concrete (Exposed)",
    category: "concrete",
    reflectance: 0.40,
    roughness: 0.8,
    colorHex: "#94a3b8",
    textureType: "concrete_stipple",
    description: "Smooth architectural formwork concrete with subtle tie holes",
  },
  {
    id: "concrete_aggregate",
    name: "Rough Aggregate Concrete",
    category: "concrete",
    reflectance: 0.28,
    roughness: 0.95,
    colorHex: "#64748b",
    textureType: "concrete_stipple",
    description: "Dark exposed stone aggregate finish for industrial aesthetics",
  },
  {
    id: "concrete_polished",
    name: "Polished Concrete Screed",
    category: "concrete",
    reflectance: 0.42,
    roughness: 0.35,
    colorHex: "#a1a1aa",
    textureType: "plain",
    description: "Modern commercial floor screed with semi-gloss sheen",
  },

  // --- WOOD & TIMBER ---
  {
    id: "wood_oak_parquet",
    name: "Light Oak Parquet",
    category: "wood",
    reflectance: 0.42,
    roughness: 0.45,
    colorHex: "#d4b996",
    textureType: "wood_parquet",
    description: "Natural blonde Scandinavian oak plank flooring",
  },
  {
    id: "wood_dark_walnut",
    name: "Dark Walnut Veneer",
    category: "wood",
    reflectance: 0.18,
    roughness: 0.5,
    colorHex: "#452e1e",
    textureType: "wood_parquet",
    description: "Deep luxury walnut finish for executive spaces and feature walls",
  },
  {
    id: "wood_beech_laminate",
    name: "Beech Wood Furniture Laminate",
    category: "wood",
    reflectance: 0.52,
    roughness: 0.6,
    colorHex: "#e2b887",
    textureType: "plain",
    description: "Durable warm office desktop surface finish",
  },

  // --- TILES & CEILING ---
  {
    id: "tile_ceramic_white",
    name: "White Ceramic Floor Tiles (60x60)",
    category: "tiles",
    reflectance: 0.62,
    roughness: 0.25,
    colorHex: "#f8fafc",
    textureType: "ceramic_tile",
    description: "Glazed porcelain floor tile with subtle grey grout lines",
  },
  {
    id: "tile_porcelain_grey",
    name: "Anthracite Ceramic Tiles (60x60)",
    category: "tiles",
    reflectance: 0.24,
    roughness: 0.35,
    colorHex: "#334155",
    textureType: "ceramic_tile",
    description: "Modern grey porcelain large-format floor tiling",
  },
  {
    id: "tile_acoustic_ceiling",
    name: "Acoustic Mineral Fiber Ceiling Tile",
    category: "tiles",
    reflectance: 0.82,
    roughness: 0.9,
    colorHex: "#ffffff",
    textureType: "acoustic_tile",
    description: "Standard 600x600 suspended T-grid acoustic ceiling tile",
  },

  // --- CARPET ---
  {
    id: "carpet_charcoal_loop",
    name: "Office Loop-Pile Charcoal Carpet",
    category: "carpet",
    reflectance: 0.16,
    roughness: 0.98,
    colorHex: "#334155",
    textureType: "carpet_weave",
    description: "High-traffic commercial modular carpet tile (50x50)",
  },
  {
    id: "carpet_grey_felt",
    name: "Light Grey Needlefelt Carpet",
    category: "carpet",
    reflectance: 0.25,
    roughness: 0.95,
    colorHex: "#64748b",
    textureType: "carpet_weave",
    description: "Diffuse acoustic commercial floor covering",
  },
  {
    id: "carpet_navy_executive",
    name: "Executive Navy Wool Carpet",
    category: "carpet",
    reflectance: 0.14,
    roughness: 0.95,
    colorHex: "#1e3a8a",
    textureType: "carpet_weave",
    description: "Deep luxury blue carpet for boardrooms and VIP suites",
  },

  // --- METALS & GLASS ---
  {
    id: "metal_brushed_aluminum",
    name: "Brushed Aluminum Trim",
    category: "metal",
    reflectance: 0.65,
    roughness: 0.3,
    colorHex: "#cbd5e1",
    textureType: "plain",
    description: "Metallic architectural trims, mullions and fixtures",
  },
  {
    id: "metal_black_powder",
    name: "Matt Black Powder-Coated Steel",
    category: "metal",
    reflectance: 0.10,
    roughness: 0.7,
    colorHex: "#1e293b",
    textureType: "plain",
    description: "Contemporary industrial black metal frames and mullions",
  },
  {
    id: "glass_clear_float",
    name: "Clear Architectural Float Glass",
    category: "glass",
    reflectance: 0.08,
    roughness: 0.05,
    colorHex: "#e0f2fe",
    textureType: "plain",
    description: "High transmission clear glass (tau = 0.85, rho = 0.08)",
    transparency: 0.85,
  },

  // --- RAL ARCHITECTURAL COLORS ---
  {
    id: "ral_9010",
    name: "RAL 9010 Pure White",
    category: "ral_color",
    reflectance: 0.85,
    roughness: 0.85,
    colorHex: "#f7f9f5",
    textureType: "plain",
    description: "Universal architectural white for interior ceilings and partitions",
  },
  {
    id: "ral_9016",
    name: "RAL 9016 Traffic White",
    category: "ral_color",
    reflectance: 0.88,
    roughness: 0.85,
    colorHex: "#f6f6f6",
    textureType: "plain",
    description: "Brilliant clean white with maximum luminous reflectance",
  },
  {
    id: "ral_7035",
    name: "RAL 7035 Light Grey",
    category: "ral_color",
    reflectance: 0.56,
    roughness: 0.85,
    colorHex: "#d7d7d7",
    textureType: "plain",
    description: "Classic European neutral wall finish",
  },
  {
    id: "ral_7016",
    name: "RAL 7016 Anthracite Grey",
    category: "ral_color",
    reflectance: 0.15,
    roughness: 0.85,
    colorHex: "#383e42",
    textureType: "plain",
    description: "Dark feature accent color for modern focal walls",
  },
  {
    id: "ral_5015",
    name: "RAL 5015 Sky Blue",
    category: "ral_color",
    reflectance: 0.32,
    roughness: 0.85,
    colorHex: "#2271b3",
    textureType: "plain",
    description: "Vibrant accent wall color for creative and educational spaces",
  },
  {
    id: "ral_6019",
    name: "RAL 6019 Pastel Green",
    category: "ral_color",
    reflectance: 0.48,
    roughness: 0.85,
    colorHex: "#bdda57",
    textureType: "plain",
    description: "Biophilic calming pastel green for healthcare and wellness areas",
  },
  {
    id: "ral_3020",
    name: "RAL 3020 Traffic Red",
    category: "ral_color",
    reflectance: 0.22,
    roughness: 0.85,
    colorHex: "#cc0605",
    textureType: "plain",
    description: "High-contrast architectural highlight for corridors and lobbies",
  },
  {
    id: "ral_1018",
    name: "RAL 1018 Zinc Yellow",
    category: "ral_color",
    reflectance: 0.65,
    roughness: 0.85,
    colorHex: "#f8b800",
    textureType: "plain",
    description: "Warm luminous accent for dynamic feature elements",
  },
];

// ============================================================================
// 2. PROCEDURAL CANVAS TEXTURE GENERATOR
// ============================================================================

/**
 * Creates high-resolution procedural canvas textures for Three.js without external network requests.
 * Produces crisp, seamless patterns for wood parquet, ceramic tiles, acoustic ceiling tiles, etc.
 */
export function generateProceduralCanvasTexture(
  pattern: TexturePatternType,
  baseColorHex: string,
  resolution = 512
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background base fill
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, resolution, resolution);

  if (pattern === "plain") {
    // Subtle surface noise
    const imgData = ctx.getImageData(0, 0, resolution, resolution);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 6;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  if (pattern === "wood_parquet") {
    // Parquet wooden strip pattern with alternating grain and joints
    const plankHeight = resolution / 8; // 8 rows of planks
    const plankWidth = resolution / 4;  // staggered planks

    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = 2;

    for (let r = 0; r < 8; r++) {
      const y = r * plankHeight;
      const offsetX = (r % 2) * (plankWidth / 2);

      // Horizontal plank seam
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(resolution, y);
      ctx.stroke();

      for (let c = -1; c < 5; c++) {
        const x = c * plankWidth + offsetX;
        // Vertical plank seam
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + plankHeight);
        ctx.stroke();

        // Subtle wood grain lines inside each plank
        ctx.fillStyle = (c + r) % 2 === 0 ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
        ctx.fillRect(x, y, plankWidth, plankHeight);

        for (let g = 0; g < 4; g++) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
          ctx.lineWidth = 1;
          const gy = y + (g + 1) * (plankHeight / 5) + (Math.random() * 2 - 1);
          ctx.beginPath();
          ctx.moveTo(x, gy);
          ctx.lineTo(x + plankWidth, gy);
          ctx.stroke();
        }
      }
    }
    return canvas;
  }

  if (pattern === "ceramic_tile") {
    // 60x60cm square tiles with grout lines
    const tileSize = resolution / 4;
    ctx.strokeStyle = "rgba(100, 116, 139, 0.6)"; // grout line
    ctx.lineWidth = 3;

    for (let i = 0; i <= 4; i++) {
      const pos = i * tileSize;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, resolution);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(resolution, pos);
      ctx.stroke();
    }

    // Inner tile bevel highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.strokeRect(c * tileSize + 3, r * tileSize + 3, tileSize - 6, tileSize - 6);
      }
    }
    return canvas;
  }

  if (pattern === "acoustic_tile") {
    // 600x600 suspended ceiling tile with perforated acoustic dots and T-bar grid
    const gridSize = resolution / 4;

    // T-bar metal grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      const pos = i * gridSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, resolution);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(resolution, pos);
      ctx.stroke();
    }

    // Acoustic micro-perforations
    ctx.fillStyle = "rgba(71, 85, 105, 0.35)";
    const dotSpacing = gridSize / 6;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const ox = c * gridSize;
        const oy = r * gridSize;
        for (let dx = 1; dx < 6; dx++) {
          for (let dy = 1; dy < 6; dy++) {
            ctx.beginPath();
            ctx.arc(ox + dx * dotSpacing, oy + dy * dotSpacing, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    return canvas;
  }

  if (pattern === "carpet_weave") {
    // Textured loop-pile checker
    const step = 8;
    for (let y = 0; y < resolution; y += step) {
      for (let x = 0; x < resolution; x += step) {
        if ((x / step + y / step) % 2 === 0) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        }
        ctx.fillRect(x, y, step, step);
      }
    }
    return canvas;
  }

  if (pattern === "concrete_stipple") {
    // Formwork seams and tie holes
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, resolution / 2);
    ctx.lineTo(resolution, resolution / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(resolution / 2, 0);
    ctx.lineTo(resolution / 2, resolution);
    ctx.stroke();

    // Tie holes
    const holes = [
      [resolution * 0.25, resolution * 0.25],
      [resolution * 0.75, resolution * 0.25],
      [resolution * 0.25, resolution * 0.75],
      [resolution * 0.75, resolution * 0.75],
    ];
    holes.forEach(([hx, hy]) => {
      ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();
    });
    return canvas;
  }

  return canvas;
}

// ============================================================================
// 3. WALL SURFACES & SHIFT-KEY REFLECTANCE MODEL
// ============================================================================

export interface WallSurfaceMaterial {
  materialId: string;
  name: string;
  colorHex: string;
  reflectance: number; // 0.05 to 0.95
  textureType: TexturePatternType;
}

export interface RoomWallSurfaces {
  north: WallSurfaceMaterial;
  south: WallSurfaceMaterial;
  east: WallSurfaceMaterial;
  west: WallSurfaceMaterial;
}

export const DEFAULT_WALL_SURFACES: RoomWallSurfaces = {
  north: {
    materialId: "plaster_white",
    name: "White Interior Plaster (RAL 9010)",
    colorHex: "#94a3b8",
    reflectance: 0.50,
    textureType: "plain",
  },
  south: {
    materialId: "plaster_white",
    name: "White Interior Plaster (RAL 9010)",
    colorHex: "#94a3b8",
    reflectance: 0.50,
    textureType: "plain",
  },
  east: {
    materialId: "plaster_white",
    name: "White Interior Plaster (RAL 9010)",
    colorHex: "#94a3b8",
    reflectance: 0.50,
    textureType: "plain",
  },
  west: {
    materialId: "plaster_white",
    name: "White Interior Plaster (RAL 9010)",
    colorHex: "#94a3b8",
    reflectance: 0.50,
    textureType: "plain",
  },
};

/**
 * Calculates the area-weighted average wall reflectance across North, South, East, and West walls.
 * North & South walls have length `roomL`, East & West walls have length `roomW`.
 */
export function calculateWeightedWallReflectance(
  roomL: number,
  roomW: number,
  wallSurfaces: RoomWallSurfaces
): number {
  const totalPerimeter = 2 * (roomL + roomW);
  if (totalPerimeter <= 0) return 0.5;

  const weightedSum =
    wallSurfaces.north.reflectance * roomL +
    wallSurfaces.south.reflectance * roomL +
    wallSurfaces.east.reflectance * roomW +
    wallSurfaces.west.reflectance * roomW;

  return Math.max(0.05, Math.min(0.95, weightedSum / totalPerimeter));
}

// ============================================================================
// 4. FURNITURE & COMPOUND OBJECT MODEL
// ============================================================================

export type FurnitureType =
  | "cube"
  | "desk"
  | "chair"
  | "conference_table"
  | "bookshelf"
  | "monitor"
  | "reception_desk"
  | "staircase"
  | "extrusion_body"
  | "step_unit"
  | "step_light"
  | "grouped_assembly";

export interface ExtrusionPolygonPoint {
  x: number;
  y: number;
}

export interface StaircaseParameters {
  type: "straight" | "with_landing" | "quarter_turn" | "half_turn" | "compact" | "floating" | "spiral";
  stepCount: number;
  riserHeight: number;
  treadDepth: number;
  stairWidth: number;
  waistThickness: number;
  hasTopLanding: boolean;
  topLandingLength: number;
  hasHandrail: boolean;
  handrailSide: "left" | "right" | "both";
  materialId: string;
  colorHex: string;
  calcSurfaceEnabled: boolean;
  targetLux: number;
  // DIALux evo Tutorial Part 14: Multi-flight & Copy Along Line parameters
  flight2StepCount?: number;
  landingDepth?: number;
  turnDirection?: "left" | "right";
  wellGapWidth?: number;
  stepLightCount?: number;
  stepLightSpacing?: number;
  stepLightLumens?: number;
  hasStepLights?: boolean;
}

export interface FurniturePart {
  id: string;
  name: string;
  relX: number; // offset from object center (m)
  relY: number; // bottom elevation offset (m)
  relZ: number; // offset from object center (m)
  width: number;  // X span (m)
  length: number; // Z span (m)
  height: number; // Y span (m)
  colorHex: string;
  shape?: "box" | "cylinder";
}

export interface FurnitureItem {
  id: string;
  name: string;
  type: FurnitureType;
  x: number;          // Room X coordinate (m)
  y: number;          // Base elevation (m, default 0)
  z: number;          // Room Z coordinate (m)
  width: number;      // Overall bounding width (m)
  length: number;     // Overall bounding length (m)
  height: number;     // Overall bounding height (m)
  rotationDeg: number;// Rotation around Y axis in degrees (0 - 360)
  colorHex: string;
  materialId: string;
  parts: FurniturePart[];
  stairConfig?: StaircaseParameters;
  extrusionPolygon?: ExtrusionPolygonPoint[];
  extrusionDepth?: number;
  subItems?: FurnitureItem[];
  isGrouped?: boolean;
  stepLights?: Array<{ x: number; y: number; z: number; lumens: number; wattage: number }>;
}

// ============================================================================
// 5. STANDARD FURNITURE FACTORIES (Matches DIALux evo Tutorial Part 4)
// ============================================================================

/**
 * Creates a Reception Desk compound object.
 * As constructed in DIALux evo Tutorial Part 4:
 * Combines high front customer transaction counter (1.15m), front privacy baffle,
 * low rear working desk (0.75m), and side return panel.
 */
export function createReceptionDeskItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  materialId = "wood_oak_parquet",
  colorHex = "#d4b996"
): FurnitureItem {
  const width = 2.4;  // total width (m)
  const length = 1.4; // total depth (m)
  const height = 1.15;// transaction counter height (m)

  const parts: FurniturePart[] = [
    // 1. High front customer transaction counter (top shelf)
    {
      id: `${id}_counter_top`,
      name: "High Transaction Counter",
      relX: 0,
      relY: 1.10,
      relZ: -0.5,
      width: 2.4,
      length: 0.35,
      height: 0.05,
      colorHex: colorHex,
      shape: "box",
    },
    // 2. Front privacy fascia / facade panel
    {
      id: `${id}_front_fascia`,
      name: "Front Modesty Fascia",
      relX: 0,
      relY: 0,
      relZ: -0.65,
      width: 2.4,
      length: 0.06,
      height: 1.10,
      colorHex: "#334155", // contrasting architectural dark grey
      shape: "box",
    },
    // 3. Lower working desktop surface for receptionist (height 0.75m)
    {
      id: `${id}_work_desk`,
      name: "Receptionist Work Surface",
      relX: 0,
      relY: 0.72,
      relZ: 0.1,
      width: 2.3,
      length: 0.8,
      height: 0.04,
      colorHex: colorHex,
      shape: "box",
    },
    // 4. Left side wing / end panel
    {
      id: `${id}_left_panel`,
      name: "Left Return Panel",
      relX: -1.17,
      relY: 0,
      relZ: -0.05,
      width: 0.06,
      length: 1.25,
      height: 1.10,
      colorHex: "#334155",
      shape: "box",
    },
    // 5. Right side wing / end panel
    {
      id: `${id}_right_panel`,
      name: "Right Return Panel",
      relX: 1.17,
      relY: 0,
      relZ: -0.05,
      width: 0.06,
      length: 1.25,
      height: 1.10,
      colorHex: "#334155",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Reception Counter Desk",
    type: "reception_desk",
    x,
    y: 0,
    z,
    width,
    length,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates an Office Workstation Desk with desktop, rear modesty panel, and 4 metal legs.
 */
export function createDeskItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  width = 1.6,
  length = 0.8,
  height = 0.75,
  materialId = "wood_beech_laminate",
  colorHex = "#e2b887"
): FurnitureItem {
  const legRadius = 0.025;
  const legHeight = height - 0.04;
  const legColor = "#64748b";

  const parts: FurniturePart[] = [
    // Desktop slab
    {
      id: `${id}_top`,
      name: "Desktop Top",
      relX: 0,
      relY: height - 0.04,
      relZ: 0,
      width: width,
      length: length,
      height: 0.04,
      colorHex: colorHex,
      shape: "box",
    },
    // Modesty privacy panel
    {
      id: `${id}_modesty`,
      name: "Modesty Panel",
      relX: 0,
      relY: height * 0.35,
      relZ: -length / 2 + 0.05,
      width: width - 0.15,
      length: 0.02,
      height: height * 0.5,
      colorHex: "#475569",
      shape: "box",
    },
    // 4 legs
    {
      id: `${id}_leg_fl`,
      name: "Front Left Leg",
      relX: -width / 2 + 0.06,
      relY: 0,
      relZ: -length / 2 + 0.06,
      width: legRadius * 2,
      length: legRadius * 2,
      height: legHeight,
      colorHex: legColor,
      shape: "cylinder",
    },
    {
      id: `${id}_leg_fr`,
      name: "Front Right Leg",
      relX: width / 2 - 0.06,
      relY: 0,
      relZ: -length / 2 + 0.06,
      width: legRadius * 2,
      length: legRadius * 2,
      height: legHeight,
      colorHex: legColor,
      shape: "cylinder",
    },
    {
      id: `${id}_leg_bl`,
      name: "Back Left Leg",
      relX: -width / 2 + 0.06,
      relY: 0,
      relZ: length / 2 - 0.06,
      width: legRadius * 2,
      length: legRadius * 2,
      height: legHeight,
      colorHex: legColor,
      shape: "cylinder",
    },
    {
      id: `${id}_leg_br`,
      name: "Back Right Leg",
      relX: width / 2 - 0.06,
      relY: 0,
      relZ: length / 2 - 0.06,
      width: legRadius * 2,
      length: legRadius * 2,
      height: legHeight,
      colorHex: legColor,
      shape: "cylinder",
    },
  ];

  return {
    id,
    name: "Office Desk",
    type: "desk",
    x,
    y: 0,
    z,
    width,
    length,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates an Ergonomic Office Chair with seat cushion, contoured backrest, and central gas lift.
 */
export function createChairItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  materialId = "carpet_charcoal_loop",
  colorHex = "#1e293b"
): FurnitureItem {
  const parts: FurniturePart[] = [
    // Seat cushion
    {
      id: `${id}_seat`,
      name: "Chair Seat",
      relX: 0,
      relY: 0.44,
      relZ: 0,
      width: 0.52,
      length: 0.48,
      height: 0.08,
      colorHex: colorHex,
      shape: "box",
    },
    // Backrest
    {
      id: `${id}_back`,
      name: "Ergonomic Backrest",
      relX: 0,
      relY: 0.52,
      relZ: 0.22,
      width: 0.48,
      length: 0.06,
      height: 0.46,
      colorHex: colorHex,
      shape: "box",
    },
    // Central stem pedestal
    {
      id: `${id}_pedestal`,
      name: "Central Gas-Lift Column",
      relX: 0,
      relY: 0.05,
      relZ: 0,
      width: 0.06,
      length: 0.06,
      height: 0.39,
      colorHex: "#475569",
      shape: "cylinder",
    },
    // 5-star base footprint
    {
      id: `${id}_base`,
      name: "5-Star Wheel Base",
      relX: 0,
      relY: 0,
      relZ: 0,
      width: 0.58,
      length: 0.58,
      height: 0.05,
      colorHex: "#0f172a",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Office Chair",
    type: "chair",
    x,
    y: 0,
    z,
    width: 0.58,
    length: 0.58,
    height: 0.98,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates a Conference Table for meeting rooms.
 */
export function createConferenceTableItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  width = 2.8,
  length = 1.2,
  height = 0.75,
  materialId = "wood_dark_walnut",
  colorHex = "#452e1e"
): FurnitureItem {
  const parts: FurniturePart[] = [
    // Thick tabletop slab
    {
      id: `${id}_top`,
      name: "Boardroom Table Top",
      relX: 0,
      relY: height - 0.06,
      relZ: 0,
      width: width,
      length: length,
      height: 0.06,
      colorHex: colorHex,
      shape: "box",
    },
    // Left heavy pedestal
    {
      id: `${id}_ped_l`,
      name: "Left Pedestal Column",
      relX: -width * 0.28,
      relY: 0,
      relZ: 0,
      width: 0.35,
      length: 0.65,
      height: height - 0.06,
      colorHex: "#1e293b",
      shape: "box",
    },
    // Right heavy pedestal
    {
      id: `${id}_ped_r`,
      name: "Right Pedestal Column",
      relX: width * 0.28,
      relY: 0,
      relZ: 0,
      width: 0.35,
      length: 0.65,
      height: height - 0.06,
      colorHex: "#1e293b",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Conference Table",
    type: "conference_table",
    x,
    y: 0,
    z,
    width,
    length,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates a Bookshelf / File Storage Unit.
 */
export function createBookshelfItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  width = 1.2,
  length = 0.4,
  height = 2.0,
  materialId = "wood_oak_parquet",
  colorHex = "#d4b996"
): FurnitureItem {
  const parts: FurniturePart[] = [
    // Outer casing frame
    {
      id: `${id}_casing`,
      name: "Bookshelf Casing",
      relX: 0,
      relY: 0,
      relZ: 0,
      width: width,
      length: length,
      height: height,
      colorHex: colorHex,
      shape: "box",
    },
  ];

  return {
    id,
    name: "Bookshelf Storage Unit",
    type: "bookshelf",
    x,
    y: 0,
    z,
    width,
    length,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates a Computer Workstation Monitor.
 */
export function createMonitorItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  deskHeight = 0.75
): FurnitureItem {
  const parts: FurniturePart[] = [
    // Widescreen monitor display
    {
      id: `${id}_screen`,
      name: "Widescreen Monitor Screen",
      relX: 0,
      relY: deskHeight + 0.12,
      relZ: 0,
      width: 0.60,
      length: 0.04,
      height: 0.38,
      colorHex: "#020617",
      shape: "box",
    },
    // Stand column
    {
      id: `${id}_stand`,
      name: "Monitor Stand",
      relX: 0,
      relY: deskHeight,
      relZ: 0,
      width: 0.06,
      length: 0.04,
      height: 0.12,
      colorHex: "#475569",
      shape: "box",
    },
    // Base plate
    {
      id: `${id}_base`,
      name: "Stand Base",
      relX: 0,
      relY: deskHeight,
      relZ: 0,
      width: 0.22,
      length: 0.18,
      height: 0.015,
      colorHex: "#334155",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Desktop Monitor",
    type: "monitor",
    x,
    y: 0,
    z,
    width: 0.60,
    length: 0.18,
    height: 0.50,
    rotationDeg,
    colorHex: "#020617",
    materialId: "metal_black_powder",
    parts,
  };
}

/**
 * Creates a custom user-defined Cuboid primitive.
 */
export function createCubeItem(
  id: string,
  x: number,
  z: number,
  width = 1.0,
  length = 1.0,
  height = 1.0,
  rotationDeg = 0,
  materialId = "plaster_rough_grey",
  colorHex = "#475569"
): FurnitureItem {
  const parts: FurniturePart[] = [
    {
      id: `${id}_box`,
      name: "Cuboid Body",
      relX: 0,
      relY: 0,
      relZ: 0,
      width,
      length,
      height,
      colorHex,
      shape: "box",
    },
  ];

  return {
    id,
    name: `Cuboid (${width.toFixed(1)}x${length.toFixed(1)}x${height.toFixed(1)}m)`,
    type: "cube",
    x,
    y: 0,
    z,
    width,
    length,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

// ============================================================================
// 6. OBJECT ARRANGEMENT GENERATORS
// ============================================================================

/**
 * Generates an N x M rectangular grid of furniture items (e.g. open-plan workstation layout).
 */
export function generateRectangularFurnitureArray(
  templateType: FurnitureType,
  rows: number,
  cols: number,
  spacingX: number,
  spacingZ: number,
  startX: number,
  startZ: number,
  materialId: string,
  colorHex: string
): FurnitureItem[] {
  const items: FurnitureItem[] = [];
  let counter = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const posX = startX + c * spacingX;
      const posZ = startZ + r * spacingZ;
      const itemId = `grid_item_${Date.now()}_${counter++}`;

      if (templateType === "desk") {
        items.push(createDeskItem(itemId, posX, posZ, 0, 1.6, 0.8, 0.75, materialId, colorHex));
      } else if (templateType === "chair") {
        items.push(createChairItem(itemId, posX, posZ, 0, materialId, colorHex));
      } else if (templateType === "conference_table") {
        items.push(createConferenceTableItem(itemId, posX, posZ, 0, 2.4, 1.2, 0.75, materialId, colorHex));
      } else if (templateType === "reception_desk") {
        items.push(createReceptionDeskItem(itemId, posX, posZ, 0, materialId, colorHex));
      } else {
        items.push(createCubeItem(itemId, posX, posZ, 1.0, 1.0, 1.0, 0, materialId, colorHex));
      }
    }
  }

  return items;
}

/**
 * Generates a linear arrangement of items along an axis.
 */
export function generateLineFurnitureArray(
  templateType: FurnitureType,
  count: number,
  spacing: number,
  startX: number,
  startZ: number,
  angleDeg = 0,
  materialId: string,
  colorHex: string
): FurnitureItem[] {
  const items: FurnitureItem[] = [];
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * spacing;
  const dz = Math.sin(rad) * spacing;

  for (let i = 0; i < count; i++) {
    const posX = startX + i * dx;
    const posZ = startZ + i * dz;
    const itemId = `line_item_${Date.now()}_${i + 1}`;

    if (templateType === "desk") {
      items.push(createDeskItem(itemId, posX, posZ, angleDeg, 1.6, 0.8, 0.75, materialId, colorHex));
    } else if (templateType === "chair") {
      items.push(createChairItem(itemId, posX, posZ, angleDeg, materialId, colorHex));
    } else if (templateType === "bookshelf") {
      items.push(createBookshelfItem(itemId, posX, posZ, angleDeg, 1.2, 0.4, 2.0, materialId, colorHex));
    } else {
      items.push(createCubeItem(itemId, posX, posZ, 1.0, 1.0, 1.0, angleDeg, materialId, colorHex));
    }
  }

  return items;
}

/**
 * Generates a circular radial arrangement of chairs around a conference table or central hub.
 */
export function generateCircularFurnitureArray(
  templateType: FurnitureType,
  count: number,
  radius: number,
  centerX: number,
  centerZ: number,
  materialId: string,
  colorHex: string
): FurnitureItem[] {
  const items: FurnitureItem[] = [];
  const step = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * step;
    const posX = centerX + Math.cos(angle) * radius;
    const posZ = centerZ + Math.sin(angle) * radius;
    const facingAngleDeg = ((angle + Math.PI / 2) * 180) / Math.PI;
    const itemId = `circle_item_${Date.now()}_${i + 1}`;

    if (templateType === "chair") {
      items.push(createChairItem(itemId, posX, posZ, facingAngleDeg, materialId, colorHex));
    } else {
      items.push(createCubeItem(itemId, posX, posZ, 0.5, 0.5, 0.5, facingAngleDeg, materialId, colorHex));
    }
  }

  return items;
}

// ============================================================================
// 6. DIALUX EVO TUTORIAL PART 13: STAIRCASES & EXTRUSION BODIES
// ============================================================================

/**
 * Calculates ergonomic comfort per Blondel's Rule (2 * Riser + Tread = 60 to 65 cm)
 * and Staircase Pitch Angle.
 */
export function calculateStaircaseBlondel(riserHeight: number, treadDepth: number): {
  blondelValueCm: number;
  pitchDeg: number;
  isComfortable: boolean;
  verdict: string;
} {
  const rCm = riserHeight * 100;
  const tCm = treadDepth * 100;
  const blondel = 2 * rCm + tCm;
  const pitch = Math.atan2(riserHeight, treadDepth) * (180 / Math.PI);
  const isComfortable = blondel >= 60 && blondel <= 65;
  const verdict = isComfortable
    ? "Compliant with Blondel comfort rule (2s + a = 60-65 cm)"
    : blondel < 60
    ? "Too shallow / long stride (2s + a < 60 cm)"
    : "Too steep / short stride (2s + a > 65 cm)";
  return {
    blondelValueCm: Number(blondel.toFixed(1)),
    pitchDeg: Number(pitch.toFixed(1)),
    isComfortable,
    verdict,
  };
}

/**
 * Creates an Architectural Staircase Compound Object matching DIALux evo Tutorial Part 13.
 * Supports straight flights, landings, stringers, handrails, and EN 12464-1 calculation surface.
 */
export function createStaircaseItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  config: Partial<StaircaseParameters> = {}
): FurnitureItem {
  const params: StaircaseParameters = {
    type: config.type || "straight",
    stepCount: config.stepCount || 10,
    riserHeight: config.riserHeight || 0.17,
    treadDepth: config.treadDepth || 0.28,
    stairWidth: config.stairWidth || 1.20,
    waistThickness: config.waistThickness || 0.15,
    hasTopLanding: config.hasTopLanding ?? false,
    topLandingLength: config.topLandingLength || 1.20,
    hasHandrail: config.hasHandrail ?? true,
    handrailSide: config.handrailSide || "right",
    materialId: config.materialId || "concrete_fair_faced",
    colorHex: config.colorHex || "#94a3b8",
    calcSurfaceEnabled: config.calcSurfaceEnabled ?? true,
    targetLux: config.targetLux || 100,
  };

  const totalRun = params.stepCount * params.treadDepth + (params.hasTopLanding ? params.topLandingLength : 0);
  const totalHeight = params.stepCount * params.riserHeight;
  const parts: FurniturePart[] = [];

  // 1. Generate individual step blocks (Riser & Tread)
  for (let i = 0; i < params.stepCount; i++) {
    const stepZ = i * params.treadDepth - totalRun / 2 + params.treadDepth / 2;
    const stepY = i * params.riserHeight;
    parts.push({
      id: `${id}_step_${i + 1}`,
      name: `Step ${i + 1}`,
      relX: 0,
      relY: stepY,
      relZ: stepZ,
      width: params.stairWidth,
      length: params.treadDepth,
      height: params.riserHeight,
      colorHex: params.colorHex,
      shape: "box",
    });
  }

  // 2. Top Landing Platform (if enabled)
  if (params.hasTopLanding) {
    const landingZ = params.stepCount * params.treadDepth - totalRun / 2 + params.topLandingLength / 2;
    parts.push({
      id: `${id}_top_landing`,
      name: "Top Landing Platform",
      relX: 0,
      relY: totalHeight - params.riserHeight,
      relZ: landingZ,
      width: params.stairWidth,
      length: params.topLandingLength,
      height: params.riserHeight,
      colorHex: params.colorHex,
      shape: "box",
    });
  }

  // 3. Structural Side Stringers
  const stringerWidth = 0.05;
  parts.push({
    id: `${id}_stringer_left`,
    name: "Left Stringer",
    relX: -params.stairWidth / 2 + stringerWidth / 2,
    relY: totalHeight / 2 - 0.05,
    relZ: 0,
    width: stringerWidth,
    length: totalRun,
    height: totalHeight * 0.45,
    colorHex: "#475569",
    shape: "box",
  });
  parts.push({
    id: `${id}_stringer_right`,
    name: "Right Stringer",
    relX: params.stairWidth / 2 - stringerWidth / 2,
    relY: totalHeight / 2 - 0.05,
    relZ: 0,
    width: stringerWidth,
    length: totalRun,
    height: totalHeight * 0.45,
    colorHex: "#475569",
    shape: "box",
  });

  // 4. Handrail Posts & Top Banister Rail (0.90 m elevation)
  if (params.hasHandrail) {
    const railX = params.handrailSide === "left" ? -params.stairWidth / 2 + 0.04 : params.stairWidth / 2 - 0.04;
    const postCount = Math.max(3, Math.min(6, Math.floor(params.stepCount / 2)));
    const postInterval = Math.floor(params.stepCount / postCount);

    for (let p = 0; p <= postCount; p++) {
      const stepIdx = Math.min(params.stepCount - 1, p * postInterval);
      const postZ = stepIdx * params.treadDepth - totalRun / 2 + params.treadDepth / 2;
      const postY = stepIdx * params.riserHeight + params.riserHeight;
      parts.push({
        id: `${id}_handrail_post_${p}`,
        name: `Handrail Post ${p + 1}`,
        relX: railX,
        relY: postY,
        relZ: postZ,
        width: 0.04,
        length: 0.04,
        height: 0.90,
        colorHex: "#334155",
        shape: "cylinder",
      });
    }

    // Top Handrail Rail Bar
    parts.push({
      id: `${id}_handrail_bar`,
      name: "Top Handrail Banister",
      relX: railX,
      relY: totalHeight / 2 + 0.90,
      relZ: 0,
      width: 0.05,
      length: totalRun,
      height: 0.05,
      colorHex: "#1e293b",
      shape: "box",
    });
  }

  return {
    id,
    name: `Staircase (${params.stepCount} Steps, ${params.type})`,
    type: "staircase",
    x,
    y: 0,
    z,
    width: params.stairWidth,
    length: totalRun,
    height: totalHeight,
    rotationDeg,
    colorHex: params.colorHex,
    materialId: params.materialId,
    parts,
    stairConfig: params,
  };
}

/**
 * Creates an Extrusion Body from an arbitrary 2D polygon profile (Tutorial 13).
 */
export function createExtrusionBodyItem(
  id: string,
  name: string,
  x: number,
  z: number,
  depth: number,
  polygon: ExtrusionPolygonPoint[],
  rotationDeg = 0,
  materialId = "concrete_fair_faced",
  colorHex = "#94a3b8"
): FurnitureItem {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  polygon.forEach((pt) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  const width = Math.max(0.1, maxX - minX);
  const height = Math.max(0.1, maxY - minY);

  const parts: FurniturePart[] = [];
  const segments = polygon.length;
  for (let i = 0; i < segments - 1; i++) {
    const p1 = polygon[i];
    const p2 = polygon[i + 1];
    const segW = Math.max(0.05, Math.abs(p2.x - p1.x));
    const segH = Math.max(0.05, Math.abs(p2.y - p1.y));
    const midX = (p1.x + p2.x) / 2 - (minX + maxX) / 2;
    const midY = (p1.y + p2.y) / 2 - minY;
    parts.push({
      id: `${id}_slice_${i + 1}`,
      name: `Extrusion Segment ${i + 1}`,
      relX: midX,
      relY: midY,
      relZ: 0,
      width: segW,
      length: depth,
      height: segH,
      colorHex,
      shape: "box",
    });
  }

  return {
    id,
    name,
    type: "extrusion_body",
    x,
    y: 0,
    z,
    width,
    length: depth,
    height,
    rotationDeg,
    colorHex,
    materialId,
    parts,
    extrusionPolygon: polygon,
    extrusionDepth: depth,
  };
}

/**
 * Point-by-point calculation of illuminance across staircase treads (EN 12464-1 & Tutorial Part 13 Pro-Tip).
 */
export function calculateStaircaseLighting(params: {
  stair: FurnitureItem;
  luminaires: Array<{ x: number; y: number; z: number; lumens?: number; wattage?: number; isExcluded?: boolean }>;
  mf?: number;
}): {
  avgLux: number;
  minLux: number;
  maxLux: number;
  uniformityU0: number;
  stepPoints: Array<{ stepNumber: number; x: number; y: number; z: number; lux: number }>;
  isCompliant: boolean;
  targetLux: number;
} {
  const { stair, luminaires, mf = 0.8 } = params;
  const cfg = stair.stairConfig;
  const targetLux = cfg?.targetLux || 100;
  const stepCount = cfg?.stepCount || 10;
  const riserH = cfg?.riserHeight || 0.17;
  const treadD = cfg?.treadDepth || 0.28;
  const totalRun = stair.length;

  const rad = (stair.rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const stepPoints: Array<{ stepNumber: number; x: number; y: number; z: number; lux: number }> = [];

  for (let i = 0; i < stepCount; i++) {
    const localRelZ = i * treadD - totalRun / 2 + treadD / 2;
    const localRelY = (i + 1) * riserH;

    // World coordinates of step tread center
    const worldX = stair.x - localRelZ * sinR;
    const worldY = stair.y + localRelY;
    const worldZ = stair.z + localRelZ * cosR;

    let stepLux = 0;
    for (const lum of luminaires) {
      if (lum.isExcluded) continue;
      const dx = worldX - lum.x;
      const dz = worldZ - lum.y; // room width maps to lum.y
      const dy = lum.z - worldY;
      const distHoriz = Math.sqrt(dx * dx + dz * dz);
      const dist3D = Math.sqrt(distHoriz * distHoriz + dy * dy);
      if (dist3D <= 0.1) continue;

      const cosPsi = Math.max(0, dy / dist3D); // horizontal surface cosine
      const fixtureLumens = lum.lumens || 3600;
      const I_approx = (fixtureLumens / (2 * Math.PI)) * cosPsi;

      const directLux = (I_approx * cosPsi * mf) / (dist3D * dist3D);
      stepLux += directLux;
    }

    stepPoints.push({
      stepNumber: i + 1,
      x: Number(worldX.toFixed(2)),
      y: Number(worldY.toFixed(2)),
      z: Number(worldZ.toFixed(2)),
      lux: Math.round(stepLux),
    });
  }

  const luxValues = stepPoints.map((p) => p.lux);
  const avgLux = luxValues.length > 0 ? Math.round(luxValues.reduce((a, b) => a + b, 0) / luxValues.length) : 0;
  const minLux = luxValues.length > 0 ? Math.min(...luxValues) : 0;
  const maxLux = luxValues.length > 0 ? Math.max(...luxValues) : 0;
  const uniformityU0 = avgLux > 0 ? parseFloat((minLux / avgLux).toFixed(2)) : 0;
  const isCompliant = avgLux >= targetLux && uniformityU0 >= 0.40;

  return {
    avgLux,
    minLux,
    maxLux,
    uniformityU0,
    stepPoints,
    isCompliant,
    targetLux,
  };
}

// ============================================================================
// 7. DIALUX EVO TUTORIAL PART 14: COPY ALONG A LINE, MULTI-FLIGHT STAIRS & GROUPING
// ============================================================================

export interface CopyAlongLineConfig {
  sourceTemplate: "step_box" | "floating_tread" | "baluster_post" | "step_light" | "cube_block" | "custom_item";
  customItem?: FurnitureItem;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  mode: "fixed_count" | "fixed_spacing";
  count: number;
  spacing: number;
  riserOffsetDeltaY: number;
  alignment: "keep" | "follow_line";
  materialId: string;
  colorHex: string;
  groupResults: boolean;
  stepWidth?: number;
  stepTreadDepth?: number;
  stepRiserHeight?: number;
  stepLightLumens?: number;
  stepLightWattage?: number;
}

/**
 * Creates a standalone step block furniture item.
 */
export function createStepUnitItem(
  id: string,
  x: number,
  y: number,
  z: number,
  width = 1.20,
  treadDepth = 0.28,
  riserHeight = 0.17,
  rotationDeg = 0,
  materialId = "concrete_fair_faced",
  colorHex = "#94a3b8"
): FurnitureItem {
  const parts: FurniturePart[] = [
    {
      id: `${id}_block`,
      name: "Tread Block",
      relX: 0,
      relY: 0,
      relZ: 0,
      width,
      length: treadDepth,
      height: riserHeight,
      colorHex,
      shape: "box",
    },
    // High-visibility yellow safety edge
    {
      id: `${id}_nosing`,
      name: "Safety Nosing Strip",
      relX: 0,
      relY: riserHeight - 0.005,
      relZ: -treadDepth / 2 + 0.02,
      width,
      length: 0.04,
      height: 0.01,
      colorHex: "#eab308",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Stair Step Unit",
    type: "step_unit",
    x,
    y,
    z,
    width,
    length: treadDepth,
    height: riserHeight,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates a floating cantilevered tread step with wall bracket anchor pin.
 */
export function createFloatingTreadUnitItem(
  id: string,
  x: number,
  y: number,
  z: number,
  width = 1.10,
  treadDepth = 0.30,
  treadThickness = 0.05,
  rotationDeg = 0,
  materialId = "wood_oak_parquet",
  colorHex = "#d4b996"
): FurnitureItem {
  const parts: FurniturePart[] = [
    // Wood / stone cantilever tread slab
    {
      id: `${id}_slab`,
      name: "Floating Tread Slab",
      relX: 0,
      relY: 0,
      relZ: 0,
      width,
      length: treadDepth,
      height: treadThickness,
      colorHex,
      shape: "box",
    },
    // Embedded steel wall mounting anchor pin
    {
      id: `${id}_wall_pin`,
      name: "Steel Wall Anchor Pin",
      relX: -width / 2 - 0.05,
      relY: treadThickness / 2 - 0.015,
      relZ: 0,
      width: 0.12,
      length: 0.04,
      height: 0.03,
      colorHex: "#334155",
      shape: "box",
    },
  ];

  return {
    id,
    name: "Floating Cantilever Tread",
    type: "step_unit",
    x,
    y,
    z,
    width,
    length: treadDepth,
    height: treadThickness,
    rotationDeg,
    colorHex,
    materialId,
    parts,
  };
}

/**
 * Creates a recessed wall step luminaire fixture (Tutorial Part 14 Step Lighting).
 */
export function createStepLightItem(
  id: string,
  x: number,
  y: number,
  z: number,
  rotationDeg = 0,
  lumens = 250,
  wattage = 4,
  colorHex = "#0284c7"
): FurnitureItem {
  const parts: FurniturePart[] = [
    {
      id: `${id}_housing`,
      name: "Recessed Step Light Bezel",
      relX: 0,
      relY: 0,
      relZ: 0,
      width: 0.15,
      length: 0.04,
      height: 0.08,
      colorHex: "#1e293b",
      shape: "box",
    },
    {
      id: `${id}_lens`,
      name: "Diffuser Glass Lens",
      relX: 0,
      relY: -0.01,
      relZ: 0.015,
      width: 0.12,
      length: 0.01,
      height: 0.03,
      colorHex: "#fef08a",
      shape: "box",
    },
  ];

  return {
    id,
    name: `Step Luminaire (${lumens} lm)`,
    type: "step_light",
    x,
    y,
    z,
    width: 0.15,
    length: 0.04,
    height: 0.08,
    rotationDeg,
    colorHex,
    materialId: "metal_black_powder",
    parts,
    stepLights: [{ x, y, z, lumens, wattage }],
  };
}

/**
 * Executes DIALux evo Tutorial Part 14: "Copy along a line" (Copy and Arrange tool).
 * Duplicates a selected object or step component along a 3D line vector with
 * elevation rise per step, orientation following line, and optional grouping.
 */
export function generateCopyAlongLineObjects(config: CopyAlongLineConfig): FurnitureItem[] {
  const {
    sourceTemplate,
    customItem,
    startX,
    startY,
    startZ,
    endX,
    endY,
    endZ,
    mode,
    count: inputCount,
    spacing: inputSpacing,
    riserOffsetDeltaY,
    alignment,
    materialId,
    colorHex,
    groupResults,
    stepWidth = 1.20,
    stepTreadDepth = 0.28,
    stepRiserHeight = 0.17,
    stepLightLumens = 250,
    stepLightWattage = 4,
  } = config;

  const dx = endX - startX;
  const dy = endY - startY;
  const dz = endZ - startZ;
  const distHoriz = Math.sqrt(dx * dx + dz * dz);
  const lineAngleDeg = (Math.atan2(dz, dx) * 180) / Math.PI;

  let count = inputCount;
  if (mode === "fixed_spacing") {
    const spacing = Math.max(0.1, inputSpacing);
    count = Math.max(2, Math.floor(distHoriz / spacing) + 1);
  } else {
    count = Math.max(2, inputCount);
  }

  const generatedItems: FurnitureItem[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const posX = startX + t * dx;
    const posZ = startZ + t * dz;
    const posY = startY + (riserOffsetDeltaY > 0 ? i * riserOffsetDeltaY : t * dy);

    const rotation =
      alignment === "follow_line"
        ? lineAngleDeg
        : customItem
        ? customItem.rotationDeg
        : 0;

    const itemId = `copied_item_${timestamp}_${i + 1}`;

    if (sourceTemplate === "step_box") {
      generatedItems.push(
        createStepUnitItem(
          itemId,
          posX,
          posY,
          posZ,
          stepWidth,
          stepTreadDepth,
          stepRiserHeight,
          rotation,
          materialId,
          colorHex
        )
      );
    } else if (sourceTemplate === "floating_tread") {
      generatedItems.push(
        createFloatingTreadUnitItem(
          itemId,
          posX,
          posY,
          posZ,
          stepWidth,
          stepTreadDepth,
          0.05,
          rotation,
          materialId,
          colorHex
        )
      );
    } else if (sourceTemplate === "baluster_post") {
      const balusterParts: FurniturePart[] = [
        {
          id: `${itemId}_post`,
          name: "Baluster Post",
          relX: 0,
          relY: 0,
          relZ: 0,
          width: 0.04,
          length: 0.04,
          height: 0.90,
          colorHex: "#334155",
          shape: "cylinder",
        },
      ];
      generatedItems.push({
        id: itemId,
        name: `Baluster Post ${i + 1}`,
        type: "cube",
        x: posX,
        y: posY,
        z: posZ,
        width: 0.04,
        length: 0.04,
        height: 0.90,
        rotationDeg: rotation,
        colorHex: "#334155",
        materialId: "metal_black_powder",
        parts: balusterParts,
      });
    } else if (sourceTemplate === "step_light") {
      generatedItems.push(
        createStepLightItem(
          itemId,
          posX,
          posY,
          posZ,
          rotation,
          stepLightLumens,
          stepLightWattage,
          "#0284c7"
        )
      );
    } else if (sourceTemplate === "custom_item" && customItem) {
      // Deep clone custom item with new coordinates
      const clonedParts = customItem.parts.map((p, pIdx) => ({
        ...p,
        id: `${itemId}_part_${pIdx + 1}`,
      }));
      generatedItems.push({
        ...customItem,
        id: itemId,
        name: `${customItem.name} (${i + 1})`,
        x: posX,
        y: posY,
        z: posZ,
        rotationDeg: rotation,
        parts: clonedParts,
      });
    } else {
      generatedItems.push(
        createCubeItem(
          itemId,
          posX,
          posZ,
          stepWidth,
          stepTreadDepth,
          stepRiserHeight,
          rotation,
          materialId,
          colorHex
        )
      );
    }
  }

  // If groupResults is true, group into a single compound assembly (Tutorial 14)
  if (groupResults && generatedItems.length > 1) {
    const groupName =
      sourceTemplate === "step_box"
        ? `Stair Flight (${count} Steps via Line Array)`
        : sourceTemplate === "floating_tread"
        ? `Floating Staircase (${count} Treads via Line Array)`
        : `Grouped Line Array (${count} Items)`;
    return [groupFurnitureItems(generatedItems, groupName)];
  }

  return generatedItems;
}

/**
 * Groups multiple furniture items into a single compound assembly (Tutorial 14 Grouping).
 * Recalculates relative part offsets from the common bounding centroid.
 */
export function groupFurnitureItems(
  items: FurnitureItem[],
  groupName = "Grouped Assembly"
): FurnitureItem {
  if (items.length === 1) return items[0];

  // Calculate bounding box across all items in world space
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  items.forEach((item) => {
    const hW = item.width / 2;
    const hL = item.length / 2;
    if (item.x - hW < minX) minX = item.x - hW;
    if (item.x + hW > maxX) maxX = item.x + hW;
    if (item.y < minY) minY = item.y;
    if (item.y + item.height > maxY) maxY = item.y + item.height;
    if (item.z - hL < minZ) minZ = item.z - hL;
    if (item.z + hL > maxZ) maxZ = item.z + hL;
  });

  const centerX = (minX + maxX) / 2;
  const centerY = minY;
  const centerZ = (minZ + maxZ) / 2;
  const totalWidth = Math.max(0.2, maxX - minX);
  const totalLength = Math.max(0.2, maxZ - minZ);
  const totalHeight = Math.max(0.1, maxY - minY);

  const aggregatedParts: FurniturePart[] = [];
  const aggregatedStepLights: Array<{ x: number; y: number; z: number; lumens: number; wattage: number }> = [];

  items.forEach((item, itemIdx) => {
    const offsetX = item.x - centerX;
    const offsetY = item.y - centerY;
    const offsetZ = item.z - centerZ;

    item.parts.forEach((part, partIdx) => {
      aggregatedParts.push({
        ...part,
        id: `grp_${itemIdx}_${partIdx}_${part.id}`,
        relX: offsetX + part.relX,
        relY: offsetY + part.relY,
        relZ: offsetZ + part.relZ,
      });
    });

    if (item.stepLights) {
      aggregatedStepLights.push(...item.stepLights);
    }
  });

  return {
    id: `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: groupName,
    type: "grouped_assembly",
    x: Number(centerX.toFixed(3)),
    y: Number(centerY.toFixed(3)),
    z: Number(centerZ.toFixed(3)),
    width: Number(totalWidth.toFixed(3)),
    length: Number(totalLength.toFixed(3)),
    height: Number(totalHeight.toFixed(3)),
    rotationDeg: 0,
    colorHex: items[0]?.colorHex || "#94a3b8",
    materialId: items[0]?.materialId || "concrete_fair_faced",
    parts: aggregatedParts,
    subItems: items,
    isGrouped: true,
    stepLights: aggregatedStepLights.length > 0 ? aggregatedStepLights : undefined,
  };
}

/**
 * Ungroups a compound assembly or staircase into individual furniture items (Tutorial 14 Ungrouping).
 */
export function ungroupFurnitureItem(groupedItem: FurnitureItem): FurnitureItem[] {
  if (groupedItem.subItems && groupedItem.subItems.length > 0) {
    return groupedItem.subItems;
  }

  // Fallback: explode parts into individual items
  return groupedItem.parts.map((part, idx) => ({
    id: `ungrouped_${groupedItem.id}_${idx + 1}`,
    name: part.name || `Item Part ${idx + 1}`,
    type: "cube",
    x: groupedItem.x + part.relX,
    y: groupedItem.y + part.relY,
    z: groupedItem.z + part.relZ,
    width: part.width,
    length: part.length,
    height: part.height,
    rotationDeg: groupedItem.rotationDeg,
    colorHex: part.colorHex || groupedItem.colorHex,
    materialId: groupedItem.materialId,
    parts: [
      {
        ...part,
        relX: 0,
        relY: 0,
        relZ: 0,
      },
    ],
  }));
}

/**
 * Boolean Combine (Merge) multiple furniture objects into a single solid monolithic geometry (Tutorial 14).
 */
export function combineFurnitureItems(
  items: FurnitureItem[],
  combinedName = "Combined Monolithic Stair"
): FurnitureItem {
  const grp = groupFurnitureItems(items, combinedName);
  return {
    ...grp,
    type: "staircase",
    isGrouped: false,
    subItems: undefined,
  };
}

/**
 * Creates an L-Shaped (Quarter-Turn) Architectural Staircase with intermediate Landing (Tutorial Part 14).
 */
export function createLShapedStaircaseItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  config: Partial<StaircaseParameters> = {}
): FurnitureItem {
  const flight1Count = config.stepCount || 8;
  const flight2Count = config.flight2StepCount || 8;
  const riserH = config.riserHeight || 0.17;
  const treadD = config.treadDepth || 0.28;
  const width = config.stairWidth || 1.20;
  const turnDir = config.turnDirection || "right"; // "left" or "right"
  const matId = config.materialId || "concrete_fair_faced";
  const colHex = config.colorHex || "#94a3b8";

  const flight1Run = flight1Count * treadD;
  const flight2Run = flight2Count * treadD;
  const landingSize = width;
  const totalRise = (flight1Count + flight2Count + 1) * riserH;

  const parts: FurniturePart[] = [];

  // Flight 1: Steps along Z axis
  for (let i = 0; i < flight1Count; i++) {
    parts.push({
      id: `${id}_f1_step_${i + 1}`,
      name: `Flight 1 - Step ${i + 1}`,
      relX: 0,
      relY: i * riserH,
      relZ: i * treadD - flight1Run / 2,
      width,
      length: treadD,
      height: riserH,
      colorHex: colHex,
      shape: "box",
    });
  }

  // Quarter Landing Platform at elevation flight1Count * riserH
  const landingY = flight1Count * riserH;
  const landingZ = flight1Run / 2 + landingSize / 2 - treadD / 2;
  parts.push({
    id: `${id}_quarter_landing`,
    name: "Quarter Landing Platform",
    relX: 0,
    relY: landingY,
    relZ: landingZ,
    width: landingSize,
    length: landingSize,
    height: riserH,
    colorHex: colHex,
    shape: "box",
  });

  // Flight 2: Steps turned 90 deg extending along X axis
  const dirSign = turnDir === "right" ? 1 : -1;
  for (let j = 0; j < flight2Count; j++) {
    const stepY = (flight1Count + 1 + j) * riserH;
    const stepX = dirSign * (landingSize / 2 + j * treadD + treadD / 2);
    parts.push({
      id: `${id}_f2_step_${j + 1}`,
      name: `Flight 2 - Step ${j + 1}`,
      relX: stepX,
      relY: stepY,
      relZ: landingZ,
      width: treadD,
      length: width,
      height: riserH,
      colorHex: colHex,
      shape: "box",
    });
  }

  // Safety Handrail Posts & Rails
  if (config.hasHandrail ?? true) {
    // Outer handrail on Flight 1
    const railX = -width / 2 + 0.04;
    parts.push({
      id: `${id}_f1_rail`,
      name: "Flight 1 Handrail",
      relX: railX,
      relY: landingY / 2 + 0.90,
      relZ: 0,
      width: 0.04,
      length: flight1Run,
      height: 0.04,
      colorHex: "#1e293b",
      shape: "box",
    });
    // Outer handrail on Flight 2
    parts.push({
      id: `${id}_f2_rail`,
      name: "Flight 2 Handrail",
      relX: dirSign * (landingSize / 2 + flight2Run / 2),
      relY: (landingY + totalRise) / 2 + 0.90,
      relZ: landingZ + width / 2 - 0.04,
      width: flight2Run,
      length: 0.04,
      height: 0.04,
      colorHex: "#1e293b",
      shape: "box",
    });
  }

  const stairParams: StaircaseParameters = {
    type: "quarter_turn",
    stepCount: flight1Count,
    flight2StepCount: flight2Count,
    riserHeight: riserH,
    treadDepth: treadD,
    stairWidth: width,
    waistThickness: 0.15,
    hasTopLanding: false,
    topLandingLength: 1.20,
    hasHandrail: config.hasHandrail ?? true,
    handrailSide: "both",
    materialId: matId,
    colorHex: colHex,
    calcSurfaceEnabled: true,
    targetLux: config.targetLux || 100,
    turnDirection: turnDir,
  };

  return {
    id,
    name: `L-Shaped Staircase (${flight1Count}+${flight2Count} Steps, Quarter-Turn)`,
    type: "staircase",
    x,
    y: 0,
    z,
    width: width + flight2Run,
    length: flight1Run + landingSize,
    height: totalRise,
    rotationDeg,
    colorHex: colHex,
    materialId: matId,
    parts,
    stairConfig: stairParams,
  };
}

/**
 * Creates a U-Shaped (Half-Turn / Dog-Leg) Architectural Staircase (Tutorial Part 14).
 */
export function createUShapedStaircaseItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  config: Partial<StaircaseParameters> = {}
): FurnitureItem {
  const flight1Count = config.stepCount || 8;
  const flight2Count = config.flight2StepCount || 8;
  const riserH = config.riserHeight || 0.17;
  const treadD = config.treadDepth || 0.28;
  const width = config.stairWidth || 1.10;
  const gap = config.wellGapWidth || 0.20;
  const landingD = config.landingDepth || 1.20;
  const matId = config.materialId || "concrete_fair_faced";
  const colHex = config.colorHex || "#94a3b8";

  const flightRun = Math.max(flight1Count, flight2Count) * treadD;
  const halfLandingWidth = 2 * width + gap;
  const totalRise = (flight1Count + flight2Count + 1) * riserH;
  const midLandingY = flight1Count * riserH;

  const parts: FurniturePart[] = [];

  // Flight 1: Ascends in +Z direction on the left
  const f1CenterX = -width / 2 - gap / 2;
  for (let i = 0; i < flight1Count; i++) {
    parts.push({
      id: `${id}_f1_step_${i + 1}`,
      name: `Flight 1 - Step ${i + 1}`,
      relX: f1CenterX,
      relY: i * riserH,
      relZ: i * treadD - flightRun / 2,
      width,
      length: treadD,
      height: riserH,
      colorHex: colHex,
      shape: "box",
    });
  }

  // Half Landing Platform at intermediate elevation spanning both flights
  const landingZ = flightRun / 2 + landingD / 2 - treadD / 2;
  parts.push({
    id: `${id}_half_landing`,
    name: "Half-Turn Intermediate Landing",
    relX: 0,
    relY: midLandingY,
    relZ: landingZ,
    width: halfLandingWidth,
    length: landingD,
    height: riserH,
    colorHex: colHex,
    shape: "box",
  });

  // Flight 2: Ascends in -Z direction (180 degree turn) on the right
  const f2CenterX = width / 2 + gap / 2;
  for (let j = 0; j < flight2Count; j++) {
    const stepY = (flight1Count + 1 + j) * riserH;
    const stepZ = landingZ - landingD / 2 - j * treadD - treadD / 2;
    parts.push({
      id: `${id}_f2_step_${j + 1}`,
      name: `Flight 2 - Step ${j + 1}`,
      relX: f2CenterX,
      relY: stepY,
      relZ: stepZ,
      width,
      length: treadD,
      height: riserH,
      colorHex: colHex,
      shape: "box",
    });
  }

  // Central Stairwell Balustrade divider
  parts.push({
    id: `${id}_central_guard`,
    name: "Stairwell Eye Guardrail",
    relX: 0,
    relY: midLandingY / 2 + 0.90,
    relZ: 0,
    width: 0.04,
    length: flightRun,
    height: 0.04,
    colorHex: "#1e293b",
    shape: "box",
  });

  const stairParams: StaircaseParameters = {
    type: "half_turn",
    stepCount: flight1Count,
    flight2StepCount: flight2Count,
    riserHeight: riserH,
    treadDepth: treadD,
    stairWidth: width,
    waistThickness: 0.15,
    hasTopLanding: false,
    topLandingLength: 1.20,
    hasHandrail: true,
    handrailSide: "both",
    materialId: matId,
    colorHex: colHex,
    calcSurfaceEnabled: true,
    targetLux: config.targetLux || 100,
    landingDepth: landingD,
    wellGapWidth: gap,
  };

  return {
    id,
    name: `U-Shaped Staircase (${flight1Count}+${flight2Count} Steps, Half-Turn)`,
    type: "staircase",
    x,
    y: 0,
    z,
    width: halfLandingWidth,
    length: flightRun + landingD,
    height: totalRise,
    rotationDeg,
    colorHex: colHex,
    materialId: matId,
    parts,
    stairConfig: stairParams,
  };
}

/**
 * Creates a Modern Cantilevered Floating Tread Staircase (Tutorial Part 14).
 */
export function createFloatingCantileverStaircaseItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  config: Partial<StaircaseParameters> = {}
): FurnitureItem {
  const stepCount = config.stepCount || 12;
  const riserH = config.riserHeight || 0.18;
  const treadD = config.treadDepth || 0.28;
  const width = config.stairWidth || 1.10;
  const matId = config.materialId || "wood_oak_parquet";
  const colHex = config.colorHex || "#d4b996";
  const totalRun = stepCount * treadD;
  const totalRise = stepCount * riserH;

  const parts: FurniturePart[] = [];

  for (let i = 0; i < stepCount; i++) {
    const stepZ = i * treadD - totalRun / 2 + treadD / 2;
    const stepY = i * riserH;
    // Wood / stone cantilever tread
    parts.push({
      id: `${id}_tread_${i + 1}`,
      name: `Floating Tread ${i + 1}`,
      relX: 0,
      relY: stepY,
      relZ: stepZ,
      width,
      length: treadD,
      height: 0.05,
      colorHex: colHex,
      shape: "box",
    });
    // Embedded steel wall mounting anchor pin
    parts.push({
      id: `${id}_pin_${i + 1}`,
      name: `Wall Anchor Pin ${i + 1}`,
      relX: -width / 2 - 0.05,
      relY: stepY + 0.015,
      relZ: stepZ,
      width: 0.12,
      length: 0.05,
      height: 0.04,
      colorHex: "#334155",
      shape: "box",
    });
  }

  // Frameless Architectural Glass Balustrade on the outer edge
  parts.push({
    id: `${id}_glass_rail`,
    name: "Architectural Glass Balustrade",
    relX: width / 2 - 0.02,
    relY: totalRise / 2 + 0.45,
    relZ: 0,
    width: 0.02,
    length: totalRun,
    height: 0.95,
    colorHex: "#e0f2fe",
    shape: "box",
  });

  const stairParams: StaircaseParameters = {
    type: "floating",
    stepCount,
    riserHeight: riserH,
    treadDepth: treadD,
    stairWidth: width,
    waistThickness: 0.05,
    hasTopLanding: false,
    topLandingLength: 1.20,
    hasHandrail: true,
    handrailSide: "right",
    materialId: matId,
    colorHex: colHex,
    calcSurfaceEnabled: true,
    targetLux: config.targetLux || 100,
  };

  return {
    id,
    name: `Floating Cantilevered Staircase (${stepCount} Treads)`,
    type: "staircase",
    x,
    y: 0,
    z,
    width,
    length: totalRun,
    height: totalRise,
    rotationDeg,
    colorHex: colHex,
    materialId: matId,
    parts,
    stairConfig: stairParams,
  };
}

/**
 * Creates a Spiral / Curved Array Staircase around a central pillar (Tutorial Part 14).
 */
export function createSpiralStaircaseItem(
  id: string,
  x: number,
  z: number,
  rotationDeg = 0,
  config: Partial<StaircaseParameters> = {}
): FurnitureItem {
  const stepCount = config.stepCount || 16;
  const riserH = config.riserHeight || 0.18;
  const radius = (config.stairWidth || 1.80) / 2;
  const matId = config.materialId || "wood_oak_parquet";
  const colHex = config.colorHex || "#d4b996";
  const totalRise = stepCount * riserH;

  const parts: FurniturePart[] = [];

  // Central cylindrical newel post
  parts.push({
    id: `${id}_central_column`,
    name: "Central Newel Pillar",
    relX: 0,
    relY: totalRise / 2,
    relZ: 0,
    width: 0.20,
    length: 0.20,
    height: totalRise,
    colorHex: "#334155",
    shape: "cylinder",
  });

  // Radial winder steps fanning out in a polar circle
  const angleStepRad = (Math.PI * 1.5) / stepCount; // 270 deg total turn
  for (let i = 0; i < stepCount; i++) {
    const angle = i * angleStepRad;
    const midR = radius * 0.6;
    const stepX = Math.cos(angle) * midR;
    const stepZ = Math.sin(angle) * midR;
    const stepY = i * riserH;

    parts.push({
      id: `${id}_spiral_step_${i + 1}`,
      name: `Spiral Step ${i + 1}`,
      relX: Number(stepX.toFixed(3)),
      relY: stepY,
      relZ: Number(stepZ.toFixed(3)),
      width: radius * 0.7,
      length: 0.28,
      height: 0.05,
      colorHex: colHex,
      shape: "box",
    });
  }

  const stairParams: StaircaseParameters = {
    type: "spiral",
    stepCount,
    riserHeight: riserH,
    treadDepth: 0.28,
    stairWidth: radius * 2,
    waistThickness: 0.05,
    hasTopLanding: false,
    topLandingLength: 1.0,
    hasHandrail: true,
    handrailSide: "right",
    materialId: matId,
    colorHex: colHex,
    calcSurfaceEnabled: true,
    targetLux: config.targetLux || 100,
  };

  return {
    id,
    name: `Spiral Staircase (${stepCount} Steps, R=${radius.toFixed(1)}m)`,
    type: "staircase",
    x,
    y: 0,
    z,
    width: radius * 2,
    length: radius * 2,
    height: totalRise,
    rotationDeg,
    colorHex: colHex,
    materialId: matId,
    parts,
    stairConfig: stairParams,
  };
}

/**
 * Calculates photometric compliance across multi-flight staircases and step lights (Tutorial Part 14).
 */
export function calculateMultiFlightStaircaseLighting(params: {
  stair: FurnitureItem;
  luminaires: Array<{ x: number; y: number; z: number; lumens?: number; wattage?: number; isExcluded?: boolean }>;
  mf?: number;
}): {
  avgLux: number;
  minLux: number;
  maxLux: number;
  uniformityU0: number;
  flight1AvgLux: number;
  flight2AvgLux: number;
  landingAvgLux: number;
  stepPoints: Array<{ stepNumber: number; flight: string; x: number; y: number; z: number; lux: number }>;
  isCompliant: boolean;
  targetLux: number;
} {
  const { stair, luminaires, mf = 0.8 } = params;
  const cfg = stair.stairConfig;
  const targetLux = cfg?.targetLux || 100;
  const f1Count = cfg?.stepCount || 8;
  const f2Count = cfg?.flight2StepCount || 8;
  const riserH = cfg?.riserHeight || 0.17;
  const treadD = cfg?.treadDepth || 0.28;

  // Combine general room luminaires and dedicated step lights
  const allLights = [
    ...luminaires.filter((l) => !l.isExcluded),
    ...(stair.stepLights || []).map((sl) => ({
      x: sl.x,
      y: sl.z,
      z: sl.y,
      lumens: sl.lumens,
      wattage: sl.wattage,
      isExcluded: false,
    })),
  ];

  const stepPoints: Array<{ stepNumber: number; flight: string; x: number; y: number; z: number; lux: number }> = [];

  const evalPoint = (wx: number, wy: number, wz: number): number => {
    let ptLux = 0;
    for (const lum of allLights) {
      const dx = wx - lum.x;
      const dz = wz - lum.y;
      const dy = lum.z - wy;
      const distHoriz = Math.sqrt(dx * dx + dz * dz);
      const dist3D = Math.sqrt(distHoriz * distHoriz + dy * dy);
      if (dist3D <= 0.05) continue;

      const cosPsi = Math.max(0, dy / dist3D);
      const fixtureLumens = lum.lumens || 3600;
      const I_approx = (fixtureLumens / (2 * Math.PI)) * cosPsi;
      const directLux = (I_approx * cosPsi * mf) / (dist3D * dist3D);
      ptLux += directLux;
    }
    return Math.round(ptLux);
  };

  // Flight 1 treads
  for (let i = 0; i < f1Count; i++) {
    const wx = stair.x;
    const wy = stair.y + (i + 1) * riserH;
    const wz = stair.z + i * treadD - (f1Count * treadD) / 2;
    stepPoints.push({
      stepNumber: i + 1,
      flight: "Flight 1",
      x: Number(wx.toFixed(2)),
      y: Number(wy.toFixed(2)),
      z: Number(wz.toFixed(2)),
      lux: evalPoint(wx, wy, wz),
    });
  }

  // Intermediate Landing
  const landingWy = stair.y + (f1Count + 1) * riserH;
  const landingWz = stair.z + (f1Count * treadD) / 2 + 0.6;
  stepPoints.push({
    stepNumber: f1Count + 1,
    flight: "Landing",
    x: Number(stair.x.toFixed(2)),
    y: Number(landingWy.toFixed(2)),
    z: Number(landingWz.toFixed(2)),
    lux: evalPoint(stair.x, landingWy, landingWz),
  });

  // Flight 2 treads (if present)
  if (cfg?.type === "quarter_turn" || cfg?.type === "half_turn") {
    for (let j = 0; j < f2Count; j++) {
      const wx = cfg.type === "half_turn" ? stair.x + 1.2 : stair.x + (j + 1) * treadD;
      const wy = stair.y + (f1Count + 1 + j + 1) * riserH;
      const wz = cfg.type === "half_turn" ? landingWz - (j + 1) * treadD : landingWz;
      stepPoints.push({
        stepNumber: f1Count + 2 + j,
        flight: "Flight 2",
        x: Number(wx.toFixed(2)),
        y: Number(wy.toFixed(2)),
        z: Number(wz.toFixed(2)),
        lux: evalPoint(wx, wy, wz),
      });
    }
  }

  const luxValues = stepPoints.map((p) => p.lux);
  const avgLux = luxValues.length > 0 ? Math.round(luxValues.reduce((a, b) => a + b, 0) / luxValues.length) : 0;
  const minLux = luxValues.length > 0 ? Math.min(...luxValues) : 0;
  const maxLux = luxValues.length > 0 ? Math.max(...luxValues) : 0;
  const uniformityU0 = avgLux > 0 ? parseFloat((minLux / avgLux).toFixed(2)) : 0;

  const f1Points = stepPoints.filter((p) => p.flight === "Flight 1");
  const f2Points = stepPoints.filter((p) => p.flight === "Flight 2");
  const lPoints = stepPoints.filter((p) => p.flight === "Landing");

  const flight1AvgLux = f1Points.length > 0 ? Math.round(f1Points.reduce((a, b) => a + b.lux, 0) / f1Points.length) : 0;
  const flight2AvgLux = f2Points.length > 0 ? Math.round(f2Points.reduce((a, b) => a + b.lux, 0) / f2Points.length) : 0;
  const landingAvgLux = lPoints.length > 0 ? Math.round(lPoints.reduce((a, b) => a + b.lux, 0) / lPoints.length) : 0;

  const isCompliant = avgLux >= targetLux && uniformityU0 >= 0.40;

  return {
    avgLux,
    minLux,
    maxLux,
    uniformityU0,
    flight1AvgLux,
    flight2AvgLux,
    landingAvgLux,
    stepPoints,
    isCompliant,
    targetLux,
  };
}

