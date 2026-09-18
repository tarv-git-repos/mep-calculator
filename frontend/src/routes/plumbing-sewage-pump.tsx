import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
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
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight, Lightbulb
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
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");

  // Calculation review state listener
  useEffect(() => {
    const handleReviewUpdate = (e: any) => {
      if (e?.detail) {
        setCalcReviewState(e.detail);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mep-review-state-updated", handleReviewUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mep-review-state-updated", handleReviewUpdate);
      }
    };
  }, []);

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

  // Comments & Task State (matching Preliminary Cooling Load & Ventilation)
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

  // Scroll and highlight notification target item (matching Ventilation & Preliminary Cooling Load)
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");
      const cleanName = (targetName || "").toLowerCase().trim();

      const el = document.getElementById(targetId || "") ||
                 document.getElementById(`field-${cleanRaw}`) ||
                 document.getElementById(`card-${cleanRaw}`) ||
                 document.getElementById(`field-${targetId}`) ||
                 document.getElementById(`card-${targetId}`) ||
                 document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
                 document.querySelector(`[data-field-id="${targetId}"]`) ||
                 document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
                 document.querySelector(`[data-comment-target="${targetId}"]`);

      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTargetId(null);
        highlightTimeoutRef.current = null;
      }, 4500);

      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
    };

    // 1. Check URL parameters on mount / location change
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

    // 2. Listen to custom event from Notification Center navigation
    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        handleScrollTarget(detail.id || detail.targetId, detail.name || detail.targetName);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [typeof window !== "undefined" ? window.location.search : ""]);

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

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "inflow";
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || "Sewage Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Sewage Pump Parameter",
      calculatorTitle: "Sewage Pump Sizing",
      calculatorPath: "/plumbing-sewage-pump",
      projectId: project?.id || "default",
      projectName: project?.name || "Sanitary Lift Station",
    };

    const existingIndex = commentsList.findIndex((c) => c.id === commentData.id);
    let updated: any[];
    if (existingIndex >= 0) {
      updated = [...commentsList];
      updated[existingIndex] = commentWithMeta;
    } else {
      updated = [commentWithMeta, ...commentsList.filter((c) => c.id !== commentData.id)];
    }
    saveComments(updated);

    if (commentData.assignedTo && commentData.assignedTo.length > 0) {
      notifyCommentAssigned(
        commentData.assignedTo,
        "Sewage Pump Sizing",
        targetName,
        commentData.text || "",
        "/plumbing-sewage-pump",
        targetId
      );
    } else {
      dispatchGlobalCommentNotification(
        "Sewage Pump Sizing",
        targetName,
        commentData.text || "",
        "/plumbing-sewage-pump",
        targetId
      );
    }
    toast.success(`Comment / task assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const getItemComments = (id: string) => {
    if (!id) return [];
    const clean = id.toLowerCase().trim();
    const cleanRaw = clean.replace(/^(field-|card-)/, "");

    return commentsList.filter((c) => {
      if (!c) return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim();
      const tIdRaw = tId.replace(/^(field-|card-)/, "");

      if (
        tId === clean ||
        tId === `field-${clean}` ||
        `field-${tId}` === clean ||
        tId === `card-${clean}` ||
        `card-${tId}` === clean ||
        (cleanRaw && tIdRaw === cleanRaw)
      ) {
        return true;
      }

      const tName = String(c.targetName || c.spaceName || "").toLowerCase().trim();
      if (!tName) return false;

      if ((cleanRaw === "inflow") && (tName.includes("inflow") || tName.includes("peak sewage"))) return true;
      if ((cleanRaw === "flowmultiplier") && (tName.includes("drawdown") || tName.includes("multiplier"))) return true;
      if ((cleanRaw === "cycle") && (tName.includes("cycle") || tName.includes("target cycle"))) return true;
      if ((cleanRaw === "pumpcountmode" || cleanRaw === "pumpingarrangement") && (tName.includes("arrangement") || tName.includes("duplex") || tName.includes("triplex") || tName.includes("pumping"))) return true;
      if ((cleanRaw === "lift") && (tName.includes("lift") || tName.includes("static elevation"))) return true;
      if ((cleanRaw === "pipedia") && (tName.includes("pipe size") || tName.includes("pipe diameter") || tName.includes("discharge pipe"))) return true;
      if ((cleanRaw === "pipelen") && (tName.includes("pipe length") || tName.includes("developed pipe") || tName.includes("total developed"))) return true;
      if ((cleanRaw === "fittingshead") && (tName.includes("fittings") || tName.includes("valve loss") || tName.includes("head margin"))) return true;
      if ((cleanRaw === "basindia") && (tName.includes("basin") || tName.includes("wet well") || tName.includes("diameter"))) return true;
      if ((cleanRaw === "pumpefficiency") && (tName.includes("pump efficiency") || tName.includes("hydraulic efficiency"))) return true;
      if ((cleanRaw === "motorefficiency") && (tName.includes("motor efficiency") || tName.includes("electrical efficiency"))) return true;
      if ((cleanRaw === "presets" || cleanRaw === "card-presets") && (tName.includes("preset") || tName.includes("profile"))) return true;
      if ((cleanRaw === "hero-results" || cleanRaw === "card-hero-results" || cleanRaw === "results") && (tName.includes("summary") || tName.includes("sizing summary") || tName.includes("results"))) return true;
      if ((cleanRaw === "inflow-card" || cleanRaw === "card-inflow") && (tName.includes("drainage inflow") || tName.includes("inflow & pumping"))) return true;
      if ((cleanRaw === "hydraulics" || cleanRaw === "card-hydraulics") && (tName.includes("piping layout") || tName.includes("friction head"))) return true;
      if ((cleanRaw === "basin-card" || cleanRaw === "card-basin") && (tName.includes("sump basin") || tName.includes("wet well sump"))) return true;
      if ((cleanRaw === "motor-card" || cleanRaw === "card-motor") && (tName.includes("motor rating") || tName.includes("hydraulic power"))) return true;

      return false;
    });
  };

  const isFieldHighlighted = (id: string, label?: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    const cleanId = id.toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-)/, "");
    const cleanHighlightRaw = cleanHighlight.replace(/^(field-|card-)/, "");

    if (
      cleanHighlight === cleanId ||
      cleanHighlight === `field-${cleanId}` ||
      cleanHighlight === `card-${cleanId}` ||
      cleanHighlightRaw === cleanRawId
    ) {
      return true;
    }

    if (label && cleanHighlight.length > 2) {
      const cleanLabel = label.toLowerCase();
      if (cleanLabel.includes(cleanHighlight) || cleanHighlight.includes(cleanLabel)) {
        return true;
      }
    }
    return false;
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

  // Preset switch handler
  const handleApplyPreset = (key: SewagePresetKey) => {
    if (isEffectiveReadOnly) return;
    const p = SEWAGE_PRESETS[key];
    setPreset(key);
    setInflow(p.inflow);
    setCycle(p.cycle);
    setStarts(p.starts);
    setLift(p.lift);
    setPipeDia(p.pipeDia);
    setPipeLen(p.pipeLen);
    setFittingsHead(p.fittingsHead);
    setSafetyFactor(p.safetyFactor);
    setBasinDia(p.basinDia);
    dirtyStore.set(true);
    toast.success(`Preset applied: ${p.label}`);
  };

  // Unit toggle handler
  const handleUnitSystemChange = (nextSystem: "ip" | "si") => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(nextSystem);
    dirtyStore.set(true);
  };

  // Clipboard & Reset Handlers
  const handleCopyValue = (label: string, val: any) => {
    navigator.clipboard.writeText(String(val));
    toast.success(`Copied ${label}: ${val}`);
  };

  const handlePasteValue = async (label: string, setter: (val: number) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num)) {
        setter(num);
        dirtyStore.set(true);
        toast.success(`Pasted ${label}: ${num}`);
      } else {
        toast.error("Clipboard does not contain a valid number");
      }
    } catch (e) {
      toast.error("Failed to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defVal: any) => {
    setter(defVal);
    dirtyStore.set(true);
    toast.info(`Reset ${label} to default: ${defVal}`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    setter("");
    dirtyStore.set(true);
    toast.info(`Cleared ${label}`);
  };

  // ==========================================
  // HYDRAULIC & SEWAGE SIZING CALCULATIONS
  // ==========================================
  const calcResults = useMemo(() => {
    const qIn = typeof inflow === "number" ? inflow : 50;
    const mult = typeof flowMultiplier === "number" ? flowMultiplier : 2.0;
    const tCycle = typeof cycle === "number" ? cycle : 6;
    const maxStarts = typeof starts === "number" ? starts : 6;
    const hStatic = typeof lift === "number" ? lift : 25;
    const dPipe = typeof pipeDia === "number" ? pipeDia : 3.0;
    const lPipe = typeof pipeLen === "number" ? pipeLen : 65;
    const hFittings = typeof fittingsHead === "number" ? fittingsHead : 6.0;
    const sf = typeof safetyFactor === "number" ? safetyFactor : 15;
    const dBasin = typeof basinDia === "number" ? basinDia : 36;
    const effP = typeof pumpEfficiency === "number" ? pumpEfficiency / 100 : 0.6;
    const effM = typeof motorEfficiency === "number" ? motorEfficiency / 100 : 0.85;

    // 1. Pump Duty Flow Rate (Q_pump)
    const dutyFlowPerPump = qIn * mult;
    const totalWorkingFlow = pumpCountMode === "2W_1S" ? dutyFlowPerPump * 2 : dutyFlowPerPump;

    // 2. Discharge Pipe Velocity (v)
    const pipeAreaSqFt = (Math.PI * Math.pow(dPipe / 24, 2));
    const flowCfs = (dutyFlowPerPump * 0.13368) / 60;
    const velocityFps = pipeAreaSqFt > 0 ? flowCfs / pipeAreaSqFt : 0;
    const velocityMs = velocityFps * FT_TO_M;

    // 3. Friction Head Loss (H_f) via Hazen-Williams (C=120 for PVC/Cast Iron sewage pipe)
    const C = 120;
    const frictionHead =
      dPipe > 0
        ? 0.002083 * lPipe * Math.pow(100 / C, 1.852) * (Math.pow(dutyFlowPerPump, 1.852) / Math.pow(dPipe, 4.8655))
        : 0;

    // 4. Total Dynamic Head (TDH)
    const totalDynamicLosses = hStatic + frictionHead + hFittings;
    const tdh = totalDynamicLosses * (1 + sf / 100);

    // 5. Active Wet Well Storage Volume (V_active)
    const activeVolGal = (dutyFlowPerPump * tCycle) / 4;
    const activeVolM3 = activeVolGal * GAL_TO_M3;
    const activeVolL = activeVolGal * GAL_TO_L;

    // 6. Basin Liquid Depth & Geometry
    const basinRadiusFt = dBasin / 24;
    const basinAreaSqFt = Math.PI * Math.pow(basinRadiusFt, 2);
    const activeVolCuFt = activeVolGal * 0.13368;
    const activeDepthFt = basinAreaSqFt > 0 ? activeVolCuFt / basinAreaSqFt : 0;
    const activeDepthInches = activeDepthFt * 12;
    const totalBasinDepthInches = activeDepthInches + 24;

    // 7. Power Requirements & Motor Selection
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
    const isScouringCompliant = velocityFps >= 2.0;
    const isMaxVelocityCompliant = velocityFps <= 8.0;
    const isSolidsCompliant = dPipe >= 2.0;
    const calculatedStartsPerHour = tCycle > 0 ? 60 / tCycle : 0;

    return {
      qIn,
      mult,
      tCycle,
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

  // Export to PDF (matching Ventilation & MEP standard)
  const exportPdf = () => {
    try {
      const isSI = unitSystem === "si";
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        } else {
          console.error("autoTable function not available");
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-SEW-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Sanitary Lift Station";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title (matching Ventilation)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sewage Pump Sizing Calculation Report", 14, 13);

      // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm, height 17mm)
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17); // Outer box for metadata

      // Vertical line to separate left/right metadata
      doc.line(105, 16, 105, 33);

      // Horizontal lines
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 125, 31.6);

      // Color palette matching Ventilation
      const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard headers
      const blueFill = [218, 233, 248] as [number, number, number];    // Blue for key calculated totals
      const signatureFill = [255, 230, 204] as [number, number, number]; // Peach for signatures

      // Table 1: Design Parameters & Inflow Criteria
      const paramTableBody = [
        ["1", "Peak Sanitary Sewage Inflow Rate (Q_in)", isSI ? `${(calcResults.qIn * GPM_TO_LPS).toFixed(2)}` : `${calcResults.qIn.toFixed(1)}`, isSI ? "L/s" : "GPM", "IPC Table 709.1 Sanitary Drainage Load"],
        ["2", "Pump Drawdown Factor (Multiplier)", `${calcResults.mult.toFixed(2)}`, "x", "ASPE Sizing Guide (1.5x - 2.0x Peak Inflow)"],
        ["3", "Target Pump Cycle Time (t)", `${calcResults.tCycle.toFixed(1)}`, "min", "Typical 5 - 10 min Cycle Interval"],
        ["4", "Maximum Motor Starts Frequency", `${calcResults.maxStarts}`, "starts/hr", "NEMA MG-1 Maximum Submersible Starts Limit"],
        ["5", "Static Elevation Lift (H_static)", isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(2)}` : `${calcResults.hStatic.toFixed(1)}`, isSI ? "m" : "ft", "Basin Invert to Gravity Discharge Invert"],
        ["6", "Discharge Pipe Diameter (D)", isSI ? `${(calcResults.dPipe * IN_TO_MM).toFixed(0)}` : `${calcResults.dPipe.toFixed(1)}`, isSI ? "mm" : 'in NPS', 'IPC 712.4.2 Solids Clearance (Min 2" / 3")'],
        ["7", "Total Developed Discharge Pipe Length (L)", isSI ? `${(pipeLen * FT_TO_M).toFixed(1)}` : `${pipeLen.toFixed(1)}`, isSI ? "m" : "ft", "Isometric Developed Piping Run"],
        ["8", "Fittings & Valves Equivalent Loss", isSI ? `${(calcResults.hFittings * FT_TO_M).toFixed(2)}` : `${calcResults.hFittings.toFixed(1)}`, isSI ? "m" : "ft", "Check Valve, Gate Valve, 90 deg Bends"],
        ["9", "Wet Well Basin Internal Diameter", isSI ? `${(calcResults.dBasin * IN_TO_MM).toFixed(0)}` : `${calcResults.dBasin.toFixed(1)}`, isSI ? "mm dia." : 'in dia.', "Duplex Submersible Clearances"],
        ["10", "Hydraulic Head Safety Margin", `+${calcResults.sf.toFixed(1)}`, "%", "Friction Age, Slime & Minor Losses Margin"]
      ];

      callAutoTable(doc, {
        startY: 35,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.3, bottom: 1.3, left: 1.2, right: 1.2 },
          minCellHeight: 4.8
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 68, fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
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
        body: paramTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 88;

      // Table 2: Hydraulic Sizing Output Summary (IPC / ASPE 7)
      const resultsTableBody = [
        [
          "A",
          "REQUIRED PUMP DUTY FLOW (Q_pump)",
          isSI
            ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s (${(calcResults.dutyFlowPerPump * GPM_TO_LMIN).toFixed(0)} L/min)`
            : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`,
          "Q_pump = Q_in x Drawdown Multiplier"
        ],
        [
          "B",
          "Discharge Fluid Velocity (v)",
          isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`,
          calcResults.isScouringCompliant ? "Compliant (>= 2.0 fps Self-Scouring per IPC 712.4)" : "Below 2.0 fps (Warning)"
        ],
        [
          "C",
          "Hazen-Williams Friction Head (H_f)",
          isSI ? `${(calcResults.frictionHead * FT_TO_M).toFixed(2)} m` : `${calcResults.frictionHead.toFixed(2)} ft`,
          "Hazen-Williams Equation (C = 120)"
        ],
        [
          "D",
          "TOTAL DYNAMIC HEAD (TDH)",
          isSI
            ? `${(calcResults.tdh * FT_TO_M).toFixed(2)} m w.g. (${(calcResults.tdh * 0.02989).toFixed(2)} bar)`
            : `${calcResults.tdh.toFixed(1)} ft w.g.`,
          `TDH = (H_static + H_f + H_fittings) x (1 + ${calcResults.sf}%)`
        ],
        [
          "E",
          "ACTIVE WET WELL SUMP VOLUME (V_active)",
          isSI
            ? `${calcResults.activeVolM3.toFixed(2)} m3 (${calcResults.activeVolL.toFixed(0)} L)`
            : `${calcResults.activeVolGal.toFixed(0)} Gal`,
          `V = (Q_pump x ${calcResults.tCycle} min) / 4 (ASPE Formula)`
        ],
        [
          "F",
          "Active Liquid Drawdown Depth",
          isSI ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.activeDepthInches.toFixed(1)} inches`,
          "Liquid depth between Start and Stop floats"
        ],
        [
          "G",
          "Total Wet Well Basin Depth",
          isSI ? `${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.totalBasinDepthInches.toFixed(0)} inches`,
          'Active Depth + 12" Submergence + 12" High-Alarm'
        ],
        [
          "H",
          "Calculated Pump Brake Horsepower (BHP)",
          `${calcResults.bhp.toFixed(2)} BHP (${(calcResults.bhp * HP_TO_KW).toFixed(2)} kW)`,
          `@ ${pumpEfficiency}% Pump Efficiency`
        ],
        [
          "I",
          "RECOMMENDED MOTOR POWER RATING",
          isSI
            ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
            : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`,
          "NEMA Standard Heavy-Duty Submersible Motor"
        ],
        [
          "J",
          "Pumping Redundancy Configuration",
          pumpCountMode === "1W_1S" ? "1 Duty + 1 Standby (Duplex)" : "2 Duty + 1 Standby (Triplex)",
          "100% Standby Redundancy for Sanitary Reliability"
        ]
      ];

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.3, bottom: 1.3, left: 1.2, right: 1.2 },
          minCellHeight: 4.8
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 74, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 52 }
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Sizing Output Summary (IPC / ASPE 7)", styles: { fillColor: primaryFill } },
            { content: "Calculated Result", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Criteria", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight key outputs (Row A, D, E, I) in blueFill
            if (data.row.index === 0 || data.row.index === 3 || data.row.index === 4 || data.row.index === 8) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 7.8;
              }
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 144;

      // Table 3: Mandatory Engineering Guidelines & IPC / ASPE Compliance Notes
      const notesTableBody = [
        ["1", "IPC 712.4.2 Velocity Limit", "Discharge piping flow velocity must be maintained between 2.0 ft/s (0.61 m/s) minimum for self-scouring and 8.0 ft/s (2.44 m/s) maximum to prevent water hammer."],
        ["2", "IPC 712.4.1 Solids Handling", 'Sewage ejector pump must be capable of passing spherical solids of minimum 2.0 inches (51 mm) diameter for sanitary water closet drainage.'],
        ["3", "ASPE Volume Formula", "Active wet well storage volume V = (Q x t)/4 ensures motor starts do not exceed manufacturer limits and avoids frequent short-cycling."],
        ["4", "Wet Well Clearances", 'Wet well depth includes 12" minimum motor submergence cushion below stop float for motor cooling and 12" freeboard to high-water alarm float.'],
        ["5", "Duplex Redundancy", "Sanitary lift stations serving multiple fixtures require duplex pumps operating in automatic alternation with 100% standby backup."]
      ];

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 6.8,
          halign: "left",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 },
          minCellHeight: 4.2
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.3, bottom: 1.3, left: 1, right: 1 }
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 46, fontStyle: "bold" },
          2: { cellWidth: 126 }
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill, halign: "center" } },
            { content: "Mandatory Design Standard", styles: { fillColor: primaryFill } },
            { content: "Compliance & Engineering Criteria", styles: { fillColor: primaryFill } }
          ]
        ],
        body: notesTableBody
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 180;

      // 3-Tier Signature Block (Originated by, Reviewed by, Approved by)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-sewage-pump", currentUserName);

      callAutoTable(doc, {
        startY: finalY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
          minCellHeight: 5
        },
        headStyles: {
          fillColor: signatureFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 }
        },
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

      doc.save(`Sewage_Pump_Sizing_${(project?.name || "Lift_Station").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
      toast.success("Sewage Pump Sizing PDF report exported successfully!");
    } catch (error: any) {
      console.error("exportPdf error:", error);
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
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
      ws.addRow([`Date: ${formatDateStr(new Date())}`]);
      ws.addRow([`Preset: ${SEWAGE_PRESETS[preset]?.label}`]);
      ws.addRow([]);

      ws.addRow(["Parameter", "Calculated Value", "Unit", "Formula / Standard", "Remarks"]);
      const headerRow = ws.getRow(7);
      headerRow.font = { bold: true, color: { argb: "FF000000" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };

      const excelRows = [
        ["Peak Inflow Rate (Q_in)", isSI ? (calcResults.qIn * GPM_TO_LPS).toFixed(2) : calcResults.qIn, isSI ? "L/s" : "GPM", "User Input", "Peak sanitary drainage inflow"],
        ["Pump Drawdown Factor", calcResults.mult, "Multiplier", "ASPE Recommendation", "1.5x - 2.0x peak inflow factor"],
        ["Pump Duty Flow (Each)", isSI ? (calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2) : calcResults.dutyFlowPerPump.toFixed(1), isSI ? "L/s" : "GPM", "Q_in × Factor", "Single pump design duty flow"],
        ["Pumping Mode", pumpCountMode === "1W_1S" ? "Duplex (1W+1S)" : "Triplex (2W+1S)", "-", "Design Specification", "Standby redundancy configuration"],
        ["Static Elevation Lift", isSI ? (calcResults.hStatic * FT_TO_M).toFixed(1) : calcResults.hStatic, isSI ? "m" : "ft", "Basin Invert to Discharge", "Physical elevation lift height"],
        ["Discharge Pipe Size", isSI ? (calcResults.dPipe * IN_TO_MM).toFixed(0) : calcResults.dPipe, isSI ? "mm" : "inches", "IPC 712.4.2", 'Min 2.0" for raw sewage solids'],
        ["Discharge Fluid Velocity", isSI ? calcResults.velocityMs.toFixed(2) : calcResults.velocityFps.toFixed(2), isSI ? "m/s" : "ft/s", "Q / Area", calcResults.isScouringCompliant ? "Self-scouring (≥2 fps)" : "Low velocity warning"],
        ["Total Dynamic Head (TDH)", isSI ? (calcResults.tdh * FT_TO_M).toFixed(1) : calcResults.tdh.toFixed(1), isSI ? "m" : "ft", "H_stat + H_f + H_fit (+SF)", `Total head with ${calcResults.sf}% margin`],
        ["Active Sump Storage Volume", isSI ? calcResults.activeVolM3.toFixed(2) : calcResults.activeVolGal.toFixed(0), isSI ? "m³" : "Gal", "(Q_pump × t_cycle) / 4", "Volume between start and stop levels"],
        ["Basin Dimensions", isSI ? `${(calcResults.dBasin * IN_TO_MM).toFixed(0)} mm Ø × ${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.dBasin}" Ø × ${calcResults.totalBasinDepthInches.toFixed(0)}"`, "-", "Geometry", "Diameter × Total Required Depth"],
        ["Active Liquid Depth", isSI ? (calcResults.activeDepthInches * IN_TO_MM).toFixed(0) : calcResults.activeDepthInches.toFixed(1), isSI ? "mm" : "inches", "V_active / Basin_Area", "Liquid level rise between pump start/stop"],
        ["Estimated Motor Power", isSI ? calcResults.motorKW.toFixed(2) : calcResults.bhp.toFixed(2), isSI ? "kW" : "BHP", "BHP / Motor_Eff", "Calculated wire-to-water shaft power"],
        ["Recommended Motor Size", isSI ? calcResults.recommendedMotorKW.toFixed(2) : calcResults.recommendedMotorHP, isSI ? "kW" : "HP", "Standard Rating", "Selected commercial standard motor rating"],
      ];

      excelRows.forEach((r) => ws.addRow(r));

      // Append 3-tier signature block to Excel
      addExcelSignatureBlock(ws, ws.rowCount + 3, currentUserName, project?.id || "default", "/plumbing-sewage-pump", 5);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Sewage_Pump_Sizing_${pName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
      toast.success("Excel calculation sheet exported!");
    } catch (error: any) {
      console.error("exportToExcel error:", error);
      toast.error(`Export Excel failed: ${error?.message || String(error)}`);
    }
  };

  return (
    <>
    <AppShell
      title="Sewage Pump Sizing"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Sewage Pump Sizing</h1>
              </div>
              <button 
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                  intelOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                }`}
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-sewage-pump" calculatorTitle="Sewage Pump Sizing" onReviewStateChange={setCalcReviewState} />
              {commentsList.length > 0 && (
                <div 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active task(s)/comment(s)`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"}</span>
                </div>
              )}
            </div>
          </div>

          {/* White Card Container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pump Sizer
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View IPC / ASPE Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
              </div>

              {/* Sizing Unit system toggle */}
              <UnitToggle
                unitSystem={unitSystem}
                onChange={handleUnitSystemChange}
                disabled={isEffectiveReadOnly}
                inputDescriptions="Flow Rate (GPM / L/s), Head (ft / m), Sump Volume (Gal / m³), Motor Power (HP / kW)"
                conversionExample={
                  unitSystem === "ip"
                    ? "Convert 50 GPM → 3.15 L/s, 25 ft → 7.62 m, 120 Gal → 0.45 m³"
                    : "Convert 3.15 L/s → 50 GPM, 7.62 m → 25 ft, 0.45 m³ → 120 Gal"
                }
              />
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  
                  {/* Presets Quick Picker Bar */}
                  <div
                    id="card-presets"
                    data-field-id="presets"
                    data-comment-target="presets"
                    className={`rounded-2xl p-4 transition-all duration-300 ${
                      isFieldHighlighted("card-presets", "Sewage Sizing Presets")
                        ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                        : "bg-muted/20 border border-border/70 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-primary" />
                        <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide">
                          Quick Design Presets & Application Profiles
                        </span>
                        {renderCommentBadge("card-presets", "Sewage Sizing Presets")}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">
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
                            } ${isEffectiveReadOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <div className="text-[11.5px] font-bold truncate">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.inflow} GPM ({p.lift} ft lift)</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Grid: Inputs (Left) & Results Summary (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: PARAMETERS */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* CARD 1: INFLOW & PUMPING DUTY */}
                      <div
                        id="card-inflow"
                        data-field-id="card-inflow"
                        data-comment-target="card-inflow"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-inflow", "Drainage Inflow & Pumping Factor")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Droplets className="size-4 text-primary" /> 1. Drainage Inflow & Pumping Factor
                            </span>
                            {renderCommentBadge("card-inflow", "Drainage Inflow & Pumping Factor")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            IPC 709 / ASPE
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* Peak Inflow */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-inflow"
                                data-field-id="inflow"
                                data-comment-target="inflow"
                                className={`p-3 rounded-xl border transition-all ${
                                  isFieldHighlighted("inflow", "Peak Sewage Inflow Rate")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Peak Sewage Inflow Rate ({isSI ? "L/s" : "GPM"})
                                  </label>
                                  {renderCommentBadge("inflow", "Peak Sewage Inflow Rate")}
                                </div>
                                <div className="relative">
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder="e.g. 50"
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Total continuous peak sanitary inflow to wet well
                                </span>
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

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Pump Drawdown Factor */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-flowMultiplier"
                                  data-field-id="flowMultiplier"
                                  data-comment-target="flowMultiplier"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("flowMultiplier", "Pump Drawdown Factor")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Drawdown Factor (Multiplier)
                                    </label>
                                    {renderCommentBadge("flowMultiplier", "Pump Drawdown Factor")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    ASPE recommends 1.5x - 2.0x peak inflow
                                  </span>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Pump Drawdown Factor", flowMultiplier)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
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
                                  data-field-id="cycle"
                                  data-comment-target="cycle"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("cycle", "Target Pump Cycle Time")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Target Cycle Time (min)
                                    </label>
                                    {renderCommentBadge("cycle", "Target Pump Cycle Time")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Minutes between starts (typ. 5–10 min)
                                  </span>
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
                          </div>

                          {/* Pumping Arrangement */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-pumpingArrangement"
                                data-field-id="pumpingArrangement"
                                data-comment-target="pumpingArrangement"
                                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                  isFieldHighlighted("pumpingArrangement", "Pumping Arrangement")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-foreground">Pumping Arrangement</span>
                                    {renderCommentBadge("pumpingArrangement", "Pumping Arrangement")}
                                  </div>
                                  <span className="text-[10.5px] text-muted-foreground">100% Standby redundancy mode</span>
                                </div>
                                <div className="flex gap-1 bg-surface-2 p-1 rounded-xl border border-border/80">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isEffectiveReadOnly) return;
                                      setPumpCountMode("1W_1S");
                                      dirtyStore.set(true);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                                onClick={() => handleCopyValue("Pumping Arrangement", pumpCountMode === "1W_1S" ? "Duplex (1W+1S)" : "Triplex (2W+1S)")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("pumpingArrangement", "Pumping Arrangement")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* CARD 2: PIPING & DYNAMIC HEAD */}
                      <div
                        id="card-hydraulics"
                        data-field-id="card-hydraulics"
                        data-comment-target="card-hydraulics"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-hydraulics", "Piping Layout & Friction Head")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Gauge className="size-4 text-primary" /> 2. Piping Layout & Friction Head
                            </span>
                            {renderCommentBadge("card-hydraulics", "Piping Layout & Friction Head")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            IPC 712.4
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Static Lift */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-lift"
                                  data-field-id="lift"
                                  data-comment-target="lift"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("lift", "Static Elevation Lift")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Static Elevation Lift ({isSI ? "m" : "ft"})
                                    </label>
                                    {renderCommentBadge("lift", "Static Elevation Lift")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Basin invert to highest discharge point
                                  </span>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Static Lift", isSI ? `${(calcResults.hStatic * FT_TO_M).toFixed(1)} m` : `${calcResults.hStatic} ft`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
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

                            {/* Discharge Pipe Diameter */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-pipeDia"
                                  data-field-id="pipeDia"
                                  data-comment-target="pipeDia"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("pipeDia", "Discharge Pipe Size")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Discharge Pipe Size (NPS)
                                    </label>
                                    {renderCommentBadge("pipeDia", "Discharge Pipe Size")}
                                  </div>
                                  <select
                                    disabled={isEffectiveReadOnly}
                                    value={pipeDia}
                                    onChange={(e) => {
                                      setPipeDia(parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary cursor-pointer disabled:opacity-60"
                                  >
                                    <option value="2.0">2.0" NPS (50mm)</option>
                                    <option value="2.5">2.5" NPS (65mm)</option>
                                    <option value="3.0">3.0" NPS (80mm)</option>
                                    <option value="4.0">4.0" NPS (100mm)</option>
                                    <option value="6.0">6.0" NPS (150mm)</option>
                                  </select>
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Min 2.0" for solids per IPC 712.4.2
                                  </span>
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
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Pipe Developed Length */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-pipeLen"
                                  data-field-id="pipeLen"
                                  data-comment-target="pipeLen"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("pipeLen", "Total Developed Pipe Length")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Total Developed Pipe Length ({isSI ? "m" : "ft"})
                                    </label>
                                    {renderCommentBadge("pipeLen", "Total Developed Pipe Length")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Straight-run pipe to gravity main
                                  </span>
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
                                  data-field-id="fittingsHead"
                                  data-comment-target="fittingsHead"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("fittingsHead", "Fittings Loss & Head Margin")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Fittings & Valve Losses ({isSI ? "m" : "ft"})
                                    </label>
                                    {renderCommentBadge("fittingsHead", "Fittings Loss & Head Margin")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
                                  <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Minor losses ({calcResults.hFittings} ft) + {calcResults.sf}% safety
                                  </span>
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
                          </div>

                          {/* Velocity Check Pill */}
                          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
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

                      {/* CARD 3: WET WELL SUMP BASIN SIZING */}
                      <div
                        id="card-basin"
                        data-field-id="card-basin"
                        data-comment-target="card-basin"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-basin", "Wet Well Sump Basin Sizing")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Cylinder className="size-4 text-primary" /> 3. Wet Well Sump Basin Sizing
                            </span>
                            {renderCommentBadge("card-basin", "Wet Well Sump Basin Sizing")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            ASPE Chapter 7
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* Basin Diameter */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-basinDia"
                                data-field-id="basinDia"
                                data-comment-target="basinDia"
                                className={`p-3 rounded-xl border transition-all ${
                                  isFieldHighlighted("basinDia", "Basin Internal Diameter")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Basin Internal Diameter (Ø)
                                  </label>
                                  {renderCommentBadge("basinDia", "Basin Internal Diameter")}
                                </div>
                                <select
                                  disabled={isEffectiveReadOnly}
                                  value={basinDia}
                                  onChange={(e) => {
                                    setBasinDia(parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary cursor-pointer disabled:opacity-60"
                                >
                                  <option value="24">24" Ø (600mm)</option>
                                  <option value="30">30" Ø (750mm)</option>
                                  <option value="36">36" Ø (900mm)</option>
                                  <option value="42">42" Ø (1050mm)</option>
                                  <option value="48">48" Ø (1200mm)</option>
                                  <option value="60">60" Ø (1500mm)</option>
                                  <option value="72">72" Ø (1800mm)</option>
                                </select>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Standard fiberglass or polyethylene sump basin
                                </span>
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

                          {/* Calculated Depth Breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 flex flex-col justify-between">
                              <span className="text-muted-foreground font-medium">Active Drawdown Depth:</span>
                              <span className="font-mono font-bold text-primary text-sm mt-1">
                                {isSI
                                  ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm`
                                  : `${calcResults.activeDepthInches.toFixed(1)} inches`}
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 flex flex-col justify-between">
                              <span className="text-muted-foreground font-medium">Total Recommended Depth:</span>
                              <span className="font-mono font-bold text-foreground text-sm mt-1">
                                {isSI
                                  ? `${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm (${(calcResults.totalBasinDepthInches * IN_TO_MM / 1000).toFixed(2)} m)`
                                  : `${calcResults.totalBasinDepthInches.toFixed(0)} inches (${(calcResults.totalBasinDepthInches / 12).toFixed(1)} ft)`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD 4: MOTOR RATING & HYDRAULIC POWER */}
                      <div
                        id="card-motor"
                        data-field-id="card-motor"
                        data-comment-target="card-motor"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-motor", "Motor Rating & Hydraulic Power")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Zap className="size-4 text-amber-500" /> 4. Motor Rating & Hydraulic Power
                            </span>
                            {renderCommentBadge("card-motor", "Motor Rating & Hydraulic Power")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            NEMA / IEEE
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Pump Efficiency */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-pumpEfficiency"
                                  data-field-id="pumpEfficiency"
                                  data-comment-target="pumpEfficiency"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("pumpEfficiency", "Pump Efficiency")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Pump Hydraulic Efficiency (%)
                                    </label>
                                    {renderCommentBadge("pumpEfficiency", "Pump Efficiency")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
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
                                  data-field-id="motorEfficiency"
                                  data-comment-target="motorEfficiency"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("motorEfficiency", "Motor Efficiency")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Motor Electrical Efficiency (%)
                                    </label>
                                    {renderCommentBadge("motorEfficiency", "Motor Efficiency")}
                                  </div>
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
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  />
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

                          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="font-bold text-primary text-xs">Selected Standard Commercial Motor Size</span>
                              <span className="text-[11px] text-muted-foreground">Wire-to-water shaft power: {calcResults.bhp.toFixed(2)} BHP ({calcResults.motorKW.toFixed(2)} kW)</span>
                            </div>
                            <span className="font-mono font-black text-foreground text-base">
                              {isSI
                                ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                                : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* RIGHT COLUMN: HERO RESULTS SUMMARY */}
                    <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-0">
                      
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-hero-results"
                            data-field-id="card-hero-results"
                            data-comment-target="card-hero-results"
                            className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                              isFieldHighlighted("card-hero-results", "Sewage Pump Sizing Summary")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : "border-border/80"
                            }`}
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-primary rounded-full" />
                                <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                                  Sewage Pump Sizing Summary
                                </h3>
                                {renderCommentBadge("card-hero-results", "Sewage Pump Sizing Summary")}
                              </div>
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                IPC 712 / ASPE 7
                              </span>
                            </div>

                            {/* 2x2 Key Metric Cards */}
                            <div className="grid grid-cols-2 gap-3">
                              
                              {/* 1. Pump Duty Flow */}
                              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20">
                                <div className="text-[10.5px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Pump Duty Flow</span>
                                  <Gauge className="size-3.5 text-primary" />
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI
                                    ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s`
                                    : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {calcResults.mult}x peak ({isSI ? (calcResults.qIn * GPM_TO_LPS).toFixed(2) + " L/s" : calcResults.qIn + " GPM"})
                                </div>
                              </div>

                              {/* 2. Total Head (TDH) */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Total Head (TDH)</span>
                                  <ArrowUpRight className="size-3.5 text-primary" />
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI
                                    ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m`
                                    : `${calcResults.tdh.toFixed(1)} ft`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  +{calcResults.sf}% safety margin
                                </div>
                              </div>

                              {/* 3. Motor Rating */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Motor Rating</span>
                                  <Zap className="size-3.5 text-amber-500" />
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI
                                    ? `${calcResults.recommendedMotorKW.toFixed(2)} kW`
                                    : `${calcResults.recommendedMotorHP} HP`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  {calcResults.bhp.toFixed(2)} BHP ({pumpEfficiency}% eff)
                                </div>
                              </div>

                              {/* 4. Active Sump Vol */}
                              <div className="p-3.5 rounded-xl bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 border border-[#0A7BC7]/30">
                                <div className="text-[10.5px] font-bold text-[#06456F] dark:text-sky-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Active Sump Vol</span>
                                  <Cylinder className="size-3.5 text-[#0A7BC7] dark:text-sky-400" />
                                </div>
                                <div className="text-xl font-black text-[#0A7BC7] dark:text-sky-400">
                                  {isSI
                                    ? `${calcResults.activeVolM3.toFixed(2)} m³`
                                    : `${calcResults.activeVolGal.toFixed(0)} Gal`}
                                </div>
                                <div className="text-[10px] font-semibold text-[#06456F]/80 dark:text-sky-300/80 mt-0.5 truncate">
                                  Depth: {isSI ? (calcResults.activeDepthInches * IN_TO_MM).toFixed(0) + " mm" : calcResults.activeDepthInches.toFixed(1) + '"'} ({calcResults.dBasin}" Ø)
                                </div>
                              </div>

                            </div>

                            {/* Equipment Sizing Specifications Card */}
                            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2.5 text-[12px]">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <ShieldCheck className="size-4 text-emerald-500" /> Redundancy Configuration
                                </span>
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {pumpCountMode === "1W_1S" ? "Duplex (1W+1S)" : "Triplex (2W+1S)"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                                <span>Discharge Fluid Velocity:</span>
                                <span className="font-bold text-foreground">
                                  {calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                                <span>Total Wet Well Dimensions:</span>
                                <span className="font-bold text-foreground">
                                  {calcResults.dBasin}" Ø × {isSI ? (calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0) + " mm" : calcResults.totalBasinDepthInches.toFixed(0) + '"'} Depth
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                                <span>Motor Starts Frequency:</span>
                                <span className="font-bold text-foreground">
                                  {calcResults.calculatedStartsPerHour.toFixed(1)} starts/hr (Max {calcResults.maxStarts})
                                </span>
                              </div>
                            </div>

                            {/* Export PDF Button */}
                            <div className="pt-2 space-y-2">
                              <button
                                onClick={exportPdf}
                                className="w-full flex items-center justify-center gap-2 bg-[#0A7BC7] hover:bg-[#08629f] text-white rounded-xl py-3 px-4 text-[13px] font-bold transition-all shadow-sm cursor-pointer border-0"
                              >
                                <Printer className="size-4" /> Export PDF
                              </button>
                              <button
                                onClick={exportToExcel}
                                className="w-full flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface border border-border/80 text-foreground rounded-xl py-2.5 px-4 text-[12px] font-semibold transition-all cursor-pointer"
                              >
                                <Download className="size-3.5" /> Export Excel Sheet
                              </button>
                            </div>

                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Pump Duty Flow", isSI ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s` : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Duty Flow</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Total Dynamic Head", isSI ? `${(calcResults.tdh * FT_TO_M).toFixed(1)} m` : `${calcResults.tdh.toFixed(1)} ft`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Total Head</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Recommended Motor Rating", isSI ? `${calcResults.recommendedMotorKW.toFixed(2)} kW` : `${calcResults.recommendedMotorHP} HP`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Motor Rating</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => setFormulaModalOpen(true)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <HelpCircle className="size-3.5 text-primary" />
                            <span>View Mathematical Equations</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-hero-results", "Sewage Pump Sizing Summary")}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment / Assign Task</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                    </div>

                  </div>

                </div>
              ) : (
                /* PRINTABLE REPORT PREVIEW TAB */
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Sewage Pump Sizing Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          IPC 712, ASPE Chapter 7 & Hydraulic Sizing Engineering Analysis
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportToExcel}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-surface-2 text-foreground text-[12px] font-semibold cursor-pointer shadow-2xs"
                        >
                          <Download className="size-3.5" /> Export Excel
                        </button>
                        <button
                          onClick={exportPdf}
                          className="flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#08629f] text-white rounded-xl py-2 px-4 text-[12px] font-bold transition-all shadow-xs cursor-pointer border-0"
                        >
                          <Printer className="size-3.5" /> Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Enclosed Project Metadata Grid */}
                    <div className="border border-border/80 rounded-xl overflow-hidden text-[12px]">
                      <div className="grid grid-cols-2 divide-x divide-border/80 border-b border-border/80 bg-muted/20">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Calculation No.:</span>
                          <span className="text-muted-foreground font-mono">{(project as any)?.calcNo || "TRV-CAL-SEW-01"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Date:</span>
                          <span className="text-muted-foreground">{formatDateStr(new Date())}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border/80 border-b border-border/80">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project No.:</span>
                          <span className="text-muted-foreground">{project?.code || (project as any)?.projectNo || "P000"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Client:</span>
                          <span className="text-muted-foreground">{project?.client || "General Contracting Co."}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-border/80 bg-muted/10">
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">Project Name:</span>
                          <span className="text-muted-foreground font-semibold">{project?.name || "Sanitary Drainage Lift Station"}</span>
                        </div>
                        <div className="p-2.5 px-3 flex justify-between">
                          <span className="font-bold text-foreground">End User:</span>
                          <span className="text-muted-foreground">{(project as any)?.endUser || (project as any)?.location || "Standard Facility"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table 1: Design Parameters & Inflow Criteria */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Design Parameters & Inflow Criteria
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Design Parameter Description</th>
                            <th className="border border-border p-2 text-center w-28">Value</th>
                            <th className="border border-border p-2 text-center w-20">Unit</th>
                            <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">Peak Sanitary Sewage Inflow Rate (Q_in)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (calcResults.qIn * GPM_TO_LPS).toFixed(2) : calcResults.qIn.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "L/s" : "GPM"}</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Table 709.1 Sanitary Drainage Load</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Pump Drawdown Factor (Multiplier)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.mult.toFixed(2)}</td>
                            <td className="border border-border p-2 text-center">x</td>
                            <td className="border border-border p-2 text-muted-foreground">ASPE Sizing Guide (1.5x - 2.0x Peak Inflow)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Target Pump Cycle Time (t)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.tCycle.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">min</td>
                            <td className="border border-border p-2 text-muted-foreground">Typical 5 - 10 min Cycle Interval</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Maximum Motor Starts Frequency</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.maxStarts}</td>
                            <td className="border border-border p-2 text-center">starts/hr</td>
                            <td className="border border-border p-2 text-muted-foreground">NEMA MG-1 Maximum Submersible Starts Limit</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Static Elevation Lift (H_static)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (calcResults.hStatic * FT_TO_M).toFixed(2) : calcResults.hStatic.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Basin Invert to Gravity Discharge Invert</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                            <td className="border border-border p-2 font-bold">Discharge Pipe Diameter (D)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (calcResults.dPipe * IN_TO_MM).toFixed(0) : calcResults.dPipe.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "mm" : "in NPS"}</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC 712.4.2 Solids Clearance (Min 2" / 3")</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                            <td className="border border-border p-2 font-bold">Total Developed Discharge Pipe Length (L)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (pipeLen * FT_TO_M).toFixed(1) : pipeLen.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Isometric Developed Piping Run</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                            <td className="border border-border p-2 font-bold">Fittings & Valves Equivalent Loss</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (calcResults.hFittings * FT_TO_M).toFixed(2) : calcResults.hFittings.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Check Valve, Gate Valve, 90 deg Bends</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">9</td>
                            <td className="border border-border p-2 font-bold">Wet Well Basin Internal Diameter</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (calcResults.dBasin * IN_TO_MM).toFixed(0) : calcResults.dBasin.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "mm dia." : "in dia."}</td>
                            <td className="border border-border p-2 text-muted-foreground">Duplex Submersible Clearances</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">10</td>
                            <td className="border border-border p-2 font-bold">Hydraulic Head Safety Margin</td>
                            <td className="border border-border p-2 text-center font-bold">+{calcResults.sf.toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">%</td>
                            <td className="border border-border p-2 text-muted-foreground">Friction Age, Slime & Minor Losses Margin</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Hydraulic Sizing Output Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Hydraulic Sizing Output Summary (IPC / ASPE 7)
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="font-bold">
                          <tr>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-center w-12">Item</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Sizing Output Summary (IPC / ASPE 7)</th>
                            <th className="bg-[#DAE9F8] dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-border p-2 text-center w-48">Calculated Result</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Engineering Basis & Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row A - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">A</td>
                            <td className="border border-border p-2">REQUIRED PUMP DUTY FLOW (Q_pump)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${(calcResults.dutyFlowPerPump * GPM_TO_LPS).toFixed(2)} L/s (${(calcResults.dutyFlowPerPump * GPM_TO_LMIN).toFixed(0)} L/min)`
                                : `${calcResults.dutyFlowPerPump.toFixed(1)} GPM`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">Q_pump = Q_in x Drawdown Multiplier</td>
                          </tr>
                          {/* Row B */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">B</td>
                            <td className="border border-border p-2 font-bold">Discharge Fluid Velocity (v)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`}
                            </td>
                            <td className="border border-border p-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              {calcResults.isScouringCompliant ? "Compliant (>= 2.0 fps Self-Scouring per IPC 712.4)" : "Below 2.0 fps (Warning)"}
                            </td>
                          </tr>
                          {/* Row C */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">C</td>
                            <td className="border border-border p-2 font-bold">Hazen-Williams Friction Head (H_f)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${(calcResults.frictionHead * FT_TO_M).toFixed(2)} m` : `${calcResults.frictionHead.toFixed(2)} ft`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Hazen-Williams Equation (C = 120)</td>
                          </tr>
                          {/* Row D - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">D</td>
                            <td className="border border-border p-2">TOTAL DYNAMIC HEAD (TDH)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${(calcResults.tdh * FT_TO_M).toFixed(2)} m w.g. (${(calcResults.tdh * 0.02989).toFixed(2)} bar)`
                                : `${calcResults.tdh.toFixed(1)} ft w.g.`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">TDH = (H_static + H_f + H_fittings) x (1 + {calcResults.sf}%)</td>
                          </tr>
                          {/* Row E - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">E</td>
                            <td className="border border-border p-2">ACTIVE WET WELL SUMP VOLUME (V_active)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${calcResults.activeVolM3.toFixed(2)} m3 (${calcResults.activeVolL.toFixed(0)} L)`
                                : `${calcResults.activeVolGal.toFixed(0)} Gal`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">V = (Q_pump x {calcResults.tCycle} min) / 4 (ASPE Formula)</td>
                          </tr>
                          {/* Row F */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">F</td>
                            <td className="border border-border p-2 font-bold">Active Liquid Drawdown Depth</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${(calcResults.activeDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.activeDepthInches.toFixed(1)} inches`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Liquid depth between Start and Stop floats</td>
                          </tr>
                          {/* Row G */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">G</td>
                            <td className="border border-border p-2 font-bold">Total Wet Well Basin Depth</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${(calcResults.totalBasinDepthInches * IN_TO_MM).toFixed(0)} mm` : `${calcResults.totalBasinDepthInches.toFixed(0)} inches`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Active Depth + 12" Submergence + 12" High-Alarm</td>
                          </tr>
                          {/* Row H */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">H</td>
                            <td className="border border-border p-2 font-bold">Calculated Pump Brake Horsepower (BHP)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {calcResults.bhp.toFixed(2)} BHP ({(calcResults.bhp * HP_TO_KW).toFixed(2)} kW)
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">@ {pumpEfficiency}% Pump Efficiency</td>
                          </tr>
                          {/* Row I - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">I</td>
                            <td className="border border-border p-2">RECOMMENDED MOTOR POWER RATING</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${calcResults.recommendedMotorKW.toFixed(2)} kW (${calcResults.recommendedMotorHP} HP)`
                                : `${calcResults.recommendedMotorHP} HP (${calcResults.recommendedMotorKW.toFixed(2)} kW)`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">NEMA Standard Heavy-Duty Submersible Motor</td>
                          </tr>
                          {/* Row J */}
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">J</td>
                            <td className="border border-border p-2 font-bold">Pumping Redundancy Configuration</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {pumpCountMode === "1W_1S" ? "1 Duty + 1 Standby (Duplex)" : "2 Duty + 1 Standby (Triplex)"}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">100% Standby Redundancy for Sanitary Reliability</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Mandatory Engineering Guidelines & IPC / ASPE Compliance Notes */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Mandatory Design Standards & Engineering Guidelines
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left w-56">Mandatory Design Standard</th>
                            <th className="border border-border p-2 text-left">Compliance & Engineering Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">IPC 712.4.2 Velocity Limit</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Discharge piping flow velocity must be maintained between 2.0 ft/s (0.61 m/s) minimum for self-scouring and 8.0 ft/s (2.44 m/s) maximum to prevent water hammer.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">IPC 712.4.1 Solids Handling</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Sewage ejector pump must be capable of passing spherical solids of minimum 2.0 inches (51 mm) diameter for sanitary water closet drainage.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">ASPE Volume Formula</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Active wet well storage volume V = (Q x t)/4 ensures motor starts do not exceed manufacturer limits and avoids frequent short-cycling.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Wet Well Clearances</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Wet well depth includes 12" minimum motor submergence cushion below stop float for motor cooling and 12" freeboard to high-water alarm float.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Duplex Redundancy</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Sanitary lift stations serving multiple fixtures require duplex pumps operating in automatic alternation with 100% standby backup.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 4: 3-Tier Signature Block */}
                    <div className="pt-2">
                      {(() => {
                        const sig = getSignatureBlockDetails(project?.id || "default", "/plumbing-sewage-pump", currentUserName);
                        return (
                          <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                            <div className="grid grid-cols-4 bg-[#FFE6CC] dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-border text-center">
                              <div className="p-2 border-r border-border"></div>
                              <div className="p-2 border-r border-border">Originator</div>
                              <div className="p-2 border-r border-border">Reviewer</div>
                              <div className="p-2">Approver</div>
                            </div>
                            <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                              <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Name:</div>
                              <div className="p-2.5 font-medium text-foreground">{sig.originatedName || "Abubakar Chanda"}</div>
                              <div className="p-2.5 font-medium text-foreground">{sig.reviewerName || "-"}</div>
                              <div className="p-2.5 font-medium text-foreground">{sig.approverName || "-"}</div>
                            </div>
                            <div className="grid grid-cols-4 divide-x divide-border text-center">
                              <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Date:</div>
                              <div className="p-2.5 text-muted-foreground">{sig.originatedDate || formatDateStr(new Date())}</div>
                              <div className="p-2.5 text-muted-foreground">{sig.reviewerDate || "-"}</div>
                              <div className="p-2.5 text-muted-foreground">{sig.approverDate || "-"}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
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
              onSelectPreset={handleApplyPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              unitSystem={unitSystem}
              onNavigateToField={(id: string) => {
                setTab("solver");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("mep-scroll-to-item", { detail: { id } }));
                }, 100);
              }}
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
    </>
  );
}

interface SewagePumpIntelligenceDrawerProps {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  onSelectPreset: (key: SewagePresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  onNavigateToField: (fieldId: string) => void;
  setFormulaModalOpen: (open: boolean) => void;
}

// Live Intelligence Drawer Component
function SewagePumpIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  onNavigateToField,
  setFormulaModalOpen,
}: SewagePumpIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  // Accordion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    compliance: true,
    presets: true,
    hydraulics: true,
    advisories: true,
    standards: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <div className="h-full flex flex-col bg-card select-none text-xs">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="font-bold text-foreground text-sm">Sewage Sizing Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        
        {/* Section 1: IPC & ASPE Compliance Audit */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("compliance")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Compliance & Safety Audit</span>
            </div>
            {openSections.compliance ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.compliance && (
            <div className="p-3 space-y-2.5 bg-background">
              {/* Check 1: Scouring Velocity */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.isScouringCompliant ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Discharge Scouring Velocity</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Current: <strong>{calcResults.velocityFps.toFixed(2)} ft/s ({calcResults.velocityMs.toFixed(2)} m/s)</strong>. IPC 712.4 mandates ≥ 2.0 ft/s (0.61 m/s) to prevent solids sedimentation.
                  </div>
                </div>
              </div>

              {/* Check 2: Minimum Pipe Size */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.isSolidsCompliant ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Solids Passage Clearance</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Pipe size <strong>{calcResults.dPipe}" NPS</strong>. IPC 712.4.2 mandates min 2.0" discharge diameter for raw sewage water closet waste.
                  </div>
                </div>
              </div>

              {/* Check 3: Motor Starts */}
              <div className="flex items-start gap-2 text-[11.5px]">
                {calcResults.calculatedStartsPerHour <= calcResults.maxStarts ? (
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-foreground">Thermal Cycle Starts/Hour</div>
                  <div className="text-muted-foreground text-[10.5px]">
                    Calculated <strong>{calcResults.calculatedStartsPerHour.toFixed(1)} starts/hr</strong> (Limit: {calcResults.maxStarts} starts/hr max per NEMA MG-1).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Presets & Application Profiles */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("presets")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Application Profiles</span>
            </div>
            {openSections.presets ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.presets && (
            <div className="p-3 space-y-2 bg-background">
              {(Object.keys(SEWAGE_PRESETS) as SewagePresetKey[]).map((key) => {
                const p = SEWAGE_PRESETS[key];
                const isSelected = preset === key;
                return (
                  <div
                    key={key}
                    onClick={() => onSelectPreset(key)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border/60 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11.5px]">{p.label}</span>
                      {isSelected && <span className="text-[10px] font-bold text-primary">ACTIVE</span>}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">{p.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground">
                      <span>Flow: {p.inflow} GPM</span>
                      <span>•</span>
                      <span>Lift: {p.lift} ft</span>
                      <span>•</span>
                      <span>Pipe: {p.pipeDia}"</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Engineering Advisories */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("advisories")}
            className="w-full p-3 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <span>Engineering Advisories</span>
            </div>
            {openSections.advisories ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {openSections.advisories && (
            <div className="p-3 space-y-2 bg-background text-[11px] text-muted-foreground">
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Check Valve Placement</span>
                Install a full-flow swing check valve and gate valve on the horizontal discharge of each pump before the header connection (IPC 712.4.3).
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">Basin Venting</span>
                Sump & ejector basins must be gas-tight and vented with a minimum 2" vent pipe connecting through the building roof (IPC 712.4.1).
              </div>
              <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-bold text-foreground block mb-0.5">High Water Alarm</span>
                Provide an audio-visual high water alarm float set 6 inches below the gravity inlet invert.
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border bg-card flex items-center justify-between">
        <button
          onClick={() => setFormulaModalOpen(true)}
          className="flex items-center gap-1.5 text-primary text-xs font-semibold hover:underline cursor-pointer"
        >
          <HelpCircle className="size-3.5" />
          <span>Formula Breakdown</span>
        </button>
        <span className="text-[10.5px] text-muted-foreground font-mono">IPC 712 / ASPE 7</span>
      </div>
    </div>
  );
}

interface SewagePumpFormulaModalProps {
  onClose: () => void;
  calcResults: any;
  preset: SewagePresetKey;
  unitSystem: "ip" | "si";
}

// Mathematical Formula Breakdown Modal
function SewagePumpFormulaModal({
  onClose,
  calcResults,
  preset,
  unitSystem,
}: SewagePumpFormulaModalProps) {
  const isSI = unitSystem === "si";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">IPC & ASPE Sewage Pump Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">Standard formulas applied in dynamic head, storage volume & power sizing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">
          
          {/* Equation 1: Pump Duty Flow */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Pump Duty Flow (Q_pump)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Q_pump = Q_inflow × Drawdown_Factor
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              ASPE Chapter 7 recommends a drawdown factor of 1.5x to 2.0x peak fixture drainage inflow to ensure the wet well is evacuated faster than peak sewage accumulation.
            </p>
          </div>

          {/* Equation 2: Velocity */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Fluid Velocity & Scouring (v)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              v = (0.4085 × Q_pump) / (d_pipe)²  [fps]
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              IPC 712.4 requires a minimum self-scouring velocity of 2.0 ft/s (0.61 m/s) to prevent suspended organic solids from settling in the discharge force main.
            </p>
          </div>

          {/* Equation 3: Hazen-Williams Friction */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">3. Friction Head Loss (Hazen-Williams)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              H_f = 0.002083 × L × (100 / C)^1.852 × (Q^1.852 / d^4.8655)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Standard friction calculation where C=120 for PVC/cast iron force mains, L is developed pipe length, and d is internal diameter.
            </p>
          </div>

          {/* Equation 4: Active Volume */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">4. Active Wet Well Sump Volume</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              V_active = (Q_pump × t_cycle) / 4  [Gallons]
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              ASPE wet well volumetric formula based on minimum pump cycle time between starts to prevent premature motor winding burnout.
            </p>
          </div>

          {/* Equation 5: Motor Power */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">5. Brake Horsepower & Wire-to-Water Power</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              BHP = (Q_pump × TDH) / (3960 × η_pump)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Wire-to-water electrical rating selected to the nearest standard NEMA / IEEE commercial submersible motor rating.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            Close Formula Guide
          </button>
        </div>
      </div>
    </div>
  );
}
