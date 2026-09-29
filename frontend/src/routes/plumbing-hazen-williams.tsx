import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, HelpCircle,
  Save, FolderOpen, ChevronDown, ChevronUp, Trash2, Copy, Clipboard,
  RotateCcw, MessageSquare, Edit3, FileText, CheckCircle2, Sparkles,
  Download, Upload, Gauge, Layers, Zap, Flame, X, ArrowRight, Check, Droplets, Droplet, Activity
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";

// Standard NFPA 13 & ASME B36.10 Schedule 40 Steel Pipe Diameters (Inside Diameter in inches and mm)
const PIPE_PRESETS = [
  { name: '1" (25 mm) Sch 40', idInches: 1.049, idMm: 26.64, nps: 1.0 },
  { name: '1-1/4" (32 mm) Sch 40', idInches: 1.380, idMm: 35.05, nps: 1.25 },
  { name: '1-1/2" (40 mm) Sch 40', idInches: 1.610, idMm: 40.89, nps: 1.5 },
  { name: '2" (50 mm) Sch 40', idInches: 2.067, idMm: 52.50, nps: 2.0 },
  { name: '2-1/2" (65 mm) Sch 40', idInches: 2.469, idMm: 62.71, nps: 2.5 },
  { name: '3" (80 mm) Sch 40', idInches: 3.068, idMm: 77.93, nps: 3.0 },
  { name: '4" (100 mm) Sch 40', idInches: 4.026, idMm: 102.26, nps: 4.0 },
  { name: '6" (150 mm) Sch 40', idInches: 6.065, idMm: 154.05, nps: 6.0 },
  { name: '8" (200 mm) Sch 40', idInches: 7.981, idMm: 202.72, nps: 8.0 },
  { name: '10" (250 mm) Sch 40', idInches: 10.020, idMm: 254.51, nps: 10.0 },
  { name: '12" (300 mm) Sch 40', idInches: 11.938, idMm: 303.23, nps: 12.0 },
];

// Standard Hazen-Williams C-Factors (NFPA 13 Table A.23.4.2)
const C_FACTOR_PRESETS = [
  { label: "C = 150 (Plastic / CPVC / Copper)", value: 150 },
  { label: "C = 140 (Cement-lined Ductile Iron)", value: 140 },
  { label: "C = 120 (Wet Steel Pipe - Standard NFPA)", value: 120 },
  { label: "C = 100 (Dry Steel / Galvanized Pipe)", value: 100 },
  { label: "C = 90 (Unlined Cast Iron)", value: 90 },
];

export const Route = createFileRoute("/plumbing-hazen-williams")({
  head: () => ({
    meta: [
      { title: "Hazen-Williams Pressure Drop — MEP Calc" },
      { name: "description", content: "Fire protection and water supply piping friction head loss, velocity, and pressure drop using the Hazen-Williams equation." },
    ],
  }),
  component: HazenWilliamsPage,
});

interface HazenSizingParams {
  flowRate: number | ""; // GPM (ip) or L/s (si)
  pipeDiameter: number | ""; // inches (ip) or mm (si)
  cFactor: number; // Hazen-Williams roughness coefficient
  pipeLength: number | ""; // ft (ip) or m (si)
  fittingsPct: number | ""; // % equivalent fitting length allowance (default 15%)
  elevationChange: number | ""; // ft (ip) or m (si)
  residualPressure: number | ""; // psi (ip) or bar (si)
}

function HazenWilliamsPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-hazen-williams", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-hazen-williams", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/plumbing-hazen-williams", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // Core Parameters (Default 2.5" pipe, 100 GPM, C=120, 100 ft)
  const [sizingParams, setSizingParams] = useState<HazenSizingParams>({
    flowRate: 100, // GPM (or ~6.31 L/s)
    pipeDiameter: 2.469, // 2.5" Sch 40 ID
    cFactor: 120,
    pipeLength: 100, // ft
    fittingsPct: 15, // %
    elevationChange: 0,
    residualPressure: 0,
  });

  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(4); // 2.5"

  // Documentation Info
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Fire Protection & Supply Hydraulics",
    projectNumber: "MEP-HYD-HW01",
    client: "Client Master",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-FP-HW01",
    notes: "Pipe friction loss and hydraulic gradient evaluation per NFPA 13 / Hazen-Williams equation.",
  });

  // Modal States
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [activeCommentTarget, setActiveCommentTarget] = useState<{ id: string; label: string } | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, any[]>>({});
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll and highlight notification target item
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
                 document.querySelector(`[data-item-id="${targetId}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`);

      if (el || cleanId) {
        setHighlightedTargetId(targetId || cleanId);

        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedTargetId(null);
          highlightTimeoutRef.current = null;
        }, 4000);

        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        }
      }
    };

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId");
      const targetName = params.get("commentTargetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }

      const onGlobalNotification = (e: any) => {
        if (e.detail?.fieldName || e.detail?.targetItemId) {
          handleScrollTarget(e.detail.targetItemId, e.detail.fieldName);
        }
      };
      window.addEventListener("mep-comment-notification-clicked", onGlobalNotification);
      return () => {
        window.removeEventListener("mep-comment-notification-clicked", onGlobalNotification);
      };
    }
  }, []);

  // Sync / Load Project Saved State
  useEffect(() => {
    if (!project?.id) return;
    const pId = project.id;
    const storageKey = `mep_hazen_williams_${pId}`;

    if (loadedProjectId !== pId) {
      let loadedData: any = null;

      // 1. Check workspace_data
      if (project.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (wdata?.hazen_williams_data) {
          loadedData = wdata.hazen_williams_data;
        }
      }

      // 2. Check localStorage fallback
      if (!loadedData && typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) loadedData = JSON.parse(saved);
        } catch (e) {}
      }

      if (loadedData) {
        if (loadedData.sizingParams) setSizingParams(loadedData.sizingParams);
        if (loadedData.unitSystem) setUnitSystem(loadedData.unitSystem);
        if (loadedData.projectInfo) setProjectInfo(loadedData.projectInfo);
        if (loadedData.commentsMap) setCommentsMap(loadedData.commentsMap);
      }

      setLoadedProjectId(pId);
    }
  }, [project, loadedProjectId]);

  // Save helper
  const saveState = (
    newParams: HazenSizingParams,
    newUnits: "si" | "ip",
    newProjInfo = projectInfo,
    newComments = commentsMap
  ) => {
    const pId = project?.id || "default";
    const dataToSave = {
      sizingParams: newParams,
      unitSystem: newUnits,
      projectInfo: newProjInfo,
      commentsMap: newComments,
      updatedAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(`mep_hazen_williams_${pId}`, JSON.stringify(dataToSave));
    }

    dirtyStore.set(true);
  };

  // Unit System Conversion
  const handleUnitSystemChange = (target: "si" | "ip") => {
    if (target === unitSystem) return;

    const isToSi = target === "si";
    const flow = typeof sizingParams.flowRate === "number" ? sizingParams.flowRate : 0;
    const d = typeof sizingParams.pipeDiameter === "number" ? sizingParams.pipeDiameter : 0;
    const len = typeof sizingParams.pipeLength === "number" ? sizingParams.pipeLength : 0;
    const elev = typeof sizingParams.elevationChange === "number" ? sizingParams.elevationChange : 0;
    const resP = typeof sizingParams.residualPressure === "number" ? sizingParams.residualPressure : 0;

    let convertedFlow: number | "" = sizingParams.flowRate;
    let convertedD: number | "" = sizingParams.pipeDiameter;
    let convertedLen: number | "" = sizingParams.pipeLength;
    let convertedElev: number | "" = sizingParams.elevationChange;
    let convertedResP: number | "" = sizingParams.residualPressure;

    if (isToSi) {
      // IP (GPM, in, ft, psi) -> SI (L/s, mm, m, bar)
      convertedFlow = flow ? Number((flow * 0.06309).toFixed(2)) : "";
      convertedD = d ? Number((d * 25.4).toFixed(2)) : "";
      convertedLen = len ? Number((len * 0.3048).toFixed(2)) : "";
      convertedElev = elev ? Number((elev * 0.3048).toFixed(2)) : "";
      convertedResP = resP ? Number((resP * 0.0689476).toFixed(3)) : "";
    } else {
      // SI (L/s, mm, m, bar) -> IP (GPM, in, ft, psi)
      convertedFlow = flow ? Number((flow / 0.06309).toFixed(1)) : "";
      convertedD = d ? Number((d / 25.4).toFixed(3)) : "";
      convertedLen = len ? Number((len / 0.3048).toFixed(1)) : "";
      convertedElev = elev ? Number((elev / 0.3048).toFixed(1)) : "";
      convertedResP = resP ? Number((resP / 0.0689476).toFixed(2)) : "";
    }

    const updatedParams: HazenSizingParams = {
      ...sizingParams,
      flowRate: convertedFlow,
      pipeDiameter: convertedD,
      pipeLength: convertedLen,
      elevationChange: convertedElev,
      residualPressure: convertedResP,
    };

    setUnitSystem(target);
    setSizingParams(updatedParams);
    saveState(updatedParams, target);
    toast.success(`Switched unit system to ${target.toUpperCase()}`);
  };

  // Math Calculations Engine
  const calc = useMemo(() => {
    const isIp = unitSystem === "ip";
    const flowInput = typeof sizingParams.flowRate === "number" ? sizingParams.flowRate : 0;
    const dInput = typeof sizingParams.pipeDiameter === "number" ? sizingParams.pipeDiameter : (isIp ? 2.469 : 62.71);
    const C = sizingParams.cFactor || 120;
    const lenInput = typeof sizingParams.pipeLength === "number" ? sizingParams.pipeLength : 0;
    const fittingsPct = typeof sizingParams.fittingsPct === "number" ? sizingParams.fittingsPct : 0;
    const elevInput = typeof sizingParams.elevationChange === "number" ? sizingParams.elevationChange : 0;
    const resPInput = typeof sizingParams.residualPressure === "number" ? sizingParams.residualPressure : 0;

    // Standardize to Imperial Base for exact NFPA 13 Formula equivalence
    // Q in GPM, d in inches, L in feet
    const Q_gpm = isIp ? flowInput : flowInput / 0.06309;
    const d_in = isIp ? dInput : dInput / 25.4;
    const L_ft_straight = isIp ? lenInput : lenInput / 0.3048;
    const elev_ft = isIp ? elevInput : elevInput / 0.3048;

    // Equivalent Length (Straight + Fittings Allowance)
    const L_eq_ft = L_ft_straight * (1 + fittingsPct / 100);
    const L_eq_m = L_eq_ft * 0.3048;

    // NFPA 13 Formula: p_loss (psi/ft) = 4.52 * Q^1.85 / (C^1.85 * d^4.87)
    let p_loss_per_ft = 0;
    let p_loss_per_100ft = 0;
    let total_friction_psi = 0;
    let velocity_fps = 0;

    if (d_in > 0 && C > 0 && Q_gpm > 0) {
      const denom = Math.pow(C, 1.85) * Math.pow(d_in, 4.87);
      p_loss_per_ft = (4.52 * Math.pow(Q_gpm, 1.85)) / denom;
      p_loss_per_100ft = p_loss_per_ft * 100;
      total_friction_psi = p_loss_per_ft * L_eq_ft;
      // Velocity: v (fps) = 0.408 * Q / d^2
      velocity_fps = (0.408 * Q_gpm) / (d_in * d_in);
    }

    const velocity_mps = velocity_fps * 0.3048;

    // Elevation Head Loss: 1 ft water = 0.4335 psi (or 1 m = 0.0981 bar)
    const elev_head_psi = elev_ft * 0.4335;
    const elev_head_bar = elev_head_psi * 0.0689476;

    // Total System Pressure Head
    const res_psi = isIp ? resPInput : resPInput / 0.0689476;
    const total_system_head_psi = total_friction_psi + elev_head_psi + res_psi;
    const total_friction_bar = total_friction_psi * 0.0689476;
    const total_friction_kpa = total_friction_bar * 100;
    const total_friction_m_head = total_friction_psi * 0.703249; // psi to m H2O

    const loss_per_100m_bar = p_loss_per_100ft * 0.0689476 * 3.28084; // bar / 100m

    // Recommended Velocity Limit Checks
    const maxRecVel = isIp ? 8.0 : 2.44; // 8 fps for potable / 20 fps for fire
    const isVelHigh = velocity_fps > 15.0;
    const isVelModerate = velocity_fps > 8.0 && velocity_fps <= 15.0;

    return {
      isIp,
      flowUnit: isIp ? "GPM" : "L/s",
      diamUnit: isIp ? "in" : "mm",
      lenUnit: isIp ? "ft" : "m",
      pressUnit: isIp ? "psi" : "bar",
      pressPer100Unit: isIp ? "psi/100ft" : "bar/100m",
      velUnit: isIp ? "fps" : "m/s",
      Q_gpm,
      d_in,
      L_eq_ft: Number(L_eq_ft.toFixed(1)),
      L_eq_m: Number(L_eq_m.toFixed(1)),
      totalFrictionLoss: isIp ? Number(total_friction_psi.toFixed(3)) : Number(total_friction_bar.toFixed(4)),
      totalFrictionLossPsi: Number(total_friction_psi.toFixed(3)),
      totalFrictionLossBar: Number(total_friction_bar.toFixed(4)),
      totalFrictionLossKpa: Number(total_friction_kpa.toFixed(2)),
      totalFrictionMHead: Number(total_friction_m_head.toFixed(2)),
      lossPer100: isIp ? Number(p_loss_per_100ft.toFixed(3)) : Number(loss_per_100m_bar.toFixed(4)),
      velocity: isIp ? Number(velocity_fps.toFixed(2)) : Number(velocity_mps.toFixed(2)),
      velocityFps: Number(velocity_fps.toFixed(2)),
      velocityMps: Number(velocity_mps.toFixed(2)),
      maxRecVel,
      isVelHigh,
      isVelModerate,
      elevHead: isIp ? Number(elev_head_psi.toFixed(2)) : Number(elev_head_bar.toFixed(3)),
      totalSystemHead: isIp ? Number(total_system_head_psi.toFixed(2)) : Number((total_system_head_psi * 0.0689476).toFixed(3)),
    };
  }, [sizingParams, unitSystem]);

  // Handle Input Changes
  const handleInputChange = (field: keyof HazenSizingParams, value: any) => {
    let parsed: any = value;
    if (value === "") {
      parsed = "";
    } else {
      const num = parseFloat(value);
      parsed = isNaN(num) ? "" : num;
    }

    const updated = { ...sizingParams, [field]: parsed };
    setSizingParams(updated);
    saveState(updated, unitSystem);
  };

  // Handle Pipe Preset Selection
  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    const preset = PIPE_PRESETS[index];
    const targetD = unitSystem === "ip" ? preset.idInches : preset.idMm;
    const updated = { ...sizingParams, pipeDiameter: targetD };
    setSizingParams(updated);
    saveState(updated, unitSystem);
    toast.success(`Selected ${preset.name} (ID: ${targetD} ${unitSystem === "ip" ? "in" : "mm"})`);
  };

  // Context Menu Helpers
  const handleCopyLine = (label: string, val: any, unit: string) => {
    const text = `${label}: ${val} ${unit}`;
    navigator.clipboard.writeText(text);
    toast.success(`Copied to clipboard: "${text}"`);
  };

  const handleOpenComment = (id: string, label: string) => {
    setActiveCommentTarget({ id, label });
  };

  const handleSaveComment = (commentText: string, assignee: string) => {
    if (!activeCommentTarget) return;
    const newComment = {
      id: `comment_${Date.now()}`,
      targetId: activeCommentTarget.id,
      targetLabel: activeCommentTarget.label,
      text: commentText,
      assignee,
      createdBy: currentUserName,
      createdAt: new Date().toISOString(),
    };

    const existing = commentsMap[activeCommentTarget.id] || [];
    const updated = { ...commentsMap, [activeCommentTarget.id]: [...existing, newComment] };
    setCommentsMap(updated);
    saveState(sizingParams, unitSystem, projectInfo, updated);
    setActiveCommentTarget(null);
    toast.success(`Comment assigned to ${assignee}`);
  };

  const commentsList = useMemo(() => {
    const list: any[] = [];
    Object.values(commentsMap).forEach((arr) => {
      if (Array.isArray(arr)) list.push(...arr);
    });
    return list;
  }, [commentsMap]);

  // Reusable Parameter Input Tile
  const renderInputBox = (
    id: string,
    field: keyof HazenSizingParams,
    label: string,
    value: number | "",
    unit: string,
    step: string = "1",
    min: number = 0,
    placeholder: string = "0"
  ) => {
    const itemComments = commentsMap[id] || [];
    const hasComments = itemComments.length > 0;
    const isHighlighted = highlightedTargetId === id ||
                          highlightedTargetId === `field-${id}` ||
                          (highlightedTargetId && id && id.toLowerCase().includes(highlightedTargetId.toLowerCase())) ||
                          (highlightedTargetId && label && label.toLowerCase().includes(highlightedTargetId.toLowerCase()));

    const displayLabel = unit ? `${label} (${unit})` : label;

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-item-id={id}
            data-field-id={id}
            className={`flex flex-col gap-1.5 group cursor-context-menu p-1.5 rounded-xl transition-all ${
              isHighlighted
                ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/20 z-20 font-bold"
                : ""
            }`}
          >
            <label className="font-semibold text-foreground flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span>{displayLabel}</span>
                {hasComments && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenComment(id, label);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer"
                    title={`${itemComments.length} comment(s)/task(s) assigned`}
                  >
                    <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                    <span>{itemComments.length}</span>
                  </button>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">Right-click for options</span>
            </label>
            <input
              id={id}
              type="number"
              min={min}
              step={step}
              placeholder={placeholder}
              value={value === "" ? "" : value}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none placeholder:text-muted-foreground/45 placeholder:font-normal transition hover:border-[#0A7BC7]/50"
            />
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
          <ContextMenuItem
            onClick={() => handleCopyLine(label, value, unit)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Parameter</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>{hasComments ? `View / Add Comments (${itemComments.length})` : "Add Comment / Assign Task"}</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export matching Smoke Ventilation Report format & UI colors
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-HW-001";
      const today = projectInfo.date || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || projectInfo.projectName || "";
      const clientName = (project as any)?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Hazen-Williams Piping Friction Loss Report", 14, 14);

      // Metadata Block (182mm width: left 14mm to right 196mm)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.rect(14, 18, 182, 18);

      // Vertical line to separate left/right metadata
      doc.line(105, 18, 105, 36);

      // Horizontal lines
      doc.line(14, 24, 196, 24);
      doc.line(14, 30, 196, 30);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 22);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 22);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 22);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 28);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 28);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 28);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 34);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 34);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 125, 34);

      // Smoke Ventilation UI Color Palette
      const primaryFill = [217, 217, 217] as [number, number, number]; // Light gray header
      const blueFill = [218, 233, 248] as [number, number, number];    // Soft blue highlight header
      const blueBodyFill = [242, 248, 253] as [number, number, number]; // Soft blue highlight row/cell

      // Section 1: Input Parameters & Geometry
      let currentY = 42;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("1. Input Parameters & Piping Geometry", 14, currentY);
      currentY += 3;

      const inputTableBody = [
        ["1", "Design Flow Rate (Q)", `${sizingParams.flowRate}`, calc.flowUnit, "NFPA 13 Demand Sizing"],
        ["2", "Inside Hydraulic Diameter (d)", `${sizingParams.pipeDiameter}`, calc.diamUnit, "Nominal Pipe Internal Bore"],
        ["3", "Hazen-Williams Roughness Coefficient (C)", `${sizingParams.cFactor}`, "-", "NFPA 13 Table A.23.4.2"],
        ["4", "Straight Pipe Run Length (L)", `${sizingParams.pipeLength}`, calc.lenUnit, "Physical Pipe Routing"],
        ["5", "Fittings & Valves Allowance", `${sizingParams.fittingsPct} %`, "%", "Equivalent Fitting Loss Allowance"],
        ["6", "Equivalent Total Length (L_eq)", calc.isIp ? `${calc.L_eq_ft}` : `${calc.L_eq_m}`, calc.lenUnit, "L_eq = Length × (1 + Fittings %)"],
        ["7", "Static Elevation Lift Change", `${sizingParams.elevationChange}`, calc.lenUnit, "Vertical Lift Column"],
        ["8", "Target Residual / Nozzle Pressure", `${sizingParams.residualPressure}`, calc.pressUnit, "NFPA Minimum Terminal Pressure"]
      ];

      callAutoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 36, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 46 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill } },
            { content: "Design Parameter Description", styles: { fillColor: primaryFill } },
            { content: "Value", styles: { fillColor: primaryFill } },
            { content: "Unit", styles: { fillColor: primaryFill } },
            { content: "Standard / Code Reference", styles: { fillColor: primaryFill } }
          ]
        ],
        body: inputTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 110;
      nextY += 7;

      // Section 2: Hydraulic Calculation Results
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("2. Hydraulic Calculation Results", 14, nextY);
      nextY += 3;

      const resultsTableBody = [
        ["A", "TOTAL FRICTION LOSS (hf)", `${calc.totalFrictionLoss} ${calc.pressUnit}`, "NFPA 13 Hazen-Williams Formula: 4.52·Q^1.85 / (C^1.85·d^4.87)"],
        ["B", "Friction Loss in Alternate Units", `${calc.totalFrictionLossPsi} psi / ${calc.totalFrictionLossBar} bar`, `${calc.totalFrictionMHead} m H₂O Head Loss`],
        ["C", "Friction Loss Gradient", `${calc.lossPer100} ${calc.pressPer100Unit}`, "Head loss rate per 100 units length"],
        ["D", "Flow Velocity (v)", `${calc.velocity} ${calc.velUnit}`, `v = 0.408·Q / d² (${calc.velocityFps} fps / ${calc.velocityMps} m/s)`],
        ["E", "Velocity Compliance Status", calc.isVelHigh ? "HIGH VELOCITY (>15 fps)" : "OPTIMAL / COMPLIANT", "Velocity limit: 15 fps (4.57 m/s)"],
        ["F", "Static Elevation Head Lift", `${calc.elevHead} ${calc.pressUnit}`, "Static vertical hydrostatic column"],
        ["G", "TOTAL COMBINED DYNAMIC HEAD", `${calc.totalSystemHead} ${calc.pressUnit}`, "Total Head = Friction Loss + Static Elevation + Residual"]
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold"
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 56 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Hydraulic Output Parameter", styles: { fillColor: primaryFill } },
            { content: "Calculated Value", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Formula", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight row A (Total Friction Loss) and G (Total Combined Head) in blueFill
            if (data.row.index === 0 || data.row.index === 6) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 8.5;
              }
            }
          }
        }
      });

      let sigFinalY = (doc as any).lastAutoTable?.finalY ?? 180;
      sigFinalY += 7;

      if (sigFinalY > 230) {
        doc.addPage();
        sigFinalY = 18;
      }

      // Section 3: 3-Tier Signature Block
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("3. Approval & Sign-Off Block", 14, sigFinalY);
      sigFinalY += 3;

      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-hazen-williams", currentUserName);

      callAutoTable(doc, {
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle", lineColor: [100, 100, 100], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), `Hazen_Williams_Report_${project?.code || "CALC"}.pdf`, "PDF Document", ["pdf"]);
      toast.success("Hazen-Williams PDF Report generated successfully!");
    } catch (err: any) {
      console.error("handleExportPDF error:", err);
      toast.error(`Export PDF failed: ${err?.message || String(err)}`);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const data = [
      { Parameter: "Design Flow Rate (Q)", Value: sizingParams.flowRate, Unit: calc.flowUnit, Formula: "User Input" },
      { Parameter: "Inside Pipe Diameter (d)", Value: sizingParams.pipeDiameter, Unit: calc.diamUnit, Formula: "User Input" },
      { Parameter: "Hazen-Williams C-Factor", Value: sizingParams.cFactor, Unit: "dimensionless", Formula: "NFPA Table A.23.4.2" },
      { Parameter: "Straight Segment Length", Value: sizingParams.pipeLength, Unit: calc.lenUnit, Formula: "User Input" },
      { Parameter: "Fittings Allowance (%)", Value: sizingParams.fittingsPct, Unit: "%", Formula: "User Input" },
      { Parameter: "Equivalent Pipe Length", Value: calc.isIp ? calc.L_eq_ft : calc.L_eq_m, Unit: calc.lenUnit, Formula: "Length × (1 + Fittings %)" },
      { Parameter: "Total Friction Loss", Value: calc.totalFrictionLoss, Unit: calc.pressUnit, Formula: "4.52 × Q^1.85 / (C^1.85 × d^4.87) × Length" },
      { Parameter: "Total Friction Loss (psi)", Value: calc.totalFrictionLossPsi, Unit: "psi", Formula: "Converted" },
      { Parameter: "Total Friction Loss (bar)", Value: calc.totalFrictionLossBar, Unit: "bar", Formula: "Converted" },
      { Parameter: "Friction Loss Gradient", Value: calc.lossPer100, Unit: calc.pressPer100Unit, Formula: "Loss per 100 units" },
      { Parameter: "Flow Velocity", Value: calc.velocity, Unit: calc.velUnit, Formula: "0.408 × Q / d²" },
      { Parameter: "Static Elevation Head", Value: calc.elevHead, Unit: calc.pressUnit, Formula: "Elevation × 0.4335" },
      { Parameter: "Total Combined Head", Value: calc.totalSystemHead, Unit: calc.pressUnit, Formula: "Friction + Elevation + Residual" },
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hazen-Williams");
    const xlsxBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadFile(new Uint8Array(xlsxBuffer), `Hazen_Williams_${project?.code || "CALC"}.xlsx`, "Excel Document", ["xlsx"]);
    toast.success("Excel Spreadsheet generated successfully!");
  };

  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState<boolean>(false);

  return (
    <AppShell 
      title="Hazen-Williams Pressure Loss" 
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header matching FM-200 Gas Sizing */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-foreground">Hazen-Williams</h1>
                
              </div>
              <button 
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-hazen-williams" calculatorTitle="Hazen-Williams" />
              {commentsList.length > 0 && (
                <div 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active comment(s)/task(s) in Hazen-Williams`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"} / Comment{commentsList.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  inputDescriptions="Flow Rate (GPM ↔ L/s), Pipe Diameter (in ↔ mm), Pipe Length (ft ↔ m)"
                  conversionExample={
                    unitSystem === "si"
                      ? "Convert 10 L/s → 158.5 GPM, 65 mm → 2.5 in"
                      : "Convert 100 GPM → 6.31 L/s, 2.5 in → 62.7 mm"
                  }
                />
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[420px] overflow-hidden rounded-2xl transition-all duration-300 ${
              calcReviewState?.status === "APPROVED" 
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface-2 p-0.5 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sizing Calculator
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shadow-2xs"
                  title="View Hazen-Williams Formula Breakdown"
                >
                  <Info className="size-3 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Sizing Unit system toggle & Top Export Action */}
              <div className="flex items-center gap-2 flex-wrap">
                

                <TBtn onClick={handleExportPDF}><FileText className="size-3.5" /> Export</TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 md:p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full items-start">
                    
                    {/* Inputs Column (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col gap-3.5 w-full">
                      
                      {/* Card 1: Flow Rate & Piping Geometry */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              1. Flow Rate & Piping Geometry
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px] text-muted-foreground font-medium">Pipe:</span>
                            <select
                              value={selectedPresetIndex}
                              onChange={(e) => handleSelectPreset(parseInt(e.target.value))}
                              className="h-7 px-2 text-[11px] font-semibold rounded-lg border border-border/80 bg-slate-100/50 dark:bg-slate-950/40 text-foreground cursor-pointer focus:outline-none focus:border-[#0A7BC7]"
                            >
                              {PIPE_PRESETS.map((p, idx) => (
                                <option key={idx} value={idx}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          {/* Flow Rate */}
                          {renderInputBox(
                            "hw-flow-rate",
                            "flowRate",
                            "Design Flow Rate (Q)",
                            sizingParams.flowRate,
                            calc.flowUnit,
                            "5",
                            0,
                            unitSystem === "ip" ? "100" : "6.3"
                          )}

                          {/* 2-Column Grid for Diameter, Length, Fittings */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {renderInputBox(
                              "hw-pipe-diameter",
                              "pipeDiameter",
                              "Internal Diameter (d)",
                              sizingParams.pipeDiameter,
                              calc.diamUnit,
                              "0.001",
                              0.1,
                              unitSystem === "ip" ? "2.469" : "62.71"
                            )}
                            {renderInputBox(
                              "hw-pipe-length",
                              "pipeLength",
                              "Straight Run Length (L)",
                              sizingParams.pipeLength,
                              calc.lenUnit,
                              "1",
                              0,
                              unitSystem === "ip" ? "100" : "30"
                            )}
                            {renderInputBox(
                              "hw-fittings-pct",
                              "fittingsPct",
                              "Fittings Allowance",
                              sizingParams.fittingsPct,
                              "%",
                              "1",
                              0,
                              "15"
                            )}
                            <div className="flex flex-col gap-1.5 group p-1.5 rounded-xl">
                              <label className="font-semibold text-foreground text-xs">
                                Roughness C-Factor
                              </label>
                              <select
                                value={sizingParams.cFactor}
                                onChange={(e) => handleInputChange("cFactor", parseInt(e.target.value) || 120)}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold focus:border-[#0A7BC7] outline-none transition hover:border-[#0A7BC7]/50 cursor-pointer"
                              >
                                {C_FACTOR_PRESETS.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Elevation & Residual Pressures */}
                      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
                              2. Elevation Head & Residual Pressure
                            </h3>
                          </div>
                          <span className="text-[10.5px] font-mono text-muted-foreground">Static & Residual</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {renderInputBox(
                              "hw-elevation-change",
                              "elevationChange",
                              "Static Elevation Lift",
                              sizingParams.elevationChange,
                              calc.lenUnit,
                              "1",
                              0,
                              "0"
                            )}
                            {renderInputBox(
                              "hw-residual-pressure",
                              "residualPressure",
                              "Target Residual / Nozzle Pressure",
                              sizingParams.residualPressure,
                              calc.pressUnit,
                              "0.5",
                              0,
                              unitSystem === "ip" ? "7" : "0.5"
                            )}
                          </div>

                          <div className="p-2 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/40 text-[10.5px] text-red-800 dark:text-red-300 flex items-center gap-1.5">
                            <Info className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                            <span>
                              <strong>NFPA 13:</strong> Hazen-Williams equation applies for turbulent water flow in pipes &ge; 1". Wet pipe C = 120.
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Results Column (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-3.5 w-full">
                      
                      {/* Calculation Results Card */}
                      <div className="border border-border rounded-2xl bg-background p-3.5 shadow-xs flex flex-col gap-2.5">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <div>
                            <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-foreground">
                              Calculation Results
                            </h3>
                            <span className="text-[10.5px] text-muted-foreground">Friction Loss & Flow Dynamics</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                            NFPA 13 Sizing
                          </span>
                        </div>

                        {/* Friction Head Loss Result */}
                        <div className="border border-border rounded-xl bg-background p-3 flex flex-col gap-0.5 shadow-2xs border-l-4 border-l-primary">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Total Friction Head Loss
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowFormulaModal(true)}
                              className="size-4.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
                              title="View Formula Breakdown"
                            >
                              <Info className="size-2.5" />
                            </button>
                          </div>
                          <div className="text-[22px] sm:text-[24px] font-bold tracking-tight font-mono text-primary">
                            {calc.totalFrictionLoss} <span className="text-[13.5px] font-normal">{calc.pressUnit}</span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 text-[10.5px] text-muted-foreground font-mono">
                            <span>{calc.totalFrictionLossPsi} psi • {calc.totalFrictionLossBar} bar ({calc.totalFrictionMHead} m H₂O)</span>
                            <button
                              type="button"
                              onClick={() => setShowFormulaModal(true)}
                              className="text-primary hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Breakdown</span>
                              <Info className="size-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Friction Gradient</span>
                            <span className="font-mono text-[13px] font-bold text-foreground">
                              {calc.lossPer100} {calc.pressPer100Unit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">Per 100 units</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Flow Velocity</span>
                            <span className={`font-mono text-[13px] font-bold ${calc.isVelHigh ? "text-red-600" : calc.isVelModerate ? "text-amber-600" : "text-emerald-600"}`}>
                              {calc.velocity} {calc.velUnit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">{calc.isVelHigh ? "High (>15 fps)" : "Optimal"}</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Equiv Length</span>
                            <span className="font-mono text-[13px] font-bold text-foreground">
                              {calc.isIp ? `${calc.L_eq_ft} ft` : `${calc.L_eq_m} m`}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">+{sizingParams.fittingsPct}% Fittings</span>
                          </div>

                          <div className="p-2 rounded-xl bg-surface-2 border border-border flex flex-col gap-0.5">
                            <span className="text-[9.5px] font-bold uppercase text-muted-foreground">Total Dynamic Head</span>
                            <span className="font-mono text-[13px] font-bold text-red-600 dark:text-red-400">
                              {calc.totalSystemHead} {calc.pressUnit}
                            </span>
                            <span className="text-[9.5px] text-muted-foreground">Fric + Elev + Res</span>
                          </div>
                        </div>

                        {/* Velocity Visual Gauge */}
                        <div className="border border-border rounded-xl bg-background p-2.5 shadow-2xs flex flex-col gap-1.5">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Flow Velocity Status
                          </span>
                          <div className="bg-surface/50 rounded-lg flex flex-col p-2 border border-border/50 gap-1.5">
                            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                              <span>Velocity: <strong className="text-foreground">{calc.velocity} {calc.velUnit}</strong></span>
                              <span>Limit: <strong>{calc.maxRecVel} {calc.velUnit}</strong></span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                              <div
                                style={{ width: `${Math.min(100, (calc.velocityFps / 20) * 100)}%` }}
                                className={`h-full transition-all duration-500 ${
                                  calc.isVelHigh ? "bg-red-500" : calc.isVelModerate ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Report */}
              {tab === "report" && (
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-surface/30">
                  <div className="max-w-5xl mx-auto flex flex-col gap-6">
                    <div className="border border-border rounded-3xl bg-background p-6 flex flex-col gap-5 shadow-sm">
                      <div className="flex justify-between items-start border-b border-border pb-4">
                        <div>
                          <h2 className="text-[16px] font-bold text-foreground">Hazen-Williams Piping Loss Sheet</h2>
                          <p className="text-[12px] text-muted-foreground mt-0.5">Hydraulic calculation report conforming to NFPA 13</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <TBtn onClick={handleExportPDF}><FileText className="size-3.5" /> Export</TBtn>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-b border-border pb-5">
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Project Name</span>
                          <span className="font-semibold text-foreground">{project?.name || "Default Project"}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Project Code</span>
                          <span className="font-semibold font-mono text-foreground">{project?.code || "PROJ"}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Design Flow Rate (Q)</span>
                          <span className="font-semibold text-foreground">
                            {sizingParams.flowRate} {calc.flowUnit}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Pipe Diameter & Length</span>
                          <span className="font-semibold text-foreground">
                            {sizingParams.pipeDiameter} {calc.diamUnit} × {sizingParams.pipeLength} {calc.lenUnit}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Total Friction Loss</span>
                          <span className="font-semibold text-primary">
                            {calc.totalFrictionLoss} {calc.pressUnit} ({calc.totalFrictionLossPsi} psi)
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Flow Velocity</span>
                          <span className="font-semibold text-foreground">{calc.velocity} {calc.velUnit}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Total System Dynamic Head</span>
                          <span className="font-semibold text-foreground">{calc.totalSystemHead} {calc.pressUnit}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">C-Factor Rating</span>
                          <span className="font-semibold text-foreground">C-{sizingParams.cFactor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Formula & Step-by-Step Breakdown Modal */}
          {showFormulaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Activity className="size-5 text-[#0A7BC7]" />
                    <h2 className="text-lg font-bold text-foreground">Hazen-Williams Formulas & Derivations</h2>
                  </div>
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="p-1 rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">1. Hazen-Williams Friction Loss Equation (NFPA 13)</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      p_loss = (4.52 × Q^1.85) / (C^1.85 × d^4.87)  [psi / ft]
                    </p>
                    <p>
                      Where <strong>Q</strong> = Flow ({calc.Q_gpm.toFixed(1)} GPM), <strong>C</strong> = Roughness ({sizingParams.cFactor}), <strong>d</strong> = Pipe ID ({calc.d_in.toFixed(3)} in).
                    </p>
                    <p className="mt-1">
                      Friction gradient: <strong>{calc.lossPer100} {calc.pressPer100Unit}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">2. Equivalent Pipe Length</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      L_eq = L_straight × (1 + Fittings Allowance %)
                    </p>
                    <p>
                      Calculated: {sizingParams.pipeLength} × (1 + {sizingParams.fittingsPct}%) = <strong>{calc.isIp ? `${calc.L_eq_ft} ft` : `${calc.L_eq_m} m`}</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">3. Total Friction Head Loss</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      ΔP_friction = p_loss × L_eq
                    </p>
                    <p>
                      Calculated: <strong>{calc.totalFrictionLoss} {calc.pressUnit} ({calc.totalFrictionLossPsi} psi / {calc.totalFrictionLossBar} bar / {calc.totalFrictionMHead} m H₂O)</strong>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2 border border-border">
                    <h4 className="font-bold text-foreground text-sm mb-1">4. Fluid Flow Velocity</h4>
                    <p className="font-mono text-[#0A7BC7] dark:text-[#38bdf8] font-semibold mb-1">
                      v = 0.408 × Q / d²  [fps]  |  v = 4 × Q / (π × d²)  [m/s]
                    </p>
                    <p>
                      Calculated: <strong>{calc.velocity} {calc.velUnit} ({calc.velocityFps} fps / {calc.velocityMps} m/s)</strong>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border">
                  <button
                    onClick={() => setShowFormulaModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer hover:bg-primary/90 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comment Assignment Modal */}
          {activeCommentTarget && (
            <AssignCommentModal
              isOpen={Boolean(activeCommentTarget)}
              targetId={activeCommentTarget.id}
              targetLabel={activeCommentTarget.label}
              onClose={() => setActiveCommentTarget(null)}
              onSave={handleSaveComment}
            />
          )}

        </div>
      </div>
    </AppShell>
  );
}
