import { calculateHeatingLoad, SQFT_TO_SQM, SQM_TO_SQFT, FT_TO_M, M_TO_FT, U_IP_TO_SI, U_SI_TO_IP, CFM_TO_LPS, LPS_TO_CFM, BTU_HR_TO_KW, KW_TO_BTU_HR } from "@/lib/calc-heating-load";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { getMergedItemComments } from "@/utils/commentHelpers";
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
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight,
  Thermometer, Flame, Building2, Building, Home, School, Stethoscope, Store, Warehouse, Sun, Wind,
  GraduationCap, SlidersHorizontal
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
import { TBtn } from "@/components/workspace/Button";
import { HeatingProfileSelect } from "@/components/workspace/HeatingProfileSelect";
import { CustomHeatingConfigModal } from "@/components/workspace/CustomHeatingConfigModal";

export const Route = createFileRoute("/heating-load")({
  head: () => ({
    meta: [
      { title: "Winter Heating Load Calculator — MEP Calc" },
      { name: "description", content: "Calculate building envelope heat losses, infiltration/ventilation loads, and boiler/heater capacity per ASHRAE Fundamentals." },
    ],
  }),
  component: HeatingLoadPage,
});

export type HeatingPresetKey =
  | "commercial_office"
  | "residential_house"
  | "educational_school"
  | "healthcare_clinic"
  | "retail_showroom"
  | "warehouse_storage"
  | "custom";

export interface HeatingPresetConfig {
  key: HeatingPresetKey;
  label: string;
  category: string;
  description: string;
  area: number; // sq ft
  height: number; // ft
  uWall: number; // BTU/hr·ft²·°F
  uRoof: number; // BTU/hr·ft²·°F
  uGlaz: number; // BTU/hr·ft²·°F
  glazArea: number; // sq ft
  oat: number; // °F (Outdoor design temp)
  iat: number; // °F (Indoor setpoint)
  ach: number; // Infiltration ACH
  ventCfm: number; // Ventilation fresh air CFM
  safetyMargin: number; // %
}

export const HEATING_PRESETS: Record<HeatingPresetKey, HeatingPresetConfig> = {
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office",
    category: "ASHRAE 90.1 / Office",
    description: "Multi-story commercial office building with insulated curtain wall and fresh air ventilation.",
    area: 5000,
    height: 10,
    uWall: 0.065,
    uRoof: 0.035,
    uGlaz: 0.32,
    glazArea: 600,
    oat: 20,
    iat: 70,
    ach: 0.35,
    ventCfm: 450,
    safetyMargin: 15,
  },
  residential_house: {
    key: "residential_house",
    label: "Residential Home / Villa",
    category: "IECC / Residential",
    description: "Modern single/multi-family residence with thermal double-glazed windows and insulated roof.",
    area: 2500,
    height: 9,
    uWall: 0.055,
    uRoof: 0.028,
    uGlaz: 0.30,
    glazArea: 350,
    oat: 15,
    iat: 68,
    ach: 0.45,
    ventCfm: 120,
    safetyMargin: 15,
  },
  educational_school: {
    key: "educational_school",
    label: "School / Classrooms",
    category: "ASHRAE 62.1 / School",
    description: "Educational facility with high outdoor air ventilation requirement for indoor air quality.",
    area: 8000,
    height: 12,
    uWall: 0.060,
    uRoof: 0.032,
    uGlaz: 0.35,
    glazArea: 900,
    oat: 25,
    iat: 72,
    ach: 0.50,
    ventCfm: 1200,
    safetyMargin: 20,
  },
  healthcare_clinic: {
    key: "healthcare_clinic",
    label: "Healthcare Clinic",
    category: "ASHRAE 170 / Health",
    description: "Outpatient clinical facility with continuous 100% fresh air ventilation and tight temperature control.",
    area: 4000,
    height: 10,
    uWall: 0.050,
    uRoof: 0.030,
    uGlaz: 0.28,
    glazArea: 400,
    oat: 20,
    iat: 72,
    ach: 0.60,
    ventCfm: 800,
    safetyMargin: 20,
  },
  retail_showroom: {
    key: "retail_showroom",
    label: "Retail Showroom",
    category: "Commercial / High Glazing",
    description: "Commercial retail shop or vehicle showroom with large storefront perimeter glazing.",
    area: 6000,
    height: 14,
    uWall: 0.070,
    uRoof: 0.040,
    uGlaz: 0.38,
    glazArea: 1800,
    oat: 25,
    iat: 70,
    ach: 0.40,
    ventCfm: 600,
    safetyMargin: 15,
  },
  warehouse_storage: {
    key: "warehouse_storage",
    label: "Warehouse / Storage",
    category: "Industrial / Low Infiltration",
    description: "High-ceiling storage facility or logistics center with basic envelope insulation and minimal glazing.",
    area: 15000,
    height: 20,
    uWall: 0.090,
    uRoof: 0.050,
    uGlaz: 0.45,
    glazArea: 300,
    oat: 20,
    iat: 60,
    ach: 0.25,
    ventCfm: 300,
    safetyMargin: 20,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Engineering",
    description: "User-defined building geometries, envelope thermal properties, and climate criteria.",
    area: 5000,
    height: 10,
    uWall: 0.065,
    uRoof: 0.035,
    uGlaz: 0.32,
    glazArea: 600,
    oat: 20,
    iat: 70,
    ach: 0.35,
    ventCfm: 450,
    safetyMargin: 15,
  },
};

// Conversion Constants
const SQFT_TO_SQM = 0.092903;
const SQM_TO_SQFT = 10.7639;
const FT_TO_M = 0.3048;
const M_TO_FT = 3.28084;
const U_IP_TO_SI = 5.678263; // BTU/hr·ft²·°F -> W/m²K
const U_SI_TO_IP = 0.17611;  // W/m²K -> BTU/hr·ft²·°F
const CFM_TO_LPS = 0.471947;
const LPS_TO_CFM = 2.11888;
const BTU_HR_TO_KW = 0.000293071;
const KW_TO_BTU_HR = 3412.142;

const presetIcons: Record<HeatingPresetKey, React.ComponentType<{ className?: string }>> = {
  commercial_office: Building2,
  residential_house: Home,
  educational_school: GraduationCap,
  healthcare_clinic: Stethoscope,
  retail_showroom: Store,
  warehouse_storage: Warehouse,
  custom: SlidersHorizontal,
};

