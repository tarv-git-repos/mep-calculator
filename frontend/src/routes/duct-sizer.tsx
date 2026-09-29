import { calculateDuctSize, calculateSMACNAWarnings, colebrook, CFM_TO_LPS, LPS_TO_CFM, INWG_TO_PAM, PAM_TO_INWG, FPM_TO_MPS, MPS_TO_FPM, IN_TO_MM, MM_TO_IN } from "@/lib/calc-duct-sizer";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportDuctSizerPDF } from "@/lib/exportDuctSizerPDF";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight,
  SlidersHorizontal, Wind, Maximize2, BookOpen, Lightbulb, Building2, Store, Hotel, Utensils, Factory
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

// Conversion Constants


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

  // Calculation review state listener
  

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

      // Comprehensive comments aggregation (calculator storage + project state + user coordination notifications)
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

        // 1. Calculator specific comments storage
        addList(localStorage.getItem(`mep_calc_comments_${pId}_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_${pId}_duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_/duct-sizer`));
        addList(localStorage.getItem(`mep_calc_comments_default_duct-sizer`));

        // 2. Project workspace saved comments
        if (savedData && Array.isArray(savedData.comments)) {
          savedData.comments.forEach((c: any) => { if (c && c.id) commentsMap.set(c.id, c); });
        }

        // 3. Persistent notification queues
        addList(localStorage.getItem("mep_persistent_user_notifs"));
        addList(localStorage.getItem("mep_calc_coord_notifs"));
        if (uId) addList(localStorage.getItem(`mep_persistent_user_notifs_${uId}`));
        if (uEmail) addList(localStorage.getItem(`mep_persistent_user_notifs_${uEmail}`));
        if (uName) addList(localStorage.getItem(`mep_persistent_user_notifs_${uName}`));

        // 4. Scan all localStorage keys for any user queues or comments
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

  // Real-time synchronization of comments across tabs/windows and notification center
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

  // Deep-linking scroll to target item handler (Matching Ventilation & Sewage Pump exactly)
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

  // Listen to URL parameters on route change (like ventilation.tsx)
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

      // Direct exact match
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

      // Check if target name matches cleanLabel or cleanId
      if (cleanLabel && (tName.includes(cleanLabel) || cleanLabel.includes(tName))) {
        return true;
      }
      if (tName && cleanRawId && (tName.includes(cleanRawId) || cleanRawId.includes(tName))) {
        return true;
      }

      // Specific alias matching for Target Friction Rate
      if (
        (cleanRawId === "targetfr" || cleanRawId === "target_fr" || cleanRawId === "friction" || cleanRawId === "frictionrate" || cleanLabel.includes("friction") || cleanLabel.includes("target fr")) &&
        (tId.includes("targetfr") || tId.includes("target_fr") || tId.includes("friction") || tId.includes("fr") || tName.includes("friction") || tName.includes("target fr") || tName.includes("in w.g.") || tName.includes("pa/m"))
      ) {
        return true;
      }

      // Specific alias matching for Design Airflow
      if (
        (cleanRawId === "airflow" || cleanRawId === "air_flow" || cleanRawId === "q" || cleanRawId === "flow" || cleanLabel.includes("airflow") || cleanLabel.includes("flow")) &&
        (tId.includes("air") || tId.includes("flow") || tId.includes("cfm") || tId.includes("lps") || tName.includes("airflow") || tName.includes("air flow") || tName.includes("cfm") || tName.includes("l/s"))
      ) {
        return true;
      }

      // Specific alias matching for Duct Shape
      if (
        (cleanRawId === "ductshape" || cleanRawId === "duct_shape" || cleanRawId === "shape" || cleanLabel.includes("shape")) &&
        (tId.includes("shape") || tId.includes("round") || tId.includes("rect") || tName.includes("shape") || tName.includes("cross-section") || tName.includes("round") || tName.includes("rect"))
      ) {
        return true;
      }

      // Specific alias matching for Aspect Ratio
      if (
        (cleanRawId === "aspectratio" || cleanRawId === "aspect_ratio" || cleanRawId === "ratio" || cleanLabel.includes("aspect")) &&
        (tId.includes("aspect") || tId.includes("ratio") || tName.includes("aspect") || tName.includes("ratio"))
      ) {
        return true;
      }

      // Specific alias matching for Hero Recommended Size
      if (
        (cleanRawId === "hero-size" || cleanRawId === "size" || cleanRawId === "recommend" || cleanLabel.includes("recommended")) &&
        (tId.includes("hero") || tId.includes("size") || tId.includes("recommend") || tName.includes("recommend") || tName.includes("duct sizing") || tName.includes("size"))
      ) {
        return true;
      }

      // Specific alias matching for card parameters
      if (
        (cleanRawId === "card-params" || cleanRawId === "params" || cleanLabel.includes("sizing parameters")) &&
        (tId.includes("param") || tName.includes("sizing parameter") || tName.includes("parameters"))
      ) {
        return true;
      }

      // Specific alias matching for acoustic limits card
      if (
        (cleanRawId === "card-acoustic-limits" || cleanRawId === "acoustic-limits" || cleanRawId === "acoustic" || cleanLabel.includes("acoustic")) &&
        (tId.includes("acoustic") || tName.includes("acoustic") || tName.includes("smacna acoustic"))
      ) {
        return true;
      }

      // Specific alias matching for individual metric cards
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
    if (!highlightedTargetId) return false;
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
      return true;
    }

    if (label && cleanHighlightRaw.length > 2) {
      const cleanLabel = label.toLowerCase();
      if (cleanLabel.includes(cleanHighlightRaw) || cleanHighlightRaw.includes(cleanLabel)) {
        return true;
      }
    }

    // Specific aliases for highlight
    if (
      (cleanRawId === "targetfr" || cleanRawId === "target_fr") &&
      (cleanHighlightRaw.includes("fr") || cleanHighlightRaw.includes("friction"))
    ) return true;

    if (
      (cleanRawId === "airflow") &&
      (cleanHighlightRaw.includes("air") || cleanHighlightRaw.includes("flow") || cleanHighlightRaw.includes("cfm") || cleanHighlightRaw.includes("lps"))
    ) return true;

    if (
      (cleanRawId === "ductshape") &&
      (cleanHighlightRaw.includes("shape") || cleanHighlightRaw.includes("round") || cleanHighlightRaw.includes("rect"))
    ) return true;

    if (
      (cleanRawId === "aspectratio") &&
      (cleanHighlightRaw.includes("aspect") || cleanHighlightRaw.includes("ratio"))
    ) return true;

    return false;
  };

  const renderCommentBadge = (id: string, name: string) => {
    const itemComments = getItemComments(id, name);
    if (itemComments.length === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(id, name);
        }}
        title={`${itemComments.length} comment(s)/task(s) on ${name}`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 dark:hover:bg-blue-900 transition cursor-pointer shadow-xs select-none border border-blue-300/60 dark:border-blue-700/60 shrink-0"
      >
        <MessageSquare className="size-3.5 fill-blue-500/25 text-blue-600 dark:text-blue-400" />
        <span className="text-[10.5px] font-extrabold">{itemComments.length}</span>
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

  // ==========================================
  // AERODYNAMIC & DUCT EQUAL FRICTION CALCS
  // ==========================================
  const calcResults = useMemo(() => {
    const qCfm = typeof airflow === "number" && airflow > 0 ? airflow : 2500;
    const frInWg = typeof targetFr === "number" && targetFr > 0 ? targetFr : 0.08;
    const AR = typeof aspectRatio === "number" && aspectRatio >= 1 ? aspectRatio : 1.5;

    // Airflow Q in m³/s
    const Q = qCfm * 4.71947e-4;
    const frPaM = frInWg * INWG_TO_PAM;
    const rho = 1.204; // kg/m³ standard air density
    const mu = 1.81e-5; // Pa·s dynamic viscosity
    const eps = 0.00009; // m absolute roughness for galvanized steel sheet (0.09 mm)

    // 1. Iteratively solve circular equivalent diameter for target friction rate
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
      // Standard Round Duct Sizes (inches & mm)
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
      // Rectangular Duct: Huebscher Equivalent Diameter Formulation:
      // De = 1.30 * ( (a*b)^0.625 / (a+b)^0.25 )
      // With b = a / AR => De = 1.30 * ( (a^2/AR)^0.625 / (a*(1 + 1/AR))^0.25 )
      //                       = 1.30 * a^1.25 / (AR^0.625 * a^0.25 * (1 + 1/AR)^0.25)
      //                       = 1.30 * a / (AR^0.625 * ((AR+1)/AR)^0.25)
      //                       = 1.30 * a * AR^(0.25 - 0.625) / (AR+1)^0.25
      //                       = 1.30 * a / (AR^0.375 * (AR+1)^0.25)
      // => a = De * (AR^0.375 * (AR+1)^0.25) / 1.30
      const numeratorFactor = Math.pow(AR, 0.375) * Math.pow(AR + 1, 0.25);
      const exactWidthIn = (exactDiameterIn * numeratorFactor) / 1.30;
      const exactHeightIn = exactWidthIn / AR;

      // Round width and height to nearest even integer (inches) or 25mm (SI)
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

      // Equivalent circular diameter Deq from Huebscher
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

  // ==========================================
  // EXPORT TO PDF REPORT (Exact Ventilation Standard)
  // ==========================================
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

  return (
    <AppShell
      title="Duct Sizer"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Top Page Header (Matching Ventilation Layout) */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Duct Sizer</h1>
                <span className="text-[14px] font-semibold text-muted-foreground">{calcResults.sizeDisplay}</span>
              </div>

              {/* Intelligence Trigger Button */}
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

              {/* 3-Tier Approval Workflow Bar */}
              <CalculationReviewBar
                projectId={project?.id || "default"}
                calculatorPath="/duct-sizer"
                calculatorTitle="Duct Sizer"
              />

              {/* Active Tasks & Comments Badge */}
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

          {/* White Card Container for Tabs & Data Grid (Matching Ventilation and Sewage Pump) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector Subheader Toolbar Row */}
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
                    Duct Sizer
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
                  title="View SMACNA & ASHRAE Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Duct Application Preset Dropdown (Clean layout with comment badge support) */}
                <div
                  id="field-preset"
                  data-comment-target="preset"
                  className={`flex items-center gap-1.5 rounded-xl transition-all ${
                    isFieldHighlighted("preset", "Duct Application Preset")
                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse p-1 ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-950/40"
                      : ""
                  }`}
                >
                  <DuctPresetSelect
                    value={preset}
                    customProfileName={customProfileName}
                    onChange={handleApplyPreset}
                    onOpenCustomModal={() => setCustomModalOpen(true)}
                    unitSystem={unitSystem}
                    disabled={isLocked}
                  />
                  {renderCommentBadge("preset", "Duct Application Preset")}
                </div>
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
                  disabled={isLocked}
                  inputDescriptions="Airflow (CFM / L/s), Target Friction Rate (in.wg/100ft / Pa/m), Duct Dimensions (inches / mm)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 2,500 CFM → 1,180 L/s, 0.08 in.wg → 0.65 Pa/m"
                      : "Convert 1,180 L/s → 2,500 CFM, 0.65 Pa/m → 0.08 in.wg"
                  }
                />
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {tab === "solver" ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                  
                  {/* Main Grid: Parameters (Left) & Aerodynamic Results (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: SIZING PARAMETERS */}
                    <div className="lg:col-span-5 space-y-5">
                      
                      {/* CARD: SIZING PARAMETERS */}
                      <div
                        id="card-params"
                        data-comment-target="card-params"
                        className={`bg-background border rounded-2xl shadow-xs p-5 space-y-4 transition-all duration-300 ${
                          isFieldHighlighted("card-params", "Sizing Parameters")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                              <Wind className="size-4 text-primary" /> Sizing Parameters
                            </span>
                            {renderCommentBadge("card-params", "Sizing Parameters")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                            SMACNA / Equal Friction
                          </span>
                        </div>

                        <div className="space-y-3.5 text-xs">
                          {/* Airflow Q */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-airflow"
                                data-comment-target="airflow"
                                onDoubleClick={() => {
                                  const defQ = DUCT_PRESETS[preset]?.airflow || 2500;
                                  handleResetField("Airflow", "airflow", defQ);
                                }}
                                title="Double-click to reset to preset default, Right-click for options"
                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                  isFieldHighlighted("airflow", "Design Airflow")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    <span>Airflow (Q) ({isSI ? "L/s" : "CFM"})</span>
                                  </label>
                                  {renderCommentBadge("airflow", "Design Airflow")}
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    disabled={isLocked}
                                    value={isSI && typeof airflow === "number" ? Math.round(airflow * CFM_TO_LPS) : airflow}
                                    onChange={(e) => {
                                      const num = parseFloat(e.target.value) || 0;
                                      setAirflow(isSI ? num * LPS_TO_CFM : num);
                                      dirtyStore.set(true);
                                    }}
                                    placeholder={isSI ? "1180" : "2500"}
                                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary font-mono text-foreground disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Airflow", isSI ? `${Math.round(Number(airflow || 0) * CFM_TO_LPS)} L/s` : `${airflow} CFM`)}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Airflow Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handlePasteValue("Airflow", "airflow")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => {
                                  const defQ = DUCT_PRESETS[preset]?.airflow || 2500;
                                  handleResetField("Airflow", "airflow", defQ);
                                }}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${Math.round((DUCT_PRESETS[preset]?.airflow || 2500) * CFM_TO_LPS)} L/s` : `${DUCT_PRESETS[preset]?.airflow || 2500} CFM`})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleClearField("Airflow", "airflow")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg text-amber-600 dark:text-amber-400"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => setCustomModalOpen(true)}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <SlidersHorizontal className="size-3.5 text-primary" />
                                <span>Custom Configuration...</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleOpenComment("airflow", "Design Airflow")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Target Friction Rate */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-targetFr"
                                data-comment-target="targetFr"
                                onDoubleClick={() => {
                                  const defFr = DUCT_PRESETS[preset]?.targetFr || 0.08;
                                  handleResetField("Target Friction Rate", "targetFr", defFr);
                                }}
                                title="Double-click to reset to preset default, Right-click for options"
                                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                                  isFieldHighlighted("targetFr", "Target Friction Rate")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    <span>Target Friction Rate ({isSI ? "Pa/m" : "in w.g./100ft"})</span>
                                  </label>
                                  {renderCommentBadge("targetFr", "Target Friction Rate")}
                                </div>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    disabled={isLocked}
                                    value={isSI && typeof targetFr === "number" ? Number((targetFr * INWG_TO_PAM).toFixed(2)) : targetFr}
                                    onChange={(e) => {
                                      const num = parseFloat(e.target.value) || 0;
                                      setTargetFr(isSI ? num * PAM_TO_INWG : num);
                                      dirtyStore.set(true);
                                    }}
                                    placeholder={isSI ? "0.65" : "0.08"}
                                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-primary font-mono text-foreground disabled:opacity-60"
                                  />
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Target Friction Rate", isSI ? `${(Number(targetFr || 0) * INWG_TO_PAM).toFixed(2)} Pa/m` : `${targetFr} in.wg/100ft`)}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Friction Rate Target</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handlePasteValue("Target Friction Rate", "targetFr")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Clipboard className="size-3.5 text-muted-foreground" />
                                <span>Paste Value</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => {
                                  const defFr = DUCT_PRESETS[preset]?.targetFr || 0.08;
                                  handleResetField("Target Friction Rate", "targetFr", defFr);
                                }}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <RotateCcw className="size-3.5 text-muted-foreground" />
                                <span>Reset to Default ({isSI ? `${((DUCT_PRESETS[preset]?.targetFr || 0.08) * INWG_TO_PAM).toFixed(2)} Pa/m` : `${DUCT_PRESETS[preset]?.targetFr || 0.08} in.wg`})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleClearField("Target Friction Rate", "targetFr")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg text-amber-600 dark:text-amber-400"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear Field</span>
                                <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => setCustomModalOpen(true)}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <SlidersHorizontal className="size-3.5 text-primary" />
                                <span>Custom Configuration...</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleOpenComment("targetFr", "Target Friction Rate")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Duct Shape */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="field-ductShape"
                                data-comment-target="ductShape"
                                onDoubleClick={handleToggleDuctShape}
                                title="Double-click to toggle between Round and Rectangular, Right-click for options"
                                className={`p-3 rounded-xl border space-y-2 cursor-pointer transition ${
                                  isFieldHighlighted("ductShape", "Duct Shape")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                    : "border-border/60 bg-muted/10 hover:border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold text-muted-foreground block cursor-pointer">
                                    Duct Cross-Section Shape
                                  </label>
                                  {renderCommentBadge("ductShape", "Duct Shape")}
                                </div>
                                <div className="flex bg-surface p-1 rounded-xl gap-1 border border-border/80 select-none">
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => { setDuctShape("round"); dirtyStore.set(true); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                                      ductShape === "round"
                                        ? "bg-primary text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Round Spiral
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => { setDuctShape("rect"); dirtyStore.set(true); }}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                                      ductShape === "rect"
                                        ? "bg-primary text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    Rectangular
                                  </button>
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                              <ContextMenuItem
                                onClick={() => { setDuctShape("round"); dirtyStore.set(true); toast.info("Selected Round Spiral Duct"); }}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Cylinder className="size-3.5 text-primary" />
                                <span>Select Round Spiral Duct</span>
                                {ductShape === "round" && <Check className="size-3.5 text-primary ml-auto" />}
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => { setDuctShape("rect"); dirtyStore.set(true); toast.info("Selected Rectangular Duct"); }}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <Layers className="size-3.5 text-primary" />
                                <span>Select Rectangular Duct</span>
                                {ductShape === "rect" && <Check className="size-3.5 text-primary ml-auto" />}
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => setCustomModalOpen(true)}
                                className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                              >
                                <SlidersHorizontal className="size-3.5 text-primary" />
                                <span>Custom Configuration...</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => handleOpenComment("ductShape", "Duct Shape")}
                                className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment / Assign Task</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Aspect Ratio (if rectangular) */}
                          {ductShape === "rect" && (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  id="field-aspectRatio"
                                  data-comment-target="aspectRatio"
                                  onDoubleClick={handleCycleAspectRatio}
                                  title="Double-click to cycle standard aspect ratios (1.0 -> 1.5 -> 2.0 -> 3.0 -> 4.0), Right-click for options"
                                  className={`p-3 rounded-xl border space-y-1.5 cursor-pointer transition ${
                                    isFieldHighlighted("aspectRatio", "Aspect Ratio")
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "border-border/60 bg-muted/10 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-muted-foreground flex items-center justify-between gap-2 cursor-pointer">
                                      <span>Aspect Ratio (W:H)</span>
                                      <span className="text-[10px] font-mono text-primary font-bold">{aspectRatio.toFixed(1)}:1</span>
                                    </label>
                                    {renderCommentBadge("aspectRatio", "Aspect Ratio")}
                                  </div>
                                  <select
                                    disabled={isLocked}
                                    value={aspectRatio}
                                    onChange={(e) => { setAspectRatio(Number(e.target.value)); dirtyStore.set(true); }}
                                    className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-primary text-foreground disabled:opacity-60 cursor-pointer"
                                  >
                                    <option value="1.0">1:1 - Square Duct</option>
                                    <option value="1.5">1.5:1 - Low Profile (Standard)</option>
                                    <option value="2.0">2:1 - Medium Aspect</option>
                                    <option value="3.0">3:1 - Flat / Ceiling Clearance</option>
                                    <option value="4.0">4:1 - Maximum Recommended</option>
                                  </select>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                                {[
                                  { val: 1.0, label: "1:1 - Square Duct" },
                                  { val: 1.5, label: "1.5:1 - Low Profile (Standard)" },
                                  { val: 2.0, label: "2:1 - Medium Aspect" },
                                  { val: 3.0, label: "3:1 - Flat / Ceiling Clearance" },
                                  { val: 4.0, label: "4:1 - Maximum Recommended" },
                                ].map((opt) => (
                                  <ContextMenuItem
                                    key={opt.val}
                                    onClick={() => { setAspectRatio(opt.val); dirtyStore.set(true); toast.info(`Aspect ratio set to ${opt.label}`); }}
                                    className="flex items-center justify-between p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                                  >
                                    <span>{opt.label}</span>
                                    {aspectRatio === opt.val && <Check className="size-3.5 text-primary ml-2" />}
                                  </ContextMenuItem>
                                ))}
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment("aspectRatio", "Aspect Ratio")}
                                  className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: SIZING RESULTS & AERODYNAMICS */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* Hero Recommended Size Card */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-hero-size"
                            data-comment-target="hero-size"
                            onDoubleClick={() => setFormulaModalOpen(true)}
                            title="Double-click to view SMACNA formula breakdown, Right-click for options"
                            className={`border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer transition group ${
                              isFieldHighlighted("hero-size", "Recommended Duct Sizing") || isFieldHighlighted("card-hero-size")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : "bg-primary/5 border-primary/20 hover:border-primary/40 hover:bg-primary/8"
                            }`}
                          >
                            <div className="space-y-1 text-center sm:text-left">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <span>Recommended Duct Sizing</span>
                                {renderCommentBadge("hero-size", "Recommended Duct Sizing")}
                              </span>
                              <div className="text-2xl sm:text-3xl font-black text-foreground font-mono group-hover:text-primary transition-colors">
                                {calcResults.sizeDisplay}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {calcResults.sizeFullText}
                              </p>
                            </div>
                            <div className="flex flex-col items-center sm:items-end gap-1 shrink-0">
                              <div className="text-xs font-semibold text-muted-foreground">Air Velocity</div>
                              <div className="text-lg font-extrabold text-primary font-mono">
                                {isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`}
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                {calcResults.flowRegime}
                              </span>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-64 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Recommended Duct Size", calcResults.sizeDisplay)}
                            className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copy Recommended Size ({calcResults.sizeDisplay})</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleCopyValue("Air Velocity", isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`)}
                            className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                          >
                            <Gauge className="size-3.5 text-muted-foreground" />
                            <span>Copy Air Velocity</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              const fullSummary = `HVAC Duct Sizing Result: Size=${calcResults.sizeDisplay} (${calcResults.sizeFullText}), Velocity=${isSI ? calcResults.velocityMs.toFixed(2) + " m/s" : Math.round(calcResults.velocityFpm) + " FPM"}, Actual Friction=${isSI ? calcResults.actualFrPaM.toFixed(3) + " Pa/m" : calcResults.actualFrInWg.toFixed(4) + " in.wg/100ft"}, Dynamic Pv=${isSI ? calcResults.velPressPa.toFixed(1) + " Pa" : calcResults.velPressInWg.toFixed(4) + " in.wg"}`;
                              handleCopyValue("Engineering Summary", fullSummary);
                            }}
                            className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                          >
                            <FileText className="size-3.5 text-muted-foreground" />
                            <span>Copy Full Engineering Summary</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="h-px bg-border my-1" />
                          <ContextMenuItem
                            onClick={() => setFormulaModalOpen(true)}
                            className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                          >
                            <BookOpen className="size-3.5 text-primary" />
                            <span>SMACNA Formula Breakdown...</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleOpenComment("hero-size", "Recommended Duct Sizing")}
                            className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Add Comment / Assign Task</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Warnings & SMACNA Diagnostics */}
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

                      {/* Detailed Aerodynamic Results Grid */}
                      <div
                        id="card-aerodynamics"
                        data-comment-target="aerodynamics"
                        className={`bg-card border rounded-2xl p-5 space-y-4 shadow-xs transition-all ${
                          isFieldHighlighted("card-aerodynamics", "Aerodynamic & Hydraulic Performance") || isFieldHighlighted("card-results")
                            ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                            : "border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-primary rounded-full" />
                            <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide">
                              Aerodynamic & Hydraulic Performance
                            </span>
                            {renderCommentBadge("card-aerodynamics", "Aerodynamic & Hydraulic Performance")}
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-surface-2 text-muted-foreground">
                            Colebrook-White Solution
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-sans text-xs">
                          {[
                            {
                              id: "metric-velocity",
                              label: "Air Velocity",
                              valFormatted: isSI ? `${calcResults.velocityMs.toFixed(2)} m/s` : `${Math.round(calcResults.velocityFpm)} FPM`,
                              isPrimary: false,
                            },
                            {
                              id: "metric-friction",
                              label: "Actual Friction Loss",
                              valFormatted: isSI ? `${calcResults.actualFrPaM.toFixed(3)} Pa/m` : `${calcResults.actualFrInWg.toFixed(4)} in/100ft`,
                              isPrimary: true,
                            },
                            {
                              id: "metric-velpress",
                              label: "Velocity Pressure (Pv)",
                              valFormatted: isSI ? `${calcResults.velPressPa.toFixed(1)} Pa` : `${calcResults.velPressInWg.toFixed(4)} in.wg`,
                              isPrimary: false,
                            },
                            {
                              id: "metric-deq",
                              label: "Equivalent Circular Dia",
                              valFormatted: isSI ? `${Math.round(calcResults.deqMm)} mm` : `${calcResults.deqIn.toFixed(1)}" NPS`,
                              isPrimary: false,
                            },
                            {
                              id: "metric-dh",
                              label: "Hydraulic Diameter (Dh)",
                              valFormatted: isSI ? `${Math.round(calcResults.hydraulicDiaMm)} mm` : `${calcResults.hydraulicDiaIn.toFixed(1)}" NPS`,
                              isPrimary: false,
                            },
                            {
                              id: "metric-area",
                              label: "Cross-Section Area",
                              valFormatted: isSI ? `${calcResults.areaM2.toFixed(3)} m²` : `${calcResults.areaSqFt.toFixed(2)} sq.ft`,
                              isPrimary: false,
                            },
                            {
                              id: "metric-reynolds",
                              label: "Reynolds Number",
                              valFormatted: Math.round(calcResults.reynolds).toLocaleString(),
                              isPrimary: false,
                            },
                            {
                              id: "metric-darcy",
                              label: "Darcy Friction Factor (f)",
                              valFormatted: calcResults.frictionFactor.toFixed(5),
                              isPrimary: false,
                            },
                            {
                              id: "metric-perimeter",
                              label: "Duct Girth / Perimeter",
                              valFormatted: isSI ? `${calcResults.perimeterM.toFixed(2)} m` : `${calcResults.perimeterIn.toFixed(1)} in.`,
                              isPrimary: false,
                            },
                          ].map((item) => (
                            <ContextMenu key={item.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  id={item.id}
                                  data-comment-target={item.id}
                                  onDoubleClick={() => setFormulaModalOpen(true)}
                                  title="Double-click for formula breakdown, Right-click to copy"
                                  className={`p-2.5 rounded-xl border flex flex-col gap-0.5 cursor-pointer transition group ${
                                    isFieldHighlighted(item.id, item.label)
                                      ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20"
                                      : "bg-surface-2/60 border-border/50 hover:border-border hover:bg-surface-2"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] font-semibold text-muted-foreground">{item.label}</span>
                                    {renderCommentBadge(item.id, item.label)}
                                  </div>
                                  <strong className={`font-mono text-sm font-bold ${item.isPrimary ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"}`}>
                                    {item.valFormatted}
                                  </strong>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                                <ContextMenuItem
                                  onClick={() => handleCopyValue(item.label, item.valFormatted)}
                                  className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                                >
                                  <Copy className="size-3.5 text-muted-foreground" />
                                  <span>Copy {item.label}</span>
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => setFormulaModalOpen(true)}
                                  className="flex items-center gap-2 p-1.5 cursor-pointer font-medium hover:bg-accent rounded-lg"
                                >
                                  <BookOpen className="size-3.5 text-primary" />
                                  <span>View Formula Breakdown...</span>
                                </ContextMenuItem>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onClick={() => handleOpenComment(item.id, item.label)}
                                  className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Add Comment / Assign Task</span>
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </div>
                      </div>

                      {/* Velocity vs SMACNA Limits Chart */}
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            id="card-acoustic-limits"
                            data-comment-target="acoustic-limits"
                            className={`flex flex-col gap-2 p-4 border rounded-2xl select-none transition cursor-pointer ${
                              isFieldHighlighted("card-acoustic-limits", "Acoustic Limits") || isFieldHighlighted("acoustic-limits")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                                : "bg-surface-2/50 border-border hover:border-border/80"
                            }`}
                          >
                            <div className="flex items-center justify-between pb-1 border-b border-border/50">
                              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Air Velocity vs Recommended SMACNA Acoustic Limits
                              </h4>
                              {renderCommentBadge("card-acoustic-limits", "SMACNA Acoustic Limits")}
                            </div>
                            {(() => {
                              const vel = isSI ? calcResults.velocityMs : calcResults.velocityFpm;
                              const vMax = isSI ? 12.7 : 2500;
                              const vMin = isSI ? 2.0 : 400;
                              const u = isSI ? "m/s" : "FPM";

                              const bars = [
                                { label: "Actual Velocity", value: vel, color: vel > vMax ? "#EF4444" : "#0A7BC7", display: `${isSI ? vel.toFixed(2) : Math.round(vel)} ${u}` },
                                { label: "Max Main Trunk", value: vMax, color: "#64748B", display: `${vMax} ${u}` },
                                { label: "Min Capture Limit", value: vMin, color: "#94A3B8", display: `${vMin} ${u}` },
                              ];

                              const W = 500, H = 130, PL = 120, PR = 20, PT = 15, PB = 15;
                              const CW = W - PL - PR, CH = H - PT - PB;
                              const maxVal = Math.max(...bars.map(b => b.value)) * 1.25 || 1;

                              return (
                                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible mt-2">
                                  {bars.map((b, i) => {
                                    const bw = CH / bars.length;
                                    const barH = bw * 0.55;
                                    const y = PT + i * bw + (bw - barH) / 2;
                                    const barW = (b.value / maxVal) * CW;
                                    return (
                                      <g key={i}>
                                        <text x={PL - 8} y={y + barH / 2 + 3.5} textAnchor="end" fontSize="9.5" fontWeight="700" fill="currentColor" className="text-foreground font-sans">
                                          {b.label}
                                        </text>
                                        <rect x={PL} y={y} width={Math.max(3, barW)} height={barH} fill={b.color} rx="3" />
                                        <text x={PL + barW + 6} y={y + barH / 2 + 3.5} textAnchor="start" fontSize="9.5" fontWeight="800" fill={b.color} className="font-mono">
                                          {b.display}
                                        </text>
                                      </g>
                                    );
                                  })}
                                  <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="currentColor" strokeWidth="1" className="text-border" />
                                </svg>
                              );
                            })()}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-60 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs text-popover-foreground z-50 animate-in fade-in zoom-in-95 duration-100">
                          <ContextMenuItem
                            onClick={() => handleOpenComment("card-acoustic-limits", "SMACNA Acoustic Limits")}
                            className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg"
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
                /* Report View Tab */
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 custom-scrollbar space-y-6 max-w-4xl mx-auto w-full pb-12">
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
                            <td className="p-2.5 font-bold">Equivalent Circular Dia (Deq)</td>
                            <td className="p-2.5 font-mono">{isSI ? Math.round(calcResults.deqMm) : calcResults.deqIn.toFixed(1)}</td>
                            <td className="p-2.5">{isSI ? "mm" : "in."}</td>
                            <td className="p-2.5 text-muted-foreground">Huebscher empirical formulation</td>
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

                  {/* 3-Tier Signature Block */}
                  <div className="pt-2">
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

// ==========================================
// SUB-COMPONENT: FORMULA BREAKDOWN MODAL
// ==========================================
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">SMACNA &amp; ASHRAE Equal Friction Sizing Formulations</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans custom-scrollbar">
          {/* 1. Colebrook-White Formulation */}
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

          {/* 2. Huebscher Equivalent Diameter */}
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

          {/* 3. Velocity Pressure */}
          <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2">
            <div className="font-bold text-primary flex items-center justify-between">
              <span>3. Velocity Pressure (Pv)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10">Dynamic Head</span>
            </div>
            <div className="p-2.5 rounded bg-background border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
              {isSI ? "Pv = 0.5 · ρ · V² (Pa)" : "Pv = ( V / 4005 )² (in. w.g.)"}
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Calculated dynamically using standard air density ρ = 1.204 kg/m³ at sea level (20°C / 68°F).
            </p>
          </div>
        </div>

        <div className="p-3 border-t border-border flex justify-end bg-surface-2">
          <TBtn onClick={onClose} className="text-xs">Close</TBtn>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENT: LIVE INTELLIGENCE DRAWER
// ==========================================
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
      {/* Drawer Header */}
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

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar">
        {/* Active Comments & Tasks */}
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

        {/* Aerodynamic Status Diagnostic Card */}
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

        {/* Quick Application Presets */}
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

        {/* SMACNA Engineering Advisories */}
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
