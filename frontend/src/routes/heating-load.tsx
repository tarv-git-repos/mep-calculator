import {
  calculateHeatingLoad,
  SQFT_TO_SQM,
  SQM_TO_SQFT,
  FT_TO_M,
  M_TO_FT,
  U_IP_TO_SI,
  U_SI_TO_IP,
  CFM_TO_LPS,
  LPS_TO_CFM,
  BTU_HR_TO_KW,
  KW_TO_BTU_HR,
  HEATING_PRESETS,
  type HeatingPresetKey,
  type HeatingPresetConfig,
} from "@/lib/calc-heating-load";

import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { getMergedItemComments } from "@/utils/commentHelpers";
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
  Stethoscope, Store, Warehouse, Sun, Wind, GraduationCap, SlidersHorizontal, Eye, Sliders, FileSpreadsheet, ChevronRight,
  ChevronDown, ChevronUp
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
import { HeatingLoadFormulaModal } from "@/components/workspace/HeatingLoadFormulaModal";

export const Route = createFileRoute("/heating-load")({
  head: () => ({
    meta: [
      { title: "Heating Load — MEP Calculator" },
      { name: "description", content: "Heating Load module: envelope heat losses, infiltration loads, and boiler sizing." },
    ],
  }),
  component: HeatingLoadPage,
});

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
  const [breakdownCollapsed, setBreakdownCollapsed] = useState(false); // Adjustable Heat Loss Breakdown

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
    localStorage.setItem(`mep_calc_comments_${pId}_heating-load`, JSON.stringify(newList));
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
      calculatorTitle: "Heating Load",
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
        "Heating Load",
        targetName,
        commentData.text || "",
        "/heating-load",
        targetId
      );
    } else {
      dispatchGlobalCommentNotification(
        "Heating Load",
        targetName,
        commentData.text || "",
        "/heating-load",
        targetId
      );
    }
    toast.success(`Comment / task assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const getItemComments = (id: string, name?: string) => {
    if (!id) return [];

    // 1. First get comments from getMergedItemComments which checks localStorage keys & global coordination
    const merged = getMergedItemComments(
      id,
      name,
      commentsList,
      "/heating-load",
      activeProjectId || project?.id || "default"
    );

    if (merged && merged.length > 0) {
      return merged.filter((c: any) => c && c.status !== "RESOLVED");
    }

    const clean = id.toLowerCase().trim();
    const cleanRaw = clean.replace(/^(field-|card-)/, "");

    return commentsList.filter((c) => {
      if (!c) return false;
      if (c.status === "RESOLVED") return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.targetItemId || c.id || "").toLowerCase().trim();
      const tIdRaw = tId.replace(/^(field-|card-)/, "");
      const tName = String(c.targetName || c.spaceName || c.name || "").toLowerCase().trim();

      if (
        tId === clean ||
        tId === `field-${clean}` ||
        `field-${tId}` === clean ||
        tId === `card-${clean}` ||
        `card-${tId}` === clean ||
        (cleanRaw && tIdRaw === cleanRaw) ||
        (name && tName && (tName === name.toLowerCase().trim() || tName.includes(name.toLowerCase().trim())))
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
    const itemComments = getItemComments(id, name);
    if (itemComments.length === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={itemComments.length}
        onClick={() => handleOpenComment(id, name)}
      />
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
    const uGlazVal = typeof uGlaz === "number" ? uGlaz : 0.32;
    const glazAreaVal = typeof glazArea === "number" ? glazArea : 600;
    const oatVal = typeof oat === "number" ? oat : 20;
    const iatVal = typeof iat === "number" ? iat : 70;
    const achVal = typeof ach === "number" ? ach : 0.35;
    const sfVal = typeof safetyMargin === "number" ? safetyMargin : 15;

    return calculateHeatingLoad(areaVal, heightVal, uWallVal, uGlazVal, glazAreaVal, oatVal, iatVal, achVal, sfVal);
  }, [area, height, uWall, uGlaz, glazArea, oat, iat, ach, safetyMargin]);

  // Export PDF
  const exportPdf = async () => {
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
      const projectName = project?.name || (project as any)?.projectName || "Heating Load Sizing";
      const clientName = project?.client || "-";
      const endUser = (project as any)?.endUser || (project as any)?.location || "-";

      // 1. Header Title (Matching Ventilation & Preliminary Standard)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 20);
      doc.text("Heating Load Calculation", 14, 14);

      // 2. Metadata Block (Standard 2-column x 3-row enclosed format: 182mm width)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.setDrawColor(100, 100, 100);
      doc.rect(14, 18, 182, 18); // Outer box (182mm width: 14 to 196mm)

      // Vertical line
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

      // Styling tokens matching Ventilation & Preliminary PDF
      const primaryFill = [217, 217, 217] as [number, number, number]; // Standard header gray (#D9D9D9)
      const blueFill = [218, 233, 248] as [number, number, number]; // Result highlight blue (#DAE9F8)
      const signatureFill = [255, 230, 204] as [number, number, number]; // Signature header orange (#FFE6CC)

      const uWallSI = (Number(uWall) || 0.065) * U_IP_TO_SI;
      const uRoofSI = (Number(uRoof) || 0.035) * U_IP_TO_SI;
      const uGlazSI = (Number(uGlaz) || 0.32) * U_IP_TO_SI;
      const ventLps = (Number(ventCfm) || 450) * CFM_TO_LPS;

      const paramTableBody = [
        ["1", "Floor area", isSI ? `${(Number(area) * SQFT_TO_SQM).toFixed(1)}` : `${Number(area).toFixed(0)}`, isSI ? "m²" : "ft²", "Architectural Space Layout"],
        ["2", "Ceiling clear height", isSI ? `${(Number(height) * FT_TO_M).toFixed(2)}` : `${Number(height).toFixed(1)}`, isSI ? "m" : "ft", "Section Clear Room Height"],
        ["3", "Exterior wall U-value", isSI ? `${uWallSI.toFixed(2)}` : `${Number(uWall).toFixed(3)}`, isSI ? "W/m²K" : "BTU/hr·ft²·°F", "ASHRAE 90.1 Envelope Table 5.5"],
        ["4", "Roof assembly U-value", isSI ? `${uRoofSI.toFixed(2)}` : `${Number(uRoof).toFixed(3)}`, isSI ? "W/m²K" : "BTU/hr·ft²·°F", "Continuous Insulation Assembly"],
        ["5", "Glazing area", isSI ? `${(Number(glazArea) * SQFT_TO_SQM).toFixed(1)}` : `${Number(glazArea).toFixed(0)}`, isSI ? "m²" : "ft²", "Window-to-Wall Ratio"],
        ["6", "Glazing U-value", isSI ? `${uGlazSI.toFixed(2)}` : `${Number(uGlaz).toFixed(2)}`, isSI ? "W/m²K" : "BTU/hr·ft²·°F", "Double-Glazed Thermal Assembly"],
        ["7", "Outdoor design temperature", isSI ? `${((Number(oat) - 32) / 1.8).toFixed(1)}` : `${Number(oat).toFixed(1)}`, isSI ? "°C" : "°F", "ASHRAE 99.6% Climatic Data"],
        ["8", "Indoor setpoint", isSI ? `${((Number(iat) - 32) / 1.8).toFixed(1)}` : `${Number(iat).toFixed(1)}`, isSI ? "°C" : "°F", "ASHRAE 55 Comfort Standard"],
        ["9", "Infiltration (ACH)", `${Number(ach).toFixed(2)}`, "air changes/hr", "Envelope Air Leakage Rate"],
        ["10", "Mechanical fresh air ventilation", isSI ? `${ventLps.toFixed(1)}` : `${Number(ventCfm).toFixed(0)}`, isSI ? "L/s" : "CFM", "ASHRAE 62.1 Outdoor Air Rate"],
        ["11", "Intermittent safety / warm-up margin", `${Number(safetyMargin).toFixed(0)}`, "%", "Cold-Start & Pickup Factor"]
      ];

      // Table 1: Design Parameters & Envelope Properties
      callAutoTable(doc, {
        startY: 42,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          cellPadding: 1.5,
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
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

      let nextY = (doc as any).lastAutoTable?.finalY ?? 95;

      const resultsTableBody = [
        ["1", "Exterior wall conduction loss", isSI ? `${calcResults.kwWall.toFixed(2)} kW` : `${Math.round(calcResults.qWall).toLocaleString()} BTU/hr`, "Q_wall = U_wall × A_net × ΔT"],
        ["2", "Roof assembly conduction loss", isSI ? `${calcResults.kwRoof.toFixed(2)} kW` : `${Math.round(calcResults.qRoof).toLocaleString()} BTU/hr`, "Q_roof = U_roof × A_roof × ΔT"],
        ["3", "Glazing conduction loss", isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`, "Q_glaz = U_glaz × A_glaz × ΔT"],
        ["4", "Slab-on-grade perimeter loss", isSI ? `${calcResults.kwSlab.toFixed(2)} kW` : `${Math.round(calcResults.qSlab).toLocaleString()} BTU/hr`, "Q_slab = F_p × Perimeter × ΔT"],
        ["5", "Infiltration sensible heat loss", isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`, "Q_infil = 1.08 × CFM × ΔT / 1.21 × L/s × ΔT"],
        ["6", "Mechanical fresh air ventilation loss", isSI ? `${calcResults.kwVent.toFixed(2)} kW` : `${Math.round(calcResults.qVent).toLocaleString()} BTU/hr`, "Q_vent = 1.08 × CFM × ΔT / 1.21 × L/s × ΔT"],
        ["7", "Total base heating load", isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`, "Q_base = Sum of envelope & air losses"],
        ["8", isSI ? "Specific load per m²" : "Specific load per ft²", isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/ft²`, "Normalized Benchmark"],
        ["9", "Heater / boiler capacity (Sized Duty)", isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`, `Includes ${safetyMargin}% safety margin`]
      ];

      // Table 2: Winter Heat Loss Breakdown & Sizing Summary
      callAutoTable(doc, {
        startY: nextY + 4,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          cellPadding: 1.5,
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 74, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 52 }
        },
        head: [["Item", "Heating Load Metric", "Calculated Result", "Engineering Basis & Formula"]],
        body: resultsTableBody,
        didParseCell: function (data: any) {
          if (data.section === "body" && (data.row.index === 6 || data.row.index === 8)) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = blueFill;
          }
        }
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 145;

      const standardsBody = [
        ["1", "ASHRAE 90.1 Envelope Standard", "Maximum allowable U-values for opaque walls, roof insulation, and fenestration SHGC/U-factors must satisfy ASHRAE 90.1 prescriptive tables."],
        ["2", "Ventilation Heat Recovery", "Where mechanical ventilation supply exceeds 5,000 CFM with >= 70% outdoor air, an energy recovery ventilation (ERV/HRV) system is recommended."],
        ["3", "Infiltration Tightness", "Air barrier continuity must be maintained per ASTM E779 air leakage testing (max 0.40 CFM/sq ft envelope area at 75 Pa)."],
        ["4", "Safety & Pick-up Factor", "A 10% to 20% capacity factor accounts for cold-start thermal mass warm-up and intermittent night set-back recovery."],
      ];

      // Table 3: Mandatory Design Standards & Engineering Guidelines
      callAutoTable(doc, {
        startY: nextY + 4,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.2,
          halign: "left",
          valign: "middle",
          cellPadding: 1.5,
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: "bold", halign: "center" },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 60, fontStyle: "bold" },
          2: { cellWidth: 112 },
        },
        head: [["No.", "Mandatory Design Standard", "Compliance & Engineering Criteria"]],
        body: standardsBody,
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 195;

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } =
        getSignatureBlockDetails(project?.id || "default", "/heating-load", currentUserName, calcReviewState);

      // Table 4: Sign-Off & Approvals
      callAutoTable(doc, {
        startY: finalY + 4,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          cellPadding: 1.8,
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: signatureFill, textColor: 0, fontStyle: "bold" },
        head: [["", "Originator", "Reviewer", "Approver"]],
        body: [
          [{ content: "Name:", styles: { fontStyle: "bold", halign: "right" } }, originatedName || currentUserName || "-", reviewerName || "-", approverName || "-"],
          [{ content: "Date:", styles: { fontStyle: "bold", halign: "right" } }, originatedDate || today, reviewerDate || "-", approverDate || "-"]
        ],
        columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 50 }, 2: { cellWidth: 50 }, 3: { cellWidth: 50 } }
      });

      const pdfBuffer = doc.output("arraybuffer");
      const projCode = projectNo || project?.code || "P000";
      const fileName = `Heating_Load_Calculation_${projCode}.pdf`;
      await downloadFile(new Uint8Array(pdfBuffer), fileName, "PDF Document", ["pdf"]);
      toast.success("Heating Load PDF calculation exported successfully!");
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

      ws.addRow(["HEATING LOAD CALCULATION REPORT"]);
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

  const renderBreakdownChart = (isReportPreview = false) => {
    const bars = [
      { label: "Envelope Conduction", val: isSI ? (calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab) : (calcResults.qWall + calcResults.qRoof + calcResults.qSlab), pct: calcResults.pctWall + calcResults.pctRoof + calcResults.pctSlab, color: "#3B82F6" },
      { label: "Glazing Conduction", val: isSI ? calcResults.kwGlaz : calcResults.qGlaz, pct: calcResults.pctGlaz, color: "#F59E0B" },
      { label: "Infiltration Heat Loss", val: isSI ? calcResults.kwInfil : calcResults.qInfil, pct: calcResults.pctInfil, color: "#EC4899" },
    ];

    const maxVal = Math.max(...bars.map((b) => b.val)) * 1.15 || 1;

    return (
      <div 
        id="card-breakdown-chart"
        data-field-id="breakdownChart"
        data-comment-target="breakdownChart"
        className={`p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 transition-all duration-200 relative ${isFieldHighlighted("breakdownChart", "Heat Loss Breakdown")}`}
      >
        <div 
          onClick={() => !isReportPreview && setBreakdownCollapsed(prev => !prev)}
          className={`flex items-center justify-between select-none ${!isReportPreview ? "cursor-pointer group" : ""} ${!breakdownCollapsed || isReportPreview ? "border-b border-slate-200/60 dark:border-zinc-800 pb-2 mb-2" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-1.5 group-hover:text-primary transition-colors">
              <Flame className="size-3.5 text-amber-500" /> Heat Loss Breakdown
            </span>
            {renderCommentBadge("breakdownChart", "Heat Loss Breakdown")}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-white/80 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200/50 dark:border-zinc-700/50">
              Base: {isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/h`}
            </span>
            {!isReportPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBreakdownCollapsed(prev => !prev);
                }}
                className="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-zinc-700 text-slate-500 hover:text-foreground transition cursor-pointer flex items-center justify-center"
                title={breakdownCollapsed ? "Expand Heat Loss Breakdown" : "Collapse Heat Loss Breakdown"}
              >
                <ChevronDown className={`size-3.5 text-muted-foreground transition-transform duration-200 ${breakdownCollapsed ? "-rotate-90" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* Collapsed Inline Summary Bar */}
        {breakdownCollapsed && !isReportPreview ? (
          <div 
            onClick={() => setBreakdownCollapsed(false)}
            className="flex items-center justify-between text-[11px] pt-1 text-slate-600 dark:text-zinc-300 font-mono cursor-pointer hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-500" />
                Env: {(calcResults.pctWall + calcResults.pctRoof + calcResults.pctSlab).toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Glaz: {calcResults.pctGlaz.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-pink-500" />
                Infil: {calcResults.pctInfil.toFixed(1)}%
              </span>
            </div>
            <span className="text-[10px] text-primary hover:underline font-sans font-medium">
              Click to expand
            </span>
          </div>
        ) : (
          /* Expanded Progress Bars */
          <div className="space-y-2">
            {bars.map((b, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.label}
                  </span>
                  <span className="font-mono text-slate-500">
                    {isSI ? `${b.val.toFixed(2)} kW` : `${Math.round(b.val).toLocaleString()} BTU/h`} ({b.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/70 dark:bg-zinc-700/60 rounded-full overflow-hidden">
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
        )}
      </div>
    );
  };

  const getInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseClass = "w-full h-8 px-2.5 rounded font-mono text-xs focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

    return `${baseClass} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-primary ${isHigh}`;
  };

  const inputClass = "w-full h-8 px-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-mono text-xs focus:outline-none focus:border-primary disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";
  const flowInputClass = "w-full h-9 px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  const totalCondLossKw = calcResults.kwWall + calcResults.kwRoof + calcResults.kwSlab;
  const totalCondLossBtu = calcResults.qWall + calcResults.qRoof + calcResults.qSlab;

  // Context Menu & Value Helpers matching Ventilation & Duct Sizer standard
  const handleCopyValue = (label: string, val: string | number) => {
    try {
      const textToCopy = String(val);
      navigator.clipboard.writeText(textToCopy);
      toast.success(`Copied ${label}: ${textToCopy}`);
    } catch {
      toast.error("Failed to copy value to clipboard.");
    }
  };

  const handlePasteValue = async (label: string, field: "area" | "height" | "oat" | "iat" | "uWall" | "uGlaz" | "glazArea" | "ach" | "safetyMargin") => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num)) {
        if (field === "area") setArea(isSI ? num * SQM_TO_SQFT : num);
        else if (field === "height") setHeight(isSI ? num * M_TO_FT : num);
        else if (field === "oat") setOat(isSI ? num * 1.8 + 32 : num);
        else if (field === "iat") setIat(isSI ? num * 1.8 + 32 : num);
        else if (field === "uWall") setUWall(isSI ? num * U_SI_TO_IP : num);
        else if (field === "uGlaz") setUGlaz(isSI ? num * U_SI_TO_IP : num);
        else if (field === "glazArea") setGlazArea(isSI ? num * SQM_TO_SQFT : num);
        else if (field === "ach") setAch(num);
        else if (field === "safetyMargin") setSafetyMargin(num);
        dirtyStore.set(true);
        toast.success(`Pasted ${label}: ${num}`);
      } else {
        toast.error("Invalid number in clipboard.");
      }
    } catch {
      toast.error("Clipboard access denied or unavailable.");
    }
  };

  const handleResetField = (label: string, field: string, defaultVal: any) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    if (field === "area") setArea(defaultVal);
    else if (field === "height") setHeight(defaultVal);
    else if (field === "oat") setOat(defaultVal);
    else if (field === "iat") setIat(defaultVal);
    else if (field === "uWall") setUWall(defaultVal);
    else if (field === "uGlaz") setUGlaz(defaultVal);
    else if (field === "glazArea") setGlazArea(defaultVal);
    else if (field === "ach") setAch(defaultVal);
    else if (field === "safetyMargin") setSafetyMargin(defaultVal);
    dirtyStore.set(true);
    toast.success(`Reset ${label} to default`);
  };

  const handleClearField = (label: string, field: string) => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    if (field === "area") setArea("");
    else if (field === "height") setHeight("");
    else if (field === "oat") setOat("");
    else if (field === "iat") setIat("");
    else if (field === "uWall") setUWall("");
    else if (field === "uGlaz") setUGlaz("");
    else if (field === "glazArea") setGlazArea("");
    else if (field === "ach") setAch("");
    else if (field === "safetyMargin") setSafetyMargin("");
    dirtyStore.set(true);
    toast.info(`Cleared ${label}`);
  };

  return (
    <AppShell
      title="Heating Load"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header matching Ventilation & Pump Sizing exactly */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Heating Load</h1>
              </div>
              <button
                onClick={() => setIntelOpen(v => !v)}
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
                calculatorTitle="Heating Load"
              />
            </div>
            <div className="flex items-center gap-2">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitSystemChange} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White / Dark Card container for Parameters & Results Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>

            {/* Action Selector Row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setTab("solver")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Calculator
                  </button>
                  <button
                    type="button"
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

                <TBtn
                  onClick={() => setFormulaModalOpen(true)}
                  title="View ASHRAE Fundamentals & CIBSE Guide A Heating Load Formulas"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Right Side: Export button in line with Tabs matching Preliminary & Condensate */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={exportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div key={tab} className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {tab === "solver" && (
                <div 
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5, STICKY) */}
                  <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-0 self-start">
                    <div 
                      id="card-spaceEnvelopeCard"
                      data-field-id="spaceEnvelopeCard"
                      data-comment-target="spaceEnvelopeCard"
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 md:p-5 space-y-4 relative ${isFieldHighlighted("spaceEnvelopeCard", "Sizing Parameters")}`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Sizing Parameters
                        </span>
                        {renderCommentBadge("spaceEnvelopeCard", "Sizing Parameters")}
                      </div>

                      {/* Section 1: Building Application Preset */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-presetParams" 
                            data-field-id="presetParams" 
                            data-comment-target="presetParams"
                            className={`space-y-2 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("presetParams", "Building Application Preset")}`}
                          >
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Building Application Preset
                              </label>
                            </div>
                            <div className="relative">
                              <HeatingProfileSelect
                                value={preset}
                                customProfileName={customProfileName}
                                onChange={handleApplyPreset}
                                onOpenCustomModal={() => setCustomModalOpen(true)}
                                unitSystem={unitSystem}
                                disabled={isEffectiveReadOnly}
                              />
                              {renderCommentBadge("presetParams", "Building Application Preset")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("presetParams", "Building Application Preset")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => {
                              handleApplyPreset("commercial_office");
                              toast.success("Reset building preset to Commercial Office");
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Building Preset</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Section 2: Space & Dimensions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Space & Dimensions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Floor Area Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-area"
                                data-field-id="area"
                                data-comment-target="area"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("area", "Floor Area")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Floor Area ({isSI ? "m²" : "sq.ft"})</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("area", "Floor Area")}
                                    placeholder={isSI ? "e.g. 185" : "e.g. 2000"}
                                  />
                                  {renderCommentBadge("area", "Floor Area")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("area", "Floor Area")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Floor Area", isSI && typeof area === "number" ? `${(area * SQFT_TO_SQM).toFixed(1)} m²` : `${area} sq ft`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Floor Area", "area")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Floor Area", "area", HEATING_PRESETS[preset]?.area || 5000)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Floor Area", "area")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Ceiling Height Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-height"
                                data-field-id="height"
                                data-comment-target="height"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("height", "Ceiling Height")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Ceiling Height ({isSI ? "m" : "ft"})</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("height", "Ceiling Height")}
                                    placeholder={isSI ? "e.g. 3.0" : "e.g. 10"}
                                  />
                                  {renderCommentBadge("height", "Ceiling Height")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("height", "Ceiling Height")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Ceiling Height", isSI && typeof height === "number" ? `${(height * FT_TO_M).toFixed(2)} m` : `${height} ft`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Ceiling Height", "height")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Ceiling Height", "height", HEATING_PRESETS[preset]?.height || 10)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Ceiling Height", "height")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* Section 3: Design Temperatures */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Design Temperatures ({isSI ? "°C" : "°F"})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Outdoor Design Temp */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-oat"
                                data-field-id="oat"
                                data-comment-target="oat"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("oat", "Outdoor Design Temp")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Outdoor Design Temp</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("oat", "Outdoor Design Temp")}
                                    placeholder={isSI ? "e.g. -6.7" : "e.g. 20"}
                                  />
                                  {renderCommentBadge("oat", "Outdoor Design Temp")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("oat", "Outdoor Design Temp")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Outdoor Design Temp", isSI && typeof oat === "number" ? `${((oat - 32) / 1.8).toFixed(1)} °C` : `${oat} °F`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Outdoor Design Temp", "oat")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Outdoor Design Temp", "oat", HEATING_PRESETS[preset]?.oat || 20)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Outdoor Design Temp", "oat")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
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
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("iat", "Indoor Setpoint")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Indoor Setpoint</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("iat", "Indoor Setpoint")}
                                    placeholder={isSI ? "e.g. 21.1" : "e.g. 70"}
                                  />
                                  {renderCommentBadge("iat", "Indoor Setpoint")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("iat", "Indoor Setpoint")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Indoor Setpoint", isSI && typeof iat === "number" ? `${((iat - 32) / 1.8).toFixed(1)} °C` : `${iat} °F`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Indoor Setpoint", "iat")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Indoor Setpoint", "iat", HEATING_PRESETS[preset]?.iat || 70)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Indoor Setpoint", "iat")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* Section 4: Envelope & Glazing Thermal Properties */}
                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Envelope & Infiltration
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Glazing Area Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-glazArea"
                                data-field-id="glazArea"
                                data-comment-target="glazArea"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("glazArea", "Glazing Area")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Glazing Area ({isSI ? "m²" : "sq.ft"})</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("glazArea", "Glazing Area")}
                                    placeholder={isSI ? "e.g. 55.7" : "e.g. 600"}
                                  />
                                  {renderCommentBadge("glazArea", "Glazing Area")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("glazArea", "Glazing Area")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Glazing Area", isSI && typeof glazArea === "number" ? `${(glazArea * SQFT_TO_SQM).toFixed(1)} m²` : `${glazArea} sq ft`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Glazing Area", "glazArea")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Glazing Area", "glazArea", HEATING_PRESETS[preset]?.glazArea || 600)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Glazing Area", "glazArea")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Glazing U-Value Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-uGlaz"
                                data-field-id="uGlaz"
                                data-comment-target="uGlaz"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("uGlaz", "Glazing U-value")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Glazing U-value ({isSI ? "W/m²K" : "BTU/h·ft²·°F"})</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("uGlaz", "Glazing U-value")}
                                    placeholder={isSI ? "e.g. 1.82" : "e.g. 0.32"}
                                  />
                                  {renderCommentBadge("uGlaz", "Glazing U-value")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("uGlaz", "Glazing U-value")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Glazing U-value", isSI && typeof uGlaz === "number" ? `${(uGlaz * U_IP_TO_SI).toFixed(2)} W/m²K` : `${uGlaz} BTU/hr·ft²·°F`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Glazing U-value", "uGlaz")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Glazing U-value", "uGlaz", HEATING_PRESETS[preset]?.uGlaz || 0.32)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Glazing U-value", "uGlaz")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Wall + Roof U-Value Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-uWall"
                                data-field-id="uWall"
                                data-comment-target="uWall"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("uWall", "Wall + Roof U-value")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Wall+Roof U-value ({isSI ? "W/m²K" : "BTU/h·ft²·°F"})</label>
                                </div>
                                <div className="relative mt-1">
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
                                    className={getInputClass("uWall", "Wall + Roof U-value")}
                                    placeholder={isSI ? "e.g. 0.37" : "e.g. 0.065"}
                                  />
                                  {renderCommentBadge("uWall", "Wall + Roof U-value")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("uWall", "Wall + Roof U-value")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Wall + Roof U-value", isSI && typeof uWall === "number" ? `${(uWall * U_IP_TO_SI).toFixed(2)} W/m²K` : `${uWall} BTU/hr·ft²·°F`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Wall + Roof U-value", "uWall")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Wall + Roof U-value", "uWall", HEATING_PRESETS[preset]?.uWall || 0.065)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Wall + Roof U-value", "uWall")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Infiltration ACH Input */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-ach"
                                data-field-id="ach"
                                data-comment-target="ach"
                                className={`space-y-1 p-1 -m-1 rounded-lg transition-colors ${isFieldHighlighted("ach", "Infiltration (ACH)")}`}
                              >
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] text-slate-500">Infiltration (ACH)</label>
                                </div>
                                <div className="relative mt-1">
                                  <input
                                    type="number"
                                    step="0.05"
                                    disabled={isEffectiveReadOnly}
                                    value={ach}
                                    onChange={(e) => {
                                      setAch(e.target.value === "" ? "" : parseFloat(e.target.value));
                                      dirtyStore.set(true);
                                    }}
                                    className={getInputClass("ach", "Infiltration (ACH)")}
                                    placeholder="e.g. 0.35"
                                  />
                                  {renderCommentBadge("ach", "Infiltration (ACH)")}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleOpenComment("ach", "Infiltration (ACH)")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Infiltration (ACH)", `${ach} ACH`)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handlePasteValue("Infiltration (ACH)", "ach")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleResetField("Infiltration (ACH)", "ach", HEATING_PRESETS[preset]?.ach || 0.35)}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                disabled={isEffectiveReadOnly || isApprovedLocked}
                                onClick={() => handleClearField("Infiltration (ACH)", "ach")}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                                <span>Clear Input</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      </div>

                      {/* Section 5: Safety Margin */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div 
                            id="field-safetyParams" 
                            data-field-id="safetyParams" 
                            data-comment-target="safetyParams"
                            className={`pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2 p-2 -m-2 rounded-lg transition-colors ${isFieldHighlighted("safetyParams", "Safety Margin")}`}
                          >
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Design Safety Margin (%)
                              </label>
                            </div>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                disabled={isEffectiveReadOnly}
                                value={safetyMargin}
                                onChange={(e) => {
                                  setSafetyMargin(e.target.value === "" ? "" : parseFloat(e.target.value));
                                  dirtyStore.set(true);
                                }}
                                className={getInputClass("safetyParams", "Safety Margin")}
                                placeholder="e.g. 15"
                              />
                              {renderCommentBadge("safetyParams", "Safety Margin")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("safetyParams", "Safety Margin")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Safety Margin", `${safetyMargin}%`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handlePasteValue("Safety Margin", "safetyMargin")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <Clipboard className="size-3.5 text-muted-foreground" />
                            <span>Paste Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleResetField("Safety Margin", "safetyMargin", 15)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset to Default</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleClearField("Safety Margin", "safetyMargin")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                            <span>Clear Input</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: CALCULATION RESULTS (lg:col-span-7, STICKY) */}
                  <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-0 self-start">
                    {/* PRIMARY RESULTS CARD */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="card-hero-results"
                          data-field-id="card-hero-results"
                          data-comment-target="card-hero-results"
                          className={`relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-4 md:p-5 space-y-4 transition-colors ${isFieldHighlighted("card-hero-results", "Sizing Results Summary")}`}
                        >
                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                ⚡ Sizing Results Summary
                              </span>
                              {renderCommentBadge("card-hero-results", "Sizing Results Summary")}
                            </div>
                            <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              ASHRAE Steady-State
                            </span>
                          </div>

                          {/* DISPLAY STAT CARDS (4 Colors Matching Pump Sizing) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3">
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Base Heating Load</div>
                              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                                {isSI ? `${calcResults.kwBase.toFixed(2)}` : `${Math.round(calcResults.qBase).toLocaleString()}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/h"}</span>
                              </div>
                            </div>

                            <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3">
                              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Heater / Boiler Duty</div>
                              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                                {isSI ? `${calcResults.kwTotal.toFixed(2)}` : `${Math.round(calcResults.qTotal).toLocaleString()}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "kW" : "BTU/h"}</span>
                              </div>
                            </div>

                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3">
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Load Density</div>
                              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                                {isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)}` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "W/m²" : "BTU/h/ft²"}</span>
                              </div>
                            </div>

                            <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3">
                              <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Design Delta T (ΔT)</div>
                              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                                {isSI ? `${(((Number(iat) - Number(oat))) / 1.8).toFixed(1)}` : `${Math.round(Number(iat) - Number(oat))}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "°C" : "°F"}</span>
                              </div>
                            </div>
                          </div>

                          {/* DETAILED METRICS TABLE */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Envelope Conduction Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${totalCondLossKw.toFixed(2)} kW` : `${Math.round(totalCondLossBtu).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Glazing Conduction Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwGlaz.toFixed(2)} kW` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Infiltration Heat Loss:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwInfil.toFixed(2)} kW` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Base Building Heat Load:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Specific Heat Load Density:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/hr/ft²`}</span>
                            </div>
                            <div className="flex justify-between py-0.5 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Equipment Safety Factor:</span>
                              <span className="font-mono font-bold">{safetyMargin}%</span>
                            </div>
                            <div className="flex justify-between py-0.5 font-bold text-foreground">
                              <span>Sized Equipment Capacity:</span>
                              <span className="font-mono text-[#0A7BC7]">{calcResults.kwTotal.toFixed(2)} kW ({Math.round(calcResults.qTotal).toLocaleString()} BTU/hr)</span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("card-hero-results", "Sizing Results Summary")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Sizing Result", `${isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/hr`} | Base: ${isSI ? `${calcResults.kwBase.toFixed(2)} kW` : `${Math.round(calcResults.qBase).toLocaleString()} BTU/hr`} | Density: ${isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/h·ft²`}`)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Copy className="size-3.5 text-muted-foreground" />
                          <span>Copy Sizing Result</span>
                          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => setFormulaModalOpen(true)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <Info className="size-3.5 text-primary" />
                          <span>View Formula Breakdown</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={exportPdf}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span>Export PDF Calculation</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={exportToExcel}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                        >
                          <FileSpreadsheet className="size-3.5 text-muted-foreground" />
                          <span>Export Excel Sheet</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    {/* Adjustable Heat Loss Breakdown Visual Progress Bars */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          {renderBreakdownChart()}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("breakdownChart", "Heat Loss Breakdown")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => setBreakdownCollapsed(prev => !prev)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium"
                        >
                          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                          <span>{breakdownCollapsed ? "Expand Breakdown" : "Collapse Breakdown"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                </div>
              </div>
            )}

              {tab === "report" && (
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40 select-none">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                    
                    {/* 1. Header Title */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        Heating Load Calculation
                      </h2>
                    </div>

                    {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format matching Preliminary) */}
                    <div className="border border-border rounded-xl overflow-hidden text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                            <td className="p-2.5 font-mono text-foreground font-medium">{(project as any)?.calcNo || "TRV-CAL-HEAT-001"}</td>
                            <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                            <td className="p-2.5 font-mono font-medium">{formatDateStr(new Date().toISOString()) || new Date().toISOString().split("T")[0]}</td>
                          </tr>
                          <tr className="border-b border-border divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                            <td className="p-2.5 font-mono">{project?.code || (project as any)?.projectNo || "P000"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                            <td className="p-2.5">{project?.client || "-"}</td>
                          </tr>
                          <tr className="divide-x divide-border">
                            <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                            <td className="p-2.5">{project?.name || "Heating Load Calculation"}</td>
                            <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                            <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 1: Design Parameters & Envelope Properties */}
                    <div className="border border-border rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                            <th className="p-2.5 border-r border-border text-center w-12">No.</th>
                            <th className="p-2.5 border-r border-border text-left">Input Parameter</th>
                            <th className="p-2.5 border-r border-border text-center w-36">Value</th>
                            <th className="p-2.5 border-r border-border text-center w-24">Unit</th>
                            <th className="p-2.5 text-left">Standard / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">1</td>
                            <td className="p-2.5 border-r border-border font-medium">Floor area</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? (Number(area) * SQFT_TO_SQM).toFixed(1) : Number(area).toFixed(0)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "m²" : "ft²"}</td>
                            <td className="p-2.5 text-muted-foreground">Architectural Space Layout</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                            <td className="p-2.5 border-r border-border font-medium">Ceiling clear height</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? (Number(height) * FT_TO_M).toFixed(2) : Number(height).toFixed(1)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "m" : "ft"}</td>
                            <td className="p-2.5 text-muted-foreground">Section Clear Room Height</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                            <td className="p-2.5 border-r border-border font-medium">Exterior wall U-value</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? ((Number(uWall) || 0.065) * U_IP_TO_SI).toFixed(2) : Number(uWall).toFixed(3)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="p-2.5 text-muted-foreground">ASHRAE 90.1 Envelope Table 5.5</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                            <td className="p-2.5 border-r border-border font-medium">Roof assembly U-value</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? ((Number(uRoof) || 0.035) * U_IP_TO_SI).toFixed(2) : Number(uRoof).toFixed(3)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="p-2.5 text-muted-foreground">Continuous Insulation Assembly</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">5</td>
                            <td className="p-2.5 border-r border-border font-medium">Glazing area</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? (Number(glazArea) * SQFT_TO_SQM).toFixed(1) : Number(glazArea).toFixed(0)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "m²" : "ft²"}</td>
                            <td className="p-2.5 text-muted-foreground">Window-to-Wall Ratio</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">6</td>
                            <td className="p-2.5 border-r border-border font-medium">Glazing U-value</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? ((Number(uGlaz) || 0.32) * U_IP_TO_SI).toFixed(2) : Number(uGlaz).toFixed(2)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "W/m²K" : "BTU/hr·ft²·°F"}</td>
                            <td className="p-2.5 text-muted-foreground">Double-Glazed Thermal Assembly</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">7</td>
                            <td className="p-2.5 border-r border-border font-medium">Outdoor design temperature</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? ((Number(oat) - 32) / 1.8).toFixed(1) : Number(oat).toFixed(1)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "°C" : "°F"}</td>
                            <td className="p-2.5 text-muted-foreground">ASHRAE 99.6% Climatic Data</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">8</td>
                            <td className="p-2.5 border-r border-border font-medium">Indoor setpoint</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? ((Number(iat) - 32) / 1.8).toFixed(1) : Number(iat).toFixed(1)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "°C" : "°F"}</td>
                            <td className="p-2.5 text-muted-foreground">ASHRAE 55 Comfort Standard</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">9</td>
                            <td className="p-2.5 border-r border-border font-medium">Infiltration (ACH)</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{Number(ach).toFixed(2)}</td>
                            <td className="p-2.5 border-r border-border text-center">air changes/hr</td>
                            <td className="p-2.5 text-muted-foreground">Envelope Air Leakage Rate</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">10</td>
                            <td className="p-2.5 border-r border-border font-medium">Mechanical fresh air ventilation</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? (Number(ventCfm) * CFM_TO_LPS).toFixed(1) : Number(ventCfm).toFixed(0)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "L/s" : "CFM"}</td>
                            <td className="p-2.5 text-muted-foreground">ASHRAE 62.1 Outdoor Air Rate</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">11</td>
                            <td className="p-2.5 border-r border-border font-medium">Intermittent safety / warm-up margin</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{Number(safetyMargin).toFixed(0)}</td>
                            <td className="p-2.5 border-r border-border text-center">%</td>
                            <td className="p-2.5 text-muted-foreground">Cold-Start &amp; Pickup Factor</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Heat Loss Breakdown & Sizing Summary */}
                    <div className="border border-border rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                            <th className="p-2.5 border-r border-border text-center w-12">No.</th>
                            <th className="p-2.5 border-r border-border text-left">Heating Load Metric</th>
                            <th className="p-2.5 border-r border-border text-center w-36">Value</th>
                            <th className="p-2.5 border-r border-border text-center w-24">Unit</th>
                            <th className="p-2.5 text-left">Engineering Basis &amp; Formula</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">1</td>
                            <td className="p-2.5 border-r border-border font-medium">Exterior wall conduction loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwWall.toFixed(2) : Math.round(calcResults.qWall).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_wall = U_wall × A_net × ΔT</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                            <td className="p-2.5 border-r border-border font-medium">Roof assembly conduction loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwRoof.toFixed(2) : Math.round(calcResults.qRoof).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_roof = U_roof × A_roof × ΔT</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                            <td className="p-2.5 border-r border-border font-medium">Glazing conduction loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwGlaz.toFixed(2) : Math.round(calcResults.qGlaz).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_glaz = U_glaz × A_glaz × ΔT</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                            <td className="p-2.5 border-r border-border font-medium">Slab-on-grade perimeter loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwSlab.toFixed(2) : Math.round(calcResults.qSlab).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_slab = F_p × Perimeter × ΔT</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">5</td>
                            <td className="p-2.5 border-r border-border font-medium">Infiltration sensible heat loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwInfil.toFixed(2) : Math.round(calcResults.qInfil).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_infil = 1.08 × CFM × ΔT / 1.21 × L/s × ΔT</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">6</td>
                            <td className="p-2.5 border-r border-border font-medium">Mechanical fresh air ventilation loss</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.kwVent.toFixed(2) : Math.round(calcResults.qVent).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 text-muted-foreground">Q_vent = 1.08 × CFM × ΔT / 1.21 × L/s × ΔT</td>
                          </tr>
                          <tr className="bg-primary/5 hover:bg-primary/10 font-bold border-t border-b border-border">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">7</td>
                            <td className="p-2.5 border-r border-border font-bold text-foreground">Total Base Building Heat Load</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono text-primary text-sm">{isSI ? calcResults.kwBase.toFixed(2) : Math.round(calcResults.qBase).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center font-bold text-primary">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 font-bold text-foreground">Sum of envelope &amp; air losses</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">8</td>
                            <td className="p-2.5 border-r border-border font-medium">Specific Heat Load Density</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.loadDensityWPerSqm.toFixed(1) : calcResults.loadDensityBtuPerSqft.toFixed(1)}</td>
                            <td className="p-2.5 border-r border-border text-center">{isSI ? "W/m²" : "BTU/hr/ft²"}</td>
                            <td className="p-2.5 text-muted-foreground">Normalized Floor Area Metric</td>
                          </tr>
                          <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 font-bold border-b border-border">
                            <td className="p-2.5 border-r border-border text-center text-emerald-700 dark:text-emerald-300 font-mono">9</td>
                            <td className="p-2.5 border-r border-border font-bold text-emerald-700 dark:text-emerald-300">Sized Heating Plant Capacity</td>
                            <td className="p-2.5 border-r border-border text-center font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm">{isSI ? calcResults.kwTotal.toFixed(2) : Math.round(calcResults.qTotal).toLocaleString()}</td>
                            <td className="p-2.5 border-r border-border text-center font-bold text-emerald-600 dark:text-emerald-400">{isSI ? "kW" : "BTU/hr"}</td>
                            <td className="p-2.5 font-bold text-emerald-700 dark:text-emerald-300">Includes +{safetyMargin}% Safety / Warm-up Margin</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Mandatory Design Standards & Engineering Guidelines */}
                    <div className="space-y-2 mt-8">
                      <div className="border border-border rounded-xl overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                              <th className="p-2.5 border-r border-border text-center w-12">No.</th>
                              <th className="p-2.5 border-r border-border text-left w-64">Mandatory Design Standard</th>
                              <th className="p-2.5 text-left">Compliance &amp; Engineering Criteria</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">1</td>
                              <td className="p-2.5 border-r border-border font-bold">ASHRAE 90.1 Envelope Standard</td>
                              <td className="p-2.5 text-muted-foreground">Maximum allowable U-values for opaque walls, roof insulation, and fenestration SHGC/U-factors must satisfy ASHRAE 90.1 prescriptive tables.</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                              <td className="p-2.5 border-r border-border font-bold">Ventilation Heat Recovery</td>
                              <td className="p-2.5 text-muted-foreground">Where mechanical ventilation supply exceeds 5,000 CFM with &ge; 70% outdoor air, an energy recovery ventilation (ERV/HRV) system is recommended.</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                              <td className="p-2.5 border-r border-border font-bold">Infiltration Tightness</td>
                              <td className="p-2.5 text-muted-foreground">Air barrier continuity must be maintained per ASTM E779 air leakage testing (max 0.40 CFM/sq ft envelope area at 75 Pa).</td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                              <td className="p-2.5 border-r border-border font-bold">Safety &amp; Pick-up Factor</td>
                              <td className="p-2.5 text-muted-foreground">A 10% to 20% capacity factor accounts for cold-start thermal mass warm-up and intermittent night set-back recovery.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 4: Professional Review & Sign-Off Block (Exact Preliminary #FFE6CC Header) */}
                    {(() => {
                      const sigDetails = getSignatureBlockDetails(
                        project?.id || "default",
                        "/heating-load",
                        currentUserName,
                        calcReviewState
                      );
                      return (
                        <div className="pt-2">
                          <div className="border border-border rounded-xl overflow-hidden text-xs">
                            <table className="w-full border-collapse">
                              <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                                <tr className="divide-x divide-border">
                                  <th className="p-2.5 w-28 text-center"></th>
                                  <th className="p-2.5 text-center w-1/3">Originator</th>
                                  <th className="p-2.5 text-center w-1/3">Reviewer</th>
                                  <th className="p-2.5 text-center w-1/3">Approver</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                <tr className="divide-x divide-border">
                                  <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sigDetails.originatedName || currentUserName || "Design Engineer"}
                                  </td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sigDetails.reviewerName || "-"}
                                  </td>
                                  <td className="p-2.5 text-center font-medium">
                                    {sigDetails.approverName || "-"}
                                  </td>
                                </tr>
                                <tr className="divide-x divide-border">
                                  <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sigDetails.originatedDate || formatDateStr(new Date().toISOString())}
                                  </td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sigDetails.reviewerDate || "-"}
                                  </td>
                                  <td className="p-2.5 text-center font-mono">
                                    {sigDetails.approverDate || "-"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Collapsible Intelligence Drawer (Matching Ventilation UI standard) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen
              ? "w-[360px] mt-4 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col"
              : "w-0"
          }`}
        >
          {intelOpen && (
            <HeatingLoadIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              area={area}
              height={height}
              uWall={uWall}
              uRoof={uRoof}
              uGlaz={uGlaz}
              glazArea={glazArea}
              oat={oat}
              iat={iat}
              ach={ach}
              safetyMargin={safetyMargin}
              preset={preset}
              onApplyPreset={handleApplyPreset}
              unitSystem={unitSystem}
              isLocked={isEffectiveReadOnly || isApprovedLocked}
              onOpenFormula={() => setFormulaModalOpen(true)}
              onOpenComment={handleOpenComment}
            />
          )}
        </div>

      </div>

      {/* Enhanced Formula Breakdown Modal */}
      <HeatingLoadFormulaModal
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
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
          preset,
          customProfileName,
        }}
        calcResults={calcResults}
      />

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
          calculatorTitle="Heating Load"
          calculatorPath="/heating-load"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

