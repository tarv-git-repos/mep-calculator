import { calculateHeatingLoad, SQFT_TO_SQM, SQM_TO_SQFT, FT_TO_M, M_TO_FT, U_IP_TO_SI, U_SI_TO_IP, CFM_TO_LPS, LPS_TO_CFM, BTU_HR_TO_KW, KW_TO_BTU_HR } from "@/lib/calc-heating-load";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Thermometer, Flame, Building2, Building, Home,
  Stethoscope, Store, Warehouse, Sun, Wind, GraduationCap, SlidersHorizontal, Eye, Sliders, FileSpreadsheet
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

function HeatingLoadPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/heating-load", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/heating-load", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Design Engineer";
  const isApprovedLocked = calcReviewState?.status === "APPROVED";
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Intelligence Drawer & Formula Modal State
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Tab View
  const [tab, setTab] = useState<"solver" | "report">("solver");

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

  // Persistence Hook: Load saved state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_heating_load_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.preset !== undefined) setPreset(data.preset);
        if (data.customProfileName !== undefined) setCustomProfileName(data.customProfileName);
        if (data.area !== undefined) setArea(data.area);
        if (data.height !== undefined) setHeight(data.height);
        if (data.uWall !== undefined) setUWall(data.uWall);
        if (data.uRoof !== undefined) setURoof(data.uRoof);
        if (data.uGlaz !== undefined) setUGlaz(data.uGlaz);
        if (data.glazArea !== undefined) setGlazArea(data.glazArea);
        if (data.oat !== undefined) setOat(data.oat);
        if (data.iat !== undefined) setIat(data.iat);
        if (data.ach !== undefined) setAch(data.ach);
        if (data.ventCfm !== undefined) setVentCfm(data.ventCfm);
        if (data.safetyMargin !== undefined) setSafetyMargin(data.safetyMargin);
        if (data.unitSystem !== undefined) setUnitSystem(data.unitSystem);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load heating load calculation", e);
    }
  }, [project?.id]);

  const handleSaveCurrent = useCallback(() => {
    try {
      const dataToSave = {
        preset,
        customProfileName,
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
        unitSystem,
      };
      localStorage.setItem(`mep_heating_load_calc_${project?.id || "default"}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Heating Load Calculation saved successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  }, [project?.id, preset, customProfileName, area, height, uWall, uRoof, uGlaz, glazArea, oat, iat, ach, ventCfm, safetyMargin, unitSystem, forceSaveToCloud]);

  useEffect(() => {
    const handleTriggerSave = (e: any) => {
      if (e.detail) e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleTriggerSave);
    return () => window.removeEventListener("mep-trigger-save", handleTriggerSave);
  }, [handleSaveCurrent]);

  // Load comments
  const loadComments = () => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/heating-load`;
    try {
      const stored = localStorage.getItem(storageKey) || localStorage.getItem(`mep_calc_comments_${pId}_heating-load`);
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

  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");

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
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "spaceEnvelopeCard";
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
      return false;
    });
  };

  const isFieldHighlighted = (id: string, label?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    const cleanId = id.toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-)/, "");

    if (
      cleanHighlight === cleanId ||
      cleanHighlight === `field-${cleanId}` ||
      cleanHighlight === `card-${cleanId}` ||
      cleanHighlight.includes(cleanRawId) ||
      cleanRawId.includes(cleanHighlight)
    ) {
      return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    }
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id);
    if (itemComments.length === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="ml-2 inline-flex items-center justify-center size-4 bg-primary text-primary-foreground rounded-full text-[9px] font-bold shadow-sm"
      >
        {itemComments.length}
      </button>
    );
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
  const handleUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (targetUnit === unitSystem) return;
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.info(`Switched units to ${targetUnit === "si" ? "Metric (SI)" : "Imperial (IP)"}`);
  };

  // Heating Calculation Engine per ASHRAE Fundamentals
  const calcResults = useMemo(() => {
    const areaVal = typeof area === "number" ? area : 5000;
    const heightVal = typeof height === "number" ? height : 10;
    const uWallVal = typeof uWall === "number" ? uWall : 0.065;
    const uRoofVal = uWallVal; // Wall + roof U-value
    const uGlazVal = typeof uGlaz === "number" ? uGlaz : 0.32;
    const glazAreaVal = typeof glazArea === "number" ? glazArea : 600;
    const oatVal = typeof oat === "number" ? oat : 20;
    const iatVal = typeof iat === "number" ? iat : 70;
    const achVal = typeof ach === "number" ? ach : 0.35;
    const ventCfmVal = typeof ventCfm === "number" ? ventCfm : 450;
    const sfVal = typeof safetyMargin === "number" ? safetyMargin : 15;

    return calculateHeatingLoad(areaVal, heightVal, uWallVal, uRoofVal, uGlazVal, glazAreaVal, oatVal, iatVal, achVal, ventCfmVal, sfVal);
  }, [area, height, uWall, uGlaz, glazArea, oat, iat, ach, ventCfm, safetyMargin]);

  // Export PDF
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
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-HEAT-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Commercial Heating Design";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Winter Heating Load Calculation Report", 14, 13);

      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17);
      doc.line(105, 16, 105, 33);
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

      const primaryFill = [217, 217, 217] as [number, number, number];
      const blueFill = [218, 233, 248] as [number, number, number];
      const signatureFill = [255, 230, 204] as [number, number, number];

      const paramTableBody = [
        ["1", "Floor area", isSI ? `${(Number(area) * SQFT_TO_SQM).toFixed(1)}` : `${Number(area).toFixed(0)}`, isSI ? "m²" : "ft²", "Architectural Layout"],
        ["2", "Ceiling height", isSI ? `${(Number(height) * FT_TO_M).toFixed(2)}` : `${Number(height).toFixed(1)}`, isSI ? "m" : "ft", "Room Clear Height"],
        ["3", "Wall + roof U-value", isSI ? `${(Number(uWall) * U_IP_TO_SI).toFixed(2)}` : `${Number(uWall).toFixed(3)}`, isSI ? "W/m²K" : "BTU/hr·ft²·°F", "ASHRAE 90.1 Envelope"],
        ["4", "Glazing area", isSI ? `${(Number(glazArea) * SQFT_TO_SQM).toFixed(1)}` : `${Number(glazArea).toFixed(0)}`, isSI ? "m²" : "ft²", "Window-to-Wall Ratio"],
        ["5", "Glazing U-value", isSI ? `${(Number(uGlaz) * U_IP_TO_SI).toFixed(2)}` : `${Number(uGlaz).toFixed(2)}`, isSI ? "W/m²K" : "BTU/hr·ft²·°F", "Double-Glazed Assembly"],
        ["6", "Outdoor design temperature", isSI ? `${((Number(oat) - 32) / 1.8).toFixed(1)}` : `${Number(oat).toFixed(1)}`, isSI ? "°C" : "°F", "ASHRAE 99.6% Climate Data"],
        ["7", "Indoor setpoint", isSI ? `${((Number(iat) - 32) / 1.8).toFixed(1)}` : `${Number(iat).toFixed(1)}`, isSI ? "°C" : "°F", "ASHRAE 55 Comfort Standard"],
        ["8", "Infiltration (ACH)", `${Number(ach).toFixed(2)}`, "air changes/hr", "Envelope Leakage Rate"]
      ];

      callAutoTable(doc, {
        startY: 35,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 7.2, halign: "center", valign: "middle", cellPadding: 1.3 },
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 68, fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 46 }
        },
        head: [["No.", "Input Parameter", "Value", "Unit", "Standard / Code Reference"]],
        body: paramTableBody
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 88;

      const totalCondLossKw = calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab;
      const totalCondLossBtu = calcResults.qWall + calcResults.qRoof + calcResults.qSlab;

      const resultsTableBody = [
        ["1", "Envelope conduction loss", isSI ? `${totalCondLossKw.toFixed(2)} kW` : `${Math.round(totalCondLossBtu).toLocaleString()} BTU/hr`, "Walls, Roof & Slab Conduction"],
        ["2", "Glazing conduction loss", isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`, "Fenestration Thermal Conduction"],
        ["3", "Infiltration heat loss", isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`, "Air Infiltration Leakage Loss"],
        ["4", "Total heating load", isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`, "Q_base = Envelope + Glazing + Infiltration"],
        ["5", isSI ? "Load per m²" : "Load per ft²", isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/ft²`, "Normalized Benchmark"],
        ["6", "Heater / boiler capacity", isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`, `Includes ${safetyMargin}% safety margin`]
      ];

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 7.2, halign: "center", valign: "middle", cellPadding: 1.3 },
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 74, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 52 }
        },
        head: [["Item", "Heating Load Metric", "Calculated Result", "Engineering Basis"]],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body" && (data.row.index === 3 || data.row.index === 5)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
          }
        }
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 160;

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } =
        getSignatureBlockDetails(project?.id || "default", "/heating-load", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: finalY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { fontSize: 7.2, halign: "center", valign: "middle", cellPadding: 1.5 },
        headStyles: { fillColor: signatureFill, textColor: 0, fontStyle: "bold" },
        head: [["Designation", "Originator", "Reviewer", "Approver"]],
        body: [
          [{ content: "Name:", styles: { fontStyle: "bold", halign: "right" } }, originatedName, reviewerName, approverName],
          [{ content: "Date:", styles: { fontStyle: "bold", halign: "right" } }, originatedDate, reviewerDate, approverDate]
        ],
        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 50 } }
      });

      doc.save(`Heating_Load_Calculation_${(project?.name || "Heating_Plant").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
      toast.success("Heating Load PDF report exported successfully!");
    } catch (error: any) {
      console.error("exportPdf error:", error);
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
  };

  // Export Excel
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

      ws.addRow(["WINTER HEATING LOAD & BOILER SIZING REPORT"]);
      ws.addRow([`Project: ${pName}`]);
      ws.addRow([`Engineer: ${currentUserName}`]);
      ws.addRow([`Date: ${formatDateStr(new Date())}`]);
      ws.addRow([`Preset / Building Profile: ${preset === "custom" ? customProfileName : HEATING_PRESETS[preset]?.label}`]);
      ws.addRow([]);

      ws.addRow(["Parameter", "Calculated Value", "Unit", "Formula / Standard", "Remarks"]);
      const headerRow = ws.getRow(7);
      headerRow.font = { bold: true, color: { argb: "FF000000" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

      const totalCondLossKw = calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab;
      const totalCondLossBtu = calcResults.qWall + calcResults.qRoof + calcResults.qSlab;

      const excelRows = [
        ["Floor area", isSI ? (Number(area) * SQFT_TO_SQM).toFixed(1) : Number(area), isSI ? "m²" : "ft²", "User Input", "Conditioned floor area"],
        ["Ceiling height", isSI ? (Number(height) * FT_TO_M).toFixed(2) : Number(height), isSI ? "m" : "ft", "User Input", "Room clear height"],
        ["Wall + roof U-value", isSI ? (Number(uWall) * U_IP_TO_SI).toFixed(2) : Number(uWall), isSI ? "W/m²K" : "BTU/hr·ft²·°F", "ASHRAE 90.1", "Envelope U-value"],
        ["Glazing area", isSI ? (Number(glazArea) * SQFT_TO_SQM).toFixed(1) : Number(glazArea), isSI ? "m²" : "ft²", "User Input", "Window area"],
        ["Glazing U-value", isSI ? (Number(uGlaz) * U_IP_TO_SI).toFixed(2) : Number(uGlaz), isSI ? "W/m²K" : "BTU/hr·ft²·°F", "NFRC Standard", "Glazing U-value"],
        ["Outdoor design temperature", isSI ? ((Number(oat) - 32) / 1.8).toFixed(1) : Number(oat), isSI ? "°C" : "°F", "ASHRAE 99.6%", "Winter ambient temp"],
        ["Indoor setpoint", isSI ? ((Number(iat) - 32) / 1.8).toFixed(1) : Number(iat), isSI ? "°C" : "°F", "ASHRAE 55", "Winter setpoint"],
        ["Infiltration (ACH)", Number(ach).toFixed(2), "air changes/hr", "Envelope Leakage", "Infiltration rate"],
        ["Envelope conduction loss", isSI ? totalCondLossKw.toFixed(2) : Math.round(totalCondLossBtu), isSI ? "kW" : "BTU/hr", "U_env × A_env × ΔT", "Walls, Roof & Slab Conduction"],
        ["Glazing conduction loss", isSI ? calcResults.kwGlaz.toFixed(2) : Math.round(calcResults.qGlaz), isSI ? "kW" : "BTU/hr", "U_glaz × A_glaz × ΔT", "Glazing Conduction"],
        ["Infiltration heat loss", isSI ? calcResults.kwInfil.toFixed(2) : Math.round(calcResults.qInfil), isSI ? "kW" : "BTU/hr", "1.08 × CFM_infil × ΔT", "Air Leakage Heat Loss"],
        ["Total heating load", isSI ? calcResults.kwBase.toFixed(2) : Math.round(calcResults.qBase), isSI ? "kW" : "BTU/hr", "Σ (Envelope + Glazing + Infiltration)", "Base Building Load"],
        [isSI ? "Load per m²" : "Load per ft²", isSI ? calcResults.loadDensityWPerSqm.toFixed(1) : calcResults.loadDensityBtuPerSqft.toFixed(1), isSI ? "W/m²" : "BTU/hr/ft²", "Load / Area", "Normalized Benchmark"],
        ["Heater / boiler capacity", isSI ? calcResults.kwTotal.toFixed(2) : Math.round(calcResults.qTotal), isSI ? "kW" : "BTU/hr", `Q_total × (1 + ${safetyMargin}%)`, "Sized Equipment Capacity"]
      ];

      excelRows.forEach((r) => ws.addRow(r));
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
      { label: "Envelope Conduction", val: isSI ? (calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab) : (calcResults.qWall + calcResults.qRoof + calcResults.qSlab), pct: calcResults.pctWall + calcResults.pctRoof + calcResults.pctSlab, color: "#3B82F6" },
      { label: "Glazing Conduction", val: isSI ? calcResults.kwGlaz : calcResults.qGlaz, pct: calcResults.pctGlaz, color: "#F59E0B" },
      { label: "Infiltration Heat Loss", val: isSI ? calcResults.kwInfil : calcResults.qInfil, pct: calcResults.pctInfil, color: "#EC4899" },
    ];

    const maxVal = Math.max(...bars.map((b) => b.val)) * 1.15 || 1;

    return (
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800 pb-2">
          <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-1.5">
            <Flame className="size-3.5 text-amber-500" /> Heat Loss Breakdown
          </span>
          <span className="text-[10.5px] font-mono font-semibold text-slate-500">
            Base: {isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/h`}
          </span>
        </div>

        <div className="space-y-2.5">
          {bars.map((b, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
                  {b.label}
                </span>
                <span className="font-mono text-slate-500">
                  {isSI ? `${b.val.toFixed(2)} kW` : `${Math.round(b.val).toLocaleString()} BTU/h`} ({b.pct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200/70 dark:bg-zinc-700/60 rounded-full overflow-hidden">
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

  const inputClass = "w-full h-8 px-2.5 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  const totalCondLossKw = calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab;
  const totalCondLossBtu = calcResults.qWall + calcResults.qRoof + calcResults.qSlab;

  return (
    <AppShell
      title="Winter Heating Load"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full">
          
          {/* Header Bar matching Pump Sizing / Fresh Air Cooling Load */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Winter Heating Load</h1>
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
              <CalculationReviewBar
                projectId={activeProjectId}
                calculatorPath="/heating-load"
                calculatorTitle="Winter Heating Load"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White / Dark Card container for Parameters & Results Grid */}
          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>

            {/* Action Selector Row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Tab Switcher on the left */}
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Calculator
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report Preview
                  </button>
                </div>

                {/* Formula Breakdown button */}
                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View Formula Breakdown & ASHRAE Equations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action buttons on the right of tabs */}
              <div className="flex items-center gap-2">
                <TBtn onClick={exportPdf} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden p-6 bg-slate-50/50 dark:bg-zinc-950/20">
              {tab === "solver" ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full">
                  
                  {/* LEFT COLUMN: PARAMETER INPUTS - SCROLLABLE PANEL (lg:col-span-5) */}
                  <div className="lg:col-span-5 h-full max-h-full overflow-y-auto pr-2 custom-scrollbar">
                    <div 
                      id="card-spaceEnvelopeCard"
                      data-field-id="spaceEnvelopeCard"
                      data-comment-target="spaceEnvelopeCard"
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4 ${isFieldHighlighted("spaceEnvelopeCard", "Space & Envelope")}`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 SIZING PARAMETERS
                        </span>
                        {renderCommentBadge("spaceEnvelopeCard", "SPACE & ENVELOPE")}
                      </div>

                      {/* Preset Profile Dropdown inside Parameters Table */}
                      <div className="space-y-1 pb-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                            Building Application Preset
                          </label>
                          {renderCommentBadge("preset", "Heating Preset")}
                        </div>
                        <HeatingProfileSelect
                          value={preset}
                          customProfileName={customProfileName}
                          onChange={handleApplyPreset}
                          onOpenCustomModal={() => setCustomModalOpen(true)}
                          unitSystem={unitSystem}
                          disabled={isEffectiveReadOnly}
                        />
                      </div>

                      {/* 2-Column Grid for Input Parameters */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                        {/* Input 1: Floor area */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Floor area ({isSI ? "m²" : "sq.ft"})
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof area === "number" ? parseFloat((area * SQFT_TO_SQM).toFixed(1)) : area}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setArea("");
                                  else if (isSI) setArea(val * SQM_TO_SQFT);
                                  else setArea(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 185" : "e.g. 2000"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setArea(2000); toast.success("Reset floor area to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Floor area")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 2: Ceiling height */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Ceiling height ({isSI ? "m" : "ft"})
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof height === "number" ? parseFloat((height * FT_TO_M).toFixed(2)) : height}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setHeight("");
                                  else if (isSI) setHeight(val * M_TO_FT);
                                  else setHeight(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 3.0" : "e.g. 10"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setHeight(10); toast.success("Reset ceiling height to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Ceiling height")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 3: Outdoor design temperature */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Outdoor temp ({isSI ? "°C" : "°F"})
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof oat === "number" ? parseFloat(((oat - 32) / 1.8).toFixed(1)) : oat}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setOat("");
                                  else if (isSI) setOat(val * 1.8 + 32);
                                  else setOat(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 0" : "e.g. 32"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setOat(20); toast.success("Reset outdoor temp to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Outdoor design temperature")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 4: Indoor setpoint */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Indoor setpoint ({isSI ? "°C" : "°F"})
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof iat === "number" ? parseFloat(((iat - 32) / 1.8).toFixed(1)) : iat}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setIat("");
                                  else if (isSI) setIat(val * 1.8 + 32);
                                  else setIat(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 21.1" : "e.g. 70"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setIat(70); toast.success("Reset indoor setpoint to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Indoor setpoint")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 5: Glazing area */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Glazing area ({isSI ? "m²" : "sq.ft"})
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof glazArea === "number" ? parseFloat((glazArea * SQFT_TO_SQM).toFixed(1)) : glazArea}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setGlazArea("");
                                  else if (isSI) setGlazArea(val * SQM_TO_SQFT);
                                  else setGlazArea(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 18.5" : "e.g. 200"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setGlazArea(600); toast.success("Reset glazing area to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Glazing area")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 6: Glazing U-value */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Glazing U-value ({isSI ? "W/m²K" : "BTU/hr·ft²·°F"})
                                </label>
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof uGlaz === "number" ? parseFloat((uGlaz * U_IP_TO_SI).toFixed(2)) : uGlaz}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setUGlaz("");
                                  else if (isSI) setUGlaz(val * U_SI_TO_IP);
                                  else setUGlaz(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 1.6" : "e.g. 0.28"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setUGlaz(0.32); toast.success("Reset glazing U-value to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Glazing U-value")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 7: Wall + roof U-value */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Wall + roof U-value ({isSI ? "W/m²K" : "BTU/hr·ft²·°F"})
                                </label>
                              </div>
                              <input
                                type="number"
                                step="0.005"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof uWall === "number" ? parseFloat((uWall * U_IP_TO_SI).toFixed(2)) : uWall}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setUWall("");
                                  else if (isSI) setUWall(val * U_SI_TO_IP);
                                  else setUWall(val);
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder={isSI ? "e.g. 0.37" : "e.g. 0.065"}
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setUWall(0.065); toast.success("Reset U-value to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Wall + roof U-value")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 8: Infiltration (ACH) */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Infiltration Rate (ACH)
                                </label>
                              </div>
                              <input
                                type="number"
                                step="0.05"
                                disabled={isEffectiveReadOnly}
                                value={ach}
                                onChange={(e) => {
                                  setAch(e.target.value === "" ? "" : parseFloat(e.target.value));
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder="e.g. 0.5"
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setAch(0.35); toast.success("Reset ACH to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Infiltration (ACH)")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* Input 9: Safety Margin (%) - Full width across 2 columns */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                              <div className="flex justify-between items-center">
                                <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                  Design Safety Margin (%)
                                </label>
                              </div>
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={safetyMargin}
                                onChange={(e) => {
                                  setSafetyMargin(e.target.value === "" ? "" : parseFloat(e.target.value));
                                  dirtyStore.set(true);
                                }}
                                className={flowInputClass}
                                placeholder="e.g. 15"
                              />
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                            <ContextMenuItem onClick={() => { setSafetyMargin(15); toast.success("Reset safety margin to default"); }}>
                              <RotateCcw className="size-3.5 mr-2" /> Reset to Default
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenComment("spaceEnvelopeCard", "Design Safety Margin")}>
                              <MessageSquare className="size-3.5 mr-2" /> Add Comment / Task
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>

                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALCULATION RESULTS - SCROLLABLE PANEL (lg:col-span-7) */}
                  <div className="lg:col-span-7 h-full max-h-full overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {/* PRIMARY RESULTS CARD */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="card-hero-results"
                          data-field-id="card-hero-results"
                          data-comment-target="card-hero-results"
                          onDoubleClick={() => setFormulaModalOpen(true)}
                          title="Double-click to view ASHRAE formula breakdown"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 cursor-pointer transition-colors ${isFieldHighlighted("card-hero-results", "HEATING LOAD BREAKDOWN")}`}
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                ⚡ Sizing Results Summary
                              </span>
                              {renderCommentBadge("card-hero-results", "HEATING LOAD BREAKDOWN")}
                            </div>
                            <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              ASHRAE Steady-State
                            </span>
                          </div>

                          {/* DISPLAY STAT CARDS (4 Color-coded cards matching Duct Sizer reference) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Base Heating Load</div>
                              <div className="text-xl font-bold font-mono text-foreground tracking-tight text-primary">
                                {isSI ? `${calcResults.kwBase.toFixed(2)}` : `${Math.round(calcResults.qBase).toLocaleString()}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/h"}</span>
                              </div>
                            </div>

                            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Heater / Boiler Duty</div>
                              <div className="text-xl font-bold font-mono text-foreground">
                                {isSI ? `${calcResults.kwTotal.toFixed(2)}` : `${Math.round(calcResults.qTotal).toLocaleString()}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/h"}</span>
                              </div>
                            </div>

                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Load Density</div>
                              <div className="text-xl font-bold font-mono text-foreground">
                                {isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)}` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "W/m²" : "BTU/h/ft²"}</span>
                              </div>
                            </div>

                            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Design Delta T (ΔT)</div>
                              <div className="text-xl font-bold font-mono text-foreground">
                                {isSI ? `${(((Number(iat) - Number(oat))) / 1.8).toFixed(1)}` : `${Math.round(Number(iat) - Number(oat))}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                              </div>
                            </div>
                          </div>

                          {/* DETAILED METRICS TABLE */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Envelope Conduction Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${totalCondLossKw.toFixed(2)} kW` : `${Math.round(totalCondLossBtu).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Glazing Conduction Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Infiltration Heat Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Base Building Heat Load:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Specific Heat Load Density:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/ft²`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Equipment Safety Factor:</span>
                              <span className="font-mono font-bold">{safetyMargin}%</span>
                            </div>
                            <div className="flex justify-between py-1 font-bold text-foreground">
                              <span>Sized Equipment Capacity:</span>
                              <span className="font-mono text-[#0A7BC7]">{calcResults.kwTotal.toFixed(2)} kW ({Math.round(calcResults.qTotal).toLocaleString()} BTU/hr)</span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => setFormulaModalOpen(true)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
                        >
                          <Eye className="size-3.5 text-primary" />
                          <span>Formula Breakdown</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleOpenComment("card-hero-results", "HEATING LOAD BREAKDOWN")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>

                </div>
              ) : (
                /* REPORT PREVIEW TAB */
                <div className="h-full max-h-full overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6 max-w-4xl mx-auto w-full pb-16">
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

                  {/* Table 1 */}
                  <div className="space-y-2">
                    <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                      1. Design Parameters & Envelope Properties
                    </h3>
                    <table className="w-full text-[12px] border-collapse border border-border">
                      <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                        <tr>
                          <th className="border border-border p-2 text-center w-12">No.</th>
                          <th className="border border-border p-2 text-left">Input Parameter</th>
                          <th className="border border-border p-2 text-center w-28">Value</th>
                          <th className="border border-border p-2 text-center w-20">Unit</th>
                          <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                          <td className="border border-border p-2 font-bold">Floor area</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(area) * SQFT_TO_SQM).toFixed(1) : Number(area).toFixed(0)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "m²" : "ft²"}</td>
                          <td className="border border-border p-2 text-muted-foreground">Architectural Space Layout</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                          <td className="border border-border p-2 font-bold">Ceiling height</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(height) * FT_TO_M).toFixed(2) : Number(height).toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                          <td className="border border-border p-2 text-muted-foreground">Section Clear Room Height</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                          <td className="border border-border p-2 font-bold">Wall + roof U-value</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(uWall) * U_IP_TO_SI).toFixed(2) : Number(uWall).toFixed(3)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                          <td className="border border-border p-2 text-muted-foreground">ASHRAE 90.1 Envelope Table 5.5</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                          <td className="border border-border p-2 font-bold">Glazing area</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(glazArea) * SQFT_TO_SQM).toFixed(1) : Number(glazArea).toFixed(0)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "m²" : "ft²"}</td>
                          <td className="border border-border p-2 text-muted-foreground">Window-to-Wall Ratio</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                          <td className="border border-border p-2 font-bold">Glazing U-value</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? (Number(uGlaz) * U_IP_TO_SI).toFixed(2) : Number(uGlaz).toFixed(2)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                          <td className="border border-border p-2 text-muted-foreground">Double-Glazed Thermal Assembly</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                          <td className="border border-border p-2 font-bold">Outdoor design temperature</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? ((Number(oat) - 32) / 1.8).toFixed(1) : Number(oat).toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "°C" : "°F"}</td>
                          <td className="border border-border p-2 text-muted-foreground">ASHRAE 99.6% Climatic Data</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                          <td className="border border-border p-2 font-bold">Indoor setpoint</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? ((Number(iat) - 32) / 1.8).toFixed(1) : Number(iat).toFixed(1)}</td>
                          <td className="border border-border p-2 text-center">{isSI ? "°C" : "°F"}</td>
                          <td className="border border-border p-2 text-muted-foreground">ASHRAE 55 Comfort Standard</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                          <td className="border border-border p-2 font-bold">Infiltration (ACH)</td>
                          <td className="border border-border p-2 text-center font-bold">{Number(ach).toFixed(2)}</td>
                          <td className="border border-border p-2 text-center">air changes/hr</td>
                          <td className="border border-border p-2 text-muted-foreground">Envelope Air Leakage Rate</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 2 */}
                  <div className="space-y-3">
                    <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                      2. Winter Heat Loss Breakdown & Sizing Summary
                    </h3>
                    <table className="w-full text-[12px] border-collapse border border-border">
                      <thead className="font-bold">
                        <tr>
                          <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-center w-12">Item</th>
                          <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Heating Load Metric</th>
                          <th className="bg-[#DAE9F8] dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-border p-2 text-center w-52">Calculated Result</th>
                          <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Engineering Basis & Formula</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                          <td className="border border-border p-2 font-bold">Envelope conduction loss</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? `${totalCondLossKw.toFixed(2)} kW` : `${Math.round(totalCondLossBtu).toLocaleString()} BTU/hr`}</td>
                          <td className="border border-border p-2 text-muted-foreground">Walls, Roof & Slab Conduction</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                          <td className="border border-border p-2 font-bold">Glazing conduction loss</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`}</td>
                          <td className="border border-border p-2 text-muted-foreground">Fenestration Thermal Conduction</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                          <td className="border border-border p-2 font-bold">Infiltration heat loss</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`}</td>
                          <td className="border border-border p-2 text-muted-foreground">Air Infiltration Leakage Loss</td>
                        </tr>
                        <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                          <td className="border border-border p-2 text-center">4</td>
                          <td className="border border-border p-2">Total heating load</td>
                          <td className="border border-border p-2 text-center text-primary font-black">
                            {isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`}
                          </td>
                          <td className="border border-border p-2 font-medium text-muted-foreground">Q_base = Envelope + Glazing + Infiltration</td>
                        </tr>
                        <tr>
                          <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                          <td className="border border-border p-2 font-bold">{isSI ? "Load per m²" : "Load per ft²"}</td>
                          <td className="border border-border p-2 text-center font-bold">{isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/ft²`}</td>
                          <td className="border border-border p-2 text-muted-foreground">Load / Floor area</td>
                        </tr>
                        <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                          <td className="border border-border p-2 text-center">6</td>
                          <td className="border border-border p-2">Heater / boiler capacity</td>
                          <td className="border border-border p-2 text-center text-primary font-black">
                            {isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`}
                          </td>
                          <td className="border border-border p-2 font-medium text-muted-foreground">Includes {safetyMargin}% safety margin</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Heat Loss Breakdown Visual Progress Bars in Report Preview */}
                    <div className="pt-2">
                      {renderBreakdownChart()}
                    </div>
                  </div>

                  {/* Table 3 */}
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
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
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
              </div>
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                <div className="font-bold text-foreground">2. Infiltration & Fresh Air Sensible Loss</div>
                <div className="font-mono font-bold text-primary text-xs bg-background p-2 rounded-lg border border-border/60">
                  Q_air = 1.08 × CFM × (T_in - T_out) &nbsp;&nbsp;[IP]<br/>
                  Q_air = 1.20 × L/s × (T_in - T_out) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[SI, Watts]
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 space-y-1.5">
                <div className="font-bold text-foreground">3. Total Sized Heating Capacity</div>
                <div className="font-mono font-bold text-primary text-xs bg-background p-2 rounded-lg border border-border/60">
                  Q_total = (Q_cond + Q_infil + Q_vent) × (1 + Safety%)
                </div>
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
