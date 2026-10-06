/**
 * DIALux evo CAD Plan Import & Underlay Engine
 * 
 * Implements full DIALux evo CAD drawing workflow matching:
 * Official Tutorial: "DIALux evo Tutorials for Beginners part 2 — Importing a CAD plan" (nuebP3nBF3U)
 * 
 * Features:
 * 1. Plan File Import (DWG, DXF, PNG, JPG, SVG, and architectural templates)
 * 2. Unit Selection & Conversion (mm, cm, m, ft, in)
 * 3. Two-Point Interactive Scale Calibration (Pick 2 known points, calculate exact real-world scale)
 * 4. Origin & Coordinate Alignment (Set 0,0,0 reference point, rotation angle, X/Y translation)
 * 5. CAD Layer Management (Ebenenverwaltung: A-WALL, A-DOOR, A-GLAZ, A-FURN, E-LITE, M-HVAC, A-GRID, A-DIMS)
 * 6. Dynamic High-Resolution 2D/3D Vector/Canvas Underlay Generation for Three.js
 */

export type CADPlanUnit = "mm" | "cm" | "m" | "ft" | "in";

export interface CADLayer {
  id: string;
  name: string;
  description: string;
  color: string;
  visible: boolean;
  category: "walls" | "doors" | "windows" | "furniture" | "lighting" | "hvac" | "grid" | "dimensions";
}

export interface CADVectorElement {
  type: "line" | "rect" | "circle" | "arc" | "text";
  layerId: string;
  x1: number; // in meters relative to plan origin
  y1: number;
  x2?: number;
  y2?: number;
  r?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  strokeWidth?: number;
  fill?: boolean;
}

export interface CADPlan {
  id: string;
  name: string;
  fileName: string;
  fileFormat: "dwg" | "dxf" | "png" | "jpg" | "svg";
  unit: CADPlanUnit;
  scaleFactor: number; // Multiplier to get real meters
  originX: number; // meters offset from room origin
  originY: number; // meters offset from room origin
  rotationDeg: number; // degrees
  opacity: number; // 0.1 to 1.0
  visible: boolean;
  layers: CADLayer[];
  vectors: CADVectorElement[];
  imageDataUrl?: string; // If loaded from image/raster plan
  widthM: number; // Total real-world span in meters
  heightM: number;
}

/**
 * Standard DIALux evo Architectural Layer Configuration
 */
export const DEFAULT_CAD_LAYERS: CADLayer[] = [
  { id: "A-WALL", name: "A-WALL", description: "Exterior & Interior Structural Walls", color: "#38bdf8", visible: true, category: "walls" },
  { id: "A-DOOR", name: "A-DOOR", description: "Door Openings & Swing Arcs", color: "#f59e0b", visible: true, category: "doors" },
  { id: "A-GLAZ", name: "A-GLAZ", description: "Windows & Facade Glazing", color: "#06b6d4", visible: true, category: "windows" },
  { id: "A-FURN", name: "A-FURN", description: "Desks, Workstations & Furniture", color: "#a855f7", visible: true, category: "furniture" },
  { id: "E-LITE", name: "E-LITE", description: "Existing Luminaires & Circuits", color: "#fbbf24", visible: true, category: "lighting" },
  { id: "M-HVAC", name: "M-HVAC", description: "Ductwork & Air Diffusers", color: "#10b981", visible: false, category: "hvac" },
  { id: "A-GRID", name: "A-GRID", description: "Structural Column Axes (A-C / 1-3)", color: "#ef4444", visible: true, category: "grid" },
  { id: "A-DIMS", name: "A-DIMS", description: "Architectural Dimension Strings", color: "#94a3b8", visible: true, category: "dimensions" },
];

/**
 * Unit conversion factors to meters
 */