function HeatingLoadPage() {
  const { project, activeProjectId } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/heating-load", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/heating-load", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Design Engineer";

  // Calculation Lock & Review State
  const isApprovedLocked = calcReviewState?.status === "APPROVED";

  // Active Tab & Drawer
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const isSI = unitSystem === "si";

  // Preset Selection
  const [preset, setPreset] = useState<HeatingPresetKey>("commercial_office");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProfileName, setCustomProfileName] = useState("Commercial Office (Custom)");
  const [customWorkflow, setCustomWorkflow] = useState<"calculate" | "direct">("calculate");

  // Core State (Stored internally in IP units)
  const [area, setArea] = useState<number | "">(5000); // sq ft
  const [height, setHeight] = useState<number | "">(10); // ft
  const [uWall, setUWall] = useState<number | "">(0.065); // BTU/hr·ft²·°F
  const [uRoof, setURoof] = useState<number | "">(0.035); // BTU/hr·ft²·°F
  const [uGlaz, setUGlaz] = useState<number | "">(0.32); // BTU/hr·ft²·°F
  const [glazArea, setGlazArea] = useState<number | "">(600); // sq ft
  const [oat, setOat] = useState<number | "">(20); // °F
  const [iat, setIat] = useState<number | "">(70); // °F
  const [ach, setAch] = useState<number | "">(0.35); // ACH
  const [ventCfm, setVentCfm] = useState<number | "">(450); // CFM
  const [safetyMargin, setSafetyMargin] = useState<number | "">(15); // %

  // Comments / Collaboration State
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments on project switch and cross-tab/sync events
  const loadComments = () => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/heating-load`;
    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(`mep_calc_comments_${pId}_heating-load`) || localStorage.getItem(`mep_comments_${pId}_/heating-load`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCommentsList(parsed);
          return;
        }
      }
      setCommentsList([]);
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  };

  useEffect(() => {
    loadComments();
    const handleCommentUpdate = () => loadComments();
    window.addEventListener("mep_notif_tick", handleCommentUpdate);
    window.addEventListener("mep_notification_received", handleCommentUpdate);
    window.addEventListener("mep-notification-added", handleCommentUpdate);
    window.addEventListener("mep-comment-updated", handleCommentUpdate);
    window.addEventListener("storage", handleCommentUpdate);
    return () => {
      window.removeEventListener("mep_notif_tick", handleCommentUpdate);
      window.removeEventListener("mep_notification_received", handleCommentUpdate);
      window.removeEventListener("mep-notification-added", handleCommentUpdate);
      window.removeEventListener("mep-comment-updated", handleCommentUpdate);
      window.removeEventListener("storage", handleCommentUpdate);
    };
  }, [project?.id]);

  // Handle URL Notification / Comment Highlighting
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
      const targetId = params.get("commentTargetId") || params.get("targetId");
      const targetName = params.get("commentTargetName") || params.get("targetName");
      if (targetId || targetName) {
        setTimeout(() => {
          handleScrollTarget(targetId || undefined, targetName || undefined);
        }, 300);
      }
    }

    // 2. Listen to custom events from Notification Center navigation
    const handleScrollEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        handleScrollTarget(detail.id || detail.targetId || detail.fieldId, detail.name || detail.targetName || detail.fieldName);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollEvent);
    window.addEventListener("mep-highlight-comment-target", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollEvent);
      window.removeEventListener("mep-highlight-comment-target", handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/heating-load`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new CustomEvent("mep-comment-updated"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/heating-load", count: newList.length });
          bc.close();
        } catch (e) {}
      }
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "area";
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || "Heating Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Heating Load Parameter",
      calculatorTitle: "Winter Heating Load",
      calculatorPath: "/heating-load",
      projectId: project?.id || "default",
      projectName: project?.name || "Commercial Heating Design",
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
        "Winter Heating Load",
        targetName,
        commentData.text || "",
        "/heating-load",
        targetId
      );
    } else {
      dispatchGlobalCommentNotification(
        "Winter Heating Load",
        targetName,
        commentData.text || "",
        "/heating-load",
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
      if (c.status === "RESOLVED") return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.targetItemId || c.id || "").toLowerCase().trim();
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

      const tName = String(c.targetName || c.spaceName || c.fieldName || "").toLowerCase().trim();
      if (!tName) return false;

      if ((cleanRaw === "area") && (tName.includes("area") || tName.includes("floor area"))) return true;
      if ((cleanRaw === "height") && (tName.includes("height") || tName.includes("ceiling height"))) return true;
      if ((cleanRaw === "uwall") && (tName.includes("wall") || tName.includes("u-wall"))) return true;
      if ((cleanRaw === "uroof") && (tName.includes("roof") || tName.includes("u-roof"))) return true;
      if ((cleanRaw === "uglaz") && (tName.includes("glaz") || tName.includes("fenestration"))) return true;
      if ((cleanRaw === "glazarea") && (tName.includes("window") || tName.includes("glazing area"))) return true;
      if ((cleanRaw === "oat") && (tName.includes("outdoor") || tName.includes("oat"))) return true;
      if ((cleanRaw === "iat") && (tName.includes("indoor") || tName.includes("setpoint"))) return true;
      if ((cleanRaw === "ach") && (tName.includes("infiltration") || tName.includes("ach"))) return true;
      if ((cleanRaw === "ventcfm") && (tName.includes("ventilation") || tName.includes("fresh air"))) return true;
      if ((cleanRaw === "safetymargin") && (tName.includes("safety") || tName.includes("margin"))) return true;
      if ((cleanRaw === "presets" || cleanRaw === "card-presets") && (tName.includes("preset") || tName.includes("profile"))) return true;
      if ((cleanRaw === "hero-results" || cleanRaw === "card-hero-results" || cleanRaw === "results") && (tName.includes("summary") || tName.includes("capacity") || tName.includes("results"))) return true;
      if ((cleanRaw === "geometry" || cleanRaw === "card-geometry") && (tName.includes("geometry") || tName.includes("enclosure"))) return true;
      if ((cleanRaw === "envelope" || cleanRaw === "card-envelope") && (tName.includes("envelope") || tName.includes("thermal"))) return true;
      if ((cleanRaw === "climate" || cleanRaw === "card-climate") && (tName.includes("climate") || tName.includes("design condition"))) return true;
      if ((cleanRaw === "ventilation" || cleanRaw === "card-ventilation") && (tName.includes("ventilation") || tName.includes("infiltration"))) return true;

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

  // Clipboard Helpers
  const handleCopyValue = (label: string, value: any) => {
    navigator.clipboard.writeText(String(value));
    toast.success(`Copied ${label}: ${value}`);
  };

  const handlePasteValue = async (label: string, setter: (v: number) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = text.replace(/[^0-9.-]/g, "");
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        setter(num);
        dirtyStore.set(true);
        toast.success(`Pasted into ${label}: ${num}`);
      } else {
        toast.error("Clipboard does not contain a valid number");
      }
    } catch {
      toast.error("Failed to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (v: any) => void, defaultVal: any) => {
    setter(defaultVal);
    dirtyStore.set(true);
    toast.info(`Reset ${label} to default (${defaultVal})`);
  };

  const handleClearValue = (label: string, setter: (v: any) => void) => {
    setter("");
    dirtyStore.set(true);
    toast.info(`Cleared ${label}`);
  };

  // Preset Handler
  const handleApplyPreset = (key: HeatingPresetKey) => {
    if (isEffectiveReadOnly) return;
    if (key === "custom") {
      setPreset("custom");
      setCustomModalOpen(true);
      return;
    }
    setPreset(key);
    const p = HEATING_PRESETS[key];
    if (p) {
      setArea(p.area);
      setHeight(p.height);
      setUWall(p.uWall);
      setURoof(p.uRoof);
      setUGlaz(p.uGlaz);
      setGlazArea(p.glazArea);
      setOat(p.oat);
      setIat(p.iat);
      setAch(p.ach);
      setVentCfm(p.ventCfm);
      setSafetyMargin(p.safetyMargin);
      setCustomProfileName(`${p.label} (Custom)`);
      dirtyStore.set(true);
      toast.success(`Applied ${p.label} preset!`);
    }
  };

  const handleApplyCustomConfig = (updated: {
    area: number;
    height: number;
    uWall: number;
    uRoof: number;
    uGlaz: number;
    glazArea: number;
    oat: number;
    iat: number;
    ach: number;
    ventCfm: number;
    safetyMargin: number;
    customProfileName: string;
    customWorkflow: "calculate" | "direct";
  }) => {
    if (isEffectiveReadOnly) return;
    setPreset("custom");
    setCustomProfileName(updated.customProfileName);
    setCustomWorkflow(updated.customWorkflow);
    setArea(updated.area);
    setHeight(updated.height);
    setUWall(updated.uWall);
    setURoof(updated.uRoof);
    setUGlaz(updated.uGlaz);
    setGlazArea(updated.glazArea);
    setOat(updated.oat);
    setIat(updated.iat);
    setAch(updated.ach);
    setVentCfm(updated.ventCfm);
    setSafetyMargin(updated.safetyMargin);
    dirtyStore.set(true);
  };

  // Unit Switcher Handler
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.info(`Switched units to ${targetUnit === "si" ? "Metric (SI)" : "Imperial (IP)"}`);
  };

  // Heating Calculation Engine per ASHRAE Fundamentals
  const calcResults = useMemo(() => {
    const areaVal = typeof area === "number" ? Math.max(0, area) : 5000;
    const heightVal = typeof height === "number" ? Math.max(0, height) : 10;
    const uWallVal = typeof uWall === "number" ? Math.max(0, uWall) : 0.065;
    const uRoofVal = typeof uRoof === "number" ? Math.max(0, uRoof) : 0.035;
    const uGlazVal = typeof uGlaz === "number" ? Math.max(0, uGlaz) : 0.32;
    const glazAreaVal = typeof glazArea === "number" ? Math.max(0, glazArea) : 600;
    const oatVal = typeof oat === "number" ? oat : 20;
    const iatVal = typeof iat === "number" ? iat : 70;
    const achVal = typeof ach === "number" ? Math.max(0, ach) : 0.35;
    const ventCfmVal = typeof ventCfm === "number" ? Math.max(0, ventCfm) : 450;
    const sfVal = typeof safetyMargin === "number" ? Math.max(0, safetyMargin) : 15;

    // Design Temperature Difference ΔT (°F)
    const deltaTF = Math.max(0, iatVal - oatVal);
    const deltaTC = deltaTF / 1.8;

    // Building Envelope Geometries (assumes square footprint for perimeter estimation)
    const sideLength = Math.sqrt(areaVal);
    const perimeterFt = sideLength * 4;
    const grossWallAreaFt2 = perimeterFt * heightVal;
    const netWallAreaFt2 = Math.max(0, grossWallAreaFt2 - glazAreaVal);
    const roofAreaFt2 = areaVal;
    const volumeFt3 = areaVal * heightVal;

    // Conduction Heat Losses (BTU/hr)
    const qWall = uWallVal * netWallAreaFt2 * deltaTF;
    const qRoof = uRoofVal * roofAreaFt2 * deltaTF;
    const qGlaz = uGlazVal * glazAreaVal * deltaTF;
    const slabFp = 0.50; // BTU/hr·ft·°F (unheated slab perimeter factor)
    const qSlab = slabFp * perimeterFt * deltaTF;
    const qTotalCond = qWall + qRoof + qGlaz + qSlab;

    // Infiltration Heat Loss (BTU/hr)
    // Q_infil = 1.08 * CFM_infil * ΔT, where CFM_infil = (Volume * ACH) / 60
    const infilCfm = (volumeFt3 * achVal) / 60;
    const qInfil = 1.08 * infilCfm * deltaTF;

    // Fresh Air Ventilation Heat Loss (BTU/hr)
    // Q_vent = 1.08 * CFM_vent * ΔT
    const qVent = 1.08 * ventCfmVal * deltaTF;

    const qTotalAir = qInfil + qVent;

    // Base Total Building Heat Loss
    const qBase = qTotalCond + qTotalAir;

    // Sized Total Heating Load with Safety/Pick-up Margin
    const qTotal = qBase * (1 + sfVal / 100);

    // Kilowatt Equivalents
    const kwBase = qBase * BTU_HR_TO_KW;
    const kwTotal = qTotal * BTU_HR_TO_KW;
    const kwWall = qWall * BTU_HR_TO_KW;
    const kwRoof = qRoof * BTU_HR_TO_KW;
    const kwGlaz = qGlaz * BTU_HR_TO_KW;
    const kwSlab = qSlab * BTU_HR_TO_KW;
    const kwInfil = qInfil * BTU_HR_TO_KW;
    const kwVent = qVent * BTU_HR_TO_KW;

    // Load Density Indices
    const loadDensityBtuPerSqft = areaVal > 0 ? qTotal / areaVal : 0;
    const loadDensityWPerSqm = (areaVal * SQFT_TO_SQM) > 0 ? (kwTotal * 1000) / (areaVal * SQFT_TO_SQM) : 0;

    // Percentage Breakdown
    const pctWall = qBase > 0 ? (qWall / qBase) * 100 : 0;
    const pctRoof = qBase > 0 ? (qRoof / qBase) * 100 : 0;
    const pctGlaz = qBase > 0 ? (qGlaz / qBase) * 100 : 0;
    const pctSlab = qBase > 0 ? (qSlab / qBase) * 100 : 0;
    const pctInfil = qBase > 0 ? (qInfil / qBase) * 100 : 0;
    const pctVent = qBase > 0 ? (qVent / qBase) * 100 : 0;

    return {
      deltaTF,
      deltaTC,
      perimeterFt,
      grossWallAreaFt2,
      netWallAreaFt2,
      roofAreaFt2,
      volumeFt3,
      infilCfm,
      qWall,
      qRoof,
      qGlaz,
      qSlab,
      qTotalCond,
      qInfil,
      qVent,
      qTotalAir,
      qBase,
      qTotal,
      kwBase,
      kwTotal,
      kwWall,
      kwRoof,
      kwGlaz,
      kwSlab,
      kwInfil,
      kwVent,
      loadDensityBtuPerSqft,
      loadDensityWPerSqm,
      pctWall,
      pctRoof,
      pctGlaz,
      pctSlab,
      pctInfil,
      pctVent,
    };
  }, [area, height, uWall, uRoof, uGlaz, glazArea, oat, iat, ach, ventCfm, safetyMargin]);

  // Export to PDF (matching Ventilation & MEP Standard: 1 Page, exact styling, blue highlights, peach signatures)
  const exportPdf = () => {
    try {
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

      const calcNo = (project as any)?.calcNo || "TRV-CAL-HEAT-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Commercial Heating Design";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title (matching Ventilation)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Winter Heating Load Calculation Report", 14, 13);

      // Metadata Block (182mm width: left 14mm to right 196mm, height 17mm)
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17);

      // Vertical dividing line
      doc.line(105, 16, 105, 33);

      // Horizontal dividing lines
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

      // Table 1: Design Parameters & Envelope Properties
      const paramTableBody = [
        ["1", "Conditioned Floor Area (A_floor)", isSI ? `${(Number(area) * SQFT_TO_SQM).toFixed(1)}` : `${Number(area).toFixed(0)}`, isSI ? "m2" : "sq ft", "Architectural Space Layout"],
        ["2", "Ceiling Clear Height (H)", isSI ? `${(Number(height) * FT_TO_M).toFixed(2)}` : `${Number(height).toFixed(1)}`, isSI ? "m" : "ft", "Section Clear Room Height"],
        ["3", "Exterior Wall Thermal Transmittance (U_wall)", isSI ? `${(Number(uWall) * U_IP_TO_SI).toFixed(2)}` : `${Number(uWall).toFixed(3)}`, isSI ? "W/m2K" : "BTU/hr.ft2.F", "ASHRAE 90.1 Envelope Table 5.5"],
        ["4", "Roof / Ceiling Transmittance (U_roof)", isSI ? `${(Number(uRoof) * U_IP_TO_SI).toFixed(2)}` : `${Number(uRoof).toFixed(3)}`, isSI ? "W/m2K" : "BTU/hr.ft2.F", "Insulated Roof Deck Assembly"],
        ["5", "Fenestration / Glazing Transmittance (U_glaz)", isSI ? `${(Number(uGlaz) * U_IP_TO_SI).toFixed(2)}` : `${Number(uGlaz).toFixed(2)}`, isSI ? "W/m2K" : "BTU/hr.ft2.F", "Double-Glazed Thermal Assembly"],
        ["6", "Total Fenestration / Window Area", isSI ? `${(Number(glazArea) * SQFT_TO_SQM).toFixed(1)}` : `${Number(glazArea).toFixed(0)}`, isSI ? "m2" : "sq ft", "Window-to-Wall Area (WWR)"],
        ["7", "Outdoor Winter Design Temperature (T_out)", isSI ? `${((Number(oat) - 32) / 1.8).toFixed(1)}` : `${Number(oat).toFixed(1)}`, isSI ? "deg C" : "deg F", "ASHRAE 99.6% Climatic Data"],
        ["8", "Indoor Heating Setpoint Temperature (T_in)", isSI ? `${((Number(iat) - 32) / 1.8).toFixed(1)}` : `${Number(iat).toFixed(1)}`, isSI ? "deg C" : "deg F", "ASHRAE 55 Comfort Standard"],
        ["9", "Infiltration Air Exchange Rate (ACH)", `${Number(ach).toFixed(2)}`, "ACH", "Envelope Air Leakage Rate"],
        ["10", "Ventilation Fresh Air Supply Rate", isSI ? `${(Number(ventCfm) * CFM_TO_LPS).toFixed(1)}` : `${Number(ventCfm).toFixed(0)}`, isSI ? "L/s" : "CFM", "ASHRAE 62.1 Outdoor Air Rate"]
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

      // Table 2: Winter Heat Loss Breakdown & Equipment Sizing Summary
      const resultsTableBody = [
        [
          "A",
          "Design Temperature Difference (Delta T)",
          isSI ? `${calcResults.deltaTC.toFixed(1)} deg C` : `${calcResults.deltaTF.toFixed(1)} deg F`,
          "Delta T = T_in - T_out"
        ],
        [
          "B",
          "Opaque Exterior Wall Conduction Loss",
          isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/hr`,
          `Q_wall = U_wall x A_net x Delta T (${calcResults.pctWall.toFixed(1)}%)`
        ],
        [
          "C",
          "Roof / Ceiling Envelope Conduction Loss",
          isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/hr`,
          `Q_roof = U_roof x A_roof x Delta T (${calcResults.pctRoof.toFixed(1)}%)`
        ],
        [
          "D",
          "Glazing / Fenestration Conduction Loss",
          isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`,
          `Q_glaz = U_glaz x A_glaz x Delta T (${calcResults.pctGlaz.toFixed(1)}%)`
        ],
        [
          "E",
          "Infiltration Air Leakage Sensible Loss",
          isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`,
          `Q_infil = 1.08 x CFM_infil x Delta T (${calcResults.pctInfil.toFixed(1)}%)`
        ],
        [
          "F",
          "Ventilation Fresh Air Heating Load",
          isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/hr`,
          `Q_vent = 1.08 x CFM_vent x Delta T (${calcResults.pctVent.toFixed(1)}%)`
        ],
        [
          "G",
          "TOTAL BASE WINTER HEAT LOSS",
          isSI ? `${calcResults.kwBase.toFixed(2)} kW (${Math.round(calcResults.qBase).toLocaleString()} BTU/hr)` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr (${calcResults.kwBase.toFixed(2)} kW)`,
          "Q_base = Q_cond + Q_infil + Q_vent"
        ],
        [
          "H",
          "Intermittent Warm-up Safety Margin",
          `+${Number(safetyMargin).toFixed(1)} %`,
          "ASHRAE Morning Pick-up / Safety Margin"
        ],
        [
          "I",
          "REQUIRED HEATER / BOILER SIZING CAPACITY",
          isSI
            ? `${calcResults.kwTotal.toFixed(2)} kW (${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr)`
            : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr (${calcResults.kwTotal.toFixed(2)} kW)`,
          "Sized Plant Capacity = Q_base x (1 + Safety %)"
        ],
        [
          "J",
          "Heating Load Density Index",
          isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m2` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/sq ft`,
          "Normalized Heating Benchmark"
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
            { content: "Heat Loss Component / Sizing Metric", styles: { fillColor: primaryFill } },
            { content: "Calculated Result", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Formula", styles: { fillColor: primaryFill } }
          ]
        ],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight key totals (Row G: Total Base Loss, Row I: Required Sized Capacity, Row J: Density) in blueFill
            if (data.row.index === 6 || data.row.index === 8 || data.row.index === 9) {
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

      // Table 3: Mandatory Engineering Guidelines & ASHRAE 90.1 Compliance Notes
      const notesTableBody = [
        ["1", "ASHRAE 90.1 Envelope Standard", "Maximum allowable U-values for opaque walls, roof insulation, and fenestration SHGC/U-factors must satisfy ASHRAE 90.1 prescriptive tables."],
        ["2", "Ventilation Heat Recovery", "Where mechanical ventilation supply exceeds 5,000 CFM with >= 70% outdoor air, an energy recovery ventilation (ERV/HRV) system is recommended."],
        ["3", "Infiltration Tightness", "Air barrier continuity must be maintained per ASTM E779 air leakage testing (max 0.40 CFM/sq ft envelope area at 75 Pa)."],
        ["4", "Safety & Pick-up Factor", "A 10% to 20% capacity factor accounts for cold-start thermal mass warm-up and intermittent night set-back recovery."],
        ["5", "Combustion Efficiency", "Heating boiler and furnace selections should specify high-efficiency condensing units (>= 90% AFUE / thermal efficiency)."]
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

      // 3-Tier Signature Block (Originator, Reviewer, Approver)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate
      } = getSignatureBlockDetails(project?.id || "default", "/heating-load", currentUserName, calcReviewState);

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
            { content: "Designation" },
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

      doc.save(`Heating_Load_Calculation_${(project?.name || "Heating_Plant").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
      toast.success("Heating Load PDF report exported successfully!");
    } catch (error: any) {
      console.error("exportPdf error:", error);
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const pName = project?.name || "Heating Plant Sizing";
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Heating Load Calculation");

      ws.columns = [
        { width: 34 },
        { width: 22 },
        { width: 14 },
        { width: 30 },
        { width: 36 },
      ];

      // Header
      ws.addRow(["WINTER HEATING LOAD & BOILER SIZING REPORT"]);
      ws.addRow([`Project: ${pName}`]);
      ws.addRow([`Engineer: ${currentUserName}`]);
      ws.addRow([`Date: ${formatDateStr(new Date())}`]);
      const currentProfileTitle = preset === "custom" ? customProfileName : HEATING_PRESETS[preset]?.label;
      ws.addRow([`Preset / Building Profile: ${currentProfileTitle}`]);
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
        ["Floor Area", isSI ? (Number(area) * SQFT_TO_SQM).toFixed(1) : Number(area), isSI ? "m²" : "sq ft", "User Input", "Conditioned envelope area"],
        ["Clear Ceiling Height", isSI ? (Number(height) * FT_TO_M).toFixed(2) : Number(height), isSI ? "m" : "ft", "User Input", "Clear interior height"],
        ["Exterior Wall U-Value", isSI ? (Number(uWall) * U_IP_TO_SI).toFixed(2) : Number(uWall), isSI ? "W/m²K" : "BTU/hr·ft²·°F", "ASHRAE 90.1", "Opaque wall conductance"],
        ["Roof / Ceiling U-Value", isSI ? (Number(uRoof) * U_IP_TO_SI).toFixed(2) : Number(uRoof), isSI ? "W/m²K" : "BTU/hr·ft²·°F", "ASHRAE 90.1", "Roof insulation conductance"],
        ["Fenestration U-Value", isSI ? (Number(uGlaz) * U_IP_TO_SI).toFixed(2) : Number(uGlaz), isSI ? "W/m²K" : "BTU/hr·ft²·°F", "NFRC Standard", "Double-glazed window assembly"],
        ["Glazing Area", isSI ? (Number(glazArea) * SQFT_TO_SQM).toFixed(1) : Number(glazArea), isSI ? "m²" : "sq ft", "User Input", "Window area"],
        ["Outdoor Design Temp", isSI ? ((Number(oat) - 32) / 1.8).toFixed(1) : Number(oat), isSI ? "°C" : "°F", "ASHRAE 99.6%", "Winter ambient design temp"],
        ["Indoor Heating Setpoint", isSI ? ((Number(iat) - 32) / 1.8).toFixed(1) : Number(iat), isSI ? "°C" : "°F", "ASHRAE 55", "Indoor winter setpoint"],
        ["Design Temperature Delta T", isSI ? calcResults.deltaTC.toFixed(1) : calcResults.deltaTF.toFixed(1), isSI ? "°C" : "°F", "T_in - T_out", "Thermal driving temperature difference"],
        ["Wall Conduction Heat Loss", isSI ? calcResults.kwWall.toFixed(2) : Math.round(calcResults.qWall), isSI ? "kW" : "BTU/hr", "U_wall × A_net × ΔT", `${calcResults.pctWall.toFixed(1)}% of base loss`],
        ["Roof Conduction Heat Loss", isSI ? calcResults.kwRoof.toFixed(2) : Math.round(calcResults.qRoof), isSI ? "kW" : "BTU/hr", "U_roof × A_roof × ΔT", `${calcResults.pctRoof.toFixed(1)}% of base loss`],
        ["Glazing Conduction Heat Loss", isSI ? calcResults.kwGlaz.toFixed(2) : Math.round(calcResults.qGlaz), isSI ? "kW" : "BTU/hr", "U_glaz × A_glaz × ΔT", `${calcResults.pctGlaz.toFixed(1)}% of base loss`],
        ["Infiltration Heat Loss", isSI ? calcResults.kwInfil.toFixed(2) : Math.round(calcResults.qInfil), isSI ? "kW" : "BTU/hr", "1.08 × CFM_infil × ΔT", `${calcResults.pctInfil.toFixed(1)}% of base loss`],
        ["Ventilation Heat Loss", isSI ? calcResults.kwVent.toFixed(2) : Math.round(calcResults.qVent), isSI ? "kW" : "BTU/hr", "1.08 × CFM_vent × ΔT", `${calcResults.pctVent.toFixed(1)}% of base loss`],
        ["Total Base Winter Heat Loss", isSI ? calcResults.kwBase.toFixed(2) : Math.round(calcResults.qBase), isSI ? "kW" : "BTU/hr", "Σ (Q_cond + Q_air)", "Building steady-state heat loss"],
        ["Required Plant / Boiler Capacity", isSI ? calcResults.kwTotal.toFixed(2) : Math.round(calcResults.qTotal), isSI ? "kW" : "BTU/hr", `Q_base × (1 + ${safetyMargin}%)`, "Sized heater/boiler capacity with safety factor"],
        ["Heating Load Density Index", isSI ? calcResults.loadDensityWPerSqm.toFixed(1) : calcResults.loadDensityBtuPerSqft.toFixed(1), isSI ? "W/m²" : "BTU/hr/sq ft", "Capacity / Floor Area", "Normalized heating density benchmark"]
      ];

      excelRows.forEach((r) => ws.addRow(r));

      // Append 3-tier signature block to Excel
      addExcelSignatureBlock(ws, ws.rowCount + 3, currentUserName, project?.id || "default", "/heating-load", 5);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Heating_Load_Calculation_${pName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
      toast.success("Excel calculation sheet exported!");
    } catch (error: any) {
      console.error("exportToExcel error:", error);
      toast.error(`Export Excel failed: ${error?.message || String(error)}`);
    }
  };

  const renderBreakdownChart = () => {
    const bars = [
      { label: "Opaque Walls", val: isSI ? calcResults.kwWall : calcResults.qWall, pct: calcResults.pctWall, color: "#3B82F6" },
      { label: "Roof / Ceiling", val: isSI ? calcResults.kwRoof : calcResults.qRoof, pct: calcResults.pctRoof, color: "#10B981" },
      { label: "Glazing / Windows", val: isSI ? calcResults.kwGlaz : calcResults.qGlaz, pct: calcResults.pctGlaz, color: "#F59E0B" },
      { label: "Slab Perimeter", val: isSI ? calcResults.kwSlab : calcResults.qSlab, pct: calcResults.pctSlab, color: "#8B5CF6" },
      { label: "Infiltration", val: isSI ? calcResults.kwInfil : calcResults.qInfil, pct: calcResults.pctInfil, color: "#EC4899" },
      { label: "Fresh Air Vent", val: isSI ? calcResults.kwVent : calcResults.qVent, pct: calcResults.pctVent, color: "#06B6D4" },
    ];

    const maxVal = Math.max(...bars.map((b) => b.val)) * 1.15 || 1;

    return (
      <div className="p-4 rounded-2xl bg-muted/20 border border-border/70 space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Flame className="size-3.5 text-amber-500" /> Heat Loss Distribution Breakdown
          </span>
          <span className="text-[10.5px] font-semibold text-muted-foreground">
            Base Loss: {isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`}
          </span>
        </div>

        <div className="space-y-2.5">
          {bars.map((b, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
                  {b.label}
                </span>
                <span className="font-mono text-muted-foreground">
                  {isSI ? `${b.val.toFixed(2)} kW` : `${Math.round(b.val).toLocaleString()} BTU/hr`} ({b.pct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(3, (b.val / maxVal) * 100))}%`,
                    backgroundColor: b.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Heating Load"
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
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Heating Load</h1>
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
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/heating-load" calculatorTitle="Heating Load" />
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
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Heating Sizer
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
                  title="View ASHRAE Steady-State Heating Equations"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Compact Heating Building Profile & Presets Dropdown */}
                <HeatingProfileSelect
                  value={preset}
                  customProfileName={customProfileName}
                  onChange={handleApplyPreset}
                  onOpenCustomModal={() => setCustomModalOpen(true)}
                  unitSystem={unitSystem}
                  disabled={isEffectiveReadOnly}
                />
              </div>

              {/* Right Side Controls: Export & Unit System Toggle */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={exportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                {/* Sizing Unit system toggle */}
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Area (sq ft / m²), U-values (BTU/hr·ft²·°F / W/m²K), Temperatures (°F / °C), Load (BTU/hr / kW)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 5000 sq ft → 464.5 m², 0.065 U → 0.37 W/m²K, 20°F → -6.7°C"
                      : "Convert 464.5 m² → 5000 sq ft, 0.37 W/m²K → 0.065 U, -6.7°C → 20°F"
                  }
                />
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  
                  {/* 2-Column Sizing Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: INPUT CARDS */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* CARD 1: SPACE GEOMETRY & ENVELOPE BOUNDARY */}
                      <div
                        id="card-geometry"
                        data-field-id="card-geometry"
                        data-comment-target="card-geometry"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-geometry", "Space Geometry & Boundary")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Building2 className="size-4 text-primary" /> 1. Space Geometry & Enclosure Area
                            </span>
                            {renderCommentBadge("card-geometry", "Space Geometry & Boundary")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            Architectural Schedule
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Floor Area */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-area"
                                  data-field-id="area"
                                  data-comment-target="area"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("area", "Floor Area")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Conditioned Floor Area ({isSI ? "m²" : "sq ft"})
                                    </label>
                                    {renderCommentBadge("area", "Floor Area")}
                                  </div>
                                  <input
                                    type="number"
                                    min="10"
                                    step="10"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof area === "number" ? parseFloat((area * SQFT_TO_SQM).toFixed(1)) : area}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setArea("");
                                      else if (isSI) setArea(val * SQM_TO_SQFT);
                                      else setArea(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "465" : "5000"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Floor Area", isSI ? `${(Number(area) * SQFT_TO_SQM).toFixed(1)} m²` : `${area} sq ft`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleResetValue("Floor Area", setArea, 5000)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3.5 text-muted-foreground" />
                                  <span>Reset to Default (5,000 sq ft)</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("area", "Floor Area")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Ceiling Height */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-height"
                                  data-field-id="height"
                                  data-comment-target="height"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("height", "Ceiling Height")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Ceiling Clear Height ({isSI ? "m" : "ft"})
                                    </label>
                                    {renderCommentBadge("height", "Ceiling Height")}
                                  </div>
                                  <input
                                    type="number"
                                    min="6"
                                    max="50"
                                    step="0.5"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof height === "number" ? parseFloat((height * FT_TO_M).toFixed(2)) : height}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setHeight("");
                                      else if (isSI) setHeight(val * M_TO_FT);
                                      else setHeight(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "3.0" : "10"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Ceiling Height", isSI ? `${(Number(height) * FT_TO_M).toFixed(2)} m` : `${height} ft`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => handleResetValue("Ceiling Height", setHeight, 10)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3.5 text-muted-foreground" />
                                  <span>Reset to Default (10 ft)</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("height", "Ceiling Height")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          {/* Glazing Window Area */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-glazArea"
                                data-field-id="glazArea"
                                data-comment-target="glazArea"
                                className={`p-3 rounded-xl border transition-all ${
                                  isFieldHighlighted("glazArea", "Fenestration Area")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground">
                                    Total Glazing / Window Area ({isSI ? "m²" : "sq ft"})
                                  </label>
                                  {renderCommentBadge("glazArea", "Fenestration Area")}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  disabled={isEffectiveReadOnly}
                                  value={isSI && typeof glazArea === "number" ? parseFloat((glazArea * SQFT_TO_SQM).toFixed(1)) : glazArea}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                    if (val === "") setGlazArea("");
                                    else if (isSI) setGlazArea(val * SQM_TO_SQFT);
                                    else setGlazArea(val);
                                    dirtyStore.set(true);
                                  }}
                                  className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                  placeholder={isSI ? "55.7" : "600"}
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                  Estimated net opaque wall area: {isSI ? (calcResults.netWallAreaFt2 * SQFT_TO_SQM).toFixed(1) + " m²" : calcResults.netWallAreaFt2.toFixed(0) + " sq ft"}
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Glazing Area", isSI ? `${(Number(glazArea) * SQFT_TO_SQM).toFixed(1)} m²` : `${glazArea} sq ft`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleOpenComment("glazArea", "Fenestration Area")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* CARD 2: THERMAL INSULATION U-VALUES */}
                      <div
                        id="card-uvalues"
                        data-field-id="card-uvalues"
                        data-comment-target="card-uvalues"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-uvalues", "Thermal Envelope U-Values")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <ShieldCheck className="size-4 text-primary" /> 2. Envelope Thermal Insulation U-Values
                            </span>
                            {renderCommentBadge("card-uvalues", "Thermal Envelope U-Values")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            ASHRAE 90.1
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Wall U-Value */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-uWall"
                                  data-field-id="uWall"
                                  data-comment-target="uWall"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("uWall", "Wall U-Value")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Wall U-Value ({isSI ? "W/m²K" : "BTU/hr·ft²·°F"})
                                    </label>
                                    {renderCommentBadge("uWall", "Wall U-Value")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.005"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uWall === "number" ? parseFloat((uWall * U_IP_TO_SI).toFixed(3)) : uWall}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setUWall("");
                                      else if (isSI) setUWall(val * U_SI_TO_IP);
                                      else setUWall(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "0.37" : "0.065"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Wall U-Value", isSI ? `${(Number(uWall) * U_IP_TO_SI).toFixed(2)} W/m²K` : `${uWall} BTU/hr·ft²·°F`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("uWall", "Wall U-Value")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Roof U-Value */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-uRoof"
                                  data-field-id="uRoof"
                                  data-comment-target="uRoof"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("uRoof", "Roof U-Value")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Roof U-Value ({isSI ? "W/m²K" : "BTU/hr·ft²·°F"})
                                    </label>
                                    {renderCommentBadge("uRoof", "Roof U-Value")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.005"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uRoof === "number" ? parseFloat((uRoof * U_IP_TO_SI).toFixed(3)) : uRoof}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setURoof("");
                                      else if (isSI) setURoof(val * U_SI_TO_IP);
                                      else setURoof(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "0.20" : "0.035"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Roof U-Value", isSI ? `${(Number(uRoof) * U_IP_TO_SI).toFixed(2)} W/m²K` : `${uRoof} BTU/hr·ft²·°F`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("uRoof", "Roof U-Value")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Glazing U-Value */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-uGlaz"
                                  data-field-id="uGlaz"
                                  data-comment-target="uGlaz"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("uGlaz", "Glazing U-Value")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Glazing U-Value ({isSI ? "W/m²K" : "BTU/hr·ft²·°F"})
                                    </label>
                                    {renderCommentBadge("uGlaz", "Glazing U-Value")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0.05"
                                    step="0.02"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof uGlaz === "number" ? parseFloat((uGlaz * U_IP_TO_SI).toFixed(2)) : uGlaz}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setUGlaz("");
                                      else if (isSI) setUGlaz(val * U_SI_TO_IP);
                                      else setUGlaz(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "1.8" : "0.32"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Glazing U-Value", isSI ? `${(Number(uGlaz) * U_IP_TO_SI).toFixed(2)} W/m²K` : `${uGlaz} BTU/hr·ft²·°F`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("uGlaz", "Glazing U-Value")}
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

                      {/* CARD 3: WINTER CLIMATE & INDOOR SETPOINT */}
                      <div
                        id="card-climate"
                        data-field-id="card-climate"
                        data-comment-target="card-climate"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-climate", "Winter Design Climate")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Thermometer className="size-4 text-sky-500" /> 3. Winter Design Climate & Temperatures
                            </span>
                            {renderCommentBadge("card-climate", "Winter Design Climate")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            ASHRAE 99.6%
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Outdoor Temp */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-oat"
                                  data-field-id="oat"
                                  data-comment-target="oat"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("oat", "Outdoor Winter Temp")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Outdoor Design Temp ({isSI ? "°C" : "°F"})
                                    </label>
                                    {renderCommentBadge("oat", "Outdoor Winter Temp")}
                                  </div>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof oat === "number" ? parseFloat(((oat - 32) / 1.8).toFixed(1)) : oat}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setOat("");
                                      else if (isSI) setOat(val * 1.8 + 32);
                                      else setOat(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "-6.7" : "20"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Outdoor Temp", isSI ? `${((Number(oat) - 32) / 1.8).toFixed(1)} °C` : `${oat} °F`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("oat", "Outdoor Winter Temp")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Indoor Setpoint */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-iat"
                                  data-field-id="iat"
                                  data-comment-target="iat"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("iat", "Indoor Heating Setpoint")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Indoor Heating Setpoint ({isSI ? "°C" : "°F"})
                                    </label>
                                    {renderCommentBadge("iat", "Indoor Heating Setpoint")}
                                  </div>
                                  <input
                                    type="number"
                                    step="1"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof iat === "number" ? parseFloat(((iat - 32) / 1.8).toFixed(1)) : iat}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setIat("");
                                      else if (isSI) setIat(val * 1.8 + 32);
                                      else setIat(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "21.1" : "70"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Indoor Temp", isSI ? `${((Number(iat) - 32) / 1.8).toFixed(1)} °C` : `${iat} °F`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("iat", "Indoor Heating Setpoint")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground">Resulting Temperature Difference (ΔT):</span>
                            <span className="font-mono font-bold text-primary text-sm">
                              {isSI ? `${calcResults.deltaTC.toFixed(1)} °C` : `${calcResults.deltaTF.toFixed(1)} °F`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARD 4: INFILTRATION & VENTILATION */}
                      <div
                        id="card-ventilation"
                        data-field-id="card-ventilation"
                        data-comment-target="card-ventilation"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-ventilation", "Infiltration & Fresh Air")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Wind className="size-4 text-primary" /> 4. Infiltration, Ventilation & Safety Factor
                            </span>
                            {renderCommentBadge("card-ventilation", "Infiltration & Fresh Air")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            ASHRAE 62.1
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Infiltration ACH */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-ach"
                                  data-field-id="ach"
                                  data-comment-target="ach"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("ach", "Infiltration Rate")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Infiltration (ACH)
                                    </label>
                                    {renderCommentBadge("ach", "Infiltration Rate")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="5"
                                    step="0.05"
                                    disabled={isEffectiveReadOnly}
                                    value={ach}
                                    onChange={(e) => {
                                      setAch(e.target.value === "" ? "" : parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder="0.35"
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Infiltration", `${ach} ACH`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("ach", "Infiltration Rate")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Ventilation CFM */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-ventCfm"
                                  data-field-id="ventCfm"
                                  data-comment-target="ventCfm"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("ventCfm", "Ventilation Flow")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Ventilation ({isSI ? "L/s" : "CFM"})
                                    </label>
                                    {renderCommentBadge("ventCfm", "Ventilation Flow")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="25"
                                    disabled={isEffectiveReadOnly}
                                    value={isSI && typeof ventCfm === "number" ? parseFloat((ventCfm * CFM_TO_LPS).toFixed(1)) : ventCfm}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                      if (val === "") setVentCfm("");
                                      else if (isSI) setVentCfm(val * LPS_TO_CFM);
                                      else setVentCfm(val);
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder={isSI ? "212" : "450"}
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Ventilation Flow", isSI ? `${(Number(ventCfm) * CFM_TO_LPS).toFixed(1)} L/s` : `${ventCfm} CFM`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("ventCfm", "Ventilation Flow")}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            {/* Safety Margin % */}
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-safetyMargin"
                                  data-field-id="safetyMargin"
                                  data-comment-target="safetyMargin"
                                  className={`p-3 rounded-xl border transition-all ${
                                    isFieldHighlighted("safetyMargin", "Safety Margin")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground">
                                      Safety / Warm-up (%)
                                    </label>
                                    {renderCommentBadge("safetyMargin", "Safety Margin")}
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    step="5"
                                    disabled={isEffectiveReadOnly}
                                    value={safetyMargin}
                                    onChange={(e) => {
                                      setSafetyMargin(e.target.value === "" ? "" : parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className="w-full h-10 px-3 bg-background border border-input rounded-lg text-[13.5px] font-semibold outline-none focus:border-primary disabled:opacity-60"
                                    placeholder="15"
                                  />
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Safety Margin", `${safetyMargin}%`)}
                                  className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("safetyMargin", "Safety Margin")}
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
                              isFieldHighlighted("card-hero-results", "Heating Load Summary")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : "border-border/80"
                            }`}
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-primary rounded-full" />
                                <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                                  Winter Heating Load Summary
                                </h3>
                                {renderCommentBadge("card-hero-results", "Heating Load Summary")}
                              </div>
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                ASHRAE Sizing
                              </span>
                            </div>

                            {/* 2x2 Key Metric Cards */}
                            <div className="grid grid-cols-2 gap-3">
                              
                              {/* 1. Required Boiler/Heater Capacity */}
                              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 col-span-2">
                                <div className="text-[10.5px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Required Heating Plant Capacity</span>
                                  <Flame className="size-4 text-amber-500" />
                                </div>
                                <div className="text-2xl font-black text-foreground">
                                  {isSI
                                    ? `${calcResults.kwTotal.toFixed(2)} kW`
                                    : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`}
                                </div>
                                <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                                  {isSI
                                    ? `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr (+${safetyMargin}% margin)`
                                    : `${calcResults.kwTotal.toFixed(2)} kW (+${safetyMargin}% margin)`}
                                </div>
                              </div>

                              {/* 2. Total Base Loss */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Base Heat Loss</span>
                                  <Activity className="size-3.5 text-primary" />
                                </div>
                                <div className="text-lg font-black text-foreground">
                                  {isSI
                                    ? `${calcResults.kwBase.toFixed(2)} kW`
                                    : `${Math.round(calcResults.qBase).toLocaleString()} BTU/h`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  Steady-state loss
                                </div>
                              </div>

                              {/* 3. Load Density Index */}
                              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50">
                                <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>Load Density</span>
                                  <Gauge className="size-3.5 text-primary" />
                                </div>
                                <div className="text-lg font-black text-foreground">
                                  {isSI
                                    ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²`
                                    : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/ft²`}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                  Normalized capacity
                                </div>
                              </div>

                            </div>

                            {/* Live Losses Distribution Chart */}
                            {renderBreakdownChart()}

                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Heating Capacity", isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal)} BTU/hr`)}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Plant Capacity</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
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
                            onClick={() => handleOpenComment("card-hero-results", "Heating Load Summary")}
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
                /* IN-BROWSER REPORT PREVIEW TAB */
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">
                    
                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Winter Heating Load Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          ASHRAE Handbook of Fundamentals & Envelope Heat Loss Engineering Analysis
                        </p>
                      </div>
                    </div>


                    {/* Table 1: Design Parameters & Envelope Properties */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Design Parameters & Envelope Properties
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
                            <td className="border border-border p-2 font-bold">Conditioned Floor Area (A_floor)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(area) * SQFT_TO_SQM).toFixed(1) : Number(area).toFixed(0)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m²" : "sq ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Architectural Space Layout</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Ceiling Clear Height (H)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(height) * FT_TO_M).toFixed(2) : Number(height).toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Section Clear Room Height</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Exterior Wall Thermal Transmittance (U_wall)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(uWall) * U_IP_TO_SI).toFixed(2) : Number(uWall).toFixed(3)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="border border-border p-2 text-muted-foreground">ASHRAE 90.1 Envelope Table 5.5</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Roof / Ceiling Transmittance (U_roof)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(uRoof) * U_IP_TO_SI).toFixed(2) : Number(uRoof).toFixed(3)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Insulated Roof Deck Assembly</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Fenestration / Glazing Transmittance (U_glaz)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(uGlaz) * U_IP_TO_SI).toFixed(2) : Number(uGlaz).toFixed(2)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Double-Glazed Thermal Assembly</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                            <td className="border border-border p-2 font-bold">Total Fenestration / Window Area</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(glazArea) * SQFT_TO_SQM).toFixed(1) : Number(glazArea).toFixed(0)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "m²" : "sq ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">Window-to-Wall Area (WWR)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                            <td className="border border-border p-2 font-bold">Outdoor Winter Design Temperature (T_out)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? ((Number(oat) - 32) / 1.8).toFixed(1) : Number(oat).toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "°C" : "°F"}</td>
                            <td className="border border-border p-2 text-muted-foreground">ASHRAE 99.6% Climatic Data</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                            <td className="border border-border p-2 font-bold">Indoor Heating Setpoint Temperature (T_in)</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? ((Number(iat) - 32) / 1.8).toFixed(1) : Number(iat).toFixed(1)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "°C" : "°F"}</td>
                            <td className="border border-border p-2 text-muted-foreground">ASHRAE 55 Comfort Standard</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">9</td>
                            <td className="border border-border p-2 font-bold">Infiltration Air Exchange Rate (ACH)</td>
                            <td className="border border-border p-2 text-center font-bold">{Number(ach).toFixed(2)}</td>
                            <td className="border border-border p-2 text-center">ACH</td>
                            <td className="border border-border p-2 text-muted-foreground">Envelope Air Leakage Rate</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">10</td>
                            <td className="border border-border p-2 font-bold">Ventilation Fresh Air Supply Rate</td>
                            <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(ventCfm) * CFM_TO_LPS).toFixed(1) : Number(ventCfm).toFixed(0)}</td>
                            <td className="border border-border p-2 text-center">{isSI ? "L/s" : "CFM"}</td>
                            <td className="border border-border p-2 text-muted-foreground">ASHRAE 62.1 Outdoor Air Rate</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Winter Heat Loss Breakdown & Equipment Sizing Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Winter Heat Loss Breakdown & Equipment Sizing Summary
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="font-bold">
                          <tr>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-center w-12">Item</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Heat Loss Component / Sizing Metric</th>
                            <th className="bg-[#DAE9F8] dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-border p-2 text-center w-52">Calculated Result</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Engineering Basis & Formula</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">A</td>
                            <td className="border border-border p-2 font-bold">Design Temperature Difference (ΔT)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.deltaTC.toFixed(1)} °C` : `${calcResults.deltaTF.toFixed(1)} °F`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">ΔT = T_in - T_out</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">B</td>
                            <td className="border border-border p-2 font-bold">Opaque Exterior Wall Conduction Loss</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/hr`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Q_wall = U_wall × A_net × ΔT ({calcResults.pctWall.toFixed(1)}%)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">C</td>
                            <td className="border border-border p-2 font-bold">Roof / Ceiling Envelope Conduction Loss</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/hr`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Q_roof = U_roof × A_roof × ΔT ({calcResults.pctRoof.toFixed(1)}%)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">D</td>
                            <td className="border border-border p-2 font-bold">Glazing / Fenestration Conduction Loss</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Q_glaz = U_glaz × A_glaz × ΔT ({calcResults.pctGlaz.toFixed(1)}%)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">E</td>
                            <td className="border border-border p-2 font-bold">Infiltration Air Leakage Sensible Loss</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Q_infil = 1.08 × CFM_infil × ΔT ({calcResults.pctInfil.toFixed(1)}%)</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">F</td>
                            <td className="border border-border p-2 font-bold">Ventilation Fresh Air Heating Load</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/hr`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">Q_vent = 1.08 × CFM_vent × ΔT ({calcResults.pctVent.toFixed(1)}%)</td>
                          </tr>
                          {/* Row G - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">G</td>
                            <td className="border border-border p-2">TOTAL BASE WINTER HEAT LOSS</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${calcResults.kwBase.toFixed(2)} kW (${Math.round(calcResults.qBase).toLocaleString()} BTU/hr)`
                                : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr (${calcResults.kwBase.toFixed(2)} kW)`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">Q_base = Q_cond + Q_infil + Q_vent</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">H</td>
                            <td className="border border-border p-2 font-bold">Intermittent Warm-up Safety Margin</td>
                            <td className="border border-border p-2 text-center font-bold">+{Number(safetyMargin).toFixed(1)} %</td>
                            <td className="border border-border p-2 text-muted-foreground">ASHRAE Morning Pick-up / Safety Margin</td>
                          </tr>
                          {/* Row I - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">I</td>
                            <td className="border border-border p-2">REQUIRED HEATER / BOILER SIZING CAPACITY</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI
                                ? `${calcResults.kwTotal.toFixed(2)} kW (${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr)`
                                : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr (${calcResults.kwTotal.toFixed(2)} kW)`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">Sized Plant Capacity = Q_base × (1 + Safety %)</td>
                          </tr>
                          {/* Row J - Highlighted */}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">J</td>
                            <td className="border border-border p-2">Heating Load Density Index</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/sq ft`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">Normalized Heating Benchmark</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Mandatory Engineering Guidelines & ASHRAE 90.1 Compliance Notes */}
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
                            <td className="border border-border p-2 font-bold">ASHRAE 90.1 Envelope Standard</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Maximum allowable U-values for opaque walls, roof insulation, and fenestration SHGC/U-factors must satisfy ASHRAE 90.1 prescriptive tables.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Ventilation Heat Recovery</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Where mechanical ventilation supply exceeds 5,000 CFM with &gt;= 70% outdoor air, an energy recovery ventilation (ERV/HRV) system is recommended.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Infiltration Tightness</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Air barrier continuity must be maintained per ASTM E779 air leakage testing (max 0.40 CFM/sq ft envelope area at 75 Pa).
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Safety & Pick-up Factor</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              A 10% to 20% capacity factor accounts for cold-start thermal mass warm-up and intermittent night set-back recovery.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Combustion Efficiency</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Heating boiler and furnace selections should specify high-efficiency condensing units (&gt;= 90% AFUE / thermal efficiency).
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
            <div className="h-full flex flex-col p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">Heating Load Intelligence</h3>
                </div>
                <button
                  onClick={() => setIntelOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs overflow-y-auto custom-scrollbar flex-1 pr-1">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <div className="font-bold text-primary flex items-center gap-1.5">
                    <Sun className="size-3.5" /> Quick Energy Insights
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Envelope conduction accounts for <strong>{(calcResults.pctWall + calcResults.pctRoof + calcResults.pctGlaz + calcResults.pctSlab).toFixed(1)}%</strong> of the total base heating loss. Glazing has the highest thermal transmission rate.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Wind className="size-3.5 text-sky-500" /> Infiltration & Ventilation
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Infiltration + ventilation account for <strong>{(calcResults.pctInfil + calcResults.pctVent).toFixed(1)}%</strong> ({isSI ? `${calcResults.kwTotalAir.toFixed(2)} kW` : `${Math.round(calcResults.qTotalAir).toLocaleString()} BTU/hr`}) of the heat loss.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border/70 space-y-2">
                  <div className="font-bold text-foreground">ASHRAE 90.1 Prescriptive Maximum U-Values</div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span>Steel-Framed Wall:</span>
                      <span className="font-mono font-bold text-foreground">0.064 BTU/hr·ft²·°F (0.36 W/m²K)</span>
                    </div>
                    <div className="flex justify-between border-b border-border/40 pb-1">
                      <span>Insulated Roof:</span>
                      <span className="font-mono font-bold text-foreground">0.032 BTU/hr·ft²·°F (0.18 W/m²K)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fixed Glazing:</span>
                      <span className="font-mono font-bold text-foreground">0.360 BTU/hr·ft²·°F (2.04 W/m²K)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Info className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">
                    ASHRAE Steady-State Winter Heating Equations
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Governing thermal conduction, envelope heat loss, and air heating equations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-muted-foreground overflow-y-auto max-h-[60vh] pr-1">
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                <div className="font-bold text-foreground">1. Envelope Conduction Heat Loss</div>
                <div className="font-mono font-bold text-primary text-xs bg-background p-2 rounded-lg border border-border/60">
                  Q_cond = U × A × (T_in - T_out)
                </div>
                <p className="text-[11px] leading-relaxed">
                  Where <em>U</em> is the thermal transmittance (BTU/hr·ft²·°F or W/m²K), <em>A</em> is the net surface area (sq ft or m²), and <em>(T_in - T_out)</em> is the winter design temperature differential (ΔT).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                <div className="font-bold text-foreground">2. Infiltration & Fresh Air Sensible Loss</div>
                <div className="font-mono font-bold text-primary text-xs bg-background p-2 rounded-lg border border-border/60">
                  Q_air = 1.08 × CFM × (T_in - T_out) &nbsp;&nbsp;[IP]<br/>
                  Q_air = 1.20 × L/s × (T_in - T_out) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[SI, Watts]
                </div>
                <p className="text-[11px] leading-relaxed">
                  The constant 1.08 represents standard air density (0.075 lb/ft³) multiplied by specific heat (0.24 BTU/lb·°F) and 60 min/hr.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                <div className="font-bold text-foreground">3. Total Sized Heating Capacity with Pick-up Margin</div>
                <div className="font-mono font-bold text-primary text-xs bg-background p-2 rounded-lg border border-border/60">
                  Q_total = (Q_cond + Q_infil + Q_vent) × (1 + Safety%)
                </div>
                <p className="text-[11px] leading-relaxed">
                  Accounts for morning warm-up recovery after night setback and cold-start thermal mass acceleration.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Heating Profile Configuration Modal */}
      <CustomHeatingConfigModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        unitSystem={unitSystem}
        currentValues={{
          area,
          height,
          uWall,
          uRoof,
          uGlaz,
          glazArea,
          oat,
          iat,
          ach,
          ventCfm,
          safetyMargin,
          customProfileName,
          customWorkflow,
        }}
        onApply={handleApplyCustomConfig}
      />

      {/* Assign Comment / Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => setCommentModalOpen(false)}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Heating Load Parameter"
          calculatorTitle="Winter Heating Load"
          calculatorPath="/heating-load"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}
