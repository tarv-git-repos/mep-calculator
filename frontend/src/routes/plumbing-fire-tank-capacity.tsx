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
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";

export const Route = createFileRoute("/plumbing-fire-tank-capacity")({
  head: () => ({
    meta: [
      { title: "Fire Tank Capacity Calculator — MEP Calc" },
      { name: "description", content: "Calculate fire water storage tank capacity based on NFPA 22 and NFPA 13/14 guidelines." },
    ],
  }),
  component: FireTankCapacityPage,
});

// Conversion Constants
const GPM_TO_LPS = 0.0630902;
const GPM_TO_LMIN = 3.78541;
const GAL_TO_L = 3.78541;
const GAL_TO_M3 = 0.00378541;
const CUFT_PER_GAL = 0.133681; // 1 gal = 0.133681 ft3
const GAL_PER_CUFT = 7.48052;
const CUFT_TO_GAL = 7.48052;

interface FireTankParams {
  systemType: "combined" | "sprinkler" | "standpipe";
  sprinklerFlow: number | "";
  sprinklerDur: number | "";
  standpipeFlow: number | "";
  standpipeDur: number | "";
  hoseFlow: number | "";
  hoseDur: number | "";
  makeupFlow: number | "";
  usableDepth: number | "";
}

const DEFAULT_PARAMS: FireTankParams = {
  systemType: "combined",
  sprinklerFlow: 500,
  sprinklerDur: 60,
  standpipeFlow: 500,
  standpipeDur: 60,
  hoseFlow: 250,
  hoseDur: 60,
  makeupFlow: 0,
  usableDepth: 8, // 8 ft or ~2.5 m
};

// Preset Definitions for Intelligence Drawer
export interface TankPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Partial<FireTankParams>;
}

export const TANK_PRESETS: TankPreset[] = [
  {
    id: "light_hazard",
    name: "Light Hazard (NFPA 13)",
    category: "Offices, Schools, Hospitals",
    description: "30-min duration, 300 GPM sprinkler + 100 GPM hose stream allowance.",
    params: {
      systemType: "sprinkler",
      sprinklerFlow: 300,
      sprinklerDur: 30,
      standpipeFlow: 0,
      standpipeDur: 0,
      hoseFlow: 100,
      hoseDur: 30,
      makeupFlow: 0,
    },
  },
  {
    id: "ordinary_1",
    name: "Ordinary Hazard Group 1",
    category: "Restaurants, Laundries, Parking",
    description: "60-min duration, 500 GPM sprinkler, 500 GPM standpipe + 250 GPM hose stream.",
    params: {
      systemType: "combined",
      sprinklerFlow: 500,
      sprinklerDur: 60,
      standpipeFlow: 500,
      standpipeDur: 60,
      hoseFlow: 250,
      hoseDur: 60,
      makeupFlow: 0,
    },
  },
  {
    id: "ordinary_2_highrise",
    name: "Ordinary Hazard Group 2 / High Rise",
    category: "Commercial Malls, Factories, Warehouses",
    description: "90-min duration, 750 GPM sprinkler, 500 GPM standpipe + 250 GPM hose stream.",
    params: {
      systemType: "combined",
      sprinklerFlow: 750,
      sprinklerDur: 90,
      standpipeFlow: 500,
      standpipeDur: 60,
      hoseFlow: 250,
      hoseDur: 90,
      makeupFlow: 0,
    },
  },
  {
    id: "extra_hazard",
    name: "Extra Hazard Group 1 & 2",
    category: "Chemical, Plastics, High-Rack Storage",
    description: "120-min duration, 1,000 GPM sprinkler + 500 GPM hose stream allowance.",
    params: {
      systemType: "sprinkler",
      sprinklerFlow: 1000,
      sprinklerDur: 120,
      standpipeFlow: 0,
      standpipeDur: 0,
      hoseFlow: 500,
      hoseDur: 120,
      makeupFlow: 0,
    },
  },
  {
    id: "standpipe_only",
    name: "Standpipe Only (NFPA 14 Class I/III)",
    category: "Multi-Story Stairwell Risers",
    description: "30-min duration, 500 GPM first riser + 250 GPM hose stream allowance.",
    params: {
      systemType: "standpipe",
      sprinklerFlow: 0,
      sprinklerDur: 0,
      standpipeFlow: 500,
      standpipeDur: 30,
      hoseFlow: 250,
      hoseDur: 30,
      makeupFlow: 0,
    },
  },
];

function FireTankCapacityPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-fire-tank-capacity", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-fire-tank-capacity", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const isApprovedLocked = useCalculationLock("/plumbing-fire-tank-capacity", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";


  // Tabs & drawer state
  const [tab, setTab] = useState<"solver" | "report">("solver");
  const [intelOpen, setIntelOpen] = useState(false);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);

  // Unit system (IP: GPM, min, gal / SI: L/s, min, m³ & L)
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");

  // Core Inputs
  const [params, setParams] = useState<FireTankParams>(DEFAULT_PARAMS);

  // Comments and Task Assignment state (Matching Duct Sizer & Ventilation)
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentModalOpen, setCommentModalOpen] = useState<boolean>(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with active project
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Comprehensive comments aggregation & calculation state loading (Matching Duct Sizer)
  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectId === project.id) return;

    try {
      const pId = project.id;
      const storageKey = `mep_fire_tank_capacity_calc_${project.id}`;
      const stored = localStorage.getItem(storageKey);
      let loadedParams = DEFAULT_PARAMS;

      // Check workspace_data first if available
      let savedData: any = null;
      if (project.workspace_data) {
        const wdata = typeof project.workspace_data === "string"
          ? JSON.parse(project.workspace_data)
          : project.workspace_data;
        savedData = wdata?.fire_tank_capacity || wdata?.fire_tank || wdata?.plumbing_fire_tank;
      }

      // Comprehensive comments aggregation (calculator storage + project state + user coordination notifications)
      const commentsMap = new Map<string, any>();
      const storedComments = localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-fire-tank-capacity`) || localStorage.getItem(`mep_calc_comments_${pId}_plumbing-fire-tank-capacity`);
      if (storedComments) {
        try {
          const parsed = JSON.parse(storedComments);
          if (Array.isArray(parsed)) parsed.forEach((c: any) => { if (c && c.id) commentsMap.set(c.id, c); });
        } catch (e) {}
      }

      if (savedData && Array.isArray(savedData.comments)) {
        savedData.comments.forEach((c: any) => { if (c && c.id) commentsMap.set(c.id, c); });
      }

      // Check persistent notifications for cross-user assignments (User A -> User B)
      try {
        const uId = profile?.id || userData?.id;
        const notifKeys = [
          "mep_persistent_user_notifs",
          "mep_calc_coord_notifs",
          ...(uId ? [`mep_persistent_user_notifs_${uId}`] : [])
        ];
        notifKeys.forEach((key) => {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((n: any) => {
                if (n && n.id && (n.calculatorPath === "/plumbing-fire-tank-capacity" || n.calculatorTitle?.toLowerCase().includes("fire tank"))) {
                  if ((!n.projectId || n.projectId === pId || pId === "default") && !commentsMap.has(n.id)) {
                    commentsMap.set(n.id, n);
                  }
                }
              });
            }
          }
        });
      } catch (e) {}

      if (stored) {
        const data = JSON.parse(stored);
        if (data.params) {
          loadedParams = data.params;
        } else {
          loadedParams = {
            systemType: data.systemType ?? DEFAULT_PARAMS.systemType,
            sprinklerFlow: data.sprinklerFlow !== undefined ? Number(data.sprinklerFlow) : DEFAULT_PARAMS.sprinklerFlow,
            sprinklerDur: data.sprinklerDur !== undefined ? Number(data.sprinklerDur) : DEFAULT_PARAMS.sprinklerDur,
            standpipeFlow: data.standpipeFlow !== undefined ? Number(data.standpipeFlow) : DEFAULT_PARAMS.standpipeFlow,
            standpipeDur: data.standpipeDur !== undefined ? Number(data.standpipeDur) : DEFAULT_PARAMS.standpipeDur,
            hoseFlow: data.hoseFlow !== undefined ? Number(data.hoseFlow) : DEFAULT_PARAMS.hoseFlow,
            hoseDur: data.hoseDur !== undefined ? Number(data.hoseDur) : DEFAULT_PARAMS.hoseDur,
            makeupFlow: data.makeupFlow !== undefined ? Number(data.makeupFlow) : DEFAULT_PARAMS.makeupFlow,
            usableDepth: data.usableDepth !== undefined ? Number(data.usableDepth) : DEFAULT_PARAMS.usableDepth,
          };
        }
        if (data.unitSystem) setUnitSystem(data.unitSystem);
      } else if (savedData && typeof savedData === "object") {
        if (savedData.params) loadedParams = savedData.params;
        if (savedData.unitSystem) setUnitSystem(savedData.unitSystem);
      }

      setParams(loadedParams);
      setCommentsList(Array.from(commentsMap.values()));
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load fire tank capacity calculation data:", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id, loadedProjectId, profile?.id, userData?.id]);

  // Real-time synchronization of comments across tabs/windows and notification center (Matching Duct Sizer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reloadComments = (e?: any) => {
      try {
        const pId = project?.id || "default";
        const map = new Map<string, any>();

        const stored = localStorage.getItem(`mep_calc_comments_${pId}_/plumbing-fire-tank-capacity`) || localStorage.getItem(`mep_calc_comments_${pId}_plumbing-fire-tank-capacity`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) parsed.forEach((c: any) => { if (c && c.id) map.set(c.id, c); });
        }

        const uId = profile?.id || userData?.id;
        const notifKeys = [
          "mep_persistent_user_notifs",
          "mep_calc_coord_notifs",
          ...(uId ? [`mep_persistent_user_notifs_${uId}`] : [])
        ];
        notifKeys.forEach((key) => {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((n: any) => {
                if (n && n.id && (n.calculatorPath === "/plumbing-fire-tank-capacity" || n.calculatorTitle?.toLowerCase().includes("fire tank"))) {
                  if ((!n.projectId || n.projectId === pId || pId === "default") && !map.has(n.id)) {
                    map.set(n.id, n);
                  }
                }
              });
            }
          }
        });

        if (e?.detail && e.detail.id && (e.detail.calculatorPath === "/plumbing-fire-tank-capacity" || e.detail.calculatorTitle?.toLowerCase().includes("fire tank"))) {
          map.set(e.detail.id, e.detail);
        }

        setCommentsList(Array.from(map.values()));
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
  }, [project?.id, profile?.id, userData?.id]);

  // Deep-link from comment notifications, URL query params and custom events (Matching Duct Sizer)
  useEffect(() => {
    const handleScrollToItem = (e: any) => {
      const targetId = e?.detail?.id || e?.detail?.targetItemId || e?.detail?.targetId;
      const targetName = e?.detail?.name || e?.detail?.fieldName || e?.detail?.targetName;
      if (!targetId && !targetName) return;

      const cleanRaw = String(targetId || "").toLowerCase().trim();
      const cleanId = cleanRaw.replace(/^(field-|card-|metric-)/, "");
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
    window.addEventListener("mep-comment-notification-clicked", handleScrollToItem);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollToItem);
      window.removeEventListener("mep-data-grid-scroll", handleScrollToItem);
      window.removeEventListener("mep_scroll_to_comment_target", handleScrollToItem);
      window.removeEventListener("mep-comment-notification-clicked", handleScrollToItem);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Listen to URL parameters on route change (Matching Duct Sizer)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get("commentTargetId") || urlParams.get("targetId");
    const targetName = urlParams.get("commentTargetName") || urlParams.get("targetName");

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

  // Save State
  const saveState = (
    nextParams: FireTankParams,
    nextUnit: "ip" | "si" = unitSystem
  ) => {
    if (!project?.id) return;
    try {
      const storageKey = `mep_fire_tank_capacity_calc_${project.id}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          params: nextParams,
          unitSystem: nextUnit,
        })
      );
      dirtyStore.set(true);
      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Failed to save fire tank capacity state", e);
    }
  };

  const updateParam = <K extends keyof FireTankParams>(key: K, value: FireTankParams[K]) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode. Editing is locked.", { id: "readonly-notice" });
      return;
    }
    const next = { ...params, [key]: value };
    setParams(next);
    saveState(next);
  };

  const handleApplyPreset = (presetId: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.", { id: "readonly-notice" });
      return;
    }
    const found = TANK_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    const next = { ...params, ...found.params };
    setParams(next);
    saveState(next);
    toast.success(`Applied ${found.name} preset successfully!`);
  };

  const handleUnitSystemChange = (nextUnit: "ip" | "si") => {
    setUnitSystem(nextUnit);
    saveState(params, nextUnit);
    toast.info(`Switched units to ${nextUnit === "si" ? "Metric SI (L/s, m³)" : "US Customary (GPM, gal)"}`);
  };

  // Calculations
  const results = useMemo(() => {
    const isCombined = params.systemType === "combined";
    const isSprinkler = params.systemType === "sprinkler" || isCombined;
    const isStandpipe = params.systemType === "standpipe" || isCombined;

    const spQ = isSprinkler ? Number(params.sprinklerFlow || 0) : 0;
    const spD = isSprinkler ? Number(params.sprinklerDur || 0) : 0;
    const spV = spQ * spD; // gal

    const stQ = isStandpipe ? Number(params.standpipeFlow || 0) : 0;
    const stD = isStandpipe ? Number(params.standpipeDur || 0) : 0;
    const stV = stQ * stD; // gal

    const hsQ = Number(params.hoseFlow || 0);
    const hsD = Number(params.hoseDur || 0);
    const hsV = hsQ * hsD; // gal

    const grossDemandGal = spV + stV + hsV;

    const muQ = Number(params.makeupFlow || 0);
    const maxDur = Math.max(spD, stD, hsD, 0);
    const makeupCredit = muQ * maxDur;

    const totalGal = Math.max(0, grossDemandGal - makeupCredit);
    const totalM3 = totalGal * GAL_TO_M3;
    const totalL = totalGal * GAL_TO_L;

    const usableDepthFt = Math.max(1, Number(params.usableDepth || 8));
    const totalCuFt = totalGal / CUFT_TO_GAL;
    const footprintSqFt = totalCuFt / usableDepthFt;

    const rectRatio = 1.5;
    const rectWidthFt = Math.sqrt(footprintSqFt / rectRatio);
    const rectLengthFt = rectWidthFt * rectRatio;

    const cylDiamFt = Math.sqrt((4 * footprintSqFt) / Math.PI);

    const depthM = usableDepthFt * 0.3048;
    const rectLenM = rectLengthFt * 0.3048;
    const rectWidM = rectWidthFt * 0.3048;
    const cylDiamM = cylDiamFt * 0.3048;

    // Refill hours to restore 100% capacity
    const refillHours = muQ > 0 ? totalGal / (muQ * 60) : null;
    const isRefillCompliant = refillHours !== null ? refillHours <= 8.0 : null;

    const rectAreaSqFt = footprintSqFt;
    const rectAreaSqM = depthM > 0 ? totalM3 / depthM : 0;

    return {
      spQ,
      spD,
      spV,
      stQ,
      stD,
      stV,
      hsQ,
      hsD,
      hsV,
      grossDemandGal,
      mu: muQ,
      maxDur,
      makeupCredit,
      totalGal,
      totalM3,
      totalL,
      usableDepthFt,
      totalCuFt,
      footprintSqFt,
      rectLengthFt,
      rectWidthFt,
      cylDiamFt,
      depthM,
      rectLenM,
      rectWidM,
      cylDiamM,
      refillHours,
      isRefillCompliant,
      depthVal: usableDepthFt,
      rectLengthM: rectLenM,
      rectWidthM: rectWidM,
    };
  }, [params, unitSystem]);

  // Comments Management (Matching Duct Sizer)
  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setCommentModalOpen(true);
  };

  const saveComments = (newList: any[]) => {
    setCommentsList(newList);
    const pId = project?.id || "default";
    localStorage.setItem(`mep_calc_comments_${pId}_/plumbing-fire-tank-capacity`, JSON.stringify(newList));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_notif_tick"));
      window.dispatchEvent(new CustomEvent("mep_notification_received"));
      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new Event("storage"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("mep_notifications_channel");
          bc.postMessage({ type: "COMMENTS_UPDATED", calcPath: "/plumbing-fire-tank-capacity", count: newList.length });
          bc.close();
        } catch (e) {}
      }
    }
  };

  const handleSaveComment = (commentData: any) => {
    const targetId = commentTargetItem?.id || "plumbing-fire-tank-capacity";
    const targetName = commentTargetItem?.name || "Fire Tank Capacity Parameter";

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
      calculatorTitle: "Fire Tank Capacity",
      calculatorPath: "/plumbing-fire-tank-capacity",
      projectId: project?.id || "default",
      projectName: project?.name || "Fire Suppression Facility",
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

  const getItemComments = (id: string) => {
    if (!id) return [];
    const clean = id.toLowerCase().trim().replace(/^(field-|card-|metric-)/, "");
    return commentsList.filter((c) => {
      if (!c) return false;
      const tId = String(c.targetId || c.spaceId || c.itemId || c.id || "").toLowerCase().trim().replace(/^(field-|card-|metric-)/, "");
      return tId === clean || tId === id.toLowerCase().trim();
    });
  };

  const isFieldHighlighted = (id: string, label?: string) => {
    if (!highlightedTargetId) return false;
    const cleanHighlight = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-|metric-)/, "");
    const cleanId = id.toLowerCase().trim().replace(/^(field-|card-|metric-)/, "");
    if (cleanHighlight === cleanId || highlightedTargetId.toLowerCase().trim() === id.toLowerCase().trim()) return true;
    if (label && label.toLowerCase().includes(cleanHighlight)) return true;
    return false;
  };

  // Comment Badge component exactly matching Duct Sizer
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
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-200 dark:hover:bg-blue-900 transition cursor-pointer shadow-2xs select-none border border-blue-300/40 dark:border-blue-700/40"
      >
        <MessageSquare className="size-3.5 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
        <span className="text-[10px] font-bold">{itemComments.length}</span>
      </button>
    );
  };

  const handleCopyValue = (label: string, val: any) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(String(val));
      toast.success(`Copied ${label}: ${val}`);
    }
  };

  const handlePasteValue = async (key: keyof FireTankParams, label: string) => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only / Approved mode.", { id: "readonly-notice" });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText();
        const num = parseFloat(text);
        if (!isNaN(num)) {
          updateParam(key, num as any);
          toast.success(`Pasted into ${label}: ${num}`);
        }
      } catch (e) {
        toast.error("Failed to read clipboard");
      }
    }
  };

  // Reusable Parameter Input Field with Context Menu and Pulse Highlight matching Duct Sizer
  const renderParamField = (
    id: string,
    key: keyof FireTankParams,
    label: string,
    unitIP: string,
    unitSI: string,
    min = 0,
    step = "1"
  ) => {
    const val = params[key];
    const unitLabel = unitSystem === "si" ? unitSI : unitIP;
    const isHighlighted = isFieldHighlighted(id, label);

    return (
      <ContextMenu key={id}>
        <ContextMenuTrigger asChild>
          <div
            id={`field-${id}`}
            data-comment-target={id}
            data-item-id={id}
            data-field-id={id}
            className={`group flex flex-col gap-1.5 p-2 rounded-xl transition-all cursor-context-menu ${
              isHighlighted
                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400 z-20 font-bold"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-[12px] font-bold text-muted-foreground flex items-center gap-1.5">
                <span>{label}</span>
                <span className="text-[11px] font-normal text-muted-foreground/80">({unitLabel})</span>
              </label>
              {renderCommentBadge(id, label)}
            </div>
            <input
              type="number"
              min={min}
              step={step}
              value={val === "" ? "" : val}
              disabled={isEffectiveReadOnly}
              onChange={(e) => {
                const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                updateParam(key, (isNaN(parsed as number) ? "" : parsed) as any);
              }}
              className="w-full h-10 px-3 bg-background border border-border rounded-xl text-[13.5px] font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs shadow-xl border-border bg-popover rounded-xl">
          <ContextMenuItem
            onClick={() => handleCopyValue(label, val)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Value</span>
            <ContextMenuShortcut className="text-[10px]">Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isEffectiveReadOnly}
            onClick={() => handlePasteValue(key, label)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-accent disabled:opacity-50"
          >
            <Clipboard className="size-3.5 text-muted-foreground" />
            <span>Paste Value</span>
            <ContextMenuShortcut className="text-[10px]">Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator className="my-1 bg-border/60" />
          <ContextMenuItem
            onSelect={() => handleOpenComment(id, label)}
            onClick={() => handleOpenComment(id, label)}
            className="flex items-center gap-2 cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 text-blue-600 dark:text-blue-400 font-medium"
          >
            <MessageSquare className="size-3.5" />
            <span>Add Comment / Assign Task</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // PDF Export Generation exactly matching Ventilation standard format
  const exportPdf = async () => {
    try {
      const activeProj: any = workspaceStore.getState()?.project || project || {};
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

      const primaryFill: [number, number, number] = [217, 217, 217];
      const blueFill: [number, number, number] = [218, 233, 248];
      const signatureFill: [number, number, number] = [255, 230, 204];
      const gridBorderColor: [number, number, number] = [100, 100, 100];

      const calcNo = activeProj?.calcNo || `TRV-CAL-FTC-${Date.now().toString().slice(-4)}`;
      const today = new Date().toLocaleDateString("en-GB");
      const projectNo = activeProj?.code || activeProj?.projectNo || activeProj?.id?.substring(0, 8) || "P000";
      const projectName = activeProj?.name || activeProj?.projectName || "Fire Water Suppression Facility";
      const clientName = activeProj?.client || "Master Client";
      const endUser = activeProj?.endUser || activeProj?.location || "Design Facility";

      // 1. Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Fire Tank Capacity Calculation Report", 14, 14);

      // 2. Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
      doc.setFontSize(9);
      doc.setLineWidth(0.3);
      doc.setDrawColor(...gridBorderColor);
      doc.rect(14, 18, 182, 18);

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
      doc.text(projectName.substring(0, 32), 42, 34);

      doc.setFont("helvetica", "bold");
      doc.text("End User:", 107, 34);
      doc.setFont("helvetica", "normal");
      doc.text(endUser.substring(0, 32), 125, 34);

      // Section 1: Parameters Table
      const isSI = unitSystem === "si";
      const paramBody: any[] = [
        ["1", "System Configuration", params.systemType.toUpperCase(), "Combined / Sprinkler / Standpipe", "NFPA 13 / NFPA 14"],
      ];

      if (params.systemType !== "standpipe") {
        paramBody.push([
          "2",
          "Sprinkler Flow Demand",
          isSI ? `${(results.spQ * GPM_TO_LMIN).toFixed(0)} L/min (${(results.spQ * GPM_TO_LPS).toFixed(1)} L/s)` : `${results.spQ} GPM`,
          "Design Area Hydraulic Demand",
          "NFPA 13 Chap. 11",
        ]);
        paramBody.push([
          "3",
          "Sprinkler Duration",
          `${results.spD} min`,
          "Water supply autonomy",
          "NFPA 13 Table 11.2",
        ]);
      }

      if (params.systemType !== "sprinkler") {
        paramBody.push([
          "4",
          "Standpipe Flow Demand",
          isSI ? `${(results.stQ * GPM_TO_LMIN).toFixed(0)} L/min (${(results.stQ * GPM_TO_LPS).toFixed(1)} L/s)` : `${results.stQ} GPM`,
          "Class I/III System Standpipe Demand",
          "NFPA 14 Chap. 7",
        ]);
        paramBody.push([
          "5",
          "Standpipe Duration",
          `${results.stD} min`,
          "Standard minimum duration",
          "NFPA 14 Table 7.3",
        ]);
      }

      paramBody.push([
        "6",
        "Hose Stream / Hydrant Flow",
        isSI ? `${(results.hsQ * GPM_TO_LMIN).toFixed(0)} L/min (${(results.hsQ * GPM_TO_LPS).toFixed(1)} L/s)` : `${results.hsQ} GPM`,
        "Inside & Outside Hose allowance",
        "NFPA 13 / NFPA 14",
      ]);
      paramBody.push([
        "7",
        "Hose Stream Duration",
        `${results.hsD} min`,
        "Coincident fire fighting duration",
        "NFPA 22 Standard",
      ]);
      paramBody.push([
        "8",
        "Makeup Water Refill Rate",
        isSI ? `${(results.mu * GPM_TO_LMIN).toFixed(0)} L/min` : `${results.mu} GPM`,
        "Dedicated reliable municipal refill",
        "NFPA 22 Sec. 4.1.3",
      ]);

      callAutoTable(doc, {
        startY: 42,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 50, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 42, fontStyle: "bold" },
          3: { cellWidth: 50, halign: "left" },
          4: { cellWidth: 32 },
        },
        head: [
          [
            { content: "#" },
            { content: "Design Parameter Description" },
            { content: "Value" },
            { content: "Engineering Context" },
            { content: "Code Ref." },
          ],
        ],
        body: paramBody,
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 105;
      nextY += 6;

      // Section 2: Results Table
      const formatMetricVol = (gal: number) => {
        const m3 = (gal * GAL_TO_M3).toFixed(1);
        const l = Math.round(gal * GAL_TO_L).toLocaleString();
        return `${m3} m³ (${l} L)`;
      };

      const resultsBody: any[] = [
        ["A", "Sprinkler Water Volume", `${results.spV.toLocaleString()} gal`, formatMetricVol(results.spV), "Flow × Duration"],
        ["B", "Standpipe Water Volume", `${results.stV.toLocaleString()} gal`, formatMetricVol(results.stV), "Flow × Duration"],
        ["C", "Hose Stream Volume", `${results.hsV.toLocaleString()} gal`, formatMetricVol(results.hsV), "Flow × Duration"],
        ["D", "Gross Fire Storage Demand", `${results.grossDemandGal.toLocaleString()} gal`, formatMetricVol(results.grossDemandGal), "A + B + C"],
        [
          "E",
          "Makeup Water Inflow Credit",
          results.makeupCredit > 0 ? `-${results.makeupCredit.toLocaleString()} gal` : "0 gal",
          results.makeupCredit > 0 ? `-${(results.makeupCredit * GAL_TO_M3).toFixed(1)} m³ (-${Math.round(results.makeupCredit * GAL_TO_L).toLocaleString()} L)` : "0.0 m³ (0 L)",
          "Refill × Max Duration"
        ],
        ["F", "REQUIRED MINIMUM TANK CAPACITY", `${results.totalGal.toLocaleString()} gal`, formatMetricVol(results.totalGal), "MAX(0, Gross - Makeup)"],
      ];

      callAutoTable(doc, {
        startY: nextY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 7.8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
          minCellHeight: 6.5,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 54, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
          3: { cellWidth: 44, fontStyle: "bold" },
          4: { cellWidth: 38, halign: "left" },
        },
        head: [
          [
            { content: "Item" },
            { content: "Storage Capacity Component" },
            { content: "US Gallons" },
            { content: "Metric Volume" },
            { content: "Derivation Formula" },
          ],
        ],
        body: resultsBody,
      });

      let sigY = (doc as any).lastAutoTable?.finalY ?? 170;
      sigY += 8;

      // Section 3: Signature Block exactly matching Ventilation standard
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate,
      } = getSignatureBlockDetails(activeProj?.id || project?.id || "default", "/plumbing-fire-tank-capacity", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: sigY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        headStyles: {
          fillColor: signatureFill,
          textColor: 0,
          fontStyle: "bold",
        },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" },
          ],
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || "Design Engineer", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || today, styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
        },
      });

      const pdfBuffer = doc.output("arraybuffer");
      await downloadFile(
        new Uint8Array(pdfBuffer),
        `Fire_Tank_Capacity_Report_${projectNo}.pdf`,
        "PDF Document",
        ["pdf"]
      );
      toast.success("Fire Tank Capacity PDF report exported successfully!");
    } catch (e: any) {
      console.error("Failed to generate PDF", e);
      toast.error(e?.message || "Failed to generate PDF report.");
    }
  };

  const isSI = unitSystem === "si";

  return (
    <AppShell
      title="Fire Tank Capacity"
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
                  Fire Tank Capacity
                </h1>
                <span className="text-[13.5px] font-semibold text-muted-foreground">
                  NFPA 22 Dedicated Water Storage Demand
                </span>
              </div>
              <button
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
                calculatorPath="/plumbing-fire-tank-capacity"
                calculatorTitle="Fire Tank Capacity"
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
          </div>

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
                    This Fire Tank Capacity sheet is locked to protect engineering revision integrity.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                Approved
              </span>
            </div>
          )}

          {/* Main Card & Intelligence Drawer Container */}
          <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
            
            {/* White Card Container for Tabs & Content */}
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
              {/* Tabs Selector row */}
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-surface-2 p-0.5 rounded-full gap-1 border border-border/80">
                    <button
                      onClick={() => setTab("solver")}
                      className={`px-3.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        tab === "solver"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Capacity Sizer
                    </button>
                    <button
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
                    title="View NFPA 22 Formulas & Sizing Derivations"
                  >
                    <Info className="size-3.5 text-primary" />
                    <span>NFPA 22 Formulas</span>
                  </button>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 select-none shrink-0">
                  <TBtn onClick={exportPdf}>
                    <FileText className="size-3.5" /> Export PDF
                  </TBtn>
                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={handleUnitSystemChange}
                    disabled={isEffectiveReadOnly}
                    inputDescriptions="Flow Rate (GPM / L/s), Storage Volume (gal / m³ or L)"
                    conversionExample={
                      unitSystem === "ip"
                        ? "Convert 500 GPM → 31.5 L/s, 75,000 gal → 283.9 m³"
                        : "Convert 31.5 L/s → 500 GPM, 283.9 m³ → 75,000 gal"
                    }
                  />
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {tab === "solver" ? (
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    
                    {/* Grid Layout: Inputs (Left) & Results (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      
                      {/* LEFT COLUMN: PARAMETERS */}
                      <div className="lg:col-span-6 space-y-5">
                        
                        {/* TANK PARAMETERS CARD */}
                        <div className="bg-background border border-border/90 rounded-2xl shadow-xs p-5 space-y-5">
                          <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <span className="text-[13px] font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
                              <Flame className="size-4 text-primary" />
                              Tank Sizing Parameters
                            </span>
                            {renderCommentBadge("card-parameters", "Tank Parameters Section")}
                          </div>

                          {/* SYSTEM TYPE SELECTOR */}
                          <div
                            id="field-systemType"
                            data-comment-target="systemType"
                            data-item-id="systemType"
                            data-field-id="systemType"
                            className={`group border border-border/80 rounded-2xl p-4 bg-muted/20 space-y-2.5 transition-all ${
                              isFieldHighlighted("systemType", "System Classification")
                                ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400 z-20 font-bold"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-primary rounded-full" />
                                <span className="text-[11.5px] font-extrabold text-foreground uppercase tracking-wide">
                                  SYSTEM CLASSIFICATION TYPE
                                </span>
                              </div>
                              {renderCommentBadge("systemType", "System Classification Type")}
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isEffectiveReadOnly}
                                onClick={() => updateParam("systemType", "combined")}
                                className={`px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border text-center ${
                                  params.systemType === "combined"
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                }`}
                              >
                                Combined
                              </button>
                              <button
                                type="button"
                                disabled={isEffectiveReadOnly}
                                onClick={() => updateParam("systemType", "sprinkler")}
                                className={`px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border text-center ${
                                  params.systemType === "sprinkler"
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                }`}
                              >
                                Sprinkler Only
                              </button>
                              <button
                                type="button"
                                disabled={isEffectiveReadOnly}
                                onClick={() => updateParam("systemType", "standpipe")}
                                className={`px-3 py-2 rounded-xl text-[12px] font-bold cursor-pointer transition-all border text-center ${
                                  params.systemType === "standpipe"
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                }`}
                              >
                                Standpipe Only
                              </button>
                            </div>
                          </div>

                          {/* INPUT FIELDS CONTAINER */}
                          <div className="space-y-4">
                            
                            {/* Sprinkler Demand */}
                            {params.systemType !== "standpipe" && (
                              <div
                                id="card-sprinkler"
                                data-comment-target="sprinkler"
                                className={`border border-border/80 rounded-2xl p-4 bg-card space-y-2 transition-all ${
                                  isFieldHighlighted("card-sprinkler", "Sprinkler Demand")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-3.5 bg-primary rounded-full" />
                                    <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wide">
                                      Sprinkler Demand (NFPA 13)
                                    </span>
                                  </div>
                                  {renderCommentBadge("card-sprinkler", "Sprinkler Demand Section")}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {renderParamField("sprinklerFlow", "sprinklerFlow", "Sprinkler Flow Rate", "GPM", "L/min", 0, "10")}
                                  {renderParamField("sprinklerDur", "sprinklerDur", "Sprinkler Duration", "min", "min", 0, "5")}
                                </div>
                              </div>
                            )}

                            {/* Standpipe Demand */}
                            {params.systemType !== "sprinkler" && (
                              <div
                                id="card-standpipe"
                                data-comment-target="standpipe"
                                className={`border border-border/80 rounded-2xl p-4 bg-card space-y-2 transition-all ${
                                  isFieldHighlighted("card-standpipe", "Standpipe Demand")
                                    ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-3.5 bg-primary rounded-full" />
                                    <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wide">
                                      Standpipe Demand (NFPA 14)
                                    </span>
                                  </div>
                                  {renderCommentBadge("card-standpipe", "Standpipe Demand Section")}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {renderParamField("standpipeFlow", "standpipeFlow", "Standpipe Flow Rate", "GPM", "L/min", 0, "10")}
                                  {renderParamField("standpipeDur", "standpipeDur", "Standpipe Duration", "min", "min", 0, "5")}
                                </div>
                              </div>
                            )}

                            {/* Hose Stream Demand */}
                            <div
                              id="card-hose"
                              data-comment-target="hose"
                              className={`border border-border/80 rounded-2xl p-4 bg-card space-y-2 transition-all ${
                                isFieldHighlighted("card-hose", "Hose Stream")
                                  ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-3.5 bg-primary rounded-full" />
                                  <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wide">
                                    Hose Stream / Hydrant Allowance
                                  </span>
                                </div>
                                {renderCommentBadge("card-hose", "Hose Stream Section")}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {renderParamField("hoseFlow", "hoseFlow", "Hose Stream Flow Rate", "GPM", "L/min", 0, "10")}
                                {renderParamField("hoseDur", "hoseDur", "Hose Stream Duration", "min", "min", 0, "5")}
                              </div>
                            </div>

                            {/* Makeup Water Credit */}
                            <div
                              id="card-makeup"
                              data-comment-target="makeup"
                              className={`border border-border/80 rounded-2xl p-4 bg-card space-y-2 transition-all ${
                                isFieldHighlighted("card-makeup", "Makeup Water Credit")
                                  ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-3.5 bg-primary rounded-full" />
                                  <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wide">
                                    Makeup Water Supply Credit (NFPA 22 Sec. 4.1.3)
                                  </span>
                                </div>
                                {renderCommentBadge("card-makeup", "Makeup Water Credit Section")}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {renderParamField("makeupFlow", "makeupFlow", "Continuous Refill Flow", "GPM", "L/min", 0, "5")}
                                {renderParamField("usableDepth", "usableDepth", "Tank Usable Water Depth", "ft", "m", 1, "0.5")}
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>

                      {/* RIGHT COLUMN: RESULTS */}
                      <div className="lg:col-span-6 space-y-5">
                        
                        {/* NFPA 22 Advisory Note */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3 items-start">
                          <span className="text-amber-600 dark:text-amber-400 mt-0.5 text-base">ℹ️</span>
                          <div>
                            <h4 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200 mb-0.5">
                              NFPA 22 Water Supply Compliance Note
                            </h4>
                            <p className="text-[11.5px] text-amber-800 dark:text-amber-300/80 leading-relaxed">
                              Tank capacity calculations adhere to NFPA 22 criteria. Dedicated fire storage must account for simultaneously operating systems unless hydraulically independent. Verify with local AHJ before applying makeup supply credit.
                            </p>
                          </div>
                        </div>

                        {/* CALCULATED RESULTS HERO CARD */}
                        <div
                          id="card-results"
                          data-comment-target="card-results"
                          data-item-id="card-results"
                          className={`bg-background border border-border/90 rounded-2xl shadow-xs p-6 space-y-6 transition-all ${
                            isFieldHighlighted("card-results", "Results")
                              ? "field-highlight-pulse row-highlight-flash item-highlight-pulse ring-4 ring-sky-400/80 bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-400"
                              : ""
                          }`}
                        >
                          
                          <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-4 bg-primary rounded-full" />
                              <h2 className="text-[14.5px] font-bold text-foreground uppercase tracking-wide">
                                Calculated Water Storage Requirements
                              </h2>
                            </div>
                            <div className="flex items-center gap-2">
                              {renderCommentBadge("card-results", "Calculated Results")}
                              <span className="text-xs font-semibold text-muted-foreground">
                                Max Duration: {results.maxDur} min
                              </span>
                            </div>
                          </div>

                          {/* Breakdown Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {params.systemType !== "standpipe" && (
                              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex flex-col justify-between">
                                <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Sprinkler Vol.
                                </span>
                                <div className="mt-1">
                                  <span className="text-lg font-extrabold text-foreground">
                                    {isSI ? `${(results.spV * GAL_TO_M3).toFixed(1)} m³` : `${results.spV.toLocaleString()} gal`}
                                  </span>
                                  <div className="text-[11px] font-semibold text-muted-foreground">
                                    {isSI ? `${results.spV.toLocaleString()} gal` : `${(results.spV * GAL_TO_L).toLocaleString()} L`}
                                  </div>
                                </div>
                              </div>
                            )}

                            {params.systemType !== "sprinkler" && (
                              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex flex-col justify-between">
                                <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                  Standpipe Vol.
                                </span>
                                <div className="mt-1">
                                  <span className="text-lg font-extrabold text-foreground">
                                    {isSI ? `${(results.stV * GAL_TO_M3).toFixed(1)} m³` : `${results.stV.toLocaleString()} gal`}
                                  </span>
                                  <div className="text-[11px] font-semibold text-muted-foreground">
                                    {isSI ? `${results.stV.toLocaleString()} gal` : `${(results.stV * GAL_TO_L).toLocaleString()} L`}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex flex-col justify-between">
                              <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                                Hose Stream Vol.
                              </span>
                              <div className="mt-1">
                                <span className="text-lg font-extrabold text-foreground">
                                  {isSI ? `${(results.hsV * GAL_TO_M3).toFixed(1)} m³` : `${results.hsV.toLocaleString()} gal`}
                                </span>
                                <div className="text-[11px] font-semibold text-muted-foreground">
                                  {isSI ? `${results.hsV.toLocaleString()} gal` : `${(results.hsV * GAL_TO_L).toLocaleString()} L`}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* HERO NET REQUIRED CAPACITY */}
                          <div className="p-5 rounded-2xl bg-primary/10 border-2 border-primary/30 flex flex-col items-center text-center">
                            <span className="text-[11.5px] font-extrabold text-primary uppercase tracking-widest mb-1">
                              Required Minimum Fire Storage Tank Capacity
                            </span>
                            <div className="text-3xl sm:text-4xl font-black text-primary tracking-tight mt-1">
                              {isSI ? `${results.totalM3.toFixed(1)} m³` : `${results.totalGal.toLocaleString()} gal`}
                            </div>
                            <div className="text-[13px] font-bold text-muted-foreground mt-1">
                              {isSI
                                ? `${results.totalGal.toLocaleString()} US Gallons (${results.totalL.toLocaleString()} Litres)`
                                : `${results.totalM3.toFixed(1)} m³ (${results.totalL.toLocaleString()} Litres)`}
                            </div>
                          </div>

                          {/* Makeup Deduction Callout */}
                          {results.makeupCredit > 0 && (
                            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                                  Makeup Supply Credit Deduction ({results.maxDur} min @ {results.mu} GPM)
                                </span>
                              </div>
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                -{results.makeupCredit.toLocaleString()} gal (-{(results.makeupCredit * GAL_TO_M3).toFixed(1)} m³)
                              </span>
                            </div>
                          )}

                          {/* GEOMETRIC SIZING ESTIMATOR */}
                          <div className="pt-2 border-t border-border/60">
                            <div className="flex items-center gap-2 mb-3">
                              <Box className="size-4 text-primary" />
                              <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                                Physical Sizing Estimation (Usable Depth: {params.usableDepth} {isSI ? "m" : "ft"})
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                <span className="font-bold text-foreground block mb-1">Rectangular Tank (1.5 : 1 L/W)</span>
                                <div className="text-muted-foreground">
                                  {isSI ? (
                                    <>
                                      Length: <span className="font-bold text-foreground">{results.rectLengthM.toFixed(2)} m</span> × Width: <span className="font-bold text-foreground">{results.rectWidthM.toFixed(2)} m</span>
                                    </>
                                  ) : (
                                    <>
                                      Length: <span className="font-bold text-foreground">{results.rectLengthFt.toFixed(1)} ft</span> × Width: <span className="font-bold text-foreground">{results.rectWidthFt.toFixed(1)} ft</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                                <span className="font-bold text-foreground block mb-1">Cylindrical Tank (Vertical)</span>
                                <div className="text-muted-foreground">
                                  Diameter: <span className="font-bold text-foreground">{isSI ? `${results.cylDiamM.toFixed(2)} m` : `${results.cylDiamFt.toFixed(1)} ft`}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>

                      </div>

                    </div>

                  </div>
                ) : (
                  /* REPORT TAB */
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    
                    {/* Report Sheet */}
                    <div className="bg-background border border-border rounded-2xl shadow-xs p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
                      
                      <div className="border-b border-border/80 pb-4 flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-foreground">
                            Fire Water Tank Capacity Sizing Report
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Engineering Calculation & NFPA 22 Dedicated Storage Verification
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <TBtn onClick={exportPdf}>
                            <FileText className="size-3.5" /> Export PDF
                          </TBtn>
                        </div>
                      </div>

                      {/* Metadata Box */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-muted/20 border border-border/70 text-xs">
                        <div>
                          <span className="text-muted-foreground block">Project Name:</span>
                          <span className="font-bold text-foreground">{project?.name || "Fire Water System"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">System Type:</span>
                          <span className="font-bold text-foreground">{params.systemType.toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Standard:</span>
                          <span className="font-bold text-foreground">NFPA 22 / 13 / 14</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Date:</span>
                          <span className="font-bold text-foreground">{new Date().toISOString().split("T")[0]}</span>
                        </div>
                      </div>

                      {/* Design Summary Table */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          <Layers className="size-4 text-primary" />
                          1. Hydraulic Demand Breakdown
                        </h3>
                        <div className="border border-border rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase">
                              <tr>
                                <th className="p-3">Component</th>
                                <th className="p-3">Design Flow</th>
                                <th className="p-3">Duration</th>
                                <th className="p-3 text-right">Required Volume</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {params.systemType !== "standpipe" && (
                                <tr>
                                  <td className="p-3 font-semibold text-foreground">Sprinkler System (NFPA 13)</td>
                                  <td className="p-3 text-muted-foreground">{results.spQ} GPM ({ (results.spQ * GPM_TO_LMIN).toFixed(0) } L/min)</td>
                                  <td className="p-3 text-muted-foreground">{results.spD} min</td>
                                  <td className="p-3 text-right font-bold text-foreground">{results.spV.toLocaleString()} gal ({ (results.spV * GAL_TO_M3).toFixed(1) } m³)</td>
                                </tr>
                              )}
                              {params.systemType !== "sprinkler" && (
                                <tr>
                                  <td className="p-3 font-semibold text-foreground">Standpipe System (NFPA 14)</td>
                                  <td className="p-3 text-muted-foreground">{results.stQ} GPM ({ (results.stQ * GPM_TO_LMIN).toFixed(0) } L/min)</td>
                                  <td className="p-3 text-muted-foreground">{results.stD} min</td>
                                  <td className="p-3 text-right font-bold text-foreground">{results.stV.toLocaleString()} gal ({ (results.stV * GAL_TO_M3).toFixed(1) } m³)</td>
                                </tr>
                              )}
                              <tr>
                                <td className="p-3 font-semibold text-foreground">Hose Stream / Hydrant Allowance</td>
                                <td className="p-3 text-muted-foreground">{results.hsQ} GPM ({ (results.hsQ * GPM_TO_LMIN).toFixed(0) } L/min)</td>
                                <td className="p-3 text-muted-foreground">{results.hsD} min</td>
                                <td className="p-3 text-right font-bold text-foreground">{results.hsV.toLocaleString()} gal ({ (results.hsV * GAL_TO_M3).toFixed(1) } m³)</td>
                              </tr>
                              {results.makeupCredit > 0 && (
                                <tr className="bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                                  <td className="p-3 font-semibold">Makeup Supply Inflow Credit</td>
                                  <td className="p-3">{results.mu} GPM</td>
                                  <td className="p-3">{results.maxDur} min max</td>
                                  <td className="p-3 text-right font-bold">-{results.makeupCredit.toLocaleString()} gal (-{ (results.makeupCredit * GAL_TO_M3).toFixed(1) } m³)</td>
                                </tr>
                              )}
                              <tr className="bg-primary/10 text-primary font-bold text-sm">
                                <td className="p-3" colSpan={3}>MINIMUM DEDICATED TANK CAPACITY</td>
                                <td className="p-3 text-right">{results.totalGal.toLocaleString()} gal ({results.totalM3.toFixed(1)} m³)</td>
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

            {/* Collapsible Intelligence Drawer Matching Ventilation / Fire Water Demand */}
            <div
              className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
                intelOpen
                  ? "w-[360px] my-0 ml-1 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col"
                  : "w-0"
              }`}
            >
              {intelOpen && (
                <FireTankIntelligenceDrawer
                  onClose={() => setIntelOpen(false)}
                  params={params}
                  results={results}
                  unitSystem={unitSystem}
                  isEffectiveReadOnly={isEffectiveReadOnly}
                  onApplyPreset={handleApplyPreset}
                  onOpenFormulaModal={() => setFormulaModalOpen(true)}
                />
              )}
            </div>

          </div>

        </div>
      </div>

      {/* NFPA 22 Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Info className="size-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">NFPA 22 Fire Tank Formulas</h3>
              </div>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-1">
                <span className="font-bold text-foreground text-[13px] block">1. Sprinkler Storage Volume</span>
                <code>V_sprinkler = Q_sprinkler × t_sprinkler</code>
                <p className="text-[11.5px] mt-1">
                  Where Q is the NFPA 13 design demand flow (GPM or L/min) and t is the standard hazard duration (typically 30–120 min).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-1">
                <span className="font-bold text-foreground text-[13px] block">2. Standpipe Storage Volume</span>
                <code>V_standpipe = Q_standpipe × t_standpipe</code>
                <p className="text-[11.5px] mt-1">
                  Per NFPA 14, Class I & III standpipe systems require 500 GPM for first riser + 250 GPM per additional riser (up to 1,000/1,250 GPM) for 30–60 minutes.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-1">
                <span className="font-bold text-foreground text-[13px] block">3. Makeup Water Inflow Credit</span>
                <code>V_credit = Q_makeup × max(t_sprinkler, t_standpipe, t_hose)</code>
                <p className="text-[11.5px] mt-1">
                  NFPA 22 allows deducting automatic makeup supply only if the water source has certified continuous pressure and reliability approved by the AHJ.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 space-y-1 text-primary">
                <span className="font-bold text-foreground text-[13px] block">4. Total Minimum Dedicated Storage</span>
                <code className="font-bold">V_total = max(0, V_sprinkler + V_standpipe + V_hose - V_credit)</code>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setFormulaModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Assignment Modal (Matching Preliminary Cooling Load & Ventilation) */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          open={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetLabel={commentTargetItem.name}
          targetType="Fire Tank Capacity Parameter"
          calculatorTitle="Fire Tank Capacity"
          calculatorPath="/plumbing-fire-tank-capacity"
          existingComments={getItemComments(commentTargetItem.id)}
          onSave={handleSaveComment}
        />
      )}
    </AppShell>
  );
}

// Live Intelligence Drawer Component dedicated to Fire Tank Capacity
function FireTankIntelligenceDrawer({
  onClose,
  params,
  results,
  unitSystem,
  isEffectiveReadOnly,
  onApplyPreset,
  onOpenFormulaModal,
}: {
  onClose: () => void;
  params: FireTankParams;
  results: any;
  unitSystem: "ip" | "si";
  isEffectiveReadOnly: boolean;
  onApplyPreset: (presetId: string) => void;
  onOpenFormulaModal: () => void;
}) {
  const isSI = unitSystem === "si";

  return (
    <div className="h-full flex flex-col min-w-[360px] p-4 space-y-4 overflow-y-auto custom-scrollbar">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-[13px] font-bold text-foreground">NFPA 22 Tank Intelligence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Live Engineering Sizing Summary */}
      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Live Tank Capacity</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            {params.systemType.toUpperCase()}
          </span>
        </div>
        <div className="text-xl font-black text-foreground">
          {isSI ? `${results.totalM3.toFixed(1)} m³` : `${results.totalGal.toLocaleString()} gal`}
        </div>
        <div className="text-[11.5px] text-muted-foreground flex justify-between">
          <span>Metric Litres: <span className="font-bold text-foreground">{results.totalL.toLocaleString()} L</span></span>
          <span>Max Duration: <span className="font-bold text-foreground">{results.maxDur} min</span></span>
        </div>
      </div>

      {/* Engineering Diagnostic Checks */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Diagnostic & Compliance Checks
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2.5 text-[11.5px]">
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Gross Fire Demand Volume:</span>
            <span className="font-bold text-foreground">
              {isSI ? `${(results.grossDemandGal * GAL_TO_M3).toFixed(1)} m³` : `${results.grossDemandGal.toLocaleString()} gal`}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Makeup Water Credit:</span>
            <span className={`font-bold ${results.makeupCredit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
              {results.makeupCredit > 0 ? `-${results.makeupCredit.toLocaleString()} gal` : "None"}
            </span>
          </div>

          {results.mu > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Refill Recovery Time:</span>
              <span className={`font-bold ${results.isRefillCompliant ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {results.refillHours !== null ? `${results.refillHours.toFixed(1)} hrs` : "N/A"}
                <span className="text-[10px] ml-1 font-normal">({results.isRefillCompliant ? "NFPA Compliant ≤8h" : "Exceeds 8h"})</span>
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Freeboard / Sludge Allowance:</span>
            <span className="font-bold text-foreground">+10% Dead Storage</span>
          </div>
        </div>
      </div>

      {/* Quick Hazard Sizing Presets */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span>NFPA 13/14/22 Presets</span>
          <span className="text-[10px] text-muted-foreground">1-Click Apply</span>
        </div>

        <div className="space-y-1.5">
          {TANK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              disabled={isEffectiveReadOnly}
              onClick={() => onApplyPreset(preset.id)}
              className="w-full p-2.5 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-muted/30 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-foreground group-hover:text-primary transition-colors">
                  {preset.name}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="text-[10.5px] font-semibold text-primary/80 mt-0.5">
                {preset.category}
              </div>
              <div className="text-[10.5px] text-muted-foreground mt-0.5 line-clamp-2">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* NFPA 22 Key Engineering Rules */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          NFPA 22 Code Standards
        </div>
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">NFPA 22 Sec. 4.1.3 - Makeup Inflow</div>
            <p>Automatic refill credit is permissible only when continuous reliable supply is certified by the AHJ.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">NFPA 22 Sec. 5.2 - Usable Volume</div>
            <p>Usable volume excludes the vortex plate bottom dead space and the freeboard distance below overflow weir.</p>
          </div>
          <div className="p-2.5 rounded-lg border border-border/50 bg-background space-y-1">
            <div className="font-bold text-foreground">2-Cell Maintenance Split</div>
            <p>Recommended to divide storage into at least 2 compartmental cells for online cleaning and continuity.</p>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 border-t border-border/60 shrink-0">
        <button
          type="button"
          onClick={onOpenFormulaModal}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer border border-primary/20 shadow-2xs"
        >
          <Info className="size-3.5" />
          <span>View Formula Derivations</span>
        </button>
      </div>

    </div>
  );
}