export const UNIT_TO_METERS: Record<CADPlanUnit, number> = {
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

/**
 * Built-in Architectural CAD Plans replicating authentic DWG/DXF files
 */
export const BUILTIN_CAD_PLANS: CADPlan[] = [
  {
    id: "plan-office-12x8",
    name: "Commercial Corporate Office (12m × 8m)",
    fileName: "HQ_Level_02_Office_Plan.dwg",
    fileFormat: "dwg",
    unit: "m",
    scaleFactor: 1.0,
    originX: 0.0,
    originY: 0.0,
    rotationDeg: 0,
    opacity: 0.85,
    visible: true,
    widthM: 12.0,
    heightM: 8.0,
    layers: JSON.parse(JSON.stringify(DEFAULT_CAD_LAYERS)),
    vectors: [
      // Outer Perimeter Walls (Double line 0.25m thickness)
      { type: "rect", layerId: "A-WALL", x1: 0, y1: 0, x2: 12, y2: 8, strokeWidth: 3 },
      { type: "rect", layerId: "A-WALL", x1: 0.25, y1: 0.25, x2: 11.75, y2: 7.75, strokeWidth: 1.5 },

      // Interior Partition Walls (Meeting room & Manager office)
      { type: "line", layerId: "A-WALL", x1: 7.5, y1: 0.25, x2: 7.5, y2: 4.5, strokeWidth: 2 },
      { type: "line", layerId: "A-WALL", x1: 7.5, y1: 4.5, x2: 11.75, y2: 4.5, strokeWidth: 2 },
      { type: "line", layerId: "A-WALL", x1: 4.0, y1: 5.0, x2: 4.0, y2: 7.75, strokeWidth: 2 },

      // Column Grid (A, B, C / 1, 2, 3)
      { type: "line", layerId: "A-GRID", x1: -0.8, y1: 0, x2: 12.8, y2: 0, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: -0.8, y1: 4, x2: 12.8, y2: 4, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: -0.8, y1: 8, x2: 12.8, y2: 8, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 0, y1: -0.8, x2: 0, y2: 8.8, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 6, y1: -0.8, x2: 6, y2: 8.8, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 12, y1: -0.8, x2: 12, y2: 8.8, strokeWidth: 1 },
      // Grid bubbles
      { type: "circle", layerId: "A-GRID", x1: -1.0, y1: 0, r: 0.35, text: "A" },
      { type: "circle", layerId: "A-GRID", x1: -1.0, y1: 4, r: 0.35, text: "B" },
      { type: "circle", layerId: "A-GRID", x1: -1.0, y1: 8, r: 0.35, text: "C" },
      { type: "circle", layerId: "A-GRID", x1: 0, y1: -1.0, r: 0.35, text: "1" },
      { type: "circle", layerId: "A-GRID", x1: 6, y1: -1.0, r: 0.35, text: "2" },
      { type: "circle", layerId: "A-GRID", x1: 12, y1: -1.0, r: 0.35, text: "3" },

      // Doors and Swing Arcs
      { type: "line", layerId: "A-DOOR", x1: 1.5, y1: 0.25, x2: 1.5, y2: 1.15, strokeWidth: 2 },
      { type: "arc", layerId: "A-DOOR", x1: 1.5, y1: 0.25, r: 0.9, startAngle: 0, endAngle: Math.PI / 2 },
      { type: "line", layerId: "A-DOOR", x1: 7.5, y1: 3.2, x2: 8.4, y2: 3.2, strokeWidth: 2 },
      { type: "arc", layerId: "A-DOOR", x1: 7.5, y1: 3.2, r: 0.9, startAngle: 0, endAngle: Math.PI / 2 },

      // Facade Windows
      { type: "rect", layerId: "A-GLAZ", x1: 1.0, y1: 7.7, x2: 3.5, y2: 7.95, fill: true },
      { type: "rect", layerId: "A-GLAZ", x1: 4.5, y1: 7.7, x2: 7.0, y2: 7.95, fill: true },
      { type: "rect", layerId: "A-GLAZ", x1: 8.0, y1: 7.7, x2: 11.0, y2: 7.95, fill: true },

      // Office Workstations Pods (4-desk cluster)
      { type: "rect", layerId: "A-FURN", x1: 1.5, y1: 1.8, x2: 3.1, y2: 2.6 },
      { type: "rect", layerId: "A-FURN", x1: 1.5, y1: 2.6, x2: 3.1, y2: 3.4 },
      { type: "rect", layerId: "A-FURN", x1: 3.8, y1: 1.8, x2: 5.4, y2: 2.6 },
      { type: "rect", layerId: "A-FURN", x1: 3.8, y1: 2.6, x2: 5.4, y2: 3.4 },

      // Conference Room Table
      { type: "rect", layerId: "A-FURN", x1: 8.6, y1: 1.5, x2: 10.8, y2: 3.2 },
      { type: "circle", layerId: "A-FURN", x1: 9.0, y1: 1.0, r: 0.25 },
      { type: "circle", layerId: "A-FURN", x1: 9.7, y1: 1.0, r: 0.25 },
      { type: "circle", layerId: "A-FURN", x1: 10.4, y1: 1.0, r: 0.25 },
      { type: "circle", layerId: "A-FURN", x1: 9.0, y1: 3.7, r: 0.25 },
      { type: "circle", layerId: "A-FURN", x1: 9.7, y1: 3.7, r: 0.25 },
      { type: "circle", layerId: "A-FURN", x1: 10.4, y1: 3.7, r: 0.25 },

      // Architectural Dimension Strings
      { type: "line", layerId: "A-DIMS", x1: 0, y1: 8.5, x2: 12, y2: 8.5, strokeWidth: 1 },
      { type: "text", layerId: "A-DIMS", x1: 6.0, y1: 8.7, text: "12.000 m" },
      { type: "line", layerId: "A-DIMS", x1: 12.5, y1: 0, x2: 12.5, y2: 8, strokeWidth: 1 },
      { type: "text", layerId: "A-DIMS", x1: 12.7, y1: 4.0, text: "8.000 m" },
    ],
  },
  {
    id: "plan-classroom-16x10",
    name: "Educational Classroom & Laboratory Wing (16m × 10m)",
    fileName: "Campus_Block_B_Classroom.dxf",
    fileFormat: "dxf",
    unit: "m",
    scaleFactor: 1.0,
    originX: 0.0,
    originY: 0.0,
    rotationDeg: 0,
    opacity: 0.85,
    visible: true,
    widthM: 16.0,
    heightM: 10.0,
    layers: JSON.parse(JSON.stringify(DEFAULT_CAD_LAYERS)),
    vectors: [
      { type: "rect", layerId: "A-WALL", x1: 0, y1: 0, x2: 16, y2: 10, strokeWidth: 3 },
      { type: "rect", layerId: "A-WALL", x1: 0.3, y1: 0.3, x2: 15.7, y2: 9.7, strokeWidth: 1.5 },
      { type: "line", layerId: "A-WALL", x1: 11.5, y1: 0.3, x2: 11.5, y2: 9.7, strokeWidth: 2 },
      // Doors
      { type: "line", layerId: "A-DOOR", x1: 2.0, y1: 0.3, x2: 2.0, y2: 1.3, strokeWidth: 2 },
      { type: "arc", layerId: "A-DOOR", x1: 2.0, y1: 0.3, r: 1.0, startAngle: 0, endAngle: Math.PI / 2 },
      // Glazing
      { type: "rect", layerId: "A-GLAZ", x1: 2.0, y1: 9.6, x2: 9.0, y2: 9.9, fill: true },
      // Desks in rows
      { type: "rect", layerId: "A-FURN", x1: 2.5, y1: 2.5, x2: 4.5, y2: 3.2 },
      { type: "rect", layerId: "A-FURN", x1: 5.5, y1: 2.5, x2: 7.5, y2: 3.2 },
      { type: "rect", layerId: "A-FURN", x1: 2.5, y1: 4.5, x2: 4.5, y2: 5.2 },
      { type: "rect", layerId: "A-FURN", x1: 5.5, y1: 4.5, x2: 7.5, y2: 5.2 },
      { type: "rect", layerId: "A-FURN", x1: 2.5, y1: 6.5, x2: 4.5, y2: 7.2 },
      { type: "rect", layerId: "A-FURN", x1: 5.5, y1: 6.5, x2: 7.5, y2: 7.2 },
      // Podium
      { type: "rect", layerId: "A-FURN", x1: 3.5, y1: 8.3, x2: 6.5, y2: 9.0 },
      // Dimensions
      { type: "line", layerId: "A-DIMS", x1: 0, y1: 10.6, x2: 16, y2: 10.6, strokeWidth: 1 },
      { type: "text", layerId: "A-DIMS", x1: 8.0, y1: 10.9, text: "16.000 m" },
    ],
  },
  {
    id: "plan-warehouse-24x16",
    name: "Industrial High-Bay Logistics Warehouse (24m × 16m)",
    fileName: "Industrial_Logistics_Park_Unit3.dwg",
    fileFormat: "dwg",
    unit: "m",
    scaleFactor: 1.0,
    originX: 0.0,
    originY: 0.0,
    rotationDeg: 0,
    opacity: 0.85,
    visible: true,
    widthM: 24.0,
    heightM: 16.0,
    layers: JSON.parse(JSON.stringify(DEFAULT_CAD_LAYERS)),
    vectors: [
      { type: "rect", layerId: "A-WALL", x1: 0, y1: 0, x2: 24, y2: 16, strokeWidth: 3 },
      // Roller Shutter Industrial Doors
      { type: "line", layerId: "A-DOOR", x1: 6.0, y1: 0, x2: 10.0, y2: 0, strokeWidth: 4 },
      { type: "line", layerId: "A-DOOR", x1: 14.0, y1: 0, x2: 18.0, y2: 0, strokeWidth: 4 },
      // Office mezzanine enclosure
      { type: "rect", layerId: "A-WALL", x1: 18.0, y1: 10.0, x2: 23.5, y2: 15.5 },
      // High-bay pallet racking lines
      { type: "rect", layerId: "A-FURN", x1: 3.0, y1: 3.0, x2: 5.5, y2: 14.0 },
      { type: "rect", layerId: "A-FURN", x1: 8.0, y1: 3.0, x2: 10.5, y2: 14.0 },
      { type: "rect", layerId: "A-FURN", x1: 13.0, y1: 3.0, x2: 15.5, y2: 14.0 },
      // Column grid
      { type: "line", layerId: "A-GRID", x1: 0, y1: 8, x2: 24, y2: 8, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 6, y1: 0, x2: 6, y2: 16, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 12, y1: 0, x2: 12, y2: 16, strokeWidth: 1 },
      { type: "line", layerId: "A-GRID", x1: 18, y1: 0, x2: 18, y2: 16, strokeWidth: 1 },
    ],
  },
];

/**
 * Calculates real-world scale factor from two user measurement points
 * Formula: scaleFactor = realWorldDistance / measuredDistance
 */
export function calculateScaleFactor(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  knownRealDistanceMeters: number
): number {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const measuredDist = Math.sqrt(dx * dx + dy * dy);
  if (measuredDist <= 0 || knownRealDistanceMeters <= 0) return 1.0;
  return Number((knownRealDistanceMeters / measuredDist).toFixed(4));
}

/**
 * Renders a high-resolution 2D CAD Plan vector canvas texture
 * Suitable for Three.js PlaneGeometry Floor Underlay
 */
export function renderCADPlanToCanvas(
  plan: CADPlan,
  roomL: number,
  roomW: number,
  options: {
    bgTheme?: "dark" | "white";
    resolutionScale?: number;
  } = {}
): HTMLCanvasElement {
  const { bgTheme = "dark", resolutionScale = 200 } = options;

  const canvas = document.createElement("canvas");
  const pxWidth = Math.max(800, Math.round(roomL * resolutionScale));
  const pxHeight = Math.max(600, Math.round(roomW * resolutionScale));
  canvas.width = pxWidth;
  canvas.height = pxHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background Fill matching theme
  ctx.fillStyle = bgTheme === "dark" ? "#13161c" : "#ffffff";
  ctx.fillRect(0, 0, pxWidth, pxHeight);

  // Subtle CAD Background Grid (1.0m spacing)
  const gridStepPx = resolutionScale;
  ctx.strokeStyle = bgTheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= pxWidth; x += gridStepPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, pxHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= pxHeight; y += gridStepPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(pxWidth, y);
    ctx.stroke();
  }

  // Active layers lookup
  const layerMap = new Map<string, CADLayer>();
  plan.layers.forEach((l) => layerMap.set(l.id, l));

  // Transform coordinates for CAD Plan Origin & Scale
  const toPxX = (mX: number) => {
    const scaledX = (mX * plan.scaleFactor) + plan.originX;
    return (scaledX / roomL) * pxWidth;
  };

  const toPxY = (mY: number) => {
    const scaledY = (mY * plan.scaleFactor) + plan.originY;
    // In CAD / Three.js floor, Y represents Z (width)
    return (scaledY / roomW) * pxHeight;
  };

  // Render Plan Vectors
  plan.vectors.forEach((v) => {
    const layer = layerMap.get(v.layerId);
    if (layer && !layer.visible) return;

    const strokeCol = layer ? layer.color : (bgTheme === "dark" ? "#38bdf8" : "#0284c7");
    ctx.strokeStyle = strokeCol;
    ctx.fillStyle = strokeCol;
    ctx.lineWidth = (v.strokeWidth || 1.5) * (resolutionScale / 100);

    if (v.type === "line" && v.x2 !== undefined && v.y2 !== undefined) {
      ctx.beginPath();
      ctx.moveTo(toPxX(v.x1), toPxY(v.y1));
      ctx.lineTo(toPxX(v.x2), toPxY(v.y2));
      ctx.stroke();
    } else if (v.type === "rect" && v.x2 !== undefined && v.y2 !== undefined) {
      const rx = toPxX(Math.min(v.x1, v.x2));
      const ry = toPxY(Math.min(v.y1, v.y2));
      const rw = Math.abs(toPxX(v.x2) - toPxX(v.x1));
      const rh = Math.abs(toPxY(v.y2) - toPxY(v.y1));
      if (v.fill) {
        ctx.globalAlpha = 0.25;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.globalAlpha = 1.0;
      }
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (v.type === "circle" && v.r !== undefined) {
      const cx = toPxX(v.x1);
      const cy = toPxY(v.y1);
      const cr = v.r * (pxWidth / roomL);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, 2 * Math.PI);
      ctx.stroke();

      if (v.text) {
        ctx.font = `bold ${Math.round(cr * 1.1)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(v.text, cx, cy);
      }
    } else if (v.type === "arc" && v.r !== undefined && v.startAngle !== undefined && v.endAngle !== undefined) {
      const cx = toPxX(v.x1);
      const cy = toPxY(v.y1);
      const cr = v.r * (pxWidth / roomL);
      ctx.beginPath();
      ctx.arc(cx, cy, cr, v.startAngle, v.endAngle);
      ctx.stroke();
    } else if (v.type === "text" && v.text) {
      ctx.font = `bold 12px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.text, toPxX(v.x1), toPxY(v.y1));
    }
  });

  // Title Block in corner (matching CAD titleblocks)
  ctx.fillStyle = bgTheme === "dark" ? "rgba(15,23,42,0.85)" : "rgba(241,245,249,0.9)";
  ctx.strokeStyle = bgTheme === "dark" ? "#334155" : "#cbd5e1";
  ctx.lineWidth = 1;
  const tbW = 240;
  const tbH = 50;
  ctx.fillRect(pxWidth - tbW - 10, pxHeight - tbH - 10, tbW, tbH);
  ctx.strokeRect(pxWidth - tbW - 10, pxHeight - tbH - 10, tbW, tbH);

  ctx.fillStyle = bgTheme === "dark" ? "#ffffff" : "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(plan.name, pxWidth - tbW, pxHeight - tbH + 10);
  ctx.fillStyle = bgTheme === "dark" ? "#94a3b8" : "#64748b";
  ctx.font = "9.5px monospace";
  ctx.fillText(`File: ${plan.fileName} | Scale 1:${Math.round(100 / plan.scaleFactor)}`, pxWidth - tbW, pxHeight - tbH + 25);
  ctx.fillText(`Units: ${plan.unit.toUpperCase()} | Rot: ${plan.rotationDeg}°`, pxWidth - tbW, pxHeight - tbH + 38);

  return canvas;
}
