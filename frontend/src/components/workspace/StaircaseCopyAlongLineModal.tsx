import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Trash2,
  Box,
  Sliders,
  Check,
  Eye,
  Info,
  Maximize2,
  ArrowUpRight,
  Shield,
  HelpCircle,
  Copy,
  FolderTree,
  UnfoldHorizontal,
  Lightbulb,
  Maximize,
  Compass,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";
import {
  FurnitureItem,
  StaircaseParameters,
  CopyAlongLineConfig,
  generateCopyAlongLineObjects,
  groupFurnitureItems,
  ungroupFurnitureItem,
  combineFurnitureItems,
  createLShapedStaircaseItem,
  createUShapedStaircaseItem,
  createFloatingCantileverStaircaseItem,
  createSpiralStaircaseItem,
  calculateStaircaseBlondel,
  calculateMultiFlightStaircaseLighting,
  DIALUX_MATERIAL_CATALOG,
} from "@/lib/dialux-furniture-material-engine";

export interface StaircaseCopyAlongLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomLength: number;
  roomWidth: number;
  roomHeight: number;
  furnitureList: FurnitureItem[];
  selectedFurnitureId?: string | null;
  luminaires?: Array<{ x: number; y: number; z: number; lumens?: number; wattage?: number; isExcluded?: boolean }>;
  mf?: number;
  onAddFurnitureItems: (items: FurnitureItem[]) => void;
  onUpdateFurnitureList: (newList: FurnitureItem[]) => void;
}

export type ActiveTabType = "copy_line" | "multi_flight" | "grouping" | "photometry";

