// NFPA 20 Fire Pump Duty Calculation Module
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  FileText,
  Sparkles,
  MessageSquare,
  Info,
  CheckCircle2,
  Lock,
  Flame,
  Layers,
  Copy,
  Clipboard,
  X,
  Box,
  ChevronRight,
  Gauge,
  Zap,
  Activity,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Fuel,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { RowCommentCornerBadge } from "@/components/workspace/RowCommentCornerBadge";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { exportFirePumpDutyPDF } from "@/lib/exportFirePumpDutyPDF";
import {
  GPM_TO_LPS,
  GPM_TO_LMIN,
  PSI_TO_BAR,
  PSI_TO_KPA,
  PSI_TO_M,
  FT_TO_M,
  HP_TO_KW,
  NFPA_STANDARD_PUMP_SIZES,
  STANDARD_MOTOR_HP,
  getRecommendedPipeSizes,
  type FirePumpParams,
  DEFAULT_PARAMS,
  type PumpPreset,
  PUMP_PRESETS,
  computeFirePumpCalculations
} from "@/lib/calc-plumbing-fire-pump-duty";

import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";

export const Route = createFileRoute("/plumbing-fire-pump-duty")({
  head: () => ({
    meta: [
      { title: "Fire Pump Duty Calculator — MEP Calc" },
      {
        name: "description",
        content:
          "Calculate fire pump rated flow, head, churn pressure, motor sizing, and jockey pump parameters per NFPA 20.",
      },
    ],
  }),
  component: FirePumpDutyPage,
});

function FirePumpDutyPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-fire-pump-duty", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-fire-pump-duty", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/plumbing-fire-pump-duty", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";


  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP: GPM, psi, ft, HP / SI: L/s, bar, m, kW)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");

  // Core Inputs
  const [params, setParams] = useState<FirePumpParams>(DEFAULT_PARAMS);

  // Comments and Task Assignment state
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    try {
      const pId = project.id;
      const storageKey = `mep_fire_pump_duty_calc_${project.id}`;
      const stored = localStorage.getItem(storageKey);
      let loadedParams = DEFAULT_PARAMS;

      let savedData: any = null;
      if (project.workspace_data) {
        const wdata =
          typeof project.workspace_data === "string"
            ? JSON.parse(project.workspace_data)
            : project.workspace_data;
        savedData = wdata?.fire_pump_duty || wdata?.fire_pump || wdata?.plumbing_fire_pump;
      }

      const commentsMap = new Map<string, any>();
      const storedComments =
        localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-fire-pump-duty`) ||
        localStorage.getItem(`mep_calc_comments_${pId}_plumbing-fire-pump-duty`);
      if (storedComments) {
        try {
          const parsed = JSON.parse(storedComments);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: any) => {
              if (c && c.id) commentsMap.set(c.id, c);
            });
          }
        } catch (e) {}
      }

      if (savedData && Array.isArray(savedData.comments)) {
        savedData.comments.forEach((c: any) => {
          if (c && c.id) commentsMap.set(c.id, c);
        });
      }

      try {
        const uId = profile?.id || userData?.id;
        const notifKeys = [
          "mep_persistent_user_notifs",
          "mep_calc_coord_notifs",
          uId ? `mep_notifs_user_${uId}` : null,
        ].filter(Boolean);

        notifKeys.forEach((k) => {
          if (!k) return;
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                parsed.forEach((item: any) => {
                  const path = item.calculatorPath || item.calcPath || "";
                  const matchPath =
                    path === "/plumbing-fire-pump-duty" ||
                    path === "plumbing-fire-pump-duty" ||
                    path.includes("fire-pump");
                  const matchProj =
                    !item.projectId || item.projectId === pId || item.projectId === "default";
                  if (matchPath && matchProj && item.id) {
                    commentsMap.set(item.id, item);
                  }
                });
              }
            } catch (e) {}
          }
        });
      } catch (e) {}

      setCommentsList(Array.from(commentsMap.values()));

      if (savedData?.params) {
        loadedParams = { ...DEFAULT_PARAMS, ...savedData.params };
      } else if (stored) {
        const data = JSON.parse(stored);
        if (data.fpFlow !== undefined) {
          loadedParams = {
            fpFlow: data.fpFlow ?? 500,
            fpPress: data.fpPress ?? 100,
            fpDisch: data.fpDisch ?? 5,
            fpSuct: data.fpSuct ?? 0,
            fpEff: data.fpEff ?? 70,
            fpSafetyMargin: data.fpSafetyMargin ?? 3,
            driverType: data.driverType || "electric",
            jockeyFlowPct: data.jockeyFlowPct ?? 2,
            jockeyPressureMargin: data.jockeyPressureMargin ?? 10,
          };
        }
      }

      setParams(loadedParams);
      setLoadedProjectId(project.id);
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load fire pump duty calculation state", e);
    }
  }, [project?.id, profile?.id, userData?.id]);

  // Persist state to localStorage on modification
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    try {
      const storageKey = `mep_fire_pump_duty_calc_${project.id}`;
      localStorage.setItem(storageKey, JSON.stringify(params));
      dirtyStore.set(true);
    } catch (e) {
      console.error("Error saving fire pump duty calculation", e);
    }
  }, [project?.id, loadedProjectId, params]);

  // Copy/Paste/Reset/Clear helpers for Context Menu
  const handleCopyValue = (label: string, val: any) => {
    navigator.clipboard.writeText(String(val));
    toast.success(`Copied ${label} value to clipboard`);
  };

  const handlePasteValue = async (label: string, setter: (val: any) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      const num = parseFloat(text);
      if (!isNaN(num)) {
        setter(num);
        dirtyStore.set(true);
        toast.success(`Pasted ${label}: ${num}`);
      } else {
        toast.error("Clipboard does not contain a valid number");
      }
    } catch (err) {
      toast.error("Failed to read clipboard");
    }
  };

  const handleResetValue = (label: string, setter: (val: any) => void, defaultVal: any) => {
    setter(defaultVal);
    dirtyStore.set(true);
    toast.info(`Reset ${label} to default (${defaultVal})`);
  };

  const handleClearValue = (label: string, setter: (val: any) => void) => {
    setter("");
    dirtyStore.set(true);
    toast.info(`Cleared ${label}`);
  };

  // Scroll and highlight notification target item (matching Sewage Pump & Ventilation exactly)
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
                 document.getElementById(`res-${cleanRaw}`) ||
                 document.getElementById(`res-${targetId}`) ||
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
        handleScrollTarget(detail.id || detail.targetId || detail.targetItemId, detail.name || detail.targetName || detail.targetItemName);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);
    window.addEventListener("mep_scroll_to_comment_target", handleScrollEvent);
    window.addEventListener("mep_notification_click" as any, handleScrollEvent);
    window.addEventListener("mep_highlight_target" as any, handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollEvent);
      window.removeEventListener("mep_notification_click" as any, handleScrollEvent);
      window.removeEventListener("mep_highlight_target" as any, handleScrollEvent);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [typeof window !== "undefined" ? window.location.search : ""]);

  const updateParam = <K extends keyof FirePumpParams>(key: K, value: FirePumpParams[K]) => {
    if (isEffectiveReadOnly) return;
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleUnitSystemChange = (newSys: "ip" | "si") => {
    if (newSys === unitSystem) return;
    setUnitSystem(newSys);
  };

  const handleResetDefaults = () => {
    if (isEffectiveReadOnly) return;
    setParams(DEFAULT_PARAMS);
    toast.info("Fire pump parameters reset to NFPA 20 standard defaults.");
  };

  // Calculations
  const results = useMemo(() => {
    return computeFirePumpCalculations(params);
  }, [params]);

  // Comments Management (matching Sewage Pump & Ventilation exactly)
  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(
      `mep_calc_comments_${pId}_/plumbing-fire-pump-duty`,
      JSON.stringify(newList)
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({
            type: "COMMENTS_UPDATED",
            calcPath: "/plumbing-fire-pump-duty",
            count: newList.length,
          });
          bc.close();
        } catch (e) {}
      }
    }
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || commentData?.targetId || commentData?.spaceId || commentData?.itemId || "fpFlow";
    const targetName = commentTargetItem?.name || commentData?.targetName || commentData?.spaceName || "Fire Pump Parameter";

    const commentWithMeta = {
      ...commentData,
      targetId,
      targetName,
      spaceId: targetId,
      spaceName: targetName,
      itemId: targetId,
      targetType: "Fire Pump Duty Parameter",
      calculatorTitle: "Fire Pump Duty",
      calculatorPath: "/plumbing-fire-pump-duty",
      projectId: project?.id || "default",
      projectName: project?.name || "Fire Suppression Station",
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

  const handleApplyPreset = (preset: PumpPreset) => {
    if (isEffectiveReadOnly) return;
    setParams((prev) => ({ ...prev, ...preset.params }));
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const getItemComments = (id: string) => {
    if (!id) return [];
    const clean = id.toLowerCase().trim();
    const cleanRaw = clean.replace(/^(field-|card-|res-)/, "");

    return commentsList.filter((c) => {
      if (!c) return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || c.targetItemId || "").toLowerCase().trim();
      const tIdRaw = tId.replace(/^(field-|card-|res-)/, "");

      if (
        tId === clean ||
        tId === `field-${clean}` ||
        `field-${tId}` === clean ||
        tId === `card-${clean}` ||
        `card-${tId}` === clean ||
        tId === `res-${clean}` ||
        `res-${tId}` === clean ||
        (cleanRaw && tIdRaw === cleanRaw)
      ) {
        return true;
      }

      const tName = String(c.targetName || c.spaceName || c.targetItemName || "").toLowerCase().trim();
      if (!tName) return false;

      if ((cleanRaw === "fpflow" || cleanRaw === "flow") && (tName.includes("flow") || tName.includes("demand flow") || tName.includes("required flow"))) return true;
      if ((cleanRaw === "fppress" || cleanRaw === "pressure") && (tName.includes("demand pressure") || tName.includes("system demand"))) return true;
      if ((cleanRaw === "fpdisch" || cleanRaw === "discharge") && (tName.includes("discharge") || tName.includes("piping loss"))) return true;
      if ((cleanRaw === "fpsuct" || cleanRaw === "suction") && (tName.includes("suction") || tName.includes("suction head"))) return true;
      if ((cleanRaw === "fpeff" || cleanRaw === "efficiency") && (tName.includes("pump efficiency") || tName.includes("efficiency"))) return true;
      if ((cleanRaw === "fpsafetymargin" || cleanRaw === "safetymargin") && (tName.includes("safety margin") || tName.includes("head margin"))) return true;
      if ((cleanRaw === "drivertype") && (tName.includes("driver") || tName.includes("electric motor") || tName.includes("diesel engine"))) return true;
      if ((cleanRaw === "jockeyflowpct" || cleanRaw === "jockeyflow") && (tName.includes("jockey flow") || tName.includes("jockey rating"))) return true;
      if ((cleanRaw === "jockeypressuremargin" || cleanRaw === "jockeymargin") && (tName.includes("cut-out head") || tName.includes("cut-out margin") || tName.includes("jockey margin"))) return true;
      if ((cleanRaw === "ratedflow" || cleanRaw === "res-ratedflow") && (tName.includes("rated flow") || tName.includes("standard size"))) return true;
      if ((cleanRaw === "ratedhead" || cleanRaw === "res-ratedhead") && (tName.includes("rated head") || tName.includes("total dynamic head"))) return true;
      if ((cleanRaw === "motorsizing" || cleanRaw === "res-motorsizing") && (tName.includes("motor sizing") || tName.includes("driver sizing") || tName.includes("brake power"))) return true;
      if ((cleanRaw === "churnpressure" || cleanRaw === "res-churnpressure") && (tName.includes("churn pressure") || tName.includes("shutoff pressure"))) return true;
      if ((cleanRaw === "card-parameters" || cleanRaw === "parameters") && (tName.includes("fire pump parameters") || tName.includes("parameters section"))) return true;
      if ((cleanRaw === "card-jockey" || cleanRaw === "jockey") && (tName.includes("jockey pump section") || tName.includes("pressure maintenance"))) return true;
      if ((cleanRaw === "card-curve" || cleanRaw === "curve") && (tName.includes("characteristic pump curve") || tName.includes("pump curve"))) return true;
      if ((cleanRaw === "card-ladder" || cleanRaw === "ladder") && (tName.includes("performance & pressure ladder") || tName.includes("pressure switch ladder"))) return true;

      return false;
    });
  };

  const isFieldHighlighted = (id: string, label?: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim();
    const cleanId = id.toLowerCase().trim();
    const cleanRawId = cleanId.replace(/^(field-|card-|res-)/, "");
    const cleanHighlightRaw = cleanHighlight.replace(/^(field-|card-|res-)/, "");

    if (
      cleanHighlight === cleanId ||
      cleanHighlight === `field-${cleanId}` ||
      cleanHighlight === `card-${cleanId}` ||
      cleanHighlight === `res-${cleanId}` ||
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
      <RowCommentCornerBadge
        count={itemComments.length}
        onClick={() => handleOpenComment(id, name)}
      />
    );
  };

  const renderParamField = (
    key: keyof FirePumpParams,
    id: string,
    label: string,
    unitIP: string,
    unitSI: string,
    min = 0,
    step = "1"
  ) => {
    const isSI = unitSystem === "si";
    const currentVal = params[key];
    const defaultVal = DEFAULT_PARAMS[key];
    const highlighted = isFieldHighlighted(id, label);

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-comment-target={id}
            data-item-id={id}
            data-field-id={id}
            className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all ${
              highlighted
                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25 z-20 font-bold"
                : "border-border/70 bg-card hover:border-border"
            }`}
          >
            {renderCommentBadge(id, label)}
            <div className="flex items-center justify-between">
              <label
                htmlFor={`input-${id}`}
                className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
              >
                {label}
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground px-1.5 py-0.2 bg-muted rounded">
                  {isSI ? unitSI : unitIP}
                </span>
              </div>
            </div>
            <input
              id={`input-${id}`}
              type="number"
              min={min}
              step={step}
              disabled={isEffectiveReadOnly}
              value={currentVal === "" ? "" : currentVal}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                updateParam(key, val as any);
                dirtyStore.set(true);
              }}
              className="w-full bg-background border border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-1.5 text-[13px] font-semibold text-foreground outline-none transition-all disabled:opacity-60"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, currentVal)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handlePasteValue(label, (v) => updateParam(key, v as any))}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handleResetValue(label, (v) => updateParam(key, v as any), defaultVal)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" />
            <span>Reset to Default ({defaultVal} {isSI ? unitSI : unitIP})</span>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handleClearValue(label, () => updateParam(key, "" as any))}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 text-destructive rounded-lg cursor-pointer font-medium disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            <span>Clear Field</span>
          </ContextMenuItem>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation matching Ventilation standards
  const exportPdf = async () => {
    await exportFirePumpDutyPDF(params, results, unitSystem, {
      userName: currentUserName,
      reviewState: calcReviewState,
    });
  };

  const isSI = unitSystem === "si";

  return (
    <AppShell
      title="Fire Pump Duty"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
    >
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-3 overflow-hidden h-full">
          {/* Top Page Header matching Ventilation standard */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-foreground">
                  Fire Pump Duty
                </h1>
                
              </div>
              <button
                type="button"
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
              <CalculationReviewBar
                projectId={project?.id || "default"}
                calculatorPath="/plumbing-fire-pump-duty"
                calculatorTitle="Fire Pump Duty"
              />
              {commentsList.length > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                  title={`${commentsList.length} active task(s)/comment(s)`}
                >
                  <MessageSquare className="size-3.5 fill-blue-500/20" />
                  <span>
                    {commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
          
            <div className="flex items-center gap-2 shrink-0">
              <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    disabled={isEffectiveReadOnly}
                    inputDescriptions="Flow (GPM / L/min), Head/Pressure (psi / bar), Power (HP / kW)"
                    conversionExample={
                      unitSystem === "ip"
                        ? "Convert 500 GPM @ 100 psi → 1,893 L/min @ 6.89 bar"
                        : "Convert 1,893 L/min @ 6.89 bar → 500 GPM @ 100 psi"
                    }
                  />
            </div>
          </div>

          {/* Main Card Container */}
          {/* Approved & Locked Status Banner */}
          {isApprovedLocked && (
            <div className="flex items-center justify-between p-3 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Lock className="size-4" />
                </div>
                <div>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    Calculation is APPROVED & LOCKED
                  </span>
                  <span className="text-emerald-700/80 dark:text-emerald-400/80 ml-1.5">
                    This Fire Pump Duty sheet is locked to protect engineering revision integrity.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                Approved
              </span>
            </div>
          )}

          <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
            <div
              className={`flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl transition-all duration-300 ${
                isApprovedLocked || calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              }`}
            >
              {/* Tabs Selector row & Action Toolbar */}
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-surface-2 p-0.5 rounded-full gap-1 border border-border/80">
                    <button
                      type="button"
                      onClick={() => setTab("solver")}
                      className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        tab === "solver"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Pump Duty Sizer
                    </button>
                    <button
                      type="button"
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
                    onClick={() => setFormulaModalOpen(true)}
                    className="px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                    title="View NFPA 20 Formulas & Curve Derivations"
                  >
                    <Info className="size-3.5 text-primary" />
                    <span>NFPA 20 Formulas</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    disabled={isEffectiveReadOnly}
                    className="px-3 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                    title="Reset to NFPA 20 Standard Defaults"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={exportPdf}>
                    <FileText className="size-3.5" /> Export
                  </TBtn>
                  
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {tab === "solver" ? (
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    {/* Warning Banners if applicable */}
                    {results.isHighChurn && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3 items-start">
                        <AlertTriangle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[13px] font-bold text-red-900 dark:text-red-200 mb-0.5">
                            High Churn (Shutoff) Pressure Alert: {results.churnPsi.toFixed(0)} psi (
                            {results.churnBar.toFixed(2)} bar)
                          </h4>
                          <p className="text-[12px] text-red-800 dark:text-red-300/90 leading-relaxed">
                            NFPA 20 & NFPA 13 require pressure relief valves (PRV) or variable speed
                            pressure limiting controls whenever shutoff pressure plus static suction
                            exceeds 175 psi (12.1 bar) or fitting ratings (Class 300 required).
                          </p>
                        </div>
                      </div>
                    )}

                    {results.isCavitationRisk && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                        <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-[13px] font-bold text-amber-900 dark:text-amber-200 mb-0.5">
                            Suction Lift / Cavitation Warning
                          </h4>
                          <p className="text-[12px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                            NFPA 20 requires positive suction head for fire pumps whenever possible.
                            Negative suction pressure requires vertical turbine pumps or specialized
                            priming tanks.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Grid Layout: Inputs (Left) & Results (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* LEFT COLUMN: PARAMETERS */}
                      <div className="lg:col-span-5 space-y-5">
                        {/* PUMP PARAMETERS CARD */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="card-parameters"
                              data-comment-target="card-parameters"
                              data-field-id="card-parameters"
                              className={`bg-card border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-all ${
                                isFieldHighlighted("card-parameters", "Fire Pump Parameters Section")
                                  ? "border-2 border-sky-400 bg-sky-50/50 dark:bg-sky-950/30 ring-4 ring-sky-400/25"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                                <span className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                  <Flame className="size-4 text-primary" />
                                  Fire Pump Parameters
                                </span>
                                {renderCommentBadge("card-parameters", "Fire Pump Parameters Section")}
                              </div>

                              {/* DRIVER TYPE SELECTOR */}
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div
                                    id="field-driverType"
                                    data-comment-target="driverType"
                                    data-field-id="driverType"
                                    className={`border rounded-2xl p-3.5 bg-muted/20 space-y-2.5 transition-all ${
                                      isFieldHighlighted("driverType", "Driver Type")
                                        ? "field-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                                        : "border-border/80"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-primary rounded-full" />
                                        <span className="text-[11.5px] font-extrabold text-foreground uppercase tracking-wide">
                                          DRIVER TYPE (NFPA 20)
                                        </span>
                                      </div>
                                      {renderCommentBadge("driverType", "Driver Type Selection")}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                                      <button
                                        type="button"
                                        disabled={isEffectiveReadOnly}
                                        onClick={() => updateParam("driverType", "electric")}
                                        className={`px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border text-center flex items-center justify-center gap-2 ${
                                          params.driverType === "electric"
                                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                            : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                        }`}
                                      >
                                        <Zap className="size-4" />
                                        Electric Motor
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isEffectiveReadOnly}
                                        onClick={() => updateParam("driverType", "diesel")}
                                        className={`px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border text-center flex items-center justify-center gap-2 ${
                                          params.driverType === "diesel"
                                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                            : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                        }`}
                                      >
                                        <Fuel className="size-4" />
                                        Diesel Engine
                                      </button>
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                  <ContextMenuItem
                                    onClick={() => handleCopyValue("Driver Type", params.driverType === "electric" ? "Electric Motor" : "Diesel Engine")}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Copy Driver Type</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={() => handleOpenComment("driverType", "Driver Type (NFPA 20)")}
                                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    <span>Add Comment</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>

                              {/* INPUT FIELDS CONTAINER */}
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {renderParamField(
                                    "fpFlow",
                                    "fpFlow",
                                    "Design Required Flow",
                                    "GPM",
                                    "L/min",
                                    10,
                                    "25"
                                  )}
                                  {renderParamField(
                                    "fpPress",
                                    "fpPress",
                                    "System Demand Pressure",
                                    "psi",
                                    "bar",
                                    10,
                                    "5"
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {renderParamField(
                                    "fpDisch",
                                    "fpDisch",
                                    "Discharge Piping Loss",
                                    "psi",
                                    "bar",
                                    0,
                                    "0.5"
                                  )}
                                  {renderParamField(
                                    "fpSuct",
                                    "fpSuct",
                                    "Available Suction Head",
                                    "ft",
                                    "m",
                                    -50,
                                    "1"
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {renderParamField(
                                    "fpEff",
                                    "fpEff",
                                    "Pump Efficiency",
                                    "%",
                                    "%",
                                    40,
                                    "1"
                                  )}
                                  {renderParamField(
                                    "fpSafetyMargin",
                                    "fpSafetyMargin",
                                    "Head Safety Margin",
                                    "psi",
                                    "bar",
                                    0,
                                    "1"
                                  )}
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("card-parameters", "Fire Pump Parameters Section")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* JOCKEY PUMP SIZING CARD */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="card-jockey"
                              data-comment-target="card-jockey"
                              data-field-id="card-jockey"
                              className={`bg-card border rounded-2xl p-4.5 flex flex-col gap-3.5 shadow-xs transition-all ${
                                isFieldHighlighted("card-jockey", "Jockey Pump Section")
                                  ? "border-2 border-sky-400 bg-sky-50/50 dark:bg-sky-950/30 ring-4 ring-sky-400/25"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                                <span className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                                  <Activity className="size-4 text-sky-500" />
                                  Jockey (Pressure Maintenance) Pump
                                </span>
                                {renderCommentBadge("card-jockey", "Jockey Pump Section")}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {renderParamField(
                                  "jockeyFlowPct",
                                  "jockeyFlowPct",
                                  "Jockey Flow Rating",
                                  "% of rated",
                                  "% of rated",
                                  0.5,
                                  "0.5"
                                )}
                                {renderParamField(
                                  "jockeyPressureMargin",
                                  "jockeyPressureMargin",
                                  "Cut-Out Head Margin",
                                  "psi",
                                  "bar",
                                  5,
                                  "1"
                                )}
                              </div>

                              <div className="p-3 bg-muted/20 border border-border/70 rounded-xl text-[11.5px] text-muted-foreground flex flex-col gap-1">
                                <div className="flex justify-between items-center font-semibold">
                                  <span>Recommended Jockey Flow:</span>
                                  <span className="text-foreground font-bold">
                                    {isSI
                                      ? `${(results.jockeyFlowGpm * GPM_TO_LMIN).toFixed(1)} L/min (${results.jockeyFlowLps.toFixed(2)} L/s)`
                                      : `${results.jockeyFlowGpm.toFixed(1)} GPM`}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Jockey Cut-In (Start):</span>
                                  <span className="text-foreground font-bold">
                                    {results.jockeyCutInPsi.toFixed(0)} psi (
                                    {(results.jockeyCutInPsi * PSI_TO_BAR).toFixed(2)} bar)
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span>Jockey Cut-Out (Stop):</span>
                                  <span className="text-foreground font-bold">
                                    {results.jockeyCutOutPsi.toFixed(0)} psi (
                                    {(results.jockeyCutOutPsi * PSI_TO_BAR).toFixed(2)} bar)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("card-jockey", "Jockey Pump Section")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>

                      {/* RIGHT COLUMN: RESULTS & PERFORMANCE CURVE */}
                      <div className="lg:col-span-7 space-y-5">
                        {/* KEY METRICS SUMMARY BANNER */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* RATED FLOW */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="res-ratedFlow"
                                data-comment-target="ratedFlow"
                                data-field-id="ratedFlow"
                                className={`bg-card border rounded-2xl p-3.5 flex flex-col shadow-xs transition-all ${
                                  isFieldHighlighted("ratedFlow", "Rated Flow")
                                    ? "field-highlight-pulse border-2 border-sky-400 bg-sky-50/70 dark:bg-sky-950/50 ring-4 ring-sky-400/25"
                                    : "border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Rated Flow (100%)
                                  </span>
                                  {renderCommentBadge("ratedFlow", "Rated Flow (100%)")}
                                </div>
                                <div className="text-xl font-black text-primary">
                                  {results.nearestStandardSize}
                                  <span className="text-xs font-semibold text-muted-foreground ml-1">
                                    GPM
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {isSI
                                    ? `${(results.nearestStandardSize * GPM_TO_LMIN).toFixed(0)} L/min`
                                    : `NFPA Standard Size`}
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Rated Flow", isSI ? `${(results.nearestStandardSize * GPM_TO_LMIN).toFixed(0)} L/min` : `${results.nearestStandardSize} GPM`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("ratedFlow", "Rated Flow (100%)")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* RATED HEAD */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="res-ratedHead"
                                data-comment-target="ratedHead"
                                data-field-id="ratedHead"
                                className={`bg-card border rounded-2xl p-3.5 flex flex-col shadow-xs transition-all ${
                                  isFieldHighlighted("ratedHead", "Rated Head")
                                    ? "field-highlight-pulse border-2 border-sky-400 bg-sky-50/70 dark:bg-sky-950/50 ring-4 ring-sky-400/25"
                                    : "border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Rated Head
                                  </span>
                                  {renderCommentBadge("ratedHead", "Rated Head")}
                                </div>
                                <div className="text-xl font-black text-foreground">
                                  {results.ratedHeadPsi.toFixed(1)}
                                  <span className="text-xs font-semibold text-muted-foreground ml-1">
                                    psi
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {results.ratedHeadBar.toFixed(2)} bar ({results.ratedHeadM.toFixed(1)}{" "}
                                  m)
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Rated Head", `${results.ratedHeadPsi.toFixed(1)} psi (${results.ratedHeadBar.toFixed(2)} bar)`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("ratedHead", "Rated Head")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* MOTOR SIZING */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="res-motorSizing"
                                data-comment-target="motorSizing"
                                data-field-id="motorSizing"
                                className={`bg-card border rounded-2xl p-3.5 flex flex-col shadow-xs transition-all ${
                                  isFieldHighlighted("motorSizing", "Motor Sizing")
                                    ? "field-highlight-pulse border-2 border-sky-400 bg-sky-50/70 dark:bg-sky-950/50 ring-4 ring-sky-400/25"
                                    : "border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Motor Sizing
                                  </span>
                                  {renderCommentBadge("motorSizing", "Motor Sizing")}
                                </div>
                                <div className="text-xl font-black text-sky-600 dark:text-sky-400">
                                  {results.selectedMotorHp}
                                  <span className="text-xs font-semibold text-muted-foreground ml-1">
                                    HP
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {results.selectedMotorKw.toFixed(1)} kW (BHP:{" "}
                                  {results.brakeHp.toFixed(1)})
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Motor Sizing", `${results.selectedMotorHp} HP (${results.selectedMotorKw.toFixed(1)} kW)`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("motorSizing", "Motor Sizing")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* CHURN PRESSURE */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                id="res-churnPressure"
                                data-comment-target="churnPressure"
                                data-field-id="churnPressure"
                                className={`bg-card border rounded-2xl p-3.5 flex flex-col shadow-xs transition-all ${
                                  isFieldHighlighted("churnPressure", "Churn Pressure")
                                    ? "field-highlight-pulse border-2 border-sky-400 bg-sky-50/70 dark:bg-sky-950/50 ring-4 ring-sky-400/25"
                                    : "border-border"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Churn Pressure
                                  </span>
                                  {renderCommentBadge("churnPressure", "Churn Pressure")}
                                </div>
                                <div
                                  className={`text-xl font-black ${
                                    results.isHighChurn ? "text-red-600" : "text-foreground"
                                  }`}
                                >
                                  {results.churnPsi.toFixed(1)}
                                  <span className="text-xs font-semibold text-muted-foreground ml-1">
                                    psi
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  140% Rated Head
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                              <ContextMenuItem
                                onClick={() => handleCopyValue("Churn Pressure", `${results.churnPsi.toFixed(1)} psi (${results.churnBar.toFixed(2)} bar)`)}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium"
                              >
                                <Copy className="size-3.5 text-muted-foreground" />
                                <span>Copy Value</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={() => handleOpenComment("churnPressure", "Churn Pressure")}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                              >
                                <MessageSquare className="size-3.5" />
                                <span>Add Comment</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>

                        {/* INTERACTIVE SVG PUMP PERFORMANCE CURVE */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="card-curve"
                              data-comment-target="card-curve"
                              data-field-id="card-curve"
                              className={`bg-card border rounded-2xl p-5 flex flex-col gap-3 shadow-xs transition-all ${
                                isFieldHighlighted("card-curve", "NFPA 20 Characteristic Pump Curve")
                                  ? "border-2 border-sky-400 bg-sky-50/50 dark:bg-sky-950/30 ring-4 ring-sky-400/25"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div className="flex items-center gap-2">
                                  <Gauge className="size-4 text-primary" />
                                  <span className="text-[13px] font-bold text-foreground uppercase tracking-wide">
                                    NFPA 20 Characteristic Pump Curve
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground">
                                    Rated: {results.nearestStandardSize} GPM @ {results.ratedHeadPsi.toFixed(0)}{" "}
                                    psi
                                  </span>
                                  {renderCommentBadge("card-curve", "NFPA 20 Characteristic Pump Curve")}
                                </div>
                              </div>

                              {/* SVG Plot */}
                              <div className="w-full h-64 bg-surface-2/60 dark:bg-zinc-950/40 border border-border/70 rounded-xl p-3 flex flex-col justify-center items-center">
                                <svg viewBox="0 0 500 220" className="w-full h-full">
                                  {/* Grid lines */}
                                  <line x1="50" y1="20" x2="50" y2="180" stroke="currentColor" strokeOpacity="0.15" />
                                  <line x1="50" y1="180" x2="470" y2="180" stroke="currentColor" strokeOpacity="0.15" />
                                  <line x1="50" y1="100" x2="470" y2="100" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                                  <line x1="260" y1="20" x2="260" y2="180" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                                  <line x1="390" y1="20" x2="390" y2="180" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />

                                  {/* Axis Labels */}
                                  <text x="50" y="195" fontSize="10" fill="currentColor" opacity="0.6" textAnchor="middle">0 GPM</text>
                                  <text x="260" y="195" fontSize="10" fill="currentColor" opacity="0.8" fontWeight="bold" textAnchor="middle">
                                    100% ({results.nearestStandardSize} GPM)
                                  </text>
                                  <text x="390" y="195" fontSize="10" fill="currentColor" opacity="0.8" fontWeight="bold" textAnchor="middle">
                                    150% ({results.peakFlowGpm.toFixed(0)} GPM)
                                  </text>
                                  <text x="30" y="45" fontSize="10" fill="currentColor" opacity="0.8" textAnchor="middle">
                                    {results.churnPsi.toFixed(0)} psi
                                  </text>
                                  <text x="30" y="105" fontSize="10" fill="currentColor" opacity="0.8" textAnchor="middle">
                                    {results.ratedHeadPsi.toFixed(0)} psi
                                  </text>
                                  <text x="30" y="145" fontSize="10" fill="currentColor" opacity="0.8" textAnchor="middle">
                                    {results.peakHeadPsi.toFixed(0)} psi
                                  </text>

                                  {/* Characteristic Pump Curve: Churn (50, 40) -> 100% Rated (260, 100) -> 150% Peak (390, 140) */}
                                  <path
                                    d="M 50 40 C 140 45, 200 70, 260 100 C 320 125, 360 135, 390 140 C 420 148, 450 165, 470 180"
                                    fill="none"
                                    stroke="#0A7BC7"
                                    strokeWidth="3"
                                  />

                                  {/* Key Points */}
                                  {/* 1. Churn Point */}
                                  <circle cx="50" cy="40" r="5" fill="#ef4444" />
                                  <text x="60" y="36" fontSize="10.5" fontWeight="bold" fill="#ef4444">
                                    Churn: {results.churnPsi.toFixed(0)} psi (140%)
                                  </text>

                                  {/* 2. Rated Point */}
                                  <circle cx="260" cy="100" r="6" fill="#0A7BC7" />
                                  <text x="265" y="93" fontSize="11" fontWeight="bold" fill="#0A7BC7">
                                    Rated Point: {results.nearestStandardSize} GPM @ {results.ratedHeadPsi.toFixed(0)} psi
                                  </text>

                                  {/* 3. Peak 150% Point */}
                                  <circle cx="390" cy="140" r="5" fill="#f59e0b" />
                                  <text x="320" y="158" fontSize="10.5" fontWeight="bold" fill="#f59e0b">
                                    Peak: {results.peakFlowGpm.toFixed(0)} GPM @ {results.peakHeadPsi.toFixed(0)} psi (65%)
                                  </text>
                                </svg>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("card-curve", "NFPA 20 Characteristic Pump Curve")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>

                        {/* COMPREHENSIVE PERFORMANCE & SIZING DETAILS */}
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              id="card-ladder"
                              data-comment-target="card-ladder"
                              data-field-id="card-ladder"
                              className={`bg-card border rounded-2xl p-5 flex flex-col gap-3 shadow-xs transition-all ${
                                isFieldHighlighted("card-ladder", "NFPA 20 Performance & Pressure Ladder")
                                  ? "border-2 border-sky-400 bg-sky-50/50 dark:bg-sky-950/30 ring-4 ring-sky-400/25"
                                  : "border-border"
                              }`}
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <span className="text-[13px] font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                                  <ShieldCheck className="size-4 text-emerald-500" />
                                  NFPA 20 Performance & Pressure Ladder
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground">
                                    NFPA 20 (2022 Edition)
                                  </span>
                                  {renderCommentBadge("card-ladder", "NFPA 20 Performance & Pressure Ladder")}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {/* Left: Power & Electrical */}
                                <div className="space-y-2 text-[12px]">
                                  <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                                    Power & Driver Sizing
                                  </span>
                                  <div className="p-3 bg-muted/20 border border-border/70 rounded-xl space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span>Hydraulic (Water) Power:</span>
                                      <span className="font-bold text-foreground">
                                        {results.whp.toFixed(1)} WHP ({(results.whp * HP_TO_KW).toFixed(1)} kW)
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Brake Power @ Rated Duty:</span>
                                      <span className="font-bold text-foreground">
                                        {results.brakeHp.toFixed(1)} BHP ({results.brakeKw.toFixed(1)} kW)
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span>Peak Power @ 150% Curve:</span>
                                      <span className="font-bold text-foreground">
                                        {results.peakBrakeHp.toFixed(1)} BHP
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-border/50 pt-1">
                                      <span className="font-bold text-primary">Selected Driver Motor:</span>
                                      <span className="font-black text-primary">
                                        {results.selectedMotorHp} HP ({results.selectedMotorKw.toFixed(1)} kW)
                                      </span>
                                    </div>
                                    {params.driverType === "electric" && (
                                      <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                                        <span>Estimated FLA (400V 3Ø):</span>
                                        <span className="font-bold text-foreground">
                                          ~{results.motorFullLoadAmps.toFixed(0)} Amps
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Pressure Control Ladder */}
                                <div className="space-y-2 text-[12px]">
                                  <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
                                    Pressure Switch Ladder (NFPA 20)
                                  </span>
                                  <div className="p-3 bg-muted/20 border border-border/70 rounded-xl space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        1. Jockey Pump Stop (Cut-Out):
                                      </span>
                                      <span className="font-bold text-foreground">
                                        {results.jockeyCutOutPsi.toFixed(0)} psi
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sky-600 dark:text-sky-400 font-semibold">
                                        2. Jockey Pump Start (Cut-In):
                                      </span>
                                      <span className="font-bold text-foreground">
                                        {results.jockeyCutInPsi.toFixed(0)} psi
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-border/50 pt-1">
                                      <span className="text-red-600 dark:text-red-400 font-bold">
                                        3. Main Fire Pump Start:
                                      </span>
                                      <span className="font-black text-red-600 dark:text-red-400">
                                        {results.mainFirePumpCutInPsi.toFixed(0)} psi
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                                      <span>Recommended Pipe Sizing:</span>
                                      <span className="font-bold text-foreground">
                                        Suct: {results.pipeSizes.suctionIn}" | Disch:{" "}
                                        {results.pipeSizes.dischargeIn}"
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onClick={() => handleOpenComment("card-ladder", "NFPA 20 Performance & Pressure Ladder")}
                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Add Comment</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* REPORT VIEW */
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
                      <div className="flex justify-between items-center pb-4 border-b border-border/60">
                        <div>
                          <h2 className="text-xl font-bold text-foreground">
                            Fire Pump Duty & Motor Sizing Report
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Per NFPA 20 Standard for the Installation of Stationary Pumps for Fire
                            Protection
                          </p>
                        </div>
                      </div>

                      {/* Design Parameters Table */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          1. Pump Operating & Hydraulic Parameters
                        </h3>
                        <div className="border border-border/80 rounded-xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                              <tr>
                                <th className="p-2.5">Parameter</th>
                                <th className="p-2.5">Design Value</th>
                                <th className="p-2.5">Engineering Description</th>
                                <th className="p-2.5">Code Reference</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              <tr>
                                <td className="p-2.5 font-bold">Design Flow Demand</td>
                                <td className="p-2.5 font-semibold text-primary">
                                  {results.Q_req} GPM ({(results.Q_req * GPM_TO_LMIN).toFixed(0)} L/min)
                                </td>
                                <td className="p-2.5 text-muted-foreground">Hydraulic Demand Calculation</td>
                                <td className="p-2.5 text-muted-foreground">NFPA 13 / 14</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">Standard Rated Size</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.nearestStandardSize} GPM ({(results.nearestStandardSize * GPM_TO_LMIN).toFixed(0)} L/min)
                                </td>
                                <td className="p-2.5 text-muted-foreground">NFPA 20 Table 4.8.2 Rating</td>
                                <td className="p-2.5 text-muted-foreground">NFPA 20 Clause 4.8.2</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">System Demand Pressure</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.P_req} psi ({results.P_req * PSI_TO_BAR.toFixed(2)} bar)
                                </td>
                                <td className="p-2.5 text-muted-foreground">Hydraulic Remote Point Demand</td>
                                <td className="p-2.5 text-muted-foreground">NFPA 13 / 14</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">Rated Pump Head</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.ratedHeadPsi.toFixed(1)} psi ({results.ratedHeadBar.toFixed(2)} bar)
                                </td>
                                <td className="p-2.5 text-muted-foreground">System Pressure + Losses - Suction + Margin</td>
                                <td className="p-2.5 text-muted-foreground">NFPA 20 Rated Head</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">Churn (Shutoff) Head</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.churnPsi.toFixed(1)} psi ({results.churnBar.toFixed(2)} bar)
                                </td>
                                <td className="p-2.5 text-muted-foreground">Max 140% of rated head</td>
                                <td className="p-2.5 text-muted-foreground">NFPA 20 Clause 4.7.6</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Motor & Driver Selection Table */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          2. Driver & Electrical Motor Evaluation
                        </h3>
                        <div className="border border-border/80 rounded-xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                              <tr>
                                <th className="p-2.5">Attribute</th>
                                <th className="p-2.5">Calculated Rating</th>
                                <th className="p-2.5">Standard Selected</th>
                                <th className="p-2.5">Compliance Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              <tr>
                                <td className="p-2.5 font-bold">Brake Horsepower @ Rated</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.brakeHp.toFixed(1)} BHP ({results.brakeKw.toFixed(1)} kW)
                                </td>
                                <td className="p-2.5 font-bold text-primary">
                                  {results.selectedMotorHp} HP ({results.selectedMotorKw.toFixed(1)} kW)
                                </td>
                                <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ Non-Overloading
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">Peak Brake Horsepower (150%)</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.peakBrakeHp.toFixed(1)} BHP
                                </td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  Covered by {results.selectedMotorHp} HP
                                </td>
                                <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ Full Curve Rated
                                </td>
                              </tr>
                              <tr>
                                <td className="p-2.5 font-bold">Jockey Maintenance Pump</td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  {results.jockeyFlowGpm.toFixed(1)} GPM
                                </td>
                                <td className="p-2.5 font-semibold text-foreground">
                                  Cut-In: {results.jockeyCutInPsi.toFixed(0)} psi | Cut-Out: {results.jockeyCutOutPsi.toFixed(0)} psi
                                </td>
                                <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  ✓ NFPA 20 Chap 5
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* INTELLIGENCE DRAWER */}
            {intelOpen && (
              <div className="w-80 border border-border bg-card rounded-2xl p-4 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">
                      Pump Duty Intelligence
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntelOpen(false)}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    NFPA Standard Presets
                  </span>
                  {PUMP_PRESETS.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => !isEffectiveReadOnly && handleApplyPreset(preset)}
                      className={`p-3 bg-muted/20 border border-border/70 rounded-xl transition-all space-y-1.5 group ${
                        isEffectiveReadOnly
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-muted/50 hover:border-primary/50 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-bold text-foreground group-hover:text-primary transition-colors">
                          {preset.name}
                        </span>
                        <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {preset.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <Info className="size-3.5" />
                    <span>NFPA 20 Guidelines</span>
                  </div>
                  <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-3.5 leading-relaxed">
                    <li>Rated flow must meet demand per NFPA 13/14.</li>
                    <li>Churn head must not exceed 140% of rated head.</li>
                    <li>At 150% rated flow, head must be ≥ 65% of rated head.</li>
                    <li>Electric motors sized for continuous max BHP.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FORMULA MODAL */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">
                  NFPA 20 Fire Pump Duty Formulas & Derivations
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-1">
                <h4 className="font-bold text-foreground text-sm">
                  1. Rated Head Calculation ($H_{"{rated}"}$)
                </h4>
                <div className="font-mono text-primary font-bold text-[13px] bg-background/80 p-2 rounded border border-border/60">
                  H_rated = P_demand + ΔP_discharge - P_suction + Margin
                </div>
                <p>
                  Where $P_{"{demand}"}$ is required system pressure, $\Delta P_{"{discharge}"}$ is
                  piping friction loss, $P_{"{suction}"}$ is static head available from supply, and
                  Margin is the engineering safety allowance.
                </p>
              </div>

              <div className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-1">
                <h4 className="font-bold text-foreground text-sm">
                  2. Churn (Shutoff) Pressure ($P_{"{churn}"}$)
                </h4>
                <div className="font-mono text-primary font-bold text-[13px] bg-background/80 p-2 rounded border border-border/60">
                  P_churn = 1.40 × H_rated (NFPA 20 Maximum Allowable)
                </div>
                <p>
                  Per NFPA 20 Clause 4.7.6, the maximum shutoff head for a fire pump shall not exceed
                  140% of the rated head.
                </p>
              </div>

              <div className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-1">
                <h4 className="font-bold text-foreground text-sm">
                  3. Power Sizing (WHP & BHP)
                </h4>
                <div className="font-mono text-primary font-bold text-[13px] bg-background/80 p-2 rounded border border-border/60">
                  WHP = (Q_GPM × H_psi) / 1714.28
                  <br />
                  BHP = WHP / η_pump
                </div>
                <p>
                  Where WHP is Water Horsepower, BHP is Brake Horsepower, and $\eta$ is pump
                  efficiency. Selected motor size must accommodate the full pump curve.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs cursor-pointer shadow-xs hover:bg-primary/90 transition-all"
              >
                Close Formulas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN COMMENT / TASK MODAL */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="Fire Pump Duty Parameter"
          calculatorTitle="Fire Pump Duty"
          calculatorPath="/plumbing-fire-pump-duty"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}
