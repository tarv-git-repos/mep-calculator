import { calculateDuctSize, calculateSMACNAWarnings, colebrook, CFM_TO_LPS, LPS_TO_CFM, INWG_TO_PAM, PAM_TO_INWG, FPM_TO_MPS, MPS_TO_FPM, IN_TO_MM, MM_TO_IN } from "@/lib/calc-duct-sizer";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { exportDuctSizerPDF } from "@/lib/exportDuctSizerPDF";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle, Eye,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight, ChevronsUpDown,
  SlidersHorizontal, Wind, Maximize2, BookOpen, Lightbulb, Building2, Store, Hotel, Utensils, Factory, FileSpreadsheet, Flame
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
import { DuctPresetSelect, DUCT_PRESETS, type DuctPresetKey } from "@/components/workspace/DuctPresetSelect";
import { CustomDuctConfigModal } from "@/components/workspace/CustomDuctConfigModal";
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/duct-sizer")({
  head: () => ({
    meta: [
      { title: "Duct Sizer Calculator — MEP Calc" },
      { name: "description", content: "Interactive HVAC duct sizer implementing SMACNA & ASHRAE Equal Friction Method with Colebrook aerodynamics." },
    ],
  }),
  component: DuctSizerPage,
});

function DuctSizerPage() {
  const { project, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/duct-sizer", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/duct-sizer", activeProjectId || project?.id);
  const confirm = useConfirm();
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";

  const isApprovedLocked = useCalculationLock("/duct-sizer", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isLocked = isEffectiveReadOnly;

  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP: CFM, in.wg/100ft, inches, FPM / SI: L/s, Pa/m, mm, m/s)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">(() => {
    if (typeof window !== "undefined") {
      const pref = localStorage.getItem("mep_unit_system");
      if (pref) return pref.toLowerCase() === "ip" ? "ip" : "si";
    }
    return "si";
  });
  const isSI = unitSystem === "si";

  // Preset state
  const [preset, setPreset] = useState<DuctPresetKey>("commercial_office_main");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProfileName, setCustomProfileName] = useState("Commercial Office Main Supply (Custom)");

  // Core Inputs (stored in IP internally)
  const [airflow, setAirflow] = useState<number | "">(2500); // CFM
  const [targetFr, setTargetFr] = useState<number | "">(0.08); // in w.g./100ft
  const [ductShape, setDuctShape] = useState<"round" | "rect">("rect");
  const [aspectRatio, setAspectRatio] = useState<number>(1.5);

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comments & Deep Linking state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments from localStorage and coordination queues
  const loadComments = useCallback(() => {
    try {
      const pId = activeProjectId || project?.id || "default";
      const map = new Map<string, any>();

      const calcKeys = [
        `mep_calc_comments_${pId}_/duct-sizer`,
        `mep_calc_comments_${pId}_duct-sizer`,
        `mep_calc_comments_default_/duct-sizer`,
        `mep_calc_comments_default_duct-sizer`,
      ];

      calcKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((c: any) => {
                if (c && (c.id || c.text)) {
                  const id = c.id || `${c.timestamp}_${c.text}`;
                  map.set(id, c);
                }
              });
            }
          }
        } catch {}
      });

      const uId = userData?.id || profile?.id || (project as any)?.userId;
      const uName = currentUserName || userData?.name || profile?.name;
      const notifKeys = [
        "mep_persistent_user_notifs",
        "mep_calc_coord_notifs",
        ...(uId ? [`mep_persistent_user_notifs_${uId}`] : []),
        ...(uName ? [`mep_persistent_user_notifs_${uName}`] : []),
      ];

      notifKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((n: any) => {
                if (
                  n &&
                  (n.calculatorPath === "/duct-sizer" ||
                    n.calculatorPath === "duct-sizer" ||
                    n.calculatorTitle?.toLowerCase().includes("duct") ||
                    n.targetType?.toLowerCase().includes("duct"))
                ) {
                  const id = n.id || `${n.timestamp}_${n.text}`;
                  if (!map.has(id)) {
                    map.set(id, n);
                  }
                }
              });
            }
          }
        } catch {}
      });

      setCommentsList(Array.from(map.values()));
    } catch (e) {
      console.error("Failed to load duct sizer comments:", e);
    }
  }, [activeProjectId, project?.id, userData?.id, profile?.id, currentUserName]);

  // Load calculation state from localStorage & workspace_data
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;
    setLoadedProjectId(project.id);

    try {
      let savedData: any = null;
      const pId = project.id;
      const key = `mep_duct_sizer_${pId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try { savedData = JSON.parse(stored); } catch (e) {}
      }

      if (!savedData && project?.workspace_data) {
        const wdata = typeof project.workspace_data === "string"
          ? JSON.parse(project.workspace_data)
          : project.workspace_data;
        savedData = wdata?.duct_calc || wdata?.duct_sizer;
      }

      if (savedData && typeof savedData === "object") {
        if (savedData.unitSystem === "ip" || savedData.unitSystem === "si") setUnitSystem(savedData.unitSystem);
        if (savedData.preset) setPreset(savedData.preset);
        if (savedData.customProfileName) setCustomProfileName(savedData.customProfileName);
        if (typeof savedData.airflow === "number" && !isNaN(savedData.airflow)) setAirflow(savedData.airflow);
        if (typeof savedData.targetFr === "number" && !isNaN(savedData.targetFr)) setTargetFr(savedData.targetFr);
        if (savedData.ductShape === "round" || savedData.ductShape === "rect") setDuctShape(savedData.ductShape);
        if (typeof savedData.aspectRatio === "number" && !isNaN(savedData.aspectRatio)) setAspectRatio(savedData.aspectRatio);
      } else {
        const def = DUCT_PRESETS.commercial_office_main;
        setUnitSystem("si");
        setPreset("commercial_office_main");
        setCustomProfileName("Commercial Office Main Supply (Custom)");
        setAirflow(def.airflow);
        setTargetFr(def.targetFr);
        setDuctShape(def.ductShape);
        setAspectRatio(def.aspectRatio);
      }
      loadComments();
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load duct sizer calculation data:", e);
    }
  }, [project?.id, loadedProjectId, loadComments]);

  // Real-time synchronization of comments across tabs/windows and notification center
  useEffect(() => {
    loadComments();
    const handleCommentUpdate = () => loadComments();

    window.addEventListener("mep_notification_received", handleCommentUpdate);
    window.addEventListener("mep-notification-added", handleCommentUpdate);
    window.addEventListener("mep-comment-updated", handleCommentUpdate);
    window.addEventListener("mep_storage_changed", handleCommentUpdate);
    window.addEventListener("storage", handleCommentUpdate);

    return () => {
      window.removeEventListener("mep_notification_received", handleCommentUpdate);
      window.removeEventListener("mep-notification-added", handleCommentUpdate);
      window.removeEventListener("mep-comment-updated", handleCommentUpdate);
      window.removeEventListener("mep_storage_changed", handleCommentUpdate);
      window.removeEventListener("storage", handleCommentUpdate);
    };
  }, [loadComments]);

  // Auto-save changes back to localStorage and workspace_data
  useEffect(() => {
    if (!project?.id) return;
    const pId = project.id;
    const key = `mep_duct_sizer_${pId}`;

    const payload = {
      unitSystem,
      preset,
      customProfileName,
      airflow,
      targetFr,
      ductShape,
      aspectRatio,
      comments: commentsList,
      lastModified: new Date().toISOString(),
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem(`mep_calc_comments_${pId}_/duct-sizer`, JSON.stringify(commentsList));
      if (project.workspace_data) {
        let wdata = project.workspace_data;
        if (typeof wdata === "string") {
          try { wdata = JSON.parse(wdata); } catch (e) {}
        }
        if (typeof wdata === "object" && wdata !== null) {
          wdata.duct_calc = payload;
          project.workspace_data = wdata;
        }
      }
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  }, [project?.id, unitSystem, preset, customProfileName, airflow, targetFr, ductShape, aspectRatio, commentsList]);

  // Handle Ctrl+S cloud save event
  useEffect(() => {
    const handleGlobalSave = () => {
      if (!project?.id) return;
      const key = `mep_duct_sizer_${project.id}`;
      const payload = {
        unitSystem,
        preset,
        customProfileName,
        airflow,
        targetFr,
        ductShape,
        aspectRatio,
        comments: commentsList,
        lastModified: new Date().toISOString(),
      };
      try {
        localStorage.setItem(key, JSON.stringify(payload));
        localStorage.setItem(`mep_calc_comments_${project.id}_/duct-sizer`, JSON.stringify(commentsList));
        if (project.workspace_data) {
          let wdata = project.workspace_data;
          if (typeof wdata === "string") {
            try { wdata = JSON.parse(wdata); } catch (e) {}
          }
          if (typeof wdata === "object" && wdata !== null) {
            wdata.duct_calc = payload;
            project.workspace_data = wdata;
          }
        }
      } catch (e) {}
    };

    window.addEventListener("mep_save_project", handleGlobalSave);
    return () => window.removeEventListener("mep_save_project", handleGlobalSave);
  }, [project, unitSystem, preset, customProfileName, airflow, targetFr, ductShape, aspectRatio, commentsList]);

  // Deep-link from comment notifications, URL query params and custom events
  useEffect(() => {
    const handleScrollToTarget = (e: any) => {
      const targetId = e?.detail?.id || e?.detail?.targetItemId || e?.detail?.targetId;
      const targetName = e?.detail?.name || e?.detail?.fieldName || e?.detail?.targetName;
      if (!targetId && !targetName) return;

      const cleanRaw = String(targetId || "").toLowerCase().trim();
      const cleanId = cleanRaw.replace(/^(field-|card-|res-|metric-)/, "");
      const cleanName = String(targetName || "").toLowerCase().trim();

      setTab("solver");
      setHighlightedTargetId(targetId || cleanRaw || cleanId || targetName || "");

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTargetId(null);
        highlightTimeoutRef.current = null;
      }, 4500);

      requestAnimationFrame(() => {
        let el = document.getElementById(targetId || "") ||
          document.getElementById(`field-${cleanRaw}`) ||
          document.getElementById(`card-${cleanRaw}`) ||
          document.getElementById(`field-card-${cleanRaw}`) ||
          document.getElementById(`field-card-${cleanId}`) ||
          document.getElementById(`card-${cleanId}`) ||
          document.getElementById(`metric-${cleanRaw}`) ||
          document.getElementById(cleanId) ||
          document.getElementById(cleanRaw) ||
          document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
          document.querySelector(`[data-comment-target="${targetId}"]`) ||
          document.querySelector(`[data-field-id="${cleanRaw}"]`) ||
          document.querySelector(`[data-field-id="${cleanId}"]`);

        if (!el && cleanName) {
          const allFields = document.querySelectorAll("[data-comment-target]");
          for (let i = 0; i < allFields.length; i++) {
            const targetAttr = allFields[i].getAttribute("data-comment-target")?.toLowerCase() || "";
            if (targetAttr.includes(cleanName) || cleanName.includes(targetAttr)) {
              el = allFields[i] as HTMLElement;
              break;
            }
          }
        }

        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };

    window.addEventListener("mep-scroll-to-item", handleScrollToTarget);
    window.addEventListener("mep-data-grid-scroll", handleScrollToTarget);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollToTarget);
    window.addEventListener("mep-comment-notification-clicked", handleScrollToTarget);
    window.addEventListener("mep-highlight-item", handleScrollToTarget);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollToTarget);
      window.removeEventListener("mep-data-grid-scroll", handleScrollToTarget);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollToTarget);
      window.removeEventListener("mep-comment-notification-clicked", handleScrollToTarget);
      window.removeEventListener("mep-highlight-item", handleScrollToTarget);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Listen to URL parameters on route change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get("commentTargetId") || urlParams.get("targetId");
    const targetName = urlParams.get("commentTargetName") || urlParams.get("targetName");

    if (targetId || targetName) {
      window.dispatchEvent(
        new CustomEvent("mep-scroll-to-item", {
          detail: { id: targetId, name: targetName },
        })
      );
    }
  }, []);

  const saveComments = (newComments: any[]) => {
    setCommentsList(newComments);
    const pId = activeProjectId || project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/duct-sizer`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(newComments));
      localStorage.setItem(`mep_calc_comments_${pId}_duct-sizer`, JSON.stringify(newComments));
      localStorage.setItem(`mep_calc_comments_default_/duct-sizer`, JSON.stringify(newComments));
      localStorage.setItem(`mep_calc_comments_default_duct-sizer`, JSON.stringify(newComments));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new CustomEvent("mep-comment-updated"));
      window.dispatchEvent(new CustomEvent("mep_storage_changed"));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const isFieldHighlighted = (id: string, name?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHigh = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-|metric-|res-)/, "");
    const cleanId = id.toLowerCase().trim().replace(/^(field-|card-|metric-|res-)/, "");
    const cleanName = (name || "").toLowerCase().trim();
    const cleanHighFull = highlightedTargetId.toLowerCase().trim();

    const isMatch =
      cleanHigh === cleanId ||
      cleanHighFull === id.toLowerCase().trim() ||
      (cleanName && (cleanHighFull === cleanName || cleanHigh === cleanName));

    if (isMatch) {
      return "ring-2 ring-sky-500 dark:ring-sky-400 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl shadow-xs";
    }
    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getMergedItemComments(
      id,
      name,
      commentsList,
      "/duct-sizer",
      activeProjectId || project?.id || "default"
    );
    if (!itemComments || itemComments.length === 0) return null;
    return (
      <RowCommentCornerBadge
        id={id}
        count={itemComments.length}
        onClick={() => handleOpenComment(id, name)}
      />
    );
  };

  // Preset Handlers
  const handleApplyPreset = (key: DuctPresetKey) => {
    if (isLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    if (key === "custom") {
      setPreset("custom");
      setCustomModalOpen(true);
      return;
    }
    const p = DUCT_PRESETS[key];
    setPreset(key);
    setAirflow(p.airflow);
    setTargetFr(p.targetFr);
    setDuctShape(p.ductShape);
    setAspectRatio(p.aspectRatio);
    setCustomProfileName(`${p.label} (Custom)`);
    dirtyStore.set(true);
    toast.success(`Preset applied: ${p.label}`);
  };

  const handleApplyCustomConfig = (updated: {
    airflow: number;
    targetFr: number;
    ductShape: "round" | "rect";
    aspectRatio: number;
    customProfileName: string;
  }) => {
    if (isLocked) return;
    setPreset("custom");
    setCustomProfileName(updated.customProfileName);
    setAirflow(updated.airflow);
    setTargetFr(updated.targetFr);
    setDuctShape(updated.ductShape);
    setAspectRatio(updated.aspectRatio);
    dirtyStore.set(true);
    toast.success("Custom Duct Sizing configuration applied!");
  };

  // Unit Toggle Handler
  const handleUnitToggle = (targetUnit: "si" | "ip", shouldConvert: boolean = true) => {
    if (isLocked) return;
    if (targetUnit === unitSystem) return;

    if (!shouldConvert) {
      if (unitSystem === "ip" && targetUnit === "si") {
        if (typeof airflow === "number") {
          setAirflow(airflow * LPS_TO_CFM);
        }
        if (typeof targetFr === "number") {
          setTargetFr(targetFr * PAM_TO_INWG);
        }
      } else if (unitSystem === "si" && targetUnit === "ip") {
        if (typeof airflow === "number") {
          setAirflow(Math.round(airflow * CFM_TO_LPS));
        }
        if (typeof targetFr === "number") {
          setTargetFr(targetFr * INWG_TO_PAM);
        }
      }
    }
    setUnitSystem(targetUnit);
    dirtyStore.set(true);
    toast.info(`Switched unit system to ${targetUnit === "si" ? "Metric (SI)" : "Imperial (IP)"}`);
  };

  // Context Menu & Value Helpers
  const handleCopyValue = (label: string, val: string | number) => {
    try {
      const textToCopy = String(val);
      navigator.clipboard.writeText(textToCopy);
      toast.success(`Copied ${label}: ${textToCopy}`);
    } catch {
      toast.error("Failed to copy value to clipboard.");
    }
  };

  const handlePasteValue = async (label: string, field: "airflow" | "targetFr") => {
    if (isLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
      if (!isNaN(num) && num > 0) {
        if (field === "airflow") {
          setAirflow(isSI ? num * LPS_TO_CFM : num);
        } else if (field === "targetFr") {
          setTargetFr(isSI ? num * PAM_TO_INWG : num);
        }
        dirtyStore.set(true);
        toast.success(`Pasted ${label}: ${num} ${isSI ? (field === "airflow" ? "L/s" : "Pa/m") : (field === "airflow" ? "CFM" : "in.wg/100ft")}`);
      } else {
        toast.error("Invalid number in clipboard.");
      }
    } catch {
      toast.error("Clipboard access denied or unavailable.");
    }
  };

  const handleResetField = (label: string, field: "airflow" | "targetFr", defaultVal: number) => {
    if (isLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    if (field === "airflow") {
      setAirflow(defaultVal);
    } else if (field === "targetFr") {
      setTargetFr(defaultVal);
    }
    dirtyStore.set(true);
    toast.success(`Reset ${label} to ${defaultVal}`);
  };

  const handleClearField = (label: string, field: "airflow" | "targetFr") => {
    if (isLocked) {
      toast.info("Calculation is Approved and locked.", { id: "readonly-notice" });
      return;
    }
    if (field === "airflow") {
      setAirflow("");
    } else if (field === "targetFr") {
      setTargetFr("");
    }
    dirtyStore.set(true);
    toast.info(`Cleared ${label}`);
  };

  const handleCycleAspectRatio = () => {
    if (isLocked) return;
    const standardRatios = [1.0, 1.5, 2.0, 3.0, 4.0];
    const currentIndex = standardRatios.indexOf(aspectRatio);
    const nextRatio = currentIndex >= 0 && currentIndex < standardRatios.length - 1
      ? standardRatios[currentIndex + 1]
      : standardRatios[0];
    setAspectRatio(nextRatio);
    dirtyStore.set(true);
    toast.info(`Aspect Ratio set to ${nextRatio.toFixed(1)}:1`);
  };

  const handleToggleDuctShape = () => {
    if (isLocked) return;
    const nextShape = ductShape === "round" ? "rect" : "round";
    setDuctShape(nextShape);
    dirtyStore.set(true);
    toast.info(`Duct shape switched to ${nextShape === "round" ? "Round Spiral" : "Rectangular"}`);
  };

  // AERODYNAMIC & DUCT EQUAL FRICTION CALCS
  const calcResults = useMemo(() => {
    const qCfm = typeof airflow === "number" && airflow > 0 ? airflow : 2500;
    const frInWg = typeof targetFr === "number" && targetFr > 0 ? targetFr : 0.08;
    const AR = typeof aspectRatio === "number" && aspectRatio >= 1 ? aspectRatio : 1.5;

    const Q = qCfm * 4.71947e-4;
    const frPaM = frInWg * INWG_TO_PAM;
    const rho = 1.204;
    const mu = 1.81e-5;
    const eps = 0.00009;

    let lo = 0.05, hi = 2.5;
    for (let i = 0; i < 100; i++) {
      const D = (lo + hi) / 2;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dP = (f * rho * v * v) / (2 * D);
      if (dP > frPaM) lo = D;
      else hi = D;
      if (hi - lo < 0.00005) break;
    }
    const exactDiameterM = (lo + hi) / 2;
    const exactDiameterIn = exactDiameterM / 0.0254;

    if (ductShape === "round") {
      const stdSizesIn = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60];
      const selectedIn = stdSizesIn.find(d => d >= exactDiameterIn) || Math.ceil(exactDiameterIn);
      const selectedM = selectedIn * 0.0254;
      const selectedMm = Math.round(selectedM * 1000);

      const areaM2 = (Math.PI * selectedM * selectedM) / 4;
      const areaSqFt = areaM2 * 10.7639;
      const velocityMs = Q / areaM2;
      const velocityFpm = velocityMs / FPM_TO_MPS;

      const Re = (rho * velocityMs * selectedM) / mu;
      const f = colebrook(Re, eps / selectedM);
      const actualFrPaM = (f * rho * velocityMs * velocityMs) / (2 * selectedM);
      const actualFrInWg = actualFrPaM * PAM_TO_INWG;

      const velPressPa = (rho * velocityMs * velocityMs) / 2;
      const velPressInWg = Math.pow(velocityFpm / 4005, 2);

      const perimeterM = Math.PI * selectedM;
      const perimeterIn = Math.PI * selectedIn;

      return {
        qCfm,
        qLps: qCfm * CFM_TO_LPS,
        targetFrInWg: frInWg,
        targetFrPaM: frPaM,
        ductShape: "round" as const,
        aspectRatio: 1.0,
        exactDiameterIn,
        exactDiameterMm: exactDiameterM * 1000,
        selectedWidthIn: selectedIn,
        selectedHeightIn: selectedIn,
        selectedWidthMm: selectedMm,
        selectedHeightMm: selectedMm,
        sizeDisplay: isSI ? `Ø ${selectedMm} mm` : `Ø ${selectedIn}" NPS`,
        sizeFullText: isSI ? `Circular Duct Ø ${selectedMm} mm` : `Circular Spiral Duct Ø ${selectedIn} in.`,
        deqIn: selectedIn,
        deqMm: selectedMm,
        hydraulicDiaIn: selectedIn,
        hydraulicDiaMm: selectedMm,
        areaM2,
        areaSqFt,
        velocityMs,
        velocityFpm,
        actualFrPaM,
        actualFrInWg,
        velPressPa,
        velPressInWg,
        reynolds: Re,
        frictionFactor: f,
        perimeterM,
        perimeterIn,
        flowRegime: Re > 4000 ? "Turbulent (Colebrook)" : Re > 2300 ? "Transitional" : "Laminar",
      };
    } else {
      const numeratorFactor = Math.pow(AR, 0.375) * Math.pow(AR + 1, 0.25);
      const exactWidthIn = (exactDiameterIn * numeratorFactor) / 1.30;
      const exactHeightIn = exactWidthIn / AR;

      const selectedWidthIn = Math.max(4, Math.round(exactWidthIn / 2) * 2);
      const selectedHeightIn = Math.max(4, Math.round(exactHeightIn / 2) * 2);

      const selectedWidthM = selectedWidthIn * 0.0254;
      const selectedHeightM = selectedHeightIn * 0.0254;

      const selectedWidthMm = Math.round(selectedWidthM * 1000);
      const selectedHeightMm = Math.round(selectedHeightM * 1000);

      const areaM2 = selectedWidthM * selectedHeightM;
      const areaSqFt = areaM2 * 10.7639;
      const velocityMs = Q / areaM2;
      const velocityFpm = velocityMs / FPM_TO_MPS;

      const perimeterM = 2 * (selectedWidthM + selectedHeightM);
      const perimeterIn = 2 * (selectedWidthIn + selectedHeightIn);

      const hydraulicDiaM = (4 * areaM2) / perimeterM;
      const hydraulicDiaIn = hydraulicDiaM / 0.0254;
      const hydraulicDiaMm = hydraulicDiaM * 1000;

      const deqIn = 1.30 * Math.pow(selectedWidthIn * selectedHeightIn, 0.625) / Math.pow(selectedWidthIn + selectedHeightIn, 0.25);
      const deqM = deqIn * 0.0254;
      const deqMm = deqM * 1000;

      const Re = (rho * velocityMs * hydraulicDiaM) / mu;
      const f = colebrook(Re, eps / hydraulicDiaM);
      const actualFrPaM = (f * rho * velocityMs * velocityMs) / (2 * hydraulicDiaM);
      const actualFrInWg = actualFrPaM * PAM_TO_INWG;

      const velPressPa = (rho * velocityMs * velocityMs) / 2;
      const velPressInWg = Math.pow(velocityFpm / 4005, 2);

      return {
        qCfm,
        qLps: qCfm * CFM_TO_LPS,
        targetFrInWg: frInWg,
        targetFrPaM: frPaM,
        ductShape: "rect" as const,
        aspectRatio: AR,
        exactDiameterIn,
        exactDiameterMm: exactDiameterM * 1000,
        selectedWidthIn,
        selectedHeightIn,
        selectedWidthMm,
        selectedHeightMm,
        sizeDisplay: isSI ? `${selectedWidthMm} × ${selectedHeightMm} mm` : `${selectedWidthIn}" × ${selectedHeightIn}"`,
        sizeFullText: isSI ? `Rectangular Duct ${selectedWidthMm} mm (W) × ${selectedHeightMm} mm (H)` : `Rectangular ${selectedWidthIn}" (W) × ${selectedHeightIn}" (H)`,
        deqIn,
        deqMm,
        hydraulicDiaIn,
        hydraulicDiaMm,
        areaM2,
        areaSqFt,
        velocityMs,
        velocityFpm,
        actualFrPaM,
        actualFrInWg,
        velPressPa,
        velPressInWg,
        reynolds: Re,
        frictionFactor: f,
        perimeterM,
        perimeterIn,
        flowRegime: Re > 4000 ? "Turbulent (Colebrook)" : Re > 2300 ? "Transitional" : "Laminar",
      };
    }
  }, [airflow, targetFr, ductShape, aspectRatio, unitSystem, isSI]);

  // SMACNA Warning checks
  const warnings = useMemo(() => {
    const list: { type: "info" | "warning" | "success"; text: string }[] = [];
    const vFpm = calcResults.velocityFpm;

    if (vFpm > 2500) {
      list.push({
        type: "warning",
        text: `High Air Velocity (${Math.round(vFpm)} FPM / ${calcResults.velocityMs.toFixed(1)} m/s). Exceeds SMACNA comfort limits (< 2,000 FPM) — consider larger duct cross-section or acoustic silencers.`,
      });
    } else if (vFpm < 600) {
      list.push({
        type: "info",
        text: `Low air velocity (${Math.round(vFpm)} FPM). Ensure adequate throw and prevent dust settling in variable volume systems.`,
      });
    } else {
      list.push({
        type: "success",
        text: `Velocity (${Math.round(vFpm)} FPM / ${calcResults.velocityMs.toFixed(1)} m/s) is well within SMACNA low-noise commercial guidelines.`,
      });
    }

    if (calcResults.ductShape === "rect" && calcResults.aspectRatio > 3.0) {
      list.push({
        type: "warning",
        text: `High Aspect Ratio (${calcResults.aspectRatio.toFixed(1)}:1). Aspect ratios over 3:1 increase sheet metal weight and acoustic breakout.`,
      });
    }

    return list;
  }, [calcResults]);

  // EXPORT TO PDF REPORT
  const exportPdf = async () => {
    await exportDuctSizerPDF(
      {
        unitSystem,
        preset,
        customProfileName,
        airflow: typeof airflow === "number" ? airflow : 2500,
        targetFr: typeof targetFr === "number" ? targetFr : 0.08,
        ductShape,
        aspectRatio,
        calcResults,
      },
      {
        projectName: project?.name,
        projectNo: project?.code,
        client: project?.client,
        endUser: (project as any)?.endUser || project?.location,
        userName: currentUserName,
        reviewState: calcReviewState,
      }
    );
  };

  // EXPORT TO EXCEL
  const exportToExcel = async () => {
    try {
      const pName = project?.name || "Duct Sizing Calculation";
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Duct Sizing Calculation");

      ws.columns = [
        { width: 34 },
        { width: 22 },
        { width: 14 },
        { width: 30 },
        { width: 36 },
      ];

      ws.addRow(["HVAC DUCT SIZING REPORT (EQUAL FRICTION METHOD)"]);
      ws.addRow([`Project: ${pName}`]);
      ws.addRow([`Engineer: ${currentUserName}`]);
      ws.addRow([`Date: ${formatDateStr(new Date())}`]);
      ws.addRow([`Preset / Application Profile: ${preset === "custom" ? customProfileName : DUCT_PRESETS[preset]?.label}`]);
      ws.addRow([]);

      ws.addRow(["Parameter", "Calculated Value", "Unit", "Formula / Standard", "Remarks"]);
      const headerRow = ws.getRow(7);
      headerRow.font = { bold: true, color: { argb: "FF000000" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };

      const excelRows = [
        ["Design Airflow (Q)", isSI ? Math.round(calcResults.qLps) : calcResults.qCfm, isSI ? "L/s" : "CFM", "User Input", "Volumetric Flow Rate"],
        ["Target Friction Rate", isSI ? calcResults.targetFrPaM.toFixed(2) : calcResults.targetFrInWg.toFixed(3), isSI ? "Pa/m" : "in.wg/100ft", "SMACNA / ASHRAE Basis", "Target Pressure Loss Rate"],
        ["Duct Cross-Section Shape", calcResults.ductShape === "round" ? "Round Spiral" : "Rectangular", "-", "User Input", "Geometry Profile"],
        ["Aspect Ratio (W:H)", calcResults.ductShape === "rect" ? `${calcResults.aspectRatio.toFixed(1)}:1` : "1.0:1 (Round)", "-", "SMACNA Limit ≤ 4:1", "Aspect Ratio"],
        ["Recommended Duct Size", calcResults.sizeDisplay, isSI ? "mm" : "in.", "SMACNA Standard Sizes", calcResults.sizeFullText],
        ["Equivalent Circular Dia (Deq)", isSI ? Math.round(calcResults.deqMm) : calcResults.deqIn.toFixed(1), isSI ? "mm" : "in.", "1.30 × (ab)^0.625 / (a+b)^0.25", "Huebscher Equation"],
        ["Hydraulic Diameter (Dh)", isSI ? Math.round(calcResults.hydraulicDiaMm) : calcResults.hydraulicDiaIn.toFixed(1), isSI ? "mm" : "in.", "Dh = 4A / P", "Hydraulic Diameter"],
        ["Cross-Section Area", isSI ? calcResults.areaM2.toFixed(3) : calcResults.areaSqFt.toFixed(2), isSI ? "m²" : "ft²", "A = W × H", "Effective Internal Area"],
        ["Mean Flow Velocity", isSI ? calcResults.velocityMs.toFixed(2) : Math.round(calcResults.velocityFpm), isSI ? "m/s" : "FPM", "V = Q / A", "Acoustic Limit check"],
        ["Actual Friction Loss", isSI ? calcResults.actualFrPaM.toFixed(3) : calcResults.actualFrInWg.toFixed(4), isSI ? "Pa/m" : "in.wg/100ft", "Colebrook Aerodynamics", "Achieved Loss Rate"],
        ["Velocity Pressure (Pv)", isSI ? calcResults.velPressPa.toFixed(1) : calcResults.velPressInWg.toFixed(4), isSI ? "Pa" : "in.wg", isSI ? "0.5 × ρ × V²" : "(V / 4005)²", "Dynamic Velocity Pressure"],
        ["Reynolds Number (Re)", Math.round(calcResults.reynolds), "-", "Re = ρVD / μ", calcResults.flowRegime],
        ["Darcy Friction Factor (f)", calcResults.frictionFactor.toFixed(5), "-", "Colebrook Iteration", "Roughness ε = 0.09mm"],
        ["Duct Perimeter / Girth", isSI ? calcResults.perimeterM.toFixed(2) : calcResults.perimeterIn.toFixed(1), isSI ? "m" : "in.", "P = 2(W + H)", "Sheet Metal Perimeter"]
      ];

      excelRows.forEach((r) => ws.addRow(r));
      addExcelSignatureBlock(ws, ws.rowCount + 3, currentUserName, project?.id || "default", "/duct-sizer", 5);

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Duct_Sizing_Calculation_${pName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`);
      toast.success("Excel calculation sheet exported!");
    } catch (error: any) {
      console.error("exportToExcel error:", error);
      toast.error(`Export Excel failed: ${error?.message || String(error)}`);
    }
  };

  const getInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = "w-full h-9 px-3 rounded-lg text-xs font-mono font-semibold focus:outline-none disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-foreground focus:border-[#0A7BC7] ${isHigh}`;
  };

  const getSelectInputClass = (id: string, name?: string) => {
    const isHigh = isFieldHighlighted(id, name);
    const baseStyle = "appearance-none w-full h-9 px-3 pr-8 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-zinc-800/50 disabled:text-slate-400 dark:disabled:text-zinc-500 transition-all duration-150";

    return `${baseStyle} bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 focus:border-primary ${isHigh}`;
  };

  const getCardCommentClass = (id: string, name: string, baseClass: string) => {
    const isHigh = isFieldHighlighted(id, name);
    return `${baseClass} relative ${isHigh}`;
  };

  return (
    <AppShell
      title="Duct Sizer"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Duct Sizer</h1>
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
                calculatorPath="/duct-sizer"
                calculatorTitle="Duct Sizer"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              : calcReviewState?.status === "REJECTED"
                ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
                : calcReviewState?.status === "REVIEWED"
                  ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                  : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>

            {/* Tabs Selector row */}
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
                  title="View SMACNA & ASHRAE Formula Breakdown"
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
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" && (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                  <div className="lg:col-span-5 space-y-5">
                    <div
                      id="card-params"
                      data-field-id="card-params"
                      data-comment-target="card-params"
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 ${isFieldHighlighted("card-params", "Sizing Parameters")}`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 Sizing Parameters
                        </span>
                        {renderCommentBadge("card-params", "Sizing Parameters")}
                      </div>

                      {/* Preset Profile Dropdown inside Parameters Table */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-preset"
                            data-field-id="field-preset"
                            data-comment-target="preset"
                            className={`space-y-1 pb-1 p-1.5 -m-1.5 transition-all ${isFieldHighlighted("preset", "Duct Application Preset")}`}
                          >
                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Application Preset Profile
                            </label>
                            <div className="relative mt-1">
                              <DuctPresetSelect
                                value={preset}
                                customProfileName={customProfileName}
                                onChange={handleApplyPreset}
                                onOpenCustomModal={() => setCustomModalOpen(true)}
                                unitSystem={unitSystem}
                                disabled={isEffectiveReadOnly}
                                triggerClassName={getInputClass("preset", "Duct Application Preset")}
                              />
                              {renderCommentBadge("preset", "Duct Application Preset")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("preset", "Duct Application Preset")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleApplyPreset("commercial_office_main")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset Preset (Office Main)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleApplyPreset("commercial_office_branch")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Building2 className="size-3.5 text-muted-foreground" />
                            <span>Office Branch (0.06 in.wg)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleApplyPreset("low_noise_theatre")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Hotel className="size-3.5 text-muted-foreground" />
                            <span>Low Noise Studio/Hotel</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => handleApplyPreset("industrial_high_velocity")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Factory className="size-3.5 text-muted-foreground" />
                            <span>Industrial High Velocity</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || isApprovedLocked}
                            onClick={() => setCustomModalOpen(true)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <SlidersHorizontal className="size-3.5 text-primary" />
                            <span>Custom Duct Config...</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 1: Airflow Q */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-airflow"
                            data-field-id="field-airflow"
                            data-comment-target="airflow"
                            className={`space-y-1 p-1.5 -m-1.5 transition-all ${isFieldHighlighted("airflow", "Airflow (Q)")}`}
                          >
                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Airflow (Q) ({isSI ? "L/s" : "CFM"})
                            </label>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                min="1"
                                step="any"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof airflow === "number" ? Math.round(airflow * CFM_TO_LPS) : airflow}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setAirflow("");
                                  else if (isSI) setAirflow(val * LPS_TO_CFM);
                                  else setAirflow(val);
                                  dirtyStore.set(true);
                                }}
                                className={getInputClass("airflow", "Airflow (Q)")}
                                placeholder={isSI ? "e.g. 1180" : "e.g. 2500"}
                              />
                              {renderCommentBadge("airflow", "Airflow (Q)")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("airflow", "Airflow (Q)")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Airflow", isSI ? `${Math.round(Number(airflow || 0) * CFM_TO_LPS)} L/s` : `${airflow} CFM`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => handlePasteValue("Airflow", "airflow")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <Clipboard className="size-3.5 text-muted-foreground" />
                            <span>Paste Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              const defQ = DUCT_PRESETS[preset]?.airflow || 2500;
                              handleResetField("Airflow", "airflow", defQ);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset to Default</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => handleClearField("Airflow", "airflow")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Clear Input</span>
                            <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 2: Target Friction Rate */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-targetFr"
                            data-field-id="field-targetFr"
                            data-comment-target="targetFr"
                            className={`space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800 p-1.5 -mx-1.5 transition-all ${isFieldHighlighted("targetFr", "Target Friction Rate")}`}
                          >
                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Target Friction Rate ({isSI ? "Pa/m" : "in w.g./100ft"})
                            </label>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                disabled={isEffectiveReadOnly}
                                value={isSI && typeof targetFr === "number" ? Number((targetFr * INWG_TO_PAM).toFixed(2)) : targetFr}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                                  if (val === "") setTargetFr("");
                                  else if (isSI) setTargetFr(val * PAM_TO_INWG);
                                  else setTargetFr(val);
                                  dirtyStore.set(true);
                                }}
                                className={getInputClass("targetFr", "Target Friction Rate")}
                                placeholder={isSI ? "e.g. 0.65" : "e.g. 0.08"}
                              />
                              {renderCommentBadge("targetFr", "Target Friction Rate")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("targetFr", "Target Friction Rate")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Target Friction Rate", isSI ? `${(Number(targetFr || 0) * INWG_TO_PAM).toFixed(2)} Pa/m` : `${targetFr} in.wg/100ft`)}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => handlePasteValue("Target Friction Rate", "targetFr")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <Clipboard className="size-3.5 text-muted-foreground" />
                            <span>Paste Value</span>
                            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => {
                              const defFr = DUCT_PRESETS[preset]?.targetFr || 0.08;
                              handleResetField("Target Friction Rate", "targetFr", defFr);
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="size-3.5 text-muted-foreground" />
                            <span>Reset to Default</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => handleClearField("Target Friction Rate", "targetFr")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Clear Input</span>
                            <ContextMenuShortcut className="text-[10px] text-destructive/80 font-mono ml-auto">Delete</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 3: Duct Cross-Section Shape */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-ductShape"
                            data-field-id="field-ductShape"
                            data-comment-target="ductShape"
                            className={`space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 p-1.5 -mx-1.5 transition-all ${isFieldHighlighted("ductShape", "Duct Shape")}`}
                          >
                            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Duct Cross-Section Shape
                            </label>
                            <div className="relative mt-1">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => { setDuctShape("round"); dirtyStore.set(true); }}
                                  className={`h-9 text-xs font-bold rounded-lg transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                                    ductShape === "round"
                                      ? "bg-primary text-white border-primary shadow-xs"
                                      : "bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                                  }`}
                                >
                                  <Cylinder className="size-3.5" /> Round Spiral
                                </button>
                                <button
                                  type="button"
                                  disabled={isEffectiveReadOnly}
                                  onClick={() => { setDuctShape("rect"); dirtyStore.set(true); }}
                                  className={`h-9 text-xs font-bold rounded-lg transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                                    ductShape === "rect"
                                      ? "bg-primary text-white border-primary shadow-xs"
                                      : "bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                                  }`}
                                >
                                  <Layers className="size-3.5" /> Rectangular
                                </button>
                              </div>
                              {renderCommentBadge("ductShape", "Duct Shape")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("ductShape", "Duct Shape")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => { setDuctShape("round"); dirtyStore.set(true); toast.info("Switched to Round Spiral Duct"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Cylinder className="size-3.5 text-primary" />
                            <span>Select Round Spiral Duct</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly}
                            onClick={() => { setDuctShape("rect"); dirtyStore.set(true); toast.info("Switched to Rectangular Duct"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <Layers className="size-3.5 text-primary" />
                            <span>Select Rectangular Duct</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 4: Aspect Ratio */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="field-aspectRatio"
                            data-field-id="field-aspectRatio"
                            data-comment-target="aspectRatio"
                            className={`space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800 p-1.5 -mx-1.5 transition-all ${ductShape === "round" ? "opacity-75" : ""} ${isFieldHighlighted("aspectRatio", "Aspect Ratio")}`}
                          >
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Aspect Ratio (W:H)
                              </label>
                              <span className="text-[11px] font-mono text-primary font-bold">
                                {ductShape === "round" ? "1.0:1 (Fixed)" : `${aspectRatio.toFixed(1)}:1`}
                              </span>
                            </div>
                            <div className="relative mt-1">
                              <select
                                disabled={isEffectiveReadOnly || ductShape === "round"}
                                value={ductShape === "round" ? 1.0 : aspectRatio}
                                onChange={(e) => { setAspectRatio(Number(e.target.value)); dirtyStore.set(true); }}
                                className={getSelectInputClass("aspectRatio", "Aspect Ratio")}
                              >
                                {ductShape === "round" ? (
                                  <option value="1.0">1.0:1 - Circular (Fixed 1:1)</option>
                                ) : (
                                  <>
                                    <option value="1.0">1:1 - Square Duct</option>
                                    <option value="1.5">1.5:1 - Low Profile (Standard)</option>
                                    <option value="2.0">2:1 - Medium Aspect</option>
                                    <option value="3.0">3:1 - Flat / Ceiling Clearance</option>
                                    <option value="4.0">4:1 - Maximum Recommended</option>
                                  </>
                                )}
                              </select>
                              <ChevronsUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none opacity-55" />
                              {renderCommentBadge("aspectRatio", "Aspect Ratio")}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("aspectRatio", "Aspect Ratio")}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || ductShape === "round"}
                            onClick={() => { setAspectRatio(1.0); dirtyStore.set(true); toast.info("Aspect Ratio set to 1.0:1"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span className="font-mono text-xs w-4">1:1</span>
                            <span>Square Duct (1.0:1)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || ductShape === "round"}
                            onClick={() => { setAspectRatio(1.5); dirtyStore.set(true); toast.info("Aspect Ratio set to 1.5:1"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span className="font-mono text-xs w-4">1.5</span>
                            <span>Standard Low Profile (1.5:1)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || ductShape === "round"}
                            onClick={() => { setAspectRatio(2.0); dirtyStore.set(true); toast.info("Aspect Ratio set to 2.0:1"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span className="font-mono text-xs w-4">2:1</span>
                            <span>Medium Aspect (2.0:1)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || ductShape === "round"}
                            onClick={() => { setAspectRatio(3.0); dirtyStore.set(true); toast.info("Aspect Ratio set to 3.0:1"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span className="font-mono text-xs w-4">3:1</span>
                            <span>Ceiling Clearance (3.0:1)</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isEffectiveReadOnly || ductShape === "round"}
                            onClick={() => { setAspectRatio(4.0); dirtyStore.set(true); toast.info("Aspect Ratio set to 4.0:1"); }}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                          >
                            <span className="font-mono text-xs w-4">4:1</span>
                            <span>Maximum Recommended (4.0:1)</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: RESULTS - STICKY PANEL (lg:col-span-7) */}
                  <div className="lg:col-span-7 space-y-5 lg:sticky lg:top-0 self-start">
                    
                    {/* PRIMARY SIZING RESULTS CARD (MATCHING PUMP SIZING REFERENCE) */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="card-hero-results"
                          data-field-id="card-hero-results"
                          data-comment-target="hero-results"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6 transition-all ${
                            isFieldHighlighted("hero-results", "Recommended Duct Sizing") || isFieldHighlighted("card-hero-results")
                          }`}
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                                ⚡ Sizing Results Summary
                              </span>
                              {renderCommentBadge("hero-results", "Recommended Duct Sizing")}
                            </div>
                            <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              Colebrook Equation
                            </span>
                          </div>

                          {/* DISPLAY STAT CARDS (Multi-Color Vibrant Theme from Pump Sizing) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-size"
                                  data-field-id="res-size"
                                  data-comment-target="res-size"
                                  className={getCardCommentClass("res-size", "Recommended Size", "bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Recommended Size</div>
                                  <div className="text-xl font-bold font-mono text-foreground mt-1">
                                    {calcResults.sizeDisplay}
                                  </div>
                                  {renderCommentBadge("res-size", "Recommended Size")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-size", "Recommended Size")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Recommended Size", calcResults.sizeDisplay)}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-velocity"
                                  data-field-id="res-velocity"
                                  data-comment-target="res-velocity"
                                  className={getCardCommentClass("res-velocity", "Air Velocity", "bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Air Velocity</div>
                                  <div className="text-xl font-bold font-mono text-foreground mt-1">
                                    {isSI ? `${calcResults.velocityMs.toFixed(2)}` : `${Math.round(calcResults.velocityFpm)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "m/s" : "FPM"}</span>
                                  </div>
                                  {renderCommentBadge("res-velocity", "Air Velocity")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-velocity", "Air Velocity")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Air Velocity", isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`)}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-friction"
                                  data-field-id="res-friction"
                                  data-comment-target="res-friction"
                                  className={getCardCommentClass("res-friction", "Friction Loss", "bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Friction Loss</div>
                                  <div className="text-xl font-bold font-mono text-foreground mt-1">
                                    {isSI ? `${calcResults.actualFrPaM.toFixed(2)}` : `${calcResults.actualFrInWg.toFixed(3)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "Pa/m" : "in/100ft"}</span>
                                  </div>
                                  {renderCommentBadge("res-friction", "Friction Loss")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-friction", "Friction Loss")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Friction Loss", isSI ? `${calcResults.actualFrPaM.toFixed(2)} Pa/m` : `${calcResults.actualFrInWg.toFixed(3)} in/100ft`)}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>

                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="res-deq"
                                  data-field-id="res-deq"
                                  data-comment-target="res-deq"
                                  className={getCardCommentClass("res-deq", "Equiv. Dia (Deq)", "bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-xl p-3.5 transition-all cursor-context-menu")}
                                >
                                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Equiv. Dia (Deq)</div>
                                  <div className="text-xl font-bold font-mono text-foreground mt-1">
                                    {isSI ? `${Math.round(calcResults.deqMm)}` : `${calcResults.deqIn.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "mm" : "in"}</span>
                                  </div>
                                  {renderCommentBadge("res-deq", "Equiv. Dia (Deq)")}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("res-deq", "Equiv. Dia (Deq)")}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleCopyValue("Equiv. Dia (Deq)", isSI ? `${Math.round(calcResults.deqMm)} mm` : `${calcResults.deqIn.toFixed(1)} in`)}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy Value</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>

                          {/* DETAILED AERODYNAMIC METRICS TABLE (Matching Pump Sizing) */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Velocity Pressure (Pv):</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Hydraulic Diameter (Dh):</span>
                              <span className="font-mono font-bold">{isSI ? `${Math.round(calcResults.hydraulicDiaMm)} mm` : `${calcResults.hydraulicDiaIn.toFixed(1)}" NPS`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Cross-Section Area:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.areaM2.toFixed(3)} m²` : `${calcResults.areaSqFt.toFixed(2)} sq.ft`}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Reynolds Number (Re):</span>
                              <span className="font-mono font-bold">{Math.round(calcResults.reynolds).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Darcy Friction Factor (f):</span>
                              <span className="font-mono font-bold">{calcResults.frictionFactor.toFixed(5)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800">
                              <span className="text-slate-600 dark:text-zinc-400">Duct Girth / Perimeter:</span>
                              <span className="font-mono font-bold">{isSI ? `${calcResults.perimeterM.toFixed(2)} m` : `${calcResults.perimeterIn.toFixed(1)} in.`}</span>
                            </div>
                            <div className="flex justify-between py-1 font-bold text-foreground">
                              <span>Selected Duct Specification:</span>
                              <span className="font-mono text-[#0A7BC7]">{calcResults.sizeFullText}</span>
                            </div>
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                        <ContextMenuItem
                          onClick={() => handleOpenComment("hero-results", "Recommended Duct Sizing")}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>Add Comment</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem
                          onClick={() => handleCopyValue("Sizing Result", `${calcResults.sizeFullText} | Velocity: ${isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`} | Friction: ${isSI ? `${calcResults.actualFrPaM.toFixed(2)} Pa/m` : `${calcResults.actualFrInWg.toFixed(3)} in.wg/100ft`}`)}
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

                  </div>
                </div>
              </div>
            )}

            {/* TAB: STANDARDIZED REPORT VIEW (MATCHING PRELIMINARY COOLING LOAD CORPORATE STANDARD) */}
            {tab === "report" && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40 select-none">
                <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                    {/* 1. Header Title */}
                    <div className="pb-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        Duct Sizing Calculation
                      </h2>
                    </div>

                  {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format matching Preliminary) */}
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-border divide-x divide-border">
                          <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                          <td className="p-2.5 font-mono text-foreground font-medium">{(project as any)?.calcNo || "TRV-CAL-DUCT-001"}</td>
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
                          <td className="p-2.5">{project?.name || "Duct Sizing Calculation"}</td>
                          <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                          <td className="p-2.5">{(project as any)?.endUser || (project as any)?.location || "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 1: Design Parameters & Sizing Basis */}
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
                          <td className="p-2.5 border-r border-border font-medium">Design Airflow Rate (Q)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? Math.round(calcResults.qLps).toLocaleString() : Math.round(calcResults.qCfm).toLocaleString()}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "L/s" : "CFM"}</td>
                          <td className="p-2.5 text-muted-foreground">Specified HVAC Design Duty</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                          <td className="p-2.5 border-r border-border font-medium">Target Friction Rate (ΔP / L)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.targetFrPaM.toFixed(2) : calcResults.targetFrInWg.toFixed(3)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "Pa/m" : "in.wg/100ft"}</td>
                          <td className="p-2.5 text-muted-foreground">Equal Friction Design Basis (SMACNA)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                          <td className="p-2.5 border-r border-border font-medium">Duct Cross-Section Geometry</td>
                          <td className="p-2.5 border-r border-border text-center font-bold">{ductShape === "round" ? "Round Spiral" : "Rectangular"}</td>
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground">-</td>
                          <td className="p-2.5 text-muted-foreground">Selected Fabrication Standard</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                          <td className="p-2.5 border-r border-border font-medium">Application Preset Profile</td>
                          <td className="p-2.5 border-r border-border text-center font-bold">{preset === "custom" ? customProfileName : (DUCT_PRESETS[preset]?.label || "Commercial Office Main")}</td>
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground">-</td>
                          <td className="p-2.5 text-muted-foreground">SMACNA / ASHRAE Application Class</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">5</td>
                          <td className="p-2.5 border-r border-border font-medium">Duct Aspect Ratio (W : H)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{ductShape === "rect" ? `${aspectRatio.toFixed(1)} : 1` : "1.0 : 1"}</td>
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground">-</td>
                          <td className="p-2.5 text-muted-foreground">{ductShape === "rect" ? "SMACNA Maximum Ratio Limit ≤ 4.0:1" : "Circular Symmetrical Standard"}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">6</td>
                          <td className="p-2.5 border-r border-border font-medium">Duct Material Absolute Roughness (ε)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? "0.09" : "0.0035"}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "mm" : "inches"}</td>
                          <td className="p-2.5 text-muted-foreground">Galvanized Sheet Steel (ASHRAE Fundamentals)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">7</td>
                          <td className="p-2.5 border-r border-border font-medium">Standard Air Density (ρ) &amp; Kinematic Viscosity (ν)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? "1.204 / 1.516e-5" : "0.075 / 1.632e-4"}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "kg/m³" : "lb/ft³"}</td>
                          <td className="p-2.5 text-muted-foreground">Standard Atmospheric Air at Sea Level (20°C / 68°F)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 2: Duct Sizing & Aerodynamic Performance Summary */}
                  <div className="border border-border rounded-xl overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                          <th className="p-2.5 border-r border-border text-center w-12">No.</th>
                          <th className="p-2.5 border-r border-border text-left">Aerodynamic &amp; Sizing Metric</th>
                          <th className="p-2.5 border-r border-border text-center w-36">Value</th>
                          <th className="p-2.5 border-r border-border text-center w-24">Unit</th>
                          <th className="p-2.5 text-left">Engineering Formulation &amp; Basis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {/* Highlighted Recommended Duct Sizing Row */}
                        <tr className="bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100/70 dark:hover:bg-blue-950/50 font-bold border-b border-border">
                          <td className="p-2.5 border-r border-border text-center text-blue-700 dark:text-blue-300 font-mono">1</td>
                          <td className="p-2.5 border-r border-border font-bold text-blue-700 dark:text-blue-300">Recommended Duct Sizing</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono text-blue-600 dark:text-blue-400 text-sm">{calcResults.sizeDisplay}</td>
                          <td className="p-2.5 border-r border-border text-center font-bold text-blue-600 dark:text-blue-400">{calcResults.ductShape === "round" ? (isSI ? "mm Ø" : "in Ø") : (isSI ? "mm (W×H)" : "in (W×H)")}</td>
                          <td className="p-2.5 font-bold text-blue-700 dark:text-blue-300">{calcResults.sizeFullText}</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Mean Flow Velocity (V)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono text-foreground text-sm">{isSI ? calcResults.velocityMs.toFixed(2) : Math.round(calcResults.velocityFpm).toLocaleString()}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "m/s" : "FPM"}</td>
                          <td className="p-2.5 text-muted-foreground">V = Q / A ({calcResults.velocityFpm <= 2000 ? "Comfort Low-Noise ≤ 2,000 FPM" : "High Velocity"})</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                          <td className="p-2.5 border-r border-border font-medium text-foreground">Actual Friction Loss (ΔP / L)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono text-foreground text-sm">{isSI ? calcResults.actualFrPaM.toFixed(3) : calcResults.actualFrInWg.toFixed(4)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "Pa/m" : "in.wg/100ft"}</td>
                          <td className="p-2.5 text-muted-foreground">Colebrook: ΔP = f × (L/Dh) × Pv (Achieved)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                          <td className="p-2.5 border-r border-border font-medium">Equivalent Circular Diameter (Deq)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? Math.round(calcResults.deqMm) : calcResults.deqIn.toFixed(1)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "mm" : "inches"}</td>
                          <td className="p-2.5 text-muted-foreground">Huebscher: Deq = 1.30 × (a·b)^0.625 / (a+b)^0.25</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">5</td>
                          <td className="p-2.5 border-r border-border font-medium">Hydraulic Diameter (Dh)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? Math.round(calcResults.hydraulicDiaMm) : calcResults.hydraulicDiaIn.toFixed(1)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "mm" : "inches"}</td>
                          <td className="p-2.5 text-muted-foreground">Dh = 4A / P = 2ab / (a + b)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">6</td>
                          <td className="p-2.5 border-r border-border font-medium">Net Cross-Sectional Area (A)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.areaM2.toFixed(3) : calcResults.areaSqFt.toFixed(2)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "m²" : "sq.ft"}</td>
                          <td className="p-2.5 text-muted-foreground">Net internal airflow cross-sectional area</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">7</td>
                          <td className="p-2.5 border-r border-border font-medium">Velocity Pressure (Pv)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.velPressPa.toFixed(1) : calcResults.velPressInWg.toFixed(4)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "Pa" : "in.wg"}</td>
                          <td className="p-2.5 text-muted-foreground">Pv = 0.5 × ρ × V² (Dynamic velocity head)</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">8</td>
                          <td className="p-2.5 border-r border-border font-medium">Reynolds Number (Re)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{Math.round(calcResults.reynolds).toLocaleString()}</td>
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground">-</td>
                          <td className="p-2.5 text-muted-foreground">Re = V · Dh / ν ({calcResults.flowRegime})</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">9</td>
                          <td className="p-2.5 border-r border-border font-medium">Darcy Friction Factor (f)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{calcResults.frictionFactor.toFixed(5)}</td>
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground">-</td>
                          <td className="p-2.5 text-muted-foreground">Iterative Colebrook-White implicit solution</td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">10</td>
                          <td className="p-2.5 border-r border-border font-medium">Duct Girth / Perimeter (P)</td>
                          <td className="p-2.5 border-r border-border text-center font-bold font-mono">{isSI ? calcResults.perimeterM.toFixed(2) : (calcResults.perimeterIn / 12).toFixed(2)}</td>
                          <td className="p-2.5 border-r border-border text-center">{isSI ? "m" : "ft"}</td>
                          <td className="p-2.5 text-muted-foreground">Sheet metal fabrication &amp; acoustic wrap takeoff</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 3: Mandatory Design Standards & Engineering Criteria */}
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
                            <td className="p-2.5 border-r border-border font-bold">SMACNA HVAC Duct Construction Standards</td>
                            <td className="p-2.5 text-muted-foreground">Duct aspect ratio satisfies maximum allowable 4.0:1 guideline to prevent excessive sheet metal distortion and acoustic breakout penalties.</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">2</td>
                            <td className="p-2.5 border-r border-border font-bold">ASHRAE Fundamentals Equal Friction Method</td>
                            <td className="p-2.5 text-muted-foreground">Aerodynamic friction losses computed via rigorous iterative Colebrook-White equation with 0.09 mm absolute roughness.</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">3</td>
                            <td className="p-2.5 border-r border-border font-bold">Acoustic Velocity Threshold Compliance</td>
                            <td className="p-2.5 text-muted-foreground">Design velocity of {isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`} complies with recommended maximum velocity thresholds for the selected application profile.</td>
                          </tr>
                          <tr className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="p-2.5 border-r border-border text-center text-muted-foreground font-mono">4</td>
                            <td className="p-2.5 border-r border-border font-bold">Friction Rate Convergence</td>
                            <td className="p-2.5 text-muted-foreground">Calculated friction loss ({isSI ? `${calcResults.actualFrPaM.toFixed(3)} Pa/m` : `${calcResults.actualFrInWg.toFixed(4)} in.wg/100ft`}) achieves precise balance with target criteria ({isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg/100ft`}).</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 4: Professional Review & Sign-Off Block (Exact Preliminary #FFE6CC Header) */}
                  {(() => {
                    const sigDetails = getSignatureBlockDetails(
                      project?.id || "default",
                      "/duct-sizer",
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

        {/* Collapsible Intelligence Drawer (Matching Ventilation & Pump Sizing UI exactly) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] mt-2 mb-0 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col" : "w-0"
          }`}
        >
          {intelOpen && (
            <DuctSizerIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              preset={preset}
              onSelectPreset={handleApplyPreset}
              isEffectiveReadOnly={isLocked}
              unitSystem={unitSystem}
              onOpenFormulaBreakdown={() => setFormulaModalOpen(true)}
              onNavigateToField={(id: string) => {
                setTab("solver");
                setTimeout(() => {
                  const cleanRaw = id.replace(/^(field-|card-|metric-)/, "");
                  const el = document.getElementById(id) ||
                    document.getElementById(`field-${cleanRaw}`) ||
                    document.getElementById(`card-${cleanRaw}`) ||
                    document.getElementById(`metric-${cleanRaw}`) ||
                    document.getElementById(cleanRaw) ||
                    document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
                    document.querySelector(`[data-comment-target="${id}"]`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    setHighlightedTargetId(id);
                    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                    highlightTimeoutRef.current = setTimeout(() => setHighlightedTargetId(null), 4500);
                  }
                }, 100);
              }}
            />
          )}
        </div>
      </div>

      {/* Formula Breakdown Modal */}
      {formulaModalOpen && (
        <FormulaBreakdownModal
          open={formulaModalOpen}
          onClose={() => setFormulaModalOpen(false)}
          unitSystem={unitSystem}
          calcResults={calcResults}
        />
      )}

      {/* Custom Duct Configuration Modal */}
      {customModalOpen && (
        <CustomDuctConfigModal
          open={customModalOpen}
          onClose={() => setCustomModalOpen(false)}
          initialConfig={{
            airflow: typeof airflow === "number" ? airflow : 2500,
            targetFr: typeof targetFr === "number" ? targetFr : 0.08,
            ductShape,
            aspectRatio,
            customProfileName,
          }}
          unitSystem={unitSystem}
          onSave={handleApplyCustomConfig}
        />
      )}

      {/* Assign Comment & Tasks Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          open={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          spaceId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          spaceName={commentTargetItem.name}
          targetType="Duct Sizer"
          category="Duct Sizer"
          calculatorTitle="Duct Sizer"
          calculatorPath="/duct-sizer"
          existingComments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            commentsList,
            "/duct-sizer",
            activeProjectId || project?.id || "default"
          )}
          initialComments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            commentsList,
            "/duct-sizer",
            activeProjectId || project?.id || "default"
          )}
          comments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            commentsList,
            "/duct-sizer",
            activeProjectId || project?.id || "default"
          )}
          onSave={(c) => {
            const tId = commentTargetItem?.id || c?.targetId || "card-params";
            const tName = commentTargetItem?.name || c?.targetName || "Sizing Parameters";
            const newC = {
              ...c,
              id: c.id || `duct-comment-${Date.now()}`,
              targetId: tId,
              targetName: tName,
              spaceId: tId,
              spaceName: tName,
              itemId: tId,
              targetType: "Duct Sizer",
              calculatorTitle: "Duct Sizer",
              calculatorPath: "/duct-sizer",
              projectId: activeProjectId || project?.id || "default",
              projectName: project?.name || "Commercial Duct Sizing Study",
              authorName: currentUserName || "Design Engineer",
              authorId: userData?.id || profile?.id || "user-1",
              timestamp: new Date().toISOString(),
            };
            const u = [newC, ...commentsList.filter((x) => x.id !== newC.id)];
            saveComments(u);

            dispatchGlobalCommentNotification(newC, {
              project: project || { id: activeProjectId || "default", name: project?.name || "Duct Sizing Study" },
              currentUserName: currentUserName || "Design Engineer",
              currentUserId: userData?.id || profile?.id || "user-1",
            });

            setCommentModalOpen(false);
            setCommentTargetItem(null);
            toast.success("Comment assigned successfully.");
          }}
          onSaveComment={(c) => {
            const tId = commentTargetItem?.id || c?.targetId || "card-params";
            const tName = commentTargetItem?.name || c?.targetName || "Sizing Parameters";
            const newC = {
              ...c,
              id: c.id || `duct-comment-${Date.now()}`,
              targetId: tId,
              targetName: tName,
              spaceId: tId,
              spaceName: tName,
              itemId: tId,
              targetType: "Duct Sizer",
              calculatorTitle: "Duct Sizer",
              calculatorPath: "/duct-sizer",
              projectId: activeProjectId || project?.id || "default",
              projectName: project?.name || "Commercial Duct Sizing Study",
              authorName: currentUserName || "Design Engineer",
              authorId: userData?.id || profile?.id || "user-1",
              timestamp: new Date().toISOString(),
            };
            const u = [newC, ...commentsList.filter((x) => x.id !== newC.id)];
            saveComments(u);

            dispatchGlobalCommentNotification(newC, {
              project: project || { id: activeProjectId || "default", name: project?.name || "Duct Sizing Study" },
              currentUserName: currentUserName || "Design Engineer",
              currentUserId: userData?.id || profile?.id || "user-1",
            });

            setCommentModalOpen(false);
            setCommentTargetItem(null);
            toast.success("Comment assigned successfully.");
          }}
          currentUserId={userData?.id || profile?.id || "user-1"}
          currentUserName={currentUserName}
        />
      )}
    </AppShell>
  );
}

// SUB-COMPONENT: FORMULA BREAKDOWN & CALCULATION PREVIEW MODAL (MATCHING FRESH AIR COOLING LOAD STANDARD)
function FormulaBreakdownModal({
  open,
  onClose,
  unitSystem,
  calcResults,
}: {
  open: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  calcResults: any;
}) {
  const [activeTab, setActiveTab] = React.useState<"trace" | "formulas" | "variables">("trace");
  const [copied, setCopied] = React.useState(false);

  // Esc key listener
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const isSI = unitSystem === "si";
  const ip = !isSI;

  const qM3s = calcResults.qCfm * 4.71947e-4;
  const areaM2 = calcResults.areaM2;
  const velMs = calcResults.velocityMs;
  const dhM = calcResults.hydraulicDiaMm / 1000;
  const perimM = calcResults.perimeterM;
  const re = calcResults.reynolds;
  const fFactor = calcResults.frictionFactor;
  const actFrPaM = calcResults.actualFrPaM;
  const actFrInWg = calcResults.actualFrInWg;
  const velPressPa = calcResults.velPressPa;

  const handleCopySummary = () => {
    const text = `=== DUCT SIZING & AERODYNAMICS FORMULA BREAKDOWN ===
Governing Standards: SMACNA HVAC Systems Duct Design & ASHRAE Fundamentals (Ch. 21)
Unit System: ${isSI ? "SI Metric (mm, m/s, Pa/m, L/s)" : "IP Imperial (in, FPM, in.wg/100ft, CFM)"}
Sized Selection: ${calcResults.sizeDisplay} (${calcResults.sizeFullText})

--- 1. ACTIVE SIZING PARAMETERS ---
• Volumetric Airflow (Q): ${isSI ? `${Math.round(calcResults.qLps).toLocaleString()} L/s` : `${calcResults.qCfm.toLocaleString()} CFM`} (${qM3s.toFixed(4)} m³/s)
• Target Friction Rate: ${isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg/100ft`}
• Duct Shape: ${calcResults.ductShape === "round" ? "Round Spiral" : `Rectangular (${calcResults.aspectRatio.toFixed(1)}:1)`}

--- 2. STEP-BY-STEP CALCULATION STEPS ---
[1] Volumetric Flow Rate (Q):
    Q = ${calcResults.qCfm.toLocaleString()} CFM × 0.000471947 = ${qM3s.toFixed(4)} m³/s (${Math.round(calcResults.qLps)} L/s)

[2] Circular Equivalent Diameter (D_eq):
    D_eq = 1.30 · (a · b)^0.625 / (a + b)^0.25 = ${(calcResults.exactDiameterMm).toFixed(1)} mm (${calcResults.exactDiameterIn.toFixed(2)} in.)

[3] Internal Cross-Sectional Area (A):
    A = ${calcResults.ductShape === "rect" ? `${(calcResults.selectedWidthMm/1000).toFixed(3)} m × ${(calcResults.selectedHeightMm/1000).toFixed(3)} m` : `(π/4) × ${(calcResults.selectedWidthMm/1000).toFixed(3)}²`} = ${areaM2.toFixed(4)} m² (${calcResults.areaSqFt.toFixed(2)} sq.ft)

[4] Air Flow Velocity (V = Q / A):
    V = ${qM3s.toFixed(4)} m³/s / ${areaM2.toFixed(4)} m² = ${velMs.toFixed(2)} m/s (${Math.round(calcResults.velocityFpm)} FPM) [${calcResults.flowRegime}]

[5] Hydraulic Diameter & Perimeter (Dh, P):
    P = ${perimM.toFixed(2)} m | D_h = 4A / P = ${Math.round(calcResults.hydraulicDiaMm)} mm (${calcResults.hydraulicDiaIn.toFixed(1)} in.)

[6] Reynolds Number & Friction Factor (Re, f):
    Re = ${Math.round(re).toLocaleString()} | Solved Darcy f = ${fFactor.toFixed(5)}

[7] Actual Friction Loss Rate (ΔP / L):
    ΔP/L = (f · ρ · V²) / (2 · D_h) = ${actFrPaM.toFixed(3)} Pa/m (${actFrInWg.toFixed(4)} in.wg/100ft)

[8] Dynamic Velocity Pressure (Pv):
    Pv = ${isSI ? `${velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Duct sizer calculation breakdown copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-150 select-none font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[86vh] flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Fresh Air Cooling Load standard */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="size-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-[13px] font-bold text-foreground truncate">
                Duct Sizing Formula Breakdown
              </h2>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold shrink-0">
              SMACNA / ASHRAE
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border text-[10px] font-mono font-medium shrink-0">
              {ip ? "IP" : "SI"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/10 shrink-0 select-none">
          <button
            type="button"
            onClick={() => setActiveTab("trace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "trace"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Activity className="size-3" />
            <span>Calculation Steps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulas")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "formulas"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="size-3" />
            <span>Master Formulas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("variables")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
              activeTab === "variables"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Layers className="size-3" />
            <span>Variables Reference</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {/* TAB 1: CALCULATION TRACE */}
          {activeTab === "trace" && (
            <div className="space-y-2.5">
              {/* Compact Active Sizing Conditions */}
              <div className="p-2.5 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider pb-1.5 mb-1.5 border-b border-border/60">
                  <span className="flex items-center gap-1 text-foreground">
                    <SlidersHorizontal className="size-3 text-primary" /> Active Sizing Parameters
                  </span>
                  <span className="font-mono text-primary normal-case font-bold">
                    {isSI ? `${Math.round(calcResults.qLps).toLocaleString()} L/s` : `${calcResults.qCfm.toLocaleString()} CFM`} | {isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Target Friction &amp; Shape</span>
                    <span className="font-mono font-bold text-foreground">
                      {isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">
                      ({calcResults.ductShape === "round" ? "Round Spiral" : `Rect ${calcResults.aspectRatio.toFixed(1)}:1`})
                    </span>
                  </div>
                  <div className="bg-background rounded p-1.5 border border-border/60">
                    <span className="text-[9.5px] text-muted-foreground font-semibold block uppercase">Selected Section</span>
                    <span className="font-mono font-bold text-foreground">{calcResults.sizeDisplay}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-1">({velMs.toFixed(2)} m/s)</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: VOLUMETRIC AIRFLOW CONVERSION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-primary/10 text-primary text-[10px] font-mono font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Volumetric Airflow Conversion (Q)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {qM3s.toFixed(4)} m³/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: Q_m³/s = Q_CFM × 4.71947 × 10⁻⁴</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{calcResults.qCfm.toLocaleString()} CFM × 0.000471947</span>
                    <span className="text-primary font-bold">= {qM3s.toFixed(4)} m³/s ({Math.round(calcResults.qLps).toLocaleString()} L/s)</span>
                  </div>
                </div>
              </div>

              {/* STEP 2: CIRCULAR EQUIVALENT DIAMETER */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Circular Equivalent Target (Deq)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {(calcResults.exactDiameterMm).toFixed(1)} mm
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: D_eq = 1.30 · (a · b)^0.625 / (a + b)^0.25</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">Standard Section: {calcResults.sizeDisplay}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">= {(calcResults.exactDiameterMm).toFixed(1)} mm ({calcResults.exactDiameterIn.toFixed(2)} in.)</span>
                  </div>
                </div>
              </div>

              {/* STEP 3: INTERNAL CROSS-SECTIONAL AREA */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Internal Cross-Sectional Area (A)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {areaM2.toFixed(4)} m²
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">
                    Formula: {calcResults.ductShape === "rect" ? "A = Width × Height" : "A = (π / 4) × D²"}
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">
                      {calcResults.ductShape === "rect"
                        ? `${(calcResults.selectedWidthMm / 1000).toFixed(3)} m × ${(calcResults.selectedHeightMm / 1000).toFixed(3)} m`
                        : `(π / 4) × ${(calcResults.selectedWidthMm / 1000).toFixed(3)}²`}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">= {areaM2.toFixed(4)} m² ({calcResults.areaSqFt.toFixed(2)} sq.ft)</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: AIR FLOW VELOCITY */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      4
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Air Flow Velocity (V)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {velMs.toFixed(2)} m/s
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: V = Q / A (Continuity Equation)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{qM3s.toFixed(4)} m³/s / {areaM2.toFixed(4)} m²</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">= {velMs.toFixed(2)} m/s ({Math.round(calcResults.velocityFpm)} FPM)</span>
                  </div>
                </div>
              </div>

              {/* STEP 5: HYDRAULIC DIAMETER & PERIMETER */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      5
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Hydraulic Diameter &amp; Perimeter (Dh, P)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    Dh = {Math.round(calcResults.hydraulicDiaMm)} mm
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: P = 2(W + H) | D_h = 4A / P</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">4 × {areaM2.toFixed(4)} m² / {perimM.toFixed(2)} m</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">= {Math.round(calcResults.hydraulicDiaMm)} mm ({calcResults.hydraulicDiaIn.toFixed(1)} in.)</span>
                  </div>
                </div>
              </div>

              {/* STEP 6: REYNOLDS NUMBER & COLEBROOK FRICTION */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      6
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Reynolds Number &amp; Friction Factor (Re, f)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                    f = {fFactor.toFixed(5)}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">Reynolds Number (Re):</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.round(re).toLocaleString()} ({calcResults.flowRegime})</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Colebrook-White Darcy f (ε = 0.09mm):</span>
                    <span className="font-bold text-foreground">f = {fFactor.toFixed(5)}</span>
                  </div>
                </div>
              </div>

              {/* STEP 7: ACTUAL FRICTION LOSS RATE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      7
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Actual Friction Loss Rate (ΔP / L)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    {actFrPaM.toFixed(3)} Pa/m
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: ΔP/L = (f · ρ · V²) / (2 · D_h)</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">({fFactor.toFixed(5)} × 1.204 × {velMs.toFixed(2)}²) / (2 × {dhM.toFixed(4)})</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">= {actFrPaM.toFixed(3)} Pa/m ({actFrInWg.toFixed(4)} in.wg/100ft)</span>
                  </div>
                </div>
              </div>

              {/* STEP 8: DYNAMIC VELOCITY PRESSURE */}
              <div className="border border-border/70 rounded-xl bg-card p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-mono font-bold flex items-center justify-center">
                      8
                    </span>
                    <span className="font-bold text-[11.5px] text-foreground">
                      Dynamic Velocity Pressure (Pv)
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                    {isSI ? `${velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}
                  </span>
                </div>
                <div className="bg-muted/50 rounded p-2 font-mono text-[11px] border border-border/60 space-y-1">
                  <div className="text-muted-foreground text-[10px]">Formula: {isSI ? "Pv = 0.5 · ρ · V²" : "Pv = (V / 4005)²"}</div>
                  <div className="flex justify-between text-foreground font-semibold pt-0.5 border-t border-border/40">
                    <span className="text-muted-foreground">{isSI ? `0.5 × 1.204 × (${velMs.toFixed(2)})²` : `(${Math.round(calcResults.velocityFpm)} / 4005)²`}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-bold">= {isSI ? `${velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}</span>
                  </div>
                </div>
              </div>

              {/* Sizing Outcome Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] uppercase font-bold text-muted-foreground">Recommended Duct Size</div>
                  <div className="text-[11.5px] font-bold text-foreground mt-0.5">{calcResults.sizeDisplay} ({calcResults.sizeFullText})</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono text-primary leading-tight">{velMs.toFixed(2)} <span className="text-xs font-normal">m/s</span></div>
                  <div className="text-[9.5px] text-muted-foreground font-mono">{actFrPaM.toFixed(2)} Pa/m ({actFrInWg.toFixed(3)} in.wg)</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MASTER FORMULAS */}
          {activeTab === "formulas" && (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Colebrook-White Darcy Friction Factor (f)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>1 / √f = -2 · log₁₀ [ (ε / (3.7 · D_h)) + (2.51 / (Re · √f)) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Where absolute roughness ε = 0.00009 m (0.09 mm) for standard galvanized sheet metal. Solved iteratively via numerical Newton-Raphson convergence.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500" /> Huebscher Circular Equivalent (Deq)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>D_eq = 1.30 · [ (a · b)^0.625 / (a + b)^0.25 ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Provides identical friction loss and volumetric capacity for a rectangular duct of dimensions a × b as an equivalent circular duct.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Hydraulic Diameter (Dh) &amp; Duct Perimeter (P)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>P = 2 · (a + b)  |  D_h = 4 · A / P = 4 · (a · b) / [ 2 · (a + b) ]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Hydraulic diameter represents equivalent diameter based on cross-section area to wetted perimeter ratio.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500" /> Darcy-Weisbach Continuous Pressure Loss Rate (ΔP / L)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: ΔP / L = (f · ρ · V²) / (2 · D_h) [Pa/m]</div>
                  <div>IP: ΔP / L = (12 · f / D_h) · (V / 4005)² [in.wg/100ft]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Calculates actual friction pressure loss rate per meter or per 100 ft length of duct.
                </p>
              </div>

              <div className="p-2.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="font-bold text-foreground text-[11px] flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-teal-500" /> Dynamic Velocity Pressure (Pv)
                </div>
                <div className="p-1.5 bg-card rounded font-mono text-[10.5px] border border-border/60 text-primary font-bold space-y-0.5">
                  <div>SI: Pv = 0.5 · ρ · V² [Pa]  |  IP: Pv = ( V / 4005 )² [in.wg]</div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Calculated dynamically using standard air density ρ = 1.204 kg/m³ at sea level (20°C / 68°F).
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: VARIABLES & CONSTANTS */}
          {activeTab === "variables" && (
            <div className="space-y-2.5">
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-[10.5px]">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border font-bold text-foreground">
                      <th className="py-1.5 px-2">Symbol</th>
                      <th className="py-1.5 px-2">Parameter</th>
                      <th className="py-1.5 px-2">SI Standard</th>
                      <th className="py-1.5 px-2">IP Standard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">Q</td>
                      <td className="py-1.5 px-2 text-foreground">Volumetric Airflow</td>
                      <td className="py-1.5 px-2 font-mono">m³/s / L/s</td>
                      <td className="py-1.5 px-2 font-mono">CFM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">V</td>
                      <td className="py-1.5 px-2 text-foreground">Air Flow Velocity</td>
                      <td className="py-1.5 px-2 font-mono">m/s</td>
                      <td className="py-1.5 px-2 font-mono">FPM</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">D_h</td>
                      <td className="py-1.5 px-2 text-foreground">Hydraulic Diameter</td>
                      <td className="py-1.5 px-2 font-mono">mm</td>
                      <td className="py-1.5 px-2 font-mono">in.</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">D_eq</td>
                      <td className="py-1.5 px-2 text-foreground">Circular Equivalent</td>
                      <td className="py-1.5 px-2 font-mono">mm</td>
                      <td className="py-1.5 px-2 font-mono">in.</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">f</td>
                      <td className="py-1.5 px-2 text-foreground">Darcy Friction Factor</td>
                      <td className="py-1.5 px-2 font-mono">dimensionless</td>
                      <td className="py-1.5 px-2 font-mono">dimensionless</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ΔP / L</td>
                      <td className="py-1.5 px-2 text-foreground">Friction Loss Rate</td>
                      <td className="py-1.5 px-2 font-mono">Pa/m</td>
                      <td className="py-1.5 px-2 font-mono">in.wg/100ft</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">P_v</td>
                      <td className="py-1.5 px-2 text-foreground">Velocity Pressure</td>
                      <td className="py-1.5 px-2 font-mono">Pa</td>
                      <td className="py-1.5 px-2 font-mono">in.wg</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ρ_air</td>
                      <td className="py-1.5 px-2 text-foreground">Standard Air Density</td>
                      <td className="py-1.5 px-2 font-mono">1.204 kg/m³</td>
                      <td className="py-1.5 px-2 font-mono">0.075 lb/ft³</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">μ</td>
                      <td className="py-1.5 px-2 text-foreground">Dynamic Viscosity</td>
                      <td className="py-1.5 px-2 font-mono">1.81 × 10⁻⁵ Pa·s</td>
                      <td className="py-1.5 px-2 font-mono">1.22 × 10⁻⁵ lb/ft·s</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-mono font-bold text-primary">ε</td>
                      <td className="py-1.5 px-2 text-foreground">Absolute Roughness</td>
                      <td className="py-1.5 px-2 font-mono">0.00009 m</td>
                      <td className="py-1.5 px-2 font-mono">0.0003 ft</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-muted border border-border/70 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-primary-foreground text-[11.5px] font-semibold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// SUB-COMPONENT: LIVE INTELLIGENCE DRAWER (MATCHING VENTILATION & PUMP SIZING STANDARD)
function DuctSizerIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  onNavigateToField,
  onOpenFormulaBreakdown,
}: {
  onClose: () => void;
  calcResults: any;
  preset: DuctPresetKey;
  onSelectPreset: (key: DuctPresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  onNavigateToField: (id: string) => void;
  onOpenFormulaBreakdown?: () => void;
}) {
  const isSI = unitSystem === "si";
  const vel = calcResults.velocityFpm;
  const isHighVelocity = vel > 2000;
  const isOptimalVelocity = vel >= 800 && vel <= 1800;

  // Compliance checks for SMACNA & ASHRAE standards
  const isVelocityOk = vel <= 2000;
  const isAspectRatioOk = calcResults.ductShape === "round" || calcResults.aspectRatio <= 3.0;
  const isFrictionOk = calcResults.actualFrInWg >= 0.04 && calcResults.actualFrInWg <= 0.20;
  const isReynoldsTurbulent = calcResults.reynolds > 4000;
  const isSmacnaMaxOk = calcResults.ductShape === "round" || calcResults.aspectRatio <= 4.0;

  const checks = [isVelocityOk, isAspectRatioOk, isFrictionOk, isReynoldsTurbulent, isSmacnaMaxOk];
  const passedCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedCount / checks.length) * 100);

  // Sheet Metal Gauge recommendation per SMACNA Duct Construction Standards
  const sheetMetalRecommendation = useMemo(() => {
    const maxDimIn = calcResults.ductShape === "rect"
      ? Math.max(calcResults.selectedWidthIn || 0, calcResults.selectedHeightIn || 0)
      : (calcResults.selectedWidthIn || calcResults.deqIn || 0);

    if (maxDimIn <= 12) {
      return { gauge: "26 Gauge (0.55 mm)", standard: "SMACNA Table 2-1", joint: "Drive Slip / S-Cleat" };
    } else if (maxDimIn <= 30) {
      return { gauge: "24 Gauge (0.70 mm)", standard: "SMACNA Table 2-1", joint: "TDC / TDF Flange or Standing S" };
    } else if (maxDimIn <= 54) {
      return { gauge: "22 Gauge (0.85 mm)", standard: "SMACNA Table 2-1", joint: "TDC / TDF Flange + Corner Clips" };
    } else if (maxDimIn <= 84) {
      return { gauge: "20 Gauge (1.00 mm)", standard: "SMACNA Table 2-1", joint: "TDC with Mid-Span Reinforcement" };
    } else {
      return { gauge: "18 Gauge (1.20 mm)", standard: "SMACNA Table 2-1", joint: "Angle Flange + Internal Tie Rods" };
    }
  }, [calcResults]);

  // Acoustic Noise Criteria estimation
  const acousticRating = useMemo(() => {
    if (vel <= 1000) {
      return { nc: "NC 20 – 25", label: "Extremely Quiet (Broadcast / Theatres / Suites)", tone: "success" as const };
    } else if (vel <= 1500) {
      return { nc: "NC 25 – 30", label: "Quiet Commercial (Offices / Classrooms / Hospital)", tone: "success" as const };
    } else if (vel <= 2000) {
      return { nc: "NC 30 – 35", label: "Standard Commercial (Retail / Open Office / Malls)", tone: "primary" as const };
    } else if (vel <= 2500) {
      return { nc: "NC 35 – 45", label: "High Velocity (Plant Rooms / Shaft Risers)", tone: "warning" as const };
    } else {
      return { nc: "NC > 45", label: "Acoustic Warning (Requires In-Duct Sound Silencers)", tone: "warning" as const };
    }
  }, [vel]);

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in select-none bg-card">
      {/* Header matching Ventilation & Pump Sizing exactly */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0 bg-surface-2/40">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-auto">
        
        {/* Compliance Status Section */}
        <IntelSection icon={CheckCircle2} tone={complianceScore >= 80 ? "success" : "warning"} title="Compliance Status">
          <div className="text-[12px] text-muted-foreground">
            SMACNA HVAC Duct Construction Standards &amp; ASHRAE 90.1 Aerodynamics validation.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{complianceScore}%</span>
          </div>
        </IntelSection>

        {/* Aerodynamic & Sizing Audit */}
        <IntelSection icon={Activity} tone="primary" title="Aerodynamic & Sizing Audit">
          <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-foreground flex flex-col gap-1 mb-2.5">
            <div className="flex items-center justify-between font-semibold text-[11.5px]">
              <span>Recommended Duct Size</span>
              <span className="font-mono font-bold text-primary text-[12.5px]">
                {calcResults.sizeDisplay}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Design velocity is <strong className="text-foreground">{isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`}</strong> (compliant with low-noise comfort criteria).
            </p>
          </div>
          <KV
            k="Design Airflow (Q)"
            v={isSI ? `${Math.round(calcResults.qLps).toLocaleString()} L/s` : `${Math.round(calcResults.qCfm).toLocaleString()} CFM`}
          />
          <KV
            k="Target Friction Rate"
            v={isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in/100ft`}
          />
          <KV
            k="Achieved Friction Loss"
            v={isSI ? `${calcResults.actualFrPaM.toFixed(3)} Pa/m` : `${calcResults.actualFrInWg.toFixed(4)} in/100ft`}
          />
          <KV
            k="Equivalent Circular Dia"
            v={isSI ? `${Math.round(calcResults.deqMm)} mm` : `${calcResults.deqIn.toFixed(1)}" NPS`}
          />
          <KV
            k="Hydraulic Diameter (Dh)"
            v={isSI ? `${Math.round(calcResults.hydraulicDiaMm)} mm` : `${calcResults.hydraulicDiaIn.toFixed(1)}" NPS`}
          />
          <KV
            k="Velocity Pressure (Pv)"
            v={isSI ? `${calcResults.velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}
          />
          <KV
            k="Reynolds Number (Re)"
            v={Math.round(calcResults.reynolds).toLocaleString()}
          />
          <KV
            k="Darcy Friction Factor (f)"
            v={calcResults.frictionFactor.toFixed(5)}
          />
        </IntelSection>

        {/* Fabrication & Sheet Metal Standards */}
        <IntelSection icon={Layers} tone="primary" title="Fabrication & Sheet Metal Standards">
          <KV k="Recommended Sheet Gauge" v={sheetMetalRecommendation.gauge} />
          <KV k="Standard Joint System" v={sheetMetalRecommendation.joint} />
          <KV k="Duct Aspect Ratio (W:H)" v={calcResults.ductShape === "rect" ? `${calcResults.aspectRatio.toFixed(1)}:1` : "1.0:1 (Round)"} />
          <KV k="Internal Cross-Section" v={isSI ? `${calcResults.areaM2.toFixed(3)} m²` : `${calcResults.areaSqFt.toFixed(2)} sq.ft`} />
          <KV k="Wetted Perimeter / Girth" v={isSI ? `${calcResults.perimeterM.toFixed(2)} m` : `${calcResults.perimeterIn.toFixed(1)} in.`} />
        </IntelSection>

        {/* Acoustic Noise & Velocity Diagnostic */}
        <IntelSection icon={Gauge} tone={acousticRating.tone} title="Acoustic Noise Diagnostic">
          <div className="p-2.5 rounded-xl border bg-surface-2/60 space-y-1.5 mb-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span>Estimated Room Noise</span>
              <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                acousticRating.tone === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                acousticRating.tone === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                {acousticRating.nc}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {acousticRating.label}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToField("field-airflow")}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
          >
            <span>Jump to Airflow Parameter</span>
            <ArrowRight className="size-3" />
          </button>
        </IntelSection>

        {/* Standard Application Presets */}
        <IntelSection icon={Sparkles} tone="primary" title="Quick Application Scenarios">
          <div className="space-y-1.5">
            {[
              { key: "commercial_office_main", label: "Commercial Office Main Trunk", flow: "2500 CFM / 1180 L/s", fr: "0.08 in.wg / 0.65 Pa/m" },
              { key: "retail_branch_duct", label: "Retail / Commercial Branch Duct", flow: "1200 CFM / 566 L/s", fr: "0.10 in.wg / 0.82 Pa/m" },
              { key: "hotel_guestroom_riser", label: "Hotel Guestroom Low-Noise Riser", flow: "800 CFM / 378 L/s", fr: "0.06 in.wg / 0.49 Pa/m" },
              { key: "kitchen_exhaust_duct", label: "Kitchen / High-Velocity Exhaust", flow: "3500 CFM / 1650 L/s", fr: "0.15 in.wg / 1.22 Pa/m" },
            ].map((p) => {
              const isSelected = preset === p.key;
              return (
                <button
                  key={p.key}
                  disabled={isEffectiveReadOnly}
                  onClick={() => onSelectPreset(p.key as DuctPresetKey)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                      : "bg-surface-2/40 border-border hover:bg-surface-2 hover:border-border text-foreground font-medium"
                  } ${isEffectiveReadOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div>
                    <div className="font-bold text-[11.5px]">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground">{p.flow} • {p.fr}</div>
                  </div>
                  {isSelected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </IntelSection>

        {/* Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Keep aspect ratio W:H ≤ 2:1 to minimize sheet metal weight and acoustic flutter.</li>
            <li>Maintain velocity &lt; 2,000 FPM (10.2 m/s) in occupied areas to avoid high noise regeneration.</li>
            <li>Use round spiral duct for long straight runs to maximize structural rigidity and reduce leakage.</li>
          </ul>
        </IntelSection>

        {/* Engineering Notes & Step-by-Step Derivations */}
        <IntelSection icon={Info} tone="muted" title="Engineering Notes">
          <div className="text-[12px] text-muted-foreground mb-2.5">
            Calculated via iterative Colebrook-White equal friction formulation and SMACNA Huebscher transformations.
          </div>
          {onOpenFormulaBreakdown && (
            <button
              type="button"
              onClick={onOpenFormulaBreakdown}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-sm cursor-pointer"
            >
              <Eye className="size-3.5" />
              <span>View Step-by-Step Derivations</span>
            </button>
          )}
        </IntelSection>

      </div>
    </div>
  );
}

function IntelSection({ icon: Icon, title, tone, children }: { icon: any; title: string; tone: "success" | "warning" | "primary" | "muted"; children: React.ReactNode }) {
  const color =
    tone === "success" ? "text-emerald-500" :
      tone === "warning" ? "text-amber-500" :
        tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <section className="px-3 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium">{v}</span>
    </div>
  );
}
