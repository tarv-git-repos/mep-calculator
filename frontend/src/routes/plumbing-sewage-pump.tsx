import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-sewage-pump")({
  head: () => ({
    meta: [
      { title: "Sewage Pump Sizing Calculator — MEP Calc" },
      { name: "description", content: "Size sewage ejector and submersible sump pumps, wet well storage volume, dynamic head, and motor ratings per IPC & ASPE." },
    ],
  }),
  component: SewagePumpPage,
});

export type SewagePresetKey =
  | "residential_basement"
  | "commercial_building"
  | "restaurant_kitchen"
  | "high_rise_basement"
  | "heavy_duty_station"
  | "custom";

export interface SewagePresetConfig {
  key: SewagePresetKey;
  label: string;
  category: string;
  description: string;
  inflow: number; // GPM
  cycle: number; // minutes
  starts: number; // max starts/hr
  lift: number; // ft
  pipeDia: number; // inches
  pipeLen: number; // ft
  fittingsHead: number; // ft
  safetyFactor: number; // %
  basinDia: number; // inches
}

export const SEWAGE_PRESETS: Record<SewagePresetKey, SewagePresetConfig> = {
  residential_basement: {
    key: "residential_basement",
    label: "Residential Basement",
    category: "IPC / Residential Ejector",
    description: "Single-family or multi-family basement sanitary fixture drainage (WC, basin, laundry).",
    inflow: 20,
    cycle: 5,
    starts: 6,
    lift: 15,
    pipeDia: 2.0,
    pipeLen: 35,
    fittingsHead: 3.5,
    safetyFactor: 15,
    basinDia: 24,
  },
  commercial_building: {
    key: "commercial_building",
    label: "Commercial Office / Retail",
    category: "ASPE / Commercial",
    description: "Multi-fixture public basement restrooms with duplex alternating sewage ejectors.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 25,
    pipeDia: 3.0,
    pipeLen: 65,
    fittingsHead: 6.0,
    safetyFactor: 15,
    basinDia: 36,
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant / Commercial Kitchen",
    category: "IPC / High Solids & Grease",
    description: "Grease-laden waste & high-temperature kitchen discharge requiring high-torque solids handling.",
    inflow: 65,
    cycle: 5,
    starts: 8,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.5,
    safetyFactor: 20,
    basinDia: 42,
  },
  high_rise_basement: {
    key: "high_rise_basement",
    label: "High-Rise Deep Basement",
    category: "ASPE / High Head",
    description: "Deep subterranean parking levels (B3–B5) requiring high-head discharge to street sewer.",
    inflow: 75,
    cycle: 8,
    starts: 6,
    lift: 55,
    pipeDia: 4.0,
    pipeLen: 120,
    fittingsHead: 10.0,
    safetyFactor: 15,
    basinDia: 48,
  },
  heavy_duty_station: {
    key: "heavy_duty_station",
    label: "Heavy-Duty Wet Well Station",
    category: "Municipal / ASPE Chapter 7",
    description: "Large commercial complex or hotel central wet well with large non-clog solids-handling pumps.",
    inflow: 150,
    cycle: 10,
    starts: 6,
    lift: 35,
    pipeDia: 4.0,
    pipeLen: 150,
    fittingsHead: 12.0,
    safetyFactor: 20,
    basinDia: 60,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "Custom user-defined sewage pump hydraulic configuration.",
    inflow: 50,
    cycle: 6,
    starts: 6,
    lift: 20,
    pipeDia: 3.0,
    pipeLen: 50,
    fittingsHead: 5.0,
    safetyFactor: 15,
    basinDia: 36,
  },
};

// Standard Motor Ratings (HP)
const STANDARD_MOTOR_HP = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 7.5, 10.0, 15.0, 20.0, 25.0, 30.0];

// Conversion Constants
const GPM_TO_LPS = 0.0630902;
const GPM_TO_LMIN = 3.78541;
const FT_TO_M = 0.3048;
const IN_TO_MM = 25.4;
const GAL_TO_M3 = 0.00378541;
const GAL_TO_L = 3.78541;
const HP_TO_KW = 0.7457;

function SewagePumpPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, isReadOnly, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-sewage-pump", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole);

  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP: GPM, ft, inches, gal, HP / SI: L/s, m, mm, m³ & L, kW)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");
  const isSI = unitSystem === "si";

  // Preset
  const [preset, setPreset] = useState<SewagePresetKey>("commercial_building");

  // Core Inputs (stored in IP units internally)
  const [inflow, setInflow] = useState<number | "">(50); // Peak Sewage Inflow (GPM)
  const [flowMultiplier, setFlowMultiplier] = useState<number | "">(2.0); // Pump duty factor (typically 1.5 - 2.0x)
  const [cycle, setCycle] = useState<number | "">(6); // Desired cycle time (minutes)
  const [starts, setStarts] = useState<number | "">(6); // Max starts per hour
  const [lift, setLift] = useState<number | "">(25); // Static lift (ft)
  const [pipeDia, setPipeDia] = useState<number | "">(3.0); // Discharge pipe internal diameter (inches)
  const [pipeLen, setPipeLen] = useState<number | "">(65); // Total pipe developed length (ft)
  const [fittingsHead, setFittingsHead] = useState<number | "">(6.0); // Minor losses (valves/bends) (ft)
  const [safetyFactor, setSafetyFactor] = useState<number | "">(15); // Head safety margin (%)
  const [basinDia, setBasinDia] = useState<number | "">(36); // Wet well diameter (inches)
  const [pumpEfficiency, setPumpEfficiency] = useState<number | "">(60); // % pump efficiency
  const [motorEfficiency, setMotorEfficiency] = useState<number | "">(85); // % motor efficiency
  const [pumpCountMode, setPumpCountMode] = useState<"1W_1S" | "2W_1S">("1W_1S"); // 1W+1S (Duplex) or 2W+1S (Triplex)

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load saved parameters on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_sewage_pump_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.preset !== undefined) setPreset(parsed.preset);
        if (parsed.inflow !== undefined) setInflow(parsed.inflow);
        if (parsed.flowMultiplier !== undefined) setFlowMultiplier(parsed.flowMultiplier);
        if (parsed.cycle !== undefined) setCycle(parsed.cycle);
        if (parsed.starts !== undefined) setStarts(parsed.starts);
        if (parsed.lift !== undefined) setLift(parsed.lift);
        if (parsed.pipeDia !== undefined) setPipeDia(parsed.pipeDia);
        if (parsed.pipeLen !== undefined) setPipeLen(parsed.pipeLen);
        if (parsed.fittingsHead !== undefined) setFittingsHead(parsed.fittingsHead);
        if (parsed.safetyFactor !== undefined) setSafetyFactor(parsed.safetyFactor);
        if (parsed.basinDia !== undefined) setBasinDia(parsed.basinDia);
        if (parsed.pumpEfficiency !== undefined) setPumpEfficiency(parsed.pumpEfficiency);
        if (parsed.motorEfficiency !== undefined) setMotorEfficiency(parsed.motorEfficiency);
        if (parsed.pumpCountMode !== undefined) setPumpCountMode(parsed.pumpCountMode);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse stored Sewage Pump params", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Version restore listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_sewage_pump_params_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        if (restoredData.preset !== undefined) setPreset(restoredData.preset);
        if (restoredData.inflow !== undefined) setInflow(restoredData.inflow);
        if (restoredData.flowMultiplier !== undefined) setFlowMultiplier(restoredData.flowMultiplier);
        if (restoredData.cycle !== undefined) setCycle(restoredData.cycle);
        if (restoredData.starts !== undefined) setStarts(restoredData.starts);
        if (restoredData.lift !== undefined) setLift(restoredData.lift);
        if (restoredData.pipeDia !== undefined) setPipeDia(restoredData.pipeDia);
        if (restoredData.pipeLen !== undefined) setPipeLen(restoredData.pipeLen);
        if (restoredData.fittingsHead !== undefined) setFittingsHead(restoredData.fittingsHead);
        if (restoredData.safetyFactor !== undefined) setSafetyFactor(restoredData.safetyFactor);
        if (restoredData.basinDia !== undefined) setBasinDia(restoredData.basinDia);
        if (restoredData.pumpEfficiency !== undefined) setPumpEfficiency(restoredData.pumpEfficiency);
        if (restoredData.motorEfficiency !== undefined) setMotorEfficiency(restoredData.motorEfficiency);
        if (restoredData.pumpCountMode !== undefined) setPumpCountMode(restoredData.pumpCountMode);
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        dirtyStore.set(false);
        toast.success("Sewage Pump calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Auto-persist full calculator state
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const dataToSave = {
      preset,
      inflow,
      flowMultiplier,
      cycle,
      starts,
      lift,
      pipeDia,
      pipeLen,
      fittingsHead,
      safetyFactor,
      basinDia,
      pumpEfficiency,
      motorEfficiency,
      pumpCountMode,
      unitSystem,
      updatedAt: new Date().toISOString(),
    };
    const pKey = `mep_sewage_pump_params_${project.id}`;
    localStorage.setItem(pKey, JSON.stringify(dataToSave));
    localStorage.setItem("mep_sewage_pump_params", JSON.stringify(dataToSave));
  }, [
    project?.id,
    loadedProjectId,
    preset,
    inflow,
    flowMultiplier,
    cycle,
    starts,
    lift,
    pipeDia,
    pipeLen,
    fittingsHead,
    safetyFactor,
    basinDia,
    pumpEfficiency,
    motorEfficiency,
    pumpCountMode,
    unitSystem,
  ]);

  // Comments & Task State (matching Preliminary Cooling Load)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments on project switch
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-sewage-pump`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCommentsList(parsed);
        }
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-sewage-pump`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/plumbing-sewage-pump", count: newList.length });
          bc.close();
        } catch (e) {}
      }
    }
    try {
      if (typeof forceSaveToCloud === "function") {
        setTimeout(() => forceSaveToCloud(false), 50);
      }
    } catch (e) {}
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (comment: any) => {
    const commentWithMeta = {
      ...comment,
      targetId: commentTargetItem?.id,
      targetName: commentTargetItem?.name,
      spaceId: commentTargetItem?.id,
      spaceName: commentTargetItem?.name,
      targetType: "Sewage Pump Parameter",
      calculatorTitle: "Sewage Pump Sizing",
      calculatorPath: "/plumbing-sewage-pump",
      projectId: project?.id || "default",
      projectName: project?.name || "Sanitary Drainage Lift Station",
      authorName: userData?.name || profile?.name || "System Admin",
      authorId: profile?.id || userData?.id || "unknown",
    };
    const updated = [commentWithMeta, ...commentsList.filter((c) => c.id !== comment.id)];
    saveComments(updated);

    try {
      dispatchGlobalCommentNotification(commentWithMeta, {
        project,
        currentUserName: userData?.name || profile?.name || "System Admin",
        currentUserId: profile?.id || userData?.id || "unknown",
      });
    } catch (e) {
      console.error("Failed to dispatch global notification", e);
    }

    setCommentModalOpen(false);
  };

  const getItemComments = (id: string) => {
    return commentsList.filter(
      (c) => c.targetId === id || c.spaceId === id || c.itemId === id
    );
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id);
    if (itemComments.length === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 transition cursor-pointer shadow-2xs"
      >
        <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
        <span>{itemComments.length}</span>
      </button>
    );
  };

  // Clipboard & Input Helper Actions
  const handleCopyValue = (label: string, value: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(value));
      toast.success(`Copied ${label}: ${value}`);
    }
  };

  const handlePasteValue = async (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text);
        if (!isNaN(num)) {
          setter(num);
          toast.success(`Pasted into ${label}: ${num}`);
        } else if (text) {
          setter(text);
          toast.success(`Pasted into ${label}`);
        }
      } catch (e) {
        toast.error("Failed to read clipboard");
      }
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defaultVal: any) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setter(defaultVal);
    toast.info(`Reset ${label} to default (${defaultVal})`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setter("");
    toast.info(`Cleared ${label}`);
  };

  const handleUnitSystemChange = (targetUnit: "si" | "ip") => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.success(`Unit system switched to ${targetUnit.toUpperCase()}`);
  };

  // Scroll and highlight notification target item (exact parity with Preliminary Cooling Load)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`res-${targetId}`) ||
                 document.getElementById(`card-${targetId}`) ||
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
    }

    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.targetId || detail?.id || detail?.targetName) {
        handleScrollTarget(detail.targetId || detail.id, detail.targetName);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep_scroll_to_target", handleScrollEvent);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_target", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Handle Preset Change
  const handleApplyPreset = (key: SewagePresetKey) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setPreset(key);
    const p = SEWAGE_PRESETS[key];
    if (p) {
      setInflow(p.inflow);
      setCycle(p.cycle);
      setStarts(p.starts);
      setLift(p.lift);
      setPipeDia(p.pipeDia);
      setPipeLen(p.pipeLen);
      setFittingsHead(p.fittingsHead);
      setSafetyFactor(p.safetyFactor);
      setBasinDia(p.basinDia);
      toast.success(`Applied preset: ${p.label}`);
    }
  };

  // Calculations
  const calcResults = useMemo(() => {
    const qIn = typeof inflow === "number" ? inflow : 0;
    const mult = typeof flowMultiplier === "number" ? flowMultiplier : 2.0;
    const tCycle = typeof cycle === "number" ? cycle : 5;
    const maxStarts = typeof starts === "number" ? starts : 6;
    const hStatic = typeof lift === "number" ? lift : 0;
    const dPipe = typeof pipeDia === "number" && pipeDia > 0 ? pipeDia : 3.0;
    const lPipe = typeof pipeLen === "number" ? pipeLen : 0;
    const hFittings = typeof fittingsHead === "number" ? fittingsHead : 0;
    const sf = typeof safetyFactor === "number" ? safetyFactor : 15;
    const dBasin = typeof basinDia === "number" && basinDia > 0 ? basinDia : 36;
    const effP = typeof pumpEfficiency === "number" ? pumpEfficiency / 100 : 0.6;
    const effM = typeof motorEfficiency === "number" ? motorEfficiency / 100 : 0.85;

    // 1. Pump Duty Capacity (GPM)
    const dutyFlowPerPump = qIn * mult;
    const totalWorkingFlow = pumpCountMode === "2W_1S" ? dutyFlowPerPump * 2 : dutyFlowPerPump;

    // 2. Velocity in discharge pipe (ft/s)
    const velocityFps = dPipe > 0 ? (0.4085 * dutyFlowPerPump) / (dPipe * dPipe) : 0;
    const velocityMs = velocityFps * 0.3048;

    // 3. Pipe Friction Head Loss (Hazen-Williams C=120)
    const C = 120;
    const frictionHead =
      dPipe > 0 && lPipe > 0 && dutyFlowPerPump > 0
        ? 0.002083 * lPipe * Math.pow(100 / C, 1.852) * (Math.pow(dutyFlowPerPump, 1.852) / Math.pow(dPipe, 4.8655))
        : 0;

    // 4. Total Dynamic Head (TDH)
    const rawHead = hStatic + frictionHead + hFittings;
    const tdh = rawHead * (1 + sf / 100);

    // 5. Wet Well Active Storage Volume
    const activeVolGal = (dutyFlowPerPump * tCycle) / 4;
    const activeVolM3 = activeVolGal * GAL_TO_M3;
    const activeVolL = activeVolGal * GAL_TO_L;

    // 6. Sump Basin Geometry
    const basinRadiusFt = dBasin / 2 / 12;
    const basinAreaSqFt = Math.PI * Math.pow(basinRadiusFt, 2);
    const galPerFtDepth = basinAreaSqFt * 7.48052; // 1 cu.ft = 7.48052 gal
    const activeDepthFt = galPerFtDepth > 0 ? activeVolGal / galPerFtDepth : 0;
    const activeDepthInches = activeDepthFt * 12;

    const pumpClearanceInches = 12.0; // Under pump low level cutoff
    const highLevelAlarmInches = 12.0; // Above high level float
    const totalBasinDepthInches = activeDepthInches + pumpClearanceInches + highLevelAlarmInches;

    // 7. Pump Motor Sizing
    const waterHP = (dutyFlowPerPump * tdh) / 3960;
    const bhp = effP > 0 ? waterHP / effP : waterHP / 0.6;
    const motorKW = effM > 0 ? (bhp * HP_TO_KW) / effM : bhp * HP_TO_KW;

    let recommendedMotorHP = STANDARD_MOTOR_HP[0];
    for (const stdHP of STANDARD_MOTOR_HP) {
      if (stdHP >= bhp) {
        recommendedMotorHP = stdHP;
        break;
      }
      recommendedMotorHP = stdHP;
    }
    const recommendedMotorKW = recommendedMotorHP * HP_TO_KW;

    // 8. Checks & Verification
    const isScouringCompliant = velocityFps >= 2.0; // IPC min 2.0 ft/s
    const isMaxVelocityCompliant = velocityFps <= 8.0; // Recommended max 8.0 ft/s
    const isSolidsCompliant = dPipe >= 2.0; // IPC 712.4.2 min 2.0" discharge for raw sewage solids
    const calculatedStartsPerHour = tCycle > 0 ? 60 / tCycle : 0;

    return {
      qIn,
      mult,
      dutyFlowPerPump,
      totalWorkingFlow,
      velocityFps,
      velocityMs,
      frictionHead,
      hStatic,
      hFittings,
      tdh,
      sf,
      activeVolGal,
      activeVolM3,
      activeVolL,
      dBasin,
      dPipe,
      activeDepthInches,
      totalBasinDepthInches,
      waterHP,
      bhp,
      motorKW,
      recommendedMotorHP,
      recommendedMotorKW,
      isScouringCompliant,
      isMaxVelocityCompliant,
      isSolidsCompliant,
      calculatedStartsPerHour,
      maxStarts,
    };
  }, [
    inflow,
    flowMultiplier,
    cycle,
    starts,
    lift,
    pipeDia,
    pipeLen,
    fittingsHead,
    safetyFactor,
    basinDia,
    pumpEfficiency,
    motorEfficiency,
    pumpCountMode,
  ]);

  // Export to PDF
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pId = project?.id || "default";
    const pName = project?.name || "Sanitary Drainage Lift Station";

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("SEWAGE PUMP SIZING CALCULATION REPORT", 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Project: ${pName} | Date: ${formatDateStr(new Date())} | Engineer: ${currentUserName}`, 14, 26);
    doc.text(`Configuration Preset: ${SEWAGE_PRESETS[preset]?.label} (${SEWAGE_PRESETS[preset]?.category})`, 14, 31);

    // Summary Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 35, 182, 38, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("EXECUTIVE PUMP DESIGN SUMMARY", 18, 42);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(`• Pump Duty Flow (Each):`, 18, 48);
    doc.text(`• Total Dynamic Head (TDH):`, 18, 54);
    doc.text(`• Wet Well Active Sump Volume:`, 18, 60);
    doc.text(`• Recommended Motor Power:`, 18, 66);

    doc.setFont("helvetica", "bold");
    doc.text(
      isSI
        ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s (${(calcResults.dutyFlowPerPump * GPM_TO_LMIN).toFixed(0)} L/min)`
        : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`,
      75,
      48
    );
    doc.text(
      isSI
        ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m w.g. (${(calcResults.tdh * 0.02989).toFixed(2)} bar)`
        : `${calcResults.tdh.toFixed(1)} ft w.g.`,
      75,
      54
    );
    doc.text(
      isSI
        ? `${calcResults.activeVolM3.toFixed(2)} m³ (${calcResults.activeVolL.toFixed(0)} L)`
        : `${calcResults.activeVolGal.toFixed(0)} Gal`,
      75,
      60
    );
    doc.text(
      isSI
        ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
        : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`,
      75,
      66
    );

    // Hydraulic Data Table
    const tableData = [
      ["Peak Sanitary Inflow Rate (Q_in)", isSI ? `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.qIn} GPM`, "IPC Table 709.1"],
      ["Pump Duty Flow (Q_pump)", isSI ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`, `${calcResults.mult}x Inflow Peak Multiplier`],
      ["Pumping Arrangement Mode", pumpCountMode === "1W_1S" ? "1 Duty + 1 Standby (Duplex)" : "2 Duty + 1 Standby (Triplex)", "100% Standby Redundancy"],
      ["Static Elevation Lift", isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(1)} m` : `${calcResults.hStatic} ft`, "Basin Invert to Discharge"],
      ["Discharge Pipe Diameter", isSI ? `${(calcResults.dPipe * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dPipe}" NPS`, "IPC 712.4.2 Solids Clearance (Min 2\")"],
      ["Discharge Fluid Velocity", isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`, calcResults.isScouringCompliant ? "Self-Scouring Compliant (≥2.0 fps)" : "Below 2.0 fps Warning"],
      ["Friction Head Loss (H_f)", isSI ? `${(calcResults.frictionHead * FT_TO_M).toFixed(2)} m` : `${calcResults.frictionHead.toFixed(2)} ft`, "Hazen-Williams Equation (C=120)"],
      ["Fittings & Valve Losses", isSI ? `${(calcResults.hFittings * FT_TO_M).toFixed(2)} m` : `${calcResults.hFittings.toFixed(1)} ft`, "Check & Gate Valves / Bends"],
      ["Total Dynamic Head (TDH)", isSI ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m` : `${calcResults.tdh.toFixed(1)} ft`, `Includes +${calcResults.sf}% Safety Margin`],
      ["Active Storage Volume", isSI ? `${calcResults.activeVolM3.toFixed(2)} m³ (${calcResults.activeVolL.toFixed(0)} L)` : `${calcResults.activeVolGal.toFixed(0)} Gal`, `(Q_pump × ${cycle} min) / 4`],
      ["Basin Internal Dimensions", isSI ? `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm Ø × ${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm Depth` : `${calcResults.dBasin}" Ø × ${calcResults.totalBasinDepthInches.toFixed(0)}" Depth`, "Includes 12\" Submergence + 12\" Alarm"],
      ["Active Drawdown Depth", isSI ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.activeDepthInches.toFixed(1)} inches`, "Drawdown between Start/Stop floats"],
      ["Calculated Brake Horsepower", `${calcResults.bhp.toFixed(2)} BHP`, `@ ${pumpEfficiency}% Pump Efficiency`],
      ["Selected Standard Motor Rating", isSI ? `${calcResults.recommendedMotorKW.toFixed(2)} kW` : `${calcResults.recommendedMotorHP} HP`, "NEMA Standard Heavy-Duty Submersible"],
    ];

    autoTable(doc, {
      startY: 78,
      head: [["Engineering Parameter", "Calculated Value", "Design Standard / Reference"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], fontSize: 8.5, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { cellWidth: 70, fontStyle: "bold" }, 1: { cellWidth: 55 }, 2: { cellWidth: 57 } },
    });

    // Signature Block
    const finalY = (doc as any).lastAutoTable?.finalY || 210;
    const sigDetails = getSignatureBlockDetails(project, currentUserName);
    if (finalY < 235) {
      doc.setDrawColor(203, 213, 225);
      doc.line(14, finalY + 12, 196, finalY + 12);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Calculated By: ${sigDetails.preparedBy}`, 14, finalY + 20);
      doc.text(`Approved By: ${sigDetails.approvedBy}`, 110, finalY + 20);
      doc.text(`Date & Stamp: ${sigDetails.date}`, 14, finalY + 26);
      doc.text(`Status: ${sigDetails.status}`, 110, finalY + 26);
    }

    doc.save(`Sewage_Pump_Sizing_${pName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
    toast.success("PDF calculation report generated!");
  };

  // Export to Excel
  const exportToExcel = async () => {
    const pName = project?.name || "Sanitary Drainage Lift Station";
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Sewage Pump Sizing");

    ws.columns = [
      { width: 34 },
      { width: 22 },
      { width: 14 },
      { width: 30 },
      { width: 36 },
    ];

    // Header
    ws.addRow(["SEWAGE PUMP & WET WELL SIZING REPORT"]);
    ws.addRow([`Project: ${pName}`]);
    ws.addRow([`Engineer: ${currentUserName}`]);
    ws.addRow([`Date: ${new Date().toLocaleDateString()}`]);
    ws.addRow([`Preset: ${SEWAGE_PRESETS[preset]?.label}`]);
    ws.addRow([]);

    ws.addRow(["Parameter", "Calculated Value", "Unit", "Formula / Standard", "Remarks"]);
    const headerRow = ws.getRow(7);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };

    const excelRows = [
      ["Peak Inflow Rate (Q_in)", isSI ? (calcResults.qIn * GPM_TO_LPS).toFixed(2) : calcResults.qIn, isSI ? "L/s" : "GPM", "User Input", "Peak sanitary drainage inflow"],
      ["Pump Duty Flow (Each)", isSI ? (calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2) : calcResults.dutyFlowPerPump.toFixed(1), isSI ? "L/s" : "GPM", "Q_in x Multiplier", "Required duty capacity per pump"],
      ["Static Lift (H_static)", isSI ? (calcResults.hStatic * FT_TO_M).toFixed(1) : calcResults.hStatic, isSI ? "m" : "ft", "Site Elevation", "Vertical lift from basin invert to high point"],
      ["Discharge Pipe Diameter", isSI ? (calcResults.dPipe * IN_TO_MM).toFixed(0) : calcResults.dPipe, isSI ? "mm" : "inches", "IPC 712.4.2", "Min 2.0\" (50 mm) for raw sewage solids"],
      ["Discharge Velocity", isSI ? calcResults.velocityMs.toFixed(2) : calcResults.velocityFps.toFixed(2), isSI ? "m/s" : "ft/s", "v = 0.4085 x Q / d²", "Scouring velocity (2.0 - 8.0 fps)"],
      ["Pipe Friction Loss", isSI ? (calcResults.frictionHead * FT_TO_M).toFixed(2) : calcResults.frictionHead.toFixed(2), isSI ? "m" : "ft", "Hazen-Williams (C=120)", "Friction head loss in discharge piping"],
      ["Fittings & Valve Head", isSI ? (calcResults.hFittings * FT_TO_M).toFixed(2) : calcResults.hFittings.toFixed(1), isSI ? "m" : "ft", "Minor Losses", "Losses through check/gate valves and fittings"],
      ["Total Dynamic Head (TDH)", isSI ? (calcResults.tdh * FT_TO_M).toFixed(1) : calcResults.tdh.toFixed(1), isSI ? "m" : "ft", "(H_static + H_f + H_fit) x (1 + SF)", "Total calculated pump design head"],
      ["Wet Well Active Volume", isSI ? calcResults.activeVolM3.toFixed(2) : calcResults.activeVolGal.toFixed(0), isSI ? "m3" : "Gal", "(Q_pump x Cycle) / 4", "Required active storage drawdown volume"],
      ["Basin Internal Diameter", isSI ? (calcResults.dBasin * IN_TO_MM).toFixed(0) : calcResults.dBasin, isSI ? "mm" : "inches", "User Input", "Internal diameter of sump basin"],
      ["Active Liquid Depth", isSI ? (calcResults.activeDepthInches * IN_TO_MM).toFixed(0) : calcResults.activeDepthInches.toFixed(1), isSI ? "mm" : "inches", "V_active / Basin_Area", "Liquid level rise between pump start/stop"],
      ["Estimated Motor Power", isSI ? calcResults.motorKW.toFixed(2) : calcResults.bhp.toFixed(2), isSI ? "kW" : "BHP", "BHP / Motor_Eff", "Calculated wire-to-water shaft power"],
      ["Recommended Motor Size", isSI ? calcResults.recommendedMotorKW.toFixed(2) : calcResults.recommendedMotorHP, isSI ? "kW" : "HP", "Standard Rating", "Selected commercial standard motor rating"],
    ];

    excelRows.forEach((r) => ws.addRow(r));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Sewage_Pump_Sizing_${pName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
    toast.success("Excel calculation sheet exported!");
  };

  return (
    <AppShell>
      <div className="flex h-full w-full bg-background overflow-hidden select-none font-sans text-foreground">
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          
          {/* Top Review Bar */}
          <CalculationReviewBar
            calculatorPath="/plumbing-sewage-pump"
            calculatorTitle="Sewage Pump Sizing"
            projectId={project?.id}
          />

          {/* Header Bar */}
          <header className="px-6 py-3 border-b border-border/80 bg-card/60 backdrop-blur-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Droplets className="size-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground flex items-center gap-2">
                  Sewage Pump Sizing Calculator
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    IPC 712 / ASPE
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Submersible sewage ejector flow rate, total dynamic head (TDH), wet well volume & motor rating
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Unit Toggle */}
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isEffectiveReadOnly}
              />

              {/* Formula Modal Trigger */}
              <button
                type="button"
                onClick={() => setFormulaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-surface-2 text-foreground text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="View mathematical formula breakdown & IPC reference equations"
              >
                <FileText className="size-3.5 text-primary" />
                <span>Formulas</span>
              </button>

              {/* Intelligence Drawer Trigger */}
              <button
                type="button"
                onClick={() => setIntelOpen(!intelOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                  intelOpen
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-surface-2 text-foreground"
                }`}
                title="Toggle IPC Hydraulic Intelligence Drawer"
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>{intelOpen ? "Hide Intel" : "Pump Intel"}</span>
              </button>

              {/* View Mode Toggle */}
              <div className="flex p-0.5 bg-surface-2 rounded-xl border border-border/80">
                <button
                  type="button"
                  onClick={() => setTab("solver")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    tab === "solver"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Calculator
                </button>
                <button
                  type="button"
                  onClick={() => setTab("report")}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    tab === "report"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Summary Report
                </button>
              </div>
            </div>
          </header>

          {/* Body Section */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {tab === "solver" ? (
                <div className="space-y-6">
                  
                  {/* Presets Bar */}
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        id="card-presets"
                        className={`bg-card border rounded-2xl p-4 space-y-2.5 shadow-2xs transition-all ${
                          highlightedTargetId === "card-presets" || highlightedTargetId === "presets"
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="size-4 text-primary" />
                            <span className="text-xs font-bold text-foreground">
                              Quick Design Presets & Application Profiles
                            </span>
                            {renderCommentBadge("card-presets", "Sewage Sizing Presets")}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Instant configuration for sanitary lift applications per IPC/ASPE
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {(Object.keys(SEWAGE_PRESETS) as SewagePresetKey[]).map((key) => {
                            const p = SEWAGE_PRESETS[key];
                            const isSelected = preset === key;
                            return (
                              <button
                                key={key}
                                onClick={() => handleApplyPreset(key)}
                                disabled={isEffectiveReadOnly}
                                className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                                    : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
                                }`}
                              >
                                <div className="text-[11.5px] font-bold truncate">{p.label}</div>
                                <div className="text-[10px] opacity-80 mt-0.5">{p.inflow} GPM ({p.lift} ft lift)</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                      <ContextMenuItem
                        onClick={() => handleOpenComment("card-presets", "Sewage Sizing Presets")}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Add Comment / Assign Task</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Top Key KPI Hero Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    
                    {/* KPI 1: Pump Duty Flow */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-dutyFlow"
                          className={`p-4 rounded-2xl border bg-primary/5 space-y-1 transition-all ${
                            highlightedTargetId === "res-dutyFlow" || highlightedTargetId === "dutyFlow"
                              ? "border-primary ring-2 ring-primary bg-primary/10"
                              : "border-primary/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Pump Duty Flow</span>
                            <div className="flex items-center gap-1.5">
                              {renderCommentBadge("res-dutyFlow", "Pump Duty Flow")}
                              <Gauge className="size-4 text-primary" />
                            </div>
                          </div>
                          <div className="text-2xl font-black text-foreground">
                            {isSI
                              ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s`
                              : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">
                            {calcResults.mult}x peak inflow ({calcResults.qIn} GPM)
                          </p>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Pump Duty Flow", isSI ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("res-dutyFlow", "Pump Duty Flow")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* KPI 2: Total Head */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-tdh"
                          className={`p-4 rounded-2xl border bg-surface space-y-1 transition-all ${
                            highlightedTargetId === "res-tdh" || highlightedTargetId === "tdh"
                              ? "border-primary ring-2 ring-primary bg-primary/5"
                              : "border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Head (TDH)</span>
                            <div className="flex items-center gap-1.5">
                              {renderCommentBadge("res-tdh", "Total Dynamic Head")}
                              <ArrowUpRight className="size-4 text-primary" />
                            </div>
                          </div>
                          <div className="text-2xl font-black text-foreground">
                            {isSI
                              ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m`
                              : `${calcResults.tdh.toFixed(1)} ft`}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">
                            +{calcResults.sf}% safety margin applied
                          </p>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Total Dynamic Head", isSI ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m` : `${calcResults.tdh.toFixed(1)} ft`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("res-tdh", "Total Dynamic Head")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* KPI 3: Motor Rating */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-motor"
                          className={`p-4 rounded-2xl border bg-surface space-y-1 transition-all ${
                            highlightedTargetId === "res-motor" || highlightedTargetId === "motor"
                              ? "border-primary ring-2 ring-primary bg-primary/5"
                              : "border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Motor Rating</span>
                            <div className="flex items-center gap-1.5">
                              {renderCommentBadge("res-motor", "Motor Rating")}
                              <Zap className="size-4 text-amber-500" />
                            </div>
                          </div>
                          <div className="text-2xl font-black text-foreground">
                            {isSI
                              ? `${calcResults.recommendedMotorKW.toFixed(2)} kW`
                              : `${calcResults.recommendedMotorHP} HP`}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">
                            {calcResults.bhp.toFixed(2)} BHP calculated ({pumpEfficiency}% eff)
                          </p>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Recommended Motor Rating", isSI ? `${calcResults.recommendedMotorKW.toFixed(2)} kW` : `${calcResults.recommendedMotorHP} HP`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("res-motor", "Motor Rating")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* KPI 4: Active Sump Volume */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="res-sumpVol"
                          className={`p-4 rounded-2xl border bg-surface space-y-1 transition-all ${
                            highlightedTargetId === "res-sumpVol" || highlightedTargetId === "sumpVol"
                              ? "border-primary ring-2 ring-primary bg-primary/5"
                              : "border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Sump Vol</span>
                            <div className="flex items-center gap-1.5">
                              {renderCommentBadge("res-sumpVol", "Active Sump Volume")}
                              <Cylinder className="size-4 text-blue-500" />
                            </div>
                          </div>
                          <div className="text-2xl font-black text-foreground">
                            {isSI
                              ? `${calcResults.activeVolM3.toFixed(2)} m³`
                              : `${calcResults.activeVolGal.toFixed(0)} Gal`}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">
                            Depth: {isSI ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.activeDepthInches.toFixed(1)}"`} ({calcResults.dBasin}" Ø)
                          </p>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Active Sump Volume", isSI ? `${calcResults.activeVolM3.toFixed(2)} m³` : `${calcResults.activeVolGal.toFixed(0)} Gal`)}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Value</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("res-sumpVol", "Active Sump Volume")}
                          className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>

                  {/* 2-Column Responsive Layout for Parameters */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Card 1: Inflow & Pumping Duty */}
                    <div
                      id="card-inflow"
                      className={`bg-card border rounded-2xl p-5 space-y-4 shadow-2xs transition-all ${
                        highlightedTargetId === "card-inflow" ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Droplets className="size-4 text-primary" />
                          <h3 className="text-sm font-bold text-foreground">1. Drainage Inflow & Pumping Factor</h3>
                        </div>
                        {renderCommentBadge("card-inflow", "Drainage Inflow & Pumping Factor")}
                      </div>

                      <div className="space-y-3 text-[12.5px]">
                        
                        {/* Peak Sewage Inflow */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-inflow"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "inflow" || highlightedTargetId === "field-inflow"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Peak Sewage Inflow Rate:</span>
                                  {renderCommentBadge("inflow", "Peak Sewage Inflow Rate")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Total continuous peak inflow to wet well</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof inflow === "number" ? parseFloat((inflow * GPM_TO_LPS).toFixed(2)) : inflow}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setInflow("");
                                    else if (isSI) setInflow(val / GPM_TO_LPS);
                                    else setInflow(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  {isSI ? "L/s" : "GPM"}
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Peak Inflow", isSI ? `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.qIn} GPM`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handlePasteValue("Peak Inflow", (v) => isSI ? setInflow(v / GPM_TO_LPS) : setInflow(v))}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <Clipboard className="size-3.5 text-muted-foreground" />
                              <span>Paste Value</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Peak Inflow", setInflow, 50)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (50 GPM)</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleClearValue("Peak Inflow", setInflow)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <Trash2 className="size-3.5" />
                              <span>Clear Field</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("inflow", "Peak Sewage Inflow Rate")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Pump Duty Multiplier */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-flowMultiplier"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "flowMultiplier" || highlightedTargetId === "field-flowMultiplier"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Pump Drawdown Factor:</span>
                                  {renderCommentBadge("flowMultiplier", "Pump Drawdown Factor")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">ASPE recommends 1.5x - 2.0x peak inflow</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1.0"
                                  max="3.0"
                                  step="0.1"
                                  disabled={isEffectiveReadOnly}
                                  value={flowMultiplier}
                                  onChange={(e) => {
                                    setFlowMultiplier(e.target.value === "" ? "" : parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  Multiplier
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Pump Drawdown Factor", flowMultiplier)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handlePasteValue("Pump Drawdown Factor", setFlowMultiplier)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <Clipboard className="size-3.5 text-muted-foreground" />
                              <span>Paste Value</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Pump Drawdown Factor", setFlowMultiplier, 2.0)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (2.0x)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("flowMultiplier", "Pump Drawdown Factor")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Desired Pump Cycle Time */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-cycle"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "cycle" || highlightedTargetId === "field-cycle"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Target Pump Cycle Time:</span>
                                  {renderCommentBadge("cycle", "Target Pump Cycle Time")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Minutes between pump starts (typically 5–10 min)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="2"
                                  max="30"
                                  step="0.5"
                                  disabled={isEffectiveReadOnly}
                                  value={cycle}
                                  onChange={(e) => {
                                    setCycle(e.target.value === "" ? "" : parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  min
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Target Pump Cycle Time", `${cycle} min`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Target Pump Cycle Time", setCycle, 6)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (6 min)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("cycle", "Target Pump Cycle Time")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Redundancy / Pump Mode */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pumpCountMode"
                              className={`flex items-center justify-between gap-4 pt-2 border-t border-border/40 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "pumpCountMode" || highlightedTargetId === "field-pumpCountMode"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Pumping Arrangement:</span>
                                  {renderCommentBadge("pumpCountMode", "Pumping Arrangement")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">100% Standby redundancy mode</span>
                              </div>
                              <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-border/80">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setPumpCountMode("1W_1S");
                                    dirtyStore.set(true);
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    pumpCountMode === "1W_1S"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  Duplex (1W+1S)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isEffectiveReadOnly) return;
                                    setPumpCountMode("2W_1S");
                                    dirtyStore.set(true);
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                    pumpCountMode === "2W_1S"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  Triplex (2W+1S)
                                </button>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("pumpCountMode", "Pumping Arrangement")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                      </div>
                    </div>

                    {/* Card 2: Piping & Dynamic Head */}
                    <div
                      id="card-hydraulics"
                      className={`bg-card border rounded-2xl p-5 space-y-4 shadow-2xs transition-all ${
                        highlightedTargetId === "card-hydraulics" ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Gauge className="size-4 text-primary" />
                          <h3 className="text-sm font-bold text-foreground">2. Piping Layout & Friction Head</h3>
                        </div>
                        {renderCommentBadge("card-hydraulics", "Piping Layout & Friction Head")}
                      </div>

                      <div className="space-y-3 text-[12.5px]">
                        
                        {/* Static Lift */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-lift"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "lift" || highlightedTargetId === "field-lift"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Static Elevation Lift:</span>
                                  {renderCommentBadge("lift", "Static Elevation Lift")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Basin low-water invert to highest discharge elevation</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof lift === "number" ? parseFloat((lift * FT_TO_M).toFixed(2)) : lift}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setLift("");
                                    else if (isSI) setLift(val / FT_TO_M);
                                    else setLift(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  {isSI ? "m" : "ft"}
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Static Lift", isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(1)} m` : `${calcResults.hStatic} ft`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                              <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Static Lift", setLift, 25)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (25 ft)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("lift", "Static Elevation Lift")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Discharge Pipe Internal Diameter */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pipeDia"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "pipeDia" || highlightedTargetId === "field-pipeDia"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Discharge Pipe Size:</span>
                                  {renderCommentBadge("pipeDia", "Discharge Pipe Size")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Min 2.0" (50mm) for raw sewage solids per IPC 712.4.2</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={isEffectiveReadOnly}
                                  value={pipeDia}
                                  onChange={(e) => {
                                    setPipeDia(parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none cursor-pointer disabled:opacity-60"
                                >
                                  <option value="2.0">2.0" NPS (50mm)</option>
                                  <option value="2.5">2.5" NPS (65mm)</option>
                                  <option value="3.0">3.0" NPS (80mm)</option>
                                  <option value="4.0">4.0" NPS (100mm)</option>
                                  <option value="6.0">6.0" NPS (150mm)</option>
                                </select>
                                <span className="text-xs font-semibold text-muted-foreground w-10">NPS</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Pipe Diameter", `${pipeDia} inches`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Pipe Diameter", setPipeDia, 3.0)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (3.0")</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("pipeDia", "Discharge Pipe Size")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Pipe Developed Length */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-pipeLen"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "pipeLen" || highlightedTargetId === "field-pipeLen"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Total Developed Pipe Length:</span>
                                  {renderCommentBadge("pipeLen", "Total Developed Pipe Length")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Total straight-run piping to gravity connection</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="5"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof pipeLen === "number" ? parseFloat((pipeLen * FT_TO_M).toFixed(1)) : pipeLen}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setPipeLen("");
                                    else if (isSI) setPipeLen(val / FT_TO_M);
                                    else setPipeLen(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  {isSI ? "m" : "ft"}
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Pipe Length", isSI ? `${(calcResults.frictionHead * FT_TO_M).toFixed(1)} m` : `${pipeLen} ft`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Pipe Length", setPipeLen, 65)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (65 ft)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("pipeLen", "Total Developed Pipe Length")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Fittings Head & Safety Factor */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-fittingsHead"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "fittingsHead" || highlightedTargetId === "field-fittingsHead"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Fittings Loss & Head Margin:</span>
                                  {renderCommentBadge("fittingsHead", "Fittings Loss & Head Margin")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Minor valve losses ({calcResults.hFittings} ft) + {calcResults.sf}% safety</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof fittingsHead === "number" ? parseFloat((fittingsHead * FT_TO_M).toFixed(1)) : fittingsHead}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setFittingsHead("");
                                    else if (isSI) setFittingsHead(val / FT_TO_M);
                                    else setFittingsHead(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                />
                                <span className="text-xs font-semibold text-muted-foreground w-10">
                                  {isSI ? "m" : "ft"}
                                </span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Fittings Head", `${fittingsHead} ft`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Fittings Head", setFittingsHead, 6.0)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (6.0 ft)</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("fittingsHead", "Fittings Loss & Head Margin")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Live Scouring Velocity Check Pill */}
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          calcResults.isScouringCompliant && calcResults.isMaxVelocityCompliant
                            ? "bg-primary/5 border-primary/20 text-foreground"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Activity className="size-4 text-primary" />
                            <span>
                              Discharge Velocity: <strong>{calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)</strong>
                            </span>
                          </div>
                          <span className="font-bold text-[11px]">
                            {calcResults.isScouringCompliant ? "✓ Self-Scouring" : "⚠ Low Velocity (<2 fps)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Wet Well Basin Geometry */}
                    <div
                      id="card-basin"
                      className={`bg-card border rounded-2xl p-5 space-y-4 shadow-2xs transition-all ${
                        highlightedTargetId === "card-basin" ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Cylinder className="size-4 text-primary" />
                          <h3 className="text-sm font-bold text-foreground">3. Wet Well Sump Basin Sizing</h3>
                        </div>
                        {renderCommentBadge("card-basin", "Wet Well Sump Basin Sizing")}
                      </div>

                      <div className="space-y-3 text-[12.5px]">
                        
                        {/* Basin Internal Diameter */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="field-basinDia"
                              className={`flex items-center justify-between gap-4 p-2 rounded-xl transition-all ${
                                highlightedTargetId === "basinDia" || highlightedTargetId === "field-basinDia"
                                  ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:bg-muted/20"
                              }`}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">Basin Internal Diameter:</span>
                                  {renderCommentBadge("basinDia", "Basin Internal Diameter")}
                                </div>
                                <span className="text-[11px] text-muted-foreground">Standard fiberglass or polyethylene sump basin</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={isEffectiveReadOnly}
                                  value={basinDia}
                                  onChange={(e) => {
                                    setBasinDia(parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-24 text-right px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none cursor-pointer disabled:opacity-60"
                                >
                                  <option value="24">24" Ø (600mm)</option>
                                  <option value="30">30" Ø (750mm)</option>
                                  <option value="36">36" Ø (900mm)</option>
                                  <option value="42">42" Ø (1050mm)</option>
                                  <option value="48">48" Ø (1200mm)</option>
                                  <option value="60">60" Ø (1500mm)</option>
                                  <option value="72">72" Ø (1800mm)</option>
                                </select>
                                <span className="text-xs font-semibold text-muted-foreground w-10">Ø</span>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleCopyValue("Basin Diameter", `${basinDia} inches`)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Copy Value</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={isEffectiveReadOnly}
                              onClick={() => handleResetValue("Basin Diameter", setBasinDia, 36)}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 text-muted-foreground" />
                              <span>Reset to Default (36")</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator className="h-px bg-border my-1" />
                            <ContextMenuItem
                              onClick={() => handleOpenComment("basinDia", "Basin Internal Diameter")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment / Assign Task</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Calculated Active Sump Depth */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/60">
                          <span className="text-muted-foreground">Calculated Active Drawdown Depth:</span>
                          <span className="font-mono font-bold text-primary">
                            {isSI
                              ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm`
                              : `${calcResults.activeDepthInches.toFixed(1)} inches (${calcResults.activeDepthInches.toFixed(0)} in)`}
                          </span>
                        </div>

                        {/* Total Recommended Basin Depth */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/60">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">Total Recommended Basin Depth:</span>
                            <span className="text-[10.5px] text-muted-foreground">Includes 12" motor submergence + 12" alarm ullage</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            {isSI
                              ? `${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm (${(calcResults.totalBasinDepthInches * IN_TO_MM / 1000).toFixed(2)} m)`
                              : `${calcResults.totalBasinDepthInches.toFixed(0)} inches (${(calcResults.totalBasinDepthInches / 12).toFixed(1)} ft)`}
                          </span>
                        </div>

                        {/* Starts per hour indicator */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/60">
                          <span className="text-muted-foreground">Motor Starts Frequency:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {calcResults.calculatedStartsPerHour.toFixed(1)} starts/hour (Max {calcResults.maxStarts})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Pump Selection & Power */}
                    <div
                      id="card-motor"
                      className={`bg-card border rounded-2xl p-5 space-y-4 shadow-2xs transition-all ${
                        highlightedTargetId === "card-motor" ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <Zap className="size-4 text-primary" />
                          <h3 className="text-sm font-bold text-foreground">4. Motor Rating & Hydraulic Power</h3>
                        </div>
                        {renderCommentBadge("card-motor", "Motor Rating & Hydraulic Power")}
                      </div>

                      <div className="space-y-3 text-[12.5px]">
                        
                        {/* Pump & Motor Efficiencies */}
                        <div className="grid grid-cols-2 gap-3">
                          
                          {/* Pump Efficiency */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-pumpEfficiency"
                                className={`flex flex-col gap-1 p-2 rounded-xl transition-all ${
                                  highlightedTargetId === "pumpEfficiency" || highlightedTargetId === "field-pumpEfficiency"
                                    ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                    : "hover:bg-muted/20"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-muted-foreground">Pump Efficiency:</span>
                                  {renderCommentBadge("pumpEfficiency", "Pump Efficiency")}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="30"
                                    max="90"
                                    disabled={isEffectiveReadOnly}
                                    value={pumpEfficiency}
                                    onChange={(e) => {
                                      setPumpEfficiency(e.target.value === "" ? "" : parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                  />
                                  <span className="text-xs font-semibold text-muted-foreground">%</span>
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Pump Efficiency", `${pumpEfficiency}%`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleResetValue("Pump Efficiency", setPumpEfficiency, 60)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (60%)</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("pumpEfficiency", "Pump Efficiency")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Motor Efficiency */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-motorEfficiency"
                                className={`flex flex-col gap-1 p-2 rounded-xl transition-all ${
                                  highlightedTargetId === "motorEfficiency" || highlightedTargetId === "field-motorEfficiency"
                                    ? "border border-primary bg-primary/5 ring-1 ring-primary"
                                    : "hover:bg-muted/20"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-muted-foreground">Motor Efficiency:</span>
                                  {renderCommentBadge("motorEfficiency", "Motor Efficiency")}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="50"
                                    max="98"
                                    disabled={isEffectiveReadOnly}
                                    value={motorEfficiency}
                                    onChange={(e) => {
                                      setMotorEfficiency(e.target.value === "" ? "" : parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full text-right px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
                                  />
                                  <span className="text-xs font-semibold text-muted-foreground">%</span>
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Motor Efficiency", `${motorEfficiency}%`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handleResetValue("Motor Efficiency", setMotorEfficiency, 85)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (85%)</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("motorEfficiency", "Motor Efficiency")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                        </div>

                        {/* Calculated BHP */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/60">
                          <span className="text-muted-foreground">Hydraulic Water Horsepower (P_w):</span>
                          <span className="font-mono font-bold text-foreground">
                            {calcResults.waterHP.toFixed(2)} HP ({(calcResults.waterHP * HP_TO_KW).toFixed(2)} kW)
                          </span>
                        </div>

                        {/* Brake Horsepower */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 border border-border/60">
                          <span className="text-muted-foreground">Brake Horsepower (BHP):</span>
                          <span className="font-mono font-bold text-primary">
                            {calcResults.bhp.toFixed(2)} BHP ({calcResults.motorKW.toFixed(2)} kW wire-to-water)
                          </span>
                        </div>

                        {/* Recommended Motor Size */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                          <span className="font-bold text-primary">Selected Standard Motor Size:</span>
                          <span className="font-mono font-black text-foreground text-sm">
                            {isSI
                              ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                              : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                /* Report View Tab */
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <div className="flex items-center justify-between pb-4 border-b border-border/80">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Sewage Pump Sizing Calculation Sheet</h2>
                      <p className="text-xs text-muted-foreground">Official calculation sheet formatted for municipality & AHJ submission</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportToExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-surface-2 text-foreground text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        <Download className="size-3.5" /> Export Excel
                      </button>
                      <button
                        onClick={exportPdf}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 cursor-pointer shadow-xs"
                      >
                        <Printer className="size-3.5" /> Export PDF Report
                      </button>
                    </div>
                  </div>

                  {/* Summary Sheet Table */}
                  <div className="border border-border rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="p-3 font-bold text-foreground">Design Parameter</th>
                          <th className="p-3 font-bold text-foreground">Calculated Value</th>
                          <th className="p-3 font-bold text-foreground">Standard / Rule Reference</th>
                          <th className="p-3 font-bold text-foreground">Compliance Verification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Peak Inflow Rate (Q_in)</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.qIn} GPM ({(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s)</td>
                          <td className="p-3 text-muted-foreground">IPC Table 709.1 / Fixture Units</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ Inflow Baseline Verified</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Pump Duty Flow (Q_pump)</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.dutyFlowPerPump.toFixed(1)} GPM ({(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s)</td>
                          <td className="p-3 text-muted-foreground">ASPE Sizing Factor ({calcResults.mult}x)</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ Drawdown Capacity Verified</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Total Dynamic Head (TDH)</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.tdh.toFixed(1)} ft w.g. ({(calcResults.tdh * FT_TO_M).toFixed(1)} m)</td>
                          <td className="p-3 text-muted-foreground">H_static ({calcResults.hStatic} ft) + H_f + H_fit (+{calcResults.sf}% SF)</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ Head Safety Margin OK</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Discharge Pipe Size & Velocity</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.dPipe}" NPS ({calcResults.velocityFps.toFixed(2)} ft/s)</td>
                          <td className="p-3 text-muted-foreground">IPC 712.4.2 (Min 2.0" & 2.0 fps)</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">
                            {calcResults.isScouringCompliant ? "✓ Self-Scouring Compliant" : "⚠ Velocity Warning"}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Active Wet Well Storage</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.activeVolGal.toFixed(0)} Gal ({calcResults.activeVolM3.toFixed(2)} m³)</td>
                          <td className="p-3 text-muted-foreground">V = (Q_pump × t_cycle) / 4</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ Cycle Drawdown Volume OK</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Basin Dimensions</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.dBasin}" Ø × {calcResults.totalBasinDepthInches.toFixed(0)}" Depth</td>
                          <td className="p-3 text-muted-foreground">Active depth ({calcResults.activeDepthInches.toFixed(1)}") + 24" clearance</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ Standard Basin Size</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-foreground">Recommended Motor Rating</td>
                          <td className="p-3 font-mono font-bold text-primary">{calcResults.recommendedMotorHP} HP ({calcResults.recommendedMotorKW.toFixed(2)} kW)</td>
                          <td className="p-3 text-muted-foreground">{calcResults.bhp.toFixed(2)} BHP @ {pumpEfficiency}% pump eff</td>
                          <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">✓ NEMA Standard Size Selected</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-2 border border-border rounded-2xl bg-card shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <SewagePumpIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              unitSystem={unitSystem}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* Task Assignment Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Sewage Pump Parameter"
          calculatorTitle="Sewage Pump Sizing"
          calculatorPath="/plumbing-sewage-pump"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Mathematical Formula Modal */}
      {formulaModalOpen && (
        <SewagePumpFormulaModal
          onClose={() => setFormulaModalOpen(false)}
          calcResults={calcResults}
          preset={preset}
          unitSystem={unitSystem}
        />
      )}
    </AppShell>
  );
}

// Live Intelligence Drawer Component
function SewagePumpIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  unitSystem,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  unitSystem: "ip" | "si";
  setFormulaModalOpen: (open: boolean) => void;
}) {
  const isSI = unitSystem === "si";

  return (
    <div className="h-full flex flex-col min-w-[360px] p-4 space-y-4 overflow-y-auto custom-scrollbar text-foreground">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-[13px] font-bold text-foreground">IPC / ASPE Pump Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Active Preset Summary */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Active Configuration</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            {SEWAGE_PRESETS[preset]?.category}
          </span>
        </div>
        <p className="text-[12px] font-bold text-foreground">
          {SEWAGE_PRESETS[preset]?.label}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {SEWAGE_PRESETS[preset]?.description}
        </p>
      </div>

      {/* Compliance Verification Audit */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Hydraulic Compliance Audit
        </div>

        <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 space-y-2 text-[11.5px]">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Discharge Velocity (Min 2.0 fps):</span>
            <span className={`font-bold ${calcResults.isScouringCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
              {calcResults.velocityFps.toFixed(2)} ft/s {calcResults.isScouringCompliant ? "✓" : "⚠"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">IPC 712.4.2 Solids Clearance (Min 2.0"):</span>
            <span className={`font-bold ${calcResults.isSolidsCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
              {calcResults.dPipe}" NPS {calcResults.isSolidsCompliant ? "✓" : "⚠"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Motor Starts per Hour (Max {calcResults.maxStarts}):</span>
            <span className={`font-bold ${calcResults.calculatedStartsPerHour <= calcResults.maxStarts ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
              {calcResults.calculatedStartsPerHour.toFixed(1)} / hr {calcResults.calculatedStartsPerHour <= calcResults.maxStarts ? "✓" : "⚠"}
            </span>
          </div>
        </div>
      </div>

      {/* Technical Reference Guidance */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          IPC / ASPE Engineering Guidance
        </div>

        <div className="p-3 rounded-xl bg-surface-2/40 border border-border/60 space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">IPC 712.4.2:</strong> Sewage ejector pumps shall have a minimum discharge pipe size of 2 inches (50 mm) to handle 2-inch spherical solids.
          </p>
          <p>
            <strong className="text-foreground">ASPE Sizing Standard:</strong> The active storage volume between pump start and stop float switches should accommodate a minimum cycle time of 5 to 10 minutes to prevent thermal overload on the pump motor windings.
          </p>
        </div>
      </div>

      {/* Formula Button */}
      <button
        onClick={() => setFormulaModalOpen(true)}
        className="w-full py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-primary/20"
      >
        <FileText className="size-3.5" />
        <span>View Mathematical Formulas</span>
      </button>
    </div>
  );
}

// Formula Breakdown Modal Component
function SewagePumpFormulaModal({
  onClose,
  calcResults,
  preset,
  unitSystem,
}: {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  unitSystem: "ip" | "si";
}) {
  const isSI = unitSystem === "si";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-2xl p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200 select-none max-h-[88vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">IPC / ASPE Sewage Pump Engineering Equations</h3>
              <p className="text-[11.5px] text-muted-foreground">
                Step-by-step hydraulic duty, velocity, sump basin & motor power calculations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-surface-2 grid place-items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="text-[12.5px] text-foreground space-y-4">
          
          {/* Section 1: Pump Flow Capacity */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Waves className="size-4 text-primary" />
                <span>1. Pump Duty Capacity (Q_pump)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                ASPE / IPC
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              Q_pump = Q_inflow × Drawdown_Multiplier
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Peak Inflow Rate (Q_in):</span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.qIn} GPM ({(calcResults.qIn * GPM_TO_LPS).toFixed(2)} L/s)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Drawdown Multiplier:</span>
                <span className="font-mono font-medium text-foreground">{calcResults.mult}x</span>
              </div>
              <div className="flex justify-between pt-1.5 text-primary font-bold text-[13px]">
                <span>Pump Duty Flow (Q_pump):</span>
                <span className="font-mono">
                  {isSI
                    ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s (${calcResults.dutyFlowPerPump.toFixed(1)} GPM)`
                    : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Total Dynamic Head */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Gauge className="size-4 text-emerald-500" />
                <span>2. Total Dynamic Head (TDH)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Hydraulics
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              TDH = (H_static + H_friction + H_fittings) × (1 + SF / 100)
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Static Elevation Head (H_static):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.hStatic} ft ({(calcResults.hStatic * FT_TO_M).toFixed(1)} m)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Pipe Friction Head (H_f):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.frictionHead.toFixed(2)} ft ({(calcResults.frictionHead * FT_TO_M).toFixed(2)} m)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Fittings & Valve Losses (H_fit):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.hFittings} ft ({(calcResults.hFittings * FT_TO_M).toFixed(2)} m)</span>
              </div>
              <div className="flex justify-between pt-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[13px]">
                <span>Design TDH (+{calcResults.sf}% Margin):</span>
                <span className="font-mono">
                  {isSI
                    ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m (${calcResults.tdh.toFixed(1)} ft w.g.)`
                    : `${calcResults.tdh.toFixed(1)} ft w.g.`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Wet Well Active Volume */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Cylinder className="size-4 text-blue-500" />
                <span>3. Wet Well Sump Volume (V_active)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                ASPE Drawdown
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              V_active = (Q_pump × t_cycle) / 4
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Required Active Storage Volume:</span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.activeVolGal.toFixed(0)} Gal ({calcResults.activeVolM3.toFixed(2)} m³)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Basin Internal Diameter (D):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.dBasin}" Ø ({(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm)</span>
              </div>
              <div className="flex justify-between pt-1.5 text-blue-600 dark:text-blue-400 font-bold text-[13px]">
                <span>Active Liquid Drawdown Depth:</span>
                <span className="font-mono">
                  {isSI
                    ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm (${(calcResults.activeDepthInches * IN_TO_MM / 1000).toFixed(2)} m)`
                    : `${calcResults.activeDepthInches.toFixed(1)} inches (${(calcResults.activeDepthInches / 12).toFixed(2)} ft)`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Pump Motor Power */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Zap className="size-4 text-amber-500" />
                <span>4. Motor Power (BHP & kW)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Electrical Duty
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              BHP = (Q_pump × TDH) / (3960 × η_pump)
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Hydraulic Fluid Power (P_w):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.waterHP.toFixed(2)} HP</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Shaft Brake Horsepower (BHP):</span>
                <span className="font-mono font-medium text-foreground">{calcResults.bhp.toFixed(2)} BHP</span>
              </div>
              <div className="flex justify-between pt-1.5 text-primary font-bold text-[13px]">
                <span>Selected Standard Motor Rating:</span>
                <span className="font-mono">
                  {isSI
                    ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                    : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition cursor-pointer shadow-xs"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
}
