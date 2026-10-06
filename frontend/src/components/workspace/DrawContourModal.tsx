import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Check,
  RotateCcw,
  Building2,
  Box,
  Layers,
  Ruler,
  Trash2,
  Eye,
  Info,
  Maximize2,
  Square,
  Sparkles,
  MousePointer,
} from "lucide-react";
import { toast } from "sonner";
import {
  Point2D,
  IndoorRoomContour,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  computeBoundingBox,
  ROOM_PRESETS_EN12464,
} from "@/lib/dialux-building-engine";
import { CADPlan, renderCADPlanToCanvas } from "@/lib/dialux-cad-plan-engine";

interface DrawContourModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "building" | "indoor_contour";
  storeyId: string;
  buildingL: number;
  buildingW: number;
  buildingH: number;
  activeCadPlan?: CADPlan;
  existingRooms: IndoorRoomContour[];
  onApplyContour: (params: {
    mode: "building" | "indoor_contour";
    name: string;
    polygon: Point2D[];
    wallThickness: number;
    height: number;
    targetLux: number;
    applicationProfile: string;
    color: string;
    areaM2: number;
    perimeterM: number;
  }) => void;
}

export function DrawContourModal({
  isOpen,
  onClose,
  mode,
  storeyId,
  buildingL,
  buildingW,
  buildingH,
  activeCadPlan,
  existingRooms,
  onApplyContour,
}: DrawContourModalProps) {
  const isBuildingMode = mode === "building";

  // Drawing vertices
  const [points, setPoints] = useState<Point2D[]>([]);
  const [isClosed, setIsClosed] = useState<boolean>(false);
  const [hoverPos, setHoverPos] = useState<Point2D | null>(null);
  const [snapStep, setSnapStep] = useState<number>(0.25); // snapping grid in meters
  const [showCadUnderlay, setShowCadUnderlay] = useState<boolean>(true);
  const [showExistingRooms, setShowExistingRooms] = useState<boolean>(true);

  // Room attributes
  const [name, setName] = useState<string>(
    isBuildingMode ? "Building Outer Shell" : "New Room 1"
  );
  const [wallThickness, setWallThickness] = useState<number>(isBuildingMode ? 0.25 : 0.15);
  const [height, setHeight] = useState<number>(buildingH || 2.8);
  const [targetLux, setTargetLux] = useState<number>(isBuildingMode ? 500 : 500);
  const [appProfile, setAppProfile] = useState<string>(
    isBuildingMode ? "Building Envelope" : "Offices - Writing, typing, reading data"
  );
  const [color, setColor] = useState<string>(isBuildingMode ? "#3b82f6" : "#10b981");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset or set defaults when opened
  useEffect(() => {
    if (isOpen) {
      setIsClosed(false);
      setHoverPos(null);
      if (isBuildingMode) {
        setName("Building Outer Contour");
        setWallThickness(0.25);
        setColor("#3b82f6");
        // default 4 corners of building envelope
        setPoints([
          { x: 0, y: 0 },
          { x: buildingL, y: 0 },
          { x: buildingL, y: buildingW },
          { x: 0, y: buildingW },
        ]);
        setIsClosed(true);
      } else {
        const nextNum = existingRooms.length + 1;
        setName(`Office Room ${nextNum}`);
        setWallThickness(0.15);
        setTargetLux(500);
        setColor(ROOM_PRESETS_EN12464[(nextNum - 1) % ROOM_PRESETS_EN12464.length].color);
        setPoints([]);
      }
    }
  }, [isOpen, mode, buildingL, buildingW, isBuildingMode, existingRooms.length]);

  // Derived calculations
  const areaM2 = useMemo(() => calculatePolygonArea(points), [points]);
  const perimeterM = useMemo(() => calculatePolygonPerimeter(points), [points]);
  const volumeM3 = useMemo(() => Number((areaM2 * height).toFixed(2)), [areaM2, height]);

  // Canvas coordinate transform
  const canvasW = 760;
  const canvasH = 480;
  const paddingPx = 40;
  const scaleX = (canvasW - paddingPx * 2) / Math.max(1, buildingL);
  const scaleY = (canvasH - paddingPx * 2) / Math.max(1, buildingW);
  const meterScale = Math.min(scaleX, scaleY);

  const mToPx = (p: Point2D) => ({
    x: paddingPx + p.x * meterScale,
    y: paddingPx + p.y * meterScale,
  });

  const pxToM = (px: number, py: number): Point2D => {
    const rawX = (px - paddingPx) / meterScale;
    const rawY = (py - paddingPx) / meterScale;
    // Snap to grid
    const snappedX = Math.round(rawX / snapStep) * snapStep;
    const snappedY = Math.round(rawY / snapStep) * snapStep;
    return {
      x: Number(Math.max(0, Math.min(buildingL, snappedX)).toFixed(2)),
      y: Number(Math.max(0, Math.min(buildingW, snappedY)).toFixed(2)),
    };
  };

  // Render 2D Canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dark CAD background
    ctx.fillStyle = "#111317";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Grid lines (1.0m major, snapStep minor)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= buildingL; x += 1.0) {
      const p1 = mToPx({ x, y: 0 });
      const p2 = mToPx({ x, y: buildingW });
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let y = 0; y <= buildingW; y += 1.0) {
      const p1 = mToPx({ x: 0, y });
      const p2 = mToPx({ x: buildingL, y });
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // CAD Underlay Texture
    if (showCadUnderlay && activeCadPlan) {
      try {
        const cadCanvas = renderCADPlanToCanvas(activeCadPlan, buildingL, buildingW, {
          bgTheme: "dark",
          resolutionScale: 100,
        });
        const originPx = mToPx({ x: 0, y: 0 });
        const extentPx = mToPx({ x: buildingL, y: buildingW });
        ctx.globalAlpha = 0.28;
        ctx.drawImage(
          cadCanvas,
          originPx.x,
          originPx.y,
          extentPx.x - originPx.x,
          extentPx.y - originPx.y
        );
        ctx.globalAlpha = 1.0;
      } catch (e) {
        // ignore
      }
    }

    // Outer Building Boundary Box
    const bTopLeft = mToPx({ x: 0, y: 0 });
    const bBottomRight = mToPx({ x: buildingL, y: buildingW });
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bTopLeft.x, bTopLeft.y, bBottomRight.x - bTopLeft.x, bBottomRight.y - bTopLeft.y);
    ctx.setLineDash([]);

    // Draw Existing Rooms on the Storey
    if (showExistingRooms && !isBuildingMode) {
      existingRooms.forEach((rm) => {
        if (!rm.polygon || rm.polygon.length < 3) return;
        ctx.beginPath();
        const start = mToPx(rm.polygon[0]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < rm.polygon.length; i++) {
          const pt = mToPx(rm.polygon[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = `${rm.color}18`;
        ctx.fill();
        ctx.strokeStyle = `${rm.color}88`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        const center = mToPx({
          x: rm.originX + rm.width / 2,
          y: rm.originY + rm.length / 2,
        });
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(rm.name, center.x, center.y);
      });
    }

    // Draw Active Polygon Under Construction
    if (points.length > 0) {
      ctx.beginPath();
      const p0 = mToPx(points[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < points.length; i++) {
        const pt = mToPx(points[i]);
        ctx.lineTo(pt.x, pt.y);
      }

      if (isClosed) {
        ctx.closePath();
        ctx.fillStyle = `${color}35`;
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw Rubberband line to hover position if not closed
      if (!isClosed && hoverPos) {
        const last = mToPx(points[points.length - 1]);
        const hoverPx = mToPx(hoverPos);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(hoverPx.x, hoverPx.y);
        ctx.strokeStyle = "#f59e0b";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Segment length label
        const dx = hoverPos.x - points[points.length - 1].x;
        const dy = hoverPos.y - points[points.length - 1].y;
        const segDist = Math.sqrt(dx * dx + dy * dy);
        const midX = (last.x + hoverPx.x) / 2;
        const midY = (last.y + hoverPx.y) / 2 - 8;
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${segDist.toFixed(2)}m`, midX, midY);
      }

      // Draw Vertices
      points.forEach((pt, idx) => {
        const pPx = mToPx(pt);
        ctx.beginPath();
        ctx.arc(pPx.x, pPx.y, idx === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? "#10b981" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Vertex index number
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px monospace";
        ctx.fillText(`P${idx + 1}`, pPx.x + 8, pPx.y - 4);
      });

      // Segment length labels between existing vertices
      for (let i = 0; i < points.length; i++) {
        if (!isClosed && i === points.length - 1) break;
        const j = (i + 1) % points.length;
        const pA = mToPx(points[i]);
        const pB = mToPx(points[j]);
        const dist = Math.sqrt(
          Math.pow(points[j].x - points[i].x, 2) + Math.pow(points[j].y - points[i].y, 2)
        );
        const midX = (pA.x + pB.x) / 2;
        const midY = (pA.y + pB.y) / 2 - 6;
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${dist.toFixed(2)}m`, midX, midY);
      }
    }

    // Hover Cursor crosshair
    if (hoverPos) {
      const hPx = mToPx(hoverPos);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hPx.x - 10, hPx.y);
      ctx.lineTo(hPx.x + 10, hPx.y);
      ctx.moveTo(hPx.x, hPx.y - 10);
      ctx.lineTo(hPx.x, hPx.y + 10);
      ctx.stroke();

      // Coordinate readout at cursor
      ctx.fillStyle = "#38bdf8";
      ctx.font = "9.5px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`X:${hoverPos.x.toFixed(2)}m Y:${hoverPos.y.toFixed(2)}m`, hPx.x + 12, hPx.y + 12);
    }
  }, [
    isOpen,
    points,
    isClosed,
    hoverPos,
    color,
    snapStep,
    buildingL,
    buildingW,
    activeCadPlan,
    showCadUnderlay,
    showExistingRooms,
    existingRooms,
    isBuildingMode,
    meterScale,
  ]);

  // Handle Canvas Click to add vertex
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isClosed) {
      toast.info("Polygon is already closed. Click 'Reset Contour' to draw again.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const pt = pxToM(px, py);

    // If near the first point and have >= 3 points, close polygon
    if (points.length >= 3) {
      const p0 = points[0];
      const d = Math.sqrt(Math.pow(pt.x - p0.x, 2) + Math.pow(pt.y - p0.y, 2));
      if (d < 0.4) {
        setIsClosed(true);
        toast.success("Closed contour polygon!");
        return;
      }
    }

    setPoints((prev) => [...prev, pt]);
  };

  // Handle Mouse Move for live snapping and rubberband
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setHoverPos(pxToM(px, py));
  };

  const handleClosePolygon = () => {
    if (points.length < 3) {
      toast.error("At least 3 vertices are required to close a room contour");
      return;
    }
    setIsClosed(true);
    toast.success("Closed contour polygon!");
  };

  const handleUndoPoint = () => {
    if (isClosed) {
      setIsClosed(false);
      return;
    }
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPoints([]);
    setIsClosed(false);
  };

  // Quick Preset Shapes
  const applyPresetShape = (type: "rect" | "l_shape" | "corridor" | "full_cad") => {
    setIsClosed(true);
    if (type === "full_cad") {
      setPoints([
        { x: 0, y: 0 },
        { x: buildingL, y: 0 },
        { x: buildingL, y: buildingW },
        { x: 0, y: buildingW },
      ]);
    } else if (type === "rect") {
      const rw = Number((buildingL * 0.5).toFixed(1));
      const rh = Number((buildingW * 0.6).toFixed(1));
      setPoints([
        { x: 0.5, y: 0.5 },
        { x: 0.5 + rw, y: 0.5 },
        { x: 0.5 + rw, y: 0.5 + rh },
        { x: 0.5, y: 0.5 + rh },
      ]);
    } else if (type === "l_shape") {
      setPoints([
        { x: 0.5, y: 0.5 },
        { x: 5.5, y: 0.5 },
        { x: 5.5, y: 3.0 },
        { x: 3.0, y: 3.0 },
        { x: 3.0, y: 5.5 },
        { x: 0.5, y: 5.5 },
      ]);
    } else if (type === "corridor") {
      setPoints([
        { x: 0.5, y: buildingW / 2 - 0.75 },
        { x: buildingL - 0.5, y: buildingW / 2 - 0.75 },
        { x: buildingL - 0.5, y: buildingW / 2 + 0.75 },
        { x: 0.5, y: buildingW / 2 + 0.75 },
      ]);
    }
  };

  const handleSaveAndApply = () => {
    if (points.length < 3) {
      toast.error("Please draw a valid contour with at least 3 points");
      return;
    }
    if (!isClosed) {
      handleClosePolygon();
    }
    onApplyContour({
      mode,
      name,
      polygon: points,
      wallThickness,
      height,
      targetLux,
      applicationProfile: appProfile,
      color,
      areaM2,
      perimeterM,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-50">
      <div className="bg-[#181b22] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl text-slate-100 flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3 bg-[#13151a] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg border ${
                isBuildingMode
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                  : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {isBuildingMode ? <Building2 className="size-4" /> : <Layers className="size-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{isBuildingMode ? "Draw New Building (Outer Contour)" : "Draw New Indoor Contour (Room)"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  DIALux evo Tutorial Part 3
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isBuildingMode
                  ? "Define the exterior building envelope contour on active storey"
                  : "Trace room corners on the CAD underlay to construct interior spaces with wall thickness"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content grid: Canvas on left, parameters on right */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-[#14161c]">
          {/* Left: Interactive Canvas */}
          <div className="lg:col-span-8 p-4 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between mb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                  <MousePointer className="size-3 text-amber-400" /> Click to add corners:
                </span>
                <span className="text-[11px] font-mono text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {points.length} vertices {isClosed ? "(Closed)" : "(Open)"}
                </span>
              </div>

              {/* View options & snapping */}
              <div className="flex items-center gap-2 text-[10.5px]">
                <div className="flex items-center gap-1 bg-[#1a1d24] px-2 py-0.5 rounded border border-slate-800">
                  <span className="text-slate-400">Snap:</span>
                  <select
                    value={snapStep}
                    onChange={(e) => setSnapStep(parseFloat(e.target.value))}
                    className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
                  >
                    <option value={0.1}>0.10 m</option>
                    <option value={0.25}>0.25 m</option>
                    <option value={0.5}>0.50 m</option>
                    <option value={1.0}>1.00 m</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowCadUnderlay(!showCadUnderlay)}
                  className={`px-2 py-0.5 rounded border cursor-pointer transition ${
                    showCadUnderlay
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/40 font-bold"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                  title="Toggle CAD Floor Plan Underlay"
                >
                  CAD Underlay
                </button>

                {!isBuildingMode && (
                  <button
                    onClick={() => setShowExistingRooms(!showExistingRooms)}
                    className={`px-2 py-0.5 rounded border cursor-pointer transition ${
                      showExistingRooms
                        ? "bg-purple-600/20 text-purple-300 border-purple-500/40 font-bold"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                    title="Toggle Existing Rooms on Storey"
                  >
                    Rooms ({existingRooms.length})
                  </button>
                )}
              </div>
            </div>

            {/* Canvas Box */}
            <div className="flex-1 bg-[#0f1115] border border-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden shadow-inner">
              <canvas
                ref={canvasRef}
                width={canvasW}
                height={canvasH}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverPos(null)}
                className="cursor-crosshair block max-w-full h-auto"
              />

              {/* Status Banner */}
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-slate-800 text-[10.5px] text-slate-300 flex items-center gap-3">
                <div>
                  Footprint: <strong className="text-white">{buildingL}m × {buildingW}m</strong>
                </div>
                <span>|</span>
                <div>
                  Area: <strong className="text-emerald-400 font-mono">{areaM2.toFixed(2)} m²</strong>
                </div>
                <span>|</span>
                <div>
                  Perimeter: <strong className="text-blue-400 font-mono">{perimeterM.toFixed(2)} m</strong>
                </div>
              </div>
            </div>

            {/* Bottom Tracing Controls */}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClosePolygon}
                  disabled={points.length < 3 || isClosed}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                >
                  <Check className="size-3.5" /> Close Polygon
                </button>
                <button
                  onClick={handleUndoPoint}
                  disabled={points.length === 0}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="size-3" /> Undo Point
                </button>
                <button
                  onClick={handleClear}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-300 text-xs flex items-center gap-1 cursor-pointer transition"
                >
                  <Trash2 className="size-3" /> Clear
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Presets:</span>
                <button
                  onClick={() => applyPresetShape("full_cad")}
                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[10.5px] text-slate-300 border border-slate-700 cursor-pointer"
                >
                  Full Footprint
                </button>
                <button
                  onClick={() => applyPresetShape("rect")}
                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[10.5px] text-slate-300 border border-slate-700 cursor-pointer"
                >
                  Rectangle
                </button>
                <button
                  onClick={() => applyPresetShape("l_shape")}
                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[10.5px] text-slate-300 border border-slate-700 cursor-pointer"
                >
                  L-Shape
                </button>
                <button
                  onClick={() => applyPresetShape("corridor")}
                  className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[10.5px] text-slate-300 border border-slate-700 cursor-pointer"
                >
                  Corridor
                </button>
              </div>
            </div>
          </div>

          {/* Right: Room & Wall Parameters */}
          <div className="lg:col-span-4 p-4 flex flex-col justify-between overflow-y-auto bg-[#171a21]">
            <div className="flex flex-col gap-3.5">
              <span className="font-bold text-xs text-white border-b border-slate-800 pb-1.5">
                {isBuildingMode ? "Building Parameters" : "Indoor Room Parameters"}
              </span>

              {/* Room Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-300 font-medium">
                  {isBuildingMode ? "Building Name" : "Room / Space Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-xs text-white outline-none font-semibold"
                />
              </div>

              {/* EN 12464-1 Presets (if room mode) */}
              {!isBuildingMode && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Application Profile (EN 12464-1)
                  </label>
                  <select
                    value={appProfile}
                    onChange={(e) => {
                      const found = ROOM_PRESETS_EN12464.find((p) => p.appProfile === e.target.value);
                      if (found) {
                        setAppProfile(found.appProfile);
                        setTargetLux(found.targetLux);
                        setColor(found.color);
                        setWallThickness(found.defaultWallThickness);
                        if (!name || name.startsWith("Office Room") || name.startsWith("New Room")) {
                          setName(found.name);
                        }
                      } else {
                        setAppProfile(e.target.value);
                      }
                    }}
                    className="h-7 px-2 bg-slate-900 border border-slate-700 rounded text-[11px] text-slate-200 outline-none cursor-pointer"
                  >
                    {ROOM_PRESETS_EN12464.map((p) => (
                      <option key={p.appProfile} value={p.appProfile}>
                        {p.name} ({p.targetLux} lx)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wall Thickness */}
              <div className="bg-[#121419] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Wall Thickness:</span>
                  <span className="font-mono text-emerald-400 font-bold">{wallThickness.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.4}
                  step={0.02}
                  value={wallThickness}
                  onChange={(e) => setWallThickness(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>0.10m (Partition)</span>
                  <span>0.25m (Standard)</span>
                  <span>0.40m (Exterior)</span>
                </div>
              </div>

              {/* Ceiling Height */}
              <div className="bg-[#121419] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Clear Room Height:</span>
                  <span className="font-mono text-blue-400 font-bold">{height.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min={2.2}
                  max={6.0}
                  step={0.1}
                  value={height}
                  onChange={(e) => setHeight(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-700 rounded"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>2.20m</span>
                  <span>2.80m (Standard)</span>
                  <span>6.00m (High Bay)</span>
                </div>
              </div>

              {/* Target Illuminance */}
              {!isBuildingMode && (
                <div className="bg-[#121419] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Target Illuminance:</span>
                    <span className="font-mono text-amber-400 font-bold">{targetLux} lx</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={1000}
                    step={50}
                    value={targetLux}
                    onChange={(e) => setTargetLux(parseInt(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>100 lx (Corridor)</span>
                    <span>500 lx (Office)</span>
                    <span>1000 lx (Lab)</span>
                  </div>
                </div>
              )}

              {/* Geometry Metrics Card */}
              <div className="bg-[#121419] p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-xs text-slate-300">
                <span className="text-[10.5px] font-bold text-slate-400">Calculated Geometry:</span>
                <div className="flex justify-between">
                  <span>Net Floor Area:</span>
                  <strong className="text-emerald-400 font-mono">{areaM2.toFixed(2)} m²</strong>
                </div>
                <div className="flex justify-between">
                  <span>Perimeter:</span>
                  <strong className="text-blue-400 font-mono">{perimeterM.toFixed(2)} m</strong>
                </div>
                <div className="flex justify-between">
                  <span>Room Volume:</span>
                  <strong className="text-white font-mono">{volumeM3.toFixed(2)} m³</strong>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndApply}
                disabled={points.length < 3}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30"
              >
                <Check className="size-3.5" />
                <span>{isBuildingMode ? "Extrude Building Shell" : "Save & Extrude Room"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
