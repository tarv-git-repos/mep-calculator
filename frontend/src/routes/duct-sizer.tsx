import { calculateDuctSize, calculateSMACNAWarnings, colebrook, CFM_TO_LPS, LPS_TO_CFM, INWG_TO_PAM, PAM_TO_INWG, FPM_TO_MPS, MPS_TO_FPM, IN_TO_MM, MM_TO_IN } from "@/lib/calc-duct-sizer";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { exportDuctSizerPDF } from "@/lib/exportDuctSizerPDF";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle, Eye,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight,
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
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
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

      // Comprehensive comments aggregation
      const uId = profile?.id || userData?.id;
      const uEmail = profile?.email || userData?.email;
      const uName = currentUserName;

      const fetchAllComments = () => {
        const commentsMap = new Map<string, any>();
        const addList = (raw: string | null) => {
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                if (!item || !item.id) return;
                const isDuct =
                  item.calculatorPath === "/duct-sizer" ||
                  item.calculatorPath === "duct-sizer" ||
                  String(item.calculatorTitle || "").toLowerCase().includes("duct") ||
                  String(item.targetType || "").toLowerCase().includes("duct") ||
                  String(item.targetName || "").toLowerCase().includes("duct") ||
                  String(item.spaceName || "").toLowerCase().includes("duct") ||
                  String(item.targetId || "").toLowerCase().includes("targetfr") ||
                  String(item.targetId || "").toLowerCase().includes("airflow") ||
                  String(item.targetId || "").toLowerCase().includes("aspectratio") ||
                  String(item.targetId || "").toLowerCase().includes("ductshape");

                if (isDuct) {
                  commentsMap.set(item.id, item);
                }
              });
            }
          } catch (e) {}
        };

        addList(localStorage.getItem(`mep_calc_comments_${pId}_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_${pId}_duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_duct-sizer`));

        if (savedData && Array.isArray(savedData.comments)) {
          savedData.comments.forEach((c: any) => { if (c && c.id) commentsMap.set(c.id, c); });
        }

        addList(localStorage.getItem("mep_persistent_user_notifs"));
        addList(localStorage.getItem("mep_calc_coord_notifs"));
        if (uId) addList(localStorage.getItem(`mep_persistent_user_notifs_${uId}`));
        if (uEmail) addList(localStorage.getItem(`mep_persistent_user_notifs_${uEmail}`));
        if (uName) addList(localStorage.getItem(`mep_persistent_user_notifs_${uName}`));

        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("mep_persistent_user_notifs_") || k.includes("duct-sizer") || k.includes("duct_sizer"))) {
              addList(localStorage.getItem(k));
            }
          }
        } catch (e) {}

        return Array.from(commentsMap.values());
      };

      const aggregatedComments = fetchAllComments();

      if (savedData && typeof savedData === "object") {
        if (savedData.unitSystem === "ip" || savedData.unitSystem === "si") setUnitSystem(savedData.unitSystem);
        if (savedData.preset) setPreset(savedData.preset);
        if (savedData.customProfileName) setCustomProfileName(savedData.customProfileName);
        if (typeof savedData.airflow === "number" && !isNaN(savedData.airflow)) setAirflow(savedData.airflow);
        if (typeof savedData.targetFr === "number" && !isNaN(savedData.targetFr)) setTargetFr(savedData.targetFr);
        if (savedData.ductShape === "round" || savedData.ductShape === "rect") setDuctShape(savedData.ductShape);
        if (typeof savedData.aspectRatio === "number" && !isNaN(savedData.aspectRatio)) setAspectRatio(savedData.aspectRatio);
        setCommentsList(aggregatedComments);
      } else {
        const def = DUCT_PRESETS.commercial_office_main;
        setUnitSystem("si");
        setPreset("commercial_office_main");
        setCustomProfileName("Commercial Office Main Supply (Custom)");
        setAirflow(def.airflow);
        setTargetFr(def.targetFr);
        setDuctShape(def.ductShape);
        setAspectRatio(def.aspectRatio);
        setCommentsList(aggregatedComments);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load duct sizer calculation data:", e);
    }
  }, [project?.id, loadedProjectId, profile?.id, userData?.id]);

  // Real-time synchronization of comments across tabs/windows
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reloadComments = (e?: any) => {
      try {
        const pId = project?.id || "default";
        const uId = profile?.id || userData?.id;
        const uEmail = profile?.email || userData?.email;
        const uName = currentUserName;

        const commentsMap = new Map<string, any>();
        const addList = (raw: string | null) => {
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                if (!item || !item.id) return;
                const isDuct =
                  item.calculatorPath === "/duct-sizer" ||
                  item.calculatorPath === "duct-sizer" ||
                  String(item.calculatorTitle || "").toLowerCase().includes("duct") ||
                  String(item.targetType || "").toLowerCase().includes("duct") ||
                  String(item.targetName || "").toLowerCase().includes("duct") ||
                  String(item.spaceName || "").toLowerCase().includes("duct") ||
                  String(item.targetId || "").toLowerCase().includes("targetfr") ||
                  String(item.targetId || "").toLowerCase().includes("airflow") ||
                  String(item.targetId || "").toLowerCase().includes("aspectratio") ||
                  String(item.targetId || "").toLowerCase().includes("ductshape");

                if (isDuct) {
                  commentsMap.set(item.id, item);
                }
              });
            }
          } catch (e) {}
        };

        addList(localStorage.getItem(`mep_calc_comments_${pId}_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_${pId}_duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_duct-sizer`));
        addList(localStorage.getItem("mep_persistent_user_notifs"));
        addList(localStorage.getItem("mep_calc_coord_notifs"));
        if (uId) addList(localStorage.getItem(`mep_persistent_user_notifs_${uId}`));
        if (uEmail) addList(localStorage.getItem(`mep_persistent_user_notifs_${uEmail}`));
        if (uName) addList(localStorage.getItem(`mep_persistent_user_notifs_${uName}`));

        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("mep_persistent_user_notifs_") || k.includes("duct-sizer") || k.includes("duct_sizer"))) {
              addList(localStorage.getItem(k));
            }
          }
        } catch (e) {}

        if (e?.detail && e.detail.id) {
          const det = e.detail;
          const isDuct =
            det.calculatorPath === "/duct-sizer" ||
            det.calculatorPath === "duct-sizer" ||
            String(det.calculatorTitle || "").toLowerCase().includes("duct") ||
            String(det.targetType || "").toLowerCase().includes("duct") ||
            String(det.targetName || "").toLowerCase().includes("duct");
          if (isDuct) {
            commentsMap.set(det.id, det);
          }
        }

        setCommentsList(Array.from(commentsMap.values()));
      } catch (e) {}
    };

    window.addEventListener("mep_notification_received", reloadComments);
    window.addEventListener("mep_notif_tick", reloadComments);
    window.addEventListener("mep-notification-added", reloadComments);
    window.addEventListener("mep-comment-updated", reloadComments);
    window.addEventListener("storage", reloadComments);
    return () => {
      window.removeEventListener("mep_notification_received", reloadComments);
      window.removeEventListener("mep_notif_tick", reloadComments);
      window.removeEventListener("mep-notification-added", reloadComments);
      window.removeEventListener("mep-comment-updated", reloadComments);
      window.removeEventListener("storage", reloadComments);
    };
  }, [project?.id, profile?.id, profile?.email, userData?.id, userData?.email, currentUserName]);

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

  // Deep-linking scroll to target item handler
  useEffect(() => {
    const handleScrollToItem = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string; targetId?: string; targetName?: string }>;
      if (!customEvent?.detail) return;
      const targetId = customEvent.detail.id || customEvent.detail.targetId;
      const targetName = customEvent.detail.name || customEvent.detail.targetName;
      if (!targetId && !targetName) return;

      const cleanId = String(targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|metric-)/, "");
      const cleanName = String(targetName || "").toLowerCase().trim();

      setTab("solver");

      setTimeout(() => {
        let el = document.getElementById(targetId || "") ||
          document.getElementById(`field-${cleanRaw}`) ||
          document.getElementById(`card-${cleanRaw}`) ||
          document.getElementById(`metric-${cleanRaw}`) ||
          document.getElementById(`card-${cleanId}`) ||
          document.getElementById(cleanId) ||
          document.getElementById(cleanRaw) ||
          document.querySelector(`[data-comment-target="${cleanRaw}"]`) ||
          document.querySelector(`[data-comment-target="${targetId}"]`) ||
          document.querySelector(`[data-field-id="${cleanRaw}"]`);

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
          setHighlightedTargetId(targetId || cleanRaw || cleanId || targetName || "");
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedTargetId(null);
            highlightTimeoutRef.current = null;
          }, 4500);
        }
      }, 150);
    };

    window.addEventListener("mep-scroll-to-item", handleScrollToItem);
    window.addEventListener("mep-data-grid-scroll", handleScrollToItem);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollToItem);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollToItem);
      window.removeEventListener("mep-data-grid-scroll", handleScrollToItem);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollToItem);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Listen to URL parameters on route change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId");
    const targetName = params.get("commentTargetName");

    if (targetId || targetName) {
      const timer = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("mep-scroll-to-item", {
            detail: { id: targetId, name: targetName },
          })
        );
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  // Comments Management
  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/duct-sizer`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/duct-sizer", count: newList.length });
          bc.close();
        } catch (e) {}
      }
    }
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || "targetFr";
    const targetName = commentTargetItem?.name || commentData?.targetName || "Target Friction Rate";

    const commentWithMeta = {
      ...commentData,
      id: commentData.id || `cmt_${Date.now()}`,
      authorName: currentUserName,
      authorRole: profile?.role || "Design Engineer",
      timestamp: commentData.timestamp || new Date().toISOString(),
      targetId,
      targetName,
      itemId: targetId,
      spaceId: targetId,
      targetType: "Duct Sizer Parameter",
      calculatorTitle: "Duct Sizer",
      calculatorPath: "/duct-sizer",
      projectId: project?.id || "default",
      projectName: project?.name || "Duct Sizing Study",
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
    dispatchGlobalCommentNotification(commentWithMeta, { project });
    toast.success(`Comment / task assigned on "${targetName}"`);
    setCommentModalOpen(false);
  };

  const getItemComments = (id: string, label?: string) => {
    if (!id && !label) return [];
    const cleanId = String(id || "").toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-|metric-)/, "");
    const cleanLabel = String(label || "").toLowerCase().trim();

    return commentsList.filter((c) => {
      if (!c) return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim();
      const tIdRaw = tId.replace(/^(field-|card-|metric-)/, "");
      const tName = String(c.targetName || c.spaceName || c.name || "").toLowerCase().trim();

      if (
        tId === cleanId ||
        tId === cleanRawId ||
        tIdRaw === cleanRawId ||
        tId === `field-${cleanRawId}` ||
        `field-${tIdRaw}` === cleanId ||
        tId === `card-${cleanRawId}` ||
        `card-${tIdRaw}` === cleanId ||
        tId === `metric-${cleanRawId}` ||
        `metric-${tIdRaw}` === cleanId
      ) {
        return true;
      }

      if (cleanLabel && (tName.includes(cleanLabel) || cleanLabel.includes(tName))) {
        return true;
      }
      if (tName && cleanRawId && (tName.includes(cleanRawId) || cleanRawId.includes(tName))) {
        return true;
      }

      if (
        (cleanRawId === "targetfr" || cleanRawId === "target_fr" || cleanRawId === "friction" || cleanRawId === "frictionrate" || cleanLabel.includes("friction") || cleanLabel.includes("target fr")) &&
        (tId.includes("targetfr") || tId.includes("target_fr") || tId.includes("friction") || tId.includes("fr") || tName.includes("friction") || tName.includes("target fr") || tName.includes("in w.g.") || tName.includes("pa/m"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "airflow" || cleanRawId === "air_flow" || cleanRawId === "q" || cleanRawId === "flow" || cleanLabel.includes("airflow") || cleanLabel.includes("flow")) &&
        (tId.includes("air") || tId.includes("flow") || tId.includes("cfm") || tId.includes("lps") || tName.includes("airflow") || tName.includes("air flow") || tName.includes("cfm") || tName.includes("l/s"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "ductshape" || cleanRawId === "duct_shape" || cleanRawId === "shape" || cleanLabel.includes("shape")) &&
        (tId.includes("shape") || tId.includes("round") || tId.includes("rect") || tName.includes("shape") || tName.includes("cross-section") || tName.includes("round") || tName.includes("rect"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "aspectratio" || cleanRawId === "aspect_ratio" || cleanRawId === "ratio" || cleanLabel.includes("aspect")) &&
        (tId.includes("aspect") || tId.includes("ratio") || tName.includes("aspect") || tName.includes("ratio"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "hero-size" || cleanRawId === "size" || cleanRawId === "recommend" || cleanLabel.includes("recommended")) &&
        (tId.includes("hero") || tId.includes("size") || tId.includes("recommend") || tName.includes("recommend") || tName.includes("duct sizing") || tName.includes("size"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "card-params" || cleanRawId === "params" || cleanLabel.includes("sizing parameters")) &&
        (tId.includes("param") || tName.includes("sizing parameter") || tName.includes("parameters"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "card-acoustic-limits" || cleanRawId === "acoustic-limits" || cleanRawId === "acoustic" || cleanLabel.includes("acoustic")) &&
        (tId.includes("acoustic") || tName.includes("acoustic") || tName.includes("smacna acoustic"))
      ) {
        return true;
      }

      if (
        (cleanRawId === "metric-velocity" || cleanRawId === "velocity" || cleanLabel.includes("velocity")) &&
        (tId.includes("velocity") || tName.includes("velocity") || tName.includes("air velocity"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-friction" || cleanRawId === "actualfr" || cleanLabel.includes("actual friction")) &&
        (tId.includes("metric-friction") || tName.includes("actual friction") || tName.includes("friction loss"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-velpress" || cleanRawId === "velpress" || cleanLabel.includes("velocity pressure")) &&
        (tId.includes("velpress") || tId.includes("pressure") || tName.includes("velocity pressure") || tName.includes("pv"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-deq" || cleanRawId === "deq" || cleanLabel.includes("equivalent circular")) &&
        (tId.includes("deq") || tId.includes("equivalent") || tName.includes("equivalent circular") || tName.includes("deq"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-dh" || cleanRawId === "dh" || cleanLabel.includes("hydraulic diameter")) &&
        (tId.includes("dh") || tId.includes("hydraulic") || tName.includes("hydraulic diameter") || tName.includes("dh"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-area" || cleanRawId === "area" || cleanLabel.includes("cross-section area")) &&
        (tId.includes("area") || tName.includes("cross-section area") || tName.includes("area"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-reynolds" || cleanRawId === "reynolds" || cleanLabel.includes("reynolds")) &&
        (tId.includes("reynolds") || tName.includes("reynolds"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-darcy" || cleanRawId === "darcy" || cleanLabel.includes("darcy friction")) &&
        (tId.includes("darcy") || tId.includes("friction factor") || tName.includes("darcy") || tName.includes("friction factor"))
      ) {
        return true;
      }
      if (
        (cleanRawId === "metric-perimeter" || cleanRawId === "perimeter" || cleanLabel.includes("perimeter") || cleanLabel.includes("girth")) &&
        (tId.includes("perimeter") || tId.includes("girth") || tName.includes("perimeter") || tName.includes("girth"))
      ) {
        return true;
      }

      return false;
    });
  };

  const isFieldHighlighted = (id: string, label?: string) => {
    if (!highlightedTargetId) return "";
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    const cleanHighlightRaw = cleanHighlight.replace(/^(field-|card-|metric-)/, "");
    const cleanId = id.toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-|metric-)/, "");

    if (
      cleanHighlight === cleanId ||
      cleanHighlight === `field-${cleanId}` ||
      cleanHighlight === `card-${cleanId}` ||
      cleanHighlight === `metric-${cleanId}` ||
      cleanHighlightRaw === cleanRawId
    ) {
      return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
    }

    if (label && cleanHighlightRaw.length > 2) {
      const cleanLabel = label.toLowerCase();
      if (cleanLabel.includes(cleanHighlightRaw) || cleanHighlightRaw.includes(cleanLabel)) {
        return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";
      }
    }

    if (
      (cleanRawId === "targetfr" || cleanRawId === "target_fr") &&
      (cleanHighlightRaw.includes("fr") || cleanHighlightRaw.includes("friction"))
    ) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";

    if (
      (cleanRawId === "airflow") &&
      (cleanHighlightRaw.includes("air") || cleanHighlightRaw.includes("flow") || cleanHighlightRaw.includes("cfm") || cleanHighlightRaw.includes("lps"))
    ) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";

    if (
      (cleanRawId === "ductshape") &&
      (cleanHighlightRaw.includes("shape") || cleanHighlightRaw.includes("round") || cleanHighlightRaw.includes("rect"))
    ) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";

    if (
      (cleanRawId === "aspectratio") &&
      (cleanHighlightRaw.includes("aspect") || cleanHighlightRaw.includes("ratio"))
    ) return "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light";

    return "";
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id, name);
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
  const handleUnitSystemChange = (nextSystem: "ip" | "si") => {
    if (isLocked) return;
    setUnitSystem(nextSystem);
    dirtyStore.set(true);
    toast.info(`Switched units to ${nextSystem === "si" ? "Metric (SI)" : "Imperial (IP)"}`);
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

  const flowInputClass = "w-full h-9 px-3 mt-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-[#0A7BC7] disabled:bg-transparent disabled:border-transparent disabled:shadow-none disabled:pl-0 disabled:opacity-100 disabled:text-foreground disabled:text-base";

  return (
    <AppShell
      title="Duct Sizer"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-hidden h-full">
          
          {/* Header Bar matching Pump Sizing / Heating Load */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
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
                {/* Tab Switcher: Duct Sizer / Report Preview */}
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("solver")}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "solver"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Duct Sizer
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
                  title="View Formula Breakdown & SMACNA Equations"
                >
                  <Info className="size-3.5 text-primary" /> Formula Breakdown
                </TBtn>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-2">
                <TBtn onClick={exportPdf} title="Export PDF Report">
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 pr-3 custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
              {tab === "solver" ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT COLUMN: PARAMETER INPUTS (lg:col-span-5) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div
                      id="card-params"
                      data-field-id="card-params"
                      data-comment-target="card-params"
                      className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-4 ${isFieldHighlighted("card-params", "Sizing Parameters")}`}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                        <span className="text-[12.5px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                          📥 SIZING PARAMETERS
                        </span>
                        {renderCommentBadge("card-params", "Sizing Parameters")}
                      </div>

                      {/* Preset Profile Dropdown inside Parameters Table */}
                      <div className="space-y-1 pb-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                            Application Preset Profile
                          </label>
                          {renderCommentBadge("preset", "Duct Application Preset")}
                        </div>
                        <div
                          id="field-preset"
                          data-comment-target="preset"
                          className={`w-full transition-all ${
                            isFieldHighlighted("preset", "Duct Application Preset")
                          }`}
                        >
                          <DuctPresetSelect
                            value={preset}
                            customProfileName={customProfileName}
                            onChange={handleApplyPreset}
                            onOpenCustomModal={() => setCustomModalOpen(true)}
                            unitSystem={unitSystem}
                            disabled={isEffectiveReadOnly}
                          />
                        </div>
                      </div>

                      {/* Input 1: Airflow Q */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                Airflow (Q) ({isSI ? "L/s" : "CFM"})
                              </label>
                              {renderCommentBadge("airflow", "Airflow (Q)")}
                            </div>
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
                              className={flowInputClass}
                              placeholder={isSI ? "e.g. 1180" : "e.g. 2500"}
                            />
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                          <ContextMenuItem onClick={() => handleCopyValue("Airflow", isSI ? `${Math.round(Number(airflow || 0) * CFM_TO_LPS)} L/s` : `${airflow} CFM`)}>
                            <Copy className="size-3.5 mr-2 text-muted-foreground" /> Copy Airflow Value
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handlePasteValue("Airflow", "airflow")}>
                            <Clipboard className="size-3.5 mr-2 text-muted-foreground" /> Paste Value
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem onClick={() => {
                            const defQ = DUCT_PRESETS[preset]?.airflow || 2500;
                            handleResetField("Airflow", "airflow", defQ);
                          }}>
                            <RotateCcw className="size-3.5 mr-2 text-muted-foreground" /> Reset to Default
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleOpenComment("airflow", "Airflow (Q)")} className="text-primary font-medium">
                            <MessageSquare className="size-3.5 mr-2" /> Add Comment / Assign Task
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 2: Target Friction Rate */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center">
                              <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                Target Friction Rate ({isSI ? "Pa/m" : "in w.g./100ft"})
                              </label>
                              {renderCommentBadge("targetFr", "Target Friction Rate")}
                            </div>
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
                              className={flowInputClass}
                              placeholder={isSI ? "e.g. 0.65" : "e.g. 0.08"}
                            />
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                          <ContextMenuItem onClick={() => handleCopyValue("Target Friction Rate", isSI ? `${(Number(targetFr || 0) * INWG_TO_PAM).toFixed(2)} Pa/m` : `${targetFr} in.wg/100ft`)}>
                            <Copy className="size-3.5 mr-2 text-muted-foreground" /> Copy Friction Rate Target
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handlePasteValue("Target Friction Rate", "targetFr")}>
                            <Clipboard className="size-3.5 mr-2 text-muted-foreground" /> Paste Value
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem onClick={() => {
                            const defFr = DUCT_PRESETS[preset]?.targetFr || 0.08;
                            handleResetField("Target Friction Rate", "targetFr", defFr);
                          }}>
                            <RotateCcw className="size-3.5 mr-2 text-muted-foreground" /> Reset to Default
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleOpenComment("targetFr", "Target Friction Rate")} className="text-primary font-medium">
                            <MessageSquare className="size-3.5 mr-2" /> Add Comment / Assign Task
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 3: Duct Cross-Section Shape */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                            <div className="flex justify-between items-center">
                              <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                Duct Cross-Section Shape
                              </label>
                              {renderCommentBadge("ductShape", "Duct Shape")}
                            </div>
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
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                          <ContextMenuItem onClick={() => { setDuctShape("round"); dirtyStore.set(true); }}>
                            <Cylinder className="size-3.5 mr-2 text-primary" /> Select Round Spiral Duct
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => { setDuctShape("rect"); dirtyStore.set(true); }}>
                            <Layers className="size-3.5 mr-2 text-primary" /> Select Rectangular Duct
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem onClick={() => handleOpenComment("ductShape", "Duct Shape")} className="text-primary font-medium">
                            <MessageSquare className="size-3.5 mr-2" /> Add Comment / Assign Task
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Input 4: Aspect Ratio */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className={`space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800 ${ductShape === "round" ? "opacity-75" : ""}`}>
                            <div className="flex justify-between items-center">
                              <label className="text-[11.5px] font-semibold text-slate-700 dark:text-zinc-300">
                                Aspect Ratio (W:H)
                              </label>
                              <span className="text-[10.5px] font-mono text-primary font-bold">
                                {ductShape === "round" ? "1.0:1 (Fixed)" : `${aspectRatio.toFixed(1)}:1`}
                              </span>
                            </div>
                            <select
                              disabled={isEffectiveReadOnly || ductShape === "round"}
                              value={ductShape === "round" ? 1.0 : aspectRatio}
                              onChange={(e) => { setAspectRatio(Number(e.target.value)); dirtyStore.set(true); }}
                              className="w-full h-9 px-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold focus:outline-none focus:border-primary text-slate-800 dark:text-zinc-200 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-zinc-800/50 disabled:text-slate-400 dark:disabled:text-zinc-500"
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
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                          <ContextMenuItem onClick={() => handleOpenComment("aspectRatio", "Aspect Ratio")} className="text-primary font-medium">
                            <MessageSquare className="size-3.5 mr-2" /> Add Comment / Assign Task
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: RESULTS - STICKY PANEL (lg:col-span-7) */}
                  <div className="lg:col-span-7 lg:sticky lg:top-0 space-y-4">
                    
                    {/* PRIMARY SIZING RESULTS CARD (MATCHING PUMP SIZING REFERENCE) */}
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          id="card-hero-results"
                          data-comment-target="hero-results"
                          onDoubleClick={() => setFormulaModalOpen(true)}
                          title="Double-click to view SMACNA formula breakdown"
                          className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-5 cursor-pointer transition-colors ${
                            isFieldHighlighted("hero-results", "Recommended Duct Sizing") || isFieldHighlighted("card-hero-results") || isFieldHighlighted("card-aerodynamics")
                              ? "ring-2 ring-primary border-primary shadow-sm bg-primary/5 animate-pulse-light"
                              : ""
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

                          {/* DISPLAY STAT CARDS (Single Unified Clean Color Design) */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Recommended Size</div>
                              <div className="text-xl font-bold font-mono text-primary tracking-tight">
                                {calcResults.sizeDisplay}
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Air Velocity</div>
                              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                                {isSI ? `${calcResults.velocityMs.toFixed(2)}` : `${Math.round(calcResults.velocityFpm)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "m/s" : "FPM"}</span>
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Friction Loss</div>
                              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                                {isSI ? `${calcResults.actualFrPaM.toFixed(2)}` : `${calcResults.actualFrInWg.toFixed(3)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "Pa/m" : "in/100ft"}</span>
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 space-y-1">
                              <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Equiv. Dia (Deq)</div>
                              <div className="text-xl font-bold font-mono text-foreground tracking-tight">
                                {isSI ? `${Math.round(calcResults.deqMm)}` : `${calcResults.deqIn.toFixed(1)}`} <span className="text-xs font-normal text-muted-foreground">{isSI ? "mm" : "in"}</span>
                              </div>
                            </div>
                          </div>

                          {/* DETAILED AERODYNAMIC METRICS TABLE (Matching Pump Sizing) */}
                          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
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
                      <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px]">
                        <ContextMenuItem onClick={() => setFormulaModalOpen(true)} className="text-primary font-medium">
                          <Eye className="size-3.5 mr-2" /> View Formula Breakdown
                        </ContextMenuItem>
                        <ContextMenuSeparator className="h-px bg-border my-1" />
                        <ContextMenuItem onClick={() => handleOpenComment("hero-results", "Recommended Duct Sizing")} className="text-primary font-medium">
                          <MessageSquare className="size-3.5 mr-2" /> Add Comment / Assign Task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                  </div>
                </div>
              ) : (
                /* Report View Tab */
                <div className="h-full max-h-full overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6 max-w-4xl mx-auto w-full pb-16">
                  <div className="flex items-center justify-between pb-3 border-b border-border gap-2 flex-wrap">
                    <div>
                      <h2 className="text-base font-bold text-foreground">HVAC Duct Sizing Engineering Report</h2>
                      <p className="text-xs text-muted-foreground">Equal friction design summary for air distribution and duct fabrication.</p>
                    </div>
                    <TBtn onClick={exportPdf}>
                      <Printer className="size-3.5" /> Print / Export PDF
                    </TBtn>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Project & Sizing Criteria</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Project Name</span>
                        <strong className="text-foreground">{project?.name || "MEP Study"}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Design Standard</span>
                        <strong className="text-foreground">SMACNA / ASHRAE Equal Friction</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Application Profile</span>
                        <strong className="text-foreground">{customProfileName || "Commercial Office"}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Unit System</span>
                        <strong className="text-foreground">{unitSystem.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Results Table Card */}
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Recommended Sizing & Aerodynamics</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border bg-surface-2 text-muted-foreground font-bold">
                            <th className="p-2.5">Parameter</th>
                            <th className="p-2.5">Calculated Value</th>
                            <th className="p-2.5">Unit</th>
                            <th className="p-2.5">Reference / Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          <tr>
                            <td className="p-2.5 font-bold">Design Airflow (Q)</td>
                            <td className="p-2.5 font-mono">{isSI ? Math.round(calcResults.qLps) : calcResults.qCfm}</td>
                            <td className="p-2.5">{isSI ? "L/s" : "CFM"}</td>
                            <td className="p-2.5 text-muted-foreground">Specified HVAC Design Duty</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Target Friction Rate</td>
                            <td className="p-2.5 font-mono">{isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}</td>
                            <td className="p-2.5">{isSI ? "Pa/m" : "in.wg/100ft"}</td>
                            <td className="p-2.5 text-muted-foreground">Equal Friction Design Basis</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Selected Duct Geometry</td>
                            <td className="p-2.5 font-mono font-bold text-primary">{calcResults.sizeDisplay}</td>
                            <td className="p-2.5">{calcResults.ductShape === "round" ? "NPS" : "W × H"}</td>
                            <td className="p-2.5 text-muted-foreground">{calcResults.sizeFullText}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Equivalent Circular Diameter (Deq)</td>
                            <td className="p-2.5 font-mono">{isSI ? `${Math.round(calcResults.deqMm)} mm` : `${calcResults.deqIn.toFixed(1)}"`}</td>
                            <td className="p-2.5">{isSI ? "mm" : "inches"}</td>
                            <td className="p-2.5 text-muted-foreground">Huebscher Equation</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Hydraulic Diameter (Dh)</td>
                            <td className="p-2.5 font-mono">{isSI ? `${Math.round(calcResults.hydraulicDiaMm)} mm` : `${calcResults.hydraulicDiaIn.toFixed(1)}"`}</td>
                            <td className="p-2.5">{isSI ? "mm" : "inches"}</td>
                            <td className="p-2.5 text-muted-foreground">Dh = 4A / P</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Cross-Section Area</td>
                            <td className="p-2.5 font-mono">{isSI ? `${calcResults.areaM2.toFixed(3)} m²` : `${calcResults.areaSqFt.toFixed(2)} sq.ft`}</td>
                            <td className="p-2.5">{isSI ? "m²" : "sq.ft"}</td>
                            <td className="p-2.5 text-muted-foreground">Effective Internal Net Area</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Mean Flow Velocity</td>
                            <td className="p-2.5 font-mono font-bold text-primary">{isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`}</td>
                            <td className="p-2.5">{isSI ? "m/s" : "FPM"}</td>
                            <td className="p-2.5 text-muted-foreground">Complies with standard acoustic velocity limits</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Velocity Pressure (Pv)</td>
                            <td className="p-2.5 font-mono">{isSI ? calcResults.velPressPa.toFixed(1) : calcResults.velPressInWg.toFixed(4)}</td>
                            <td className="p-2.5">{isSI ? "Pa" : "in.wg"}</td>
                            <td className="p-2.5 text-muted-foreground">Dynamic velocity pressure component</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Reynolds Number (Re)</td>
                            <td className="p-2.5 font-mono">{Math.round(calcResults.reynolds).toLocaleString()}</td>
                            <td className="p-2.5">-</td>
                            <td className="p-2.5 text-muted-foreground">{calcResults.flowRegime}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Darcy Friction Factor (f)</td>
                            <td className="p-2.5 font-mono">{calcResults.frictionFactor.toFixed(5)}</td>
                            <td className="p-2.5">-</td>
                            <td className="p-2.5 text-muted-foreground">Iterative Colebrook solution</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. Compliance & Diagnostic Verification */}
                  {warnings.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-xs">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">3. Compliance & Diagnostic Verification</h3>
                      <div className="space-y-2">
                        {warnings.map((w, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
                              w.type === "warning"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                                : w.type === "info"
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-800 dark:text-blue-300"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                            }`}
                          >
                            {w.type === "warning" ? (
                              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                            ) : w.type === "info" ? (
                              <Info className="size-4 shrink-0 mt-0.5 text-blue-600" />
                            ) : (
                              <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                            )}
                            <span>{w.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Airflow & Friction Performance Analysis */}
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="size-3.5 text-blue-500" /> 4. Airflow & Friction Performance Analysis
                      </h3>
                      <span className="text-[10.5px] font-mono font-semibold text-muted-foreground">
                        Target: {isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}
                      </span>
                    </div>

                    {(() => {
                      const actualFr = isSI ? calcResults.actualFrPaM : calcResults.actualFrInWg;
                      const targetFrVal = isSI ? calcResults.targetFrPaM : calcResults.targetFrInWg;
                      const uFr = isSI ? "Pa/m" : "in.wg";

                      const vel = isSI ? calcResults.velocityMs : calcResults.velocityFpm;
                      const maxVel = isSI ? 12.7 : 2500;
                      const uVel = isSI ? "m/s" : "FPM";

                      const bars = [
                        { label: "Target Friction Rate", val: targetFrVal, max: Math.max(actualFr, targetFrVal) * 1.25, display: `${targetFrVal.toFixed(isSI ? 2 : 3)} ${uFr}`, color: "#3B82F6" },
                        { label: "Actual Friction Loss", val: actualFr, max: Math.max(actualFr, targetFrVal) * 1.25, display: `${actualFr.toFixed(isSI ? 3 : 4)} ${uFr}`, color: "#10B981" },
                        { label: "Air Velocity vs SMACNA Limit", val: vel, max: maxVel * 1.2, display: `${isSI ? vel.toFixed(2) : Math.round(vel)} ${uVel} (Max: ${maxVel} ${uVel})`, color: vel > maxVel ? "#EF4444" : "#F59E0B" },
                      ];

                      return (
                        <div className="space-y-3 text-xs">
                          {bars.map((b, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-[11px]">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
                                  {b.label}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {b.display}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(3, (b.val / (b.max || 1)) * 100))}%`,
                                    backgroundColor: b.color,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 5. Verification & Sign-off */}
                  <div className="pt-2 space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">5. Verification & Sign-off</h3>
                    {(() => {
                      const sig = getSignatureBlockDetails(project?.id || "default", "/duct-sizer", currentUserName, calcReviewState);
                      return (
                        <div className="border border-border rounded-xl overflow-hidden text-[12px]">
                          <div className="grid grid-cols-4 bg-[#FFE6CC] dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-border text-center">
                            <div className="p-2 border-r border-border"></div>
                            <div className="p-2 border-r border-border">Originator (Design Eng.)</div>
                            <div className="p-2 border-r border-border">Reviewer (Sr. Eng.)</div>
                            <div className="p-2">Approver (Coord.)</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                            <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Name:</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.originatedName || currentUserName || "Design Engineer"}</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.reviewerName || "-"}</div>
                            <div className="p-2.5 font-medium text-foreground">{sig.approverName || "-"}</div>
                          </div>
                          <div className="grid grid-cols-4 divide-x divide-border text-center">
                            <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Date:</div>
                            <div className="p-2.5 text-muted-foreground">{sig.originatedDate || formatDateStr(new Date().toISOString())}</div>
                            <div className="p-2.5 text-muted-foreground">{sig.reviewerDate || "-"}</div>
                            <div className="p-2.5 text-muted-foreground">{sig.approverDate || "-"}</div>
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

        {/* Collapsible Intelligence Drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
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
              commentsList={commentsList}
              onOpenComment={handleOpenComment}
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
          targetType="Duct Parameter"
          category="Duct Sizer"
          calculatorTitle="Duct Sizer"
          calculatorPath="/duct-sizer"
          existingComments={getItemComments(commentTargetItem.id)}
          initialComments={getItemComments(commentTargetItem.id)}
          comments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
          onSaveComment={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

// SUB-COMPONENT: FORMULA BREAKDOWN & CALCULATION PREVIEW MODAL
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
  if (!open) return null;
  const isSI = unitSystem === "si";
  const [activeTab, setActiveTab] = React.useState<"preview" | "formulas">("preview");

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2/50">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Calculation Step-by-Step Preview &amp; SMACNA Formulas
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Tab Controls */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-card border-b border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "preview"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="size-3.5" />
            <span>Calculation Preview (Step-by-Step Trace)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulas")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "formulas"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="size-3.5" />
            <span>SMACNA &amp; ASHRAE Master Formulas</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs custom-scrollbar">
          {activeTab === "preview" ? (
            <div className="space-y-4">
              
              {/* Input Parameters Summary Banner */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span className="uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> Live Input Parameters
                  </span>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {isSI ? "SI Units" : "IP Units"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px] font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Airflow (Q):</span>
                    <strong>{isSI ? `${Math.round(calcResults.qLps)} L/s` : `${calcResults.qCfm} CFM`}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Target Friction:</span>
                    <strong>{isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Duct Shape:</span>
                    <strong>{calcResults.ductShape === "round" ? "Round Spiral" : "Rectangular"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Aspect Ratio:</span>
                    <strong>{calcResults.ductShape === "rect" ? `${calcResults.aspectRatio.toFixed(1)}:1` : "1.0:1"}</strong>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Calculation Steps */}
              
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 1: Volumetric Airflow Conversion (Q)</span>
                  <span className="text-[10px] text-muted-foreground">Standard Fluid Mechanics</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>Q_m³/s = Q_CFM × 4.71947 × 10⁻⁴</div>
                  <div className="text-primary font-bold">
                    Q = {calcResults.qCfm} CFM × 0.000471947 = {qM3s.toFixed(4)} m³/s ({Math.round(calcResults.qLps)} L/s)
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 2: Recommended Sizing &amp; Geometry ({calcResults.sizeDisplay})</span>
                  <span className="text-[10px] text-muted-foreground">Equal Friction Numerical Solution</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>Circular Equivalent Target Diameter: D_eq = {(calcResults.exactDiameterMm).toFixed(1)} mm ({calcResults.exactDiameterIn.toFixed(2)} in.)</div>
                  {calcResults.ductShape === "rect" ? (
                    <>
                      <div>Huebscher Rectangular Sizing (Aspect Ratio {calcResults.aspectRatio.toFixed(1)}:1):</div>
                      <div>W_exact = {(calcResults.selectedWidthMm).toFixed(0)} mm | H_exact = {(calcResults.selectedHeightMm).toFixed(0)} mm</div>
                      <div className="text-primary font-bold">
                        Selected Standard Duct: {calcResults.sizeDisplay} ({calcResults.sizeFullText})
                      </div>
                    </>
                  ) : (
                    <div className="text-primary font-bold">
                      Selected Standard Spiral Duct: {calcResults.sizeDisplay} ({calcResults.sizeFullText})
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 3: Internal Net Cross-Sectional Area (A)</span>
                  <span className="text-[10px] text-muted-foreground">Geometry Calculation</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  {calcResults.ductShape === "rect" ? (
                    <div>A = Width × Height = {(calcResults.selectedWidthMm / 1000).toFixed(3)} m × {(calcResults.selectedHeightMm / 1000).toFixed(3)} m</div>
                  ) : (
                    <div>A = (π / 4) × D² = (π / 4) × {(calcResults.selectedWidthMm / 1000).toFixed(3)}²</div>
                  )}
                  <div className="text-primary font-bold">
                    A = {areaM2.toFixed(4)} m² ({calcResults.areaSqFt.toFixed(2)} sq.ft)
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 4: Air Flow Velocity (V)</span>
                  <span className="text-[10px] text-muted-foreground">Continuity Equation</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>V = Q / A = {qM3s.toFixed(4)} m³/s / {areaM2.toFixed(4)} m²</div>
                  <div className="text-primary font-bold">
                    V = {velMs.toFixed(2)} m/s ({Math.round(calcResults.velocityFpm)} FPM) — Status: {calcResults.flowRegime}
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 5: Hydraulic Diameter (Dh) &amp; Duct Girth (P)</span>
                  <span className="text-[10px] text-muted-foreground">Hydraulic Perimeter</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>Perimeter: P = 2(W + H) = 2({(calcResults.selectedWidthMm/1000).toFixed(3)} + {(calcResults.selectedHeightMm/1000).toFixed(3)}) = {perimM.toFixed(2)} m ({calcResults.perimeterIn.toFixed(1)} in.)</div>
                  <div>Hydraulic Diameter: D_h = 4A / P = 4({areaM2.toFixed(4)}) / {perimM.toFixed(2)} = {dhM.toFixed(4)} m</div>
                  <div className="text-primary font-bold">
                    D_h = {Math.round(calcResults.hydraulicDiaMm)} mm ({calcResults.hydraulicDiaIn.toFixed(1)} in.) | D_eq = {Math.round(calcResults.deqMm)} mm ({calcResults.deqIn.toFixed(1)} in.)
                  </div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 6: Reynolds Number (Re)</span>
                  <span className="text-[10px] text-muted-foreground">Fluid Regime Dynamics</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>Re = (ρ · V · D_h) / μ = (1.204 × {velMs.toFixed(2)} × {dhM.toFixed(4)}) / 1.81 × 10⁻⁵</div>
                  <div className="text-primary font-bold">
                    Re = {Math.round(re).toLocaleString()} ({re > 4000 ? "Fully Turbulent Flow" : "Laminar / Transitional"})
                  </div>
                </div>
              </div>

              {/* Step 7 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 7: Colebrook Darcy Friction Factor (f)</span>
                  <span className="text-[10px] text-muted-foreground">Iterative Roughness (ε = 0.09mm)</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>1 / √f = -2 · log₁₀ [ (0.00009 / (3.7 × {dhM.toFixed(4)})) + (2.51 / ({Math.round(re)} × √f)) ]</div>
                  <div className="text-primary font-bold">
                    Solved Friction Factor f = {fFactor.toFixed(5)}
                  </div>
                </div>
              </div>

              {/* Step 8 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 8: Actual Achieved Friction Loss Rate (ΔP / L)</span>
                  <span className="text-[10px] text-muted-foreground">Darcy-Weisbach Formulation</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>ΔP / L = (f · ρ · V²) / (2 · D_h) = ({fFactor.toFixed(5)} × 1.204 × {velMs.toFixed(2)}²) / (2 × {dhM.toFixed(4)})</div>
                  <div className="text-primary font-bold">
                    Actual Loss Rate = {actFrPaM.toFixed(3)} Pa/m ({actFrInWg.toFixed(4)} in.wg/100ft) vs Target {isSI ? `${calcResults.targetFrPaM.toFixed(2)} Pa/m` : `${calcResults.targetFrInWg.toFixed(3)} in.wg`}
                  </div>
                </div>
              </div>

              {/* Step 9 */}
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-foreground flex items-center justify-between">
                  <span className="text-primary font-mono text-[11px]">Step 9: Dynamic Velocity Pressure (Pv)</span>
                  <span className="text-[10px] text-muted-foreground">Dynamic Head Component</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] space-y-1">
                  <div>{isSI ? `Pv = 0.5 · ρ · V² = 0.5 × 1.204 × (${velMs.toFixed(2)})²` : `Pv = (V / 4005)² = (${Math.round(calcResults.velocityFpm)} / 4005)²`}</div>
                  <div className="text-primary font-bold">
                    Velocity Pressure Pv = {isSI ? `${velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Tab 2: Master Equations Registry */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>1. Colebrook-White Darcy Friction Factor (f)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Turbulent Aerodynamics</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                  1 / √f = -2 · log₁₀ [ (ε / (3.7 · D_h)) + (2.51 / (Re · √f)) ]
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Where absolute roughness ε = 0.00009 m (0.09 mm) for standard galvanized sheet metal. Solved iteratively via numerical Newton-Raphson convergence.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>2. Huebscher Circular Equivalent (Deq)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">ASHRAE Standard</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                  D_eq = 1.30 · [ (a · b)^0.625 / (a + b)^0.25 ]
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Provides the identical friction loss and volumetric flow capacity for a rectangular duct of dimensions a × b as an equivalent circular duct.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>3. Hydraulic Diameter (Dh) &amp; Duct Perimeter (P)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Geometry</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                  D_h = 4 · A / P = 4 · (a · b) / [ 2 · (a + b) ]
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Hydraulic diameter represents equivalent diameter based on cross-section area to wetted perimeter ratio.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>4. Velocity Pressure (Pv)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Dynamic Head</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                  {isSI ? "Pv = 0.5 · ρ · V² (Pa)" : "Pv = ( V / 4005 )² (in. w.g.)"}
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Calculated dynamically using standard air density ρ = 1.204 kg/m³ at sea level (20°C / 68°F).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>5. Darcy-Weisbach Friction Loss Rate (ΔP / L)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Pressure Drop</span>
                </div>
                <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                  ΔP / L = (f · ρ · V²) / (2 · D_h)
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Calculates actual friction pressure loss rate per meter or per 100 ft length of duct.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                <div className="font-bold text-primary flex items-center justify-between">
                  <span>6. SMACNA Acoustic Limits &amp; Aspect Ratio Guidelines</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Comfort Standard</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  - <strong>Velocity Limit:</strong> Max 2,000 FPM (10.2 m/s) for quiet commercial main trunks, max 2,500 FPM (12.7 m/s) for industrial/risers.<br />
                  - <strong>Aspect Ratio Limit:</strong> Preferred W:H ≤ 2:1 for low fabrication weight; maximum recommended W:H ≤ 4:1.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border flex justify-end bg-surface-2">
          <TBtn onClick={onClose} className="text-xs">Close Breakdown</TBtn>
        </div>
      </div>
    </div>
  );
}

// SUB-COMPONENT: LIVE INTELLIGENCE DRAWER
function DuctSizerIntelligenceDrawer({
  onClose,
  calcResults,
  preset,
  onSelectPreset,
  isEffectiveReadOnly,
  unitSystem,
  onNavigateToField,
  commentsList = [],
  onOpenComment,
}: {
  onClose: () => void;
  calcResults: any;
  preset: DuctPresetKey;
  onSelectPreset: (key: DuctPresetKey) => void;
  isEffectiveReadOnly: boolean;
  unitSystem: "ip" | "si";
  onNavigateToField: (id: string) => void;
  commentsList?: any[];
  onOpenComment?: (id: string, name: string) => void;
}) {
  const isSI = unitSystem === "si";
  const vel = calcResults.velocityFpm;
  const isHighVelocity = vel > 2200;
  const isOptimalVelocity = vel >= 800 && vel <= 1800;

  return (
    <div className="flex flex-col h-full bg-card select-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-extrabold text-xs tracking-tight text-foreground">Duct Sizer Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
        {commentsList && commentsList.length > 0 && (
          <div className="p-3.5 rounded-xl border bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                <span>Active Comments & Tasks ({commentsList.length})</span>
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {commentsList.map((c, idx) => (
                <div
                  key={c.id || idx}
                  onClick={() => {
                    const target = c.targetId || c.spaceId || c.itemId;
                    if (target) onNavigateToField(target);
                  }}
                  className="p-2 rounded-lg bg-background border border-border/70 hover:border-primary/50 transition cursor-pointer text-xs group"
                >
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground mb-0.5">
                    <span className="text-foreground group-hover:text-primary transition-colors font-semibold">
                      {c.targetName || c.spaceName || "Duct Parameter"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{c.authorName || "Engineer"}</span>
                  </div>
                  <p className="text-[11px] text-foreground/90 line-clamp-2 leading-relaxed">{c.text}</p>
                  {onOpenComment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenComment(c.targetId || c.spaceId || c.itemId || "duct-sizer", c.targetName || c.spaceName || "Duct Parameter");
                      }}
                      className="mt-1.5 text-[10.5px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View / Reply</span>
                      <ArrowRight className="size-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-xl border bg-surface-2/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Velocity Diagnostic</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isHighVelocity
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : isOptimalVelocity
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
            >
              {isHighVelocity ? "High Velocity" : isOptimalVelocity ? "Acoustic Compliant" : "Moderate Flow"}
            </span>
          </div>

          <div className="text-xl font-black font-mono text-foreground">
            {isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {isHighVelocity
              ? "Velocity exceeds standard low-noise SMACNA criteria (< 2,000 FPM). Consider widening duct or increasing diameter."
              : isOptimalVelocity
              ? "Operates within ideal SMACNA & ASHRAE quiet duct design range with minimal regenerated noise."
              : "Flow velocity is within acceptable standard operating ranges."}
          </p>

          <button
            type="button"
            onClick={() => onNavigateToField("field-airflow")}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer pt-1"
          >
            <span>Jump to Airflow Parameter</span>
            <ArrowRight className="size-3" />
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Standard Application Presets
          </span>
          <div className="space-y-1.5">
            {[
              { key: "commercial_office_main", label: "Commercial Office Main", flow: "2500 CFM", fr: "0.08 in.wg" },
              { key: "retail_branch_duct", label: "Retail Branch Duct", flow: "1200 CFM", fr: "0.10 in.wg" },
              { key: "hotel_guestroom_riser", label: "Hotel Guestroom Riser", flow: "800 CFM", fr: "0.06 in.wg" },
              { key: "kitchen_exhaust_duct", label: "Kitchen Exhaust Duct", flow: "3500 CFM", fr: "0.15 in.wg" },
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
        </div>

        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-primary font-bold text-[11.5px]">
            <Lightbulb className="size-3.5" />
            <span>Engineering Advisory</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Aspect ratio should ideally remain ≤ 2:1 for low fabrication costs. Ratios exceeding 4:1 require internal reinforcing rods per SMACNA HVAC Duct Construction Standards.
          </p>
        </div>
      </div>
    </div>
  );
}