// ==========================================
// HEATING LOAD INTELLIGENCE DRAWER HELPERS & COMPONENT
// ==========================================

function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted" | "purple";
  children: React.ReactNode;
}) {
  const color =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "warning" ? "text-amber-600 dark:text-amber-400" :
    tone === "primary" ? "text-primary" :
    tone === "purple" ? "text-purple-600 dark:text-purple-400" :
    "text-muted-foreground";

  return (
    <section className="px-3.5 py-3 border-b border-border/70 last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-foreground/90">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11.5px] py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium text-foreground">{v}</span>
    </div>
  );
}

interface HeatingLoadIntelligenceDrawerProps {
  onClose: () => void;
  calcResults: any;
  area: number | "";
  height: number | "";
  uWall: number | "";
  uRoof: number | "";
  uGlaz: number | "";
  glazArea: number | "";
  oat: number | "";
  iat: number | "";
  ach: number | "";
  safetyMargin: number | "";
  preset: HeatingPresetKey;
  onApplyPreset: (key: HeatingPresetKey) => void;
  unitSystem: "si" | "ip";
  isLocked: boolean;
  onOpenFormula: () => void;
  onOpenComment: (id: string, name: string) => void;
}

function HeatingLoadIntelligenceDrawer({
  onClose,
  calcResults,
  area,
  height,
  uWall,
  uRoof,
  uGlaz,
  glazArea,
  oat,
  iat,
  ach,
  safetyMargin,
  preset,
  onApplyPreset,
  unitSystem,
  isLocked,
  onOpenFormula,
  onOpenComment,
}: HeatingLoadIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  // Total conduction and air loss
  const totalAirKw = calcResults.kwInfil + calcResults.kwVent;
  const totalAirBtu = calcResults.qInfil + calcResults.qVent;

  // Hydronic flow sizing: Q = m * Cp * dT -> Flow (L/s) = kW / (4.184 * 20) for standard 20°C delta T
  const hydronicFlowLps = calcResults.kwTotal > 0 ? calcResults.kwTotal / (4.184 * 20) : 0;
  const hydronicFlowGpm = hydronicFlowLps * 15.8503;

  // Efficiency compliance evaluation
  const uWallValSI = (typeof uWall === "number" ? uWall : 0.065) * U_IP_TO_SI;
  const uGlazValSI = (typeof uGlaz === "number" ? uGlaz : 0.32) * U_IP_TO_SI;
  const isWallCompliant = uWallValSI <= 0.45; // ASHRAE 90.1 standard benchmark
  const isGlazCompliant = uGlazValSI <= 2.2;
  const complianceScore = (isWallCompliant ? 50 : 25) + (isGlazCompliant ? 50 : 25);

  // Equipment classification recommendations
  const boilerTypeRecommendation = 
    calcResults.kwTotal < 30
      ? "High-COP Inverter Air-to-Water Heat Pump or Wall-hung Condensing Unit"
      : calcResults.kwTotal < 100
      ? "Commercial Floor-standing Modulating Condensing Boiler (Cascaded N+1)"
      : "Dual High-Efficiency Low-NOx Hydronic Boilers with Modulating Burners";

  // Energy recovery potential (75% sensible HRV recovery on air infiltration/ventilation)
  const hrvSavedKw = totalAirKw * 0.75;
  const hrvSavedBtu = totalAirBtu * 0.75;

  return (
    <div className="h-full w-[360px] flex flex-col font-sans select-none animate-in fade-in duration-200">
      {/* Header */}
      <header className="h-11 px-3.5 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-bold tracking-tight text-foreground">Heating Load Intelligence</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-surface-2 text-muted-foreground hover:text-foreground transition cursor-pointer"
          title="Close Intelligence"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* SECTION 1: CODE COMPLIANCE & ENVELOPE AUDIT */}
        <IntelSection
          icon={CheckCircle2}
          tone={complianceScore >= 80 ? "success" : "warning"}
          title="ASHRAE 90.1 Envelope Audit"
        >
          <div className="text-[11.5px] text-muted-foreground leading-relaxed">
            {complianceScore >= 80
              ? "Building thermal envelope conforms to ASHRAE 90.1 standard prescriptive insulation requirements."
              : "Envelope U-values exceed optimal prescriptive targets. Consider upgrading thermal insulation or glazing."}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  complianceScore >= 80 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11px] font-bold text-foreground">{complianceScore}%</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-surface-2 dark:bg-zinc-800/60 p-2 rounded-lg border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-semibold">Total Heating Duty</span>
              <span className="font-mono font-bold text-xs text-primary">
                {isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/h`}
              </span>
            </div>
            <div className="bg-surface-2 dark:bg-zinc-800/60 p-2 rounded-lg border border-border/50">
              <span className="text-[10px] text-muted-foreground block font-semibold">Load Density</span>
              <span className="font-mono font-bold text-xs text-foreground">
                {isSI ? `${calcResults.loadDensityWPerSqm.toFixed(1)} W/m²` : `${calcResults.loadDensityBtuPerSqft.toFixed(1)} BTU/h/ft²`}
              </span>
            </div>
          </div>
        </IntelSection>

        {/* SECTION 2: HEAT LOSS DIAGNOSTICS & SPLIT */}
        <IntelSection icon={Gauge} tone="primary" title="Thermal Loss Diagnostics">
          <KV
            k="Opaque Conduction (Walls+Roof)"
            v={isSI ? `${(calcResults.kwWall + calcResults.kwRoof).toFixed(2)} kW (${(calcResults.pctWall + calcResults.pctRoof).toFixed(1)}%)` : `${Math.round(calcResults.qWall + calcResults.qRoof).toLocaleString()} BTU/h`}
          />
          <KV
            k="Glazing Conduction"
            v={isSI ? `${calcResults.kwGlaz.toFixed(2)} kW (${calcResults.pctGlaz.toFixed(1)}%)` : `${Math.round(calcResults.qGlaz).toLocaleString()} BTU/h`}
          />
          <KV
            k="Infiltration Air Loss"
            v={isSI ? `${calcResults.kwInfil.toFixed(2)} kW (${calcResults.pctInfil.toFixed(1)}%)` : `${Math.round(calcResults.qInfil).toLocaleString()} BTU/hr`}
          />
          <KV
            k="Design Delta T (ΔT)"
            v={isSI ? `${(((Number(iat) - Number(oat))) / 1.8).toFixed(1)} °C` : `${Math.round(Number(iat) - Number(oat))} °F`}
          />
          <KV k="Safety Margin Applied" v={`+${safetyMargin}%`} />

          {/* Visual Heat Loss Split Bar */}
          <div className="mt-2.5 pt-2 border-t border-border/40 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
              <span className="text-amber-600 dark:text-amber-400">Opaque: {(calcResults.pctWall + calcResults.pctRoof).toFixed(0)}%</span>
              <span className="text-blue-600 dark:text-blue-400">Glazing: {calcResults.pctGlaz.toFixed(0)}%</span>
              <span className="text-emerald-600 dark:text-emerald-400">Infil: {calcResults.pctInfil.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${calcResults.pctWall + calcResults.pctRoof}%` }} />
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${calcResults.pctGlaz}%` }} />
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${calcResults.pctInfil}%` }} />
            </div>
          </div>
        </IntelSection>

        {/* SECTION 3: HYDRONIC & EQUIPMENT SIZING */}
        <IntelSection icon={Layers} tone="purple" title="Hydronic & Plant Sizing">
          <KV
            k="Recommended Boiler Duty"
            v={isSI ? `${calcResults.kwTotal.toFixed(2)} kW` : `${Math.round(calcResults.qTotal).toLocaleString()} BTU/h`}
          />
          <KV
            k="Design Water Flow (ΔT 20°C)"
            v={isSI ? `${hydronicFlowLps.toFixed(2)} L/s` : `${hydronicFlowGpm.toFixed(1)} GPM`}
          />
          <KV k="Radiator Operating Temp" v="80°C / 60°C (176°F / 140°F)" />
          <KV k="Underfloor / Radiant Temp" v="45°C / 35°C (113°F / 95°F)" />

          <div className="mt-2 p-2.5 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl text-xs space-y-1">
            <span className="font-bold text-purple-700 dark:text-purple-300 block text-[11px]">Plant Recommendation:</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {boilerTypeRecommendation}
            </p>
          </div>
        </IntelSection>

        {/* SECTION 4: ENERGY RECOVERY (HRV/ERV) POTENTIAL */}
        <IntelSection icon={Zap} tone="warning" title="Energy Recovery & HRV Potential">
          <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-xl space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
            <strong className="block font-bold flex items-center gap-1.5">
              <Flame className="size-3.5 text-amber-600" /> Heat Recovery Ventilation (HRV)
            </strong>
            <p className="text-[11px] leading-relaxed">
              Implementing a high-efficiency plate or rotary heat recovery unit (75% sensible effectiveness) can recapture up to:
            </p>
            <div className="pt-1 flex justify-between font-mono font-bold text-xs">
              <span>Recaptured Power:</span>
              <span>~{isSI ? `${hrvSavedKw.toFixed(1)} kW` : `${Math.round(hrvSavedBtu).toLocaleString()} BTU/hr`}</span>
            </div>
          </div>
        </IntelSection>

        {/* SECTION 5: QUICK BUILDING PRESET SELECTORS */}
        <IntelSection icon={Sparkles} tone="primary" title="Quick Building Profiles">
          <div className="space-y-1.5 pt-1">
            {(Object.entries(HEATING_PRESETS) as [HeatingPresetKey, HeatingPresetConfig][])
              .filter(([k]) => k !== "custom")
              .map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onApplyPreset(k)}
                  className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                    preset === k
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                      : "bg-surface-2 dark:bg-zinc-800/40 border-border/60 hover:border-border text-foreground hover:bg-surface-3"
                  }`}
                >
                  <div>
                    <span className="block text-[11px] font-semibold">{p.label}</span>
                    <span className="block text-[9.5px] text-muted-foreground mt-0.5">{p.category}</span>
                  </div>
                  <ChevronRight className="size-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>
              ))}
          </div>
        </IntelSection>

        {/* SECTION 6: ACTIONS & FORMULA SHORTCUTS */}
        <IntelSection icon={Info} tone="primary" title="Calculation Actions">
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onOpenFormula}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-sm cursor-pointer"
            >
              <Eye className="size-3.5" />
              <span>View Step-by-Step Derivations</span>
            </button>
          </div>
        </IntelSection>

        {/* SECTION 7: ENGINEERING STANDARDS */}
        <IntelSection icon={ShieldCheck} tone="muted" title="Governing Standards">
          <div className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <p>• <strong>ASHRAE 90.1</strong>: Prescriptive envelope insulation &amp; fenestration standards.</p>
            <p>• <strong>ASHRAE 55</strong>: Thermal environmental criteria for human comfort.</p>
            <p>• <strong>ASHRAE 62.1</strong>: Minimum outdoor ventilation air rates.</p>
            <p>• <strong>CIBSE Guide A</strong>: Steady-state thermal transmittance analysis.</p>
          </div>
        </IntelSection>
      </div>
    </div>
  );
}
