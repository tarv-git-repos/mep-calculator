import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, Flame, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers, ArrowRight
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

export const Route = createFileRoute("/plumbing-fire-water-demand")({
  head: () => ({
    meta: [
      { title: "Fire Water Demand Calculator â€” MEP Calc" },
      { name: "description", content: "Determine total fire water demand for sprinklers, hydrants, hose reels, fire pumps, and storage tanks per NFPA 13, 14, 20 & 22." },
    ],
  }),
  component: FireWaterDemandPage,
});

export type HazardPresetKey = "light_hazard" | "oh_1" | "oh_2" | "extra_hazard" | "high_rise_standpipe" | "custom";

export interface HazardPresetConfig {
  key: HazardPresetKey;
  label: string;
  category: string;
  description: string;
  spFlow: number; // GPM
  spPress: number; // psi
  hyCount: number;
  hyFlow: number; // GPM
  hrCount: number;
  hrFlow: number; // GPM
  designDuration: number; // minutes
  tankReservePct: number; // %
}

export const HAZARD_PRESETS: Record<HazardPresetKey, HazardPresetConfig> = {
  light_hazard: {
    key: "light_hazard",
    label: "Light Hazard (LH)",
    category: "NFPA 13 / NFPA 14 Class II",
    description: "Offices, schools, residential, churches, hospitals with low fire loading.",
    spFlow: 250,
    spPress: 50,
    hyCount: 1,
    hyFlow: 250,
    hrCount: 2,
    hrFlow: 25,
    designDuration: 30,
    tankReservePct: 10,
  },
  oh_1: {
    key: "oh_1",
    label: "Ordinary Hazard Group 1 (OH-1)",
    category: "NFPA 13 / NFPA 14",
    description: "Parking garages, restaurants, bakeries, electronic plants (combustibility low, stockpiles <= 8ft).",
    spFlow: 350,
    spPress: 60,
    hyCount: 2,
    hyFlow: 250,
    hrCount: 2,
    hrFlow: 30,
    designDuration: 60,
    tankReservePct: 10,
  },
  oh_2: {
    key: "oh_2",
    label: "Ordinary Hazard Group 2 (OH-2)",
    category: "NFPA 13 / NFPA 14 Class I/III",
    description: "Retail malls, mercantile, machine shops, warehouses, textile mills.",
    spFlow: 500,
    spPress: 65,
    hyCount: 2,
    hyFlow: 250,
    hrCount: 2,
    hrFlow: 30,
    designDuration: 90,
    tankReservePct: 10,
  },
  extra_hazard: {
    key: "extra_hazard",
    label: "Extra Hazard (EH-1 / EH-2)",
    category: "NFPA 13 / NFPA 14 Heavy Industrial",
    description: "Chemical processing, plastics manufacturing, aircraft hangars, flammable storage.",
    spFlow: 1000,
    spPress: 75,
    hyCount: 2,
    hyFlow: 500,
    hrCount: 4,
    hrFlow: 50,
    designDuration: 120,
    tankReservePct: 15,
  },
  high_rise_standpipe: {
    key: "high_rise_standpipe",
    label: "High-Rise Standpipe & Sprinkler",
    category: "NFPA 14 Class I + NFPA 13 Combined",
    description: "Multi-story towers requiring 500 GPM 1st standpipe riser + 250 GPM each additional riser + sprinkler.",
    spFlow: 750,
    spPress: 100,
    hyCount: 3, // 500 + 250 + 250 GPM
    hyFlow: 250,
    hrCount: 2,
    hrFlow: 25,
    designDuration: 90,
    tankReservePct: 10,
  },
  custom: {
    key: "custom",
    label: "Custom User Defined",
    category: "Engineered Fire Protection",
    description: "Custom project specifications, special hazards, or AHJ specific requirements.",
    spFlow: 500,
    spPress: 60,
    hyCount: 2,
    hyFlow: 250,
    hrCount: 0,
    hrFlow: 50,
    designDuration: 60,
    tankReservePct: 10,
  },
};

// Standard NFPA 20 rated pump sizes (GPM)
const STANDARD_NFPA20_PUMP_SIZES = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000];

// Conversion Constants
const GPM_TO_LMIN = 3.78541;
const GPM_TO_M3H = 0.227125;
const PSI_TO_BAR = 0.0689476;
const GAL_TO_M3 = 0.00378541;
const GAL_TO_L = 3.78541;

function FireWaterDemandPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const { project, isReadOnly, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-fire-water-demand", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole);

  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP: GPM, psi, gal / SI: L/min, bar, m³ & L)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");

  // Preset
  const [preset, setPreset] = useState<HazardPresetKey>("oh_2");

  // Core Inputs (stored internally in IP units for consistent formulas)
  const [spFlow, setSpFlow] = useState<number | "">(500); // GPM
  const [spPress, setSpPress] = useState<number | "">(65); // psi
  const [hyCount, setHyCount] = useState<number | "">(2); // ea
  const [hyFlow, setHyFlow] = useState<number | "">(250); // GPM
  const [hrCount, setHrCount] = useState<number | "">(2); // ea
  const [hrFlow, setHrFlow] = useState<number | "">(30); // GPM
  const [designDuration, setDesignDuration] = useState<number | "">(90); // minutes
  const [tankReservePct, setTankReservePct] = useState<number | "">(10); // % safety/dead storage
  const [mainsReplenishFlow, setMainsReplenishFlow] = useState<number | "">(0); // GPM refill from city main

  // Sync state with active project and handle VersionManager snapshots
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load saved Fire Water Demand parameters on mount or project switch
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    const pKey = `mep_fire_water_demand_params_${project.id}`;
    const stored = localStorage.getItem(pKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.preset !== undefined) setPreset(parsed.preset);
        if (parsed.spFlow !== undefined) setSpFlow(parsed.spFlow);
        if (parsed.spPress !== undefined) setSpPress(parsed.spPress);
        if (parsed.hyCount !== undefined) setHyCount(parsed.hyCount);
        if (parsed.hyFlow !== undefined) setHyFlow(parsed.hyFlow);
        if (parsed.hrCount !== undefined) setHrCount(parsed.hrCount);
        if (parsed.hrFlow !== undefined) setHrFlow(parsed.hrFlow);
        if (parsed.designDuration !== undefined) setDesignDuration(parsed.designDuration);
        if (parsed.tankReservePct !== undefined) setTankReservePct(parsed.tankReservePct);
        if (parsed.mainsReplenishFlow !== undefined) setMainsReplenishFlow(parsed.mainsReplenishFlow);
        if (parsed.unitSystem) setUnitSystem(parsed.unitSystem);
      } catch (e) {
        console.error("Failed to parse stored Fire Water Demand params", e);
      }
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId]);

  // Version History Restore Listener (Full parity with Ventilation & VersionManager)
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_fire_water_demand_params_${pId}`;
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
        if (restoredData.spFlow !== undefined) setSpFlow(restoredData.spFlow);
        if (restoredData.spPress !== undefined) setSpPress(restoredData.spPress);
        if (restoredData.hyCount !== undefined) setHyCount(restoredData.hyCount);
        if (restoredData.hyFlow !== undefined) setHyFlow(restoredData.hyFlow);
        if (restoredData.hrCount !== undefined) setHrCount(restoredData.hrCount);
        if (restoredData.hrFlow !== undefined) setHrFlow(restoredData.hrFlow);
        if (restoredData.designDuration !== undefined) setDesignDuration(restoredData.designDuration);
        if (restoredData.tankReservePct !== undefined) setTankReservePct(restoredData.tankReservePct);
        if (restoredData.mainsReplenishFlow !== undefined) setMainsReplenishFlow(restoredData.mainsReplenishFlow);
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        dirtyStore.set(false);
        toast.success("Fire Water Demand calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Auto-persist full calculator state for VersionManager snapshots and local storage
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const dataToSave = {
      preset,
      spFlow,
      spPress,
      hyCount,
      hyFlow,
      hrCount,
      hrFlow,
      designDuration,
      tankReservePct,
      mainsReplenishFlow,
      unitSystem,
    };
    try {
      localStorage.setItem(`mep_fire_water_demand_params_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    } catch (e) {
      console.error("Failed to save Fire Water Demand params", e);
    }
  }, [preset, spFlow, spPress, hyCount, hyFlow, hrCount, hrFlow, designDuration, tankReservePct, mainsReplenishFlow, unitSystem, project?.id, loadedProjectId]);

  // Comments and Task Assignment state (Matching Preliminary Cooling Load & FM-200)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments from local storage on mount / project change
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-fire-water-demand`;
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
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-fire-water-demand`, JSON.stringify(newList));
    // Immediately dispatch notification events for instantaneous UI and badge update (<1ms)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
    }
    // Background cloud save if available
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
      targetType: "Fire Water Demand Parameter",
      calculatorTitle: "Fire Water Demand",
      calculatorPath: "/plumbing-fire-water-demand",
      projectId: project?.id || "default",
      projectName: project?.name || "Fire Fighting Hydraulic System",
    };
    const updated = [commentWithMeta, ...commentsList.filter(c => c.id !== comment.id)];
    saveComments(updated);
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

  // Unit toggle handler supporting UnitToggle's conversion modal
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.success(`Unit system switched to ${targetUnit.toUpperCase()}`);
  };

  // Scroll and highlight notification target item (matching Preliminary Cooling Load)
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
  }, []);

  // Handle Preset Change
  const handleApplyPreset = (key: HazardPresetKey) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    setPreset(key);
    const p = HAZARD_PRESETS[key];
    if (p) {
      setSpFlow(p.spFlow);
      setSpPress(p.spPress);
      setHyCount(p.hyCount);
      setHyFlow(p.hyFlow);
      setHrCount(p.hrCount);
      setHrFlow(p.hrFlow);
      setDesignDuration(p.designDuration);
      setTankReservePct(p.tankReservePct);
      toast.success(`Applied preset: ${p.label}`);
    }
  };

  // Calculations
  const calcResults = useMemo(() => {
    const spF = typeof spFlow === "number" ? spFlow : 0;
    const spP = typeof spPress === "number" ? spPress : 0;
    const hyC = typeof hyCount === "number" ? hyCount : 0;
    const hyF = typeof hyFlow === "number" ? hyFlow : 0;
    const hrC = typeof hrCount === "number" ? hrCount : 0;
    const hrF = typeof hrFlow === "number" ? hrFlow : 0;
    const duration = typeof designDuration === "number" ? designDuration : 60;
    const reservePct = typeof tankReservePct === "number" ? tankReservePct : 10;
    const mainsRefill = typeof mainsReplenishFlow === "number" ? mainsReplenishFlow : 0;

    // Component flows (GPM)
    const hyTotal = hyC * hyF;
    const hrTotal = hrC * hrF;
    const totalFlow = spF + hyTotal + hrTotal;

    // Pump Selection per NFPA 20
    let recommendedPumpGPM = 250;
    for (const size of STANDARD_NFPA20_PUMP_SIZES) {
      if (size >= totalFlow) {
        recommendedPumpGPM = size;
        break;
      }
      recommendedPumpGPM = size;
    }
    if (totalFlow > 5000) {
      recommendedPumpGPM = Math.ceil(totalFlow / 1000) * 1000;
    }

    // Storage Tank Capacities (US Gallons)
    const tank30Effective = totalFlow * 30;
    const tank60Effective = totalFlow * 60;
    const tank90Effective = totalFlow * 90;
    const tank120Effective = totalFlow * 120;

    const selectedDurationEffective = totalFlow * duration;
    const grossVolumeMultiplier = 1 + reservePct / 100;
    const selectedDurationGross = selectedDurationEffective * grossVolumeMultiplier;

    // Header Pipe Sizing Recommendation (Max velocity 15 fps / 4.57 m/s per NFPA 20)
    const targetVelFps = 15;
    const calculatedPipeDiaInches = totalFlow > 0 ? Math.sqrt((0.4085 * totalFlow) / targetVelFps) : 0;
    
    // Standard nominal pipe sizes (NPS inches)
    const standardNps = [2, 2.5, 3, 4, 6, 8, 10, 12, 14, 16];
    let recommendedNps = 4;
    for (const nps of standardNps) {
      if (nps >= calculatedPipeDiaInches) {
        recommendedNps = nps;
        break;
      }
      recommendedNps = nps;
    }

    // Municipal Refill Hours to refill gross volume (NFPA 22 recommends <= 8 hours)
    const refillHours = mainsRefill > 0 ? (selectedDurationGross / (mainsRefill * 60)) : null;

    // Warnings & Design Flags
    const showLargeDemandWarning = totalFlow > 2000;
    const showLargeTankWarning = selectedDurationGross > 150000;
    const showLowPressureWarning = spP < 50;
    const showRefillExceeds8h = refillHours !== null && refillHours > 8;

    return {
      spF,
      spP,
      hyC,
      hyF,
      hyTotal,
      hrC,
      hrF,
      hrTotal,
      totalFlow,
      recommendedPumpGPM,
      duration,
      reservePct,
      selectedDurationEffective,
      selectedDurationGross,
      tank30Effective,
      tank60Effective,
      tank90Effective,
      tank120Effective,
      mainsRefill,
      refillHours,
      calculatedPipeDiaInches,
      recommendedNps,
      showLargeDemandWarning,
      showLargeTankWarning,
      showLowPressureWarning,
      showRefillExceeds8h,
      GPM_TO_LMIN,
      GPM_TO_M3H,
      PSI_TO_BAR,
      GAL_TO_M3,
      GAL_TO_L,
    };
  }, [spFlow, spPress, hyCount, hyFlow, hrCount, hrFlow, designDuration, tankReservePct, mainsReplenishFlow]);

  // Export PDF Report matching Ventilation standard
  const exportPdf = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2; // 182mm

      // Primary colors matching Ventilation
      const primaryFill: [number, number, number] = [217, 217, 217]; // #D9D9D9 standard header
      const blueFill: [number, number, number] = [218, 233, 248]; // #DAE9F8 key output highlight
      const signatureFill: [number, number, number] = [255, 230, 204]; // #FFE6CC signature header
      const gridBorderColor: [number, number, number] = [100, 100, 100];

      // Title & Subtitle
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("FIRE WATER DEMAND & STORAGE TANK SIZING REPORT", pageWidth / 2, 9, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text("Design Standards: NFPA 13, NFPA 14, NFPA 20, NFPA 22 (Simultaneous Operation Method)", pageWidth / 2, 13, { align: "center" });

      // 1. Project Metadata Enclosed Header Box (Matching Ventilation)
      const boxY = 15;
      const boxHeight = 24;
      doc.setDrawColor(...gridBorderColor);
      doc.setLineWidth(0.1);
      doc.rect(margin, boxY, contentWidth, boxHeight);

      // Vertical dividing line
      const midX = margin + contentWidth / 2;
      doc.line(midX, boxY, midX, boxY + boxHeight);

      // Horizontal dividers
      doc.line(margin, boxY + 8, margin + contentWidth, boxY + 8);
      doc.line(margin, boxY + 16, margin + contentWidth, boxY + 16);

      doc.setFontSize(8.5);
      const pName = project?.name || "Fire Fighting Hydraulic System";
      const pNum = project?.code || project?.id?.substring(0, 8) || "PRJ-FF-001";
      const calcNum = `CALC-FWD-${Date.now().toString().slice(-4)}`;
      const dateStr = formatDateStr(new Date());
      const clientStr = project?.client || "General Contracting Co.";
      const endUserStr = project?.endUser || "Commercial Real Estate";

      // Left Column Metadata
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Calculation No.:", margin + 3, boxY + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text(calcNum, margin + 32, boxY + 5.5);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", margin + 3, boxY + 13.5);
      doc.setFont("helvetica", "normal");
      doc.text(pNum, margin + 32, boxY + 13.5);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", margin + 3, boxY + 21.5);
      doc.setFont("helvetica", "normal");
      doc.text(pName.substring(0, 38), margin + 32, boxY + 21.5);

      // Right Column Metadata
      doc.setFont("helvetica", "bold");
      doc.text("Date:", midX + 3, boxY + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text(dateStr, midX + 26, boxY + 5.5);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", midX + 3, boxY + 13.5);
      doc.setFont("helvetica", "normal");
      doc.text(clientStr.substring(0, 38), midX + 26, boxY + 13.5);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", midX + 3, boxY + 21.5);
      doc.setFont("helvetica", "normal");
      doc.text(endUserStr.substring(0, 38), midX + 26, boxY + 21.5);

      // Table 1: Design Parameters & Hazard Classification
      const hazardCfg = HAZARD_PRESETS[preset] || HAZARD_PRESETS.custom;
      const isSI = unitSystem === "si";

      const paramTableBody = [
        ["Hazard Classification / Preset", hazardCfg.label, hazardCfg.category],
        ["Sprinkler System Design Flow", isSI ? `${(calcResults.spF * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.spF.toFixed(0)} GPM`, "NFPA 13 Hydraulic Demand Area/Density"],
        ["Sprinkler Minimum Residual Pressure", isSI ? `${(calcResults.spP * PSI_TO_BAR).toFixed(2)} bar` : `${calcResults.spP.toFixed(0)} psi`, "At most hydraulically remote sprinkler"],
        ["Simultaneous Hydrant Outlets", `${calcResults.hyC} Outlets @ ${isSI ? (calcResults.hyF * GPM_TO_LMIN).toFixed(0) + " L/min" : calcResults.hyF.toFixed(0) + " GPM"} each`, "NFPA 14 / NFPA 24 Yard / Landing Outlets"],
        ["Simultaneous First-Aid Hose Reels", `${calcResults.hrC} Reels @ ${isSI ? (calcResults.hrF * GPM_TO_LMIN).toFixed(0) + " L/min" : calcResults.hrF.toFixed(0) + " GPM"} each`, "NFPA 14 Class II / BS 5306"],
        ["Design Fire Duration", `${calcResults.duration} Minutes`, "Per Hazard Group / NFPA 13 Table 19.3.2"],
        ["Tank Ullage & Silt Reserve Allowance", `+${calcResults.reservePct}% Safety Allowance`, "NFPA 22 Dead Storage & Vortex Allowance"],
        ["Municipal Main Replenishment Flow", calcResults.mainsRefill > 0 ? (isSI ? `${(calcResults.mainsRefill * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.mainsRefill.toFixed(0)} GPM`) : "0 (Isolated Storage Tank)", "Continuous City Water Inflow Credit"],
      ];

      autoTable(doc, {
        startY: 42,
        margin: { left: margin, right: margin },
        head: [["DESIGN PARAMETER", "VALUE / SPECIFICATION", "CODE REFERENCE / ENGINEERING BASIS"]],
        body: paramTableBody,
        theme: "plain",
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "left",
          lineColor: gridBorderColor,
          lineWidth: 0.1,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 30,
          lineColor: gridBorderColor,
          lineWidth: 0.1,
          cellPadding: 1.6,
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: "bold" },
          1: { cellWidth: 55, halign: "left" },
          2: { cellWidth: 65, halign: "left" },
        },
      });

      // Table 2: Simultaneous Fire Water Demand & Fire Pump Sizing
      const table2Y = (doc as any).lastAutoTable.finalY + 4;
      const resultsTableBody = [
        ["A", "Sprinkler System Demand (Q_sp)", isSI ? `${(calcResults.spF * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.spF.toFixed(0)} GPM`, `${(calcResults.spF * GPM_TO_M3H).toFixed(1)} m³/h`, "Primary automatic fire suppression"],
        ["B", "External Hydrant Demand (Q_hy)", isSI ? `${(calcResults.hyTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hyTotal.toFixed(0)} GPM`, `${(calcResults.hyTotal * GPM_TO_M3H).toFixed(1)} m³/h`, `${calcResults.hyC} × ${calcResults.hyF} GPM simultaneous hydrants`],
        ["C", "First-Aid Hose Reel Demand (Q_hr)", isSI ? `${(calcResults.hrTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hrTotal.toFixed(0)} GPM`, `${(calcResults.hrTotal * GPM_TO_M3H).toFixed(1)} m³/h`, `${calcResults.hrC} × ${calcResults.hrF} GPM first-aid hose reels`],
        ["D", "TOTAL SIMULTANEOUS FIRE DEMAND (Q_total)", isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow.toFixed(0)} GPM`, `${(calcResults.totalFlow * GPM_TO_M3H).toFixed(1)} m³/h`, "Q_sp + Q_hy + Q_hr (Simultaneous Sum)"],
        ["E", "Recommended NFPA 20 Fire Pump Capacity", isSI ? `${(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.recommendedPumpGPM.toFixed(0)} GPM`, `${(calcResults.recommendedPumpGPM * GPM_TO_M3H).toFixed(1)} m³/h`, `Standard NFPA 20 Listed Fire Pump Rating`],
        ["F", "Recommended Pump Discharge Header Size", `${calcResults.recommendedNps}" NPS (${calcResults.recommendedNps * 25} mm)`, "-", `Velocity <= 15 fps (4.57 m/s) at rated flow`],
      ];

      autoTable(doc, {
        startY: table2Y,
        margin: { left: margin, right: margin },
        head: [["ITEM", "HYDRAULIC DEMAND COMPONENT", "FLOW RATE (PRIMARY)", "FLOW RATE (MÂ³/H)", "NOTES & NFPA 20 CRITERIA"]],
        body: resultsTableBody,
        theme: "plain",
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "left",
          lineColor: gridBorderColor,
          lineWidth: 0.1,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 30,
          lineColor: gridBorderColor,
          lineWidth: 0.1,
          cellPadding: 1.6,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 65, fontStyle: "bold" },
          2: { cellWidth: 38, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 26, halign: "center" },
          4: { cellWidth: 43, halign: "left" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && (data.row.index === 3 || data.row.index === 4)) {
            data.cell.styles.fillColor = blueFill;
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Table 3: Dedicated Fire Water Storage Tank Capacity Breakdown
      const table3Y = (doc as any).lastAutoTable.finalY + 4;
      const tankTableBody = [
        ["30 Minutes Duration (Light Hazard)", `${calcResults.tank30Effective.toLocaleString()} gal`, `${(calcResults.tank30Effective * GAL_TO_M3).toFixed(1)} m³ (${(calcResults.tank30Effective * GAL_TO_L).toLocaleString(undefined, { maximumFractionDigits: 0 })} L)`, "NFPA 13 Light Hazard minimum requirement"],
        ["60 Minutes Duration (OH-1 Basis)", `${calcResults.tank60Effective.toLocaleString()} gal`, `${(calcResults.tank60Effective * GAL_TO_M3).toFixed(1)} m³ (${(calcResults.tank60Effective * GAL_TO_L).toLocaleString(undefined, { maximumFractionDigits: 0 })} L)`, "NFPA 13 Ordinary Hazard Group 1 standard"],
        ["90 Minutes Duration (OH-2 / High-Rise)", `${calcResults.tank90Effective.toLocaleString()} gal`, `${(calcResults.tank90Effective * GAL_TO_M3).toFixed(1)} m³ (${(calcResults.tank90Effective * GAL_TO_L).toLocaleString(undefined, { maximumFractionDigits: 0 })} L)`, "NFPA 13 OH-2 & NFPA 14 Standpipe baseline"],
        ["120 Minutes Duration (Extra Hazard / Heavy)", `${calcResults.tank120Effective.toLocaleString()} gal`, `${(calcResults.tank120Effective * GAL_TO_M3).toFixed(1)} m³ (${(calcResults.tank120Effective * GAL_TO_L).toLocaleString(undefined, { maximumFractionDigits: 0 })} L)`, "NFPA 13 Extra Hazard / Industrial storage"],
        [`DESIGN SELECTION: ${calcResults.duration} MIN NET CAPACITY`, `${calcResults.selectedDurationEffective.toLocaleString()} gal`, `${(calcResults.selectedDurationEffective * GAL_TO_M3).toFixed(1)} m³`, "Net Effective Fire Protection Storage (V_eff)"],
        [`TOTAL GROSS TANK CAPACITY (+${calcResults.reservePct}% ULLAGE)`, `${calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal`, `${(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³ (${(calcResults.selectedDurationGross * GAL_TO_L).toLocaleString(undefined, { maximumFractionDigits: 0 })} L)`, "Total Dedicated Fire Water Tank Construction Volume"],
      ];

      autoTable(doc, {
        startY: table3Y,
        margin: { left: margin, right: margin },
        head: [["STORAGE DURATION / BASIS", "NET VOLUME (GAL)", "VOLUME IN METRIC (MÂ³ / L)", "DESIGN STANDARD / APPLICABILITY"]],
        body: tankTableBody,
        theme: "plain",
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "left",
          lineColor: gridBorderColor,
          lineWidth: 0.1,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: 30,
          lineColor: gridBorderColor,
          lineWidth: 0.1,
          cellPadding: 1.6,
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: "bold" },
          1: { cellWidth: 32, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 46, halign: "center" },
          3: { cellWidth: 42, halign: "left" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === 5) {
            data.cell.styles.fillColor = blueFill;
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Table 4: Mandatory NFPA Standards & Compliance Guidelines
      const table4Y = (doc as any).lastAutoTable.finalY + 4;
      const guidelinesBody = [
        ["NFPA 13 Section 19.3", "Inside & outside hose stream allowances must be added simultaneously to sprinkler demand for total demand."],
        ["NFPA 20 Section 4.14", "Fire pump suction piping velocity must not exceed 15 fps (4.57 m/s) at 150% pump rated flow."],
        ["NFPA 20 Section 6.2", "Fire pump must provide 150% of rated flow at >= 65% of rated pressure; shutoff head <= 140%."],
        ["NFPA 22 Section 5.2", "Fire water storage tanks must be dedicated with low-level alarms, anti-vortex plate, and automatic makeup."],
        ["NFPA 22 Refill Rule", calcResults.refillHours !== null ? `Replenishment at ${calcResults.mainsRefill} GPM refills tank in ${calcResults.refillHours.toFixed(1)} hrs (${calcResults.refillHours <= 8 ? "PASS: <= 8 hrs per NFPA 22" : "FAIL: Exceeds 8 hrs"})` : "Dedicated tank without city credit; replenishment rate must be verified with municipal authority."],
      ];

      autoTable(doc, {
        startY: table4Y,
        margin: { left: margin, right: margin },
        head: [["STANDARD / CLAUSE", "ENGINEERING COMPLIANCE REQUIREMENT & SYSTEM CRITERIA"]],
        body: guidelinesBody,
        theme: "plain",
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "left",
          lineColor: gridBorderColor,
          lineWidth: 0.1,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: 40,
          lineColor: gridBorderColor,
          lineWidth: 0.1,
          cellPadding: 1.4,
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: "bold" },
          1: { cellWidth: 137 },
        },
      });

      // 3-Tier Dynamic Signature Block (Matching Ventilation & pdfHelpers)
      const sigY = (doc as any).lastAutoTable.finalY + 4;
      const sigData = getSignatureBlockDetails(project?.id || "default", "/plumbing-fire-water-demand", currentUserName);

      const colWidth = contentWidth / 3;
      const rowHeight = 6;
      const sigBoxHeight = 26;

      // Outer signature box
      doc.setDrawColor(...gridBorderColor);
      doc.setLineWidth(0.1);
      doc.rect(margin, sigY, contentWidth, sigBoxHeight);

      // Vertical dividers for 3 columns
      doc.line(margin + colWidth, sigY, margin + colWidth, sigY + sigBoxHeight);
      doc.line(margin + colWidth * 2, sigY, margin + colWidth * 2, sigY + sigBoxHeight);

      // Header Fill
      doc.setFillColor(...signatureFill);
      doc.rect(margin, sigY, contentWidth, rowHeight, "F");

      // Draw header bottom divider line
      doc.line(margin, sigY + rowHeight, margin + contentWidth, sigY + rowHeight);

      // Headers text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text("Originator", margin + colWidth * 0.5, sigY + 4.2, { align: "center" });
      doc.text("Reviewer", margin + colWidth * 1.5, sigY + 4.2, { align: "center" });
      doc.text("Approver", margin + colWidth * 2.5, sigY + 4.2, { align: "center" });

      // Column 1: Originator
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Name:", margin + 2.5, sigY + 10.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.originatedBy || currentUserName, margin + 14, sigY + 10.5);

      doc.setFont("helvetica", "bold");
      doc.text("Role:", margin + 2.5, sigY + 15.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.originatedRole || "Design Engineer", margin + 14, sigY + 15.5);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", margin + 2.5, sigY + 20.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.originatedDate || dateStr, margin + 14, sigY + 20.5);

      // Column 2: Reviewer
      doc.setFont("helvetica", "bold");
      doc.text("Name:", margin + colWidth + 2.5, sigY + 10.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.reviewedBy || "Pending Review", margin + colWidth + 14, sigY + 10.5);

      doc.setFont("helvetica", "bold");
      doc.text("Role:", margin + colWidth + 2.5, sigY + 15.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.reviewedRole || "Sr. Design Engineer", margin + colWidth + 14, sigY + 15.5);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", margin + colWidth + 2.5, sigY + 20.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.reviewedDate || "-", margin + colWidth + 14, sigY + 20.5);

      // Column 3: Approver
      doc.setFont("helvetica", "bold");
      doc.text("Name:", margin + colWidth * 2 + 2.5, sigY + 10.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.approvedBy || "Pending Approval", margin + colWidth * 2 + 15, sigY + 10.5);

      doc.setFont("helvetica", "bold");
      doc.text("Role:", margin + colWidth * 2 + 2.5, sigY + 15.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.approvedRole || "Discipline Coordinator", margin + colWidth * 2 + 15, sigY + 15.5);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", margin + colWidth * 2 + 2.5, sigY + 20.5);
      doc.setFont("helvetica", "normal");
      doc.text(sigData.approvedDate || "-", margin + colWidth * 2 + 15, sigY + 20.5);

      // Save PDF
      doc.save(`Fire_Water_Demand_Calculation_${pNum}_${Date.now()}.pdf`);
      toast.success("PDF calculation report generated successfully!");
    } catch (e) {
      console.error("Failed to generate PDF", e);
      toast.error("Failed to generate PDF report.");
    }
  };

  const isSI = unitSystem === "si";

  return (
    <AppShell
      title="Fire Water Demand"
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
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fire Water Demand</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">
                  Total flow for sprinklers, hydrants, fire pump & tank sizing (NFPA 13/14/20/22)
                </span>
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
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-fire-water-demand" calculatorTitle="Fire Water Demand" />
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
            isApprovedLocked
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
                    Demand Sizer
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
                  title="View NFPA Formulas"
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
                inputDescriptions="Flow Rate (GPM / L/min), Pressure (psi / bar), Storage Tank Volume (gal / m³)"
                conversionExample={
                  unitSystem === "ip"
                    ? "Convert 500 GPM â†’ 1,893 L/min, 65 psi â†’ 4.48 bar, 45,000 gal â†’ 170.3 m³"
                    : "Convert 1,893 L/min â†’ 500 GPM, 4.48 bar â†’ 65 psi, 170.3 m³ â†’ 45,000 gal"
                }
              />
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  
                  {/* Presets Quick Picker Bar */}
                  <div className="bg-muted/20 border border-border/70 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Flame className="size-4 text-orange-500" />
                        <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide">
                          Occupancy Hazard Class / NFPA Standard Preset
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Instant preset loading for sprinkler, hydrant, and duration
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {(Object.keys(HAZARD_PRESETS) as HazardPresetKey[]).map((key) => {
                        const p = HAZARD_PRESETS[key];
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
                            <div className="text-[10px] text-muted-foreground truncate">{p.category}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main Grid: Inputs (Left) & Results (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: PARAMETERS */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* SPRINKLER SYSTEM SECTION */}
                      <div
                        id="card-sprinkler"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          highlightedTargetId === "card-sprinkler" || highlightedTargetId === "spFlow"
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Droplets className="size-4 text-primary" /> Sprinkler System Demand
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            NFPA 13
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Sprinkler Flow */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-spFlow"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "spFlow" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    System Flow ({isSI ? "L/min" : "GPM"})
                                  </label>
                                  {renderCommentBadge("spFlow", "Sprinkler Flow")}
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof spFlow === "number" ? (spFlow * GPM_TO_LMIN).toFixed(0) : spFlow}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setSpFlow("");
                                      else if (isSI) setSpFlow(val / GPM_TO_LMIN);
                                      else setSpFlow(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder="e.g. 500"
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Hydraulic demand from area/density calculation
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Sprinkler Flow (${isSI ? "L/min" : "GPM"})`, isSI && typeof spFlow === "number" ? (spFlow * GPM_TO_LMIN).toFixed(0) : spFlow)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Sprinkler Flow", (val) => {
                                  const num = typeof val === "number" ? val : parseFloat(val);
                                  if (!isNaN(num)) {
                                    if (isSI) setSpFlow(num / GPM_TO_LMIN);
                                    else setSpFlow(num);
                                  } else {
                                    setSpFlow(val);
                                  }
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Sprinkler Flow", setSpFlow, 500);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${(500 * GPM_TO_LMIN).toFixed(0)} L/min` : "500 GPM"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Sprinkler Flow", setSpFlow);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("spFlow", "Sprinkler Flow")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Sprinkler Pressure */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-spPress"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "spPress" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Required Pressure ({isSI ? "bar" : "psi"})
                                  </label>
                                  {renderCommentBadge("spPress", "Sprinkler Pressure")}
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof spPress === "number" ? (spPress * PSI_TO_BAR).toFixed(2) : spPress}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setSpPress("");
                                      else if (isSI) setSpPress(val / PSI_TO_BAR);
                                      else setSpPress(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder="e.g. 65"
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Minimum pressure at remote design sprinkler
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Sprinkler Pressure (${isSI ? "bar" : "psi"})`, isSI && typeof spPress === "number" ? (spPress * PSI_TO_BAR).toFixed(2) : spPress)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Sprinkler Pressure", (val) => {
                                  const num = typeof val === "number" ? val : parseFloat(val);
                                  if (!isNaN(num)) {
                                    if (isSI) setSpPress(num / PSI_TO_BAR);
                                    else setSpPress(num);
                                  } else {
                                    setSpPress(val);
                                  }
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Sprinkler Pressure", setSpPress, 65);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${(65 * PSI_TO_BAR).toFixed(2)} bar` : "65 psi"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Sprinkler Pressure", setSpPress);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("spPress", "Sprinkler Pressure")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* HYDRANTS & STANDPIPE OUTLETS SECTION */}
                      <div
                        id="card-hydrants"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          highlightedTargetId === "card-hydrants" || highlightedTargetId === "hyCount"
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Gauge className="size-4 text-primary" /> External Hydrants / Landing Outlets
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            NFPA 14 / NFPA 24
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Hydrants Count */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-hyCount"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "hyCount" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Simultaneous Hydrant Count
                                  </label>
                                  {renderCommentBadge("hyCount", "Hydrant Count")}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isEffectiveReadOnly}
                                  value={hyCount}
                                  onChange={(e) => {
                                    setHyCount(e.target.value === "" ? "" : parseInt(e.target.value) || 0);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="e.g. 2"
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Typically 1 to 2 simultaneous hydrants (250 GPM each)
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Hydrant Count", hyCount)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Hydrant Count", (val) => {
                                  const num = parseInt(val);
                                  if (!isNaN(num)) setHyCount(num);
                                  else setHyCount(val);
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Hydrant Count", setHyCount, 2);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (2)</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Hydrant Count", setHyCount);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("hyCount", "Hydrant Count")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Flow per Hydrant */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-hyFlow"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "hyFlow" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Flow per Hydrant ({isSI ? "L/min" : "GPM"})
                                  </label>
                                  {renderCommentBadge("hyFlow", "Flow per Hydrant")}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof hyFlow === "number" ? (hyFlow * GPM_TO_LMIN).toFixed(0) : hyFlow}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setHyFlow("");
                                    else if (isSI) setHyFlow(val / GPM_TO_LMIN);
                                    else setHyFlow(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="e.g. 250"
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Total Hydrant: {isSI ? `${(calcResults.hyTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hyTotal} GPM`}
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Flow per Hydrant (${isSI ? "L/min" : "GPM"})`, isSI && typeof hyFlow === "number" ? (hyFlow * GPM_TO_LMIN).toFixed(0) : hyFlow)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Flow per Hydrant", (val) => {
                                  const num = typeof val === "number" ? val : parseFloat(val);
                                  if (!isNaN(num)) {
                                    if (isSI) setHyFlow(num / GPM_TO_LMIN);
                                    else setHyFlow(num);
                                  } else {
                                    setHyFlow(val);
                                  }
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Flow per Hydrant", setHyFlow, 250);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${(250 * GPM_TO_LMIN).toFixed(0)} L/min` : "250 GPM"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Flow per Hydrant", setHyFlow);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("hyFlow", "Flow per Hydrant")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* FIRST-AID HOSE REELS SECTION */}
                      <div
                        id="card-hose-reels"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          highlightedTargetId === "card-hose-reels" || highlightedTargetId === "hrCount"
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Waves className="size-4 text-primary" /> First-Aid Hose Reels (Internal)
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            NFPA 14 Class II
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Hose Reel Count */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-hrCount"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "hrCount" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Simultaneous Hose Reels
                                  </label>
                                  {renderCommentBadge("hrCount", "Hose Reel Count")}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isEffectiveReadOnly}
                                  value={hrCount}
                                  onChange={(e) => {
                                    setHrCount(e.target.value === "" ? "" : parseInt(e.target.value) || 0);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="e.g. 2"
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Inside hose allowance (25–30 GPM per reel)
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Hose Reel Count", hrCount)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Hose Reel Count", (val) => {
                                  const num = parseInt(val);
                                  if (!isNaN(num)) setHrCount(num);
                                  else setHrCount(val);
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Hose Reel Count", setHrCount, 2);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (2)</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Hose Reel Count", setHrCount);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("hrCount", "Hose Reel Count")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Flow per Hose Reel */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-hrFlow"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "hrFlow" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Flow per Reel ({isSI ? "L/min" : "GPM"})
                                  </label>
                                  {renderCommentBadge("hrFlow", "Flow per Reel")}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof hrFlow === "number" ? (hrFlow * GPM_TO_LMIN).toFixed(0) : hrFlow}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setHrFlow("");
                                    else if (isSI) setHrFlow(val / GPM_TO_LMIN);
                                    else setHrFlow(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="e.g. 30"
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Total Hose Reel: {isSI ? `${(calcResults.hrTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hrTotal} GPM`}
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Flow per Reel (${isSI ? "L/min" : "GPM"})`, isSI && typeof hrFlow === "number" ? (hrFlow * GPM_TO_LMIN).toFixed(0) : hrFlow)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Flow per Reel", (val) => {
                                  const num = typeof val === "number" ? val : parseFloat(val);
                                  if (!isNaN(num)) {
                                    if (isSI) setHrFlow(num / GPM_TO_LMIN);
                                    else setHrFlow(num);
                                  } else {
                                    setHrFlow(val);
                                  }
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Flow per Reel", setHrFlow, 30);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${(30 * GPM_TO_LMIN).toFixed(0)} L/min` : "30 GPM"})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Flow per Reel", setHrFlow);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("hrFlow", "Flow per Reel")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* DURATION & STORAGE TANK PARAMETERS */}
                      <div
                        id="card-duration"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          highlightedTargetId === "card-duration" || highlightedTargetId === "designDuration"
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Clock className="size-4 text-primary" /> Storage Tank Sizing Parameters
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            NFPA 22
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Duration */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-designDuration"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "designDuration" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Design Duration (min)
                                  </label>
                                  {renderCommentBadge("designDuration", "Design Duration")}
                                </div>
                                <select
                                  disabled={isEffectiveReadOnly}
                                  value={designDuration}
                                  onChange={(e) => {
                                    setDesignDuration(parseInt(e.target.value) || 60);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-2.5 bg-background border border-input rounded-lg text-[13px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                >
                                  <option value="30">30 min (Light Hazard)</option>
                                  <option value="60">60 min (Ordinary 1)</option>
                                  <option value="90">90 min (Ordinary 2 / Standpipe)</option>
                                  <option value="120">120 min (Extra Hazard)</option>
                                  <option value="180">180 min (Special Hazard)</option>
                                </select>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Design Duration", `${designDuration} min`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Design Duration", setDesignDuration, 60);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (60 min)</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("designDuration", "Design Duration")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Safety Allowance */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-tankReservePct"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "tankReservePct" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Ullage & Silt Reserve (%)
                                  </label>
                                  {renderCommentBadge("tankReservePct", "Ullage & Silt Reserve")}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={tankReservePct}
                                  onChange={(e) => {
                                    setTankReservePct(e.target.value === "" ? "" : parseFloat(e.target.value));
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="e.g. 10"
                                />
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Ullage & Silt Reserve", `${tankReservePct}%`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Ullage & Silt Reserve", (val) => {
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) setTankReservePct(num);
                                  else setTankReservePct(val);
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Ullage & Silt Reserve", setTankReservePct, 10);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (10%)</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Ullage & Silt Reserve", setTankReservePct);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("tankReservePct", "Ullage & Silt Reserve")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* City Mains Refill */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-mainsReplenishFlow"
                                className={`p-3 rounded-xl border transition-all ${
                                  highlightedTargetId === "mainsReplenishFlow" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Mains Replenish ({isSI ? "L/min" : "GPM"})
                                  </label>
                                  {renderCommentBadge("mainsReplenishFlow", "Mains Replenish Flow")}
                                </div>
                                <input
                                  type="number"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof mainsReplenishFlow === "number" ? (mainsReplenishFlow * GPM_TO_LMIN).toFixed(0) : mainsReplenishFlow}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setMainsReplenishFlow("");
                                    else if (isSI) setMainsReplenishFlow(val / GPM_TO_LMIN);
                                    else setMainsReplenishFlow(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder="0 for isolated"
                                />
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue(`Mains Replenish (${isSI ? "L/min" : "GPM"})`, isSI && typeof mainsReplenishFlow === "number" ? (mainsReplenishFlow * GPM_TO_LMIN).toFixed(0) : mainsReplenishFlow)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => handlePasteValue("Mains Replenish", (val) => {
                                  const num = typeof val === "number" ? val : parseFloat(val);
                                  if (!isNaN(num)) {
                                    if (isSI) setMainsReplenishFlow(num / GPM_TO_LMIN);
                                    else setMainsReplenishFlow(num);
                                  } else {
                                    setMainsReplenishFlow(val);
                                  }
                                  dirtyStore.set(true);
                                })}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleResetValue("Mains Replenish", setMainsReplenishFlow, 0);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default (0)</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly}
                                onClick={() => {
                                  handleClearValue("Mains Replenish", setMainsReplenishFlow);
                                  dirtyStore.set(true);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("mainsReplenishFlow", "Mains Replenish Flow")}
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

                    {/* RIGHT COLUMN: CALCULATION RESULTS & ACTION */}
                    <div className="lg:col-span-5 space-y-5">
                      
                      {/* WARNING NOTICES */}
                      {calcResults.showLargeDemandWarning && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">
                              High Flow Demand ({isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow} GPM`})
                            </h4>
                            <p className="text-[11.5px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                              Total simultaneous demand exceeds 2,000 GPM. Consider a dual pump arrangement (e.g. 2 × 50% duty pumps) or verify simultaneous diversity factors with the local Authority Having Jurisdiction (AHJ).
                            </p>
                          </div>
                        </div>
                      )}

                      {calcResults.showRefillExceeds8h && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex gap-3 items-start">
                          <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-[12.5px] font-bold text-rose-900 dark:text-rose-200">
                              Replenishment Time Warning ({calcResults.refillHours?.toFixed(1)} hours)
                            </h4>
                            <p className="text-[11.5px] text-rose-800/80 dark:text-rose-300/80 mt-0.5 leading-relaxed">
                              NFPA 22 Section 5.2 recommends complete tank refill within 8.0 hours. Increase municipal replenishment inflow or adjust storage compartment volume.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* HERO SUMMARY CARD */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-hero-results"
                            className="bg-background border border-border/80 rounded-2xl shadow-xs p-6 space-y-6 relative overflow-hidden"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-5 bg-primary rounded-full" />
                                <h3 className="text-[15px] font-bold text-foreground tracking-wide">
                                  Simultaneous Demand Summary
                                </h3>
                              </div>
                              <div className="flex items-center gap-2">
                                {renderCommentBadge("card-hero-results", "Simultaneous Fire Demand Summary")}
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                                  NFPA 13 / 14 / 20 / 22
                                </span>
                              </div>
                            </div>

                            {/* Top 4 KPI Metrics */}
                            <div className="grid grid-cols-2 gap-3.5">
                              {/* Sprinkler Flow */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Sprinkler Demand
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI ? `${(calcResults.spF * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.spF.toFixed(0)} GPM`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  @ {isSI ? `${(calcResults.spP * PSI_TO_BAR).toFixed(2)} bar` : `${calcResults.spP.toFixed(0)} psi`} residual
                                </div>
                              </div>

                              {/* Hydrants Total */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Hydrants Total
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI ? `${(calcResults.hyTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hyTotal.toFixed(0)} GPM`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {calcResults.hyC} Outlets × {isSI ? (calcResults.hyF * GPM_TO_LMIN).toFixed(0) + " L/min" : calcResults.hyF.toFixed(0) + " GPM"}
                                </div>
                              </div>

                              {/* Hose Reels Total */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                  Hose Reels Total
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {isSI ? `${(calcResults.hrTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hrTotal.toFixed(0)} GPM`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {calcResults.hrC} Reels × {isSI ? (calcResults.hrF * GPM_TO_LMIN).toFixed(0) + " L/min" : calcResults.hrF.toFixed(0) + " GPM"}
                                </div>
                              </div>

                              {/* Combined Total Demand (Hero) */}
                              <div className="p-3.5 rounded-xl bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 border border-[#0A7BC7]/30">
                                <div className="text-[10.5px] font-bold text-[#06456F] dark:text-sky-300 uppercase tracking-wider mb-1">
                                  Total Fire Demand
                                </div>
                                <div className="text-2xl font-black text-[#0A7BC7] dark:text-sky-400">
                                  {isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow.toFixed(0)} GPM`}
                                </div>
                                <div className="text-[10px] font-semibold text-[#06456F]/80 dark:text-sky-300/80 mt-0.5">
                                  ({(calcResults.totalFlow * GPM_TO_M3H).toFixed(1)} m³/h)
                                </div>
                              </div>
                            </div>

                            {/* Pump & Header Sizing Card */}
                            <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                                  <ShieldCheck className="size-4 text-emerald-500" /> Recommended Fire Pump Rating (NFPA 20)
                                </span>
                                <span className="text-[13px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {isSI ? `${(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.recommendedPumpGPM} GPM`}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11.5px] text-muted-foreground pt-2 border-t border-border/40">
                                <span>Minimum Discharge Header Size:</span>
                                <span className="font-bold text-foreground">
                                  {calcResults.recommendedNps}" NPS ({calcResults.recommendedNps * 25} mm) (vel &le; 15 fps)
                                </span>
                              </div>
                            </div>

                            {/* Storage Tank Breakdown Table */}
                            <div className="border border-border/70 rounded-xl overflow-hidden">
                              <div className="bg-muted/40 px-4 py-2.5 border-b border-border/70 flex justify-between items-center">
                                <span className="text-[11.5px] font-bold text-foreground uppercase tracking-wider">
                                  Dedicated Fire Water Storage Sizing
                                </span>
                                <span className="text-[10.5px] font-bold text-primary">
                                  {calcResults.duration} min duration basis
                                </span>
                              </div>

                              <div className="divide-y divide-border/40 text-[12px]">
                                <div className="px-4 py-2 flex justify-between items-center hover:bg-muted/10">
                                  <span className="text-muted-foreground">30 min Duration (Light Hazard)</span>
                                  <span className="font-bold text-foreground">
                                    {calcResults.tank30Effective.toLocaleString()} gal / {(calcResults.tank30Effective * GAL_TO_M3).toFixed(1)} m³
                                  </span>
                                </div>
                                <div className="px-4 py-2 flex justify-between items-center hover:bg-muted/10">
                                  <span className="text-muted-foreground">60 min Duration (Ordinary 1)</span>
                                  <span className="font-bold text-foreground">
                                    {calcResults.tank60Effective.toLocaleString()} gal / {(calcResults.tank60Effective * GAL_TO_M3).toFixed(1)} m³
                                  </span>
                                </div>
                                <div className="px-4 py-2 flex justify-between items-center hover:bg-muted/10">
                                  <span className="text-muted-foreground">90 min Duration (Ordinary 2 / High-Rise)</span>
                                  <span className="font-bold text-foreground">
                                    {calcResults.tank90Effective.toLocaleString()} gal / {(calcResults.tank90Effective * GAL_TO_M3).toFixed(1)} m³
                                  </span>
                                </div>
                                <div className="px-4 py-2 flex justify-between items-center hover:bg-muted/10">
                                  <span className="text-muted-foreground">120 min Duration (Extra Hazard)</span>
                                  <span className="font-bold text-foreground">
                                    {calcResults.tank120Effective.toLocaleString()} gal / {(calcResults.tank120Effective * GAL_TO_M3).toFixed(1)} m³
                                  </span>
                                </div>
                                <div className="px-4 py-3 flex justify-between items-center bg-primary/5 font-bold">
                                  <span className="text-foreground">Total Required Gross Tank Volume (+{calcResults.reservePct}% Ullage)</span>
                                  <span className="text-[14px] text-primary">
                                    {calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal ({(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Export PDF Button */}
                            <div className="pt-2">
                              <button
                                onClick={exportPdf}
                                className="w-full flex items-center justify-center gap-2 bg-[#0A7BC7] hover:bg-[#08629f] text-white rounded-xl py-3 px-4 text-[13px] font-bold transition-all shadow-sm cursor-pointer border-0"
                              >
                                <Printer className="size-4" /> Export PDF
                              </button>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Total Fire Demand", isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow.toFixed(0)} GPM`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Total Demand</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Gross Tank Volume", `${calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal (${(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³)`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Gross Tank Volume</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Recommended Fire Pump", isSI ? `${(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.recommendedPumpGPM} GPM`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Pump Rating</span>
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
                            onClick={() => handleOpenComment("card-hero-results", "Fire Water Demand Summary")}
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
                          Fire Water Demand & Storage Sizing Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          NFPA 13, 14, 20 & 22 Simultaneous Hydraulic Calculations
                        </p>
                      </div>
                      <button
                        onClick={exportPdf}
                        className="flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#08629f] text-white rounded-xl py-2 px-4 text-[12px] font-bold transition-all shadow-xs cursor-pointer border-0"
                      >
                        <Printer className="size-3.5" /> Export PDF
                      </button>
                    </div>

                    {/* Enclosed Project Metadata Grid */}
                    <div className="border border-border rounded-xl p-4 bg-muted/10 grid grid-cols-2 gap-4 text-[12px]">
                      <div>
                        <span className="font-bold text-foreground">Project Name:</span> {project?.name || "Fire Fighting Hydraulic System"}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Date:</span> {formatDateStr(new Date())}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Project Code:</span> {project?.code || project?.id?.substring(0, 8) || "PRJ-FF-001"}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Client:</span> {project?.client || "General Contracting Co."}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Hazard Class:</span> {HAZARD_PRESETS[preset]?.label || "Custom"}
                      </div>
                      <div>
                        <span className="font-bold text-foreground">Author:</span> {currentUserName}
                      </div>
                    </div>

                    {/* Hydraulic Breakdown Table */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Simultaneous Demand Breakdown
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-muted/60 font-bold">
                          <tr>
                            <th className="border border-border p-2 text-left">Component</th>
                            <th className="border border-border p-2 text-center">Design Flow</th>
                            <th className="border border-border p-2 text-center">Metric (m³/h)</th>
                            <th className="border border-border p-2 text-left">Code Standard</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 font-medium">Sprinkler Demand (Q_sp)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? `${(calcResults.spF * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.spF} GPM`}</td>
                            <td className="border border-border p-2 text-center">{(calcResults.spF * GPM_TO_M3H).toFixed(1)} m³/h</td>
                            <td className="border border-border p-2 text-muted-foreground">NFPA 13 Density/Area</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Hydrant Demand (Q_hy)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? `${(calcResults.hyTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hyTotal} GPM`}</td>
                            <td className="border border-border p-2 text-center">{(calcResults.hyTotal * GPM_TO_M3H).toFixed(1)} m³/h</td>
                            <td className="border border-border p-2 text-muted-foreground">NFPA 14 / NFPA 24 ({calcResults.hyC} Outlets)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Hose Reel Demand (Q_hr)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? `${(calcResults.hrTotal * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.hrTotal} GPM`}</td>
                            <td className="border border-border p-2 text-center">{(calcResults.hrTotal * GPM_TO_M3H).toFixed(1)} m³/h</td>
                            <td className="border border-border p-2 text-muted-foreground">NFPA 14 Class II ({calcResults.hrC} Reels)</td>
                          </tr>
                          <tr className="bg-primary/10 font-bold">
                            <td className="border border-border p-2 text-primary">TOTAL SIMULTANEOUS DEMAND (Q_total)</td>
                            <td className="border border-border p-2 text-center text-primary text-[13px]">{isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow} GPM`}</td>
                            <td className="border border-border p-2 text-center text-primary">{(calcResults.totalFlow * GPM_TO_M3H).toFixed(1)} m³/h</td>
                            <td className="border border-border p-2 text-primary">Simultaneous Operating Basis</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Storage Tank Table */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Fire Water Storage Capacity & Fire Pump Rating
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-muted/60 font-bold">
                          <tr>
                            <th className="border border-border p-2 text-left">Equipment / Tank Sizing Parameter</th>
                            <th className="border border-border p-2 text-center">US Units</th>
                            <th className="border border-border p-2 text-center">Metric (SI)</th>
                            <th className="border border-border p-2 text-left">Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 font-medium">Recommended NFPA 20 Fire Pump Rating</td>
                            <td className="border border-border p-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{calcResults.recommendedPumpGPM} GPM</td>
                            <td className="border border-border p-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min</td>
                            <td className="border border-border p-2 text-muted-foreground">Standard Listed Rating &ge; Q_total</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 font-medium">Design Duration Net Storage ({calcResults.duration} min)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.selectedDurationEffective.toLocaleString()} gal</td>
                            <td className="border border-border p-2 text-center">{(calcResults.selectedDurationEffective * GAL_TO_M3).toFixed(1)} m³</td>
                            <td className="border border-border p-2 text-muted-foreground">Net Effective Volume (V_eff)</td>
                          </tr>
                          <tr className="bg-primary/10 font-bold">
                            <td className="border border-border p-2 text-primary">Total Dedicated Gross Tank Volume (+{calcResults.reservePct}% Ullage)</td>
                            <td className="border border-border p-2 text-center text-primary text-[13px]">{calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal</td>
                            <td className="border border-border p-2 text-center text-primary">{(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³</td>
                            <td className="border border-border p-2 text-primary">NFPA 22 Dedicated Tank Dimensioning</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* 3-Tier Signature Preview */}
                    <div className="pt-4 border-t border-border">
                      <div className="border border-border rounded-xl overflow-hidden grid grid-cols-3 text-center">
                        <div className="bg-[#FFE6CC] dark:bg-amber-950/40 p-2 font-bold text-[11px] border-b border-border border-r">
                          Originator
                        </div>
                        <div className="bg-[#FFE6CC] dark:bg-amber-950/40 p-2 font-bold text-[11px] border-b border-border border-r">
                          Reviewer
                        </div>
                        <div className="bg-[#FFE6CC] dark:bg-amber-950/40 p-2 font-bold text-[11px] border-b border-border">
                          Approver
                        </div>

                        <div className="p-3 text-[11px] border-r border-border space-y-1">
                          <div className="font-bold text-foreground">{currentUserName}</div>
                          <div className="text-muted-foreground">Design Engineer</div>
                          <div className="text-[10px] text-muted-foreground">{formatDateStr(new Date())}</div>
                        </div>
                        <div className="p-3 text-[11px] border-r border-border space-y-1">
                          <div className="font-bold text-foreground">Sr. Design Engineer</div>
                          <div className="text-muted-foreground">Peer Review</div>
                          <div className="text-[10px] text-muted-foreground">Status Dependent</div>
                        </div>
                        <div className="p-3 text-[11px] space-y-1">
                          <div className="font-bold text-foreground">Discipline Coordinator</div>
                          <div className="text-muted-foreground">Coordinator Approval</div>
                          <div className="text-[10px] text-muted-foreground">Status Dependent</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Intelligence Drawer (Smooth Flex Transition Matching Ventilation/FM200) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-2 border border-border rounded-2xl bg-card shadow-lg" : "w-0"
          }`}
        >
          {intelOpen && (
            <FireWaterDemandIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              onSelectPreset={handleApplyPreset}
              isEffectiveReadOnly={isEffectiveReadOnly}
              unitSystem={unitSystem}
              setFormulaModalOpen={setFormulaModalOpen}
            />
          )}
        </div>
      </div>

      {/* Task Assignment Modal (Matching Preliminary Cooling Load & FM-200) */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Fire Water Demand Parameter"
          calculatorTitle="Fire Water Demand"
          calculatorPath="/plumbing-fire-water-demand"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}

      {/* Mathematical Formula Reference Modal */}
      {formulaModalOpen && (
        <FireWaterDemandFormulaModal
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
function FireWaterDemandIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  setFormulaModalOpen,
}: {
  onClose: () => void;
  calcResults: any;
  preset: HazardPresetKey;
  onSelectPreset: (key: HazardPresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  setFormulaModalOpen: (open: boolean) => void;
}) {
  const isSI = unitSystem === "si";

  return (
    <div className="h-full flex flex-col min-w-[360px] p-4 space-y-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-[13px] font-bold text-foreground">NFPA 13/20/22 Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Active Hazard Summary */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Active Preset</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            {HAZARD_PRESETS[preset]?.category}
          </span>
        </div>
        <p className="text-[12px] font-bold text-foreground">
          {HAZARD_PRESETS[preset]?.label}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {HAZARD_PRESETS[preset]?.description}
        </p>
      </div>

      {/* Key Quick Checks */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Live Engineering Verification
        </div>

        <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-[11.5px]">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Simultaneous Demand:</span>
            <span className="font-bold text-foreground">
              {isSI ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.totalFlow} GPM`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">NFPA 20 Listed Pump Size:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {isSI ? `${(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min` : `${calcResults.recommendedPumpGPM} GPM`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Gross Storage Volume:</span>
            <span className="font-bold text-primary">
              {calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal ({(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Discharge Header Size:</span>
            <span className="font-bold text-foreground">{calcResults.recommendedNps}" NPS ({calcResults.recommendedNps * 25} mm)</span>
          </div>
        </div>
      </div>

      {/* NFPA Guidelines Cheat Sheet */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          NFPA Standards Summary
        </div>
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">NFPA 13 Table 19.3.2 - Hose Streams</div>
            <p>LH: 100 GPM (30 min), OH: 250 GPM (60–90 min), EH: 500 GPM (90–120 min) hose stream allowances added to sprinkler demand.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">NFPA 20 Section 4.14 - Pump Sizing</div>
            <p>Select closest rated standard pump capacity &ge; total simultaneous demand. Max velocity in suction pipe &le; 15 fps.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">NFPA 22 Section 5.2 - Dedicated Storage</div>
            <p>Provide minimum +10% dead storage and vortex allowance. Refill replenishment should recharge within 8.0 hours.</p>
          </div>
        </div>
      </div>

      {/* Open Formula Reference Button */}
      <div className="pt-2">
        <button
          onClick={() => setFormulaModalOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-bold transition-colors cursor-pointer"
        >
          <HelpCircle className="size-3.5" /> View Mathematical Equations
        </button>
      </div>
    </div>
  );
}

// Formula Reference Modal
function FireWaterDemandFormulaModal({
  onClose,
  calcResults,
  preset,
  unitSystem,
}: {
  onClose: () => void;
  calcResults: any;
  preset: HazardPresetKey;
  unitSystem: "ip" | "si";
}) {
  const isSI = unitSystem === "si";
  const presetConfig = HAZARD_PRESETS[preset];

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
              <h3 className="font-bold text-base text-foreground">NFPA 13 / 14 / 20 / 22 Formula Breakdown</h3>
              <p className="text-[11.5px] text-muted-foreground">
                Step-by-step hydraulic demand & storage reservoir capacity calculation
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
          
          {/* Section 1: Total Demand */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Flame className="size-4 text-orange-500" />
                <span>1. Total Simultaneous Fire Water Demand (Q_total)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                NFPA 13 & 14
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              Q_total = Q_sprinkler + Q_hydrant + Q_hose_reel
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Automatic Sprinklers (Q_sp):</span>
                <span className="font-mono font-medium text-foreground">
                  {isSI
                    ? `${(calcResults.spF * GPM_TO_LMIN).toFixed(0)} L/min (${calcResults.spF} GPM)`
                    : `${calcResults.spF} GPM`}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">
                  External Hydrants (Q_hy = N_hy × q_hy):
                </span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.hyC} ea × {calcResults.hyF} GPM ={" "}
                  {isSI
                    ? `${(calcResults.hyTotal * GPM_TO_LMIN).toFixed(0)} L/min (${calcResults.hyTotal} GPM)`
                    : `${calcResults.hyTotal} GPM`}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">
                  First-Aid Hose Reels (Q_hr = N_hr × q_hr):
                </span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.hrC} ea × {calcResults.hrF} GPM ={" "}
                  {isSI
                    ? `${(calcResults.hrTotal * GPM_TO_LMIN).toFixed(0)} L/min (${calcResults.hrTotal} GPM)`
                    : `${calcResults.hrTotal} GPM`}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 text-primary font-bold text-[13px]">
                <span>Total Simultaneous Demand (Q_total):</span>
                <span className="font-mono">
                  {isSI
                    ? `${(calcResults.totalFlow * GPM_TO_LMIN).toFixed(0)} L/min (${calcResults.totalFlow} GPM)`
                    : `${calcResults.totalFlow} GPM`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Dedicated Water Storage Tank */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Droplets className="size-4 text-blue-500" />
                <span>2. Water Storage Reservoir Sizing (V_effective & V_gross)</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                NFPA 22 Standard
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary space-y-0.5">
              <div>V_effective = Q_total × T_duration</div>
              <div>V_gross = V_effective × (1 + Allowance% / 100)</div>
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Hazard Class & Mandatory Duration:</span>
                <span className="font-medium text-foreground">
                  {presetConfig?.label || preset} ({calcResults.duration} min)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Net Effective Volume (V_eff):</span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.totalFlow} GPM × {calcResults.duration} min ={" "}
                  {calcResults.selectedDurationEffective.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal (
                  {(calcResults.selectedDurationEffective * GAL_TO_M3).toFixed(1)} m³)
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Dead Storage / Vortex Plate Allowance:</span>
                <span className="font-mono font-medium text-foreground">+{calcResults.reservePct}%</span>
              </div>
              <div className="flex justify-between pt-1.5 text-blue-600 dark:text-blue-400 font-bold text-[13px]">
                <span>Total Dedicated Storage Required (V_gross):</span>
                <span className="font-mono">
                  {calcResults.selectedDurationGross.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal (
                  {(calcResults.selectedDurationGross * GAL_TO_M3).toFixed(1)} m³)
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Fire Pump Sizing & Velocity Header */}
          <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground flex items-center gap-1.5">
                <Gauge className="size-4 text-emerald-500" />
                <span>3. NFPA 20 Fire Pump Selection & Header Hydraulics</span>
              </span>
              <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                NFPA 20 Section 4.14
              </span>
            </div>

            <div className="bg-surface-2 p-2.5 rounded-xl font-mono text-xs text-center border border-border font-bold text-primary">
              d_header = √((0.4085 × Q_total) / v_max) where v_max = 15 fps (4.57 m/s)
            </div>

            <div className="space-y-1.5 bg-background p-3 rounded-xl border border-border/60 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">NFPA 20 Listed Rated Pump Size:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {isSI
                    ? `${(calcResults.recommendedPumpGPM * GPM_TO_LMIN).toFixed(0)} L/min (${calcResults.recommendedPumpGPM} GPM)`
                    : `${calcResults.recommendedPumpGPM} GPM`}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">Calculated Min Header Internal Diameter:</span>
                <span className="font-mono font-medium text-foreground">
                  {calcResults.calculatedPipeDiaInches.toFixed(2)} inches ({(calcResults.calculatedPipeDiaInches * 25.4).toFixed(1)} mm)
                </span>
              </div>
              <div className="flex justify-between pt-1.5 text-foreground font-semibold text-xs">
                <span>Recommended Standard Header Size:</span>
                <span className="font-mono font-bold text-primary">
                  {calcResults.recommendedNps}" NPS ({calcResults.recommendedNps * 25} mm Nominal)
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Refill Rate (if configured) */}
          {calcResults.mainsRefill > 0 && (
            <div className="border border-border/70 rounded-2xl p-4 bg-surface-2/40 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">Municipal Replenishment Refill Time</span>
                <span className="font-mono font-semibold text-primary">
                  {calcResults.refillHours !== null ? `${calcResults.refillHours.toFixed(1)} hours` : "N/A"}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Refill rate: <strong>{calcResults.mainsRefill} GPM</strong>. NFPA 22 Section 5.2 recommends automatic replenishment to fully refill the dedicated fire reservoir within <strong>8.0 hours</strong>.
              </p>
            </div>
          )}

          {/* Code Reference Footnote */}
          <div className="bg-surface-2/70 p-3 rounded-xl border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
            <strong>NFPA Compliance Summary:</strong> All calculations adhere to NFPA 13 (Standard for Installation of Sprinkler Systems), NFPA 14 (Standpipe and Hose Systems), NFPA 20 (Stationary Fire Pumps), and NFPA 22 (Water Storage Tanks for Fire Protection).
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
