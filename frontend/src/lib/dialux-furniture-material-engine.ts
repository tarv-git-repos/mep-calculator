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
  | "reception_desk";

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