export function StaircaseCopyAlongLineModal({
  isOpen,
  onClose,
  roomLength,
  roomWidth,
  roomHeight,
  furnitureList,
  selectedFurnitureId,
  luminaires = [],
  mf = 0.8,
  onAddFurnitureItems,
  onUpdateFurnitureList,
}: StaircaseCopyAlongLineModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTabType>("copy_line");

  // =========================================================================
  // TAB 1: COPY ALONG A LINE STATE
  // =========================================================================
  const [sourceTemplate, setSourceTemplate] = useState<
    "step_box" | "floating_tread" | "baluster_post" | "step_light" | "cube_block" | "custom_item"
  >("step_box");
  const [copyMode, setCopyMode] = useState<"fixed_count" | "fixed_spacing">("fixed_count");
  const [copyCount, setCopyCount] = useState<number>(10);
  const [copySpacing, setCopySpacing] = useState<number>(0.28);
  const [startX, setStartX] = useState<number>(2.0);
  const [startY, setStartY] = useState<number>(0.0);
  const [startZ, setStartZ] = useState<number>(2.0);
  const [endX, setEndX] = useState<number>(2.0);
  const [endY, setEndY] = useState<number>(1.7);
  const [endZ, setEndZ] = useState<number>(4.8);
  const [riserOffsetDeltaY, setRiserOffsetDeltaY] = useState<number>(0.17);
  const [alignment, setAlignment] = useState<"keep" | "follow_line">("follow_line");
  const [groupResults, setGroupResults] = useState<boolean>(true);
  const [stepWidth, setStepWidth] = useState<number>(1.20);
  const [stepTreadDepth, setStepTreadDepth] = useState<number>(0.28);
  const [stepRiserHeight, setStepRiserHeight] = useState<number>(0.17);
  const [copyMaterialId, setCopyMaterialId] = useState<string>("concrete_fair_faced");
  const [copyColorHex, setCopyColorHex] = useState<string>("#94a3b8");

  // 2D Line Canvas ref
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // =========================================================================
  // TAB 2: MULTI-FLIGHT ARCHITECTURES STATE
  // =========================================================================
  const [multiFlightType, setMultiFlightType] = useState<
    "quarter_turn" | "half_turn" | "floating" | "spiral"
  >("quarter_turn");
  const [mfFlight1Count, setMfFlight1Count] = useState<number>(8);
  const [mfFlight2Count, setMfFlight2Count] = useState<number>(8);
  const [mfRiserHeight, setMfRiserHeight] = useState<number>(0.17);
  const [mfTreadDepth, setMfTreadDepth] = useState<number>(0.28);
  const [mfStairWidth, setMfStairWidth] = useState<number>(1.20);
  const [mfTurnDir, setMfTurnDir] = useState<"left" | "right">("right");
  const [mfLandingDepth, setMfLandingDepth] = useState<number>(1.20);
  const [mfWellGap, setMfWellGap] = useState<number>(0.20);
  const [mfSpiralRadius, setMfSpiralRadius] = useState<number>(0.90);
  const [mfPosX, setMfPosX] = useState<number>(Math.max(1, (roomLength / 2) - 1));
  const [mfPosZ, setMfPosZ] = useState<number>(Math.max(1, (roomWidth / 2) - 1));
  const [mfRotationDeg, setMfRotationDeg] = useState<number>(0);
  const [mfMaterialId, setMfMaterialId] = useState<string>("concrete_fair_faced");
  const [mfColorHex, setMfColorHex] = useState<string>("#94a3b8");
  const [mfHasHandrail, setMfHasHandrail] = useState<boolean>(true);
  const [mfTargetLux, setMfTargetLux] = useState<number>(100);

  // 2D Multi-flight canvas ref
  const multiFlightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // =========================================================================
  // TAB 3: OBJECT GROUPING & BOOLEAN COMBINE STATE
  // =========================================================================
  const [selectedGroupItemIds, setSelectedGroupItemIds] = useState<string[]>([]);
  const [groupCustomName, setGroupCustomName] = useState<string>("Staircase Assembly Group");

  // =========================================================================
  // TAB 4: STEP LIGHTING & EN 12464-1 PHOTOMETRY STATE
  // =========================================================================
  const [includeStepLights, setIncludeStepLights] = useState<boolean>(true);
  const [stepLightEveryN, setStepLightEveryN] = useState<number>(2); // every 2nd step
  const [stepLightLumens, setStepLightLumens] = useState<number>(250); // lumens
  const [stepLightWattage, setStepLightWattage] = useState<number>(4);

  // Ergonomic Blondel calculation for multi-flight
  const blondelInfo = useMemo(() => {
    return calculateStaircaseBlondel(mfRiserHeight, mfTreadDepth);
  }, [mfRiserHeight, mfTreadDepth]);

  // Find currently selected object in room (for custom object copying)
  const currentSelectedRoomItem = useMemo(() => {
    return furnitureList.find((f) => f.id === selectedFurnitureId);
  }, [furnitureList, selectedFurnitureId]);

  // Preview generated multi-flight staircase for calculations
  const previewMultiFlightStair = useMemo<FurnitureItem>(() => {
    const config: Partial<StaircaseParameters> = {
      stepCount: mfFlight1Count,
      flight2StepCount: mfFlight2Count,
      riserHeight: mfRiserHeight,
      treadDepth: mfTreadDepth,
      stairWidth: mfStairWidth,
      turnDirection: mfTurnDir,
      landingDepth: mfLandingDepth,
      wellGapWidth: mfWellGap,
      materialId: mfMaterialId,
      colorHex: mfColorHex,
      hasHandrail: mfHasHandrail,
      targetLux: mfTargetLux,
    };

    let stair: FurnitureItem;
    if (multiFlightType === "quarter_turn") {
      stair = createLShapedStaircaseItem("preview_mf", mfPosX, mfPosZ, mfRotationDeg, config);
    } else if (multiFlightType === "half_turn") {
      stair = createUShapedStaircaseItem("preview_mf", mfPosX, mfPosZ, mfRotationDeg, config);
    } else if (multiFlightType === "floating") {
      stair = createFloatingCantileverStaircaseItem("preview_mf", mfPosX, mfPosZ, mfRotationDeg, config);
    } else {
      stair = createSpiralStaircaseItem("preview_mf", mfPosX, mfPosZ, mfRotationDeg, {
        ...config,
        stairWidth: mfSpiralRadius * 2,
      });
    }

    // Add optional step lights
    if (includeStepLights) {
      const stepLights: Array<{ x: number; y: number; z: number; lumens: number; wattage: number }> = [];
      const totalSteps = mfFlight1Count + (multiFlightType === "quarter_turn" || multiFlightType === "half_turn" ? mfFlight2Count : 0);
      for (let s = 0; s < totalSteps; s += stepLightEveryN) {
        stepLights.push({
          x: stair.x + (s % 2 === 0 ? -mfStairWidth / 2 : mfStairWidth / 2),
          y: (s + 1) * mfRiserHeight + 0.25,
          z: stair.z + s * mfTreadDepth,
          lumens: stepLightLumens,
          wattage: stepLightWattage,
        });
      }
      stair.stepLights = stepLights;
    }

    return stair;
  }, [
    multiFlightType,
    mfFlight1Count,
    mfFlight2Count,
    mfRiserHeight,
    mfTreadDepth,
    mfStairWidth,
    mfTurnDir,
    mfLandingDepth,
    mfWellGap,
    mfSpiralRadius,
    mfPosX,
    mfPosZ,
    mfRotationDeg,
    mfMaterialId,
    mfColorHex,
    mfHasHandrail,
    mfTargetLux,
    includeStepLights,
    stepLightEveryN,
    stepLightLumens,
    stepLightWattage,
  ]);

  // Lighting simulation across multi-flight
  const lightingResults = useMemo(() => {
    return calculateMultiFlightStaircaseLighting({
      stair: previewMultiFlightStair,
      luminaires,
      mf,
    });
  }, [previewMultiFlightStair, luminaires, mf]);

  // =========================================================================
  // 2D CANVAS DRAFTING (TAB 1: LINE VECTOR DRAFT)
  // =========================================================================
  useEffect(() => {
    if (!isOpen || activeTab !== "copy_line") return;
    const canvas = lineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background & grid
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
    ctx.lineWidth = 1;
    const gridStep = 30;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Room scale mapping
    const padding = 35;
    const scaleX = (w - padding * 2) / Math.max(roomLength, 1);
    const scaleZ = (h - padding * 2) / Math.max(roomWidth, 1);
    const scale = Math.min(scaleX, scaleZ);

    const originX = padding;
    const originY = padding;

    // Room boundary
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(originX, originY, roomLength * scale, roomWidth * scale);

    // Start & End Points in Canvas
    const cStartX = originX + startX * scale;
    const cStartZ = originY + startZ * scale;
    const cEndX = originX + endX * scale;
    const cEndZ = originY + endZ * scale;

    // Displacement vector line
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cStartX, cStartZ);
    ctx.lineTo(cEndX, cEndZ);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate count
    const dx = endX - startX;
    const dz = endZ - startZ;
    const distHoriz = Math.sqrt(dx * dx + dz * dz);
    let count = copyCount;
    if (copyMode === "fixed_spacing") {
      count = Math.max(2, Math.floor(distHoriz / Math.max(0.1, copySpacing)) + 1);
    }

    // Draw copied step boxes along vector
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const px = cStartX + t * (cEndX - cStartX);
      const pz = cStartZ + t * (cEndZ - cStartZ);

      const bW = stepWidth * scale;
      const bD = stepTreadDepth * scale;

      ctx.fillStyle = i === 0 ? "#10b981" : i === count - 1 ? "#ef4444" : "rgba(245, 158, 11, 0.4)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.fillRect(px - bW / 2, pz - bD / 2, bW, bD);
      ctx.strokeRect(px - bW / 2, pz - bD / 2, bW, bD);

      // Label step index
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, px, pz);
    }

    // Start Pin Marker
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(cStartX, cStartZ, 6, 0, Math.PI * 2);
    ctx.fill();

    // End Pin Marker
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cEndX, cEndZ, 6, 0, Math.PI * 2);
    ctx.fill();

    // Legend
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Vector: ΔH = ${distHoriz.toFixed(2)}m | Rise: ${(count * riserOffsetDeltaY).toFixed(2)}m | Steps: ${count}`, 15, h - 15);
  }, [
    isOpen,
    activeTab,
    startX,
    startZ,
    endX,
    endZ,
    copyCount,
    copySpacing,
    copyMode,
    stepWidth,
    stepTreadDepth,
    riserOffsetDeltaY,
    roomLength,
    roomWidth,
  ]);

  // =========================================================================
  // 2D CANVAS DRAFTING (TAB 2: MULTI-FLIGHT PREVIEW)
  // =========================================================================
  useEffect(() => {
    if (!isOpen || activeTab !== "multi_flight") return;
    const canvas = multiFlightCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Center coordinate
    const cX = w / 2;
    const cY = h / 2;
    const pxPerM = 40;

    const f1Run = mfFlight1Count * mfTreadDepth;
    const f2Run = mfFlight2Count * mfTreadDepth;

    if (multiFlightType === "quarter_turn") {
      // Flight 1: Vertical run
      const f1W = mfStairWidth * pxPerM;
      const f1L = f1Run * pxPerM;
      const landS = mfStairWidth * pxPerM;
      const f2L = f2Run * pxPerM;

      const f1TopY = cY;
      const f1BottomY = cY + f1L;
      const f1LeftX = cX - f1W / 2;

      // Draw Flight 1 treads
      for (let i = 0; i < mfFlight1Count; i++) {
        const stepY = f1BottomY - (i + 1) * (f1L / mfFlight1Count);
        ctx.fillStyle = "#334155";
        ctx.strokeStyle = "#64748b";
        ctx.fillRect(f1LeftX, stepY, f1W, f1L / mfFlight1Count);
        ctx.strokeRect(f1LeftX, stepY, f1W, f1L / mfFlight1Count);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, f1LeftX + f1W / 2, stepY + (f1L / mfFlight1Count) / 2 + 3);
      }

      // Quarter Landing Platform
      const landY = f1TopY - landS;
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(f1LeftX, landY, landS, landS);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(f1LeftX, landY, landS, landS);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("Landing", f1LeftX + landS / 2, landY + landS / 2 + 3);

      // Flight 2: Horizontal run
      const f2StartX = mfTurnDir === "right" ? f1LeftX + landS : f1LeftX - f2L;
      for (let j = 0; j < mfFlight2Count; j++) {
        const stepX = mfTurnDir === "right" ? f2StartX + j * (f2L / mfFlight2Count) : f2StartX + j * (f2L / mfFlight2Count);
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#64748b";
        ctx.fillRect(stepX, landY, f2L / mfFlight2Count, landS);
        ctx.strokeRect(stepX, landY, f2L / mfFlight2Count, landS);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "9px sans-serif";
        ctx.fillText(`${mfFlight1Count + 1 + j}`, stepX + (f2L / mfFlight2Count) / 2, landY + landS / 2 + 3);
      }
    } else if (multiFlightType === "half_turn") {
      // U-Shape / Dog-Leg staircase
      const fW = mfStairWidth * pxPerM;
      const fL = f1Run * pxPerM;
      const gap = mfWellGap * pxPerM;
      const landD = mfLandingDepth * pxPerM;
      const totalW = fW * 2 + gap;

      const f1X = cX - totalW / 2;
      const f2X = cX + gap / 2;
      const fBottomY = cY + fL / 2;

      // Flight 1
      for (let i = 0; i < mfFlight1Count; i++) {
        const stepY = fBottomY - (i + 1) * (fL / mfFlight1Count);
        ctx.fillStyle = "#334155";
        ctx.strokeStyle = "#64748b";
        ctx.fillRect(f1X, stepY, fW, fL / mfFlight1Count);
        ctx.strokeRect(f1X, stepY, fW, fL / mfFlight1Count);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, f1X + fW / 2, stepY + (fL / mfFlight1Count) / 2 + 3);
      }

      // Half Landing
      const landY = fBottomY - fL - landD;
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(f1X, landY, totalW, landD);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(f1X, landY, totalW, landD);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("Half-Turn Landing", cX, landY + landD / 2 + 3);

      // Flight 2 (Return flight descending visually or ascending in opposite direction)
      for (let j = 0; j < mfFlight2Count; j++) {
        const stepY = landY + landD + j * (fL / mfFlight2Count);
        ctx.fillStyle = "#475569";
        ctx.strokeStyle = "#64748b";
        ctx.fillRect(f2X, stepY, fW, fL / mfFlight2Count);
        ctx.strokeRect(f2X, stepY, fW, fL / mfFlight2Count);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "9px sans-serif";
        ctx.fillText(`${mfFlight1Count + 1 + j}`, f2X + fW / 2, stepY + (fL / mfFlight2Count) / 2 + 3);
      }
    } else if (multiFlightType === "floating") {
      // Floating Cantilevered
      const fW = mfStairWidth * pxPerM;
      const fL = f1Run * pxPerM;
      const stepH = fL / mfFlight1Count;
      const startX = cX - fW / 2;

      for (let i = 0; i < mfFlight1Count; i++) {
        const sy = cY + fL / 2 - (i + 1) * stepH;
        ctx.fillStyle = "#d97706";
        ctx.strokeStyle = "#fbbf24";
        ctx.fillRect(startX, sy, fW, stepH * 0.85);
        ctx.strokeRect(startX, sy, fW, stepH * 0.85);

        // Wall anchor indicator
        ctx.fillStyle = "#334155";
        ctx.fillRect(startX - 12, sy + 3, 12, 6);
      }
    } else {
      // Spiral
      const r = mfSpiralRadius * pxPerM;
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cX, cY, r, 0, Math.PI * 2);
      ctx.stroke();

      // Central Pillar
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(cX, cY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Radial steps
      const stepAngle = (Math.PI * 1.5) / mfFlight1Count;
      for (let i = 0; i < mfFlight1Count; i++) {
        const angle = i * stepAngle;
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(cX + Math.cos(angle) * r, cY + Math.sin(angle) * r);
        ctx.stroke();
      }
    }
  }, [
    isOpen,
    activeTab,
    multiFlightType,
    mfFlight1Count,
    mfFlight2Count,
    mfRiserHeight,
    mfTreadDepth,
    mfStairWidth,
    mfTurnDir,
    mfLandingDepth,
    mfWellGap,
    mfSpiralRadius,
  ]);

  if (!isOpen) return null;

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleExecuteCopyAlongLine = () => {
    const config: CopyAlongLineConfig = {
      sourceTemplate,
      customItem: sourceTemplate === "custom_item" ? currentSelectedRoomItem : undefined,
      startX,
      startY,
      startZ,
      endX,
      endY,
      endZ,
      mode: copyMode,
      count: copyCount,
      spacing: copySpacing,
      riserOffsetDeltaY,
      alignment,
      materialId: copyMaterialId,
      colorHex: copyColorHex,
      groupResults,
      stepWidth,
      stepTreadDepth,
      stepRiserHeight,
      stepLightLumens,
      stepLightWattage,
    };

    const newItems = generateCopyAlongLineObjects(config);
    onAddFurnitureItems(newItems);
    toast.success(
      `Successfully generated ${newItems.length > 1 ? `${newItems.length} individual items` : "1 grouped assembly"} along line!`
    );
    onClose();
  };

  const handleInsertMultiFlightStaircase = () => {
    onAddFurnitureItems([previewMultiFlightStair]);
    toast.success(`Inserted ${previewMultiFlightStair.name} into room simulation!`);
    onClose();
  };

  const handleGroupSelectedObjects = () => {
    if (selectedGroupItemIds.length < 2) {
      toast.error("Please select at least 2 room objects to group together (Ctrl+G)");
      return;
    }
    const toGroup = furnitureList.filter((f) => selectedGroupItemIds.includes(f.id));
    const grouped = groupFurnitureItems(toGroup, groupCustomName || "Grouped Stair Assembly");
    const remaining = furnitureList.filter((f) => !selectedGroupItemIds.includes(f.id));

    onUpdateFurnitureList([...remaining, grouped]);
    setSelectedGroupItemIds([grouped.id]);
    toast.success(`Grouped ${toGroup.length} objects into unified assembly: "${grouped.name}"`);
  };

  const handleUngroupSelectedObject = (itemId: string) => {
    const target = furnitureList.find((f) => f.id === itemId);
    if (!target) return;
    const exploded = ungroupFurnitureItem(target);
    const remaining = furnitureList.filter((f) => f.id !== itemId);

    onUpdateFurnitureList([...remaining, ...exploded]);
    toast.success(`Ungrouped "${target.name}" into ${exploded.length} individual objects.`);
  };

  const handleBooleanCombineSelected = () => {
    if (selectedGroupItemIds.length < 2) {
      toast.error("Select at least 2 objects to merge with Boolean Combine");
      return;
    }
    const toCombine = furnitureList.filter((f) => selectedGroupItemIds.includes(f.id));
    const combined = combineFurnitureItems(toCombine, groupCustomName || "Combined Monolithic Stair");
    const remaining = furnitureList.filter((f) => !selectedGroupItemIds.includes(f.id));

    onUpdateFurnitureList([...remaining, combined]);
    setSelectedGroupItemIds([combined.id]);
    toast.success(`Boolean Combine merged ${toCombine.length} objects into single solid mesh.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[88vh] bg-[#14161a] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-[#1b1f26] border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400">
              <Copy className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                DIALux evo Tutorial Part 14: Staircases Part 2 — Copy Along a Line
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Official DIALux Workflow
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Linear replication, 3D riser incline offsets, multi-flight architectures (L-Shape, Dog-Leg, Floating, Spiral), grouping & EN 12464-1 photometry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-5 bg-[#171a20] border-b border-slate-800 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("copy_line")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "copy_line"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Copy className="size-3.5" />
            1. Copy Along a Line
          </button>
          <button
            onClick={() => setActiveTab("multi_flight")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "multi_flight"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="size-3.5" />
            2. Multi-Flight Architectures (L & U Shape)
          </button>
          <button
            onClick={() => setActiveTab("grouping")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "grouping"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FolderTree className="size-3.5" />
            3. Grouping & Boolean Combine
          </button>
          <button
            onClick={() => setActiveTab("photometry")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "photometry"
                ? "border-amber-500 text-amber-400 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lightbulb className="size-3.5" />
            4. Step Lighting & EN 12464-1 Photometry
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* =============================================================== */}
          {/* TAB 1: COPY ALONG A LINE                                        */}
          {/* =============================================================== */}
          {activeTab === "copy_line" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Parameter Form */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                {/* Source Object Selector */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Box className="size-3.5 text-amber-400" /> Source Template / Object
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("step_box")}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "step_box"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="block text-[11px]">Solid Step Block</span>
                      <span className="text-[9.5px] text-slate-400">Tread & Riser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("floating_tread")}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "floating_tread"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="block text-[11px]">Floating Tread</span>
                      <span className="text-[9.5px] text-slate-400">Wall Pin Bracket</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("baluster_post")}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "baluster_post"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="block text-[11px]">Baluster Post</span>
                      <span className="text-[9.5px] text-slate-400">0.90m Handrail Post</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("step_light")}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "step_light"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="block text-[11px]">Step Luminaire</span>
                      <span className="text-[9.5px] text-slate-400">Recessed Wall Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("custom_item")}
                      disabled={!currentSelectedRoomItem}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "custom_item"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : currentSelectedRoomItem
                          ? "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                          : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed"
                      }`}
                    >
                      <span className="block text-[11px]">Selected Item</span>
                      <span className="text-[9.5px] text-slate-400 truncate">
                        {currentSelectedRoomItem ? currentSelectedRoomItem.name : "None selected"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceTemplate("cube_block")}
                      className={`p-2 rounded border text-left cursor-pointer ${
                        sourceTemplate === "cube_block"
                          ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="block text-[11px]">Generic Block</span>
                      <span className="text-[9.5px] text-slate-400">Cube / Box</span>
                    </button>
                  </div>
                </div>

                {/* 3D Vector Line Definition */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Ruler className="size-3.5 text-amber-400" /> 3D Line Path Coordinates
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Start Point */}
                    <div className="p-2 bg-slate-900/50 border border-slate-800 rounded flex flex-col gap-1.5">
                      <span className="font-semibold text-emerald-400 text-[11px]">Start Point (P1)</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[10px] text-slate-400">X (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={startX}
                            onChange={(e) => setStartX(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Y (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={startY}
                            onChange={(e) => setStartY(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Z (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={startZ}
                            onChange={(e) => setStartZ(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* End Point */}
                    <div className="p-2 bg-slate-900/50 border border-slate-800 rounded flex flex-col gap-1.5">
                      <span className="font-semibold text-red-400 text-[11px]">End Point (P2)</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[10px] text-slate-400">X (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={endX}
                            onChange={(e) => setEndX(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Y (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={endY}
                            onChange={(e) => setEndY(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Z (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            value={endZ}
                            onChange={(e) => setEndZ(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#14161a] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode & Elevation Offset */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10.5px] text-slate-400">Replication Mode</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCopyMode("fixed_count")}
                          className={`flex-1 py-1 text-[11px] rounded font-medium border cursor-pointer ${
                            copyMode === "fixed_count"
                              ? "bg-amber-600/30 border-amber-500 text-amber-300 font-bold"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          Fixed Count (N)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopyMode("fixed_spacing")}
                          className={`flex-1 py-1 text-[11px] rounded font-medium border cursor-pointer ${
                            copyMode === "fixed_spacing"
                              ? "bg-amber-600/30 border-amber-500 text-amber-300 font-bold"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          Fixed Spacing (d)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      {copyMode === "fixed_count" ? (
                        <>
                          <label className="text-[10.5px] text-slate-400">Number of Copies (N)</label>
                          <input
                            type="number"
                            min={2}
                            max={40}
                            value={copyCount}
                            onChange={(e) => setCopyCount(Math.max(2, parseInt(e.target.value) || 10))}
                            className="bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          />
                        </>
                      ) : (
                        <>
                          <label className="text-[10.5px] text-slate-400">Spacing Distance (m)</label>
                          <input
                            type="number"
                            step={0.01}
                            min={0.1}
                            value={copySpacing}
                            onChange={(e) => setCopySpacing(parseFloat(e.target.value) || 0.28)}
                            className="bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10.5px] text-slate-400">Riser Incline ΔY per Step (m)</label>
                      <input
                        type="number"
                        step={0.01}
                        value={riserOffsetDeltaY}
                        onChange={(e) => setRiserOffsetDeltaY(parseFloat(e.target.value) || 0.17)}
                        className="bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10.5px] text-slate-400">Orientation Along Path</label>
                      <select
                        value={alignment}
                        onChange={(e) => setAlignment(e.target.value as any)}
                        className="bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white cursor-pointer"
                      >
                        <option value="follow_line">Follow line direction (Auto-rotate)</option>
                        <option value="keep">Keep source orientation</option>
                      </select>
                    </div>
                  </div>

                  {/* Group results checkbox */}
                  <div className="pt-1 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={groupResults}
                        onChange={(e) => setGroupResults(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-300">
                        Group copied objects into single assembly (Tutorial 14 Grouping)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleExecuteCopyAlongLine}
                  className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer transition-all"
                >
                  <Copy className="size-4" />
                  Generate & Place Objects Along Line
                </button>
              </div>

              {/* Right Column: 2D Line Canvas & Metrics */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-amber-400" /> 2D Line Placement Canvas
                  </span>
                  <span>{roomLength}m × {roomWidth}m CAD Room Plane</span>
                </div>
                <div className="w-full h-80 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative shadow-inner">
                  <canvas ref={lineCanvasRef} width={500} height={320} className="w-full h-full block" />
                </div>

                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg text-xs flex flex-col gap-2">
                  <span className="font-bold text-slate-300">Tutorial 14 Pro-Tip: Stair Step Replication</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    By defining a start coordinate on the floor and an end coordinate on the upper level, DIALux evo duplicates the step geometry with an incline vector. Combining with the Group tool ensures all generated treads move, rotate, and calculate as a single architectural element.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: MULTI-FLIGHT ARCHITECTURES                               */}
          {/* =============================================================== */}
          {activeTab === "multi_flight" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Multi-Flight Controls */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                {/* Stair Archetype Buttons */}
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMultiFlightType("quarter_turn")}
                    className={`p-2 rounded border text-center cursor-pointer ${
                      multiFlightType === "quarter_turn"
                        ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                        : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="block text-[11px]">L-Shaped</span>
                    <span className="text-[9.5px] text-slate-400">Quarter-Turn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiFlightType("half_turn")}
                    className={`p-2 rounded border text-center cursor-pointer ${
                      multiFlightType === "half_turn"
                        ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                        : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="block text-[11px]">U-Shaped</span>
                    <span className="text-[9.5px] text-slate-400">Dog-Leg / Half-Turn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiFlightType("floating")}
                    className={`p-2 rounded border text-center cursor-pointer ${
                      multiFlightType === "floating"
                        ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                        : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="block text-[11px]">Floating</span>
                    <span className="text-[9.5px] text-slate-400">Cantilevered</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMultiFlightType("spiral")}
                    className={`p-2 rounded border text-center cursor-pointer ${
                      multiFlightType === "spiral"
                        ? "bg-amber-600/20 border-amber-500 text-white font-bold"
                        : "bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="block text-[11px]">Spiral</span>
                    <span className="text-[9.5px] text-slate-400">Radial Array</span>
                  </button>
                </div>

                {/* Geometry Inputs */}
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-amber-400" /> Stair Flights & Landing Geometry
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="text-[10.5px] text-slate-400">Flight 1 Steps</label>
                      <input
                        type="number"
                        min={3}
                        max={20}
                        value={mfFlight1Count}
                        onChange={(e) => setMfFlight1Count(parseInt(e.target.value) || 8)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    {(multiFlightType === "quarter_turn" || multiFlightType === "half_turn") && (
                      <div>
                        <label className="text-[10.5px] text-slate-400">Flight 2 Steps</label>
                        <input
                          type="number"
                          min={3}
                          max={20}
                          value={mfFlight2Count}
                          onChange={(e) => setMfFlight2Count(parseInt(e.target.value) || 8)}
                          className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[10.5px] text-slate-400">Riser Height (m)</label>
                      <input
                        type="number"
                        step={0.01}
                        value={mfRiserHeight}
                        onChange={(e) => setMfRiserHeight(parseFloat(e.target.value) || 0.17)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400">Tread Depth (m)</label>
                      <input
                        type="number"
                        step={0.01}
                        value={mfTreadDepth}
                        onChange={(e) => setMfTreadDepth(parseFloat(e.target.value) || 0.28)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400">Flight Width (m)</label>
                      <input
                        type="number"
                        step={0.05}
                        value={mfStairWidth}
                        onChange={(e) => setMfStairWidth(parseFloat(e.target.value) || 1.20)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    {multiFlightType === "quarter_turn" && (
                      <div>
                        <label className="text-[10.5px] text-slate-400">Quarter Turn</label>
                        <select
                          value={mfTurnDir}
                          onChange={(e) => setMfTurnDir(e.target.value as any)}
                          className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white cursor-pointer"
                        >
                          <option value="right">Right Turn (90°)</option>
                          <option value="left">Left Turn (-90°)</option>
                        </select>
                      </div>
                    )}
                    {multiFlightType === "half_turn" && (
                      <div>
                        <label className="text-[10.5px] text-slate-400">Well Gap Width (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={mfWellGap}
                          onChange={(e) => setMfWellGap(parseFloat(e.target.value) || 0.20)}
                          className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    )}
                    {multiFlightType === "spiral" && (
                      <div>
                        <label className="text-[10.5px] text-slate-400">Spiral Radius (m)</label>
                        <input
                          type="number"
                          step={0.1}
                          value={mfSpiralRadius}
                          onChange={(e) => setMfSpiralRadius(parseFloat(e.target.value) || 0.90)}
                          className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Blondel Ergonomic Safety Badge */}
                <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  blondelInfo.isComfortable
                    ? "bg-emerald-950/30 border-emerald-600/50 text-emerald-300"
                    : "bg-amber-950/30 border-amber-600/50 text-amber-300"
                }`}>
                  <div className="flex items-center gap-2">
                    {blondelInfo.isComfortable ? (
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold">Blondel Stride Formula: 2s + a = {blondelInfo.blondelValueCm} cm</span>
                      <p className="text-[10px] opacity-80">{blondelInfo.verdict} | Pitch Angle: {blondelInfo.pitchDeg}°</p>
                    </div>
                  </div>
                </div>

                {/* Placement & Material */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10.5px] text-slate-400">Room Position (X, Z)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={0.2}
                        value={mfPosX}
                        onChange={(e) => setMfPosX(parseFloat(e.target.value) || 0)}
                        className="w-1/2 bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="number"
                        step={0.2}
                        value={mfPosZ}
                        onChange={(e) => setMfPosZ(parseFloat(e.target.value) || 0)}
                        className="w-1/2 bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10.5px] text-slate-400">Rotation (Deg)</label>
                    <input
                      type="number"
                      step={15}
                      value={mfRotationDeg}
                      onChange={(e) => setMfRotationDeg(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={handleInsertMultiFlightStaircase}
                  className="w-full py-2.5 mt-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition-all"
                >
                  <Plus className="size-4" />
                  Insert Multi-Flight Staircase into Room
                </button>
              </div>

              {/* Right Column: 2D Multi-Flight Canvas */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Eye className="size-3.5 text-amber-400" /> Architectural Plan & Treads
                  </span>
                  <span>
                    Total Rise: {((mfFlight1Count + (multiFlightType === "quarter_turn" || multiFlightType === "half_turn" ? mfFlight2Count : 0) + 1) * mfRiserHeight).toFixed(2)}m
                  </span>
                </div>
                <div className="w-full h-80 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative shadow-inner">
                  <canvas ref={multiFlightCanvasRef} width={500} height={320} className="w-full h-full block" />
                </div>

                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg text-xs flex flex-col gap-1.5">
                  <span className="font-bold text-slate-300">Multi-Flight Construction Summary</span>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
                    <div>Steps: <span className="text-white font-semibold">{mfFlight1Count + (multiFlightType === "quarter_turn" || multiFlightType === "half_turn" ? mfFlight2Count : 0)}</span></div>
                    <div>Rise/Step: <span className="text-white font-semibold">{(mfRiserHeight * 100).toFixed(0)}cm</span></div>
                    <div>Tread: <span className="text-white font-semibold">{(mfTreadDepth * 100).toFixed(0)}cm</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: GROUPING & BOOLEAN OPERATIONS                            */}
          {/* =============================================================== */}
          {activeTab === "grouping" && (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-start gap-2.5">
                <Info className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  In DIALux evo Tutorial Part 14, after generating individual step copies along a line, you can use <strong>Group</strong> (Ctrl+G) to manage them as a single object, <strong>Ungroup</strong> (Ctrl+Shift+G) to customize individual steps, or <strong>Boolean Combine</strong> to unite them into a single continuous solid with a shared coordinate origin.
                </p>
              </div>

              {/* Group Name input */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">Group / Assembly Name:</label>
                <input
                  type="text"
                  value={groupCustomName}
                  onChange={(e) => setGroupCustomName(e.target.value)}
                  className="flex-1 bg-[#191c22] border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                />
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGroupSelectedObjects}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderTree className="size-3.5" /> Group Selected (Ctrl+G)
                </button>
                <button
                  type="button"
                  onClick={handleBooleanCombineSelected}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UnfoldHorizontal className="size-3.5" /> Boolean Combine (Merge Mesh)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroupItemIds(furnitureList.map((f) => f.id))}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroupItemIds([])}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
                >
                  Deselect All
                </button>
              </div>

              {/* Room Objects Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#191c22]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#12141a] text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 w-10 text-center">Select</th>
                      <th className="p-2.5">Object Name</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Position (X, Z)</th>
                      <th className="p-2.5">Dimensions (W × L × H)</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {furnitureList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500">
                          No objects in the room yet. Use Tab 1 or 2 to place stair flights.
                        </td>
                      </tr>
                    ) : (
                      furnitureList.map((item) => {
                        const isChecked = selectedGroupItemIds.includes(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGroupItemIds((prev) => [...prev, item.id]);
                                  } else {
                                    setSelectedGroupItemIds((prev) => prev.filter((id) => id !== item.id));
                                  }
                                }}
                                className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-medium text-white flex items-center gap-2">
                              {item.isGrouped && <FolderTree className="size-3.5 text-amber-400" />}
                              {item.name}
                            </td>
                            <td className="p-2.5 text-slate-400 capitalize">{item.type.replace("_", " ")}</td>
                            <td className="p-2.5 text-slate-400">({item.x.toFixed(1)}m, {item.z.toFixed(1)}m)</td>
                            <td className="p-2.5 text-slate-400">{item.width.toFixed(2)} × {item.length.toFixed(2)} × {item.height.toFixed(2)}m</td>
                            <td className="p-2.5 text-right">
                              {item.isGrouped && (
                                <button
                                  type="button"
                                  onClick={() => handleUngroupSelectedObject(item.id)}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/40 rounded text-[10px] font-semibold cursor-pointer"
                                >
                                  Ungroup
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: STEP LIGHTING & EN 12464-1 PHOTOMETRY                    */}
          {/* =============================================================== */}
          {activeTab === "photometry" && (
            <div className="flex flex-col gap-5">
              {/* Step Lights Config Card */}
              <div className="p-4 bg-[#191c22] border border-slate-800 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-amber-400" />
                    <span className="font-bold text-xs text-white">Integrated Step Luminaires (Tutorial 14 Pro-Lighting)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={includeStepLights}
                      onChange={(e) => setIncludeStepLights(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-300">Enable Wall-Recessed Step Lights</span>
                  </label>
                </div>

                {includeStepLights && (
                  <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                    <div>
                      <label className="text-[10.5px] text-slate-400">Fixture Frequency</label>
                      <select
                        value={stepLightEveryN}
                        onChange={(e) => setStepLightEveryN(parseInt(e.target.value) || 2)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white cursor-pointer"
                      >
                        <option value={1}>Every Step (Maximum Safety)</option>
                        <option value={2}>Every 2nd Step (Standard Architectural)</option>
                        <option value={3}>Every 3rd Step (Accent Lighting)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400">Lumens per Fitting (lm)</label>
                      <input
                        type="number"
                        step={50}
                        value={stepLightLumens}
                        onChange={(e) => setStepLightLumens(parseInt(e.target.value) || 250)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] text-slate-400">Wattage (W)</label>
                      <input
                        type="number"
                        step={0.5}
                        value={stepLightWattage}
                        onChange={(e) => setStepLightWattage(parseFloat(e.target.value) || 4)}
                        className="w-full bg-[#14161a] border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* EN 12464-1 Summary KPI Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg">
                  <span className="text-[10.5px] text-slate-400 block">Flight 1 Avg Lux</span>
                  <span className="text-xl font-bold text-white mt-1 block">{lightingResults.flight1AvgLux} lx</span>
                  <span className="text-[9.5px] text-slate-500">Maintained</span>
                </div>
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg">
                  <span className="text-[10.5px] text-slate-400 block">Landing Avg Lux</span>
                  <span className="text-xl font-bold text-white mt-1 block">{lightingResults.landingAvgLux} lx</span>
                  <span className="text-[9.5px] text-slate-500">Resting platform</span>
                </div>
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg">
                  <span className="text-[10.5px] text-slate-400 block">Flight 2 Avg Lux</span>
                  <span className="text-xl font-bold text-white mt-1 block">{lightingResults.flight2AvgLux} lx</span>
                  <span className="text-[9.5px] text-slate-500">Upper flight</span>
                </div>
                <div className="p-3 bg-[#191c22] border border-slate-800 rounded-lg">
                  <span className="text-[10.5px] text-slate-400 block">Overall Em / U0</span>
                  <span className="text-xl font-bold text-amber-400 mt-1 block">
                    {lightingResults.avgLux} lx / {lightingResults.uniformityU0}
                  </span>
                  <span className="text-[9.5px] text-slate-500">Min: {lightingResults.minLux} lx</span>
                </div>
                <div className={`p-3 border rounded-lg flex flex-col justify-between ${
                  lightingResults.isCompliant
                    ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
                    : "bg-red-950/40 border-red-600/60 text-red-300"
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">EN 12464-1 Status</span>
                  <span className="text-sm font-extrabold flex items-center gap-1.5">
                    {lightingResults.isCompliant ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-400" />
                        COMPLIANT
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-4 text-red-400" />
                        NON-COMPLIANT
                      </>
                    )}
                  </span>
                  <span className="text-[9px] opacity-80">Req: ≥{lightingResults.targetLux} lx, U0≥0.40</span>
                </div>
              </div>

              {/* Point-by-point Tread Lux Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#191c22]">
                <div className="p-2.5 bg-[#12141a] border-b border-slate-800 text-xs font-bold text-slate-200">
                  Step-by-Step Tread Illuminance Measurement Points
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Step #</th>
                        <th className="p-2">Flight / Section</th>
                        <th className="p-2">World Coords (X, Y, Z)</th>
                        <th className="p-2">Illuminance (Lux)</th>
                        <th className="p-2">Compliance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {lightingResults.stepPoints.map((pt) => {
                        const isStepPass = pt.lux >= lightingResults.targetLux;
                        return (
                          <tr key={`${pt.flight}_${pt.stepNumber}`} className="hover:bg-slate-800/40">
                            <td className="p-2 font-mono font-bold">{pt.stepNumber}</td>
                            <td className="p-2">{pt.flight}</td>
                            <td className="p-2 text-slate-400 font-mono text-[11px]">
                              ({pt.x.toFixed(2)}, {pt.y.toFixed(2)}, {pt.z.toFixed(2)})
                            </td>
                            <td className="p-2 font-bold text-white">{pt.lux} lx</td>
                            <td className="p-2">
                              {isStepPass ? (
                                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded-full font-semibold">
                                  Pass
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full font-semibold">
                                  Under Target
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 bg-[#1b1f26] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">DIALux evo Tutorial Part 14 Engine</span>
            <span>•</span>
            <span>Linear Replication & Multi-Flight Architectural Stairs</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
